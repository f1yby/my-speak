import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { AuthService } from '../../services/auth.service';
import { ChannelService } from '../../services/channel.service';
import { MessageService, MessageError } from '../../services/message.service';

function createMockServices() {
  const authService = {
    isServerSetup: vi.fn(),
    setupServer: vi.fn(),
    login: vi.fn(),
    validateSession: vi.fn().mockResolvedValue({ username: 'testuser' }),
    logout: vi.fn(),
    cleanupExpiredSessions: vi.fn(),
  } as unknown as AuthService;

  const channelService = {} as ChannelService;

  const messageService = {
    getMessages: vi.fn(),
    createMessage: vi.fn(),
    deleteOldMessages: vi.fn(),
  } as unknown as MessageService;

  return { authService, channelService, messageService };
}

describe('Message Routes', () => {
  let services: ReturnType<typeof createMockServices>;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockServices();
  });

  describe('GET /api/channels/:channelId/messages', () => {
    it('should return messages for a channel', async () => {
      const mockMessages = [
        { id: '1', content: 'Hello', authorName: 'user1' },
        { id: '2', content: 'World', authorName: 'user2' },
      ];
      (services.messageService.getMessages as any).mockResolvedValue(mockMessages);
      const app = createApp(services);

      const res = await request(app)
        .get('/api/channels/ch1/messages')
        .set('Authorization', 'Bearer valid-token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return 401 when not authenticated', async () => {
      const app = createApp(services);

      const res = await request(app).get('/api/channels/ch1/messages');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/channels/:channelId/messages', () => {
    it('should create a message', async () => {
      const newMessage = { id: 'm1', content: 'Hello', authorName: 'testuser', channelId: 'ch1' };
      (services.messageService.createMessage as any).mockResolvedValue(newMessage);
      const app = createApp(services);

      const res = await request(app)
        .post('/api/channels/ch1/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({ content: 'Hello' });
      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(newMessage);
    });

    it('should return 400 when content is empty', async () => {
      const app = createApp(services);

      const res = await request(app)
        .post('/api/channels/ch1/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({ content: '' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CONTENT');
    });

    it('should return 400 when content is too long', async () => {
      const app = createApp(services);

      const res = await request(app)
        .post('/api/channels/ch1/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({ content: 'a'.repeat(2001) });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CONTENT_TOO_LONG');
    });

    it('should return 400 when channel not found', async () => {
      (services.messageService.createMessage as any).mockRejectedValue(
        new MessageError('Channel not found', 'CHANNEL_NOT_FOUND')
      );
      const app = createApp(services);

      const res = await request(app)
        .post('/api/channels/nonexistent/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({ content: 'Hello' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CHANNEL_NOT_FOUND');
    });
  });
});
