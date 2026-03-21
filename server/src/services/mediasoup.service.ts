import mediasoup, { types } from 'mediasoup';

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
    parameters: {
      useinbandfec: 1,
      usedtx: 1,
      stereo: 1,
    },
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

export async function createTransport(channelId: string, socketId: string): Promise<{
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

  const transportKey = `${channelId}:${socketId}`;
  transports.set(transportKey, transport);

  transport.on('dtlsstatechange', (dtlsState) => {
    if (dtlsState === 'closed') {
      transport.close();
      transports.delete(transportKey);
    }
  });

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

export async function connectTransport(
  channelId: string,
  socketId: string,
  dtlsParameters: types.DtlsParameters
): Promise<void> {
  const transportKey = `${channelId}:${socketId}`;
  const transport = transports.get(transportKey);
  if (!transport) {
    throw new Error('Transport not found');
  }
  await transport.connect({ dtlsParameters });
}

export async function produce(
  channelId: string,
  socketId: string,
  kind: 'audio' | 'video',
  rtpParameters: types.RtpParameters
): Promise<{ producerId: string }> {
  const transportKey = `${channelId}:${socketId}`;
  const transport = transports.get(transportKey);
  if (!transport) {
    throw new Error('Transport not found');
  }

  const producer = await transport.produce({ kind, rtpParameters });
  const producerKey = `${channelId}:${socketId}`;
  producers.set(producerKey, producer);

  producer.on('transportclose', () => {
    producers.delete(producerKey);
  });

  console.log(`Producer created for ${socketId} in channel ${channelId}`);
  return { producerId: producer.id };
}

export async function consume(
  channelId: string,
  socketId: string,
  producerSocketId: string,
  rtpCapabilities: types.RtpCapabilities
): Promise<{
  consumerId: string;
  producerId: string;
  kind: string;
  rtpParameters: types.RtpParameters;
} | null> {
  const router = routers.get(channelId);
  if (!router) {
    throw new Error('Router not found');
  }

  const transportKey = `${channelId}:${socketId}`;
  const transport = transports.get(transportKey);
  if (!transport) {
    throw new Error('Transport not found');
  }

  const producerKey = `${channelId}:${producerSocketId}`;
  const producer = producers.get(producerKey);
  if (!producer) {
    return null;
  }

  if (!router.canConsume({ producerId: producer.id, rtpCapabilities })) {
    console.warn('Cannot consume');
    return null;
  }

  const consumer = await transport.consume({
    producerId: producer.id,
    rtpCapabilities,
    paused: true,
  });

  const consumerKey = `${channelId}:${socketId}:${producerSocketId}`;
  consumers.set(consumerKey, consumer);

  consumer.on('transportclose', () => {
    consumers.delete(consumerKey);
  });

  consumer.on('producerclose', () => {
    consumers.delete(consumerKey);
  });

  await consumer.resume();

  return {
    consumerId: consumer.id,
    producerId: producer.id,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters,
  };
}

export function closeProducer(channelId: string, socketId: string): void {
  const producerKey = `${channelId}:${socketId}`;
  const producer = producers.get(producerKey);
  if (producer) {
    producer.close();
    producers.delete(producerKey);
  }
}

export function closeConsumer(channelId: string, socketId: string, producerSocketId: string): void {
  const consumerKey = `${channelId}:${socketId}:${producerSocketId}`;
  const consumer = consumers.get(consumerKey);
  if (consumer) {
    consumer.close();
    consumers.delete(consumerKey);
  }
}

export function closeTransport(channelId: string, socketId: string): void {
  const transportKey = `${channelId}:${socketId}`;
  const transport = transports.get(transportKey);
  if (transport) {
    transport.close();
    transports.delete(transportKey);
  }
  closeProducer(channelId, socketId);

  for (const [key] of consumers) {
    if (key.startsWith(`${channelId}:${socketId}:`) || key.endsWith(`:${socketId}`)) {
      const consumer = consumers.get(key);
      if (consumer) {
        consumer.close();
        consumers.delete(key);
      }
    }
  }
}

export function closeRouter(channelId: string): void {
  const router = routers.get(channelId);
  if (router) {
    router.close();
    routers.delete(channelId);
  }

  for (const [key] of transports) {
    if (key.startsWith(`${channelId}:`)) {
      const transport = transports.get(key);
      if (transport) {
        transport.close();
        transports.delete(key);
      }
    }
  }

  for (const [key] of producers) {
    if (key.startsWith(`${channelId}:`)) {
      producers.delete(key);
    }
  }

  for (const [key] of consumers) {
    if (key.startsWith(`${channelId}:`)) {
      consumers.delete(key);
    }
  }
}
