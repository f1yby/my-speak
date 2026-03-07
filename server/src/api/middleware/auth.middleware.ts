import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../../utils/jwt';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
        email: string;
      };
    }
  }
}

/**
 * JWT 认证中间件
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未提供认证Token',
        },
      });
      return;
    }
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token格式错误',
        },
      });
      return;
    }
    
    const token = parts[1];
    const payload = verifyToken(token);
    
    // 验证Token类型
    if (payload.type !== 'access') {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '无效的Token类型',
        },
      });
      return;
    }
    
    // 将用户信息附加到请求对象
    req.user = {
      userId: payload.userId,
      username: payload.username,
      email: payload.email,
    };
    
    next();
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token已过期',
        },
      });
      return;
    }
    
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '无效的Token',
      },
    });
  }
}
