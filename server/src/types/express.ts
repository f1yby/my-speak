import { Request } from 'express';
import { Socket } from 'socket.io';

/**
 * Extended Express Request interface with authenticated user info.
 */
export interface AuthenticatedRequest extends Request {
  user: {
    username: string;
  };
  token: string;
}

/**
 * Extended Socket interface with authenticated user info.
 */
export interface AuthenticatedSocket extends Socket {
  username: string;
}
