import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Eye, EyeOff, Info, LogIn, Lock, ShieldCheck, Ticket, Hospital } from 'lucide-react';
import type { AppUser } from '../types';
import { CredentialCardModal, type CredentialCardData } from './CredentialCardModal';

interface LoginViewProps {
  onLoginSuccess: (user: AppUser) => void;
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
  const [activeSlip, setActiveSlip] = useState<CredentialCardData | null>(null);

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

    // User lookup: User.query.filter_by(staff_id=staff_id).first() OR username
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

    // Flash error if user does not exist or password mismatch
    if (!matched || matched.password !== cleanPass) {
      setLocalFlash('Aapka Staff ID ya Password sahi nahi hai!', 'danger');
      return;
    }

    setFlash(null);
    onLoginSuccess(matched);
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setFlash(null);
    if (onClearError) onClearError();
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

        {/* Demo Quick-Fill Accounts */}
        <div className="mt-6 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-3xs uppercase tracking-widest font-bold text-slate-500 font-sans">
              Quick Test Credentials:
            </p>
            <button
              type="button"
              onClick={() =>
                setActiveSlip({
                  name: 'Rahul Sharma',
                  staffId: 'hk005',
                  defaultPass: '123456',
                  url: 'hk-app.hospital.com',
                  department: 'General Ward',
                  role: 'staff',
                })
              }
              className="inline-flex items-center gap-1 text-3xs uppercase tracking-wider font-bold transition-colors cursor-pointer text-blue-700 hover:text-blue-900"
              title="View official physical credential slip badge"
            >
              <Ticket className="h-3 w-3" />
              <span>View Slip Card</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-2xs">
            <button
              type="button"
              onClick={() => handleQuickFill('admin', 'admin123')}
              className="p-2 rounded-lg border text-left transition-colors cursor-pointer bg-slate-50 hover:bg-blue-50/50 border-slate-200 text-slate-800 font-sans"
              title="Full System Administrator -> admin_dashboard"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-700">admin</span>
                <span className="text-3xs uppercase text-slate-400 font-semibold">Admin</span>
              </div>
              <span className="text-3xs text-slate-400 block mt-0.5 font-mono">pass: admin123</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('manager', 'manager123')}
              className="p-2 rounded-lg border text-left transition-colors cursor-pointer bg-slate-50 hover:bg-blue-50/50 border-slate-200 text-slate-800 font-sans"
              title="Operations Manager -> admin_dashboard"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold">manager</span>
                <span className="text-3xs uppercase text-slate-400 font-semibold">Manager</span>
              </div>
              <span className="text-3xs text-slate-400 block mt-0.5 font-mono">pass: manager123</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('HK-001', 'staff123')}
              className="p-2 rounded-lg border text-left transition-colors cursor-pointer relative bg-blue-50/60 hover:bg-blue-100/60 border-blue-200 text-blue-900 font-sans"
              title="Staff Member: Ramesh Kumar (staff_id: HK-001) -> staff_portal"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-800">HK-001</span>
                <span className="text-3xs uppercase font-semibold text-blue-700">Ramesh</span>
              </div>
              <span className="text-3xs text-slate-400 block mt-0.5 font-mono">pass: staff123</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('hk009', '123456')}
              className="p-2 rounded-lg border text-left transition-colors cursor-pointer bg-slate-50 hover:bg-blue-50/50 border-slate-200 text-slate-800 font-sans"
              title="Staff Member: Pooja Verma (hk009 / 123456) -> staff_portal"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-700">hk009</span>
                <span className="text-3xs uppercase text-slate-400 font-semibold">Pooja</span>
              </div>
              <span className="text-3xs text-slate-400 block mt-0.5 font-mono">pass: 123456</span>
            </button>
          </div>
        </div>
      </div>

      {/* Credential Slip Modal */}
      <CredentialCardModal
        isOpen={Boolean(activeSlip)}
        onClose={() => setActiveSlip(null)}
        data={activeSlip}
        onQuickLogin={(u, p) => {
          handleQuickFill(u, p);
        }}
      />
    </div>
  );
};
