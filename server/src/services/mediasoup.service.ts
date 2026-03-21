import mediasoup = require('mediasoup');
import { types } from 'mediasoup';

let worker: types.Worker | null = null;
const routers = new Map<string, types.Router>();
const transports = new Map<string, types.WebRtcTransport>();
const producers = new Map<string, types.Producer>();
const consumers = new Map<string, types.Consumer>();

const mediaCodecs: types.RtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    preferredPayloadType: 100,
    clockRate: 48000,
    channels: 2,
  },
];

export async function initWorker(): Promise<void> {
  if (worker) return;

  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });

  worker.on('died', () => {
    console.error('Mediasoup worker died, exiting...');
    process.exit(1);
  });

  console.log('Mediasoup worker created');
}

export async function getOrCreateRouter(channelId: string): Promise<types.Router> {
  if (routers.has(channelId)) {
    return routers.get(channelId)!;
  }

  if (!worker) {
    await initWorker();
  }

  const router = await worker!.createRouter({ mediaCodecs });
  routers.set(channelId, router);
  console.log(`Router created for channel ${channelId}`);
  return router;
}

export function getRouterRtpCapabilities(channelId: string): types.RtpCapabilities | null {
  const router = routers.get(channelId);
  return router?.rtpCapabilities || null;
}

export async function createWebRtcTransport(channelId: string): Promise<{
  id: string;
  iceParameters: types.IceParameters;
  iceCandidates: types.IceCandidate[];
  dtlsParameters: types.DtlsParameters;
}> {
  const router = await getOrCreateRouter(channelId);

  const transport = await router.createWebRtcTransport({
    listenInfos: [
      {
        protocol: 'udp',
        ip: '0.0.0.0',
        announcedAddress: process.env.MEDIASOUP_ANNOUNCED_ADDRESS || undefined,
        portRange: { min: 10000, max: 10100 },
      },
      {
        protocol: 'tcp',
        ip: '0.0.0.0',
        announcedAddress: process.env.MEDIASOUP_ANNOUNCED_ADDRESS || undefined,
        portRange: { min: 10000, max: 10100 },
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  transports.set(transport.id, transport);

  transport.on('dtlsstatechange', (dtlsState) => {
    if (dtlsState === 'closed') {
      transport.close();
      transports.delete(transport.id);
    }
  });

  console.log(`Transport created: ${transport.id}`);

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

export async function connectTransport(
  transportId: string,
  dtlsParameters: types.DtlsParameters
): Promise<void> {
  const transport = transports.get(transportId);
  if (!transport) {
    throw new Error('Transport not found');
  }
  await transport.connect({ dtlsParameters });
  console.log(`Transport connected: ${transportId}`);
}

export async function produce(
  channelId: string,
  transportId: string,
  kind: 'audio' | 'video',
  rtpParameters: types.RtpParameters
): Promise<{ producerId: string }> {
  const transport = transports.get(transportId);
  if (!transport) {
    throw new Error('Transport not found');
  }

  const producer = await transport.produce({ kind, rtpParameters });
  
  const producerKey = `${channelId}:${producer.id}`;
  producers.set(producerKey, producer);

  producer.on('transportclose', () => {
    producers.delete(producerKey);
  });

  console.log(`Producer created: ${producer.id} in channel ${channelId}`);
  return { producerId: producer.id };
}

export async function consume(
  channelId: string,
  producerId: string,
  transportId: string,
  rtpCapabilities: types.RtpCapabilities
): Promise<{
  id: string;
  producerId: string;
  kind: string;
  rtpParameters: types.RtpParameters;
} | null> {
  const router = routers.get(channelId);
  if (!router) {
    throw new Error('Router not found');
  }

  const transport = transports.get(transportId);
  if (!transport) {
    throw new Error('Transport not found');
  }

  const producerKey = `${channelId}:${producerId}`;
  const producer = producers.get(producerKey);
  if (!producer) {
    console.log(`Producer not found: ${producerId}`);
    return null;
  }

  if (!router.canConsume({ producerId, rtpCapabilities })) {
    console.warn('Cannot consume');
    return null;
  }

  const consumer = await transport.consume({
    producerId,
    rtpCapabilities,
    paused: true,
  });

  const consumerKey = `${transportId}:${producerId}`;
  consumers.set(consumerKey, consumer);

  consumer.on('transportclose', () => {
    consumers.delete(consumerKey);
  });

  consumer.on('producerclose', () => {
    consumers.delete(consumerKey);
  });

  await consumer.resume();

  console.log(`Consumer created: ${consumer.id} for producer ${producerId}`);

  return {
    id: consumer.id,
    producerId: producer.id,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters,
  };
}

export function getProducer(producerId: string): types.Producer | undefined {
  for (const [, producer] of producers) {
    if (producer.id === producerId) {
      return producer;
    }
  }
  return undefined;
}

export function closeProducer(channelId: string, producerId: string): void {
  const producerKey = `${channelId}:${producerId}`;
  const producer = producers.get(producerKey);
  if (producer) {
    producer.close();
    producers.delete(producerKey);
  }
}

export function closeTransport(transportId: string): void {
  const transport = transports.get(transportId);
  if (transport) {
    transport.close();
    transports.delete(transportId);
  }

  for (const [key, consumer] of consumers) {
    if (key.startsWith(`${transportId}:`)) {
      consumer.close();
      consumers.delete(key);
    }
  }
}

export function closeRouter(channelId: string): void {
  const router = routers.get(channelId);
  if (router) {
    router.close();
    routers.delete(channelId);
  }
}
