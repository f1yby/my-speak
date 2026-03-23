import { Socket } from 'socket.io';
import { MediasoupService } from '../services/mediasoup.service';
import { VoiceChannelManager } from '../services/voice-channel-manager';

export interface VoiceHandlerDeps {
  mediasoupService: MediasoupService;
  voiceChannelManager: VoiceChannelManager;
}

export function registerVoiceHandlers(
  socket: Socket,
  username: string,
  deps: VoiceHandlerDeps
): { cleanup: () => Promise<void> } {
  const { mediasoupService, voiceChannelManager } = deps;
  let currentVoiceChannelId: string | null = null;

  async function leaveVoiceChannel(channelId: string) {
    socket.leave(`voice:${channelId}`);

    const user = voiceChannelManager.removeUser(channelId, socket.id);
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

    if (voiceChannelManager.isChannelEmpty(channelId)) {
      mediasoupService.closeRouter(channelId);
    }

    socket.to(`voice:${channelId}`).emit('voice:user-left', { socketId: socket.id });
    console.log(`User ${username} left voice channel ${channelId}`);
  }

  socket.on('voice:join', async (channelId: string) => {
    if (currentVoiceChannelId) {
      await leaveVoiceChannel(currentVoiceChannelId);
    }

    currentVoiceChannelId = channelId;
    socket.join(`voice:${channelId}`);

    voiceChannelManager.addUser(channelId, socket.id, username);

    const router = await mediasoupService.getOrCreateRouter(channelId);
    const rtpCapabilities = router.rtpCapabilities;

    const existingUsers = voiceChannelManager.getExistingProducers(channelId, socket.id);

    socket.emit('voice:joined', { rtpCapabilities, users: existingUsers });

    socket.to(`voice:${channelId}`).emit('voice:user-joined', {
      socketId: socket.id,
      username,
    });

    console.log(`User ${username} joined voice channel ${channelId}`);
  });

  socket.on('voice:leave', async () => {
    if (currentVoiceChannelId) {
      await leaveVoiceChannel(currentVoiceChannelId);
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

  socket.on('voice:connect-transport', async (data: { transportId: string; dtlsParameters: unknown }, callback: Function) => {
    try {
      await mediasoupService.connectTransport(data.transportId, data.dtlsParameters as any);
      callback({ success: true });
    } catch (error) {
      console.error('Failed to connect transport:', error);
      callback({ error: 'Failed to connect transport' });
    }
  });

  socket.on('voice:set-transport', (data: { sendTransportId?: string; recvTransportId?: string }) => {
    if (currentVoiceChannelId) {
      if (data.sendTransportId) {
        voiceChannelManager.updateUser(currentVoiceChannelId, socket.id, { sendTransportId: data.sendTransportId });
      }
      if (data.recvTransportId) {
        voiceChannelManager.updateUser(currentVoiceChannelId, socket.id, { recvTransportId: data.recvTransportId });
      }
    }
  });

  socket.on('voice:produce', async (data: { transportId: string; kind: 'audio' | 'video'; rtpParameters: unknown }, callback: Function) => {
    try {
      const result = await mediasoupService.produce(
        currentVoiceChannelId!,
        data.transportId,
        data.kind,
        data.rtpParameters as any
      );

      if (currentVoiceChannelId) {
        voiceChannelManager.updateUser(currentVoiceChannelId, socket.id, { producerId: result.producerId });
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

  socket.on('voice:consume', async (data: { producerId: string; transportId: string; rtpCapabilities: unknown }, callback: Function) => {
    try {
      const result = await mediasoupService.consume(
        currentVoiceChannelId!,
        data.producerId,
        data.transportId,
        data.rtpCapabilities as any
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

  socket.on('voice:speaking', (isSpeaking: boolean) => {
    if (currentVoiceChannelId) {
      socket.to(`voice:${currentVoiceChannelId}`).emit('voice:user-speaking', {
        socketId: socket.id,
        isSpeaking,
      });
    }
  });

  return {
    cleanup: async () => {
      if (currentVoiceChannelId) {
        await leaveVoiceChannel(currentVoiceChannelId);
      }
    },
  };
}
