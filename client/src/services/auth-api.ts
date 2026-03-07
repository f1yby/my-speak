import { apiClient } from './api-client';

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    tokens: Tokens;
  };
  message: string;
}

export const authApi = {
  // 注册
  register: async (input: RegisterInput): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/register', input);
    return response.data;
  },

  // 登录
  login: async (input: LoginInput): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', input);
    return response.data;
  },

  // 获取当前用户信息
  getMe: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me');
    return response.data.data;
  },

  // 登出
  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },
};
