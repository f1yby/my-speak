import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateChannelModal } from '../layout/CreateChannelModal';

describe('CreateChannelModal', () => {
  const defaultProps = {
    isOpen: true,
    defaultType: 'TEXT' as const,
    onClose: vi.fn(),
    onCreate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(<CreateChannelModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Create Channel')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(<CreateChannelModal {...defaultProps} />);

    expect(screen.getByText('Create Channel')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Channel name')).toBeInTheDocument();
  });

  it('should call onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateChannelModal {...defaultProps} />);

    await user.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should call onCreate with name and type on submit', async () => {
    const user = userEvent.setup();
    render(<CreateChannelModal {...defaultProps} />);

    await user.type(screen.getByPlaceholderText('Channel name'), 'my-channel');
    await user.click(screen.getByText('Create'));

    expect(defaultProps.onCreate).toHaveBeenCalledWith('my-channel', 'TEXT');
  });

  it('should not submit when name is empty', async () => {
    const user = userEvent.setup();
    render(<CreateChannelModal {...defaultProps} />);

    await user.click(screen.getByText('Create'));
    expect(defaultProps.onCreate).not.toHaveBeenCalled();
  });

  it('should allow switching channel type', async () => {
    const user = userEvent.setup();
    render(<CreateChannelModal {...defaultProps} />);

    await user.click(screen.getByLabelText(/Voice/));
    await user.type(screen.getByPlaceholderText('Channel name'), 'voice-room');
    await user.click(screen.getByText('Create'));

    expect(defaultProps.onCreate).toHaveBeenCalledWith('voice-room', 'VOICE');
  });
});
