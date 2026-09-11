import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home, LogOut, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout, role: contextRole, user: contextUser } = useAuth();
  const userRole = (contextRole || localStorage.getItem('userRole') || localStorage.getItem('user_role') || 'UNKNOWN').toUpperCase();
  const userId = contextUser?.staff_id || contextUser?.username || localStorage.getItem('userId') || 'User';

  const getSafePortalUrl = () => {
    if (userRole === 'ADMIN') return '/admin-dashboard';
    if (userRole === 'MANAGER') return '/manager-dashboard';
    return '/staff-portal';
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-[#0D0D0E] font-sans antialiased text-slate-100"
      id="unauthorized-page-root"
    >
      <div
        className="w-full max-w-md bg-[#161618] border border-rose-900/60 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
        id="unauthorized-card"
      >
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600" />

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="inline-block px-2.5 py-0.5 rounded-full text-3xs font-mono font-bold tracking-wider uppercase bg-rose-950/80 border border-rose-800 text-rose-300 mb-2">
            Error 403 • Forbidden
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white">
            Access Denied
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            You do not have permission to view or execute operations on this route.
          </p>
        </div>

        {/* Current Credentials Context */}
        <div className="bg-[#1C1C1F] border border-white/5 rounded-xl p-3.5 mb-6 text-2xs space-y-1.5 font-mono">
          <div className="flex items-center justify-between text-slate-400">
            <span>Current User:</span>
            <span className="text-slate-200 font-bold">{userId}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Detected Role:</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold border border-white/10">
              {userRole}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-white/5">
            <span>Security Policy:</span>
            <span className="text-rose-400 font-semibold flex items-center gap-1">
              <Lock className="w-3 h-3" /> Restricted Endpoint
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => navigate(getSafePortalUrl(), { replace: true })}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-blue-950/50"
            id="go-safe-portal-btn"
          >
            <Home className="w-4 h-4" />
            <span>Return to Your {userRole} Portal</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 transition border border-white/10"
              id="go-back-btn"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Go Back</span>
            </button>

            <button
              type="button"
              onClick={() => logout(navigate)}
              className="py-2 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-950/80 text-rose-300 font-medium text-xs flex items-center justify-center gap-1.5 transition border border-rose-800/50"
              id="unauthorized-logout-btn"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default UnauthorizedPage;
