import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock socket.io-client
const mockOn = vi.fn();
const mockOff = vi.fn();
const mockEmit = vi.fn();
const mockDisconnect = vi.fn();

const mockSocket = {
  on: mockOn,
  off: mockOff,
  emit: mockEmit,
  disconnect: mockDisconnect,
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

import { useSocket } from '../useSocket';

describe('useSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should not create socket when no token in localStorage', () => {
    const { result } = renderHook(() => useSocket());

    expect(result.current.socket).toBeNull();
  });

  it('should create socket when token exists', async () => {
    localStorage.setItem('token', 'test-token');

    const { result } = renderHook(() => useSocket());

    // Socket should be set after effect runs
    expect(result.current.socket).toBeDefined();
  });

  it('should register event listeners on connect/disconnect/reconnect', () => {
    localStorage.setItem('token', 'test-token');

    renderHook(() => useSocket());

    expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('reconnect', expect.any(Function));
  });

  it('should disconnect socket on unmount', () => {
    localStorage.setItem('token', 'test-token');

    const { unmount } = renderHook(() => useSocket());
    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('joinChannel should emit channel:join', () => {
    localStorage.setItem('token', 'test-token');

    const { result } = renderHook(() => useSocket());

    act(() => {
      result.current.joinChannel('ch1');
    });

    expect(mockEmit).toHaveBeenCalledWith('channel:join', 'ch1');
  });

  it('leaveChannel should emit channel:leave', () => {
    localStorage.setItem('token', 'test-token');

    const { result } = renderHook(() => useSocket());

    act(() => {
      result.current.leaveChannel();
    });

    expect(mockEmit).toHaveBeenCalledWith('channel:leave');
  });

  it('sendMessage should emit message:send', () => {
    localStorage.setItem('token', 'test-token');

    const { result } = renderHook(() => useSocket());

    act(() => {
      result.current.sendMessage('ch1', 'Hello');
    });

    expect(mockEmit).toHaveBeenCalledWith('message:send', {
      channelId: 'ch1',
      content: 'Hello',
    });
  });

  it('onNewMessage should register and return cleanup for message:new event', () => {
    localStorage.setItem('token', 'test-token');

    const { result } = renderHook(() => useSocket());

    const handler = vi.fn();
    let cleanup: () => void;

    act(() => {
      cleanup = result.current.onNewMessage(handler);
    });

    expect(mockOn).toHaveBeenCalledWith('message:new', handler);

    act(() => {
      cleanup();
    });

    expect(mockOff).toHaveBeenCalledWith('message:new', handler);
  });

  it('setReconnectCallback should set callback', () => {
    localStorage.setItem('token', 'test-token');

    const { result } = renderHook(() => useSocket());
    const cb = vi.fn();

    act(() => {
      result.current.setReconnectCallback(cb);
    });

    // Simulate connect event to trigger callback
    const connectHandler = mockOn.mock.calls.find(
      (call: [string, Function]) => call[0] === 'connect'
    )?.[1];
    if (connectHandler) {
      connectHandler();
    }

    expect(cb).toHaveBeenCalled();
  });
});
