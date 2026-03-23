import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createAuthMiddleware } from '../middleware/auth.middleware';
import { AuthService } from '../../services/auth.service';

describe('Auth Middleware', () => {
  let app: express.Express;
  let mockAuthService: { validateSession: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockAuthService = {
      validateSession: vi.fn(),
    };

    app = express();
    app.use(express.json());

    const authenticate = createAuthMiddleware(mockAuthService as unknown as AuthService);

    app.get('/protected', authenticate, (req, res) => {
      res.json({ success: true, data: { username: req.user?.username } });
    });
  });

  it('should return 401 when no authorization header', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('No token provided');
  });

  it('should return 401 when token format is invalid', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'InvalidFormat');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid token format');
  });

  it('should return 401 when token is invalid or expired', async () => {
    mockAuthService.validateSession.mockResolvedValue(null);

    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid or expired token');
  });

  it('should call next with user data when token is valid', async () => {
    mockAuthService.validateSession.mockResolvedValue({ username: 'testuser' });

    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('testuser');
  });

  it('should return 500 when auth service throws', async () => {
    mockAuthService.validateSession.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer some-token');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
