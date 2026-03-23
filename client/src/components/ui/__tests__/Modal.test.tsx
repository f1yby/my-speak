import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../Modal';

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
  };

  it('should not render when isOpen is false', () => {
    render(
      <Modal {...defaultProps} isOpen={false}>
        <div>Content</div>
      </Modal>
    );
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(
      <Modal {...defaultProps}>
        <div>Content</div>
      </Modal>
    );
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should call onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal {...defaultProps} onClose={onClose}>
        <div>Content</div>
      </Modal>
    );

    // The backdrop is the first child with bg-black class
    const backdrop = document.querySelector('.bg-black.bg-opacity-75');
    if (backdrop) {
      await user.click(backdrop as Element);
    }
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal {...defaultProps} onClose={onClose}>
        <div>Content</div>
      </Modal>
    );

    // Close button is a button within the header
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('should not call onClose when modal content is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal {...defaultProps} onClose={onClose}>
        <div>Content</div>
      </Modal>
    );

    await user.click(screen.getByText('Content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should render children', () => {
    render(
      <Modal {...defaultProps}>
        <p>Custom child content</p>
      </Modal>
    );
    expect(screen.getByText('Custom child content')).toBeInTheDocument();
  });
});
