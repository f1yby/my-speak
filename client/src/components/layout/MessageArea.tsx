import React from 'react';
import { Hash, Volume2 } from 'lucide-react';
import type { Channel } from '../../services/channel-api';
import type { Message } from '../../services/message-api';

interface MessageAreaProps {
  currentChannel: Channel | null;
  messages: Message[];
  newMessage: string;
  onNewMessageChange: (value: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  channelCount: number;
  onCreateChannel: () => void;
}

export const MessageArea: React.FC<MessageAreaProps> = ({
  currentChannel,
  messages,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  channelCount,
  onCreateChannel,
}) => {
  if (currentChannel && currentChannel.type === 'TEXT') {
    return (
      <div className="flex-1 flex flex-col">
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
          <form onSubmit={onSendMessage} className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => onNewMessageChange(e.target.value)}
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
      </div>
    );
  }

  if (currentChannel && currentChannel.type === 'VOICE') {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-700">
        <div className="text-center">
          <Volume2 className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Voice Channel: {currentChannel.name}</p>
          <p className="text-gray-500 text-sm mt-2">Click &quot;Join Voice&quot; in the sidebar to connect</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center text-gray-400">
        {channelCount === 0 ? (
          <div>
            <p className="text-lg mb-2">No channels yet</p>
            <button
              onClick={onCreateChannel}
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
  );
};
