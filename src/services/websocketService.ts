/**
 * ApexCare Real-Time WebSocket Client Service (24/7 Live Sync)
 * Handles auto-reconnect, ping latency measurement, live presence, and instant event broadcasting.
 */

export type WsConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'RECONNECTING' | 'OFFLINE';

export interface OnlineUser {
  id: string;
  name: string;
  role: string;
  siteId?: string;
  connectedAt: string;
}

export interface WsEventLog {
  id: string;
  type: string;
  summary: string;
  timestamp: string;
}

export interface WsState {
  status: WsConnectionStatus;
  latencyMs: number;
  onlineCount: number;
  onlineUsers: OnlineUser[];
  recentEvents: WsEventLog[];
  lastConnected: Date | null;
  reconnectAttempts: number;
}

type StateListener = (state: WsState) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private listeners: Set<StateListener> = new Set();
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private lastPingSent = 0;
  private currentUser: any = null;
  private reconnectCount = 0;
  private isExplicitlyClosed = false;

  private state: WsState = {
    status: 'CONNECTING',
    latencyMs: 14,
    onlineCount: 1,
    onlineUsers: [],
    recentEvents: [],
    lastConnected: null,
    reconnectAttempts: 0,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.initUserFromStorage();
      this.connect();

      // Listen for window focus to immediately verify connection
      window.addEventListener('focus', () => {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
          this.connect();
        } else {
          this.pingNow();
        }
      });

      // Listen for online/offline browser events
      window.addEventListener('online', () => {
        this.connect();
      });

      window.addEventListener('offline', () => {
        this.updateState({ status: 'OFFLINE' });
      });
    }
  }

  private initUserFromStorage() {
    try {
      const stored = localStorage.getItem('housekeeping_current_user') || localStorage.getItem('apexcare_auth_user');
      if (stored) {
        this.currentUser = JSON.parse(stored);
      }
    } catch {}
  }

  public setUser(user: any) {
    this.currentUser = user;
    if (this.socket && this.socket.readyState === WebSocket.OPEN && user) {
      this.send({
        type: 'auth',
        user: {
          id: user.id || user.staff_id,
          name: user.name || user.fullName,
          role: user.role,
          siteId: user.siteId || user.site_id,
          tenantId: user.tenantId || user.tenant_id,
        },
      });
    }
  }

  public connect() {
    if (typeof window === 'undefined') return;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    clearTimeout(this.reconnectTimer);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    this.updateState({
      status: this.reconnectCount > 0 ? 'RECONNECTING' : 'CONNECTING',
      reconnectAttempts: this.reconnectCount,
    });

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectCount = 0;
        this.updateState({
          status: 'CONNECTED',
          lastConnected: new Date(),
          reconnectAttempts: 0,
        });

        // Send auth if user is known
        this.initUserFromStorage();
        if (this.currentUser) {
          this.setUser(this.currentUser);
        }

        // Start ping heartbeat
        this.startHeartbeat();
        this.pingNow();
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.socket.onclose = () => {
        this.stopHeartbeat();
        this.socket = null;
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        } else {
          this.updateState({ status: 'OFFLINE' });
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[WS Client] WebSocket notice (will auto-reconnect 24/7):', err);
        try {
          this.socket?.close();
        } catch {}
      };
    } catch (err) {
      console.warn('[WS Client] Connection initialization notice:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    this.reconnectCount++;
    const delay = Math.min(1000 * Math.pow(1.5, Math.min(this.reconnectCount, 6)), 10000);
    this.updateState({
      status: 'RECONNECTING',
      reconnectAttempts: this.reconnectCount,
    });

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      this.pingNow();
    }, 12000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public pingNow() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.lastPingSent = Date.now();
      this.send({ type: 'ping', timestamp: this.lastPingSent });
    }
  }

  private handleMessage(data: string) {
    try {
      const msg = JSON.parse(data);

      switch (msg.type) {
        case 'init': {
          const events = Array.isArray(msg.history) ? msg.history : [];
          this.updateState({
            onlineCount: Math.max(1, msg.onlineCount || 1),
            onlineUsers: Array.isArray(msg.onlineUsers) ? msg.onlineUsers : [],
            recentEvents: events,
          });
          break;
        }

        case 'pong': {
          if (this.lastPingSent > 0) {
            const rtt = Math.max(1, Date.now() - this.lastPingSent);
            this.updateState({ latencyMs: rtt });
          }
          break;
        }

        case 'presence_update': {
          if (msg.payload) {
            this.updateState({
              onlineCount: Math.max(1, msg.payload.onlineCount || 1),
              onlineUsers: Array.isArray(msg.payload.onlineUsers) ? msg.payload.onlineUsers : [],
            });
          }
          break;
        }

        case 'punch_sync': {
          // Trigger local DOM event so all dashboards update immediately
          window.dispatchEvent(new CustomEvent('attendance-data-updated', { detail: msg.payload }));
          this.addEventLog('punch', `Punch ${msg.payload?.action_type || 'Sync'} - ${msg.payload?.staff_name || 'Staff'}`);
          break;
        }

        case 'duty_sync': {
          window.dispatchEvent(new CustomEvent('duty-data-updated', { detail: msg.payload }));
          this.addEventLog('duty', `Duty Allocation Update: ${msg.payload?.staff_name || 'Staff'}`);
          break;
        }

        case 'roster_sync': {
          window.dispatchEvent(new CustomEvent('staff-data-updated', { detail: msg.payload }));
          window.dispatchEvent(new CustomEvent('user-data-updated', { detail: msg.payload }));
          this.addEventLog('roster', 'Staff Roster updated across all devices');
          break;
        }

        case 'alert_message': {
          window.dispatchEvent(
            new CustomEvent('ws-alert-received', {
              detail: {
                message: msg.message,
                priority: msg.priority,
                sender: msg.sender,
                timestamp: msg.timestamp,
              },
            })
          );
          this.addEventLog('alert', `URGENT ALERT: ${msg.message}`);
          break;
        }

        case 'status_response': {
          this.updateState({
            onlineCount: msg.onlineCount || this.state.onlineCount,
            onlineUsers: msg.onlineUsers || this.state.onlineUsers,
            recentEvents: msg.history || this.state.recentEvents,
          });
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.warn('[WS Client] Error handling message:', err);
    }
  }

  private addEventLog(type: string, summary: string) {
    const newEv: WsEventLog = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type,
      summary,
      timestamp: new Date().toISOString(),
    };
    const updated = [newEv, ...this.state.recentEvents].slice(0, 30);
    this.updateState({ recentEvents: updated });
  }

  public send(data: any): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(data));
        return true;
      } catch (err) {
        console.warn('[WS Client] Failed to send:', err);
      }
    }
    return false;
  }

  public broadcastPunch(punchData: any) {
    return this.send({
      type: 'punch_event',
      payload: punchData,
    });
  }

  public broadcastDuty(dutyData: any) {
    return this.send({
      type: 'duty_event',
      payload: dutyData,
    });
  }

  public broadcastRoster(rosterData: any) {
    return this.send({
      type: 'roster_event',
      payload: rosterData,
    });
  }

  public broadcastAlert(message: string, priority: 'normal' | 'high' | 'urgent' = 'high') {
    return this.send({
      type: 'broadcast_alert',
      message,
      priority,
    });
  }

  public requestStatus() {
    return this.send({ type: 'status_request' });
  }

  public forceReconnect() {
    this.isExplicitlyClosed = false;
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
    }
    this.reconnectCount = 0;
    this.connect();
  }

  public getState(): WsState {
    return { ...this.state };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(partial: Partial<WsState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((fn) => {
      try {
        fn(this.state);
      } catch (e) {
        console.warn('[WS Client] Listener error:', e);
      }
    });

    // Notify window for quick badge sync
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ws-status-changed', { detail: this.state }));
    }
  }
}

export const websocketService = new WebSocketService();
