import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { channelApi, type Channel } from '../../services/channel-api';
import { messageApi, type Message } from '../../services/message-api';
import { io, Socket } from 'socket.io-client';
import { VoiceChannel } from '../voice/VoiceChannel';
import { Hash, Volume2 } from 'lucide-react';

export const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const { channelId } = useParams<{ channelId?: string }>();
  const { user, logout } = useAuthStore();
  
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'TEXT' | 'VOICE'>('TEXT');
  const [voiceChannelId, setVoiceChannelId] = useState<string | null>(null);

  useEffect(() => {
    fetchChannels();
    
    const token = localStorage.getItem('token');
    if (token) {
      const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
      const newSocket = io(socketUrl, {
        auth: { token },
      });
      
      newSocket.on('message:new', (message: Message) => {
        setMessages((prev) => [...prev, message]);
      });
      
      setSocket(newSocket);
      
      return () => {
        newSocket.disconnect();
      };
    }
  }, []);

  useEffect(() => {
    if (channelId && channels.length > 0) {
      const channel = channels.find((c) => c.id === channelId);
      if (channel) {
        setCurrentChannel(channel);
        
        if (channel.type === 'TEXT') {
          fetchMessages(channelId);
          socket?.emit('channel:join', channelId);
        }
      }
    } else if (!channelId) {
      setCurrentChannel(null);
      setMessages([]);
    }
  }, [channelId, channels, socket]);

  const fetchChannels = async () => {
    try {
      const data = await channelApi.getChannels();
      setChannels(data);
      setIsLoading(false);
      
      const textChannels = data.filter(c => c.type === 'TEXT');
      if (textChannels.length > 0 && !channelId) {
        navigate(`/channels/${textChannels[0].id}`);
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error);
      setIsLoading(false);
    }
  };

  const fetchMessages = async (chId: string) => {
    try {
      const data = await messageApi.getMessages(chId, { limit: 50 });
      setMessages(data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleSelectChannel = (channel: Channel) => {
    if (channel.type === 'VOICE') {
      setVoiceChannelId(channel.id);
    } else {
      setVoiceChannelId(null);
    }
    navigate(`/channels/${channel.id}`);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentChannel || !socket) return;
    
    socket.emit('message:send', {
      channelId: currentChannel.id,
      content: newMessage,
    });
    
    setNewMessage('');
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    
    try {
      const channel = await channelApi.createChannel({ 
        name: newChannelName.trim(),
        type: newChannelType,
      });
      setChannels([...channels, channel]);
      setNewChannelName('');
      setNewChannelType('TEXT');
      setShowCreateChannel(false);
      navigate(`/channels/${channel.id}`);
    } catch (error) {
      console.error('Failed to create channel:', error);
    }
  };

  const handleDeleteChannel = async (chId: string) => {
    try {
      await channelApi.deleteChannel(chId);
      setChannels(channels.filter((c) => c.id !== chId));
      if (currentChannel?.id === chId) {
        const remaining = channels.filter((c) => c.id !== chId);
        const textChannels = remaining.filter(c => c.type === 'TEXT');
        if (textChannels.length > 0) {
          navigate(`/channels/${textChannels[0].id}`);
        } else if (remaining.length > 0) {
          navigate(`/channels/${remaining[0].id}`);
        } else {
          navigate('/');
        }
      }
    } catch (error) {
      console.error('Failed to delete channel:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const textChannels = channels.filter(c => c.type === 'TEXT');
  const voiceChannels = channels.filter(c => c.type === 'VOICE');

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-900 text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 flex flex-col">
        {/* Header */}
        <div className="h-12 px-4 flex items-center border-b border-gray-700">
          <h1 className="font-semibold text-white">My-Speak</h1>
        </div>
        
        {/* Channels */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Text Channels */}
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold text-gray-400 uppercase flex items-center">
              <Hash className="w-3 h-3 mr-1" />
              Text
            </span>
            <button
              onClick={() => { setNewChannelType('TEXT'); setShowCreateChannel(true); }}
              className="text-gray-400 hover:text-white"
            >
              +
            </button>
          </div>
          
          {textChannels.map((channel) => (
            <div
              key={channel.id}
              className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer ${
                currentChannel?.id === channel.id && channel.type === 'TEXT'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              onClick={() => handleSelectChannel(channel)}
            >
              <span className="flex items-center">
                <Hash className="w-4 h-4 text-gray-400 mr-1" />
                {channel.name}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteChannel(channel.id); }}
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
              onClick={() => { setNewChannelType('VOICE'); setShowCreateChannel(true); }}
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
              onClick={() => handleSelectChannel(channel)}
            >
              <span className="flex items-center">
                <Volume2 className="w-4 h-4 text-gray-400 mr-1" />
                {channel.name}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteChannel(channel.id); }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        
        {/* Voice Channel Panel */}
        {voiceChannelId && socket && (
          <VoiceChannel
            channelId={voiceChannelId}
            channelName={voiceChannels.find(c => c.id === voiceChannelId)?.name || 'Voice'}
            socket={socket}
            onLeave={() => setVoiceChannelId(null)}
          />
        )}
        
        {/* User */}
        <div className="h-14 px-4 flex items-center justify-between border-t border-gray-700 bg-gray-800">
          <span className="text-sm text-gray-300">{user?.username}</span>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-white text-sm"
          >
            Logout
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {currentChannel && currentChannel.type === 'TEXT' ? (
          <>
            {/* Channel Header */}
            <div className="h-12 px-4 flex items-center border-b border-gray-700 bg-gray-800">
              <Hash className="w-5 h-5 text-gray-400 mr-2" />
              <span className="font-semibold text-white">{currentChannel.name}</span>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="flex flex-col">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-indigo-400">{msg.authorName}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-300 mt-1">{msg.content}</p>
                  </div>
                ))
              )}
            </div>
            
            {/* Message Input */}
            <div className="p-4 border-t border-gray-700">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message #${currentChannel.name}`}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="btn-primary px-4 py-2"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        ) : currentChannel && currentChannel.type === 'VOICE' ? (
          <div className="flex-1 flex items-center justify-center bg-gray-700">
            <div className="text-center">
              <Volume2 className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Voice Channel: {currentChannel.name}</p>
              <p className="text-gray-500 text-sm mt-2">Click "Join Voice" in the sidebar to connect</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              {channels.length === 0 ? (
                <div>
                  <p className="text-lg mb-2">No channels yet</p>
                  <button
                    onClick={() => setShowCreateChannel(true)}
                    className="btn-primary px-4 py-2"
                  >
                    Create First Channel
                  </button>
                </div>
              ) : (
                <p>Select a channel to start</p>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Create Channel Modal */}
      {showCreateChannel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96">
            <h2 className="text-lg font-semibold text-white mb-4">Create Channel</h2>
            <form onSubmit={handleCreateChannel}>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Channel Type</label>
                <div className="flex space-x-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="TEXT"
                      checked={newChannelType === 'TEXT'}
                      onChange={() => setNewChannelType('TEXT')}
                      className="mr-2"
                    />
                    <Hash className="w-4 h-4 mr-1" />
                    Text
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="VOICE"
                      checked={newChannelType === 'VOICE'}
                      onChange={() => setNewChannelType('VOICE')}
                      className="mr-2"
                    />
                    <Volume2 className="w-4 h-4 mr-1" />
                    Voice
                  </label>
                </div>
              </div>
              
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="Channel name"
                className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white mb-4 focus:outline-none focus:border-indigo-500"
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateChannel(false)}
                  className="px-4 py-2 text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChannelName.trim()}
                  className="btn-primary px-4 py-2"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
