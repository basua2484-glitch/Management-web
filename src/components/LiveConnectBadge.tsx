import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, Users, Zap } from 'lucide-react';
import { websocketService, type WsState } from '../services/websocketService';
import { LiveConnectModal } from './LiveConnectModal';

interface LiveConnectBadgeProps {
  className?: string;
  showDetailsOnClick?: boolean;
}

export const LiveConnectBadge: React.FC<LiveConnectBadgeProps> = ({
  className = '',
  showDetailsOnClick = true,
}) => {
  const [wsState, setWsState] = useState<WsState>(() => websocketService.getState());
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const unsub = websocketService.subscribe((state) => {
      setWsState(state);
    });
    return () => unsub();
  }, []);

  const isConnected = wsState.status === 'CONNECTED';
  const isReconnecting = wsState.status === 'RECONNECTING' || wsState.status === 'CONNECTING';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showDetailsOnClick) {
      setIsModalOpen(true);
    }
  };

  const getStatusColor = () => {
    if (isConnected) {
      return 'text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400';
    }
    if (isReconnecting) {
      return 'text-amber-800 bg-amber-50 border-amber-300 hover:bg-amber-100 hover:border-amber-400';
    }
    return 'text-rose-700 bg-rose-50 border-rose-300 hover:bg-rose-100 hover:border-rose-400';
  };

  const getDotColor = () => {
    if (isConnected) return 'bg-emerald-600';
    if (isReconnecting) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getTitleText = () => {
    if (isConnected) {
      return `24/7 WebSocket Live Active • Latency: ${wsState.latencyMs}ms • ${wsState.onlineCount} Online. Click for Command Center.`;
    }
    if (isReconnecting) {
      const attemptStr = wsState.reconnectAttempts > 0 ? ` (Attempt ${wsState.reconnectAttempts})` : '';
      return `Reconnecting to 24/7 Live Status${attemptStr}... Auto-retry with exponential backoff & silent heartbeat active.`;
    }
    return `Connection Offline. Click for details & manual reconnect.`;
  };

  return (
    <>
      <button
        type="button"
        id="btn-online-live-connect-badge"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shadow-2xs transition-all duration-300 ease-in-out cursor-pointer select-none ${getStatusColor()} ${className}`}
        title={getTitleText()}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {isConnected && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          {isReconnecting && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60"></span>
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 transition-colors duration-300 ${getDotColor()}`}
          ></span>
        </span>

        <Radio
          className={`h-3 w-3 shrink-0 transition-colors duration-300 ${
            isConnected ? 'text-emerald-700' : isReconnecting ? 'text-amber-700' : 'text-rose-700'
          }`}
        />

        <span className="font-bold tracking-tight transition-colors duration-300">
          {isConnected ? '24/7 Live' : isReconnecting ? 'Reconnecting...' : 'Offline'}
        </span>

        {isConnected ? (
          <>
            <span className="hidden sm:inline-flex items-center gap-1 text-2xs font-mono font-bold opacity-80 transition-opacity duration-300">
              <Zap className="h-2.5 w-2.5 text-emerald-600" />
              {wsState.latencyMs}ms
            </span>
            <span className="hidden md:inline-flex items-center gap-1 text-2xs font-mono font-medium opacity-80 border-l border-emerald-300/60 pl-1.5 transition-opacity duration-300">
              <Users className="h-2.5 w-2.5" />
              {wsState.onlineCount}
            </span>
          </>
        ) : isReconnecting ? (
          <RefreshCw className="h-3 w-3 animate-spin text-amber-700 shrink-0" />
        ) : (
          <span className="text-2xs opacity-75">Tap Reconnect</span>
        )}
      </button>

      {isModalOpen && (
        <LiveConnectModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          wsState={wsState}
        />
      )}
    </>
  );
};
