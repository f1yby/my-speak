import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LoginForm } from './components/auth/LoginForm';
import { SetupForm } from './components/auth/SetupForm';
import { ProtectedRoute, PublicRoute } from './components/auth/AuthGuard';
import { MainLayout } from './components/layout/MainLayout';

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/setup"
          element={<SetupForm />}
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
