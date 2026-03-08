import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';

export const AudioSettings: React.FC = () => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const loopbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    loadDevices();
    const savedDeviceId = localStorage.getItem('preferredMicrophone');
    if (savedDeviceId) {
      setSelectedDeviceId(savedDeviceId);
    }
    return () => {
      stopTest();
    };
  }, []);

  const loadDevices = async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = deviceList.filter(d => d.kind === 'audioinput');
      setDevices(audioInputs);
      if (audioInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(audioInputs[0].deviceId);
      }
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
    }
  };

  const updateVolume = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    setVolume(average / 255);

    animationFrameRef.current = requestAnimationFrame(updateVolume);
  }, []);

  const startTest = async () => {
    setError(null);
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);

      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;

      sourceRef.current.connect(analyserRef.current);

      destinationRef.current = audioContextRef.current.createMediaStreamDestination();

      const compressor = audioContextRef.current.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      sourceRef.current.connect(compressor);
      compressor.connect(destinationRef.current);

      loopbackAudioRef.current = new Audio();
      loopbackAudioRef.current.srcObject = destinationRef.current.stream;
      loopbackAudioRef.current.autoplay = true;

      setIsTesting(true);
      updateVolume();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(message);
    }
  };

  const stopTest = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (loopbackAudioRef.current) {
      loopbackAudioRef.current.pause();
      loopbackAudioRef.current.srcObject = null;
      loopbackAudioRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    analyserRef.current = null;
    destinationRef.current = null;
    setIsTesting(false);
    setVolume(0);
  };

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('preferredMicrophone', deviceId);
    if (isTesting) {
      stopTest();
      setTimeout(() => startTest(), 100);
    }
  };

  const handleToggleTest = () => {
    if (isTesting) {
      stopTest();
    } else {
      startTest();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Microphone</h3>
        <select
          value={selectedDeviceId}
          onChange={(e) => handleDeviceChange(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
        >
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Microphone ${devices.indexOf(device) + 1}`}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Test Microphone</h3>
        <p className="text-xs text-gray-500 mb-3">
          Click to hear your microphone input. Speak into your mic to test.
        </p>

        {error && (
          <div className="mb-3 p-2 bg-red-900/50 border border-red-700 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleToggleTest}
          className={`flex items-center space-x-2 px-4 py-2 rounded transition-colors ${
            isTesting
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {isTesting ? (
            <>
              <MicOff className="w-4 h-4" />
              <span>Stop Test</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span>Start Test</span>
            </>
          )}
        </button>
      </div>

      {isTesting && (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-2">Volume Level</h3>
          <div className="w-full h-4 bg-gray-700 rounded overflow-hidden">
            <div
              className="h-full transition-all duration-75"
              style={{
                width: `${volume * 100}%`,
                backgroundColor: volume > 0.8 ? '#ef4444' : volume > 0.5 ? '#f59e0b' : '#22c55e',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {isTesting && (
        <div className="flex items-center space-x-2 text-sm text-green-400">
          <Volume2 className="w-4 h-4" />
          <span>Listening to microphone...</span>
        </div>
      )}
    </div>
  );
};