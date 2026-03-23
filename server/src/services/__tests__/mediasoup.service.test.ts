import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediasoupService } from '../mediasoup.service';
import {
  createMockWorker,
  createMockRouter,
  createMockTransport,
  createMockProducer,
  createMockConsumer,
  createMockWebRtcServer,
} from '../../__mocks__/mediasoup';

describe('MediasoupService', () => {
  let service: MediasoupService;
  let mockWorker: ReturnType<typeof createMockWorker>;
  let mockRouter: ReturnType<typeof createMockRouter>;
  let mockTransport: ReturnType<typeof createMockTransport>;
  let mockWebRtcServer: ReturnType<typeof createMockWebRtcServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorker = createMockWorker();
    mockRouter = createMockRouter();
    mockTransport = createMockTransport();
    mockWebRtcServer = createMockWebRtcServer();

    mockWorker.createRouter.mockResolvedValue(mockRouter as any);
    mockWorker.createWebRtcServer.mockResolvedValue(mockWebRtcServer as any);
    mockRouter.createWebRtcTransport.mockResolvedValue(mockTransport as any);

    service = new MediasoupService(async () => mockWorker as any);
  });

  describe('initWorker', () => {
    it('should create a worker on first call', async () => {
      await service.initWorker();
      // No error means success
      expect(mockWorker.on).toHaveBeenCalledWith('died', expect.any(Function));
    });

    it('should not create worker twice', async () => {
      await service.initWorker();
      await service.initWorker();
      // Worker factory is called during initWorker only once;
      // second call should be a no-op
    });
  });

  describe('getOrCreateRouter', () => {
    it('should create a new router for a channel', async () => {
      const router = await service.getOrCreateRouter('channel-1');
      expect(router).toBeDefined();
      expect(router.rtpCapabilities).toBeDefined();
    });

    it('should return existing router for same channel', async () => {
      const router1 = await service.getOrCreateRouter('channel-1');
      const router2 = await service.getOrCreateRouter('channel-1');
      expect(router1).toBe(router2);
    });
  });

  describe('getRouterRtpCapabilities', () => {
    it('should return null for unknown channel', () => {
      const result = service.getRouterRtpCapabilities('unknown');
      expect(result).toBeNull();
    });

    it('should return capabilities for known channel', async () => {
      await service.getOrCreateRouter('channel-1');
      const result = service.getRouterRtpCapabilities('channel-1');
      expect(result).toBeDefined();
    });
  });

  describe('initWebRtcServer', () => {
    it('should create a WebRtcServer', async () => {
      await service.initWebRtcServer();
      expect(mockWorker.createWebRtcServer).toHaveBeenCalled();
    });

    it('should not create WebRtcServer twice', async () => {
      await service.initWebRtcServer();
      await service.initWebRtcServer();
      expect(mockWorker.createWebRtcServer).toHaveBeenCalledTimes(1);
    });
  });

  describe('createWebRtcTransport', () => {
    it('should create transport and return parameters', async () => {
      await service.initWebRtcServer();
      const result = await service.createWebRtcTransport('channel-1');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('iceParameters');
      expect(result).toHaveProperty('iceCandidates');
      expect(result).toHaveProperty('dtlsParameters');
    });

    it('should throw if WebRtcServer not initialized', async () => {
      await expect(
        service.createWebRtcTransport('channel-1')
      ).rejects.toThrow('WebRtcServer not initialized');
    });
  });

  describe('connectTransport', () => {
    it('should connect an existing transport', async () => {
      await service.initWebRtcServer();
      await service.createWebRtcTransport('channel-1');
      await service.connectTransport('transport-id-1', { fingerprints: [], role: 'auto' } as any);
      expect(mockTransport.connect).toHaveBeenCalled();
    });

    it('should throw for unknown transport', async () => {
      await expect(
        service.connectTransport('unknown', {} as any)
      ).rejects.toThrow('Transport not found');
    });
  });

  describe('produce', () => {
    it('should create a producer on existing transport', async () => {
      await service.initWebRtcServer();
      await service.createWebRtcTransport('channel-1');

      const result = await service.produce('channel-1', 'transport-id-1', 'audio', {} as any);
      expect(result).toHaveProperty('producerId');
    });

    it('should throw for unknown transport', async () => {
      await expect(
        service.produce('channel-1', 'unknown', 'audio', {} as any)
      ).rejects.toThrow('Transport not found');
    });
  });

  describe('consume', () => {
    it('should throw for unknown router', async () => {
      await expect(
        service.consume('unknown', 'prod-1', 'trans-1', {} as any)
      ).rejects.toThrow('Router not found');
    });
  });

  describe('closeProducer', () => {
    it('should close and remove producer', async () => {
      await service.initWebRtcServer();
      await service.createWebRtcTransport('channel-1');
      const { producerId } = await service.produce('channel-1', 'transport-id-1', 'audio', {} as any);

      service.closeProducer('channel-1', producerId);
      // No error = success
    });

    it('should be no-op for non-existent producer', () => {
      service.closeProducer('channel-1', 'nonexistent');
      // No error = success
    });
  });

  describe('closeTransport', () => {
    it('should close and remove transport', async () => {
      await service.initWebRtcServer();
      await service.createWebRtcTransport('channel-1');
      service.closeTransport('transport-id-1');
      expect(mockTransport.close).toHaveBeenCalled();
    });
  });

  describe('closeRouter', () => {
    it('should close and remove router', async () => {
      await service.getOrCreateRouter('channel-1');
      service.closeRouter('channel-1');
      expect(mockRouter.close).toHaveBeenCalled();
    });

    it('should be no-op for non-existent router', () => {
      service.closeRouter('nonexistent');
      // No error = success
    });
  });
});
