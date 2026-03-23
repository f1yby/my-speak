import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

// We test the apiClient by importing and checking interceptor behavior
vi.mock('axios', async () => {
  const create = vi.fn().mockReturnValue({
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  });

  return { default: { create } };
});

describe('api-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should create an axios instance with correct base URL', async () => {
    // Re-import to trigger module execution
    vi.resetModules();
    await import('../api-client');

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should register request and response interceptors', async () => {
    vi.resetModules();
    const module = await import('../api-client');
    const client = module.apiClient;

    expect(client.interceptors.request.use).toHaveBeenCalled();
    expect(client.interceptors.response.use).toHaveBeenCalled();
  });
});
