import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChannelSidebar } from '../layout/ChannelSidebar';
import type { Channel } from '../../services/channel-api';

const mockTextChannels: Channel[] = [
  { id: '1', name: 'general', type: 'TEXT', createdAt: '', updatedAt: '' },
  { id: '2', name: 'random', type: 'TEXT', createdAt: '', updatedAt: '' },
];

const mockVoiceChannels: Channel[] = [
  { id: '3', name: 'voice-room', type: 'VOICE', createdAt: '', updatedAt: '' },
];

describe('ChannelSidebar', () => {
  const defaultProps = {
    textChannels: mockTextChannels,
    voiceChannels: mockVoiceChannels,
    currentChannelId: '1',
    voiceChannelId: null,
    onSelectChannel: vi.fn(),
    onDeleteChannel: vi.fn(),
    onCreateTextChannel: vi.fn(),
    onCreateVoiceChannel: vi.fn(),
  };

  it('should render text and voice channels', () => {
    render(<ChannelSidebar {...defaultProps} />);

    expect(screen.getByText('general')).toBeInTheDocument();
    expect(screen.getByText('random')).toBeInTheDocument();
    expect(screen.getByText('voice-room')).toBeInTheDocument();
  });

  it('should call onSelectChannel when channel is clicked', async () => {
    const user = userEvent.setup();
    render(<ChannelSidebar {...defaultProps} />);

    await user.click(screen.getByText('random'));
    expect(defaultProps.onSelectChannel).toHaveBeenCalledWith(mockTextChannels[1]);
  });

  it('should call onCreateTextChannel when text + button is clicked', async () => {
    const user = userEvent.setup();
    render(<ChannelSidebar {...defaultProps} />);

    const addButtons = screen.getAllByText('+');
    await user.click(addButtons[0]); // First + is for Text
    expect(defaultProps.onCreateTextChannel).toHaveBeenCalled();
  });

  it('should call onCreateVoiceChannel when voice + button is clicked', async () => {
    const user = userEvent.setup();
    render(<ChannelSidebar {...defaultProps} />);

    const addButtons = screen.getAllByText('+');
    await user.click(addButtons[1]); // Second + is for Voice
    expect(defaultProps.onCreateVoiceChannel).toHaveBeenCalled();
  });
});
