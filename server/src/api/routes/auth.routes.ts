import { Router, RequestHandler } from 'express';
import { AuthController } from '../controllers/auth.controller';

export function createAuthRoutes(
  authController: AuthController,
  authenticate: RequestHandler
): Router {
  const router = Router();

  router.get('/setup', authController.checkSetup);
  router.post('/setup', authController.setup);
  router.post('/login', authController.login);
  router.get('/me', authenticate, authController.getMe);
  router.post('/logout', authenticate, authController.logout);

  return router;
}
