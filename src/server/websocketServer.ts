import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server as HttpServer } from 'http';

export interface ConnectedClient {
  id: string;
  ws: WebSocket;
  user?: {
    id: string;
    name: string;
    role: string;
    siteId?: string;
    tenantId?: string;
  };
  connectedAt: string;
  lastPing: number;
  isAlive: boolean;
  ip?: string;
}

export interface WsEvent {
  type: string;
  payload?: any;
  message?: string;
  priority?: string;
  sender?: {
    id: string;
    name: string;
    role: string;
  };
  timestamp?: string;
}

let wssInstance: WebSocketServer | null = null;
const clients = new Map<string, ConnectedClient>();
const eventHistory: Array<{ id: string; type: string; summary: string; timestamp: string }> = [];
const MAX_HISTORY = 50;

function logHistory(type: string, summary: string) {
  eventHistory.unshift({
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    summary,
    timestamp: new Date().toISOString(),
  });
  if (eventHistory.length > MAX_HISTORY) {
    eventHistory.pop();
  }
}

export function setupWebSocketServer(httpServer: HttpServer | any): WebSocketServer {
  if (wssInstance) {
    return wssInstance;
  }

  const wss = new WebSocketServer({ noServer: true });
  wssInstance = wss;

  httpServer.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
    const url = request.url || '';
    if (url.startsWith('/ws') || url.startsWith('/api/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';

    const clientInfo: ConnectedClient = {
      id: clientId,
      ws,
      connectedAt: new Date().toISOString(),
      lastPing: Date.now(),
      isAlive: true,
      ip: clientIp,
    };

    clients.set(clientId, clientInfo);

    // Send Welcome & Initial State
    const welcomePayload = {
      type: 'init',
      clientId,
      serverTime: new Date().toISOString(),
      onlineCount: clients.size,
      onlineUsers: getOnlineUsersList(),
      history: eventHistory.slice(0, 15),
      message: 'ApexCare Real-Time WebSocket System Live (24/7)',
    };

    try {
      ws.send(JSON.stringify(welcomePayload));
    } catch {}

    broadcastPresence();

    ws.on('message', (data: any) => {
      try {
        const messageStr = data.toString();
        const parsed = JSON.parse(messageStr);
        handleClientMessage(clientId, parsed, ws);
      } catch (err) {
        console.warn('[WS Server] Failed to parse message from client:', clientId, err);
      }
    });

    ws.on('pong', () => {
      const client = clients.get(clientId);
      if (client) {
        client.isAlive = true;
        client.lastPing = Date.now();
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      broadcastPresence();
    });

    ws.on('error', (err) => {
      console.warn('[WS Server] Socket error on client:', clientId, err.message);
      clients.delete(clientId);
      broadcastPresence();
    });
  });

  // 24/7 Heartbeat Keep-Alive Interval (every 15 seconds)
  const heartbeatInterval = setInterval(() => {
    clients.forEach((client, id) => {
      if (!client.isAlive) {
        try {
          client.ws.terminate();
        } catch {}
        clients.delete(id);
        return;
      }
      client.isAlive = false;
      try {
        client.ws.ping();
      } catch {
        clients.delete(id);
      }
    });
  }, 15000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  logHistory('system', 'ApexCare WebSocket 24/7 Live Server initialized on port 3000');
  console.log('[WS Server] Real-Time WebSocket System attached to HTTP Server at /ws');

  return wss;
}

function handleClientMessage(clientId: string, message: any, ws: WebSocket) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case 'auth': {
      if (message.user) {
        client.user = {
          id: String(message.user.id || message.user.staff_id || 'anonymous'),
          name: String(message.user.name || message.user.fullName || 'User'),
          role: String(message.user.role || 'STAFF'),
          siteId: message.user.siteId || message.user.site_id,
          tenantId: message.user.tenantId || message.user.tenant_id,
        };
        logHistory('presence', `${client.user.name} (${client.user.role}) connected live`);
      }
      try {
        ws.send(JSON.stringify({ type: 'auth_ack', success: true, clientId }));
      } catch {}
      broadcastPresence();
      break;
    }

    case 'ping': {
      client.isAlive = true;
      client.lastPing = Date.now();
      try {
        ws.send(
          JSON.stringify({
            type: 'pong',
            clientTimestamp: message.timestamp,
            serverTimestamp: Date.now(),
          })
        );
      } catch {}
      break;
    }

    case 'punch_event': {
      const summary = `Punch ${message.payload?.action_type || 'RECORD'} by ${message.payload?.staff_name || message.payload?.staff_id || 'Staff'}`;
      logHistory('punch', summary);
      broadcastToAll({
        type: 'punch_sync',
        payload: message.payload,
        sender: client.user,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    case 'duty_event': {
      const summary = `Duty allocation updated for ${message.payload?.staff_name || 'Staff'}`;
      logHistory('duty', summary);
      broadcastToAll({
        type: 'duty_sync',
        payload: message.payload,
        sender: client.user,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    case 'roster_event': {
      const summary = `Roster updated by ${client.user?.name || 'Admin'}`;
      logHistory('roster', summary);
      broadcastToAll({
        type: 'roster_sync',
        payload: message.payload,
        sender: client.user,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    case 'broadcast_alert': {
      const summary = `ALERT: ${message.message || 'Hospital announcement'}`;
      logHistory('alert', summary);
      broadcastToAll({
        type: 'alert_message',
        message: message.message,
        priority: message.priority || 'high',
        sender: client.user || { name: 'Hospital Admin', role: 'ADMIN', id: 'admin' },
        timestamp: new Date().toISOString(),
      });
      break;
    }

    case 'status_request': {
      try {
        ws.send(
          JSON.stringify({
            type: 'status_response',
            onlineCount: clients.size,
            onlineUsers: getOnlineUsersList(),
            history: eventHistory.slice(0, 20),
            serverTime: new Date().toISOString(),
          })
        );
      } catch {}
      break;
    }

    default:
      break;
  }
}

export function broadcastToAll(event: WsEvent) {
  if (!wssInstance) return;
  const data = JSON.stringify(event);
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(data);
      } catch {}
    }
  });
}

function getOnlineUsersList() {
  const users: Array<{ id: string; name: string; role: string; siteId?: string; connectedAt: string }> = [];
  const seen = new Set<string>();

  clients.forEach((client) => {
    if (client.user && !seen.has(client.user.id)) {
      seen.add(client.user.id);
      users.push({
        id: client.user.id,
        name: client.user.name,
        role: client.user.role,
        siteId: client.user.siteId,
        connectedAt: client.connectedAt,
      });
    }
  });

  return users;
}

function broadcastPresence() {
  broadcastToAll({
    type: 'presence_update',
    payload: {
      onlineCount: clients.size,
      onlineUsers: getOnlineUsersList(),
      serverTime: new Date().toISOString(),
    },
  });
}

export function getWsStatusSummary() {
  return {
    status: 'online',
    is24x7Live: true,
    totalConnections: clients.size,
    onlineUsers: getOnlineUsersList(),
    recentEvents: eventHistory.slice(0, 10),
    serverTime: new Date().toISOString(),
  };
}
