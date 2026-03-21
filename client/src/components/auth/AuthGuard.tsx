import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, checkSetup, isSetup, isHydrated, setHydrated } = useAuthStore();
  
  useEffect(() => {
    setHydrated();
    checkSetup();
  }, [checkSetup, setHydrated]);
  
  if (!isHydrated) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }
  
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
  const { isAuthenticated, isHydrated, setHydrated } = useAuthStore();

  useEffect(() => {
    setHydrated();
  }, [setHydrated]);

  if (!isHydrated) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}
