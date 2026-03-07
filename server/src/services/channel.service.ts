import prisma from '../db/prisma-client';

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

export async function getChannels() {
  return prisma.channel.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });
}

export async function getChannelById(id: string) {
  return prisma.channel.findUnique({
    where: { id },
  });
}

export async function createChannel(data: CreateChannelData) {
  const existing = await prisma.channel.findUnique({
    where: { name: data.name },
  });
  
  if (existing) {
    throw new ChannelError('Channel name already exists', 'NAME_EXISTS');
  }
  
  return prisma.channel.create({
    data: {
      name: data.name,
      type: data.type || 'TEXT',
    },
  });
}

export async function deleteChannel(id: string) {
  const channel = await prisma.channel.findUnique({
    where: { id },
  });
  
  if (!channel) {
    throw new ChannelError('Channel not found', 'NOT_FOUND');
  }
  
  await prisma.channel.delete({
    where: { id },
  });
  
  return { success: true };
}
