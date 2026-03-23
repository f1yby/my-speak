import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authApi } from '../auth-api';
import { apiClient } from '../api-client';

vi.mock('../api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkSetup', () => {
    it('should call GET /auth/setup and return data', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { isSetup: true } } });

      const result = await authApi.checkSetup();
      expect(result).toEqual({ isSetup: true });
      expect(apiClient.get).toHaveBeenCalledWith('/auth/setup');
    });
  });

  describe('setup', () => {
    it('should call POST /auth/setup', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });

      await authApi.setup({ password: 'testpassword' });
      expect(apiClient.post).toHaveBeenCalledWith('/auth/setup', { password: 'testpassword' });
    });
  });

  describe('login', () => {
    it('should call POST /auth/login and return session', async () => {
      const session = { token: 'tok', username: 'user', expiresAt: '2024-12-31' };
      vi.mocked(apiClient.post).mockResolvedValue({ data: { data: session } });

      const result = await authApi.login({ password: 'pass', username: 'user' });
      expect(result).toEqual(session);
      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', { password: 'pass', username: 'user' });
    });
  });

  describe('logout', () => {
    it('should call POST /auth/logout', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });

      await authApi.logout();
      expect(apiClient.post).toHaveBeenCalledWith('/auth/logout');
    });
  });

  describe('getMe', () => {
    it('should call GET /auth/me and return user', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { username: 'testuser' } } });

      const result = await authApi.getMe();
      expect(result).toEqual({ username: 'testuser' });
      expect(apiClient.get).toHaveBeenCalledWith('/auth/me');
    });
  });
});
