import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../api/middleware/error.middleware';
import { AppError } from '../../utils/errors';
import { AuthError } from '../../services/auth.service';
import { ChannelError } from '../../services/channel.service';
import { MessageError } from '../../services/message.service';

function createMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

const mockReq = {} as Request;
const mockNext = vi.fn() as NextFunction;

describe('errorHandler middleware', () => {
  it('should handle AppError with correct status code and body', () => {
    const err = new AppError('Not found', 404, 'NOT_FOUND');
    const res = createMockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Not found' },
    });
  });

  it('should handle AppError with default 500 status code', () => {
    const err = new AppError('Server error');
    const res = createMockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Server error' },
    });
  });

  it('should handle AuthError with INVALID_PASSWORD as 401', () => {
    const err = new AuthError('Invalid password', 'INVALID_PASSWORD');
    const res = createMockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'INVALID_PASSWORD', message: 'Invalid password' },
    });
  });

  it('should handle AuthError with non-password code as 400', () => {
    const err = new AuthError('Already setup', 'ALREADY_SETUP');
    const res = createMockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'ALREADY_SETUP', message: 'Already setup' },
    });
  });

  it('should handle ChannelError with NOT_FOUND as 404', () => {
    const err = new ChannelError('Channel not found', 'NOT_FOUND');
    const res = createMockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Channel not found' },
    });
  });

  it('should handle ChannelError with other code as 400', () => {
    const err = new ChannelError('Name exists', 'NAME_EXISTS');
    const res = createMockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'NAME_EXISTS', message: 'Name exists' },
    });
  });

  it('should handle MessageError as 400', () => {
    const err = new MessageError('Channel not found', 'CHANNEL_NOT_FOUND');
    const res = createMockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'CHANNEL_NOT_FOUND', message: 'Channel not found' },
    });
  });

  it('should handle unknown errors as 500', () => {
    const err = new Error('Something went wrong');
    const res = createMockRes();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
    expect(consoleSpy).toHaveBeenCalledWith('Unhandled error:', err);

    consoleSpy.mockRestore();
  });
});
