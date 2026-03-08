export class NoiseSuppressionService {
  private static instance: NoiseSuppressionService | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private gainNode: GainNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private processedStream: MediaStream | null = null;
  private isEnabled: boolean = true;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): NoiseSuppressionService {
    if (!NoiseSuppressionService.instance) {
      NoiseSuppressionService.instance = new NoiseSuppressionService();
    }
    return NoiseSuppressionService.instance;
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
    console.log('Noise suppression service initialized');
  }

  async processStream(inputStream: MediaStream): Promise<MediaStream> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.audioContext = new AudioContext({ sampleRate: 48000 });

      this.sourceNode = this.audioContext.createMediaStreamSource(inputStream);

      this.highPassFilter = this.audioContext.createBiquadFilter();
      this.highPassFilter.type = 'highpass';
      this.highPassFilter.frequency.value = 80;
      this.highPassFilter.Q.value = 0.7;

      this.lowPassFilter = this.audioContext.createBiquadFilter();
      this.lowPassFilter.type = 'lowpass';
      this.lowPassFilter.frequency.value = 15000;
      this.lowPassFilter.Q.value = 0.7;

      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 30;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1;

      this.destinationNode = this.audioContext.createMediaStreamDestination();

      this.sourceNode.connect(this.highPassFilter);
      this.highPassFilter.connect(this.lowPassFilter);
      this.lowPassFilter.connect(this.compressor);
      this.compressor.connect(this.gainNode);
      this.gainNode.connect(this.destinationNode);

      this.processedStream = this.destinationNode.stream;

      const originalTrack = inputStream.getAudioTracks()[0];
      if (originalTrack) {
        this.processedStream.getAudioTracks().forEach(track => {
          track.enabled = originalTrack.enabled;
        });
      }

      console.log('Noise suppression applied successfully');
      return this.processedStream;
    } catch (error) {
      console.error('Failed to process stream:', error);
      return inputStream;
    }
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (this.gainNode) {
      this.gainNode.gain.value = enabled ? 1 : 0;
    }
    console.log(`Noise suppression ${enabled ? 'enabled' : 'disabled'}`);
  }

  getIsEnabled(): boolean {
    return this.isEnabled;
  }

  destroy(): void {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.highPassFilter) {
      this.highPassFilter.disconnect();
      this.highPassFilter = null;
    }

    if (this.lowPassFilter) {
      this.lowPassFilter.disconnect();
      this.lowPassFilter = null;
    }

    if (this.compressor) {
      this.compressor.disconnect();
      this.compressor = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.destinationNode) {
      this.destinationNode.disconnect();
      this.destinationNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.processedStream = null;
  }
}

export const noiseSuppressionService = NoiseSuppressionService.getInstance();