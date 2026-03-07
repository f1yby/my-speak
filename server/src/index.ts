import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import authRoutes from './api/routes/auth.routes';
import channelRoutes from './api/routes/channel.routes';
import messageRoutes from './api/routes/message.routes';
import * as authService from './services/auth.service';
import * as messageService from './services/message.service';
import prisma from './db/prisma-client';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
});

const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api', (req, res) => {
  res.json({ message: 'My-Speak API Server', version: '2.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/channels/:channelId/messages', messageRoutes);

const userSockets = new Map<string, Set<string>>();

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

io.on('connection', async (socket) => {
  const username = (socket as any).username;
  console.log(`User connected: ${username} (${socket.id})`);
  
  if (!userSockets.has(username)) {
    userSockets.set(username, new Set());
  }
  userSockets.get(username)!.add(socket.id);
  
  let currentChannelId: string | null = null;

  socket.on('channel:join', async (channelId: string) => {
    if (currentChannelId) {
      socket.leave(`channel:${currentChannelId}`);
    }
    
    currentChannelId = channelId;
    socket.join(`channel:${channelId}`);
    
    const messages = await messageService.getMessages(channelId, 50);
    socket.emit('channel:messages', messages.reverse());
  });

  socket.on('channel:leave', () => {
    if (currentChannelId) {
      socket.leave(`channel:${currentChannelId}`);
      currentChannelId = null;
    }
  });

  socket.on('message:send', async (data: { channelId: string; content: string }) => {
    if (!data.content || data.content.trim().length === 0) return;
    
    const message = await messageService.createMessage({
      channelId: data.channelId,
      authorName: username,
      content: data.content.trim(),
    });
    
    io.to(`channel:${data.channelId}`).emit('message:new', message);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${username} (${socket.id})`);
    
    const sockets = userSockets.get(username);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userSockets.delete(username);
      }
    }
  });
});

setInterval(async () => {
  await authService.cleanupExpiredSessions();
}, 60 * 60 * 1000);

async function startServer() {
  try {
    await prisma.$connect();
    console.log('📦 Database connected');
    
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Socket.io ready for connections`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, io };
