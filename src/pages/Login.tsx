import React from 'react';
import { useNavigate } from 'react-router-dom';
import SecureLogin from '../components/SecureLogin';
import { handleLogin } from '../services/auth';

const Login: React.FC = () => {
  const navigate = useNavigate();

  const handleLoginSubmit = async (
    staffId: string,
    password: string,
    setError: (msg: string) => void
  ) => {
    handleLogin(staffId, password, navigate, setError);
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
