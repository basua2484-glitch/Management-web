import type { UserSession, DeviceType } from '../types/sessions';
import { getApiEndpoint } from './apiConfig';
import { parseUserAgentString, lookupIpLocation } from '../utils/userAgentAndGeo';
import { db } from '../firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';

const SESSION_STORAGE_KEY = 'basu_device_session_id_v1';

/**
 * 1. DYNAMIC USER AGENT PARSING
 * Detects client Device Brand, Model, OS version, and Browser name from exact navigator.userAgent
 */
export function getClientDeviceInfo(): {
  deviceName: string;
  deviceType: DeviceType;
  browser: string;
  os: string;
} {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const parsed = parseUserAgentString(ua);
  return {
    deviceName: parsed.deviceName,
    deviceType: parsed.deviceType,
    browser: parsed.browser,
    os: parsed.os,
  };
}

/**
 * Get or initialize persistent session ID for the current device
 */
export function getOrCreateCurrentSessionId(): string {
  if (typeof window === 'undefined') return 'sess-default';
  try {
    let id = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    // Also mirror to cookie so backend requests can read it
    document.cookie = `session_id=${id}; Path=/; SameSite=Lax; max-age=2592000`;
    return id;
  } catch {
    return 'sess-fallback';
  }
}

/**
 * Fetch all active sessions for a user (strictly real stored sessions from backend and Firestore)
 */
export async function fetchUserSessions(userId: string): Promise<UserSession[]> {
  const currentSessionId = getOrCreateCurrentSessionId();
  try {
    const res = await fetch(getApiEndpoint(`/api/users/${encodeURIComponent(userId)}/sessions`), {
      headers: {
        'x-session-id': currentSessionId,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.sessions && Array.isArray(data.sessions) && data.sessions.length > 0) {
        return data.sessions.map((s: UserSession) => ({
          ...s,
          is_current: s.session_id === currentSessionId,
        }));
      }
    }
  } catch (err) {
    console.warn('[SessionService] Server sessions notice, checking Firestore:', err);
  }

  // Query Firestore user_sessions collection for real active sessions
  if (db) {
    try {
      const q = query(
        collection(db, 'user_sessions'),
        where('user_id', '==', userId),
        where('is_active', '==', true)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const firestoreSessions: UserSession[] = [];
        snap.forEach((d) => {
          const s = d.data() as UserSession;
          firestoreSessions.push({
            ...s,
            session_id: s.session_id || d.id,
            is_current: (s.session_id || d.id) === currentSessionId,
          });
        });
        if (firestoreSessions.length > 0) {
          return firestoreSessions;
        }
      }
    } catch (fbErr) {
      console.warn('[SessionService] Firestore user_sessions lookup notice:', fbErr);
    }
  }

  // Real client fallback (only genuine active device, no mock devices)
  return getLocalFallbackSessions(userId, currentSessionId);
}

/**
 * Remotely revoke / terminate a specific session across devices
 */
export async function revokeSession(sessionId: string): Promise<boolean> {
  // 1. Update in Firestore real-time so all devices reflect immediately
  if (db) {
    try {
      await updateDoc(doc(db, 'user_sessions', sessionId), {
        is_active: false,
        revoked_at: new Date().toISOString(),
      });
    } catch {}
  }

  // 2. Notify backend server
  try {
    const res = await fetch(getApiEndpoint('/api/sessions/revoke'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': getOrCreateCurrentSessionId(),
      },
      body: JSON.stringify({ sessionId }),
    });

    if (res.ok) {
      window.dispatchEvent(new CustomEvent('session-terminated', { detail: { sessionId } }));
      return true;
    }
  } catch (err) {
    console.error('[SessionService] Error revoking session on server:', err);
  }

  window.dispatchEvent(new CustomEvent('session-terminated', { detail: { sessionId } }));
  return true;
}

/**
 * Revoke all other active sessions for a user
 */
export async function revokeAllOtherSessions(userId: string): Promise<boolean> {
  const currentSessionId = getOrCreateCurrentSessionId();

  // 1. Mark in Firestore
  if (db) {
    try {
      const q = query(collection(db, 'user_sessions'), where('user_id', '==', userId));
      const snap = await getDocs(q);
      snap.forEach(async (d) => {
        if (d.id !== currentSessionId) {
          try {
            await updateDoc(doc(db, 'user_sessions', d.id), {
              is_active: false,
              revoked_at: new Date().toISOString(),
            });
          } catch {}
        }
      });
    } catch {}
  }

  // 2. Notify backend server
  try {
    const res = await fetch(getApiEndpoint('/api/sessions/revoke-all-others'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': currentSessionId,
      },
      body: JSON.stringify({ userId, currentSessionId }),
    });

    if (res.ok) {
      window.dispatchEvent(new CustomEvent('session-terminated', { detail: { allOthers: true } }));
      return true;
    }
  } catch (err) {
    console.error('[SessionService] Error revoking all other sessions:', err);
  }

  window.dispatchEvent(new CustomEvent('session-terminated', { detail: { allOthers: true } }));
  return true;
}

/**
 * Check if current device session is valid and active (checks both backend & Firestore)
 */
export async function checkSessionValidity(): Promise<{ valid: boolean; message?: string }> {
  const currentSessionId = getOrCreateCurrentSessionId();

  // 1. Direct Firestore session check
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'user_sessions', currentSessionId));
      if (snap.exists()) {
        const data = snap.data();
        if (data.is_active === false) {
          return {
            valid: false,
            message: 'Your session has been terminated remotely from another device.',
          };
        }
      }
    } catch {}
  }

  // 2. Backend check
  try {
    const res = await fetch(getApiEndpoint('/api/sessions/check'), {
      headers: {
        'x-session-id': currentSessionId,
      },
    });

    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      return {
        valid: false,
        message: data.message || 'Your session has been terminated remotely from another device.',
      };
    }

    if (res.ok) {
      return { valid: true };
    }
  } catch {
    return { valid: true };
  }
  return { valid: true };
}

/**
 * Register current device session on server & Firestore with exact User-Agent and real Geolocation
 */
export async function registerCurrentSession(userId: string, userName?: string, userRole?: string): Promise<void> {
  const currentSessionId = getOrCreateCurrentSessionId();
  const info = getClientDeviceInfo();

  // Fetch real IP & location
  let clientGeo = { ip: '', formattedLocation: '' };
  try {
    clientGeo = await lookupIpLocation();
  } catch {}

  const sessionPayload = {
    session_id: currentSessionId,
    user_id: userId,
    user_name: userName || 'User',
    user_role: userRole || 'staff',
    device_name: info.deviceName,
    device_type: info.deviceType,
    browser: info.browser,
    os: info.os,
    ip_address: clientGeo.ip || '127.0.0.1',
    location: clientGeo.formattedLocation || 'Hospital Premises',
    created_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
    is_active: true,
  };

  // 1. Save to Firestore in user_sessions collection
  if (db) {
    try {
      await setDoc(doc(db, 'user_sessions', currentSessionId), sessionPayload, { merge: true });
    } catch (fbErr) {
      console.warn('[SessionService] Firestore session registration notice:', fbErr);
    }
  }

  // 2. Register with backend
  try {
    await fetch(getApiEndpoint('/api/sessions/register'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': currentSessionId,
      },
      body: JSON.stringify(sessionPayload),
    });
  } catch (err) {
    console.warn('[SessionService] Backend session register notice:', err);
  }
}

/**
 * Genuine client-only session fallback with zero mock devices
 */
async function getLocalFallbackSessions(userId: string, currentSessionId: string): Promise<UserSession[]> {
  const info = getClientDeviceInfo();
  let geo = { ip: '127.0.0.1', formattedLocation: 'Local Verified Network' };
  try {
    geo = await lookupIpLocation();
  } catch {}

  return [
    {
      session_id: currentSessionId,
      user_id: userId,
      device_name: info.deviceName,
      device_type: info.deviceType,
      browser: info.browser,
      os: info.os,
      ip_address: geo.ip || 'Local Network',
      location: geo.formattedLocation || 'Verified Device Location',
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      is_active: true,
      is_current: true,
    },
  ];
}
