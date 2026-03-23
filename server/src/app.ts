import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { AuthService } from './services/auth.service';
import { ChannelService } from './services/channel.service';
import { MessageService } from './services/message.service';

import { AuthController } from './api/controllers/auth.controller';
import { ChannelController } from './api/controllers/channel.controller';
import { MessageController } from './api/controllers/message.controller';

import { createAuthMiddleware } from './api/middleware/auth.middleware';
import { createAuthRoutes } from './api/routes/auth.routes';
import { createChannelRoutes } from './api/routes/channel.routes';
import { createMessageRoutes } from './api/routes/message.routes';
import { errorHandler } from './api/middleware/error.middleware';

export interface AppDeps {
  authService: AuthService;
  channelService: ChannelService;
  messageService: MessageService;
}

export function createApp(deps: AppDeps): Express {
  const { authService, channelService, messageService } = deps;

  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(morgan('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api', (req, res) => {
    res.json({ message: 'My-Speak API Server', version: '2.0.0' });
  });

  // Create controllers
  const authController = new AuthController(authService);
  const channelController = new ChannelController(channelService);
  const messageController = new MessageController(messageService);

  // Create middleware
  const authenticate = createAuthMiddleware(authService);

  // Register routes
  app.use('/api/auth', createAuthRoutes(authController, authenticate));
  app.use('/api/channels', createChannelRoutes(channelController, authenticate));
  app.use('/api/channels/:channelId/messages', createMessageRoutes(messageController, authenticate));

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
