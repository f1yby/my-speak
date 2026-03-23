import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageService, MessageError } from '../message.service';
import { createMockPrismaClient, MockPrismaClient } from '../../__mocks__/prisma-client';

describe('MessageService', () => {
  let messageService: MessageService;
  let mockPrisma: MockPrismaClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrismaClient();
    messageService = new MessageService(mockPrisma as any);
  });

  describe('getMessages', () => {
    it('should return messages for a channel', async () => {
      const mockMessages = [
        { id: '1', channelId: 'ch1', content: 'Hello', authorName: 'user1' },
        { id: '2', channelId: 'ch1', content: 'World', authorName: 'user2' },
      ];
      mockPrisma.message.findMany.mockResolvedValue(mockMessages as any);

      const result = await messageService.getMessages('ch1');
      expect(result).toEqual(mockMessages);
      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: { channelId: 'ch1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('should respect limit parameter', async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);

      await messageService.getMessages('ch1', 10);
      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });

    it('should filter by before date when provided', async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);
      const beforeDate = '2024-01-01T00:00:00.000Z';

      await messageService.getMessages('ch1', 50, beforeDate);
      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: {
          channelId: 'ch1',
          createdAt: { lt: new Date(beforeDate) },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('createMessage', () => {
    it('should create a message in an existing channel', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue({ id: 'ch1' } as any);
      const newMessage = { id: 'm1', channelId: 'ch1', authorName: 'user1', content: 'Hello' };
      mockPrisma.message.create.mockResolvedValue(newMessage as any);

      const result = await messageService.createMessage({
        channelId: 'ch1',
        authorName: 'user1',
        content: 'Hello',
      });

      expect(result).toEqual(newMessage);
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: { channelId: 'ch1', authorName: 'user1', content: 'Hello' },
      });
    });

    it('should throw CHANNEL_NOT_FOUND when channel does not exist', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue(null);

      await expect(
        messageService.createMessage({ channelId: 'nonexistent', authorName: 'user', content: 'msg' })
      ).rejects.toThrow(MessageError);
      await expect(
        messageService.createMessage({ channelId: 'nonexistent', authorName: 'user', content: 'msg' })
      ).rejects.toMatchObject({ code: 'CHANNEL_NOT_FOUND' });
    });
  });

  describe('deleteOldMessages', () => {
    it('should delete messages older than specified days', async () => {
      mockPrisma.message.deleteMany.mockResolvedValue({ count: 10 } as any);

      const result = await messageService.deleteOldMessages(30);
      expect(result).toBe(10);
      expect(mockPrisma.message.deleteMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: expect.any(Date) } },
      });
    });

    it('should default to 30 days', async () => {
      mockPrisma.message.deleteMany.mockResolvedValue({ count: 0 } as any);

      await messageService.deleteOldMessages();
      expect(mockPrisma.message.deleteMany).toHaveBeenCalled();
    });
  });
});
