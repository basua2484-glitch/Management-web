import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  // 1. Wait for the auth restoration check before redirecting to /login
  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-[#0D0D0E] flex flex-col items-center justify-center text-slate-300 font-sans p-4 select-none relative overflow-hidden"
        id="auth-loading-screen"
      >
        {/* Subtle background glow */}
        <div className="absolute w-72 h-72 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

        <div className="relative flex items-center justify-center mb-5 z-10">
          <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-blue-500 animate-spin" />
          <div className="absolute w-4 h-4 rounded-full bg-blue-500/40 blur-sm" />
        </div>

        <p className="text-xs font-mono uppercase tracking-widest text-slate-400 font-semibold z-10">
          Restoring Secure Session...
        </p>
      </div>
    );
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
