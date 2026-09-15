import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Eye, EyeOff, Info, LogIn, Lock, ShieldCheck, Hospital } from 'lucide-react';
import type { AppUser } from '../types';
import { USERS_DB } from '../services/auth';

interface LoginViewProps {
  onLoginSuccess: (user: AppUser, redirectUrl?: string) => void;
  users: AppUser[];
  errorFlash?: string | null;
  onClearError?: () => void;
  onFlashMessage?: (message: string, type?: 'danger' | 'warning' | 'success' | 'info') => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  users,
  errorFlash,
  onClearError,
  onFlashMessage,
}) => {
  // Login Form States (matching Flask /login)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Local flash state matching Flask get_flashed_messages(with_categories=true)
  const [flash, setFlash] = useState<{ message: string; type: 'danger' | 'warning' | 'success' | 'info' } | null>(
    errorFlash ? { message: errorFlash, type: 'danger' } : null
  );

  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'Universal Login - Housekeeping Secure Portal';
    return () => {
      document.title = originalTitle;
    };
  }, []);

  const setLocalFlash = (message: string, type: 'danger' | 'warning' | 'success' | 'info') => {
    setFlash({ message, type });
    onFlashMessage?.(message, type);
  };

  // 1. Universal Login Route matching @app.route('/login', methods=['GET', 'POST'])
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onClearError) onClearError();

    const cleanInput = username.trim().toLowerCase();
    const cleanNormalized = cleanInput.replace(/[-_\s]/g, '');
    const cleanPass = password;

    // 1. Credentials Verification against USERS_DB
    const dbUser = USERS_DB.find(
      (u) => u.id.toLowerCase() === cleanInput && u.pass === cleanPass
    );

    // 2. User lookup: User.query.filter_by(staff_id=staff_id).first() OR username
    const matched = users.find((u) => {
      // 1. Direct staff_id match (e.g. HK-001)
      if (u.staff_id) {
        const sid = u.staff_id.toLowerCase().trim();
        const sidNorm = sid.replace(/[-_\s]/g, '');
        if (sid === cleanInput || sidNorm === cleanNormalized) return true;
      }

      // 2. Username match
      if (u.username && u.username.toLowerCase().trim() === cleanInput) return true;

      // 3. Staff ID numeric codes like HK-001, hk001, hk101
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

    if (dbUser) {
      setFlash(null);
      const appUser: AppUser = matched || {
        id: dbUser.id === 'admin' ? 1 : dbUser.id === 'manager' ? 2 : 3,
        username: dbUser.id,
        name: dbUser.id === 'admin' ? 'ApexCare Admin' : dbUser.id === 'manager' ? 'Operations Manager' : 'Staff Member (' + dbUser.id.toUpperCase() + ')',
        full_name: dbUser.id === 'admin' ? 'ApexCare Admin' : dbUser.id === 'manager' ? 'Operations Manager' : 'Staff Member (' + dbUser.id.toUpperCase() + ')',
        role: dbUser.role.toLowerCase() as 'admin' | 'manager' | 'staff',
        duty_type: 'FIXED',
        fixed_department: dbUser.role === 'STAFF' ? 'General Ward' : 'Hospital Wide',
        is_temp_reliever: false,
        temp_department: null,
        assigned_shift: '7-3',
        password: dbUser.pass,
        password_hash: `pbkdf2:sha256:600000$vault_salt$${dbUser.id}`,
        raw_password_vault: dbUser.pass,
        status: 'ACTIVE',
        is_approved: true,
        staff_id: dbUser.id.toUpperCase(),
        staffId: dbUser.role === 'STAFF' ? 1 : undefined,
        assigned_area: dbUser.role === 'STAFF' ? 'General Ward' : 'Hospital Wide',
      };
      onLoginSuccess(appUser, dbUser.redirect);
      return;
    }

    // Flash error if user does not exist or password mismatch
    if (!matched || matched.password !== cleanPass) {
      setLocalFlash('Invalid ID or Password! Access Denied.', 'danger');
      return;
    }

    setFlash(null);
    const redirect =
      matched.role === 'admin'
        ? '/admin-dashboard'
        : matched.role === 'manager'
        ? '/manager-dashboard'
        : '/staff-portal';
    onLoginSuccess(matched, redirect);
  };

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-4 py-8 antialiased bg-[#F0F4F8] font-sans text-slate-800"
      id="login-page-root"
    >
      <div
        className="shadow-xl p-6 sm:p-8 w-full max-w-[440px] relative overflow-hidden bg-white border border-slate-200 rounded-2xl text-slate-800 font-sans"
        id="login-card"
        style={{ maxWidth: '440px', width: '100%' }}
      >
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-700 via-blue-500 to-teal-500" />

        {/* Header Bar */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-bold mb-3 bg-blue-50 border border-blue-200 text-blue-800">
            <Hospital className="h-3.5 w-3.5 text-blue-600" />
            <span>ApexCare Hospital Operations</span>
          </div>

          <h3 className="text-2xl font-extrabold tracking-tight font-sans text-slate-900">
            Housekeeping Portal
          </h3>
          <p className="text-xs mt-1 text-slate-500 font-sans">
            Universal Staff &amp; Administrator Login
          </p>
        </div>

        {/* Security Notice */}
        <div className="mb-5 p-3 rounded-lg flex items-start gap-2.5 text-2xs bg-blue-50/60 border border-blue-100 text-blue-900 font-sans">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
          <div className="leading-snug">
            <span className="font-bold block">No Public Signup</span>
            Staff accounts are created exclusively by Admin via{' '}
            <code className="px-1 py-0.5 rounded font-mono text-blue-700 bg-blue-100/50">
              /admin/create_staff_account
            </code>
            .
          </div>
        </div>

        {/* Flask Flash Alert if any */}
        {flash && (
          <div
            className={`mb-4 flex items-start gap-2.5 rounded-lg border p-3 text-xs font-medium transition-all animate-in fade-in ${
              flash.type === 'danger'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : flash.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : flash.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
            role="alert"
            id="flask-login-flash-alert"
          >
            {flash.type === 'danger' && <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />}
            {flash.type === 'warning' && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />}
            {flash.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />}
            {flash.type === 'info' && <Info className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />}
            <span className="leading-snug">{flash.message}</span>
          </div>
        )}

        {/* Universal Login Form (/login) */}
        <form onSubmit={handleLoginSubmit} method="POST" action="/login" className="w-full">
          <div className="mb-4">
            <label
              htmlFor="login-username"
              className="block text-2xs uppercase tracking-wider font-bold mb-1.5 text-slate-700 font-sans"
            >
              Staff ID (staff_id) / Username
            </label>
            <input
              type="text"
              id="login-username"
              name="username"
              required
              placeholder="e.g. HK-001, HK-005, or admin"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (flash) setFlash(null);
              }}
              autoComplete="username"
              className="w-full rounded-lg px-3.5 py-2.5 text-xs transition-all bg-slate-50 border border-slate-300 font-sans text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="login-password"
              className="block text-2xs uppercase tracking-wider font-bold mb-1.5 text-slate-700 font-sans"
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
                className="w-full rounded-lg px-3.5 py-2.5 pr-10 text-xs transition-all bg-slate-50 border border-slate-300 font-sans text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center transition-colors text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="btn-login-submit"
            className="w-full py-3 text-xs uppercase tracking-wider font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-5 rounded-lg bg-[#1a3a8a] hover:bg-blue-900 active:bg-blue-950 text-white"
          >
            <LogIn className="h-4 w-4" />
            <span>Sign In to Portal</span>
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-3xs uppercase tracking-widest font-semibold text-slate-400 font-sans">
            Authorized Hospital Personnel Only
          </p>
        </div>
      </div>
    </div>
  );
};

