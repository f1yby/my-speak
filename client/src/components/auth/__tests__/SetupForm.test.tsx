import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock auth store
const mockStore = {
  setup: vi.fn(),
  isLoading: false,
  error: null as string | null,
  clearError: vi.fn(),
};

vi.mock('../../../stores/auth-store', () => ({
  useAuthStore: () => mockStore,
}));

import { SetupForm } from '../SetupForm';

describe('SetupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.setup = vi.fn();
    mockStore.isLoading = false;
    mockStore.error = null;
    mockStore.clearError = vi.fn();
  });

  it('should render setup form', () => {
    render(<SetupForm />);

    expect(screen.getByText('Server Setup')).toBeInTheDocument();
    expect(screen.getByLabelText('Server Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete Setup' })).toBeInTheDocument();
  });

  it('should show validation error when password is too short', async () => {
    const user = userEvent.setup();
    render(<SetupForm />);

    await user.type(screen.getByLabelText('Server Password'), 'short');
    await user.type(screen.getByLabelText('Confirm Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Complete Setup' }));

    expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
    expect(mockStore.setup).not.toHaveBeenCalled();
  });

  it('should show validation error when passwords do not match', async () => {
    const user = userEvent.setup();
    render(<SetupForm />);

    await user.type(screen.getByLabelText('Server Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm Password'), 'different123');
    await user.click(screen.getByRole('button', { name: 'Complete Setup' }));

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(mockStore.setup).not.toHaveBeenCalled();
  });

  it('should call setup with password on valid submission', async () => {
    mockStore.setup.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SetupForm />);

    await user.type(screen.getByLabelText('Server Password'), 'validpass');
    await user.type(screen.getByLabelText('Confirm Password'), 'validpass');
    await user.click(screen.getByRole('button', { name: 'Complete Setup' }));

    expect(mockStore.clearError).toHaveBeenCalled();
    expect(mockStore.setup).toHaveBeenCalledWith({ password: 'validpass' });
  });

  it('should navigate to /login on successful setup', async () => {
    mockStore.setup.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SetupForm />);

    await user.type(screen.getByLabelText('Server Password'), 'validpass');
    await user.type(screen.getByLabelText('Confirm Password'), 'validpass');
    await user.click(screen.getByRole('button', { name: 'Complete Setup' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('should display store error when present', () => {
    mockStore.error = 'Server already configured';
    render(<SetupForm />);

    expect(screen.getByText('Server already configured')).toBeInTheDocument();
  });

  it('should show loading button text when isLoading', () => {
    mockStore.isLoading = true;
    render(<SetupForm />);

    expect(screen.getByRole('button', { name: 'Setting up...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Setting up...' })).toBeDisabled();
  });

  it('should not navigate on setup failure', async () => {
    mockStore.setup.mockRejectedValue(new Error('fail'));
    const user = userEvent.setup();
    render(<SetupForm />);

    await user.type(screen.getByLabelText('Server Password'), 'validpass');
    await user.type(screen.getByLabelText('Confirm Password'), 'validpass');
    await user.click(screen.getByRole('button', { name: 'Complete Setup' }));

    await waitFor(() => {
      expect(mockStore.setup).toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/login');
  });
});
