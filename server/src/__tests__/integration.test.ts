import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createServer } from 'http';

import { createApp, AppDeps } from '../app';
import { AuthService, AuthError } from '../services/auth.service';
import { ChannelService, ChannelError } from '../services/channel.service';
import { MessageService } from '../services/message.service';
import { MediasoupService } from '../services/mediasoup.service';
import { VoiceChannelManager } from '../services/voice-channel-manager';
import { registerChatHandlers } from '../socket/chat.handler';
import { registerVoiceHandlers } from '../socket/voice.handler';

// ============================================================
// Shared Mock Factories
// ============================================================

let sessionStore: Map<string, { username: string; expiresAt: Date }>;
let serverSetupDone: boolean;
let passwordHash: string;
let channels: Array<{ id: string; name: string; type: string; createdAt: Date; updatedAt: Date }>;
let channelIdCounter: number;

function resetState() {
  sessionStore = new Map();
  serverSetupDone = false;
  passwordHash = '';
  channels = [];
  channelIdCounter = 0;
}

/**
 * Creates mock services that behave like real services with in-memory state.
 * This allows integration-style testing without a real database.
 */
function createStatefulMockServices() {
  const authService = {
    isServerSetup: vi.fn(async () => serverSetupDone),

    setupServer: vi.fn(async (password: string) => {
      if (serverSetupDone) {
        throw new AuthError('Server already set up', 'ALREADY_SETUP');
      }
      serverSetupDone = true;
      passwordHash = password;
    }),

    login: vi.fn(async (password: string, username: string) => {
      if (!serverSetupDone) {
        throw new AuthError('Server not set up', 'NOT_SETUP');
      }
      if (password !== passwordHash) {
        throw new AuthError('Invalid password', 'INVALID_PASSWORD');
      }
      const token = `token-${username}-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      sessionStore.set(token, { username, expiresAt });
      return { token, username, expiresAt };
    }),

    validateSession: vi.fn(async (token: string) => {
      const session = sessionStore.get(token);
      if (!session) return null;
      if (session.expiresAt < new Date()) {
        sessionStore.delete(token);
        return null;
      }
      return { username: session.username };
    }),

    logout: vi.fn(async (token: string) => {
      sessionStore.delete(token);
    }),

    cleanupExpiredSessions: vi.fn(),
  } as unknown as AuthService;

  const channelService = {
    getChannels: vi.fn(async () => channels),

    getChannelById: vi.fn(async (id: string) => {
      return channels.find(ch => ch.id === id) || null;
    }),

    createChannel: vi.fn(async (data: { name: string; type?: string }) => {
      const existing = channels.find(ch => ch.name === data.name);
      if (existing) {
        throw new ChannelError('Channel name already exists', 'NAME_EXISTS');
      }
      channelIdCounter++;
      const channel = {
        id: `channel-${channelIdCounter}`,
        name: data.name,
        type: data.type || 'TEXT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      channels.push(channel);
      return channel;
    }),

    deleteChannel: vi.fn(async (id: string) => {
      const idx = channels.findIndex(ch => ch.id === id);
      if (idx === -1) {
        throw new ChannelError('Channel not found', 'NOT_FOUND');
      }
      channels.splice(idx, 1);
      return { success: true };
    }),
  } as unknown as ChannelService;

  const messageService = {
    getMessages: vi.fn(async () => []),
    createMessage: vi.fn(async (data: { channelId: string; authorName: string; content: string }) => ({
      id: `msg-${Date.now()}`,
      channelId: data.channelId,
      authorName: data.authorName,
      content: data.content,
      createdAt: new Date(),
    })),
    deleteOldMessages: vi.fn(async () => 0),
  } as unknown as MessageService;

  return { authService, channelService, messageService };
}

/**
 * Creates a mock MediasoupService that tracks transports, producers, and consumers in memory.
 */
function createStatefulMockMediasoupService() {
  let transportCounter = 0;
  let producerCounter = 0;
  let consumerCounter = 0;
  const transports = new Map<string, { channelId: string; connected: boolean }>();
  const producers = new Map<string, { channelId: string; kind: string; transportId: string }>();
  const consumers = new Map<string, { producerId: string; transportId: string }>();

  return {
    initWorker: vi.fn(),

    getOrCreateRouter: vi.fn(async (channelId: string) => ({
      rtpCapabilities: {
        codecs: [
          {
            kind: 'audio',
            mimeType: 'audio/opus',
            preferredPayloadType: 100,
            clockRate: 48000,
            channels: 2,
          },
        ],
        headerExtensions: [],
      },
    })),

    createWebRtcTransport: vi.fn(async (channelId: string) => {
      transportCounter++;
      const id = `transport-${transportCounter}`;
      transports.set(id, { channelId: channelId!, connected: false });
      return {
        id,
        iceParameters: { usernameFragment: `user-${transportCounter}`, password: `pass-${transportCounter}` },
        iceCandidates: [{ foundation: 'candidate', priority: 1, ip: '127.0.0.1', port: 10000 + transportCounter, type: 'host', protocol: 'udp' }],
        dtlsParameters: { fingerprints: [{ algorithm: 'sha-256', value: 'AA:BB:CC' }], role: 'auto' },
      };
    }),

    connectTransport: vi.fn(async (transportId: string, _dtlsParameters: unknown) => {
      const transport = transports.get(transportId);
      if (!transport) throw new Error('Transport not found');
      transport.connected = true;
    }),

    produce: vi.fn(async (channelId: string, transportId: string, kind: string, _rtpParameters: unknown) => {
      producerCounter++;
      const producerId = `producer-${producerCounter}`;
      producers.set(producerId, { channelId, kind, transportId });
      return { producerId };
    }),

    consume: vi.fn(async (channelId: string, producerId: string, transportId: string, _rtpCapabilities: unknown) => {
      const producer = producers.get(producerId);
      if (!producer) return null;
      consumerCounter++;
      const consumerId = `consumer-${consumerCounter}`;
      consumers.set(consumerId, { producerId, transportId });
      return {
        id: consumerId,
        producerId,
        kind: producer.kind,
        rtpParameters: { codecs: [], headerExtensions: [], encodings: [], rtcp: {} },
      };
    }),

    closeTransport: vi.fn((transportId: string) => {
      transports.delete(transportId);
    }),

    closeProducer: vi.fn((_channelId: string, producerId: string) => {
      producers.delete(producerId);
    }),

    closeRouter: vi.fn(),

    // Expose internal state for assertions
    _state: { transports, producers, consumers },
  } as unknown as MediasoupService & { _state: typeof transports extends Map<string, infer V> ? { transports: Map<string, V>; producers: Map<string, any>; consumers: Map<string, any> } : never };
}

// ============================================================
// Integration Test Suite
// ============================================================

describe('Integration Tests: Full Voice Chat Workflow', () => {
  let services: ReturnType<typeof createStatefulMockServices>;
  let mediasoupService: ReturnType<typeof createStatefulMockMediasoupService>;
  let voiceChannelManager: VoiceChannelManager;
  let io: SocketIOServer;
  let httpServer: ReturnType<typeof createServer>;
  let serverPort: number;
  let clientSockets: ClientSocket[];

  beforeEach(async () => {
    resetState();
    services = createStatefulMockServices();
    mediasoupService = createStatefulMockMediasoupService();
    voiceChannelManager = new VoiceChannelManager(); // Use real instance

    const app = createApp(services);
    httpServer = createServer(app);

    io = new SocketIOServer(httpServer, {
      cors: { origin: '*' },
    });

    // Socket.io auth middleware - same logic as index.ts
    io.use(async (socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const session = await services.authService.validateSession(token);
      if (!session) return next(new Error('Invalid or expired token'));

      (socket as any).username = session.username;
      next();
    });

    // Socket.io connection handler - same logic as index.ts
    io.on('connection', (socket) => {
      const username = (socket as any).username as string;

      registerChatHandlers(socket, username, {
        messageService: services.messageService,
        io,
      });

      const voiceHandler = registerVoiceHandlers(socket, username, {
        mediasoupService: mediasoupService as unknown as MediasoupService,
        voiceChannelManager,
      });

      socket.on('disconnect', async () => {
        await voiceHandler.cleanup();
      });
    });

    // Start server on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        serverPort = typeof addr === 'object' ? addr!.port : 0;
        resolve();
      });
    });

    clientSockets = [];
  });

  afterEach(async () => {
    // Disconnect all clients
    for (const cs of clientSockets) {
      if (cs.connected) {
        cs.disconnect();
      }
    }
    clientSockets = [];

    // Close server
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  // Helper: create a connected socket client
  function connectClient(token: string): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
      });

      client.on('connect', () => {
        clientSockets.push(client);
        resolve(client);
      });

      client.on('connect_error', (err) => {
        reject(err);
      });

      // Timeout after 5 seconds
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }

  // Helper: emit socket event with callback
  function emitWithCallback<T>(client: ClientSocket, event: string, data?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const args = data !== undefined ? [data, (res: T) => resolve(res)] : [(res: T) => resolve(res)];
      client.emit(event, ...args);
      setTimeout(() => reject(new Error(`Timeout waiting for callback on ${event}`)), 5000);
    });
  }

  // Helper: wait for a specific event
  function waitForEvent<T>(client: ClientSocket, event: string): Promise<T> {
    return new Promise((resolve, reject) => {
      client.once(event, (data: T) => resolve(data));
      setTimeout(() => reject(new Error(`Timeout waiting for event ${event}`)), 5000);
    });
  }

  // ============================================================
  // Path 1: Deploy Init -> Create Channel
  // ============================================================
  describe('Path 1: Deploy initialization and channel creation', () => {
    it('should complete full setup flow: check setup -> setup server -> login -> create channels', async () => {
      const app = createApp(services);

      // Step 1: Check that server is not setup
      let res = await request(app).get('/api/auth/setup');
      expect(res.status).toBe(200);
      expect(res.body.data.isSetup).toBe(false);

      // Step 2: Setup server with password
      res = await request(app)
        .post('/api/auth/setup')
        .send({ password: 'mypassword123' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Step 3: Verify server is now setup
      res = await request(app).get('/api/auth/setup');
      expect(res.status).toBe(200);
      expect(res.body.data.isSetup).toBe(true);

      // Step 4: Cannot setup again
      res = await request(app)
        .post('/api/auth/setup')
        .send({ password: 'anotherpassword' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ALREADY_SETUP');

      // Step 5: Login
      res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'mypassword123', username: 'admin' });
      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeTruthy();
      expect(res.body.data.username).toBe('admin');
      const token = res.body.data.token;

      // Step 6: Verify authentication works
      res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.username).toBe('admin');

      // Step 7: Create TEXT channel
      res = await request(app)
        .post('/api/channels')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'general', type: 'TEXT' });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('general');
      expect(res.body.data.type).toBe('TEXT');

      // Step 8: Create VOICE channel
      res = await request(app)
        .post('/api/channels')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'voice-room', type: 'VOICE' });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('voice-room');
      expect(res.body.data.type).toBe('VOICE');

      // Step 9: Cannot create duplicate channel
      res = await request(app)
        .post('/api/channels')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'general', type: 'TEXT' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NAME_EXISTS');

      // Step 10: List channels
      res = await request(app)
        .get('/api/channels')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.map((ch: any) => ch.name)).toEqual(['general', 'voice-room']);
    });

    it('should reject login with wrong password', async () => {
      const app = createApp(services);

      // Setup server
      await request(app)
        .post('/api/auth/setup')
        .send({ password: 'correctpassword' });

      // Try login with wrong password
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'wrongpassword', username: 'admin' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_PASSWORD');
    });

    it('should reject unauthenticated channel creation', async () => {
      const app = createApp(services);

      const res = await request(app)
        .post('/api/channels')
        .send({ name: 'test', type: 'TEXT' });
      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // Path 2: 10 clients join voice channel
  // ============================================================
  describe('Path 2: 10 clients join voice channel after initialization', () => {
    let tokens: string[];
    const VOICE_CHANNEL_ID = 'channel-2';
    const CLIENT_COUNT = 10;

    beforeEach(async () => {
      // Setup server and create channels via HTTP API
      const app = createApp(services);

      await request(app)
        .post('/api/auth/setup')
        .send({ password: 'testpassword' });

      // Create voice channel
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ password: 'testpassword', username: 'admin' });
      const adminToken = loginRes.body.data.token;

      await request(app)
        .post('/api/channels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'general-text', type: 'TEXT' });

      await request(app)
        .post('/api/channels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'voice-room', type: 'VOICE' });

      // Login 10 users
      tokens = [];
      for (let i = 0; i < CLIENT_COUNT; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ password: 'testpassword', username: `user-${i}` });
        tokens.push(res.body.data.token);
      }
    });

    it('should allow 10 clients to connect via socket and join voice channel', async () => {
      // Connect all 10 clients
      const clients: ClientSocket[] = [];
      for (let i = 0; i < CLIENT_COUNT; i++) {
        const client = await connectClient(tokens[i]);
        clients.push(client);
      }
      expect(clients).toHaveLength(CLIENT_COUNT);

      // Each client joins the voice channel
      const joinResults: Array<{ rtpCapabilities: any; users: any[] }> = [];

      for (let i = 0; i < CLIENT_COUNT; i++) {
        const joinPromise = waitForEvent<{ rtpCapabilities: any; users: any[] }>(
          clients[i],
          'voice:joined'
        );
        clients[i].emit('voice:join', VOICE_CHANNEL_ID);
        const result = await joinPromise;
        joinResults.push(result);
      }

      // All clients should have received rtpCapabilities
      for (const result of joinResults) {
        expect(result.rtpCapabilities).toBeDefined();
        expect(result.rtpCapabilities.codecs).toBeDefined();
        expect(result.rtpCapabilities.codecs.length).toBeGreaterThan(0);
      }

      // The first client should see 0 existing producers
      expect(joinResults[0].users).toHaveLength(0);

      // Verify voice channel manager has all 10 users
      const voiceUsers = voiceChannelManager.getUsers(VOICE_CHANNEL_ID);
      expect(voiceUsers).toBeDefined();
      expect(voiceUsers!.size).toBe(CLIENT_COUNT);
    });

    it('should reject socket connection without token', async () => {
      const result = await new Promise<{ connected: boolean; error?: string }>((resolve) => {
        const client = ioClient(`http://localhost:${serverPort}`, {
          auth: {},
          transports: ['websocket'],
          forceNew: true,
          reconnection: false,
        });
        client.on('connect', () => {
          clientSockets.push(client);
          resolve({ connected: true });
        });
        client.on('connect_error', (err) => {
          client.disconnect();
          resolve({ connected: false, error: err.message });
        });
        setTimeout(() => {
          client.disconnect();
          resolve({ connected: false, error: 'Timeout - connection rejected' });
        }, 3000);
      });

      expect(result.connected).toBe(false);
      // Server should reject - either with auth error or timeout (both indicate rejection)
      expect(result.error).toBeDefined();
    });

    it('should reject socket connection with invalid token', async () => {
      await expect(
        connectClient('invalid-token-12345')
      ).rejects.toThrow('Invalid or expired token');
    });

    it('should notify other users when a new user joins voice', async () => {
      // Connect first 2 clients
      const client1 = await connectClient(tokens[0]);
      const client2 = await connectClient(tokens[1]);

      // Client 1 joins voice
      const join1Promise = waitForEvent(client1, 'voice:joined');
      client1.emit('voice:join', VOICE_CHANNEL_ID);
      await join1Promise;

      // Listen for user-joined on client1
      const userJoinedPromise = waitForEvent<{ socketId: string; username: string }>(
        client1,
        'voice:user-joined'
      );

      // Client 2 joins voice
      const join2Promise = waitForEvent(client2, 'voice:joined');
      client2.emit('voice:join', VOICE_CHANNEL_ID);
      await join2Promise;

      // Client 1 should receive notification that client 2 joined
      const joinEvent = await userJoinedPromise;
      expect(joinEvent.username).toBe('user-1');
      expect(joinEvent.socketId).toBeDefined();
    });
  });

  // ============================================================
  // Path 3: 10 clients voice call each other
  // ============================================================
  describe('Path 3: 10 clients voice call each other', () => {
    let tokens: string[];
    const VOICE_CHANNEL_ID = 'channel-2';
    const CLIENT_COUNT = 10;

    beforeEach(async () => {
      // Setup server and create voice channel
      const app = createApp(services);

      await request(app)
        .post('/api/auth/setup')
        .send({ password: 'testpassword' });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ password: 'testpassword', username: 'admin' });
      const adminToken = loginRes.body.data.token;

      await request(app)
        .post('/api/channels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'text-channel', type: 'TEXT' });

      await request(app)
        .post('/api/channels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'voice-room', type: 'VOICE' });

      // Login 10 users
      tokens = [];
      for (let i = 0; i < CLIENT_COUNT; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ password: 'testpassword', username: `user-${i}` });
        tokens.push(res.body.data.token);
      }
    });

    it('should support full voice workflow: 10 clients create transports, produce, and cross-consume', async () => {
      // Step 1: Connect all 10 clients
      const clients: ClientSocket[] = [];
      for (let i = 0; i < CLIENT_COUNT; i++) {
        const client = await connectClient(tokens[i]);
        clients.push(client);
      }

      // Step 2: All clients join voice channel
      for (let i = 0; i < CLIENT_COUNT; i++) {
        const joinPromise = waitForEvent(clients[i], 'voice:joined');
        clients[i].emit('voice:join', VOICE_CHANNEL_ID);
        await joinPromise;
      }

      // Step 3: Each client creates send and recv transports
      const clientTransports: Array<{
        sendTransport: { id: string };
        recvTransport: { id: string };
      }> = [];

      for (let i = 0; i < CLIENT_COUNT; i++) {
        // Create send transport
        const sendTransport = await emitWithCallback<{
          id: string;
          iceParameters: any;
          iceCandidates: any[];
          dtlsParameters: any;
        }>(clients[i], 'voice:create-transport');
        expect(sendTransport.id).toBeTruthy();

        // Create recv transport
        const recvTransport = await emitWithCallback<{
          id: string;
          iceParameters: any;
          iceCandidates: any[];
          dtlsParameters: any;
        }>(clients[i], 'voice:create-transport');
        expect(recvTransport.id).toBeTruthy();
        expect(recvTransport.id).not.toBe(sendTransport.id);

        // Set transport IDs on voice channel manager
        clients[i].emit('voice:set-transport', {
          sendTransportId: sendTransport.id,
          recvTransportId: recvTransport.id,
        });

        clientTransports.push({ sendTransport, recvTransport });
      }

      // Verify all transports were created (2 per client = 20 total)
      expect(mediasoupService.createWebRtcTransport).toHaveBeenCalledTimes(CLIENT_COUNT * 2);

      // Step 4: Each client connects their transports
      for (let i = 0; i < CLIENT_COUNT; i++) {
        // Connect send transport
        const sendConnectResult = await emitWithCallback<{ success: boolean }>(
          clients[i],
          'voice:connect-transport',
          {
            transportId: clientTransports[i].sendTransport.id,
            dtlsParameters: { fingerprints: [], role: 'client' },
          }
        );
        expect(sendConnectResult.success).toBe(true);

        // Connect recv transport
        const recvConnectResult = await emitWithCallback<{ success: boolean }>(
          clients[i],
          'voice:connect-transport',
          {
            transportId: clientTransports[i].recvTransport.id,
            dtlsParameters: { fingerprints: [], role: 'client' },
          }
        );
        expect(recvConnectResult.success).toBe(true);
      }

      expect(mediasoupService.connectTransport).toHaveBeenCalledTimes(CLIENT_COUNT * 2);

      // Step 5: Each client produces audio
      const producerIds: string[] = [];

      for (let i = 0; i < CLIENT_COUNT; i++) {
        const produceResult = await emitWithCallback<{ producerId: string }>(
          clients[i],
          'voice:produce',
          {
            transportId: clientTransports[i].sendTransport.id,
            kind: 'audio',
            rtpParameters: {
              codecs: [{ mimeType: 'audio/opus', payloadType: 100, clockRate: 48000, channels: 2 }],
              encodings: [{ ssrc: 1000 + i }],
            },
          }
        );
        expect(produceResult.producerId).toBeTruthy();
        producerIds.push(produceResult.producerId);
      }

      expect(mediasoupService.produce).toHaveBeenCalledTimes(CLIENT_COUNT);
      expect(producerIds).toHaveLength(CLIENT_COUNT);
      // All producer IDs should be unique
      expect(new Set(producerIds).size).toBe(CLIENT_COUNT);

      // Step 6: Each client consumes audio from all other clients
      // (N clients each consume N-1 producers = N*(N-1) consume calls)
      let totalConsumeCount = 0;

      for (let i = 0; i < CLIENT_COUNT; i++) {
        for (let j = 0; j < CLIENT_COUNT; j++) {
          if (i === j) continue; // Skip self

          const consumeResult = await emitWithCallback<{
            id: string;
            producerId: string;
            kind: string;
            rtpParameters: any;
          }>(clients[i], 'voice:consume', {
            producerId: producerIds[j],
            transportId: clientTransports[i].recvTransport.id,
            rtpCapabilities: {
              codecs: [{ mimeType: 'audio/opus', preferredPayloadType: 100, clockRate: 48000, channels: 2 }],
            },
          });

          expect(consumeResult).toBeDefined();
          expect(consumeResult.id).toBeTruthy();
          expect(consumeResult.producerId).toBe(producerIds[j]);
          expect(consumeResult.kind).toBe('audio');
          totalConsumeCount++;
        }
      }

      // Each of the 10 clients consumes from 9 others = 90 total
      const expectedConsumeCount = CLIENT_COUNT * (CLIENT_COUNT - 1);
      expect(totalConsumeCount).toBe(expectedConsumeCount);
      expect(mediasoupService.consume).toHaveBeenCalledTimes(expectedConsumeCount);
    });

    it('should handle mute/deafen broadcast across 10 clients', async () => {
      // Connect all clients
      const clients: ClientSocket[] = [];
      for (let i = 0; i < CLIENT_COUNT; i++) {
        const client = await connectClient(tokens[i]);
        clients.push(client);
      }

      // All clients join voice
      for (let i = 0; i < CLIENT_COUNT; i++) {
        const joinPromise = waitForEvent(clients[i], 'voice:joined');
        clients[i].emit('voice:join', VOICE_CHANNEL_ID);
        await joinPromise;
      }

      // Client 0 mutes - all other clients should receive mute event
      const mutePromises = [];
      for (let i = 1; i < CLIENT_COUNT; i++) {
        mutePromises.push(
          waitForEvent<{ socketId: string; isMuted: boolean }>(clients[i], 'voice:user-muted')
        );
      }

      clients[0].emit('voice:mute', true);

      const muteResults = await Promise.all(mutePromises);
      for (const result of muteResults) {
        expect(result.isMuted).toBe(true);
        expect(result.socketId).toBeDefined();
      }

      // Client 5 deafens - all other clients should receive deafen event
      const deafenPromises = [];
      for (let i = 0; i < CLIENT_COUNT; i++) {
        if (i === 5) continue;
        deafenPromises.push(
          waitForEvent<{ socketId: string; isDeafened: boolean }>(clients[i], 'voice:user-deafened')
        );
      }

      clients[5].emit('voice:deafen', true);

      const deafenResults = await Promise.all(deafenPromises);
      for (const result of deafenResults) {
        expect(result.isDeafened).toBe(true);
        expect(result.socketId).toBeDefined();
      }
    });

    it('should cleanup resources when clients disconnect from voice', async () => {
      // Connect 3 clients (subset for faster test)
      expect(tokens.length).toBeGreaterThanOrEqual(3);
      const clients: ClientSocket[] = [];
      for (let i = 0; i < 3; i++) {
        const client = await connectClient(tokens[i]);
        clients.push(client);
      }

      // All join voice
      for (let i = 0; i < 3; i++) {
        const joinPromise = waitForEvent(clients[i], 'voice:joined');
        clients[i].emit('voice:join', VOICE_CHANNEL_ID);
        await joinPromise;
      }

      // Create transports and produce for client 0
      const sendTransport = await emitWithCallback<{ id: string }>(
        clients[0],
        'voice:create-transport'
      );
      const recvTransport = await emitWithCallback<{ id: string }>(
        clients[0],
        'voice:create-transport'
      );

      clients[0].emit('voice:set-transport', {
        sendTransportId: sendTransport.id,
        recvTransportId: recvTransport.id,
      });

      // Connect transports
      await emitWithCallback(clients[0], 'voice:connect-transport', {
        transportId: sendTransport.id,
        dtlsParameters: {},
      });
      await emitWithCallback(clients[0], 'voice:connect-transport', {
        transportId: recvTransport.id,
        dtlsParameters: {},
      });

      // Produce audio
      const produceResult = await emitWithCallback<{ producerId: string }>(
        clients[0],
        'voice:produce',
        { transportId: sendTransport.id, kind: 'audio', rtpParameters: {} }
      );

      // Wait for other clients to see user-left event
      const userLeftPromises = [
        waitForEvent<{ socketId: string }>(clients[1], 'voice:user-left'),
        waitForEvent<{ socketId: string }>(clients[2], 'voice:user-left'),
      ];

      // Client 0 leaves voice
      clients[0].emit('voice:leave');

      const leftResults = await Promise.all(userLeftPromises);
      for (const result of leftResults) {
        expect(result.socketId).toBeDefined();
      }

      // Verify cleanup was called
      expect(mediasoupService.closeTransport).toHaveBeenCalledWith(sendTransport.id);
      expect(mediasoupService.closeTransport).toHaveBeenCalledWith(recvTransport.id);
      expect(mediasoupService.closeProducer).toHaveBeenCalledWith(
        VOICE_CHANNEL_ID,
        produceResult.producerId
      );
    });

    it('should clean up all resources when last user disconnects', async () => {
      const client = await connectClient(tokens[0]);

      const joinPromise = waitForEvent(client, 'voice:joined');
      client.emit('voice:join', VOICE_CHANNEL_ID);
      await joinPromise;

      // Leave voice
      client.emit('voice:leave');

      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Since this was the only user, channel should be cleaned up
      expect(voiceChannelManager.isChannelEmpty(VOICE_CHANNEL_ID)).toBe(true);
      expect(mediasoupService.closeRouter).toHaveBeenCalledWith(VOICE_CHANNEL_ID);
    });

    it('should handle client disconnection (unclean leave) with cleanup', async () => {
      const client = await connectClient(tokens[0]);

      const joinPromise = waitForEvent(client, 'voice:joined');
      client.emit('voice:join', VOICE_CHANNEL_ID);
      await joinPromise;

      // Abruptly disconnect (simulates network drop)
      client.disconnect();

      // Wait for server to process disconnect
      await new Promise(resolve => setTimeout(resolve, 200));

      // Voice channel should be cleaned up since it was the only user
      expect(voiceChannelManager.isChannelEmpty(VOICE_CHANNEL_ID)).toBe(true);
    });
  });
});
