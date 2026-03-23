import { Request, Response } from 'express';
import { MessageService, MessageError } from '../../services/message.service';
import { AuthenticatedRequest } from '../../types/express';

export class MessageController {
  constructor(private messageService: MessageService) {}

  getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const before = req.query.before as string | undefined;

      const messages = await this.messageService.getMessages(channelId, limit, before);

      res.json({
        success: true,
        data: messages.reverse(),
      });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  };

  createMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId } = req.params;
      const { content } = req.body;
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;

      if (!content || content.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_CONTENT', message: 'Message content cannot be empty' },
        });
        return;
      }

      if (content.length > 2000) {
        res.status(400).json({
          success: false,
          error: { code: 'CONTENT_TOO_LONG', message: 'Message must be 2000 characters or less' },
        });
        return;
      }

      const message = await this.messageService.createMessage({
        channelId,
        authorName: user.username,
        content: content.trim(),
      });

      res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error) {
      if (error instanceof MessageError) {
        res.status(400).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }

      console.error('Create message error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  };
}
