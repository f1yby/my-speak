import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock AudioSettings to avoid complex audio API dependencies
vi.mock('../AudioSettings', () => ({
  AudioSettings: () => <div data-testid="audio-settings">Audio Settings Content</div>,
}));

import { Settings } from '../Settings';

describe('Settings', () => {
  it('should render settings modal', () => {
    render(<Settings onClose={vi.fn()} />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Audio Settings')).toBeInTheDocument();
    expect(screen.getByTestId('audio-settings')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Settings onClose={onClose} />);

    // X button
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
