import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Message } from '../services/message-api';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectCallbackRef = useRef<(() => void) | null>(null);

  const setReconnectCallback = useCallback((cb: () => void) => {
    reconnectCallbackRef.current = cb;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const newSocket = io(socketUrl, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      setIsReconnecting(false);
      reconnectCallbackRef.current?.();
    });

    newSocket.on('disconnect', () => {
      setIsReconnecting(true);
    });

    newSocket.on('reconnect', () => {
      setIsReconnecting(false);
      reconnectCallbackRef.current?.();
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const onNewMessage = useCallback(
    (handler: (message: Message) => void) => {
      if (!socket) return () => {};
      socket.on('message:new', handler);
      return () => {
        socket.off('message:new', handler);
      };
    },
    [socket]
  );

  const joinChannel = useCallback(
    (channelId: string) => {
      socket?.emit('channel:join', channelId);
    },
    [socket]
  );

  const leaveChannel = useCallback(() => {
    socket?.emit('channel:leave');
  }, [socket]);

  const sendMessage = useCallback(
    (channelId: string, content: string) => {
      socket?.emit('message:send', { channelId, content });
    },
    [socket]
  );

  return {
    socket,
    isReconnecting,
    onNewMessage,
    joinChannel,
    leaveChannel,
    sendMessage,
    setReconnectCallback,
  };
}
