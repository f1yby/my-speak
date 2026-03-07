import { Request, Response } from 'express';
import * as authService from '../../services/auth.service';
import { AuthError } from '../../services/auth.service';

/**
 * 用户注册
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.registerUser(req.body);
    
    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        tokens: result.tokens,
      },
      message: '注册成功',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const statusCode = 
        error.code === 'USERNAME_EXISTS' || error.code === 'EMAIL_EXISTS'
          ? 409
          : 400;
      res.status(statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }
    
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
      },
    });
  }
}

/**
 * 用户登录
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.loginUser(req.body);
    
    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        tokens: result.tokens,
      },
      message: '登录成功',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(401).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }
    
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
      },
    });
  }
}

/**
 * 获取当前用户信息
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未认证',
        },
      });
      return;
    }
    
    const user = await authService.getCurrentUser(userId);
    
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(404).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }
    
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
      },
    });
  }
}

/**
 * 用户登出
 */
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    
    if (userId) {
      await authService.logoutUser(userId);
    }
    
    res.status(200).json({
      success: true,
      message: '登出成功',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
      },
    });
  }
}
