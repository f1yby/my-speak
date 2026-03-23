import React, { useEffect, useState, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Users, Waves } from 'lucide-react';
import { voiceService, type VoiceParticipant } from '../../services/voice-service';

interface VoiceChannelProps {
  channelId: string;
  channelName: string;
  socket: any;
  onLeave?: () => void;
  autoJoin?: boolean;
}

export const VoiceChannel: React.FC<VoiceChannelProps> = ({
  channelId,
  channelName,
  socket,
  onLeave,
  autoJoin = false,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = useState(true);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [participantVolumes, setParticipantVolumes] = useState<Map<string, number>>(new Map());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingParticipants, setSpeakingParticipants] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleJoin = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    const success = await voiceService.joinChannel(channelId);
    
    if (success) {
      setIsConnected(true);
      setIsMuted(false);
      setIsDeafened(false);
    }
    
    setIsConnecting(false);
  }, [channelId]);

  useEffect(() => {
    voiceService.setSocket(socket);
    voiceService.setCallbacks({
      onParticipantJoined: (participant) => {
        setParticipants((prev) => [...prev.filter(p => p.socketId !== participant.socketId), participant]);
      },
      onParticipantLeft: (socketId) => {
        setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
      },
      onParticipantMuted: (socketId, muted) => {
        setParticipants((prev) =>
          prev.map((p) => (p.socketId === socketId ? { ...p, isMuted: muted } : p))
        );
      },
      onParticipantDeafened: (socketId, deafened) => {
        setParticipants((prev) =>
          prev.map((p) => (p.socketId === socketId ? { ...p, isDeafened: deafened } : p))
        );
      },
      onParticipantSpeaking: (socketId, speaking) => {
        setSpeakingParticipants((prev) => {
          const next = new Set(prev);
          if (speaking) {
            next.add(socketId);
          } else {
            next.delete(socketId);
          }
          return next;
        });
      },
      onSpeakingChange: (speaking) => {
        setIsSpeaking(speaking);
      },
      onError: (err) => {
        setError(err);
        setIsConnecting(false);
      },
    });

    voiceService.setupSocketHandlers();

    if (autoJoin) {
      handleJoin();
    }

    return () => {
      voiceService.leaveChannel();
    };
  }, [socket, autoJoin, handleJoin]);

  const handleLeave = () => {
    voiceService.leaveChannel();
    setIsConnected(false);
    setParticipants([]);
    onLeave?.();
  };

  const handleToggleMute = () => {
    const muted = voiceService.toggleMute();
    setIsMuted(muted);
  };

  const handleToggleDeafen = () => {
    const deafened = voiceService.toggleDeafen();
    setIsDeafened(deafened);
  };

  const handleToggleNoiseSuppression = () => {
    const enabled = voiceService.toggleNoiseSuppression();
    setNoiseSuppressionEnabled(enabled);
  };

  const handleVolumeChange = (socketId: string, volume: number) => {
    voiceService.setParticipantVolume(socketId, volume);
    setParticipantVolumes((prev) => {
      const next = new Map(prev);
      next.set(socketId, volume);
      return next;
    });
  };

  useEffect(() => {
    participants.forEach((p) => {
      if (!participantVolumes.has(p.socketId)) {
        const savedVolume = voiceService.getParticipantVolume(p.socketId);
        setParticipantVolumes((prev) => {
          const next = new Map(prev);
          next.set(p.socketId, savedVolume);
          return next;
        });
      }
    });
  }, [participants, participantVolumes]);

  if (!isConnected) {
    return (
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-300">🔊 {channelName}</span>
        </div>
        {error && (
          <div className="mb-2 text-sm text-red-400">{error}</div>
        )}
        <button
          onClick={handleJoin}
          disabled={isConnecting}
          className="w-full flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-colors disabled:opacity-50"
        >
          <Phone className="w-4 h-4" />
          <span>{isConnecting ? 'Connecting...' : 'Join Voice'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-gray-700 bg-gray-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-green-400">🔊 {channelName}</span>
        <span className="text-xs text-gray-400 flex items-center">
          <Users className="w-3 h-3 mr-1" />
          {participants.length + 1}
        </span>
      </div>

      {error && (
        <div className="mb-2 text-sm text-red-400">{error}</div>
      )}

      <div className="space-y-1 mb-3 max-h-32 overflow-y-auto">
        <div className="flex items-center space-x-2 text-sm">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all duration-200 ${
            isSpeaking && !isMuted
              ? 'bg-green-500 ring-2 ring-green-400 ring-opacity-75 animate-pulse'
              : 'bg-indigo-600'
          }`}>
            Y
          </div>
          <span className={`transition-colors duration-200 ${isSpeaking && !isMuted ? 'text-green-300' : 'text-gray-300'}`}>You</span>
          {isMuted && <MicOff className="w-3 h-3 text-red-400" />}
          {isDeafened && <VolumeX className="w-3 h-3 text-red-400" />}
          {noiseSuppressionEnabled && <Waves className="w-3 h-3 text-blue-400" />}
        </div>
        
        {participants.map((participant) => {
          const volume = participantVolumes.get(participant.socketId) ?? 1;
          const volumePercent = Math.round(volume * 100);
          const isParticipantSpeaking = speakingParticipants.has(participant.socketId);
          return (
            <div key={participant.socketId} className="space-y-1">
              <div className="flex items-center space-x-2 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 transition-all duration-200 ${
                  isParticipantSpeaking && !participant.isMuted
                    ? 'bg-green-500 ring-2 ring-green-400 ring-opacity-75 animate-pulse'
                    : 'bg-gray-600'
                }`}>
                  {participant.username[0].toUpperCase()}
                </div>
                <span className={`truncate transition-colors duration-200 ${isParticipantSpeaking && !participant.isMuted ? 'text-green-300' : 'text-gray-300'}`}>{participant.username}</span>
                {participant.isMuted && <MicOff className="w-3 h-3 text-red-400 flex-shrink-0" />}
                {participant.isDeafened && <VolumeX className="w-3 h-3 text-red-400 flex-shrink-0" />}
              </div>
              <div className="flex items-center space-x-2 pl-8">
                <Volume2 className="w-3 h-3 text-gray-500 flex-shrink-0" />
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={volume}
                  onChange={(e) => handleVolumeChange(participant.socketId, parseFloat(e.target.value))}
                  className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="text-xs text-gray-500 w-8 text-right">{volumePercent}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <button
            onClick={handleToggleMute}
            className={`p-2 rounded transition-colors ${
              isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          
          <button
            onClick={handleToggleDeafen}
            className={`p-2 rounded transition-colors ${
              isDeafened ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={handleToggleNoiseSuppression}
            className={`p-2 rounded transition-colors ${
              noiseSuppressionEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={noiseSuppressionEnabled ? 'Disable noise suppression' : 'Enable noise suppression'}
          >
            <Waves className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleLeave}
          className="p-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
          title="Leave Voice"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-2 text-xs text-gray-500">
        {noiseSuppressionEnabled ? '🌊 Noise suppression active' : 'Noise suppression off'}
      </div>
    </div>
  );
};