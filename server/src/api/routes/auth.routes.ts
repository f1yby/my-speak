import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { registerValidator, loginValidator, handleValidationErrors } from '../validators/auth.validator';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// 注册
router.post(
  '/register',
  registerValidator,
  handleValidationErrors,
  authController.register
);

// 登录
router.post(
  '/login',
  loginValidator,
  handleValidationErrors,
  authController.login
);

// 获取当前用户信息（需要认证）
router.get('/me', authenticate, authController.getMe);

// 登出（需要认证）
router.post('/logout', authenticate, authController.logout);

export default router;
