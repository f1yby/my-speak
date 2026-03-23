import { Router, RequestHandler } from 'express';
import { MessageController } from '../controllers/message.controller';

export function createMessageRoutes(
  messageController: MessageController,
  authenticate: RequestHandler
): Router {
  const router = Router({ mergeParams: true });

  router.get('/', authenticate, messageController.getMessages);
  router.post('/', authenticate, messageController.createMessage);

  return router;
}
