import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChannelService, ChannelError } from '../channel.service';
import { createMockPrismaClient, MockPrismaClient } from '../../__mocks__/prisma-client';

describe('ChannelService', () => {
  let channelService: ChannelService;
  let mockPrisma: MockPrismaClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrismaClient();
    channelService = new ChannelService(mockPrisma as any);
  });

  describe('getChannels', () => {
    it('should return all channels ordered by createdAt', async () => {
      const mockChannels = [
        { id: '1', name: 'general', type: 'TEXT', _count: { messages: 5 } },
        { id: '2', name: 'random', type: 'TEXT', _count: { messages: 3 } },
      ];
      mockPrisma.channel.findMany.mockResolvedValue(mockChannels as any);

      const result = await channelService.getChannels();
      expect(result).toEqual(mockChannels);
      expect(mockPrisma.channel.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { messages: true } } },
      });
    });
  });

  describe('getChannelById', () => {
    it('should return channel when found', async () => {
      const mockChannel = { id: '1', name: 'general', type: 'TEXT' };
      mockPrisma.channel.findUnique.mockResolvedValue(mockChannel as any);

      const result = await channelService.getChannelById('1');
      expect(result).toEqual(mockChannel);
    });

    it('should return null when channel not found', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue(null);

      const result = await channelService.getChannelById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('createChannel', () => {
    it('should create a text channel', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue(null);
      const newChannel = { id: '1', name: 'new-channel', type: 'TEXT' };
      mockPrisma.channel.create.mockResolvedValue(newChannel as any);

      const result = await channelService.createChannel({ name: 'new-channel' });
      expect(result).toEqual(newChannel);
      expect(mockPrisma.channel.create).toHaveBeenCalledWith({
        data: { name: 'new-channel', type: 'TEXT' },
      });
    });

    it('should create a voice channel', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue(null);
      const newChannel = { id: '2', name: 'voice-room', type: 'VOICE' };
      mockPrisma.channel.create.mockResolvedValue(newChannel as any);

      const result = await channelService.createChannel({ name: 'voice-room', type: 'VOICE' });
      expect(result).toEqual(newChannel);
    });

    it('should throw NAME_EXISTS when channel name is taken', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue({ id: '1', name: 'existing' } as any);

      await expect(
        channelService.createChannel({ name: 'existing' })
      ).rejects.toThrow(ChannelError);
      await expect(
        channelService.createChannel({ name: 'existing' })
      ).rejects.toMatchObject({ code: 'NAME_EXISTS' });
    });
  });

  describe('deleteChannel', () => {
    it('should delete an existing channel', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue({ id: '1', name: 'general' } as any);
      mockPrisma.channel.delete.mockResolvedValue({} as any);

      const result = await channelService.deleteChannel('1');
      expect(result).toEqual({ success: true });
      expect(mockPrisma.channel.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('should throw NOT_FOUND when channel does not exist', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue(null);

      await expect(channelService.deleteChannel('nonexistent')).rejects.toThrow(ChannelError);
      await expect(channelService.deleteChannel('nonexistent')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
