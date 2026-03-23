import { useState, useEffect, useCallback } from 'react';
import { messageApi, type Message } from '../services/message-api';

export function useMessages(channelId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMessages = useCallback(async (chId: string) => {
    setIsLoading(true);
    try {
      const data = await messageApi.getMessages(chId, { limit: 50 });
      setMessages(data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (channelId) {
      fetchMessages(channelId);
    } else {
      setMessages([]);
    }
  }, [channelId, fetchMessages]);

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    addMessage,
    clearMessages,
    refetch: fetchMessages,
  };
}
