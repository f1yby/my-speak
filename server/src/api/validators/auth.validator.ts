import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

/**
 * 注册验证规则
 */
export const registerValidator = [
  body('username')
    .isLength({ min: 3, max: 32 })
    .withMessage('用户名长度必须在3-32字符之间')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名只能包含字母、数字和下划线'),
  body('email')
    .isEmail()
    .withMessage('请输入有效的邮箱地址')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('密码长度必须在8-128字符之间')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('密码必须包含至少一个大写字母、一个小写字母和一个数字'),
  body('displayName')
    .optional()
    .isLength({ min: 1, max: 64 })
    .withMessage('显示名称长度必须在1-64字符之间'),
];

/**
 * 登录验证规则
 */
export const loginValidator = [
  body('email')
    .isEmail()
    .withMessage('请输入有效的邮箱地址')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('请输入密码'),
];

/**
 * 处理验证错误
 */
export function handleValidationErrors(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '输入数据验证失败',
        details: errors.array(),
      },
    });
    return;
  }
  next();
}
