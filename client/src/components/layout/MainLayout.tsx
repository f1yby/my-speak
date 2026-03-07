import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { channelApi, type Channel } from '../../services/channel-api';
import { messageApi, type Message } from '../../services/message-api';
import { io, Socket } from 'socket.io-client';

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

  useEffect(() => {
    fetchChannels();
    
    const token = localStorage.getItem('token');
    if (token) {
      const newSocket = io('http://localhost:3001', {
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
        fetchMessages(channelId);
        socket?.emit('channel:join', channelId);
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
      
      if (data.length > 0 && !channelId) {
        navigate(`/channels/${data[0].id}`);
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error);
      setIsLoading(false);
    }
  };

  const fetchMessages = async (chId: string) => {
    try {
      const data = await messageApi.getMessages(chId, 50);
      setMessages(data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleSelectChannel = (channel: Channel) => {
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
      const channel = await channelApi.createChannel({ name: newChannelName.trim() });
      setChannels([...channels, channel]);
      setNewChannelName('');
      setShowCreateChannel(false);
      navigate(`/channels/${channel.id}`);
    } catch (error) {
      console.error('Failed to create channel:', error);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      await channelApi.deleteChannel(channelId);
      setChannels(channels.filter((c) => c.id !== channelId));
      if (currentChannel?.id === channelId) {
        const remaining = channels.filter((c) => c.id !== channelId);
        if (remaining.length > 0) {
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
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold text-gray-400 uppercase">Channels</span>
            <button
              onClick={() => setShowCreateChannel(true)}
              className="text-gray-400 hover:text-white"
            >
              +
            </button>
          </div>
          
          {channels.map((channel) => (
            <div
              key={channel.id}
              className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer ${
                currentChannel?.id === channel.id
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              onClick={() => handleSelectChannel(channel)}
            >
              <span className="flex items-center">
                <span className="text-gray-400 mr-1">#</span>
                {channel.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteChannel(channel.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        
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
        {currentChannel ? (
          <>
            {/* Channel Header */}
            <div className="h-12 px-4 flex items-center border-b border-gray-700 bg-gray-800">
              <span className="text-gray-400 mr-1">#</span>
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
                <p>Select a channel to start chatting</p>
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
