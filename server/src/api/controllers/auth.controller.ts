import { Request, Response } from 'express';
import * as authService from '../../services/auth.service';
import { AuthError } from '../../services/auth.service';

export async function checkSetup(req: Request, res: Response): Promise<void> {
  try {
    const isSetup = await authService.isServerSetup();
    res.json({
      success: true,
      data: { isSetup },
    });
  } catch (error) {
    console.error('Check setup error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
}

export async function setup(req: Request, res: Response): Promise<void> {
  try {
    const { password } = req.body;
    
    if (!password || password.length < 6) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Password must be at least 6 characters' },
      });
      return;
    }
    
    await authService.setupServer(password);
    
    res.status(201).json({
      success: true,
      message: 'Server setup complete',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(400).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
    
    console.error('Setup error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { password, username } = req.body;
    
    if (!password || !username) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Password and username are required' },
      });
      return;
    }
    
    if (username.length < 2 || username.length > 32) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_USERNAME', message: 'Username must be 2-32 characters' },
      });
      return;
    }
    
    const result = await authService.login(password, username);
    
    res.json({
      success: true,
      data: {
        token: result.token,
        username: result.username,
        expiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const statusCode = error.code === 'INVALID_PASSWORD' ? 401 : 400;
      res.status(statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
    
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const token = (req as any).token;
    
    if (token) {
      await authService.logout(token);
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
      return;
    }
    
    res.json({
      success: true,
      data: { username: user.username },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
}
