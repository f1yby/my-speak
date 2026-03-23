import { describe, it, expect } from 'vitest';
import { AppError } from '../errors';

describe('AppError', () => {
  it('should create an error with default values', () => {
    const error = new AppError('Something went wrong');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe('Something went wrong');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.name).toBe('AppError');
  });

  it('should create an error with custom status code and code', () => {
    const error = new AppError('Not found', 404, 'NOT_FOUND');

    expect(error.message).toBe('Not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.name).toBe('AppError');
  });

  it('should create an error with custom status code and default code', () => {
    const error = new AppError('Bad request', 400);

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('INTERNAL_ERROR');
  });

  it('should be catchable as a standard Error', () => {
    try {
      throw new AppError('Test error', 422, 'UNPROCESSABLE');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as AppError).statusCode).toBe(422);
      expect((err as AppError).code).toBe('UNPROCESSABLE');
    }
  });
});
