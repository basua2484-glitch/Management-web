import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Background4D } from './Background4D';
import { useAuth } from '../context/AuthContext';
import { AuthLoadingScreen } from './AuthLoadingScreen';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, role, login } = useAuth();

  const [transform, setTransform] = useState('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If session is restoring, show loading state
  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  // If already authenticated, redirect to destination
  if (isAuthenticated && role) {
    const dest =
      role === 'ADMIN'
        ? '/admin-dashboard'
        : role === 'MANAGER'
        ? '/manager-dashboard'
        : '/staff-portal';
    return <Navigate to={dest} replace />;
  }

  const handleMouseMove = (e) => {
    const card = e.currentTarget.getBoundingClientRect();
    const cardX = e.clientX - card.left - card.width / 2;
    const cardY = e.clientY - card.top - card.height / 2;

    // 4D-like dynamic depth rotation calculation
    const rotateX = (-cardY / card.height) * 20;
    const rotateY = (cardX / card.width) * 20;

    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`);
  };

  const handleMouseLeave = () => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!staffId.trim() || !password) {
      setError('Please enter your Staff ID / Username and Password.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await login(staffId.trim(), password, navigate, setError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="login-page-root"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black font-sans p-4"
    >
      {/* 4D Background Particle Mesh */}
      <Background4D />

      {/* Interactive 3D/4D Card Container */}
      <div
        id="login-card-container"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ transform, transition: 'transform 0.15s ease-out' }}
        className="relative z-10 w-full max-w-md p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_0_50px_rgba(59,130,246,0.3)] transition-all duration-300"
      >
        {/* Holographic Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-t-2xl animate-pulse" />

        <div className="text-center mb-6">
          <h2 className="text-2xl font-extrabold tracking-wider text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">
            ApexCare Hospital Operations
          </h2>
          <p className="text-xs uppercase tracking-widest text-blue-400 mt-2 font-mono">
            Housekeeping Portal 4D Security
          </p>
        </div>

        {error && (
          <div
            id="login-error-message"
            className="mb-5 p-3 rounded-lg bg-rose-950/70 border border-rose-500/50 text-rose-300 text-xs font-semibold text-center backdrop-blur-md"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" id="login-form-4d">
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-2 font-mono">
              Staff ID / Username
            </label>
            <input
              type="text"
              id="staff-id-input"
              value={staffId}
              onChange={(e) => {
                setStaffId(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. admin"
              autoComplete="username"
              required
              className="w-full px-4 py-3 rounded-lg bg-black/50 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-2 font-mono">
              Password
            </label>
            <input
              type="password"
              id="password-input"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="w-full px-4 py-3 rounded-lg bg-black/50 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 transition-all font-mono text-sm"
            />
          </div>

          <button
            type="submit"
            id="submit-login-btn"
            disabled={isSubmitting}
            className="w-full py-3 px-6 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:shadow-[0_0_30px_rgba(59,130,246,0.8)] transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 cursor-pointer text-sm"
          >
            {isSubmitting ? 'AUTHENTICATING...' : 'SIGN IN TO PORTAL'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <span className="text-[10px] tracking-widest text-gray-500 uppercase font-mono">
            Authorized Hospital Personnel Only
          </span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
