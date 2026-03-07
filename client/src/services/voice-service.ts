import * as mediasoupClient from 'mediasoup-client';
import { Device } from 'mediasoup-client';
import type {
  Transport,
  Producer,
  Consumer,
} from 'mediasoup-client/lib/types';
import { io, Socket } from 'socket.io-client';
import { VADService } from './vad-service';

export interface VoiceParticipant {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  producerId: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
}

interface VoiceState {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  participants: VoiceParticipant[];
  error: string | null;
  currentChannelId: string | null;
  currentServerId: string | null;
}

interface VoiceCallbacks {
  onParticipantJoined?: (participant: VoiceParticipant) => void;
  onParticipantLeft?: (userId: string) => void;
  onParticipantMuted?: (userId: string, isMuted: boolean) => void;
  onParticipantDeafened?: (userId: string, isDeafened: boolean) => void;
  onParticipantSpeaking?: (userId: string, isSpeaking: boolean) => void;
  onAudioStream?: (userId: string, stream: MediaStream) => void;
  onError?: (error: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onLocalSpeakingChange?: (isSpeaking: boolean) => void;
}

class VoiceService {
  private socket: Socket | null = null;
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  private producer: Producer | null = null;
  private consumers: Map<string, Consumer> = new Map();
  private localStream: MediaStream | null = null;
  private callbacks: VoiceCallbacks = {};
  private state: VoiceState = {
    isConnected: false,
    isConnecting: false,
    isMuted: false,
    isDeafened: false,
    participants: [],
    error: null,
    currentChannelId: null,
    currentServerId: null,
  };
  private vad: VADService | null = null;
  private isLocalSpeaking = false;

  constructor() {
    this.initializeSocket();
  }

  private initializeSocket() {
    const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    this.socket = io(serverUrl, {
      withCredentials: true,
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.cleanup();
    });

    this.socket.on('voice:user-joined', ({ participant }: { participant: VoiceParticipant }) => {
      this.state.participants.push(participant);
      this.callbacks.onParticipantJoined?.(participant);
    });

    this.socket.on('voice:user-left', ({ userId }: { userId: string }) => {
      this.state.participants = this.state.participants.filter(
        (p) => p.userId !== userId
      );
      this.callbacks.onParticipantLeft?.(userId);
      
      const consumer = this.consumers.get(userId);
      if (consumer) {
        consumer.close();
        this.consumers.delete(userId);
      }
    });

    this.socket.on('voice:user-muted', ({ userId, isMuted }: { userId: string; isMuted: boolean }) => {
      const participant = this.state.participants.find((p) => p.userId === userId);
      if (participant) {
        participant.isMuted = isMuted;
      }
      this.callbacks.onParticipantMuted?.(userId, isMuted);
    });

    this.socket.on('voice:user-deafened', ({ userId, isDeafened }: { userId: string; isDeafened: boolean }) => {
      const participant = this.state.participants.find((p) => p.userId === userId);
      if (participant) {
        participant.isDeafened = isDeafened;
      }
      this.callbacks.onParticipantDeafened?.(userId, isDeafened);
    });

    this.socket.on('voice:user-speaking', ({ userId, isSpeaking }: { userId: string; isSpeaking: boolean }) => {
      const participant = this.state.participants.find((p) => p.userId === userId);
      if (participant) {
        participant.isSpeaking = isSpeaking;
      }
      this.callbacks.onParticipantSpeaking?.(userId, isSpeaking);
    });

    this.socket.on('voice:new-producer', async ({ userId, producerId }: { userId: string; producerId: string }) => {
      if (!this.device || !this.recvTransport) return;
      
      try {
        await this.consume(userId, producerId);
      } catch (error) {
        console.error('Failed to consume new producer:', error);
      }
    });
  }

  setCallbacks(callbacks: VoiceCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  getState(): VoiceState {
    return { ...this.state };
  }

  async joinVoiceChannel(
    channelId: string,
    serverId: string,
    userId: string
  ): Promise<boolean> {
    if (this.state.isConnecting || this.state.isConnected) {
      return false;
    }

    this.state.isConnecting = true;
    this.state.error = null;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      });

      // Initialize VAD for local audio
      this.vad = new VADService({
        threshold: -50,
        onSpeakingChange: (isSpeaking) => {
          if (this.isLocalSpeaking !== isSpeaking) {
            this.isLocalSpeaking = isSpeaking;
            this.socket?.emit('voice:speaking', { isSpeaking });
            this.callbacks.onLocalSpeakingChange?.(isSpeaking);
          }
        },
      });
      await this.vad.start(this.localStream);

      const response = await this.emitWithAck('voice:join', {
        channelId,
        serverId,
        userId,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to join voice channel');
      }

      const { routerRtpCapabilities, participants } = response.data;

      this.device = new Device();
      await this.device.load({ routerRtpCapabilities });

      await this.createSendTransport();
      await this.createRecvTransport();
      await this.startProducing();

      for (const participant of participants) {
        if (participant.producerId) {
          await this.consume(participant.userId, participant.producerId);
        }
      }

      this.state.isConnected = true;
      this.state.isConnecting = false;
      this.state.currentChannelId = channelId;
      this.state.currentServerId = serverId;
      this.state.participants = participants;

      this.callbacks.onConnected?.();
      
      return true;
    } catch (error) {
      this.state.isConnecting = false;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      this.callbacks.onError?.(this.state.error);
      this.cleanup();
      
      return false;
    }
  }

  private async createSendTransport() {
    if (!this.socket || !this.device) return;

    const response = await this.emitWithAck('voice:create-send-transport', {});

    if (!response.success) {
      throw new Error(response.error || 'Failed to create send transport');
    }

    const { id, iceParameters, iceCandidates, dtlsParameters } = response.data;

    this.sendTransport = this.device.createSendTransport({
      id,
      iceParameters,
      iceCandidates,
      dtlsParameters,
    });

    this.sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.emitWithAck('voice:connect-transport', {
        direction: 'send',
        dtlsParameters,
      })
        .then(() => callback())
        .catch(errback);
    });

    this.sendTransport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
      this.emitWithAck('voice:produce', { rtpParameters })
        .then((response) => {
          if (response.success) {
            callback({ id: response.data.producerId });
          } else {
            errback(new Error(response.error));
          }
        })
        .catch(errback);
    });
  }

  private async createRecvTransport() {
    if (!this.socket || !this.device) return;

    const response = await this.emitWithAck('voice:create-recv-transport', {});

    if (!response.success) {
      throw new Error(response.error || 'Failed to create receive transport');
    }

    const { id, iceParameters, iceCandidates, dtlsParameters } = response.data;

    this.recvTransport = this.device.createRecvTransport({
      id,
      iceParameters,
      iceCandidates,
      dtlsParameters,
    });

    this.recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.emitWithAck('voice:connect-transport', {
        direction: 'recv',
        dtlsParameters,
      })
        .then(() => callback())
        .catch(errback);
    });
  }

  private async startProducing() {
    if (!this.sendTransport || !this.localStream) return;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (!audioTrack) return;

    this.producer = await this.sendTransport.produce({ track: audioTrack });
    
    if (this.state.isMuted) {
      this.producer.pause();
    }
  }

  private async consume(userId: string, producerId: string) {
    if (!this.device || !this.recvTransport) return;

    const response = await this.emitWithAck('voice:consume', {
      producerId,
      rtpCapabilities: this.device.rtpCapabilities,
    });

    if (!response.success || !response.data) {
      console.warn('Failed to consume producer:', response.error);
      return;
    }

    const { id, kind, rtpParameters } = response.data;

    const consumer = await this.recvTransport.consume({
      id,
      producerId,
      kind,
      rtpParameters,
    });

    this.consumers.set(userId, consumer);

    await this.emitWithAck('voice:resume-consumer', { consumerId: id });

    const stream = new MediaStream([consumer.track]);
    this.callbacks.onAudioStream?.(userId, stream);
  }

  async leaveVoiceChannel(): Promise<void> {
    if (!this.state.isConnected && !this.state.isConnecting) {
      return;
    }

    if (this.socket) {
      await this.emitWithAck('voice:leave', {});
    }

    this.cleanup();

    this.state.isConnected = false;
    this.state.isConnecting = false;
    this.state.participants = [];
    this.state.currentChannelId = null;
    this.state.currentServerId = null;

    this.callbacks.onDisconnected?.();
  }

  toggleMute(): boolean {
    if (!this.producer) return this.state.isMuted;

    this.state.isMuted = !this.state.isMuted;

    if (this.state.isMuted) {
      this.producer.pause();
    } else {
      this.producer.resume();
    }

    this.socket?.emit('voice:toggle-mute', { isMuted: this.state.isMuted });

    return this.state.isMuted;
  }

  toggleDeafen(): boolean {
    this.state.isDeafened = !this.state.isDeafened;

    for (const consumer of this.consumers.values()) {
      if (this.state.isDeafened) {
        consumer.pause();
      } else {
        consumer.resume();
      }
    }

    this.socket?.emit('voice:toggle-deafen', { isDeafened: this.state.isDeafened });

    return this.state.isDeafened;
  }

  private cleanup() {
    if (this.vad) {
      this.vad.stop();
      this.vad = null;
    }

    if (this.producer) {
      this.producer.close();
      this.producer = null;
    }

    for (const consumer of this.consumers.values()) {
      consumer.close();
    }
    this.consumers.clear();

    if (this.sendTransport) {
      this.sendTransport.close();
      this.sendTransport = null;
    }

    if (this.recvTransport) {
      this.recvTransport.close();
      this.recvTransport = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.device = null;
  }

  private emitWithAck(event: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit(event, data, (response: any) => {
        resolve(response);
      });
    });
  }

  destroy() {
    this.leaveVoiceChannel();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const voiceService = new VoiceService();
