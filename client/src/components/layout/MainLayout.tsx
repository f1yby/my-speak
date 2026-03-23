import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { useChannels } from '../../hooks/useChannels';
import { useMessages } from '../../hooks/useMessages';
import { useSocket } from '../../hooks/useSocket';
import { ChannelSidebar } from './ChannelSidebar';
import { MessageArea } from './MessageArea';
import { CreateChannelModal } from './CreateChannelModal';
import { VoiceChannel } from '../voice/VoiceChannel';
import { Settings as SettingsIcon } from 'lucide-react';
import { Settings } from '../settings/Settings';
import type { Channel } from '../../services/channel-api';

export const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const { channelId } = useParams<{ channelId?: string }>();
  const { user, logout } = useAuthStore();

  const { channels, textChannels, voiceChannels, isLoading, createChannel, deleteChannel } = useChannels();
  const { messages, addMessage } = useMessages(
    channels.find((c) => c.id === channelId)?.type === 'TEXT' ? channelId : undefined
  );
  const { socket, isReconnecting, onNewMessage, joinChannel, sendMessage, setReconnectCallback } = useSocket();

  const [newMessage, setNewMessage] = useState('');
  const [voiceChannelId, setVoiceChannelId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [createChannelDefaultType, setCreateChannelDefaultType] = useState<'TEXT' | 'VOICE'>('TEXT');

  const currentChannel = channels.find((c) => c.id === channelId) ?? null;

  // Restore voice channel from localStorage
  useEffect(() => {
    const savedVoiceChannel = localStorage.getItem('activeVoiceChannel');
    if (savedVoiceChannel) {
      setVoiceChannelId(savedVoiceChannel);
    }
  }, []);

  // Auto-navigate to first text channel
  useEffect(() => {
    if (!isLoading && textChannels.length > 0 && !channelId) {
      navigate(`/channels/${textChannels[0].id}`);
    }
  }, [isLoading, textChannels, channelId, navigate]);

  // Join text channel socket room
  useEffect(() => {
    if (currentChannel?.type === 'TEXT' && channelId) {
      joinChannel(channelId);
    }
  }, [channelId, currentChannel, joinChannel]);

  // Set reconnect callback
  useEffect(() => {
    setReconnectCallback(() => {
      if (currentChannel?.type === 'TEXT' && channelId) {
        joinChannel(channelId);
      }
    });
  }, [currentChannel, channelId, joinChannel, setReconnectCallback]);

  // Subscribe to new messages
  useEffect(() => {
    return onNewMessage(addMessage);
  }, [onNewMessage, addMessage]);

  const handleSelectChannel = useCallback((channel: Channel) => {
    if (channel.type === 'VOICE') {
      setVoiceChannelId(channel.id);
      localStorage.setItem('activeVoiceChannel', channel.id);
    } else {
      setVoiceChannelId(null);
      localStorage.removeItem('activeVoiceChannel');
    }
    navigate(`/channels/${channel.id}`);
  }, [navigate]);

  const handleSendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentChannel) return;
    sendMessage(currentChannel.id, newMessage);
    setNewMessage('');
  }, [newMessage, currentChannel, sendMessage]);

  const handleCreateChannel = useCallback(async (name: string, type: 'TEXT' | 'VOICE') => {
    try {
      const channel = await createChannel({ name, type });
      setShowCreateChannel(false);
      navigate(`/channels/${channel.id}`);
    } catch (error) {
      console.error('Failed to create channel:', error);
    }
  }, [createChannel, navigate]);

  const handleDeleteChannel = useCallback(async (chId: string) => {
    try {
      await deleteChannel(chId);
      if (currentChannel?.id === chId) {
        const remaining = channels.filter((c) => c.id !== chId);
        const remainingText = remaining.filter((c) => c.type === 'TEXT');
        if (remainingText.length > 0) {
          navigate(`/channels/${remainingText[0].id}`);
        } else if (remaining.length > 0) {
          navigate(`/channels/${remaining[0].id}`);
        } else {
          navigate('/');
        }
      }
    } catch (error) {
      console.error('Failed to delete channel:', error);
    }
  }, [channels, currentChannel, deleteChannel, navigate]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-900 text-white overflow-hidden">
      {/* Reconnecting Banner */}
      {isReconnecting && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-600 text-white text-center py-1 text-sm z-50">
          Reconnecting...
        </div>
      )}

      {/* Sidebar */}
      <div className="w-64 bg-gray-800 flex flex-col">
        <div className="h-12 px-4 flex items-center border-b border-gray-700">
          <h1 className="font-semibold text-white">My-Speak</h1>
        </div>

        <ChannelSidebar
          textChannels={textChannels}
          voiceChannels={voiceChannels}
          currentChannelId={currentChannel?.id}
          voiceChannelId={voiceChannelId}
          onSelectChannel={handleSelectChannel}
          onDeleteChannel={handleDeleteChannel}
          onCreateTextChannel={() => { setCreateChannelDefaultType('TEXT'); setShowCreateChannel(true); }}
          onCreateVoiceChannel={() => { setCreateChannelDefaultType('VOICE'); setShowCreateChannel(true); }}
        />

        {/* Voice Channel Panel */}
        {voiceChannelId && socket && (
          <VoiceChannel
            channelId={voiceChannelId}
            channelName={voiceChannels.find((c) => c.id === voiceChannelId)?.name || 'Voice'}
            socket={socket}
            onLeave={() => {
              setVoiceChannelId(null);
              localStorage.removeItem('activeVoiceChannel');
            }}
            autoJoin={true}
          />
        )}

        {/* User */}
        <div className="h-14 px-4 flex items-center justify-between border-t border-gray-700 bg-gray-800">
          <span className="text-sm text-gray-300">{user?.username}</span>
          <div className="flex items-center space-x-2">
            <button onClick={() => setShowSettings(true)} className="text-gray-400 hover:text-white">
              <SettingsIcon className="w-4 h-4" />
            </button>
            <button onClick={handleLogout} className="text-gray-400 hover:text-white text-sm">
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <MessageArea
        currentChannel={currentChannel}
        messages={messages}
        newMessage={newMessage}
        onNewMessageChange={setNewMessage}
        onSendMessage={handleSendMessage}
        channelCount={channels.length}
        onCreateChannel={() => setShowCreateChannel(true)}
      />

      {/* Create Channel Modal */}
      <CreateChannelModal
        isOpen={showCreateChannel}
        defaultType={createChannelDefaultType}
        onClose={() => setShowCreateChannel(false)}
        onCreate={handleCreateChannel}
      />

      {/* Settings Modal */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
};
