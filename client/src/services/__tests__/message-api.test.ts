import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messageApi } from '../message-api';
import { apiClient } from '../api-client';

vi.mock('../api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('messageApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMessages', () => {
    it('should call GET /channels/:id/messages without params', async () => {
      const messages = [{ id: '1', content: 'Hello', authorName: 'user1' }];
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: messages } });

      const result = await messageApi.getMessages('ch1');
      expect(result).toEqual(messages);
      expect(apiClient.get).toHaveBeenCalledWith('/channels/ch1/messages');
    });

    it('should include limit and before query params', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });

      await messageApi.getMessages('ch1', { limit: 10, before: '2024-01-01' });
      expect(apiClient.get).toHaveBeenCalledWith('/channels/ch1/messages?limit=10&before=2024-01-01');
    });
  });

  describe('createMessage', () => {
    it('should call POST /channels/:id/messages', async () => {
      const newMessage = { id: 'm1', content: 'Hello', authorName: 'user1', channelId: 'ch1' };
      vi.mocked(apiClient.post).mockResolvedValue({ data: { data: newMessage } });

      const result = await messageApi.createMessage('ch1', { content: 'Hello' });
      expect(result).toEqual(newMessage);
      expect(apiClient.post).toHaveBeenCalledWith('/channels/ch1/messages', { content: 'Hello' });
    });
  });
});
