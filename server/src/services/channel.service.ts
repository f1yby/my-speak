import { PrismaClient } from '@prisma/client';

export interface CreateChannelData {
  name: string;
  type?: 'TEXT' | 'VOICE';
}

export class ChannelError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ChannelError';
  }
}

export class ChannelService {
  constructor(private prisma: PrismaClient) {}

  async getChannels() {
    return this.prisma.channel.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });
  }

  async getChannelById(id: string) {
    return this.prisma.channel.findUnique({
      where: { id },
    });
  }

  async createChannel(data: CreateChannelData) {
    const existing = await this.prisma.channel.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new ChannelError('Channel name already exists', 'NAME_EXISTS');
    }

    return this.prisma.channel.create({
      data: {
        name: data.name,
        type: data.type || 'TEXT',
      },
    });
  }

  async deleteChannel(id: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id },
    });

    if (!channel) {
      throw new ChannelError('Channel not found', 'NOT_FOUND');
    }

    await this.prisma.channel.delete({
      where: { id },
    });

    return { success: true };
  }
}
