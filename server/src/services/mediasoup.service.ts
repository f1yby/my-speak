import mediasoup = require('mediasoup');
import { types } from 'mediasoup';

export type WorkerFactory = () => Promise<types.Worker>;

const mediaCodecs: types.RtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    preferredPayloadType: 100,
    clockRate: 48000,
    channels: 2,
  },
];

export class MediasoupService {
  private worker: types.Worker | null = null;
  private webRtcServer: types.WebRtcServer | null = null;
  private routers = new Map<string, types.Router>();
  private transports = new Map<string, types.WebRtcTransport>();
  private producers = new Map<string, types.Producer>();
  private consumers = new Map<string, types.Consumer>();

  constructor(private workerFactory: WorkerFactory) {}

  async initWorker(): Promise<void> {
    if (this.worker) return;

    this.worker = await this.workerFactory();

    this.worker.on('died', () => {
      console.error('Mediasoup worker died, exiting...');
      process.exit(1);
    });

    console.log('Mediasoup worker created');
  }

  async initWebRtcServer(): Promise<void> {
    if (this.webRtcServer) return;
    if (!this.worker) {
      await this.initWorker();
    }

    const port = parseInt(process.env.MEDIASOUP_PORT || '10000', 10);
    const announcedAddress = process.env.MEDIASOUP_ANNOUNCED_ADDRESS || undefined;

    this.webRtcServer = await this.worker!.createWebRtcServer({
      listenInfos: [
        {
          protocol: 'udp',
          ip: '0.0.0.0',
          announcedAddress,
          port,
        },
        {
          protocol: 'tcp',
          ip: '0.0.0.0',
          announcedAddress,
          port,
        },
      ],
    });

    console.log(`WebRtcServer created on port ${port}`);
  }

  async getOrCreateRouter(channelId: string): Promise<types.Router> {
    if (this.routers.has(channelId)) {
      return this.routers.get(channelId)!;
    }

    if (!this.worker) {
      await this.initWorker();
    }

    const router = await this.worker!.createRouter({ mediaCodecs });
    this.routers.set(channelId, router);
    console.log(`Router created for channel ${channelId}`);
    return router;
  }

  getRouterRtpCapabilities(channelId: string): types.RtpCapabilities | null {
    const router = this.routers.get(channelId);
    return router?.rtpCapabilities || null;
  }

  async createWebRtcTransport(channelId: string): Promise<{
    id: string;
    iceParameters: types.IceParameters;
    iceCandidates: types.IceCandidate[];
    dtlsParameters: types.DtlsParameters;
  }> {
    const router = await this.getOrCreateRouter(channelId);

    if (!this.webRtcServer) {
      throw new Error('WebRtcServer not initialized. Call initWebRtcServer() first.');
    }

    const transport = await router.createWebRtcTransport({
      webRtcServer: this.webRtcServer,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    this.transports.set(transport.id, transport);

    transport.on('dtlsstatechange', (dtlsState: string) => {
      if (dtlsState === 'closed') {
        transport.close();
        this.transports.delete(transport.id);
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

  async connectTransport(
    transportId: string,
    dtlsParameters: types.DtlsParameters
  ): Promise<void> {
    const transport = this.transports.get(transportId);
    if (!transport) {
      throw new Error('Transport not found');
    }
    await transport.connect({ dtlsParameters });
    console.log(`Transport connected: ${transportId}`);
  }

  async produce(
    channelId: string,
    transportId: string,
    kind: 'audio' | 'video',
    rtpParameters: types.RtpParameters
  ): Promise<{ producerId: string }> {
    const transport = this.transports.get(transportId);
    if (!transport) {
      throw new Error('Transport not found');
    }

    const producer = await transport.produce({ kind, rtpParameters });

    const producerKey = `${channelId}:${producer.id}`;
    this.producers.set(producerKey, producer);

    producer.on('transportclose', () => {
      this.producers.delete(producerKey);
    });

    console.log(`Producer created: ${producer.id} in channel ${channelId}`);
    return { producerId: producer.id };
  }

  async consume(
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
    const router = this.routers.get(channelId);
    if (!router) {
      throw new Error('Router not found');
    }

    const transport = this.transports.get(transportId);
    if (!transport) {
      throw new Error('Transport not found');
    }

    const producerKey = `${channelId}:${producerId}`;
    const producer = this.producers.get(producerKey);
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

    // Store by consumer.id for reliable resume lookup
    this.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => {
      this.consumers.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
      this.consumers.delete(consumer.id);
    });

    console.log(`Consumer created: ${consumer.id} for producer ${producerId}, paused: ${consumer.paused}`);

    return {
      id: consumer.id,
      producerId: producer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  async resumeConsumer(consumerId: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);
    if (consumer) {
      await consumer.resume();
      console.log(`Consumer resumed on server: ${consumerId}, paused: ${consumer.paused}`);
    } else {
      console.warn(`Consumer not found for resume: ${consumerId}, available keys: [${Array.from(this.consumers.keys()).join(', ')}]`);
    }
  }

  getProducer(producerId: string): types.Producer | undefined {
    for (const [, producer] of this.producers) {
      if (producer.id === producerId) {
        return producer;
      }
    }
    return undefined;
  }

  closeProducer(channelId: string, producerId: string): void {
    const producerKey = `${channelId}:${producerId}`;
    const producer = this.producers.get(producerKey);
    if (producer) {
      producer.close();
      this.producers.delete(producerKey);
    }
  }

  closeTransport(transportId: string): void {
    const transport = this.transports.get(transportId);
    if (transport) {
      // transport.close() will trigger 'transportclose' on all consumers,
      // which automatically removes them from this.consumers map
      transport.close();
      this.transports.delete(transportId);
    }
  }

  closeRouter(channelId: string): void {
    const router = this.routers.get(channelId);
    if (router) {
      router.close();
      this.routers.delete(channelId);
    }
  }
}
