import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Shield, X, ArrowRight } from 'lucide-react';
import type { AppUser, FlashMessage } from '../types';
import { getStoredUsers, getStoredCurrentUser, saveStoredCurrentUser } from '../data/mockHousekeepingData';
import { LoginView } from './LoginView';

interface LoginPageProps {
  onAuthChange?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onAuthChange }) => {
  const navigate = useNavigate();
  const [users] = useState<AppUser[]>(() => getStoredUsers());
  const [flashes, setFlashes] = useState<FlashMessage[]>([]);
  const currentUser = getStoredCurrentUser();
  const isAuthenticated = Boolean(currentUser);

  const addFlash = (message: string, type: 'danger' | 'warning' | 'success' | 'info' = 'info') => {
    const id = `flash_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    setFlashes((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setFlashes((prev) => prev.filter((f) => f.id !== id));
    }, 5500);
  };

  const removeFlash = (id: string) => {
    setFlashes((prev) => prev.filter((f) => f.id !== id));
  };

  const handleLoginSuccess = (user: AppUser, redirectUrl?: string) => {
    saveStoredCurrentUser(user);
    const token = 'JWT_SECRET_SESSION_TOKEN_' + Date.now();
    const roleUpper = user.role.toUpperCase();
    const userId = user.staff_id || user.username || String(user.id);

    try {
      // 2. Save Session Token & Role in Local Storage / Session
      localStorage.setItem('userToken', token);
      localStorage.setItem('userRole', roleUpper);
      localStorage.setItem('userId', userId);

      // Cross-compatibility session keys
      localStorage.setItem('user_token', token);
      localStorage.setItem('user_role', user.role);
      document.cookie = `session=active_${user.id}; Path=/; SameSite=Lax`;
      document.cookie = `user_id=${user.id}; Path=/; SameSite=Lax`;
      document.cookie = `role=${user.role}; Path=/; SameSite=Lax`;
    } catch (e) {
      console.warn('Storage warning:', e);
    }

    onAuthChange?.();
    const destination =
      redirectUrl ||
      (user.role === 'admin'
        ? '/admin-dashboard'
        : user.role === 'manager'
        ? '/manager-dashboard'
        : '/staff-portal');

    // 3. Automatic Role-Based Dynamic Redirection
    navigate(destination, { replace: true });
  };

  return (
    <div className="relative min-h-screen bg-[#0D0D0E] font-mono dot-grid">
      {/* Floating Flash Notifications */}
      {flashes.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-2" id="login-flashes">
          {flashes.map((f) => (
            <div
              key={f.id}
              className={`flex items-start justify-between gap-3 p-3.5 rounded-lg shadow-2xl border text-xs font-semibold backdrop-blur-md transition-all ${
                f.type === 'danger'
                  ? 'bg-rose-950/90 border-rose-600 text-rose-100'
                  : f.type === 'warning'
                  ? 'bg-amber-950/90 border-amber-500 text-amber-200'
                  : f.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-100'
                  : 'bg-blue-950/90 border-blue-500 text-blue-100'
              }`}
            >
              <div className="flex items-center gap-2">
                {f.type === 'danger' && <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />}
                {f.type === 'warning' && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />}
                {f.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
                {f.type === 'info' && <Shield className="h-4 w-4 shrink-0 text-blue-400" />}
                <span>{f.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeFlash(f.id)}
                className="text-white/40 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* If already authenticated, allow direct 1-click continuation to Dashboard */}
      {isAuthenticated && currentUser && (
        <div className="pt-4 px-4 max-w-md mx-auto relative z-10">
          <div className="bg-emerald-950/90 border border-emerald-500/60 rounded-xl p-3 text-xs flex items-center justify-between text-emerald-200 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                Active Session: <strong>{currentUser.name}</strong> ({currentUser.role})
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="ml-2 px-3 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs hover:bg-emerald-400 transition flex items-center gap-1.5 shadow-md"
            >
              Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <LoginView
        users={users}
        onLoginSuccess={handleLoginSuccess}
        onFlashMessage={addFlash}
      />
    </div>
  );
};
