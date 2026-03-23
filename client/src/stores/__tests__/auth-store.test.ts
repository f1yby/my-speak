import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../auth-store';
import { authApi } from '../../services/auth-api';

vi.mock('../../services/auth-api', () => ({
  authApi: {
    checkSetup: vi.fn(),
    setup: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    getMe: vi.fn(),
  },
}));

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isSetup: null,
      isLoading: false,
      _hydrated: true,
      error: null,
    });
    localStorage.clear();
  });

  describe('checkSetup', () => {
    it('should set isSetup to true when server is configured', async () => {
      vi.mocked(authApi.checkSetup).mockResolvedValue({ isSetup: true });

      await useAuthStore.getState().checkSetup();

      expect(useAuthStore.getState().isSetup).toBe(true);
    });

    it('should set isSetup to false when server is not configured', async () => {
      vi.mocked(authApi.checkSetup).mockResolvedValue({ isSetup: false });

      await useAuthStore.getState().checkSetup();

      expect(useAuthStore.getState().isSetup).toBe(false);
    });

    it('should set isSetup to false on error', async () => {
      vi.mocked(authApi.checkSetup).mockRejectedValue(new Error('Network error'));

      await useAuthStore.getState().checkSetup();

      expect(useAuthStore.getState().isSetup).toBe(false);
    });
  });

  describe('setup', () => {
    it('should set isSetup to true on success', async () => {
      vi.mocked(authApi.setup).mockResolvedValue(undefined);

      await useAuthStore.getState().setup({ password: 'validpassword' });

      expect(useAuthStore.getState().isSetup).toBe(true);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should set error on failure', async () => {
      const error = { response: { data: { error: { message: 'Setup failed' } } } };
      vi.mocked(authApi.setup).mockRejectedValue(error);

      await expect(useAuthStore.getState().setup({ password: 'short' })).rejects.toBeDefined();

      expect(useAuthStore.getState().error).toBe('Setup failed');
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('login', () => {
    it('should set user and token on success', async () => {
      vi.mocked(authApi.login).mockResolvedValue({
        token: 'test-token',
        username: 'testuser',
        expiresAt: '2024-12-31',
      });

      await useAuthStore.getState().login({ password: 'password', username: 'testuser' });

      expect(useAuthStore.getState().user).toEqual({ username: 'testuser' });
      expect(useAuthStore.getState().token).toBe('test-token');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(localStorage.getItem('token')).toBe('test-token');
    });

    it('should set error on failure', async () => {
      const error = { response: { data: { error: { message: 'Invalid password' } } } };
      vi.mocked(authApi.login).mockRejectedValue(error);

      await expect(
        useAuthStore.getState().login({ password: 'wrong', username: 'user' })
      ).rejects.toBeDefined();

      expect(useAuthStore.getState().error).toBe('Invalid password');
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear user state and localStorage', async () => {
      useAuthStore.setState({
        user: { username: 'testuser' },
        token: 'test-token',
        isAuthenticated: true,
      });
      localStorage.setItem('token', 'test-token');
      vi.mocked(authApi.logout).mockResolvedValue(undefined);

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().token).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should clear state even if API call fails', async () => {
      useAuthStore.setState({ user: { username: 'testuser' }, token: 'tok', isAuthenticated: true });
      vi.mocked(authApi.logout).mockRejectedValue(new Error('Network error'));

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useAuthStore.setState({ error: 'Some error' });

      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
