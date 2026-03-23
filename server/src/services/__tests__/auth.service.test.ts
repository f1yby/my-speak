import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService, AuthError } from '../auth.service';
import { createMockPrismaClient, MockPrismaClient } from '../../__mocks__/prisma-client';

// Mock password utilities
vi.mock('../../utils/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
  comparePassword: vi.fn(),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('mock-uuid-token'),
}));

import { comparePassword } from '../../utils/password';

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: MockPrismaClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrismaClient();
    authService = new AuthService(mockPrisma as any);
  });

  describe('isServerSetup', () => {
    it('should return true when server config exists', async () => {
      (mockPrisma as any).serverConfig = { findUnique: vi.fn().mockResolvedValue({ id: 'default', passwordHash: 'hash' }) };
      const result = await authService.isServerSetup();
      expect(result).toBe(true);
    });

    it('should return false when server config does not exist', async () => {
      (mockPrisma as any).serverConfig = { findUnique: vi.fn().mockResolvedValue(null) };
      const result = await authService.isServerSetup();
      expect(result).toBe(false);
    });
  });

  describe('setupServer', () => {
    it('should create server config with hashed password', async () => {
      (mockPrisma as any).serverConfig = {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'default', passwordHash: 'hashed-password' }),
      };

      await authService.setupServer('mypassword');

      expect((mockPrisma as any).serverConfig.create).toHaveBeenCalledWith({
        data: { id: 'default', passwordHash: 'hashed-password' },
      });
    });

    it('should throw ALREADY_SETUP when server is already configured', async () => {
      (mockPrisma as any).serverConfig = {
        findUnique: vi.fn().mockResolvedValue({ id: 'default', passwordHash: 'hash' }),
      };

      await expect(authService.setupServer('password')).rejects.toThrow(AuthError);
      await expect(authService.setupServer('password')).rejects.toMatchObject({ code: 'ALREADY_SETUP' });
    });
  });

  describe('login', () => {
    it('should return token and username on valid credentials', async () => {
      (mockPrisma as any).serverConfig = {
        findUnique: vi.fn().mockResolvedValue({ id: 'default', passwordHash: 'hashed-password' }),
      };
      vi.mocked(comparePassword).mockResolvedValue(true);
      mockPrisma.session.create.mockResolvedValue({} as any);

      const result = await authService.login('password', 'testuser');

      expect(result).toEqual(expect.objectContaining({
        token: 'mock-uuid-token',
        username: 'testuser',
      }));
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw NOT_SETUP when server is not configured', async () => {
      (mockPrisma as any).serverConfig = { findUnique: vi.fn().mockResolvedValue(null) };

      await expect(authService.login('password', 'user')).rejects.toThrow(AuthError);
      await expect(authService.login('password', 'user')).rejects.toMatchObject({ code: 'NOT_SETUP' });
    });

    it('should throw INVALID_PASSWORD on wrong password', async () => {
      (mockPrisma as any).serverConfig = {
        findUnique: vi.fn().mockResolvedValue({ id: 'default', passwordHash: 'hashed-password' }),
      };
      vi.mocked(comparePassword).mockResolvedValue(false);

      await expect(authService.login('wrong', 'user')).rejects.toThrow(AuthError);
      await expect(authService.login('wrong', 'user')).rejects.toMatchObject({ code: 'INVALID_PASSWORD' });
    });
  });

  describe('validateSession', () => {
    it('should return username for valid non-expired session', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      mockPrisma.session.findUnique.mockResolvedValue({
        token: 'tok',
        username: 'testuser',
        expiresAt: futureDate,
      } as any);

      const result = await authService.validateSession('tok');
      expect(result).toEqual({ username: 'testuser' });
    });

    it('should return null when session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      const result = await authService.validateSession('nonexistent');
      expect(result).toBeNull();
    });

    it('should return null and delete expired session', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      mockPrisma.session.findUnique.mockResolvedValue({
        token: 'tok',
        username: 'testuser',
        expiresAt: pastDate,
      } as any);
      mockPrisma.session.delete.mockResolvedValue({} as any);

      const result = await authService.validateSession('tok');
      expect(result).toBeNull();
      expect(mockPrisma.session.delete).toHaveBeenCalledWith({ where: { token: 'tok' } });
    });
  });

  describe('logout', () => {
    it('should delete session by token', async () => {
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 } as any);

      await authService.logout('tok');
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { token: 'tok' } });
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete all expired sessions', async () => {
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 5 } as any);

      await authService.cleanupExpiredSessions();
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });
  });
});
