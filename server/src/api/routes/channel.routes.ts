import { Router } from 'express';
import * as channelController from '../controllers/channel.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, channelController.getChannels);
router.get('/:channelId', authenticate, channelController.getChannel);
router.post('/', authenticate, channelController.createChannel);
router.delete('/:channelId', authenticate, channelController.deleteChannel);

export default router;
