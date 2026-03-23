import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerChatHandlers, ChatHandlerDeps } from '../chat.handler';
import { Socket, Server as SocketIOServer } from 'socket.io';
import { MessageService } from '../../services/message.service';

function createMockSocket() {
  const handlers: Record<string, Function> = {};
  return {
    on: vi.fn((event: string, handler: Function) => {
      handlers[event] = handler;
    }),
    emit: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    _handlers: handlers,
  } as unknown as Socket & { _handlers: Record<string, Function> };
}

function createMockDeps() {
  const messageService = {
    getMessages: vi.fn().mockResolvedValue([
      { id: '1', content: 'Hello', authorName: 'user1', createdAt: new Date() },
    ]),
    createMessage: vi.fn().mockResolvedValue({
      id: '2',
      content: 'New message',
      authorName: 'testuser',
      channelId: 'ch1',
      createdAt: new Date(),
    }),
  } as unknown as MessageService;

  const io = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  } as unknown as SocketIOServer;

  return { messageService, io };
}

describe('registerChatHandlers', () => {
  let socket: Socket & { _handlers: Record<string, Function> };
  let deps: ChatHandlerDeps;
  let result: ReturnType<typeof registerChatHandlers>;

  beforeEach(() => {
    vi.clearAllMocks();
    socket = createMockSocket();
    deps = createMockDeps();
    result = registerChatHandlers(socket as unknown as Socket, 'testuser', deps);
  });

  it('should register channel:join, channel:leave, and message:send handlers', () => {
    expect(socket.on).toHaveBeenCalledWith('channel:join', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('channel:leave', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('message:send', expect.any(Function));
  });

  it('should return getCurrentChannelId that starts as null', () => {
    expect(result.getCurrentChannelId()).toBeNull();
  });

  describe('channel:join', () => {
    it('should join a channel room and emit messages', async () => {
      await socket._handlers['channel:join']('ch1');

      expect(socket.join).toHaveBeenCalledWith('channel:ch1');
      expect(deps.messageService.getMessages).toHaveBeenCalledWith('ch1', 50);
      expect(socket.emit).toHaveBeenCalledWith('channel:messages', expect.any(Array));
    });

    it('should leave previous channel when joining a new one', async () => {
      await socket._handlers['channel:join']('ch1');
      await socket._handlers['channel:join']('ch2');

      expect(socket.leave).toHaveBeenCalledWith('channel:ch1');
      expect(socket.join).toHaveBeenCalledWith('channel:ch2');
    });
  });

  describe('channel:leave', () => {
    it('should leave the current channel', async () => {
      await socket._handlers['channel:join']('ch1');
      socket._handlers['channel:leave']();

      expect(socket.leave).toHaveBeenCalledWith('channel:ch1');
    });

    it('should do nothing if not in a channel', () => {
      socket._handlers['channel:leave']();

      expect(socket.leave).not.toHaveBeenCalled();
    });
  });

  describe('message:send', () => {
    it('should create and broadcast a message', async () => {
      await socket._handlers['message:send']({ channelId: 'ch1', content: 'Hello world' });

      expect(deps.messageService.createMessage).toHaveBeenCalledWith({
        channelId: 'ch1',
        authorName: 'testuser',
        content: 'Hello world',
      });
      expect(deps.io.to).toHaveBeenCalledWith('channel:ch1');
    });

    it('should not send empty messages', async () => {
      await socket._handlers['message:send']({ channelId: 'ch1', content: '' });

      expect(deps.messageService.createMessage).not.toHaveBeenCalled();
    });

    it('should not send whitespace-only messages', async () => {
      await socket._handlers['message:send']({ channelId: 'ch1', content: '   ' });

      expect(deps.messageService.createMessage).not.toHaveBeenCalled();
    });

    it('should trim message content', async () => {
      await socket._handlers['message:send']({ channelId: 'ch1', content: '  Hello  ' });

      expect(deps.messageService.createMessage).toHaveBeenCalledWith({
        channelId: 'ch1',
        authorName: 'testuser',
        content: 'Hello',
      });
    });
  });
});
