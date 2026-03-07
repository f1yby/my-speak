import { Router } from 'express';
import * as messageController from '../controllers/message.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.get('/', authenticate, messageController.getMessages);
router.post('/', authenticate, messageController.createMessage);

export default router;
