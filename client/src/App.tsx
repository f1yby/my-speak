import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';
import { LoginForm } from './components/auth/LoginForm';
import { SetupForm } from './components/auth/SetupForm';
import { ProtectedRoute, PublicRoute } from './components/auth/AuthGuard';
import { MainLayout } from './components/layout/MainLayout';

function App() {
  const hydrated = useAuthStore((state) => state._hydrated);
  const isSetup = useAuthStore((state) => state.isSetup);
  const checkSetup = useAuthStore((state) => state.checkSetup);

  useEffect(() => {
    if (hydrated && isSetup === null) {
      checkSetup();
    }
  }, [hydrated, isSetup, checkSetup]);

  if (!hydrated || isSetup === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isSetup) {
    return (
      <Router>
        <Routes>
          <Route path="/setup" element={<SetupForm />} />
          <Route path="*" element={<Navigate to="/setup" replace />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/setup"
          element={<Navigate to="/login" replace />}
        />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginForm />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        />
        <Route
          path="/channels/:channelId"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={<div className="text-white p-8">404 - Page Not Found</div>}
        />
      </Routes>
    </Router>
  );
}

export default App;
