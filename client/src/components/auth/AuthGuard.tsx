import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, checkSetup, isSetup } = useAuthStore();
  
  useEffect(() => {
    checkSetup();
  }, [checkSetup]);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (isSetup === false) {
    return <Navigate to="/setup" replace />;
  }
  
  return <>{children}</>;
}

interface PublicRouteProps {
  children: React.ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}
