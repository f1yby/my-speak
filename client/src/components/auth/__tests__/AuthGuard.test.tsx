import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  Navigate: ({ to, replace }: { to: string; replace?: boolean }) => (
    <div data-testid="navigate" data-to={to} data-replace={replace?.toString()}>
      Navigating to {to}
    </div>
  ),
}));

// Track the selector callback used by useAuthStore
let mockIsAuthenticated = false;

vi.mock('../../../stores/auth-store', () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean }) => boolean) =>
    selector({ isAuthenticated: mockIsAuthenticated }),
}));

import { ProtectedRoute, PublicRoute } from '../AuthGuard';

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = false;
  });

  describe('ProtectedRoute', () => {
    it('should render children when authenticated', () => {
      mockIsAuthenticated = true;
      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should redirect to /login when not authenticated', () => {
      mockIsAuthenticated = false;
      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      const nav = screen.getByTestId('navigate');
      expect(nav).toHaveAttribute('data-to', '/login');
      expect(nav).toHaveAttribute('data-replace', 'true');
    });
  });

  describe('PublicRoute', () => {
    it('should render children when not authenticated', () => {
      mockIsAuthenticated = false;
      render(
        <PublicRoute>
          <div>Public Content</div>
        </PublicRoute>
      );

      expect(screen.getByText('Public Content')).toBeInTheDocument();
    });

    it('should redirect to / when authenticated', () => {
      mockIsAuthenticated = true;
      render(
        <PublicRoute>
          <div>Public Content</div>
        </PublicRoute>
      );

      expect(screen.queryByText('Public Content')).not.toBeInTheDocument();
      const nav = screen.getByTestId('navigate');
      expect(nav).toHaveAttribute('data-to', '/');
      expect(nav).toHaveAttribute('data-replace', 'true');
    });
  });
});
