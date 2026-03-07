import prisma from '../db/prisma-client';

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

export async function getMessages(channelId: string, limit: number = 50, before?: string) {
  const where: any = { channelId };
  
  if (before) {
    where.createdAt = { lt: new Date(before) };
  }
  
  return prisma.message.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function createMessage(data: CreateMessageData) {
  const channel = await prisma.channel.findUnique({
    where: { id: data.channelId },
  });
  
  if (!channel) {
    throw new MessageError('Channel not found', 'CHANNEL_NOT_FOUND');
  }
  
  return prisma.message.create({
    data: {
      channelId: data.channelId,
      authorName: data.authorName,
      content: data.content,
    },
  });
}

export async function deleteOldMessages(daysOld: number = 30): Promise<number> {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  const result = await prisma.message.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  });
  
  return result.count;
}
