import { apiClient } from './api-client';

export interface SetupStatus {
  isSetup: boolean;
}

export interface LoginInput {
  password: string;
  username: string;
}

export interface SetupInput {
  password: string;
}

export interface Session {
  token: string;
  username: string;
  expiresAt: string;
}

export interface User {
  username: string;
}

export const authApi = {
  checkSetup: async (): Promise<SetupStatus> => {
    const response = await apiClient.get('/auth/setup');
    return response.data.data;
  },

  setup: async (input: SetupInput): Promise<void> => {
    await apiClient.post('/auth/setup', input);
  },

  login: async (input: LoginInput): Promise<Session> => {
    const response = await apiClient.post('/auth/login', input);
    return response.data.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me');
    return response.data.data;
  },
};
