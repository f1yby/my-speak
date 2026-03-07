import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
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

interface VoiceParticipant {
  socketId: string;
  username: string;
  isMuted: boolean;
  isDeafened: boolean;
}

const voiceChannels = new Map<string, Map<string, VoiceParticipant>>();

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
  
  let currentChannelId: string | null = null;
  let currentVoiceChannelId: string | null = null;

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

  // Voice channel events
  socket.on('voice:join', (channelId: string) => {
    if (currentVoiceChannelId) {
      leaveVoiceChannel(socket, currentVoiceChannelId);
    }
    
    currentVoiceChannelId = channelId;
    socket.join(`voice:${channelId}`);
    
    if (!voiceChannels.has(channelId)) {
      voiceChannels.set(channelId, new Map());
    }
    
    const participants = voiceChannels.get(channelId)!;
    participants.set(socket.id, {
      socketId: socket.id,
      username,
      isMuted: false,
      isDeafened: false,
    });
    
    const existingParticipants = Array.from(participants.values()).filter(
      (p) => p.socketId !== socket.id
    );
    
    socket.emit('voice:participants', existingParticipants);
    
    socket.to(`voice:${channelId}`).emit('voice:user-joined', {
      socketId: socket.id,
      username,
      isMuted: false,
      isDeafened: false,
    });
    
    console.log(`User ${username} joined voice channel ${channelId}`);
  });

  socket.on('voice:leave', () => {
    if (currentVoiceChannelId) {
      leaveVoiceChannel(socket, currentVoiceChannelId);
      currentVoiceChannelId = null;
    }
  });

  socket.on('voice:signal', (data: { to: string; signal: any }) => {
    io.to(data.to).emit('voice:signal', {
      from: socket.id,
      signal: data.signal,
    });
  });

  socket.on('voice:mute', (isMuted: boolean) => {
    if (currentVoiceChannelId) {
      const participants = voiceChannels.get(currentVoiceChannelId);
      if (participants) {
        const participant = participants.get(socket.id);
        if (participant) {
          participant.isMuted = isMuted;
          socket.to(`voice:${currentVoiceChannelId}`).emit('voice:user-muted', {
            socketId: socket.id,
            isMuted,
          });
        }
      }
    }
  });

  socket.on('voice:deafen', (isDeafened: boolean) => {
    if (currentVoiceChannelId) {
      const participants = voiceChannels.get(currentVoiceChannelId);
      if (participants) {
        const participant = participants.get(socket.id);
        if (participant) {
          participant.isDeafened = isDeafened;
          socket.to(`voice:${currentVoiceChannelId}`).emit('voice:user-deafened', {
            socketId: socket.id,
            isDeafened,
          });
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${username} (${socket.id})`);
    
    if (currentVoiceChannelId) {
      leaveVoiceChannel(socket, currentVoiceChannelId);
    }
  });

  function leaveVoiceChannel(sock: Socket, channelId: string) {
    sock.leave(`voice:${channelId}`);
    
    const participants = voiceChannels.get(channelId);
    if (participants) {
      participants.delete(sock.id);
      if (participants.size === 0) {
        voiceChannels.delete(channelId);
      }
    }
    
    sock.to(`voice:${channelId}`).emit('voice:user-left', { socketId: sock.id });
    console.log(`User ${username} left voice channel ${channelId}`);
  }
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
