export interface VADOptions {
  threshold?: number;
  frequencyRange?: [number, number];
  smoothingTimeConstant?: number;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onVolumeChange?: (volume: number) => void;
}

export class VADService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private options: VADOptions;
  private isSpeaking = false;
  private isActive = false;
  private animationFrameId: number | null = null;
  private volume = 0;

  constructor(options: VADOptions = {}) {
    this.options = {
      threshold: -50, // dB
      frequencyRange: [85, 255], // Hz range for voice (focus on fundamental + first formant)
      smoothingTimeConstant: 0.8,
      ...options,
    };
  }

  async start(stream: MediaStream): Promise<void> {
    if (this.isActive) {
      return;
    }

    try {
      this.audioContext = new AudioContext({
        sampleRate: 48000,
      });

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant;

      this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
      this.mediaStreamSource.connect(this.analyser);

      this.isActive = true;
      this.analyze();
    } catch (error) {
      console.error('Failed to start VAD:', error);
      throw error;
    }
  }

  stop(): void {
    this.isActive = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }

    if (this.analyser) {
      this.analyser = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isSpeaking = false;
    this.volume = 0;
  }

  private analyze(): void {
    if (!this.isActive || !this.analyser) {
      return;
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate volume in dB
    const average = this.calculateAverageVolume(dataArray);
    this.volume = Math.max(-100, 20 * Math.log10(average / 255));

    // Notify volume change
    this.options.onVolumeChange?.(this.volume);

    // Determine speaking state based on threshold
    const threshold = this.options.threshold ?? -50;
    const isSpeakingNow = this.volume > threshold;

    if (isSpeakingNow !== this.isSpeaking) {
      this.isSpeaking = isSpeakingNow;
      this.options.onSpeakingChange?.(this.isSpeaking);
    }

    this.animationFrameId = requestAnimationFrame(() => this.analyze());
  }

  private calculateAverageVolume(dataArray: Uint8Array): number {
    const [minFreq, maxFreq] = this.options.frequencyRange ?? [85, 255];
    
    // Map frequency range to FFT bin indices
    const sampleRate = 48000;
    const fftSize = this.analyser?.fftSize ?? 256;
    const binSize = sampleRate / fftSize;
    
    const minBin = Math.floor(minFreq / binSize);
    const maxBin = Math.ceil(maxFreq / binSize);

    let sum = 0;
    let count = 0;

    for (let i = minBin; i <= maxBin && i < dataArray.length; i++) {
      sum += dataArray[i];
      count++;
    }

    return count > 0 ? sum / count : 0;
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  getVolume(): number {
    return this.volume;
  }
}

export function createVAD(options?: VADOptions): VADService {
  return new VADService(options);
}
