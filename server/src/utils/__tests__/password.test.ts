import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../password';

describe('password utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password and return a string', async () => {
      const hash = await hashPassword('mypassword');

      expect(typeof hash).toBe('string');
      expect(hash).not.toBe('mypassword');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for the same password', async () => {
      const hash1 = await hashPassword('mypassword');
      const hash2 = await hashPassword('mypassword');

      // bcrypt uses random salt, so hashes should differ
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const hash = await hashPassword('correctpassword');
      const result = await comparePassword('correctpassword', hash);

      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const hash = await hashPassword('correctpassword');
      const result = await comparePassword('wrongpassword', hash);

      expect(result).toBe(false);
    });
  });
});
