import React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('userToken') || localStorage.getItem('user_token');
  const userRole = localStorage.getItem('userRole') || localStorage.getItem('user_role');

  // Case A: Agar user logged in nahi hai -> Send to Login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Case B: Agar role match nahi karta (e.g. Staff trying Admin URL) -> Access Denied / Default Redirect
  if (allowedRoles && allowedRoles.length > 0) {
    const currentUpper = (userRole || '').toUpperCase();
    const isAllowed = allowedRoles.some((role) => role.toUpperCase() === currentUpper);
    if (!isAllowed) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Case C: Authenticated & Authorized -> Render Page
  return <>{children}</>;
};

export default ProtectedRoute;
