import prisma from '../db/prisma-client';
import { hashPassword, comparePassword } from '../utils/password';
import { generateTokens, Tokens } from '../utils/jwt';

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: {
    id: string;
    username: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    createdAt: Date;
  };
  tokens: Tokens;
}

export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * 用户注册
 */
export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const { username, email, password, displayName } = input;

  // 检查用户名是否已存在
  const existingUsername = await prisma.user.findUnique({
    where: { username },
  });
  if (existingUsername) {
    throw new AuthError('用户名已被使用', 'USERNAME_EXISTS');
  }

  // 检查邮箱是否已存在
  const existingEmail = await prisma.user.findUnique({
    where: { email },
  });
  if (existingEmail) {
    throw new AuthError('邮箱已被注册', 'EMAIL_EXISTS');
  }

  // 加密密码
  const passwordHash = await hashPassword(password);

  // 创建用户
  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      displayName: displayName || username,
    },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  // 生成Token
  const tokens = generateTokens({
    userId: user.id,
    username: user.username,
    email: user.email,
  });

  return {
    user,
    tokens,
  };
}

/**
 * 用户登录
 */
export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const { email, password } = input;

  // 查找用户
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AuthError('邮箱或密码错误', 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AuthError('账号已被禁用', 'ACCOUNT_DISABLED');
  }

  // 验证密码
  const isPasswordValid = await comparePassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AuthError('邮箱或密码错误', 'INVALID_CREDENTIALS');
  }

  // 更新最后登录时间
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // 生成Token
  const tokens = generateTokens({
    userId: user.id,
    username: user.username,
    email: user.email,
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    },
    tokens,
  };
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AuthError('用户不存在', 'USER_NOT_FOUND');
  }

  return user;
}

/**
 * 用户登出（可选：将Token加入黑名单）
 */
export async function logoutUser(userId: string): Promise<void> {
  // 这里可以实现Token黑名单逻辑
  // 暂时直接返回
  console.log(`User ${userId} logged out`);
}
