import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageArea } from '../layout/MessageArea';
import type { Channel } from '../../services/channel-api';
import type { Message } from '../../services/message-api';

const mockTextChannel: Channel = { id: '1', name: 'general', type: 'TEXT', createdAt: '', updatedAt: '' };
const mockVoiceChannel: Channel = { id: '2', name: 'voice', type: 'VOICE', createdAt: '', updatedAt: '' };

const mockMessages: Message[] = [
  { id: 'm1', channelId: '1', authorName: 'alice', content: 'Hello!', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'm2', channelId: '1', authorName: 'bob', content: 'Hi there!', createdAt: '2024-01-01T00:01:00Z' },
];

describe('MessageArea', () => {
  const defaultProps = {
    currentChannel: mockTextChannel,
    messages: mockMessages,
    newMessage: '',
    onNewMessageChange: vi.fn(),
    onSendMessage: vi.fn(),
    channelCount: 2,
    onCreateChannel: vi.fn(),
  };

  it('should render messages for text channel', () => {
    render(<MessageArea {...defaultProps} />);

    expect(screen.getByText('Hello!')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('should show empty message when no messages', () => {
    render(<MessageArea {...defaultProps} messages={[]} />);

    expect(screen.getByText('No messages yet. Start the conversation!')).toBeInTheDocument();
  });

  it('should show voice channel placeholder', () => {
    render(<MessageArea {...defaultProps} currentChannel={mockVoiceChannel} />);

    expect(screen.getByText(/Voice Channel: voice/)).toBeInTheDocument();
  });

  it('should show no channels message when channel count is 0', () => {
    render(<MessageArea {...defaultProps} currentChannel={null} channelCount={0} />);

    expect(screen.getByText('No channels yet')).toBeInTheDocument();
    expect(screen.getByText('Create First Channel')).toBeInTheDocument();
  });

  it('should call onSendMessage on form submit', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn((e) => e.preventDefault());
    render(<MessageArea {...defaultProps} newMessage="test" onSendMessage={onSendMessage} />);

    await user.click(screen.getByText('Send'));
    expect(onSendMessage).toHaveBeenCalled();
  });
});
