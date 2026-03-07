import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const JWT_ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || '15m';
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  type: 'access' | 'refresh';
  jti: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * 生成 JWT Token
 */
export function generateTokens(payload: Omit<TokenPayload, 'type' | 'jti'>): Tokens {
  const jti = uuidv4();

  const accessToken = jwt.sign(
    {
      ...payload,
      type: 'access',
      jti,
    },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRATION }
  );

  const refreshToken = jwt.sign(
    {
      ...payload,
      type: 'refresh',
      jti: `${jti}-refresh`,
    },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRATION }
  );

  // 计算过期时间（秒）
  const expiresIn = parseExpiration(JWT_ACCESS_EXPIRATION);

  return {
    accessToken,
    refreshToken,
    expiresIn,
  };
}

/**
 * 验证 JWT Token
 */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

/**
 * 解析过期时间字符串为秒
 */
function parseExpiration(expiration: string): number {
  const match = expiration.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // 默认15分钟

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: { [key: string]: number } = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return value * (multipliers[unit] || 1);
}
