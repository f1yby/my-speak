import { Router, RequestHandler } from 'express';
import { ChannelController } from '../controllers/channel.controller';

export function createChannelRoutes(
  channelController: ChannelController,
  authenticate: RequestHandler
): Router {
  const router = Router();

  router.get('/', authenticate, channelController.getChannels);
  router.get('/:channelId', authenticate, channelController.getChannel);
  router.post('/', authenticate, channelController.createChannel);
  router.delete('/:channelId', authenticate, channelController.deleteChannel);

  return router;
}
