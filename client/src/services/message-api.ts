import { apiClient } from './api-client';

export interface Message {
  id: string;
  channelId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface GetMessagesOptions {
  limit?: number;
  before?: string;
}

export interface CreateMessageInput {
  content: string;
}

export const messageApi = {
  getMessages: async (channelId: string, options?: GetMessagesOptions): Promise<Message[]> => {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.before) params.append('before', options.before);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await apiClient.get(`/channels/${channelId}/messages${query}`);
    return response.data.data;
  },

  createMessage: async (channelId: string, input: CreateMessageInput): Promise<Message> => {
    const response = await apiClient.post(`/channels/${channelId}/messages`, input);
    return response.data.data;
  },
};
