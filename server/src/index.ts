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
import * as mediasoupService from './services/mediasoup.service';
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

interface VoiceUser {
  socketId: string;
  username: string;
  sendTransportId?: string;
  recvTransportId?: string;
  producerId?: string;
}

const voiceChannels = new Map<string, Map<string, VoiceUser>>();

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

  socket.on('voice:join', async (channelId: string) => {
    if (currentVoiceChannelId) {
      await leaveVoiceChannel(socket, currentVoiceChannelId);
    }
    
    currentVoiceChannelId = channelId;
    socket.join(`voice:${channelId}`);
    
    if (!voiceChannels.has(channelId)) {
      voiceChannels.set(channelId, new Map());
    }
    
    const users = voiceChannels.get(channelId)!;
    users.set(socket.id, {
      socketId: socket.id,
      username,
    });

    const router = await mediasoupService.getOrCreateRouter(channelId);
    const rtpCapabilities = router.rtpCapabilities;
    
    const existingUsers = Array.from(users.values())
      .filter(u => u.socketId !== socket.id && u.producerId)
      .map(u => ({
        socketId: u.socketId,
        username: u.username,
        producerId: u.producerId!,
      }));
    
    socket.emit('voice:joined', { rtpCapabilities, users: existingUsers });
    
    socket.to(`voice:${channelId}`).emit('voice:user-joined', {
      socketId: socket.id,
      username,
    });
    
    console.log(`User ${username} joined voice channel ${channelId}`);
  });

  socket.on('voice:leave', async () => {
    if (currentVoiceChannelId) {
      await leaveVoiceChannel(socket, currentVoiceChannelId);
      currentVoiceChannelId = null;
    }
  });

  socket.on('voice:create-transport', async (callback: Function) => {
    try {
      const params = await mediasoupService.createWebRtcTransport(currentVoiceChannelId!);
      callback(params);
    } catch (error) {
      console.error('Failed to create transport:', error);
      callback({ error: 'Failed to create transport' });
    }
  });

  socket.on('voice:connect-transport', async (data: { transportId: string; dtlsParameters: any }, callback: Function) => {
    try {
      await mediasoupService.connectTransport(data.transportId, data.dtlsParameters);
      callback({ success: true });
    } catch (error) {
      console.error('Failed to connect transport:', error);
      callback({ error: 'Failed to connect transport' });
    }
  });

  socket.on('voice:set-transport', (data: { sendTransportId?: string; recvTransportId?: string }) => {
    if (currentVoiceChannelId) {
      const users = voiceChannels.get(currentVoiceChannelId);
      if (users) {
        const user = users.get(socket.id);
        if (user) {
          if (data.sendTransportId) user.sendTransportId = data.sendTransportId;
          if (data.recvTransportId) user.recvTransportId = data.recvTransportId;
        }
      }
    }
  });

  socket.on('voice:produce', async (data: { transportId: string; kind: 'audio' | 'video'; rtpParameters: any }, callback: Function) => {
    try {
      const result = await mediasoupService.produce(
        currentVoiceChannelId!,
        data.transportId,
        data.kind,
        data.rtpParameters
      );

      if (currentVoiceChannelId) {
        const users = voiceChannels.get(currentVoiceChannelId);
        if (users) {
          const user = users.get(socket.id);
          if (user) {
            user.producerId = result.producerId;
          }
        }
      }

      socket.to(`voice:${currentVoiceChannelId}`).emit('voice:new-producer', {
        producerId: result.producerId,
        socketId: socket.id,
        username,
      });

      callback(result);
    } catch (error) {
      console.error('Failed to produce:', error);
      callback({ error: 'Failed to produce' });
    }
  });

  socket.on('voice:consume', async (data: { producerId: string; transportId: string; rtpCapabilities: any }, callback: Function) => {
    try {
      const result = await mediasoupService.consume(
        currentVoiceChannelId!,
        data.producerId,
        data.transportId,
        data.rtpCapabilities
      );
      callback(result);
    } catch (error) {
      console.error('Failed to consume:', error);
      callback({ error: 'Failed to consume' });
    }
  });

  socket.on('voice:mute', (isMuted: boolean) => {
    if (currentVoiceChannelId) {
      socket.to(`voice:${currentVoiceChannelId}`).emit('voice:user-muted', {
        socketId: socket.id,
        isMuted,
      });
    }
  });

  socket.on('voice:deafen', (isDeafened: boolean) => {
    if (currentVoiceChannelId) {
      socket.to(`voice:${currentVoiceChannelId}`).emit('voice:user-deafened', {
        socketId: socket.id,
        isDeafened,
      });
    }
  });

  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${username} (${socket.id})`);
    
    if (currentVoiceChannelId) {
      await leaveVoiceChannel(socket, currentVoiceChannelId);
    }
  });

  async function leaveVoiceChannel(sock: Socket, channelId: string) {
    sock.leave(`voice:${channelId}`);
    
    const users = voiceChannels.get(channelId);
    if (users) {
      const user = users.get(sock.id);
      if (user) {
        if (user.sendTransportId) {
          mediasoupService.closeTransport(user.sendTransportId);
        }
        if (user.recvTransportId) {
          mediasoupService.closeTransport(user.recvTransportId);
        }
        if (user.producerId) {
          mediasoupService.closeProducer(channelId, user.producerId);
        }
      }
      users.delete(sock.id);
      if (users.size === 0) {
        voiceChannels.delete(channelId);
        mediasoupService.closeRouter(channelId);
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
    
    await mediasoupService.initWorker();
    console.log('🎬 Mediasoup worker initialized');
    
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
