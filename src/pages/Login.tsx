import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import SecureLogin from '../components/SecureLogin';
import { useAuth } from '../context/AuthContext';
import { AuthLoadingScreen } from '../components/AuthLoadingScreen';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, role, login } = useAuth();

  // 1. Guard against rendering login screen or redirecting during session restoration
  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  // 2. If already authenticated with restored session, immediately route to destination
  if (isAuthenticated && role) {
    const dest =
      role === 'ADMIN'
        ? '/admin-dashboard'
        : role === 'MANAGER'
        ? '/manager-dashboard'
        : '/staff-portal';
    return <Navigate to={dest} replace />;
  }

  const handleLoginSubmit = async (
    staffId: string,
    password: string,
    setError: (msg: string) => void
  ) => {
    await login(staffId, password, navigate, setError);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-[#0D0D0E] font-sans antialiased text-slate-100 dot-grid relative"
      id="login-page-root"
    >
      <SecureLogin onLogin={handleLoginSubmit} />
    </div>
  );
};

export default Login;
