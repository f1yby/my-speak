import { Socket } from 'socket.io-client';
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
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private isMuted: boolean = false;
  private isDeafened: boolean = false;
  private noiseSuppressionEnabled: boolean = true;
  
  private readonly ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

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
        this.createPeerConnection(p.socketId, true);
      });
    });

    this.socket.on('voice:user-joined', (participant: VoiceParticipant) => {
      this.onParticipantJoined?.(participant);
      this.createPeerConnection(participant.socketId, false);
    });

    this.socket.on('voice:user-left', ({ socketId }: { socketId: string }) => {
      this.closePeerConnection(socketId);
      this.onParticipantLeft?.(socketId);
    });

    this.socket.on('voice:user-muted', ({ socketId, isMuted }: { socketId: string; isMuted: boolean }) => {
      this.onParticipantMuted?.(socketId, isMuted);
    });

    this.socket.on('voice:user-deafened', ({ socketId, isDeafened }: { socketId: string; isDeafened: boolean }) => {
      this.onParticipantDeafened?.(socketId, isDeafened);
    });

    this.socket.on('voice:signal', async ({ from, signal }: { from: string; signal: any }) => {
      await this.handleSignal(from, signal);
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
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
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

      this.socket.emit('voice:join', channelId);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get microphone access';
      this.onError?.(message);
      return false;
    }
  }

  private createPeerConnection(socketId: string, isInitiator: boolean): RTCPeerConnection {
    if (this.peerConnections.has(socketId)) {
      return this.peerConnections.get(socketId)!;
    }

    const pc = new RTCPeerConnection({ iceServers: this.ICE_SERVERS });
    this.peerConnections.set(socketId, pc);

    const streamToSend = this.processedStream || this.localStream;
    if (streamToSend) {
      streamToSend.getTracks().forEach((track) => {
        pc.addTrack(track, streamToSend!);
      });
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      this.remoteStreams.set(socketId, stream);
      
      let audio = this.audioElements.get(socketId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        this.audioElements.set(socketId, audio);
      }
      audio.srcObject = stream;
      
      if (this.isDeafened) {
        audio.muted = true;
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('voice:signal', {
          to: socketId,
          signal: { type: 'ice', candidate: event.candidate },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.closePeerConnection(socketId);
      }
    };

    if (isInitiator) {
      this.createOffer(socketId);
    }

    return pc;
  }

  private async createOffer(socketId: string): Promise<void> {
    const pc = this.peerConnections.get(socketId);
    if (!pc || !this.socket) return;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      this.socket.emit('voice:signal', {
        to: socketId,
        signal: { type: 'offer', sdp: offer },
      });
    } catch (error) {
      console.error('Failed to create offer:', error);
    }
  }

  private async handleSignal(from: string, signal: any): Promise<void> {
    if (!this.socket) return;

    let pc = this.peerConnections.get(from);
    
    if (!pc) {
      pc = this.createPeerConnection(from, false);
    }

    try {
      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        this.socket.emit('voice:signal', {
          to: from,
          signal: { type: 'answer', sdp: answer },
        });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'ice') {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (error) {
      console.error('Failed to handle signal:', error);
    }
  }

  private closePeerConnection(socketId: string): void {
    const pc = this.peerConnections.get(socketId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(socketId);
    }
    
    this.remoteStreams.delete(socketId);
    
    const audio = this.audioElements.get(socketId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      this.audioElements.delete(socketId);
    }
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

    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.remoteStreams.clear();

    this.audioElements.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
    });
    this.audioElements.clear();

    if (this.socket) {
      this.socket.emit('voice:leave');
    }
  }
}

export const voiceService = new VoiceService();
