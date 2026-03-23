import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock zustand store
let mockState = {
  _hydrated: true,
  isSetup: true as boolean | null,
  isAuthenticated: false,
  checkSetup: vi.fn(),
};

vi.mock('../stores/auth-store', () => ({
  useAuthStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

// Mock child components
vi.mock('../components/auth/LoginForm', () => ({
  LoginForm: () => <div data-testid="login-form">LoginForm</div>,
}));

vi.mock('../components/auth/SetupForm', () => ({
  SetupForm: () => <div data-testid="setup-form">SetupForm</div>,
}));

vi.mock('../components/layout/MainLayout', () => ({
  MainLayout: () => <div data-testid="main-layout">MainLayout</div>,
}));

vi.mock('../components/auth/AuthGuard', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PublicRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import App from '../App';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      _hydrated: true,
      isSetup: true,
      isAuthenticated: false,
      checkSetup: vi.fn(),
    };
  });

  it('should show loading when not hydrated', () => {
    mockState._hydrated = false;
    mockState.isSetup = null;
    render(<App />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show loading when isSetup is null and hydrated', () => {
    mockState._hydrated = true;
    mockState.isSetup = null;
    render(<App />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(mockState.checkSetup).toHaveBeenCalled();
  });

  it('should render SetupForm when isSetup is false', () => {
    mockState.isSetup = false;
    render(<App />);

    expect(screen.getByTestId('setup-form')).toBeInTheDocument();
  });

  it('should render login route when isSetup is true', () => {
    mockState.isSetup = true;
    // Default: renders the /login route with LoginForm via BrowserRouter
    render(<App />);

    // App should not show Loading when hydrated and isSetup is known
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
});
