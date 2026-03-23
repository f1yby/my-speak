import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChannels } from '../useChannels';
import { channelApi, type Channel } from '../../services/channel-api';

vi.mock('../../services/channel-api', () => ({
  channelApi: {
    getChannels: vi.fn(),
    getChannel: vi.fn(),
    createChannel: vi.fn(),
    deleteChannel: vi.fn(),
  },
}));

const mockChannels: Channel[] = [
  { id: '1', name: 'general', type: 'TEXT', createdAt: '', updatedAt: '' },
  { id: '2', name: 'random', type: 'TEXT', createdAt: '', updatedAt: '' },
  { id: '3', name: 'voice-room', type: 'VOICE', createdAt: '', updatedAt: '' },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useChannels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and return channels', async () => {
    vi.mocked(channelApi.getChannels).mockResolvedValue(mockChannels);

    const { result } = renderHook(() => useChannels(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.channels).toEqual(mockChannels);
    expect(channelApi.getChannels).toHaveBeenCalled();
  });

  it('should filter text channels', async () => {
    vi.mocked(channelApi.getChannels).mockResolvedValue(mockChannels);

    const { result } = renderHook(() => useChannels(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.textChannels).toEqual([
      { id: '1', name: 'general', type: 'TEXT', createdAt: '', updatedAt: '' },
      { id: '2', name: 'random', type: 'TEXT', createdAt: '', updatedAt: '' },
    ]);
  });

  it('should filter voice channels', async () => {
    vi.mocked(channelApi.getChannels).mockResolvedValue(mockChannels);

    const { result } = renderHook(() => useChannels(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.voiceChannels).toEqual([
      { id: '3', name: 'voice-room', type: 'VOICE', createdAt: '', updatedAt: '' },
    ]);
  });

  it('should return empty arrays when no channels', async () => {
    vi.mocked(channelApi.getChannels).mockResolvedValue([]);

    const { result } = renderHook(() => useChannels(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.channels).toEqual([]);
    expect(result.current.textChannels).toEqual([]);
    expect(result.current.voiceChannels).toEqual([]);
  });

  it('should create a channel and update cache', async () => {
    vi.mocked(channelApi.getChannels).mockResolvedValue(mockChannels);
    const newChannel: Channel = { id: '4', name: 'new-channel', type: 'TEXT', createdAt: '', updatedAt: '' };
    vi.mocked(channelApi.createChannel).mockResolvedValue(newChannel);

    const { result } = renderHook(() => useChannels(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.createChannel({ name: 'new-channel', type: 'TEXT' });

    expect(channelApi.createChannel).toHaveBeenCalledWith({ name: 'new-channel', type: 'TEXT' });
  });

  it('should delete a channel and update cache', async () => {
    vi.mocked(channelApi.getChannels).mockResolvedValue(mockChannels);
    vi.mocked(channelApi.deleteChannel).mockResolvedValue(undefined);

    const { result } = renderHook(() => useChannels(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.deleteChannel('1');

    expect(channelApi.deleteChannel).toHaveBeenCalledWith('1');
  });
});
