import { vi } from 'vitest';

/**
 * Creates a mock mediasoup Consumer.
 */
export function createMockConsumer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'consumer-id-1',
    kind: 'audio' as const,
    rtpParameters: { codecs: [], headerExtensions: [], encodings: [], rtcp: {} },
    paused: false,
    close: vi.fn(),
    on: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock mediasoup Producer.
 */
export function createMockProducer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'producer-id-1',
    kind: 'audio' as const,
    close: vi.fn(),
    on: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock mediasoup WebRtcTransport.
 */
export function createMockTransport(overrides: Record<string, unknown> = {}) {
  return {
    id: 'transport-id-1',
    iceParameters: { usernameFragment: 'user', password: 'pass' },
    iceCandidates: [],
    dtlsParameters: { fingerprints: [], role: 'auto' },
    close: vi.fn(),
    connect: vi.fn(),
    produce: vi.fn().mockResolvedValue(createMockProducer()),
    consume: vi.fn().mockResolvedValue(createMockConsumer()),
    on: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock mediasoup Router.
 */
export function createMockRouter(overrides: Record<string, unknown> = {}) {
  return {
    id: 'router-id-1',
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
    close: vi.fn(),
    createWebRtcTransport: vi.fn().mockResolvedValue(createMockTransport()),
    canConsume: vi.fn().mockReturnValue(true),
    on: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock mediasoup Worker.
 */
export function createMockWorker(overrides: Record<string, unknown> = {}) {
  return {
    pid: 12345,
    close: vi.fn(),
    createRouter: vi.fn().mockResolvedValue(createMockRouter()),
    on: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock mediasoup module (for vi.mock('mediasoup')).
 */
export function createMockMediasoupModule() {
  return {
    createWorker: vi.fn().mockResolvedValue(createMockWorker()),
  };
}
