import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Eye, EyeOff, Info, UserPlus, LogIn, ShieldAlert } from 'lucide-react';
import type { AppUser } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: AppUser) => void;
  users: AppUser[];
  onSignupUser?: (userData: { name: string; username: string; password: string }) => { success: boolean; message: string };
  errorFlash?: string | null;
  onClearError?: () => void;
  onFlashMessage?: (message: string, type?: 'danger' | 'warning' | 'success' | 'info') => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  users,
  onSignupUser,
  errorFlash,
  onClearError,
  onFlashMessage,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  
  // Login Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Signup Form States
  const [signupName, setSignupName] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Local flash state
  const [flash, setFlash] = useState<{ message: string; type: 'danger' | 'warning' | 'success' | 'info' } | null>(
    errorFlash ? { message: errorFlash, type: 'danger' } : null
  );

  // Synchronize document title
  useEffect(() => {
    const originalTitle = document.title;
    document.title = activeTab === 'signup' 
      ? 'Staff Self Signup - Housekeeping Attendance System'
      : 'Login - Housekeeping Attendance System';
    return () => {
      document.title = originalTitle;
    };
  }, [activeTab]);

  const setLocalFlash = (message: string, type: 'danger' | 'warning' | 'success' | 'info') => {
    setFlash({ message, type });
    onFlashMessage?.(message, type);
  };

  // Route 2: Universal Login (Auto Redirection by Role & is_approved Security Check)
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onClearError) onClearError();

    const cleanInput = username.trim().toLowerCase();
    const cleanPass = password;

    // Lookup user by username or staff code aliases (e.g. hk101, hk-001)
    const matched = users.find((u) => {
      const uName = u.username.toLowerCase().trim();
      if (uName === cleanInput) return true;

      if (u.role === 'staff' && u.staffId) {
        const idStr = u.staffId.toString();
        const codePadded = `hk-${u.staffId.toString().padStart(3, '0')}`;
        const codeNum = `hk${(100 + u.staffId).toString()}`;
        const codeDirect = `hk${u.staffId}`;
        const codePaddedNoDash = `hk${u.staffId.toString().padStart(3, '0')}`;

        if (
          cleanInput === idStr ||
          cleanInput === codePadded ||
          cleanInput === codeNum ||
          cleanInput === codeDirect ||
          cleanInput === codePaddedNoDash
        ) {
          return true;
        }
      }
      return false;
    });

    if (!matched || matched.password !== cleanPass) {
      // flash("Galat Username ya Password!", "danger")
      setLocalFlash('Galat Username ya Password!', 'danger');
      return;
    }

    // Approval Check: if not user.is_approved
    if (matched.is_approved === false) {
      // flash("Aapka account abhi Admin approval ke liye pending hai.", "warning")
      setLocalFlash('Aapka account abhi Admin approval ke liye pending hai.', 'warning');
      return;
    }

    // Strict Role Redirection handled in onLoginSuccess:
    // if user.role in ['admin', 'manager']: admin_dashboard
    // else: staff_portal
    setFlash(null);
    onLoginSuccess(matched);
  };

  // Route 1: Staff Self Signup (Pending State)
  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onClearError) onClearError();

    const name = signupName.trim();
    const cleanUser = signupUsername.trim().toLowerCase();
    const pass = signupPassword;

    if (!name || !cleanUser || !pass) {
      setLocalFlash('Kripya sabhi fields bharein.', 'warning');
      return;
    }

    // Check if User.query.filter_by(username=username).first():
    const existing = users.find((u) => u.username.toLowerCase().trim() === cleanUser);
    if (existing) {
      // flash("Yeh Username pehle se registered hai!", "warning")
      setLocalFlash('Yeh Username pehle se registered hai!', 'warning');
      return;
    }

    if (onSignupUser) {
      const res = onSignupUser({
        name,
        username: signupUsername.trim(),
        password: pass,
      });

      if (!res.success) {
        setLocalFlash(res.message, 'warning');
        return;
      }
    }

    // Account banega par is_approved = False rahega
    // flash("Registration safal! Admin approval ke baad aap login kar paayenge.", "info")
    setLocalFlash('Registration safal! Admin approval ke baad aap login kar paayenge.', 'info');
    
    // Clear inputs and switch back to login tab with pre-filled username
    setUsername(signupUsername.trim());
    setPassword('');
    setSignupName('');
    setSignupUsername('');
    setSignupPassword('');
    setActiveTab('login');
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setFlash(null);
    if (onClearError) onClearError();
  };

  return (
    <div
      className="bg-[#f8f9fa] flex items-center justify-center min-h-screen px-4 py-8 antialiased"
      id="login-page-root"
    >
      <div
        className="bg-white border-0 shadow-2xl p-6 sm:p-8 rounded-3xl w-full max-w-[440px] transition-all"
        id="login-card"
        style={{ maxWidth: '440px', width: '100%' }}
      >
        {/* Header Bar */}
        <div className="text-center mb-5">
          <h3 className="text-2xl sm:text-[26px] font-bold text-[#0d6efd] tracking-tight mb-1">
            HK Ops Portal
          </h3>
          <p className="text-[#6c757d] text-xs sm:text-sm">
            {activeTab === 'login'
              ? 'Apna Username aur Password darj karein'
              : 'Staff Self-Registration (Pending Admin Approval)'}
          </p>
        </div>

        {/* Tab Toggle: Universal Login vs Staff Self Signup */}
        <div className="flex rounded-xl bg-slate-100 p-1 mb-5 border border-slate-200">
          <button
            type="button"
            id="tab-btn-login"
            onClick={() => {
              setActiveTab('login');
              setFlash(null);
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'login'
                ? 'bg-white text-[#0d6efd] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LogIn className="h-4 w-4" />
            <span>Universal Login</span>
          </button>

          <button
            type="button"
            id="tab-btn-signup"
            onClick={() => {
              setActiveTab('signup');
              setFlash(null);
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'signup'
                ? 'bg-white text-[#0d6efd] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            <span>Staff Self Signup</span>
          </button>
        </div>

        {/* Flask Flash Alert if any */}
        {flash && (
          <div
            className={`mb-4 flex items-start gap-2.5 rounded-xl border p-3 text-xs sm:text-sm font-medium shadow-xs transition-all animate-in fade-in ${
              flash.type === 'danger'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : flash.type === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : flash.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
            role="alert"
            id="flask-login-flash-alert"
          >
            {flash.type === 'danger' && <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />}
            {flash.type === 'warning' && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />}
            {flash.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />}
            {flash.type === 'info' && <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />}
            <span className="leading-snug">{flash.message}</span>
          </div>
        )}

        {activeTab === 'login' ? (
          /* ---------------- Universal Login Form (/login) ---------------- */
          <form onSubmit={handleLoginSubmit} method="POST" action="/login" className="w-full">
            <div className="mb-4">
              <label
                htmlFor="login-username"
                className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5"
              >
                Username / Staff ID
              </label>
              <input
                type="text"
                id="login-username"
                name="username"
                required
                placeholder="e.g. admin, manager, or hk101"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (flash) setFlash(null);
                }}
                autoComplete="username"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0d6efd] focus:outline-hidden focus:ring-3 focus:ring-[#0d6efd]/20 transition-all"
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="login-password"
                className="block text-xs sm:text-sm font-medium text-slate-800 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  name="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (flash) setFlash(null);
                  }}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0d6efd] focus:outline-hidden focus:ring-3 focus:ring-[#0d6efd]/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="btn-login-submit"
              className="w-full mt-2 py-2.5 px-4 bg-[#0d6efd] hover:bg-[#0b5ed7] active:bg-[#0a58ca] text-white font-bold text-sm tracking-wide rounded-lg shadow-sm hover:shadow transition-colors"
            >
              LOGIN
            </button>
          </form>
        ) : (
          /* ---------------- Staff Self Signup Form (/signup) ---------------- */
          <form onSubmit={handleSignupSubmit} method="POST" action="/signup" className="w-full">
            <div className="mb-3.5">
              <label
                htmlFor="signup-name"
                className="block text-xs sm:text-sm font-bold text-slate-800 mb-1"
              >
                Full Name *
              </label>
              <input
                type="text"
                id="signup-name"
                name="name"
                required
                placeholder="e.g. Vikram Joshi"
                value={signupName}
                onChange={(e) => {
                  setSignupName(e.target.value);
                  if (flash) setFlash(null);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0d6efd] focus:outline-hidden focus:ring-3 focus:ring-[#0d6efd]/20 transition-all"
              />
            </div>

            <div className="mb-3.5">
              <label
                htmlFor="signup-username"
                className="block text-xs sm:text-sm font-bold text-slate-800 mb-1"
              >
                Desired Username *
              </label>
              <input
                type="text"
                id="signup-username"
                name="username"
                required
                placeholder="e.g. vikramj"
                value={signupUsername}
                onChange={(e) => {
                  setSignupUsername(e.target.value);
                  if (flash) setFlash(null);
                }}
                autoComplete="username"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0d6efd] focus:outline-hidden focus:ring-3 focus:ring-[#0d6efd]/20 transition-all"
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="signup-password"
                className="block text-xs sm:text-sm font-medium text-slate-800 mb-1"
              >
                Password *
              </label>
              <div className="relative">
                <input
                  type={showSignupPassword ? 'text' : 'password'}
                  id="signup-password"
                  name="password"
                  required
                  placeholder="Create a password"
                  value={signupPassword}
                  onChange={(e) => {
                    setSignupPassword(e.target.value);
                    if (flash) setFlash(null);
                  }}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0d6efd] focus:outline-hidden focus:ring-3 focus:ring-[#0d6efd]/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignupPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 mb-4 text-2xs text-amber-800 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Self-registered accounts require verification &amp; approval by an Admin before login is allowed.</span>
            </div>

            <button
              type="submit"
              id="btn-signup-submit"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm tracking-wide rounded-lg shadow-sm hover:shadow transition-colors flex items-center justify-center gap-1.5"
            >
              <UserPlus className="h-4 w-4" />
              <span>REGISTER (PENDING APPROVAL)</span>
            </button>
          </form>
        )}

        {/* Quick Test Demo Helpers */}
        <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-center">
          <p className="text-slate-500 font-medium mb-2">
            Demo Credentials (1-Click Fill &amp; Test):
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              type="button"
              id="quick-demo-admin"
              onClick={() => handleQuickFill('admin', 'admin123')}
              className="flex flex-col items-center py-2 px-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-700 transition-all"
              title="Admin role -> Admin Dashboard"
            >
              <span className="font-bold text-[#0d6efd] text-2xs uppercase">Admin</span>
              <span className="font-mono text-[11px] text-slate-800">admin</span>
            </button>

            <button
              type="button"
              id="quick-demo-manager"
              onClick={() => handleQuickFill('manager', 'manager123')}
              className="flex flex-col items-center py-2 px-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-slate-700 transition-all"
              title="Manager role -> Admin Dashboard"
            >
              <span className="font-bold text-purple-600 text-2xs uppercase">Manager</span>
              <span className="font-mono text-[11px] text-slate-800">manager</span>
            </button>

            <button
              type="button"
              id="quick-demo-staff"
              onClick={() => handleQuickFill('hk101', 'staff123')}
              className="flex flex-col items-center py-2 px-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 transition-all"
              title="Approved Staff -> Punch Portal"
            >
              <span className="font-bold text-emerald-600 text-2xs uppercase">Staff</span>
              <span className="font-mono text-[11px] text-slate-800">hk101</span>
            </button>

            <button
              type="button"
              id="quick-demo-pending"
              onClick={() => handleQuickFill('rahul', 'password123')}
              className="flex flex-col items-center py-2 px-1 rounded-lg border border-amber-200 bg-amber-50/70 hover:bg-amber-100/70 hover:border-amber-400 text-amber-900 transition-all"
              title="Pending Approval Staff -> Triggers approval warning"
            >
              <span className="font-bold text-amber-700 text-2xs uppercase">Pending</span>
              <span className="font-mono text-[11px] text-slate-800">rahul</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2.5">
            Admin &amp; Manager &rarr; Admin Dashboard • Staff &rarr; Punch Portal • Pending &rarr; Approval Warning
          </p>
        </div>
      </div>
    </div>
  );
};
