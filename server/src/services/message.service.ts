import { PrismaClient } from '@prisma/client';

export interface CreateMessageData {
  channelId: string;
  authorName: string;
  content: string;
}

export class MessageError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'MessageError';
  }
}

export class MessageService {
  constructor(private prisma: PrismaClient) {}

  async getMessages(channelId: string, limit: number = 50, before?: string) {
    const where: Record<string, unknown> = { channelId };

    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    return this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async createMessage(data: CreateMessageData) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: data.channelId },
    });

    if (!channel) {
      throw new MessageError('Channel not found', 'CHANNEL_NOT_FOUND');
    }

    return this.prisma.message.create({
      data: {
        channelId: data.channelId,
        authorName: data.authorName,
        content: data.content,
      },
    });
  }

  async deleteOldMessages(daysOld: number = 30): Promise<number> {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await this.prisma.message.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });

    return result.count;
  }
}
