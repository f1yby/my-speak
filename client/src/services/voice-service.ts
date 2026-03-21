import { Socket } from 'socket.io-client';
import { Device, types } from 'mediasoup-client';
import { noiseSuppressionService } from './noise-suppression';

export interface VoiceParticipant {
  socketId: string;
  username: string;
  isMuted: boolean;
  isDeafened: boolean;
}

export class VoiceService {
  private socket: Socket | null = null;
  private localStream: MediaStream | null = null;
  private processedStream: MediaStream | null = null;
  private device: Device | null = null;
  private sendTransport: types.Transport | null = null;
  private recvTransport: types.Transport | null = null;
  private producer: types.Producer | null = null;
  private consumers: Map<string, types.Consumer> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private audioContext: AudioContext | null = null;
  private participantGains: Map<string, GainNode> = new Map();
  private isMuted: boolean = false;
  private isDeafened: boolean = false;
  private noiseSuppressionEnabled: boolean = true;
  private currentChannelId: string | null = null;

  private onParticipantJoined?: (participant: VoiceParticipant) => void;
  private onParticipantLeft?: (socketId: string) => void;
  private onParticipantMuted?: (socketId: string, isMuted: boolean) => void;
  private onParticipantDeafened?: (socketId: string, isDeafened: boolean) => void;
  private onError?: (error: string) => void;

  setSocket(socket: Socket): void {
    this.socket = socket;
  }

  setCallbacks(callbacks: {
    onParticipantJoined?: (participant: VoiceParticipant) => void;
    onParticipantLeft?: (socketId: string) => void;
    onParticipantMuted?: (socketId: string, isMuted: boolean) => void;
    onParticipantDeafened?: (socketId: string, isDeafened: boolean) => void;
    onError?: (error: string) => void;
  }): void {
    this.onParticipantJoined = callbacks.onParticipantJoined;
    this.onParticipantLeft = callbacks.onParticipantLeft;
    this.onParticipantMuted = callbacks.onParticipantMuted;
    this.onParticipantDeafened = callbacks.onParticipantDeafened;
    this.onError = callbacks.onError;
  }

  setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.on('voice:participants', (participants: VoiceParticipant[]) => {
      participants.forEach((p) => {
        this.onParticipantJoined?.(p);
      });
    });

    this.socket.on('voice:user-joined', (participant: VoiceParticipant) => {
      this.onParticipantJoined?.(participant);
    });

    this.socket.on('voice:user-left', ({ socketId }: { socketId: string }) => {
      this.closeConsumer(socketId);
      this.onParticipantLeft?.(socketId);
    });

    this.socket.on('voice:user-muted', ({ socketId, isMuted }: { socketId: string; isMuted: boolean }) => {
      this.onParticipantMuted?.(socketId, isMuted);
    });

    this.socket.on('voice:user-deafened', ({ socketId, isDeafened }: { socketId: string; isDeafened: boolean }) => {
      this.onParticipantDeafened?.(socketId, isDeafened);
    });

    this.socket.on('voice:new-producer', async (data: { producerId: string; socketId: string; username: string }) => {
      if (this.isDeafened) return;
      await this.consume(data.socketId, data.producerId);
    });

    this.socket.on('voice:producer-closed', ({ socketId }: { socketId: string }) => {
      this.closeConsumer(socketId);
    });
  }

  async joinChannel(channelId: string): Promise<boolean> {
    if (!this.socket) {
      this.onError?.('Not connected to server');
      return false;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.onError?.('Microphone access is not available. Please ensure you are using HTTPS and have granted microphone permissions.');
      return false;
    }

    try {
      const preferredDeviceId = localStorage.getItem('preferredMicrophone');
      
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1,
      };

      if (preferredDeviceId) {
        audioConstraints.deviceId = { exact: preferredDeviceId };
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });

      if (this.noiseSuppressionEnabled) {
        try {
          this.processedStream = await noiseSuppressionService.processStream(this.localStream);
        } catch (error) {
          console.warn('Failed to apply noise suppression, using original stream:', error);
          this.processedStream = this.localStream;
        }
      } else {
        this.processedStream = this.localStream;
      }

      if (this.isMuted) {
        this.processedStream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }

      this.audioContext = new AudioContext({ sampleRate: 48000 });
      this.currentChannelId = channelId;

      this.socket.emit('voice:join', channelId);

      console.log('[Voice] Initializing device...');
      await this.initDevice(channelId);
      console.log('[Voice] Creating send transport...');
      await this.createSendTransport(channelId);
      console.log('[Voice] Creating recv transport...');
      await this.createRecvTransport(channelId);
      console.log('[Voice] Producing audio...');
      await this.produce();
      console.log('[Voice] Ready!');

      await this.consumeExistingProducers();

      return true;
    } catch (error) {
      console.error('[Voice] Error:', error);
      const message = error instanceof Error ? error.message : 'Failed to get microphone access';
      this.onError?.(message);
      return false;
    }
  }

  private async initDevice(channelId: string): Promise<void> {
    if (!this.socket) return;

    this.device = new Device();

    console.log('[Voice] Getting router RTP capabilities...');
    const rtpCapabilities = await new Promise<any>((resolve) => {
      this.socket!.emit('voice:get-router-rtp-capabilities', channelId, resolve);
    });

    console.log('[Voice] RTP capabilities:', rtpCapabilities);

    if (!rtpCapabilities) {
      await this.device.load({
        routerRtpCapabilities: {
          codecs: [{
            kind: 'audio',
            mimeType: 'audio/opus',
            preferredPayloadType: 100,
            clockRate: 48000,
            channels: 2,
            parameters: { useinbandfec: 1, usedtx: 1, stereo: 1 },
          }],
          headerExtensions: [],
        },
      });
    } else {
      await this.device.load({ routerRtpCapabilities: rtpCapabilities });
    }
  }

  private async createSendTransport(channelId: string): Promise<void> {
    if (!this.socket || !this.device) return;

    console.log('[Voice] Creating send transport...');
    const transportParams = await new Promise<any>((resolve) => {
      this.socket!.emit('voice:create-transport', { channelId, direction: 'send' }, resolve);
    });

    console.log('[Voice] Send transport params:', transportParams);

    if (transportParams.error) {
      throw new Error(transportParams.error);
    }

    this.sendTransport = this.device.createSendTransport({
      id: transportParams.id,
      iceParameters: transportParams.iceParameters,
      iceCandidates: transportParams.iceCandidates,
      dtlsParameters: transportParams.dtlsParameters,
    });

    this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await new Promise<void>((resolve, reject) => {
          this.socket!.emit('voice:connect-transport', { channelId, direction: 'send', dtlsParameters }, (result: any) => {
            if (result.error) reject(new Error(result.error));
            else resolve();
          });
        });
        callback();
      } catch (error) {
        errback(error as Error);
      }
    });

    this.sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
      try {
        const result = await new Promise<any>((resolve) => {
          this.socket!.emit('voice:produce', { channelId, kind, rtpParameters }, resolve);
        });
        if (result.error) {
          errback(new Error(result.error));
        } else {
          callback({ id: result.producerId });
        }
      } catch (error) {
        errback(error as Error);
      }
    });
  }

  private async createRecvTransport(channelId: string): Promise<void> {
    if (!this.socket || !this.device) return;

    console.log('[Voice] Creating recv transport...');
    const transportParams = await new Promise<any>((resolve) => {
      this.socket!.emit('voice:create-transport', { channelId, direction: 'recv' }, resolve);
    });

    console.log('[Voice] Recv transport params:', transportParams);

    if (transportParams.error) {
      throw new Error(transportParams.error);
    }

    this.recvTransport = this.device.createRecvTransport({
      id: transportParams.id,
      iceParameters: transportParams.iceParameters,
      iceCandidates: transportParams.iceCandidates,
      dtlsParameters: transportParams.dtlsParameters,
    });

    this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await new Promise<void>((resolve, reject) => {
          this.socket!.emit('voice:connect-transport', { channelId, direction: 'recv', dtlsParameters }, (result: any) => {
            if (result.error) reject(new Error(result.error));
            else resolve();
          });
        });
        callback();
      } catch (error) {
        errback(error as Error);
      }
    });
  }

  private async produce(): Promise<void> {
    if (!this.sendTransport || !this.processedStream) return;

    const track = this.processedStream.getAudioTracks()[0];
    if (!track) return;

    this.producer = await this.sendTransport.produce({
      track,
      codecOptions: {
        opusStereo: true,
        opusDtx: true,
      },
    });
  }

  private async consumeExistingProducers(): Promise<void> {
    if (this.isDeafened || !this.socket || !this.currentChannelId) return;

    console.log('[Voice] Getting existing producers...');
    const producers = await new Promise<Array<{ socketId: string; producerId: string; username: string }>>((resolve) => {
      this.socket!.emit('voice:get-producers', this.currentChannelId, resolve);
    });

    console.log('[Voice] Found producers:', producers);

    for (const p of producers) {
      await this.consume(p.socketId, p.producerId);
    }
  }

  private async consume(producerSocketId: string, _producerId: string): Promise<void> {
    if (!this.socket || !this.recvTransport || !this.device) return;

    console.log('[Voice] Consuming from', producerSocketId);
    const consumerParams = await new Promise<any>((resolve) => {
      this.socket!.emit('voice:consume', {
        channelId: this.currentChannelId,
        producerSocketId,
        rtpCapabilities: this.device!.rtpCapabilities,
      }, resolve);
    });

    console.log('[Voice] Consumer params:', consumerParams);

    if (!consumerParams || consumerParams.error) {
      console.error('[Voice] Failed to consume:', consumerParams?.error);
      return;
    }

    const consumer = await this.recvTransport.consume({
      id: consumerParams.consumerId,
      producerId: consumerParams.producerId,
      kind: consumerParams.kind,
      rtpParameters: consumerParams.rtpParameters,
    });

    this.consumers.set(producerSocketId, consumer);

    const stream = new MediaStream([consumer.track]);
    this.remoteStreams.set(producerSocketId, stream);

    if (this.audioContext && this.audioContext.state === 'running') {
      this.setupAudioProcessing(producerSocketId, stream);
    } else {
      let audio = this.audioElements.get(producerSocketId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        this.audioElements.set(producerSocketId, audio);
      }
      audio.srcObject = stream;

      if (this.isDeafened) {
        audio.muted = true;
      }
    }
  }

  private setupAudioProcessing(socketId: string, stream: MediaStream): void {
    if (!this.audioContext) return;

    const source = this.audioContext.createMediaStreamSource(stream);
    const gainNode = this.audioContext.createGain();
    
    const savedVolume = localStorage.getItem(`voice_volume_${socketId}`);
    gainNode.gain.value = savedVolume ? parseFloat(savedVolume) : 1;
    
    this.participantGains.set(socketId, gainNode);
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
  }

  private closeConsumer(socketId: string): void {
    const consumer = this.consumers.get(socketId);
    if (consumer) {
      consumer.close();
      this.consumers.delete(socketId);
    }

    this.remoteStreams.delete(socketId);

    const gainNode = this.participantGains.get(socketId);
    if (gainNode) {
      gainNode.disconnect();
      this.participantGains.delete(socketId);
    }

    const audio = this.audioElements.get(socketId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      this.audioElements.delete(socketId);
    }
  }

  setParticipantVolume(socketId: string, volume: number): void {
    const gainNode = this.participantGains.get(socketId);
    if (gainNode) {
      gainNode.gain.value = volume;
      localStorage.setItem(`voice_volume_${socketId}`, volume.toString());
    }
  }

  getParticipantVolume(socketId: string): number {
    const savedVolume = localStorage.getItem(`voice_volume_${socketId}`);
    if (savedVolume) {
      return parseFloat(savedVolume);
    }
    return 1;
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    
    const streamToMute = this.processedStream || this.localStream;
    if (streamToMute) {
      streamToMute.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    
    this.socket?.emit('voice:mute', this.isMuted);
    return this.isMuted;
  }

  toggleDeafen(): boolean {
    this.isDeafened = !this.isDeafened;
    
    this.audioElements.forEach((audio) => {
      audio.muted = this.isDeafened;
    });

    this.participantGains.forEach((gainNode) => {
      gainNode.gain.value = this.isDeafened ? 0 : 1;
    });
    
    this.socket?.emit('voice:deafen', this.isDeafened);
    return this.isDeafened;
  }

  toggleNoiseSuppression(): boolean {
    this.noiseSuppressionEnabled = !this.noiseSuppressionEnabled;
    noiseSuppressionService.setEnabled(this.noiseSuppressionEnabled);
    return this.noiseSuppressionEnabled;
  }

  getIsMuted(): boolean {
    return this.isMuted;
  }

  getIsDeafened(): boolean {
    return this.isDeafened;
  }

  getNoiseSuppressionEnabled(): boolean {
    return this.noiseSuppressionEnabled;
  }

  leaveChannel(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    
    noiseSuppressionService.destroy();
    this.processedStream = null;

    if (this.producer) {
      this.producer.close();
      this.producer = null;
    }

    this.consumers.forEach((consumer) => consumer.close());
    this.consumers.clear();
    this.remoteStreams.clear();

    if (this.sendTransport) {
      this.sendTransport.close();
      this.sendTransport = null;
    }

    if (this.recvTransport) {
      this.recvTransport.close();
      this.recvTransport = null;
    }

    this.audioElements.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
    });
    this.audioElements.clear();
    
    this.participantGains.clear();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.socket) {
      this.socket.emit('voice:leave');
    }

    this.currentChannelId = null;
  }
}

export const voiceService = new VoiceService();
