import React, { useState } from 'react';
import {
  X,
  Radio,
  RefreshCw,
  Zap,
  Users,
  ShieldCheck,
  Send,
  Activity,
  Server,
  Cloud,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Terminal,
} from 'lucide-react';
import { websocketService, type WsState } from '../services/websocketService';
import { getStoredCurrentUser } from '../data/mockHousekeepingData';

interface LiveConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  wsState: WsState;
}

export const LiveConnectModal: React.FC<LiveConnectModalProps> = ({
  isOpen,
  onClose,
  wsState,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'users' | 'events' | 'broadcast'>('status');
  const [alertText, setAlertText] = useState('');
  const [alertPriority, setAlertPriority] = useState<'normal' | 'high' | 'urgent'>('high');
  const [isAlertSent, setIsAlertSent] = useState(false);
  const [isTestingPing, setIsTestingPing] = useState(false);

  const currentUser = getStoredCurrentUser();
  const userRole = String(currentUser?.role || '').toLowerCase();
  const canBroadcast = userRole === 'admin' || userRole === 'supervisor' || userRole === 'manager';

  if (!isOpen) return null;

  const isConnected = wsState.status === 'CONNECTED';

  const handleTestPing = () => {
    setIsTestingPing(true);
    websocketService.pingNow();
    setTimeout(() => {
      setIsTestingPing(false);
    }, 600);
  };

  const handleForceReconnect = () => {
    websocketService.forceReconnect();
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertText.trim()) return;

    websocketService.broadcastAlert(alertText.trim(), alertPriority);
    setIsAlertSent(true);
    setAlertText('');
    setTimeout(() => setIsAlertSent(false), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans text-left animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-4 text-white flex items-center justify-between border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              {isConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${
                  isConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              ></span>
            </span>
            <div>
              <h3 className="font-bold text-base text-white tracking-tight flex items-center gap-2">
                Online Live Connect 24/7
                <span className="px-2 py-0.5 rounded-full text-2xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  WebSocket Real-Time
                </span>
              </h3>
              <p className="text-2xs text-slate-300">
                Port 3000 • Sub-millisecond Event Synchronization System
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`py-2.5 px-3 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'status'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Connection Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`py-2.5 px-3 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Live Users</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs bg-blue-100 text-blue-800 font-mono">
              {wsState.onlineCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('events')}
            className={`py-2.5 px-3 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === 'events'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Live Stream</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs bg-slate-200 text-slate-700 font-mono">
              {wsState.recentEvents.length}
            </span>
          </button>
          {canBroadcast && (
            <button
              type="button"
              onClick={() => setActiveTab('broadcast')}
              className={`py-2.5 px-3 border-b-2 cursor-pointer transition-colors flex items-center gap-1 ${
                activeTab === 'broadcast'
                  ? 'border-blue-600 text-blue-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Send className="h-3 w-3" />
              <span>Broadcast</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
          {/* TAB 1: STATUS */}
          {activeTab === 'status' && (
            <div className="space-y-3">
              {/* Primary Stats Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="font-medium text-2xs">WebSocket Status</span>
                    <Server className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-2xs ${
                        isConnected
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      <Radio className="h-2.5 w-2.5" />
                      {isConnected ? 'LIVE 24/7 CONNECTED' : wsState.status}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="font-medium text-2xs">Live Latency</span>
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-extrabold font-mono text-slate-900">
                      {wsState.latencyMs} ms
                    </span>
                    <span className="text-2xs text-emerald-700 font-medium">Ultra Fast</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="font-medium text-2xs">Online Active Clients</span>
                    <Users className="h-3.5 w-3.5 text-purple-600" />
                  </div>
                  <div className="text-base font-extrabold font-mono text-purple-900">
                    {wsState.onlineCount} Devices
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="font-medium text-2xs">Cloud Database</span>
                    <Cloud className="h-3.5 w-3.5 text-sky-600" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-2xs bg-sky-100 text-sky-900 border border-sky-300">
                      <ShieldCheck className="h-2.5 w-2.5 text-sky-700" />
                      Synced
                    </span>
                  </div>
                </div>
              </div>

              {/* Technical System Details */}
              <div className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-2xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="h-3 w-3 text-emerald-400" />
                    LIVE RUNTIME METRICS
                  </span>
                  <span className="text-emerald-400">UP 24/7</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Protocol:</span>
                  <span className="text-slate-100">WebSocket (RFC 6455)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Server Port:</span>
                  <span className="text-slate-100">3000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Endpoint Path:</span>
                  <span className="text-slate-100">/ws (Bi-Directional)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Heartbeat Keep-Alive:</span>
                  <span className="text-slate-100">Every 12s (Auto-Ping)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Reconnect Strategy:</span>
                  <span className="text-slate-100">Exponential Backoff (Infinite 24/7)</span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleTestPing}
                  disabled={isTestingPing}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isTestingPing ? 'animate-spin text-blue-600' : ''}`} />
                  <span>{isTestingPing ? 'Testing Ping...' : 'Test Latency Ping'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleForceReconnect}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 transition-colors cursor-pointer shadow-xs"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Force Reconnect</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ONLINE USERS */}
          {activeTab === 'users' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs">
                  Active Connected Staff & Personnel ({wsState.onlineUsers.length || 1})
                </span>
                <span className="text-2xs font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Real-Time Presence
                </span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {wsState.onlineUsers.length > 0 ? (
                  wsState.onlineUsers.map((u, i) => (
                    <div
                      key={u.id || i}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                          {u.name?.slice(0, 2).toUpperCase() || 'US'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{u.name}</span>
                            <span className="text-2xs font-mono font-semibold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-200">
                              {u.role}
                            </span>
                          </div>
                          <div className="text-2xs text-slate-500 font-mono">
                            ID: {u.id} • Connected: {new Date(u.connectedAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-2xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                        Active
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center text-slate-500">
                    <p className="font-semibold">Current Terminal Connected</p>
                    <p className="text-2xs mt-1">
                      {currentUser?.name || 'Local User'} ({currentUser?.role || 'ADMIN'})
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LIVE EVENT STREAM */}
          {activeTab === 'events' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-2xs text-slate-500">
                <span className="font-bold text-slate-800">WebSocket Live Broadcast Stream</span>
                <span>Auto-refreshing 24/7</span>
              </div>

              <div className="space-y-1.5 font-mono text-2xs max-h-64 overflow-y-auto border border-slate-200 rounded-xl p-2.5 bg-slate-900 text-slate-200">
                {wsState.recentEvents.length > 0 ? (
                  wsState.recentEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="border-b border-slate-800/80 pb-1.5 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-bold text-emerald-400">[{ev.type.toUpperCase()}]</span>
                        <span className="text-slate-500">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-200 mt-0.5">{ev.summary}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-500">
                    <Activity className="h-6 w-6 mx-auto mb-1 opacity-50" />
                    <span>Listening for real-time punch & duty allocations...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: BROADCAST ALERT */}
          {activeTab === 'broadcast' && canBroadcast && (
            <form onSubmit={handleSendBroadcast} className="space-y-3">
              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Send Instant Alert to All Online Screens
                </label>
                <textarea
                  rows={3}
                  value={alertText}
                  onChange={(e) => setAlertText(e.target.value)}
                  placeholder="e.g. Code Blue Alert: Emergency cleanup requested at ICU Ward 3 immediately."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center gap-4">
                <span className="text-2xs font-semibold text-slate-600">Priority:</span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    checked={alertPriority === 'normal'}
                    onChange={() => setAlertPriority('normal')}
                  />
                  <span>Normal</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    checked={alertPriority === 'high'}
                    onChange={() => setAlertPriority('high')}
                  />
                  <span className="text-amber-700 font-bold">High</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    checked={alertPriority === 'urgent'}
                    onChange={() => setAlertPriority('urgent')}
                  />
                  <span className="text-rose-700 font-bold">Urgent</span>
                </label>
              </div>

              {isAlertSent && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-2xs flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Alert broadcasted over 24/7 WebSockets to all connected hospital devices!</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 transition-colors shadow-xs cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Broadcast Alert Now</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-2xs text-slate-500">
          <div className="flex items-center gap-1 font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>24/7 LIVE WEBSOCKET ACTIVE</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-white border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
