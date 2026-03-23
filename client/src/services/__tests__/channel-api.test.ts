import { describe, it, expect, vi, beforeEach } from 'vitest';
import { channelApi } from '../channel-api';
import { apiClient } from '../api-client';

vi.mock('../api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('channelApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getChannels', () => {
    it('should call GET /channels and return data', async () => {
      const channels = [{ id: '1', name: 'general', type: 'TEXT' }];
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: channels } });

      const result = await channelApi.getChannels();
      expect(result).toEqual(channels);
      expect(apiClient.get).toHaveBeenCalledWith('/channels');
    });
  });

  describe('getChannel', () => {
    it('should call GET /channels/:id and return data', async () => {
      const channel = { id: '1', name: 'general', type: 'TEXT' };
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: channel } });

      const result = await channelApi.getChannel('1');
      expect(result).toEqual(channel);
      expect(apiClient.get).toHaveBeenCalledWith('/channels/1');
    });
  });

  describe('createChannel', () => {
    it('should call POST /channels with input and return data', async () => {
      const newChannel = { id: '2', name: 'new', type: 'TEXT' };
      vi.mocked(apiClient.post).mockResolvedValue({ data: { data: newChannel } });

      const result = await channelApi.createChannel({ name: 'new' });
      expect(result).toEqual(newChannel);
      expect(apiClient.post).toHaveBeenCalledWith('/channels', { name: 'new' });
    });
  });

  describe('deleteChannel', () => {
    it('should call DELETE /channels/:id', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } });

      await channelApi.deleteChannel('1');
      expect(apiClient.delete).toHaveBeenCalledWith('/channels/1');
    });
  });
});
