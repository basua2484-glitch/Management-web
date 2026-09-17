import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Background4D } from './Background4D';
import { useAuth } from '../context/AuthContext';
import { AuthLoadingScreen } from './AuthLoadingScreen';
import { registerMasterAdmin } from '../services/firestoreService';
import { ShieldCheck, UserPlus, LogIn, Lock, Building, CheckCircle2 } from 'lucide-react';

export interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, role, login } = useAuth();

  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER_ADMIN'>('LOGIN');
  const [transform, setTransform] = useState('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
  
  // Login form state
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  
  // Master Admin Registration form state
  const [adminFullName, setAdminFullName] = useState('');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [securityPasskey, setSecurityPasskey] = useState('APEXCARE-HQ-2026');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If session is restoring, show loading state
  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  // If already authenticated, redirect to destination
  if (isAuthenticated && role) {
    const dest =
      role === 'ADMIN'
        ? '/admin/dashboard'
        : role === 'MANAGER'
        ? '/manager-dashboard'
        : role === 'SUPERVISOR'
        ? '/supervisor/dashboard'
        : '/staff/dashboard';
    return <Navigate to={dest} replace />;
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget.getBoundingClientRect();
    const cardX = e.clientX - card.left - card.width / 2;
    const cardY = e.clientY - card.top - card.height / 2;

    // Dynamic depth rotation
    const rotateX = (-cardY / card.height) * 14;
    const rotateY = (cardX / card.width) * 14;

    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`);
  };

  const handleMouseLeave = () => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
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

  const handleRegisterAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!adminFullName.trim() || !adminUsername.trim() || !adminPassword) {
      setError('Please fill in all mandatory fields.');
      return;
    }

    if (adminPassword.length < 6) {
      setError('Admin password must be at least 6 characters.');
      return;
    }

    if (adminPassword !== adminConfirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    if (!securityPasskey.trim()) {
      setError('Security Master Passkey is required to authorize Master Admin registration.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newAdmin = await registerMasterAdmin({
        fullName: adminFullName.trim(),
        username: adminUsername.trim().toLowerCase(),
        email: adminEmail.trim() || `${adminUsername.trim().toLowerCase()}@apexcare.internal`,
        phone: adminPhone.trim() || '+91-9876543210',
        password: adminPassword,
        department: 'Executive Administration & Operations',
        siteId: 'site-main',
        securityPasskey: securityPasskey.trim(),
      });

      setSuccessMsg('Master Admin registered successfully! Authorizing and redirecting...');

      // Auto login as new Master Admin
      setTimeout(async () => {
        try {
          await login(newAdmin.username, adminPassword, navigate, setError);
        } catch (err: any) {
          setError(err?.message || 'Login after registration failed.');
          setIsSubmitting(false);
        }
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Failed to register Master Admin into production database.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="login-page-root"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 font-sans p-4"
    >
      {/* 4D Background Particle Mesh */}
      <Background4D />

      {/* Interactive 3D/4D Card Container */}
      <div
        id="login-card-container"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ transform, transition: 'transform 0.15s ease-out' }}
        className="relative z-10 w-full max-w-lg p-6 sm:p-8 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-[0_0_50px_rgba(30,58,138,0.4)] transition-all duration-300"
      >
        {/* Holographic Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 rounded-t-2xl" />

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-600/20 border border-blue-400/30 mb-3 shadow-inner">
            <Building className="h-6 w-6 text-blue-300" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-sm">
            ApexCare Hospital Operations
          </h2>
          <p className="text-2xs uppercase tracking-widest text-blue-400 mt-1 font-mono font-bold">
            Live Production Portal • Geofence &amp; Attendance Engine
          </p>
        </div>

        {/* Tab Toggle: Sign In vs Register Master Admin */}
        <div className="grid grid-cols-2 gap-1 bg-black/40 p-1 rounded-xl border border-white/10 mb-5">
          <button
            type="button"
            id="tab-sign-in"
            onClick={() => {
              setActiveTab('LOGIN');
              setError('');
              setSuccessMsg('');
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'LOGIN'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            id="tab-register-admin"
            onClick={() => {
              setActiveTab('REGISTER_ADMIN');
              setError('');
              setSuccessMsg('');
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'REGISTER_ADMIN'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Register Master Admin</span>
          </button>
        </div>

        {error && (
          <div
            id="login-error-message"
            className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-semibold text-center backdrop-blur-md animate-in fade-in duration-200"
          >
            {error}
          </div>
        )}

        {successMsg && (
          <div
            id="login-success-message"
            className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs font-semibold text-center backdrop-blur-md flex items-center justify-center gap-2 animate-in fade-in duration-200"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab 1: Sign In Form */}
        {activeTab === 'LOGIN' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4" id="login-form-4d">
            <div>
              <label className="block text-2xs uppercase tracking-wider text-slate-400 mb-1.5 font-mono font-bold">
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
                placeholder="e.g. admin or staff ID"
                autoComplete="username"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-2xs uppercase tracking-wider text-slate-400 mb-1.5 font-mono font-bold">
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
                className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all font-mono text-sm"
              />
            </div>

            <button
              type="submit"
              id="submit-login-btn"
              disabled={isSubmitting}
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-md hover:shadow-blue-500/30 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 cursor-pointer text-sm"
            >
              {isSubmitting ? 'AUTHENTICATING...' : 'SIGN IN TO PORTAL'}
            </button>
          </form>
        )}

        {/* Tab 2: Register Master Admin Form */}
        {activeTab === 'REGISTER_ADMIN' && (
          <form onSubmit={handleRegisterAdminSubmit} className="space-y-3.5" id="register-master-admin-form">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs uppercase tracking-wider text-slate-400 mb-1 font-mono font-bold">
                  Admin Full Name *
                </label>
                <input
                  type="text"
                  id="admin-fullname-input"
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Sharma"
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 text-xs"
                />
              </div>

              <div>
                <label className="block text-2xs uppercase tracking-wider text-slate-400 mb-1 font-mono font-bold">
                  Username *
                </label>
                <input
                  type="text"
                  id="admin-username-input"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="e.g. admin"
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs uppercase tracking-wider text-slate-400 mb-1 font-mono font-bold">
                  Official Email
                </label>
                <input
                  type="email"
                  id="admin-email-input"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@hospital.org"
                  className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 text-xs"
                />
              </div>

              <div>
                <label className="block text-2xs uppercase tracking-wider text-slate-400 mb-1 font-mono font-bold">
                  Mobile / Phone
                </label>
                <input
                  type="tel"
                  id="admin-phone-input"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  placeholder="+91-9876543210"
                  className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs uppercase tracking-wider text-slate-400 mb-1 font-mono font-bold">
                  Password *
                </label>
                <input
                  type="password"
                  id="admin-password-input"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-2xs uppercase tracking-wider text-slate-400 mb-1 font-mono font-bold">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  id="admin-confirm-password-input"
                  value={adminConfirmPassword}
                  onChange={(e) => setAdminConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-2xs uppercase tracking-wider text-slate-400 font-mono font-bold">
                  Security Master Passkey *
                </label>
                <span className="text-3xs text-indigo-400 font-mono">Hospital Authorization Key</span>
              </div>
              <input
                type="text"
                id="admin-passkey-input"
                value={securityPasskey}
                onChange={(e) => setSecurityPasskey(e.target.value)}
                placeholder="Enter facility authorization key"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-indigo-500/40 text-indigo-200 placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 font-mono text-xs"
              />
            </div>

            <button
              type="submit"
              id="submit-register-admin-btn"
              disabled={isSubmitting}
              className="w-full py-2.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold shadow-md hover:shadow-indigo-500/30 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 cursor-pointer text-xs"
            >
              {isSubmitting ? 'PROVISIONING MASTER ADMIN...' : 'CREATE MASTER ADMIN & PROCEED'}
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-white/10 text-center flex items-center justify-between text-3xs text-slate-400 font-mono">
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3 w-3 text-slate-400" />
            <span>256-Bit Encrypted Production</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            <span>GPS Geofence Protected</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
