import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/password';
import { v4 as uuidv4 } from 'uuid';

const SESSION_DURATION_HOURS = 24;

export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async isServerSetup(): Promise<boolean> {
    const config = await this.prisma.serverConfig.findUnique({
      where: { id: 'default' },
    });
    return !!config;
  }

  async setupServer(password: string): Promise<void> {
    const existing = await this.prisma.serverConfig.findUnique({
      where: { id: 'default' },
    });

    if (existing) {
      throw new AuthError('Server already set up', 'ALREADY_SETUP');
    }

    const passwordHash = await hashPassword(password);

    await this.prisma.serverConfig.create({
      data: {
        id: 'default',
        passwordHash,
      },
    });
  }

  async login(password: string, username: string): Promise<{ token: string; username: string; expiresAt: Date }> {
    const config = await this.prisma.serverConfig.findUnique({
      where: { id: 'default' },
    });

    if (!config) {
      throw new AuthError('Server not set up', 'NOT_SETUP');
    }

    const isValid = await comparePassword(password, config.passwordHash);
    if (!isValid) {
      throw new AuthError('Invalid password', 'INVALID_PASSWORD');
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: {
        token,
        username,
        expiresAt,
      },
    });

    return { token, username, expiresAt };
  }

  async validateSession(token: string): Promise<{ username: string } | null> {
    const session = await this.prisma.session.findUnique({
      where: { token },
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { token } });
      return null;
    }

    return { username: session.username };
  }

  async logout(token: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { token },
    });
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
}
