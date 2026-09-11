import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLoadingScreen } from './AuthLoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  // 1. Loading guard: Wait for authentication state initialization or session restoration
  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  // 2. Case A: Not authenticated -> Redirect to /login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Case B: Role does not match -> Redirect to /unauthorized
  if (allowedRoles && allowedRoles.length > 0) {
    const currentUpper = (role || '').toUpperCase();
    const isAllowed = allowedRoles.some((r) => r.toUpperCase() === currentUpper);
    if (!isAllowed) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // 4. Case C: Authenticated & Authorized -> Render Page
  return <>{children}</>;
};

export default ProtectedRoute;
