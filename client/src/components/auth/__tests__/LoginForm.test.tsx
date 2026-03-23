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
  login: vi.fn(),
  isLoading: false,
  error: null as string | null,
  clearError: vi.fn(),
  isSetup: true as boolean | null,
  checkSetup: vi.fn(),
};

vi.mock('../../../stores/auth-store', () => ({
  useAuthStore: () => mockStore,
}));

import { LoginForm } from '../LoginForm';

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.login = vi.fn();
    mockStore.isLoading = false;
    mockStore.error = null;
    mockStore.clearError = vi.fn();
    mockStore.isSetup = true;
    mockStore.checkSetup = vi.fn();
    localStorage.clear();
  });

  it('should render login form when isSetup is true', () => {
    render(<LoginForm />);

    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByLabelText('Server Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Your Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter' })).toBeInTheDocument();
  });

  it('should show loading state when isSetup is null', () => {
    mockStore.isSetup = null;
    render(<LoginForm />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should navigate to /setup when isSetup is false', () => {
    mockStore.isSetup = false;
    render(<LoginForm />);

    expect(mockNavigate).toHaveBeenCalledWith('/setup');
  });

  it('should call checkSetup on mount', () => {
    render(<LoginForm />);

    expect(mockStore.checkSetup).toHaveBeenCalled();
  });

  it('should call login with form data on submit', async () => {
    mockStore.login.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Server Password'), 'mypassword');
    await user.type(screen.getByLabelText('Your Name'), 'testuser');
    await user.click(screen.getByRole('button', { name: 'Enter' }));

    expect(mockStore.clearError).toHaveBeenCalled();
    expect(mockStore.login).toHaveBeenCalledWith({
      password: 'mypassword',
      username: 'testuser',
    });
  });

  it('should navigate to / on successful login', async () => {
    mockStore.login.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Server Password'), 'pass');
    await user.type(screen.getByLabelText('Your Name'), 'user');
    await user.click(screen.getByRole('button', { name: 'Enter' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('should display error message when error exists', () => {
    mockStore.error = 'Invalid password';
    render(<LoginForm />);

    expect(screen.getByText('Invalid password')).toBeInTheDocument();
  });

  it('should show loading button text when isLoading', () => {
    mockStore.isLoading = true;
    render(<LoginForm />);

    expect(screen.getByRole('button', { name: 'Entering...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entering...' })).toBeDisabled();
  });

  it('should pre-fill username from localStorage', () => {
    localStorage.setItem('lastUsername', 'saveduser');
    render(<LoginForm />);

    expect(screen.getByLabelText('Your Name')).toHaveValue('saveduser');
  });

  it('should not navigate on login failure', async () => {
    mockStore.login.mockRejectedValue(new Error('fail'));
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Server Password'), 'wrong');
    await user.type(screen.getByLabelText('Your Name'), 'user');
    await user.click(screen.getByRole('button', { name: 'Enter' }));

    await waitFor(() => {
      expect(mockStore.login).toHaveBeenCalled();
    });
    // Navigate to '/' should NOT have been called after login failure
    expect(mockNavigate).not.toHaveBeenCalledWith('/');
  });
});
