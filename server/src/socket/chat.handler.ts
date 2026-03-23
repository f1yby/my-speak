import { Socket, Server as SocketIOServer } from 'socket.io';
import { MessageService } from '../services/message.service';

export interface ChatHandlerDeps {
  messageService: MessageService;
  io: SocketIOServer;
}

export function registerChatHandlers(
  socket: Socket,
  username: string,
  deps: ChatHandlerDeps
): { getCurrentChannelId: () => string | null } {
  const { messageService, io } = deps;
  let currentChannelId: string | null = null;

  socket.on('channel:join', async (channelId: string) => {
    if (currentChannelId) {
      socket.leave(`channel:${currentChannelId}`);
    }

    currentChannelId = channelId;
    socket.join(`channel:${channelId}`);

    const messages = await messageService.getMessages(channelId, 50);
    socket.emit('channel:messages', messages.reverse());
  });

  socket.on('channel:leave', () => {
    if (currentChannelId) {
      socket.leave(`channel:${currentChannelId}`);
      currentChannelId = null;
    }
  });

  socket.on('message:send', async (data: { channelId: string; content: string }) => {
    if (!data.content || data.content.trim().length === 0) return;

    const message = await messageService.createMessage({
      channelId: data.channelId,
      authorName: username,
      content: data.content.trim(),
    });

    io.to(`channel:${data.channelId}`).emit('message:new', message);
  });

  return {
    getCurrentChannelId: () => currentChannelId,
  };
}
