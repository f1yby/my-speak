import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock dependencies
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ channelId: 'ch1' }),
}));

vi.mock('../../../stores/auth-store', () => ({
  useAuthStore: () => ({
    user: { username: 'testuser' },
    logout: vi.fn(),
  }),
}));

const mockChannels = [
  { id: 'ch1', name: 'general', type: 'TEXT', createdAt: '', updatedAt: '' },
  { id: 'ch2', name: 'random', type: 'TEXT', createdAt: '', updatedAt: '' },
  { id: 'ch3', name: 'voice', type: 'VOICE', createdAt: '', updatedAt: '' },
];

vi.mock('../../../hooks/useChannels', () => ({
  useChannels: () => ({
    channels: mockChannels,
    textChannels: mockChannels.filter((c) => c.type === 'TEXT'),
    voiceChannels: mockChannels.filter((c) => c.type === 'VOICE'),
    isLoading: false,
    createChannel: vi.fn().mockResolvedValue({ id: 'ch4', name: 'new', type: 'TEXT' }),
    deleteChannel: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../../../hooks/useMessages', () => ({
  useMessages: () => ({
    messages: [
      { id: 'm1', channelId: 'ch1', authorName: 'alice', content: 'Hello', createdAt: '2024-01-01T00:00:00Z' },
    ],
    addMessage: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useSocket', () => ({
  useSocket: () => ({
    socket: null,
    isReconnecting: false,
    onNewMessage: vi.fn(() => vi.fn()),
    joinChannel: vi.fn(),
    sendMessage: vi.fn(),
    setReconnectCallback: vi.fn(),
    leaveChannel: vi.fn(),
  }),
}));

// Mock VoiceChannel to avoid WebRTC
vi.mock('../../voice/VoiceChannel', () => ({
  VoiceChannel: () => <div data-testid="voice-channel">VoiceChannel</div>,
}));

// Mock Settings to avoid AudioSettings
vi.mock('../../settings/Settings', () => ({
  Settings: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="settings">
      <button onClick={onClose}>Close Settings</button>
    </div>
  ),
}));

import { MainLayout } from '../MainLayout';

describe('MainLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render the layout with sidebar and content', () => {
    render(<MainLayout />);

    expect(screen.getByText('My-Speak')).toBeInTheDocument();
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getAllByText('general').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('random')).toBeInTheDocument();
  });

  it('should render messages in the message area', () => {
    render(<MainLayout />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('should have a logout button', () => {
    render(<MainLayout />);

    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('should call logout and navigate on logout click', async () => {
    const user = userEvent.setup();
    render(<MainLayout />);

    await user.click(screen.getByText('Logout'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
