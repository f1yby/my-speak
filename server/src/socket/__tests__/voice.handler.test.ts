import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerVoiceHandlers, VoiceHandlerDeps } from '../voice.handler';
import { Socket } from 'socket.io';
import { MediasoupService } from '../../services/mediasoup.service';
import { VoiceChannelManager } from '../../services/voice-channel-manager';

function createMockSocket() {
  const handlers: Record<string, Function> = {};
  return {
    id: 'socket-1',
    on: vi.fn((event: string, handler: Function) => {
      handlers[event] = handler;
    }),
    emit: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    to: vi.fn().mockReturnThis(),
    _handlers: handlers,
  } as unknown as Socket & { _handlers: Record<string, Function> };
}

function createMockDeps() {
  const mediasoupService = {
    getOrCreateRouter: vi.fn().mockResolvedValue({
      rtpCapabilities: { codecs: [], headerExtensions: [] },
    }),
    createWebRtcTransport: vi.fn().mockResolvedValue({
      id: 'transport-1',
      iceParameters: {},
      iceCandidates: [],
      dtlsParameters: {},
    }),
    connectTransport: vi.fn().mockResolvedValue(undefined),
    produce: vi.fn().mockResolvedValue({ producerId: 'producer-1' }),
    consume: vi.fn().mockResolvedValue({
      id: 'consumer-1',
      producerId: 'producer-1',
      kind: 'audio',
      rtpParameters: {},
    }),
    closeTransport: vi.fn(),
    closeProducer: vi.fn(),
    closeRouter: vi.fn(),
  } as unknown as MediasoupService;

  const voiceChannelManager = {
    addUser: vi.fn(),
    removeUser: vi.fn().mockReturnValue(null),
    updateUser: vi.fn(),
    isChannelEmpty: vi.fn().mockReturnValue(false),
    getExistingProducers: vi.fn().mockReturnValue([]),
  } as unknown as VoiceChannelManager;

  return { mediasoupService, voiceChannelManager };
}

describe('registerVoiceHandlers', () => {
  let socket: Socket & { _handlers: Record<string, Function> };
  let deps: VoiceHandlerDeps;
  let result: ReturnType<typeof registerVoiceHandlers>;

  beforeEach(() => {
    vi.clearAllMocks();
    socket = createMockSocket();
    deps = createMockDeps();
    result = registerVoiceHandlers(socket as unknown as Socket, 'testuser', deps);
  });

  it('should register all voice event handlers', () => {
    const registeredEvents = (socket.on as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => call[0]
    );
    expect(registeredEvents).toContain('voice:join');
    expect(registeredEvents).toContain('voice:leave');
    expect(registeredEvents).toContain('voice:create-transport');
    expect(registeredEvents).toContain('voice:connect-transport');
    expect(registeredEvents).toContain('voice:set-transport');
    expect(registeredEvents).toContain('voice:produce');
    expect(registeredEvents).toContain('voice:consume');
    expect(registeredEvents).toContain('voice:mute');
    expect(registeredEvents).toContain('voice:deafen');
  });

  describe('voice:join', () => {
    it('should join a voice channel and emit joined event', async () => {
      await socket._handlers['voice:join']('vc1');

      expect(socket.join).toHaveBeenCalledWith('voice:vc1');
      expect(deps.voiceChannelManager.addUser).toHaveBeenCalledWith('vc1', 'socket-1', 'testuser');
      expect(deps.mediasoupService.getOrCreateRouter).toHaveBeenCalledWith('vc1');
      expect(socket.emit).toHaveBeenCalledWith('voice:joined', expect.objectContaining({
        rtpCapabilities: expect.any(Object),
        users: expect.any(Array),
      }));
    });

    it('should leave previous voice channel when joining a new one', async () => {
      await socket._handlers['voice:join']('vc1');
      await socket._handlers['voice:join']('vc2');

      expect(socket.leave).toHaveBeenCalledWith('voice:vc1');
      expect(socket.join).toHaveBeenCalledWith('voice:vc2');
    });
  });

  describe('voice:leave', () => {
    it('should leave the current voice channel', async () => {
      await socket._handlers['voice:join']('vc1');
      await socket._handlers['voice:leave']();

      expect(socket.leave).toHaveBeenCalledWith('voice:vc1');
    });

    it('should do nothing if not in a voice channel', async () => {
      await socket._handlers['voice:leave']();

      expect(socket.leave).not.toHaveBeenCalled();
    });
  });

  describe('voice:create-transport', () => {
    it('should create a transport and call callback with params', async () => {
      // First join a channel
      await socket._handlers['voice:join']('vc1');

      const callback = vi.fn();
      await socket._handlers['voice:create-transport'](callback);

      expect(deps.mediasoupService.createWebRtcTransport).toHaveBeenCalledWith('vc1');
      expect(callback).toHaveBeenCalledWith({
        id: 'transport-1',
        iceParameters: {},
        iceCandidates: [],
        dtlsParameters: {},
      });
    });

    it('should call callback with error when transport creation fails', async () => {
      (deps.mediasoupService.createWebRtcTransport as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Transport creation failed')
      );
      await socket._handlers['voice:join']('vc1');

      const callback = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await socket._handlers['voice:create-transport'](callback);

      expect(callback).toHaveBeenCalledWith({ error: 'Failed to create transport' });
      consoleSpy.mockRestore();
    });
  });

  describe('voice:connect-transport', () => {
    it('should connect a transport successfully', async () => {
      const callback = vi.fn();
      await socket._handlers['voice:connect-transport'](
        { transportId: 'transport-1', dtlsParameters: {} },
        callback
      );

      expect(deps.mediasoupService.connectTransport).toHaveBeenCalledWith('transport-1', {});
      expect(callback).toHaveBeenCalledWith({ success: true });
    });

    it('should call callback with error on failure', async () => {
      (deps.mediasoupService.connectTransport as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Connect failed')
      );
      const callback = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await socket._handlers['voice:connect-transport'](
        { transportId: 'transport-1', dtlsParameters: {} },
        callback
      );

      expect(callback).toHaveBeenCalledWith({ error: 'Failed to connect transport' });
      consoleSpy.mockRestore();
    });
  });

  describe('voice:set-transport', () => {
    it('should update send transport id', async () => {
      await socket._handlers['voice:join']('vc1');
      socket._handlers['voice:set-transport']({ sendTransportId: 'send-1' });

      expect(deps.voiceChannelManager.updateUser).toHaveBeenCalledWith(
        'vc1', 'socket-1', { sendTransportId: 'send-1' }
      );
    });

    it('should update recv transport id', async () => {
      await socket._handlers['voice:join']('vc1');
      socket._handlers['voice:set-transport']({ recvTransportId: 'recv-1' });

      expect(deps.voiceChannelManager.updateUser).toHaveBeenCalledWith(
        'vc1', 'socket-1', { recvTransportId: 'recv-1' }
      );
    });

    it('should do nothing if not in a voice channel', () => {
      socket._handlers['voice:set-transport']({ sendTransportId: 'send-1' });

      expect(deps.voiceChannelManager.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('voice:produce', () => {
    it('should produce and broadcast new producer', async () => {
      await socket._handlers['voice:join']('vc1');

      const callback = vi.fn();
      await socket._handlers['voice:produce'](
        { transportId: 'transport-1', kind: 'audio', rtpParameters: {} },
        callback
      );

      expect(deps.mediasoupService.produce).toHaveBeenCalledWith(
        'vc1', 'transport-1', 'audio', {}
      );
      expect(callback).toHaveBeenCalledWith({ producerId: 'producer-1' });
    });

    it('should call callback with error on failure', async () => {
      (deps.mediasoupService.produce as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Produce failed')
      );
      await socket._handlers['voice:join']('vc1');

      const callback = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await socket._handlers['voice:produce'](
        { transportId: 'transport-1', kind: 'audio', rtpParameters: {} },
        callback
      );

      expect(callback).toHaveBeenCalledWith({ error: 'Failed to produce' });
      consoleSpy.mockRestore();
    });
  });

  describe('voice:consume', () => {
    it('should consume and call callback with result', async () => {
      await socket._handlers['voice:join']('vc1');

      const callback = vi.fn();
      await socket._handlers['voice:consume'](
        { producerId: 'producer-1', transportId: 'transport-1', rtpCapabilities: {} },
        callback
      );

      expect(deps.mediasoupService.consume).toHaveBeenCalledWith(
        'vc1', 'producer-1', 'transport-1', {}
      );
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        id: 'consumer-1',
        producerId: 'producer-1',
      }));
    });

    it('should call callback with error on failure', async () => {
      (deps.mediasoupService.consume as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Consume failed')
      );
      await socket._handlers['voice:join']('vc1');

      const callback = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await socket._handlers['voice:consume'](
        { producerId: 'producer-1', transportId: 'transport-1', rtpCapabilities: {} },
        callback
      );

      expect(callback).toHaveBeenCalledWith({ error: 'Failed to consume' });
      consoleSpy.mockRestore();
    });
  });

  describe('voice:mute', () => {
    it('should broadcast mute state to voice channel', async () => {
      await socket._handlers['voice:join']('vc1');
      socket._handlers['voice:mute'](true);

      expect(socket.to).toHaveBeenCalledWith('voice:vc1');
    });

    it('should do nothing if not in a voice channel', () => {
      socket._handlers['voice:mute'](true);

      expect(socket.to).not.toHaveBeenCalled();
    });
  });

  describe('voice:deafen', () => {
    it('should broadcast deafen state to voice channel', async () => {
      await socket._handlers['voice:join']('vc1');
      socket._handlers['voice:deafen'](true);

      expect(socket.to).toHaveBeenCalledWith('voice:vc1');
    });

    it('should do nothing if not in a voice channel', () => {
      socket._handlers['voice:deafen'](true);

      expect(socket.to).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should leave voice channel on cleanup', async () => {
      await socket._handlers['voice:join']('vc1');
      await result.cleanup();

      expect(socket.leave).toHaveBeenCalledWith('voice:vc1');
    });

    it('should do nothing on cleanup if not in a voice channel', async () => {
      await result.cleanup();

      expect(socket.leave).not.toHaveBeenCalled();
    });

    it('should clean up transports and producers when user has resources', async () => {
      (deps.voiceChannelManager.removeUser as ReturnType<typeof vi.fn>).mockReturnValue({
        sendTransportId: 'send-1',
        recvTransportId: 'recv-1',
        producerId: 'producer-1',
      });

      await socket._handlers['voice:join']('vc1');
      await result.cleanup();

      expect(deps.mediasoupService.closeTransport).toHaveBeenCalledWith('send-1');
      expect(deps.mediasoupService.closeTransport).toHaveBeenCalledWith('recv-1');
      expect(deps.mediasoupService.closeProducer).toHaveBeenCalledWith('vc1', 'producer-1');
    });

    it('should close router when channel becomes empty', async () => {
      (deps.voiceChannelManager.isChannelEmpty as ReturnType<typeof vi.fn>).mockReturnValue(true);

      await socket._handlers['voice:join']('vc1');
      await result.cleanup();

      expect(deps.mediasoupService.closeRouter).toHaveBeenCalledWith('vc1');
    });
  });
});
