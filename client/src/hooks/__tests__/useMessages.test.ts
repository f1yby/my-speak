import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMessages } from '../useMessages';
import { messageApi, type Message } from '../../services/message-api';

vi.mock('../../services/message-api', () => ({
  messageApi: {
    getMessages: vi.fn(),
    createMessage: vi.fn(),
  },
}));

const mockMessages: Message[] = [
  { id: 'm1', channelId: 'ch1', authorName: 'alice', content: 'Hello', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'm2', channelId: 'ch1', authorName: 'bob', content: 'Hi', createdAt: '2024-01-01T00:01:00Z' },
];

describe('useMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch messages when channelId is provided', async () => {
    vi.mocked(messageApi.getMessages).mockResolvedValue(mockMessages);

    const { result } = renderHook(() => useMessages('ch1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(messageApi.getMessages).toHaveBeenCalledWith('ch1', { limit: 50 });
    expect(result.current.messages).toEqual(mockMessages);
  });

  it('should not fetch messages when channelId is undefined', () => {
    const { result } = renderHook(() => useMessages(undefined));

    expect(messageApi.getMessages).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should clear messages when channelId changes to undefined', async () => {
    vi.mocked(messageApi.getMessages).mockResolvedValue(mockMessages);

    const { result, rerender } = renderHook(
      ({ channelId }: { channelId: string | undefined }) => useMessages(channelId),
      { initialProps: { channelId: 'ch1' as string | undefined } }
    );

    await waitFor(() => {
      expect(result.current.messages).toEqual(mockMessages);
    });

    rerender({ channelId: undefined });

    expect(result.current.messages).toEqual([]);
  });

  it('should add a message with addMessage', async () => {
    vi.mocked(messageApi.getMessages).mockResolvedValue([]);

    const { result } = renderHook(() => useMessages('ch1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const newMessage: Message = {
      id: 'm3',
      channelId: 'ch1',
      authorName: 'charlie',
      content: 'New message',
      createdAt: '2024-01-01T00:02:00Z',
    };

    act(() => {
      result.current.addMessage(newMessage);
    });

    expect(result.current.messages).toEqual([newMessage]);
  });

  it('should clear messages with clearMessages', async () => {
    vi.mocked(messageApi.getMessages).mockResolvedValue(mockMessages);

    const { result } = renderHook(() => useMessages('ch1'));

    await waitFor(() => {
      expect(result.current.messages).toEqual(mockMessages);
    });

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
  });

  it('should handle fetch error gracefully', async () => {
    vi.mocked(messageApi.getMessages).mockRejectedValue(new Error('Network error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useMessages('ch1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.messages).toEqual([]);
    consoleSpy.mockRestore();
  });
});
