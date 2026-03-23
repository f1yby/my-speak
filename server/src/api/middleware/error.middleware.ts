import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/errors';
import { AuthError } from '../../services/auth.service';
import { ChannelError } from '../../services/channel.service';
import { MessageError } from '../../services/message.service';

/**
 * Global error handling middleware.
 * Must be registered after all routes.
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // Handle AppError (known operational errors)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // Handle service-level errors
  if (err instanceof AuthError) {
    const statusCode = err.code === 'INVALID_PASSWORD' ? 401 : 400;
    res.status(statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err instanceof ChannelError) {
    const statusCode = err.code === 'NOT_FOUND' ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err instanceof MessageError) {
    res.status(400).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // Unknown error - log and return 500
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
}
