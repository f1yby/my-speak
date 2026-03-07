import crypto from 'crypto';

export function generateInviteCode(): string {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

export function hashInviteCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}
