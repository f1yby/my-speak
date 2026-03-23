import { Request, Response } from 'express';
import { ChannelService, ChannelError } from '../../services/channel.service';

export class ChannelController {
  constructor(private channelService: ChannelService) {}

  getChannels = async (req: Request, res: Response): Promise<void> => {
    try {
      const channels = await this.channelService.getChannels();
      res.json({
        success: true,
        data: channels,
      });
    } catch (error) {
      console.error('Get channels error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  };

  getChannel = async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId } = req.params;
      const channel = await this.channelService.getChannelById(channelId);

      if (!channel) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Channel not found' },
        });
        return;
      }

      res.json({
        success: true,
        data: channel,
      });
    } catch (error) {
      console.error('Get channel error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  };

  createChannel = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, type } = req.body;

      if (!name || name.trim().length < 1 || name.length > 100) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_NAME', message: 'Channel name must be 1-100 characters' },
        });
        return;
      }

      if (type && !['TEXT', 'VOICE'].includes(type)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_TYPE', message: 'Channel type must be TEXT or VOICE' },
        });
        return;
      }

      const channel = await this.channelService.createChannel({
        name: name.trim(),
        type: type || 'TEXT',
      });

      res.status(201).json({
        success: true,
        data: channel,
      });
    } catch (error) {
      if (error instanceof ChannelError) {
        res.status(400).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }

      console.error('Create channel error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  };

  deleteChannel = async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId } = req.params;
      await this.channelService.deleteChannel(channelId);

      res.json({
        success: true,
        message: 'Channel deleted successfully',
      });
    } catch (error) {
      if (error instanceof ChannelError) {
        res.status(error.code === 'NOT_FOUND' ? 404 : 400).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }

      console.error('Delete channel error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  };
}
