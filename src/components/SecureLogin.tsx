import React, { useState } from 'react';

interface SecureLoginProps {
  onLogin: (
    staffId: string,
    password: string,
    setError: (msg: string) => void
  ) => Promise<void> | void;
}

export default function SecureLogin({ onLogin }: SecureLoginProps) {
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await onLogin(staffId, password, setError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="login-card w-full max-w-md bg-[#161618] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-slate-100 font-sans"
      id="secure-login-card"
    >
      {/* Top Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500" />

      <div className="text-center mb-6">
        <h2 className="text-2xl font-black tracking-tight text-white">
          ApexCare Hospital Operations
        </h2>
        <h3 className="text-sm font-medium text-slate-400 mt-1">
          Housekeeping Portal
        </h3>
      </div>

      {error && (
        <div
          className="error-badge mb-5 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold text-center"
          id="login-error-badge"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" id="secure-login-form">
        <div className="space-y-1.5">
          <label className="block text-2xs font-mono font-bold uppercase tracking-wider text-slate-400">
            STAFF ID / USERNAME
          </label>
          <input
            type="text"
            placeholder="e.g. HK-001 or admin"
            value={staffId}
            onChange={(e) => {
              setStaffId(e.target.value);
              if (error) setError('');
            }}
            required
            id="staff-id-input"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0D0D0E] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition font-mono"
            autoComplete="username"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-2xs font-mono font-bold uppercase tracking-wider text-slate-400">
            PASSWORD
          </label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError('');
            }}
            required
            id="password-input"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0D0D0E] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition font-mono"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-blue-950/50 flex items-center justify-center cursor-pointer disabled:opacity-60"
          id="login-submit-btn"
        >
          {isSubmitting ? 'SIGNING IN...' : 'SIGN IN TO PORTAL'}
        </button>
      </form>

      <p className="footer-note text-center text-3xs font-mono uppercase tracking-widest text-slate-500 mt-6 pt-4 border-t border-white/5">
        Authorized Hospital Personnel Only
      </p>
    </div>
  );
}
