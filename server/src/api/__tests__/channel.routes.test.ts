import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { AuthService } from '../../services/auth.service';
import { ChannelService, ChannelError } from '../../services/channel.service';
import { MessageService } from '../../services/message.service';

function createMockServices() {
  const authService = {
    isServerSetup: vi.fn(),
    setupServer: vi.fn(),
    login: vi.fn(),
    validateSession: vi.fn().mockResolvedValue({ username: 'testuser' }),
    logout: vi.fn(),
    cleanupExpiredSessions: vi.fn(),
  } as unknown as AuthService;

  const channelService = {
    getChannels: vi.fn(),
    getChannelById: vi.fn(),
    createChannel: vi.fn(),
    deleteChannel: vi.fn(),
  } as unknown as ChannelService;

  const messageService = {} as MessageService;

  return { authService, channelService, messageService };
}

describe('Channel Routes', () => {
  let services: ReturnType<typeof createMockServices>;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockServices();
  });

  describe('GET /api/channels', () => {
    it('should return all channels', async () => {
      const mockChannels = [{ id: '1', name: 'general', type: 'TEXT' }];
      (services.channelService.getChannels as any).mockResolvedValue(mockChannels);
      const app = createApp(services);

      const res = await request(app)
        .get('/api/channels')
        .set('Authorization', 'Bearer valid-token');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockChannels);
    });

    it('should return 401 when not authenticated', async () => {
      const app = createApp(services);

      const res = await request(app).get('/api/channels');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/channels/:channelId', () => {
    it('should return channel by id', async () => {
      const mockChannel = { id: '1', name: 'general', type: 'TEXT' };
      (services.channelService.getChannelById as any).mockResolvedValue(mockChannel);
      const app = createApp(services);

      const res = await request(app)
        .get('/api/channels/1')
        .set('Authorization', 'Bearer valid-token');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockChannel);
    });

    it('should return 404 when channel not found', async () => {
      (services.channelService.getChannelById as any).mockResolvedValue(null);
      const app = createApp(services);

      const res = await request(app)
        .get('/api/channels/nonexistent')
        .set('Authorization', 'Bearer valid-token');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/channels', () => {
    it('should create a channel', async () => {
      const newChannel = { id: '1', name: 'new-channel', type: 'TEXT' };
      (services.channelService.createChannel as any).mockResolvedValue(newChannel);
      const app = createApp(services);

      const res = await request(app)
        .post('/api/channels')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'new-channel' });
      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(newChannel);
    });

    it('should return 400 when name is invalid', async () => {
      const app = createApp(services);

      const res = await request(app)
        .post('/api/channels')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('should return 400 when channel name exists', async () => {
      (services.channelService.createChannel as any).mockRejectedValue(
        new ChannelError('Channel name already exists', 'NAME_EXISTS')
      );
      const app = createApp(services);

      const res = await request(app)
        .post('/api/channels')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'existing' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NAME_EXISTS');
    });
  });

  describe('DELETE /api/channels/:channelId', () => {
    it('should delete a channel', async () => {
      (services.channelService.deleteChannel as any).mockResolvedValue({ success: true });
      const app = createApp(services);

      const res = await request(app)
        .delete('/api/channels/1')
        .set('Authorization', 'Bearer valid-token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 when channel not found', async () => {
      (services.channelService.deleteChannel as any).mockRejectedValue(
        new ChannelError('Channel not found', 'NOT_FOUND')
      );
      const app = createApp(services);

      const res = await request(app)
        .delete('/api/channels/nonexistent')
        .set('Authorization', 'Bearer valid-token');
      expect(res.status).toBe(404);
    });
  });
});
