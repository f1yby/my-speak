import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { AuthService, AuthError } from '../../services/auth.service';
import { ChannelService } from '../../services/channel.service';
import { MessageService } from '../../services/message.service';

function createMockServices() {
  const authService = {
    isServerSetup: vi.fn(),
    setupServer: vi.fn(),
    login: vi.fn(),
    validateSession: vi.fn(),
    logout: vi.fn(),
    cleanupExpiredSessions: vi.fn(),
  } as unknown as AuthService;

  const channelService = {} as ChannelService;
  const messageService = {} as MessageService;

  return { authService, channelService, messageService };
}

describe('Auth Routes', () => {
  let services: ReturnType<typeof createMockServices>;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockServices();
  });

  describe('GET /api/auth/setup', () => {
    it('should return isSetup status', async () => {
      (services.authService.isServerSetup as any).mockResolvedValue(true);
      const app = createApp(services);

      const res = await request(app).get('/api/auth/setup');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: { isSetup: true } });
    });
  });

  describe('POST /api/auth/setup', () => {
    it('should setup server with valid password', async () => {
      (services.authService.setupServer as any).mockResolvedValue(undefined);
      (services.authService.isServerSetup as any).mockResolvedValue(false);
      const app = createApp(services);

      const res = await request(app)
        .post('/api/auth/setup')
        .send({ password: 'validpassword' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 when password is too short', async () => {
      const app = createApp(services);

      const res = await request(app)
        .post('/api/auth/setup')
        .send({ password: '123' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PASSWORD');
    });

    it('should return 400 when server is already setup', async () => {
      (services.authService.setupServer as any).mockRejectedValue(
        new AuthError('Server already set up', 'ALREADY_SETUP')
      );
      const app = createApp(services);

      const res = await request(app)
        .post('/api/auth/setup')
        .send({ password: 'validpassword' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ALREADY_SETUP');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return token on successful login', async () => {
      const loginResult = {
        token: 'test-token',
        username: 'testuser',
        expiresAt: new Date('2024-12-31'),
      };
      (services.authService.login as any).mockResolvedValue(loginResult);
      const app = createApp(services);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password', username: 'testuser' });
      expect(res.status).toBe(200);
      expect(res.body.data.token).toBe('test-token');
      expect(res.body.data.username).toBe('testuser');
    });

    it('should return 400 when fields are missing', async () => {
      const app = createApp(services);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_FIELDS');
    });

    it('should return 401 on invalid password', async () => {
      (services.authService.login as any).mockRejectedValue(
        new AuthError('Invalid password', 'INVALID_PASSWORD')
      );
      const app = createApp(services);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'wrong', username: 'testuser' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_PASSWORD');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user when authenticated', async () => {
      (services.authService.validateSession as any).mockResolvedValue({ username: 'testuser' });
      const app = createApp(services);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token');
      expect(res.status).toBe(200);
      expect(res.body.data.username).toBe('testuser');
    });

    it('should return 401 when not authenticated', async () => {
      const app = createApp(services);

      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      (services.authService.validateSession as any).mockResolvedValue({ username: 'testuser' });
      (services.authService.logout as any).mockResolvedValue(undefined);
      const app = createApp(services);

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
