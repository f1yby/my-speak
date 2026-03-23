import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError, Result } from 'express-validator';
import { validate } from '../../api/middleware/validate.middleware';

// Mock express-validator
vi.mock('express-validator', () => ({
  validationResult: vi.fn(),
}));

function createMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('validate middleware', () => {
  it('should call next() when there are no validation errors', () => {
    const mockResult = {
      isEmpty: () => true,
      array: () => [],
    };
    (validationResult as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockResult);

    const req = {} as Request;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 400 with validation error message when there are errors', () => {
    const mockResult = {
      isEmpty: () => false,
      array: () => [{ msg: 'Field is required' }],
    };
    (validationResult as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockResult);

    const req = {} as Request;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Field is required' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return the first error message when multiple validation errors exist', () => {
    const mockResult = {
      isEmpty: () => false,
      array: () => [
        { msg: 'First error' },
        { msg: 'Second error' },
      ],
    };
    (validationResult as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockResult);

    const req = {} as Request;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'First error' },
    });
  });
});
