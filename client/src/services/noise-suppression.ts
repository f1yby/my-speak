export class NoiseSuppressionService {
  private static instance: NoiseSuppressionService | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;
  private noiseGate: ScriptProcessorNode | null = null;
  private gainNode: GainNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private processedStream: MediaStream | null = null;
  private isEnabled: boolean = true;
  private isInitialized: boolean = false;
  
  private noiseGateThreshold: number = 0.02;
  private noiseGateAttack: number = 0.01;
  private noiseGateRelease: number = 0.1;
  private currentGain: number = 1;

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
      this.highPassFilter.frequency.value = 100;
      this.highPassFilter.Q.value = 0.7;
      
      this.lowPassFilter = this.audioContext.createBiquadFilter();
      this.lowPassFilter.type = 'lowpass';
      this.lowPassFilter.frequency.value = 12000;
      this.lowPassFilter.Q.value = 0.7;
      
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1;
      
      const bufferSize = 512;
      this.noiseGate = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      this.noiseGate.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const outputBuffer = event.outputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        const outputData = outputBuffer.getChannelData(0);
        
        if (!this.isEnabled) {
          outputData.set(inputData);
          return;
        }
        
        for (let i = 0; i < inputData.length; i++) {
          const input = inputData[i];
          const absInput = Math.abs(input);
          
          if (absInput < this.noiseGateThreshold) {
            if (this.currentGain > 0) {
              this.currentGain = Math.max(0, this.currentGain - this.noiseGateAttack);
            }
          } else {
            if (this.currentGain < 1) {
              this.currentGain = Math.min(1, this.currentGain + this.noiseGateRelease);
            }
          }
          
          outputData[i] = input * this.currentGain;
        }
      };
      
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      
      this.sourceNode.connect(this.highPassFilter);
      this.highPassFilter.connect(this.lowPassFilter);
      this.lowPassFilter.connect(this.noiseGate);
      this.noiseGate.connect(this.gainNode);
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
    this.currentGain = enabled ? 1 : 1;
    console.log(`Noise suppression ${enabled ? 'enabled' : 'disabled'}`);
  }

  getIsEnabled(): boolean {
    return this.isEnabled;
  }

  setThreshold(threshold: number): void {
    this.noiseGateThreshold = Math.max(0, Math.min(1, threshold));
  }

  getThreshold(): number {
    return this.noiseGateThreshold;
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
    
    if (this.noiseGate) {
      this.noiseGate.disconnect();
      this.noiseGate = null;
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
    this.currentGain = 1;
  }
}

export const noiseSuppressionService = NoiseSuppressionService.getInstance();
