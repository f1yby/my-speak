import prisma from '../db/prisma-client';
import { hashPassword, comparePassword } from '../utils/password';
import { v4 as uuidv4 } from 'uuid';

const SESSION_DURATION_HOURS = 24;

export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function isServerSetup(): Promise<boolean> {
  const config = await prisma.serverConfig.findUnique({
    where: { id: 'default' },
  });
  return !config;
}

export async function setupServer(password: string): Promise<void> {
  const existing = await prisma.serverConfig.findUnique({
    where: { id: 'default' },
  });
  
  if (existing) {
    throw new AuthError('Server already set up', 'ALREADY_SETUP');
  }
  
  const passwordHash = await hashPassword(password);
  
  await prisma.serverConfig.create({
    data: {
      id: 'default',
      passwordHash,
    },
  });
}

export async function login(password: string, username: string): Promise<{ token: string; username: string; expiresAt: Date }> {
  const config = await prisma.serverConfig.findUnique({
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
  
  await prisma.session.create({
    data: {
      token,
      username,
      expiresAt,
    },
  });
  
  return { token, username, expiresAt };
}

export async function validateSession(token: string): Promise<{ username: string } | null> {
  const session = await prisma.session.findUnique({
    where: { token },
  });
  
  if (!session) {
    return null;
  }
  
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token } });
    return null;
  }
  
  return { username: session.username };
}

export async function logout(token: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { token },
  });
}

export async function cleanupExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
}
