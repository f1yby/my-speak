import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import mediasoup = require('mediasoup');

import { createApp } from './app';
import { AuthService } from './services/auth.service';
import { ChannelService } from './services/channel.service';
import { MessageService } from './services/message.service';
import { MediasoupService } from './services/mediasoup.service';
import { VoiceChannelManager } from './services/voice-channel-manager';
import { registerChatHandlers } from './socket/chat.handler';
import { registerVoiceHandlers } from './socket/voice.handler';

dotenv.config();

const PORT = process.env.PORT || 3001;

// Create dependencies
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

const authService = new AuthService(prisma as any);
const channelService = new ChannelService(prisma as any);
const messageService = new MessageService(prisma as any);
const mediasoupService = new MediasoupService(async () => {
  return mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });
});
const voiceChannelManager = new VoiceChannelManager();

// Create Express app
const app = createApp({ authService, channelService, messageService });
const httpServer = createServer(app);

// Create Socket.io server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
});

// Socket.io authentication middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  const session = await authService.validateSession(token);

  if (!session) {
    return next(new Error('Invalid or expired token'));
  }

  (socket as any).username = session.username;
  next();
});

// Socket.io connection handler
io.on('connection', async (socket) => {
  const username = (socket as any).username as string;
  console.log(`User connected: ${username} (${socket.id})`);

  // Register chat handlers
  registerChatHandlers(socket, username, { messageService, io });

  // Register voice handlers
  const voiceHandler = registerVoiceHandlers(socket, username, {
    mediasoupService,
    voiceChannelManager,
  });

  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${username} (${socket.id})`);
    await voiceHandler.cleanup();
  });
});

// Periodic cleanup
setInterval(async () => {
  await authService.cleanupExpiredSessions();
}, 60 * 60 * 1000);

// Start server
async function startServer() {
  try {
    await prisma.$connect();
    console.log('📦 Database connected');

    await mediasoupService.initWorker();
    console.log('🎬 Mediasoup worker initialized');

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Socket.io ready for connections`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Mediasoup announced address: ${process.env.MEDIASOUP_ANNOUNCED_ADDRESS || '(NOT SET - WebRTC may not work!)'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, io };
