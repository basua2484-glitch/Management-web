import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SecureLogin from '../components/SecureLogin';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, role, login } = useAuth();

  // If already authenticated with restored session, navigate to respective dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated && role) {
      const dest =
        role === 'ADMIN'
          ? '/admin-dashboard'
          : role === 'MANAGER'
          ? '/manager-dashboard'
          : '/staff-portal';
      navigate(dest, { replace: true });
    }
  }, [isAuthenticated, isLoading, role, navigate]);

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
