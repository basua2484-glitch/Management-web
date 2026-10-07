import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Bell, ShieldAlert } from 'lucide-react';

interface AlertDetail {
  message: string;
  priority: 'normal' | 'high' | 'urgent';
  sender?: {
    name: string;
    role: string;
  };
  timestamp: string;
}

export const LiveAlertBanner: React.FC = () => {
  const [activeAlert, setActiveAlert] = useState<AlertDetail | null>(null);

  useEffect(() => {
    const handleAlert = (e: Event) => {
      const customEvent = e as CustomEvent<AlertDetail>;
      if (customEvent.detail) {
        setActiveAlert(customEvent.detail);
      }
    };

    window.addEventListener('ws-alert-received', handleAlert);
    return () => {
      window.removeEventListener('ws-alert-received', handleAlert);
    };
  }, []);

  if (!activeAlert) return null;

  const isUrgent = activeAlert.priority === 'urgent';
  const isHigh = activeAlert.priority === 'high';

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 pointer-events-auto animate-in slide-in-from-top duration-300">
      <div
        className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md ${
          isUrgent
            ? 'bg-rose-900/95 text-white border-rose-500 ring-2 ring-rose-400'
            : isHigh
            ? 'bg-amber-900/95 text-white border-amber-500 ring-2 ring-amber-400'
            : 'bg-blue-900/95 text-white border-blue-500'
        }`}
      >
        <div className="p-2 rounded-xl bg-white/20 shrink-0">
          {isUrgent ? (
            <ShieldAlert className="h-5 w-5 text-rose-200 animate-bounce" />
          ) : (
            <Bell className="h-5 w-5 text-amber-200" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-xs uppercase tracking-wider">
              {isUrgent ? 'URGENT HOSPITAL BROADCAST' : 'SYSTEM ANNOUNCEMENT'}
            </span>
            <span className="text-2xs opacity-75 font-mono">
              {new Date(activeAlert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <p className="text-xs leading-relaxed font-medium">
            {activeAlert.message}
          </p>

          {activeAlert.sender?.name && (
            <div className="text-2xs opacity-80 mt-1 font-mono">
              Broadcasted by: {activeAlert.sender.name} ({activeAlert.sender.role})
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setActiveAlert(null)}
          className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
