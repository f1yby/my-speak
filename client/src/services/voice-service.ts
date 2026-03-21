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
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private audioContext: AudioContext | null = null;
  private participantGains: Map<string, GainNode> = new Map();
  private isMuted: boolean = false;
  private isDeafened: boolean = false;
  private noiseSuppressionEnabled: boolean = true;

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

    this.socket.on('voice:joined', async (data: { rtpCapabilities: any; users: Array<{ socketId: string; username: string; producerId: string }> }) => {
      console.log('[Voice] Joined, RTP capabilities received');
      
      try {
        await this.initDevice(data.rtpCapabilities);
        await this.createTransports();
        await this.produce();

        for (const user of data.users) {
          this.onParticipantJoined?.({
            socketId: user.socketId,
            username: user.username,
            isMuted: false,
            isDeafened: false,
          });
          await this.consume(user.producerId, user.socketId);
        }
      } catch (error) {
        console.error('[Voice] Failed to initialize:', error);
        this.onError?.(error instanceof Error ? error.message : 'Failed to initialize voice');
      }
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
      this.onParticipantJoined?.({
        socketId: data.socketId,
        username: data.username,
        isMuted: false,
        isDeafened: false,
      });
      await this.consume(data.producerId, data.socketId);
    });
  }

  async joinChannel(channelId: string): Promise<boolean> {
    if (!this.socket) {
      this.onError?.('Not connected to server');
      return false;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.onError?.('Microphone access is not available');
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
          console.warn('Failed to apply noise suppression:', error);
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

      this.socket.emit('voice:join', channelId);
      
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get microphone access';
      this.onError?.(message);
      return false;
    }
  }

  private async initDevice(rtpCapabilities: any): Promise<void> {
    if (!rtpCapabilities) {
      throw new Error('No RTP capabilities received');
    }
    
    this.device = new Device();
    await this.device.load({ routerRtpCapabilities: rtpCapabilities });
    console.log('[Voice] Device loaded');
  }

  private async createTransports(): Promise<void> {
    if (!this.device || !this.socket) return;

    const sendParams = await new Promise<any>((resolve) => {
      this.socket!.emit('voice:create-transport', resolve);
    });

    if (sendParams.error) {
      throw new Error(sendParams.error);
    }

    this.sendTransport = this.device.createSendTransport({
      id: sendParams.id,
      iceParameters: sendParams.iceParameters,
      iceCandidates: sendParams.iceCandidates,
      dtlsParameters: sendParams.dtlsParameters,
    });

    this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await new Promise<void>((resolve, reject) => {
          this.socket!.emit('voice:connect-transport', { transportId: sendParams.id, dtlsParameters }, (result: any) => {
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
          this.socket!.emit('voice:produce', { transportId: sendParams.id, kind, rtpParameters }, resolve);
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

    const recvParams = await new Promise<any>((resolve) => {
      this.socket!.emit('voice:create-transport', resolve);
    });

    if (recvParams.error) {
      throw new Error(recvParams.error);
    }

    this.recvTransport = this.device.createRecvTransport({
      id: recvParams.id,
      iceParameters: recvParams.iceParameters,
      iceCandidates: recvParams.iceCandidates,
      dtlsParameters: recvParams.dtlsParameters,
    });

    this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        console.log('[Voice] recvTransport connect event');
        await new Promise<void>((resolve, reject) => {
          this.socket!.emit('voice:connect-transport', { transportId: recvParams.id, dtlsParameters }, (result: any) => {
            if (result.error) reject(new Error(result.error));
            else resolve();
          });
        });
        console.log('[Voice] recvTransport connected');
        callback();
      } catch (error) {
        console.error('[Voice] recvTransport connect error:', error);
        errback(error as Error);
      }
    });

    this.socket!.emit('voice:set-transport', {
      sendTransportId: sendParams.id,
      recvTransportId: recvParams.id,
    });

    console.log('[Voice] Transports created');
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

    console.log('[Voice] Producer created:', this.producer.id);
  }

  private async consume(producerId: string, socketId: string): Promise<void> {
    if (!this.socket || !this.recvTransport || !this.device) return;

    console.log('[Voice] Requesting to consume producer:', producerId);
    
    const result = await new Promise<any>((resolve) => {
      this.socket!.emit('voice:consume', {
        producerId,
        transportId: this.recvTransport!.id,
        rtpCapabilities: this.device!.rtpCapabilities,
      }, resolve);
    });

    if (!result || result.error) {
      console.error('[Voice] Failed to consume:', result?.error);
      return;
    }

    console.log('[Voice] Server consumer created:', result.id);

    const consumer = await this.recvTransport.consume({
      id: result.id,
      producerId: result.producerId,
      kind: result.kind,
      rtpParameters: result.rtpParameters,
    });

    console.log('[Voice] Local consumer created, track:', consumer.track?.id, consumer.track?.readyState);

    this.consumers.set(socketId, consumer);

    const stream = new MediaStream([consumer.track]);
    
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.volume = 1.0;
    
    audio.onloadedmetadata = () => {
      console.log('[Voice] Audio metadata loaded for', socketId);
    };
    
    audio.onplay = () => {
      console.log('[Voice] Audio playing for', socketId);
    };
    
    audio.onerror = (e) => {
      console.error('[Voice] Audio error:', e);
    };
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => console.log('[Voice] Audio play() succeeded for', socketId))
        .catch(e => console.error('[Voice] Audio play() failed:', e));
    }
    
    this.audioElements.set(socketId, audio);
    console.log('[Voice] Audio element created for', socketId);
  }

    const consumer = await this.recvTransport.consume({
      id: result.id,
      producerId: result.producerId,
      kind: result.kind,
      rtpParameters: result.rtpParameters,
    });

    this.consumers.set(socketId, consumer);

    const stream = new MediaStream([consumer.track]);
    console.log('[Voice] Consumer track:', consumer.track?.kind, consumer.track?.enabled, consumer.track?.readyState);

    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.volume = 1.0;
    
    audio.play().catch(e => {
      console.error('[Voice] Audio play failed:', e);
    });
    
    this.audioElements.set(socketId, audio);
    console.log('[Voice] Audio element created for', socketId);

    console.log('[Voice] Consumer created for', socketId);
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

    this.device = null;
  }
}

export const voiceService = new VoiceService();
