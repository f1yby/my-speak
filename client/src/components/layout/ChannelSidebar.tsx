import React from 'react';
import { Hash, Volume2 } from 'lucide-react';
import type { Channel } from '../../services/channel-api';

interface ChannelSidebarProps {
  textChannels: Channel[];
  voiceChannels: Channel[];
  currentChannelId?: string;
  voiceChannelId: string | null;
  onSelectChannel: (channel: Channel) => void;
  onDeleteChannel: (channelId: string) => void;
  onCreateTextChannel: () => void;
  onCreateVoiceChannel: () => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  textChannels,
  voiceChannels,
  currentChannelId,
  voiceChannelId,
  onSelectChannel,
  onDeleteChannel,
  onCreateTextChannel,
  onCreateVoiceChannel,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-2">
      {/* Text Channels */}
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-semibold text-gray-400 uppercase flex items-center">
          <Hash className="w-3 h-3 mr-1" />
          Text
        </span>
        <button
          onClick={onCreateTextChannel}
          className="text-gray-400 hover:text-white"
        >
          +
        </button>
      </div>

      {textChannels.map((channel) => (
        <div
          key={channel.id}
          className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer ${
            currentChannelId === channel.id && channel.type === 'TEXT'
              ? 'bg-gray-700 text-white'
              : 'text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
          onClick={() => onSelectChannel(channel)}
        >
          <span className="flex items-center">
            <Hash className="w-4 h-4 text-gray-400 mr-1" />
            {channel.name}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteChannel(channel.id); }}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400"
          >
            ×
          </button>
        </div>
      ))}

      {/* Voice Channels */}
      <div className="flex items-center justify-between px-2 py-1 mt-4">
        <span className="text-xs font-semibold text-gray-400 uppercase flex items-center">
          <Volume2 className="w-3 h-3 mr-1" />
          Voice
        </span>
        <button
          onClick={onCreateVoiceChannel}
          className="text-gray-400 hover:text-white"
        >
          +
        </button>
      </div>

      {voiceChannels.map((channel) => (
        <div
          key={channel.id}
          className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer ${
            voiceChannelId === channel.id
              ? 'bg-gray-700 text-white'
              : 'text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
          onClick={() => onSelectChannel(channel)}
        >
          <span className="flex items-center">
            <Volume2 className="w-4 h-4 text-gray-400 mr-1" />
            {channel.name}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteChannel(channel.id); }}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
