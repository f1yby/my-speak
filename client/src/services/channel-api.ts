import { apiClient } from './api-client';

export interface Channel {
  id: string;
  name: string;
  type: 'TEXT' | 'VOICE';
  createdAt: string;
  updatedAt: string;
  _count?: {
    messages: number;
  };
}

export interface CreateChannelInput {
  name: string;
  type?: 'TEXT' | 'VOICE';
}

export const channelApi = {
  getChannels: async (): Promise<Channel[]> => {
    const response = await apiClient.get('/channels');
    return response.data.data;
  },

  getChannel: async (channelId: string): Promise<Channel> => {
    const response = await apiClient.get(`/channels/${channelId}`);
    return response.data.data;
  },

  createChannel: async (input: CreateChannelInput): Promise<Channel> => {
    const response = await apiClient.post('/channels', input);
    return response.data.data;
  },

  deleteChannel: async (channelId: string): Promise<void> => {
    await apiClient.delete(`/channels/${channelId}`);
  },
};
