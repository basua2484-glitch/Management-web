import { getStoredUsers, saveStoredUsers, saveStoredCurrentUser } from '../data/mockHousekeepingData';
import { logout as firebaseLogout } from './firebase';
import { getApiEndpoint } from './apiConfig';
import { fetchLiveUsers } from './firestoreService';

export interface LogoutResult {
  success: boolean;
  redirect: string;
}

/**
 * Handles Flask logout lifecycle:
 * @app.route('/logout')
 * def logout():
 *     session.clear()  # Server session destroy
 *     response = make_response(redirect('/login'))
 *     response.set_cookie('session', '', expires=0)  # Clear cookies
 *     return response
 */
export async function performLogout(): Promise<LogoutResult> {
  // 1. Server session destroy & cookie header clearance via /api/logout endpoint
  try {
    await fetch(getApiEndpoint('/api/logout'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    }).catch(() => {});
  } catch (err) {
    console.warn('Server logout request warning:', err);
  }

  // 2. Clear client-side session cookies (expires=0)
  try {
    const expiredCookies = [
      'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
      'session_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
      'authToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
      'userRole=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
      'user_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
      'role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
    ];
    expiredCookies.forEach((c) => {
      document.cookie = c;
    });
  } catch (err) {
    console.warn('Cookie removal warning:', err);
  }

  // 3. Local Tokens Wipe Out & Clear browser session storage
  try {
    localStorage.removeItem("userToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userId");
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("company_code");
    localStorage.removeItem("tenant_id");
    localStorage.removeItem("tenantId");
    localStorage.removeItem("company_name");
    sessionStorage.clear();
  } catch (err) {
    console.warn('Storage wipe warning:', err);
  }

  // 4. Destroy current user in persistent storage
  saveStoredCurrentUser(null);

  // 5. Firebase sign out if connected
  try {
    await firebaseLogout().catch(() => {});
  } catch (err) {
    // Ignore Firebase logout failure
  }

  // 6. Notify all listeners in the window
  try {
    window.dispatchEvent(new Event('auth-state-change'));
  } catch (err) {
    // Ignore event dispatch error
  }

  return {
    success: true,
    redirect: '/login',
  };
}

/**
 * Protected Route Decorator matching Python Flask:
 * 
 * def admin_required(f):
 *     @wraps(f)
 *     def decorated_function(*args, **kwargs):
 *         # Check if user is logged in AND is an admin
 *         if 'user_id' not in session or session.get('role') != 'admin':
 *             return redirect('/login')  # Unauthorized attempt -> Redirect to login
 *         return f(*args, **kwargs)
 *     return decorated_function
 */
export function checkAdminRequired(user: { id?: number; role?: string } | null): {
  authorized: boolean;
  redirectUrl?: string;
} {
  // Check if user is logged in AND is an admin or operations manager
  if (!user || (!user.id && !user.role)) {
    return {
      authorized: false,
      redirectUrl: '/login',
    };
  }
  const roleLower = (user.role || '').toLowerCase();
  if (roleLower !== 'admin' && roleLower !== 'manager') {
    return {
      authorized: false,
      redirectUrl: '/unauthorized',
    };
  }
  return {
    authorized: true,
  };
}

export function adminRequired<T extends (...args: any[]) => any>(
  getUser: () => { id?: number; role?: string } | null,
  fn: T,
  onUnauthorized?: () => void
): (...args: Parameters<T>) => ReturnType<T> | void {
  return (...args: Parameters<T>) => {
    const user = getUser();
    const check = checkAdminRequired(user);
    if (!check.authorized) {
      onUnauthorized?.();
      return;
    }
    return fn(...args);
  };
}

/**
 * Direct client-side handleLogout:
 * Clears local tokens, cookies, session storage, and redirects to /login.
 */
export function handleLogout(navigate?: (to: string, options?: { replace?: boolean }) => void): void {
  // Local Tokens Wipe Out
  try {
    localStorage.removeItem("userToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userId");
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_role");
  } catch (e) {
    console.warn("Failed to remove user tokens:", e);
  }

  try {
    sessionStorage.clear();
  } catch (e) {
    console.warn("Failed to clear sessionStorage:", e);
  }

  // Clear local session user
  saveStoredCurrentUser(null);

  // Clear session cookies
  try {
    const expiredCookies = [
      'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
      'session_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
      'authToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
      'userRole=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
      'user_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
      'role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;',
    ];
    expiredCookies.forEach((c) => {
      document.cookie = c;
    });
  } catch (e) {}

  try {
    window.dispatchEvent(new Event('auth-state-change'));
  } catch (e) {}

  // Trigger server logout
  try {
    fetch(getApiEndpoint('/api/logout'), { method: 'POST' }).catch(() => {});
  } catch {}

  // Redirect to Login cleanly
  if (navigate) {
    navigate('/login', { replace: true });
  } else if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// System Administration Accounts with direct role routing (Starts clean with 0 seed accounts)
export const USERS_DB: {
  id: string;
  aliases?: string[];
  pass: string;
  role: string;
  redirect: string;
  name: string;
}[] = [];

export const handleLogin = async (
  staffId: string,
  password: string,
  navigate: (to: string, options?: { replace?: boolean }) => void,
  setError: (msg: string) => void
): Promise<boolean> => {
  const cleanId = String(staffId || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim();
  const normalizedId = cleanId.replace(/[-_\s]/g, '');

  if (!cleanId || !cleanPass) {
    setError("Please fill in all fields.");
    return false;
  }

  // 1. Check local registered database across all tenants during authentication
  let allUsers = getStoredUsers('ALL');

  // Also check direct housekeeping_users localStorage array
  let customFallbackUsers: any[] = [];
  try {
    const rawHkUsers = localStorage.getItem('housekeeping_users');
    if (rawHkUsers) {
      customFallbackUsers = JSON.parse(rawHkUsers);
    }
  } catch {}

  // If user is not found locally, query live Firestore database
  const localMatch = allUsers.find((u) => {
    if (u.staff_id && u.staff_id.toLowerCase().replace(/[-_\s]/g, '') === normalizedId) return true;
    if (u.username && u.username.toLowerCase() === cleanId) return true;
    return false;
  }) || customFallbackUsers.find((u) => {
    const sid = (u.id || u.staff_id || u.username || '').toString().toLowerCase().replace(/[-_\s]/g, '');
    const uname = (u.username || u.id || '').toString().toLowerCase();
    return sid === normalizedId || uname === cleanId;
  });

  if (!localMatch) {
    try {
      const liveCloudUsers = await fetchLiveUsers();
      if (liveCloudUsers && liveCloudUsers.length > 0) {
        allUsers = liveCloudUsers;
        saveStoredUsers(liveCloudUsers);
      }
    } catch {}
  }

  // Merge any custom fallback users into allUsers if not already present
  if (customFallbackUsers.length > 0) {
    customFallbackUsers.forEach((cu) => {
      const cid = (cu.id || cu.staff_id || cu.username || '').toString();
      if (cid && !allUsers.some((u) => (u.staff_id && u.staff_id.toLowerCase() === cid.toLowerCase()) || (u.username && u.username.toLowerCase() === cid.toLowerCase()))) {
        allUsers.push({
          id: cu.id || cid,
          staff_id: cid,
          username: cu.username || cid,
          role: (cu.role || 'admin').toLowerCase() as any,
          full_name: cu.fullName || cu.full_name || cu.name || 'Admin',
          name: cu.fullName || cu.full_name || cu.name || 'Admin',
          password: cu.password,
          raw_password_vault: cu.password,
          password_hash: cu.password,
          status: 'ACTIVE',
          is_approved: true,
          company_name: cu.tenantName || cu.company_name,
          tenant_id: cu.tenantId || cu.tenant_id,
          duty_type: 'FIXED',
          fixed_department: 'Hospital Wide',
          is_temp_reliever: false,
          temp_department: null,
          assigned_shift: '7-3',
          weeklyOffDay: 'Sunday',
          leaveBalance: { casual: 12, sick: 7, paid: 15 },
          leaveRequests: [],
        });
      }
    });
  }

  if (allUsers.length === 0) {
    setError("0 registered accounts found in system. Please use 'Register Company' to create your organization.");
    return false;
  }

  // 2. Check dynamic registered staff in hospital database
  const registered = allUsers.find((u) => {
    if (u.staff_id && u.staff_id.toLowerCase().replace(/[-_\s]/g, '') === normalizedId) return true;
    if (u.username && u.username.toLowerCase() === cleanId) return true;
    return false;
  });

  if (registered) {
    const isPassValid =
      registered.password === cleanPass ||
      registered.raw_password_vault === cleanPass ||
      (registered.password_hash && registered.password_hash.endsWith(cleanPass));

    if (isPassValid) {
      const roleUpper = registered.role.toUpperCase();
      const token = "JWT_APEXCARE_" + roleUpper + "_" + Date.now();
      const redirect =
        roleUpper === 'ADMIN'
          ? '/admin-dashboard'
          : roleUpper === 'MANAGER'
          ? '/manager-dashboard'
          : roleUpper === 'SUPERVISOR'
          ? '/supervisor/dashboard'
          : '/staff/dashboard';

      localStorage.setItem("userToken", token);
      localStorage.setItem("userRole", roleUpper);
      localStorage.setItem("userId", registered.staff_id || registered.username);
      localStorage.setItem("user_token", token);
      localStorage.setItem("user_role", registered.role.toLowerCase());
      
      const tid = registered.tenant_id || registered.tenantId || '';
      const staffCode = registered.staff_id || registered.username || '';
      const prefixMatch = String(staffCode).match(/^([A-Za-z0-9]+)-/);
      const derivedPrefix = registered.company_prefix || (prefixMatch ? prefixMatch[1].toUpperCase() : tid || 'APEX');
      
      localStorage.setItem("company_code", derivedPrefix);
      localStorage.setItem("tenant_id", tid || derivedPrefix);
      localStorage.setItem("tenantId", tid || derivedPrefix);
      if (registered.company_name) {
        localStorage.setItem("company_name", registered.company_name);
      }
      saveStoredCurrentUser({
        ...registered,
        tenant_id: tid || derivedPrefix,
        tenantId: tid || derivedPrefix,
        company_prefix: derivedPrefix,
      });

      try {
        document.cookie = `session=active_${registered.id}; Path=/; SameSite=Lax`;
        document.cookie = `user_id=${registered.id}; Path=/; SameSite=Lax`;
        document.cookie = `role=${registered.role.toLowerCase()}; Path=/; SameSite=Lax`;
        document.cookie = `authToken=${token}; Path=/; SameSite=Lax`;
        document.cookie = `userRole=${roleUpper}; Path=/; SameSite=Lax`;
        if (registered.tenant_id) {
          document.cookie = `tenant_id=${registered.tenant_id}; Path=/; SameSite=Lax`;
        }
      } catch {}

      navigate(redirect, { replace: true });
      return true;
    } else {
      setError("Invalid credentials");
      return false;
    }
  }

  // 3. Fallback: Server-side /api/login endpoint with bcrypt & signed JWT (for custom remote users)
  try {
    const res = await fetch(getApiEndpoint('/api/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: cleanId, password: cleanPass }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.token) {
        const roleUpper = (data.role || 'STAFF').toUpperCase();
        localStorage.setItem("userToken", data.token);
        localStorage.setItem("userRole", roleUpper);
        localStorage.setItem("userId", cleanId);
        localStorage.setItem("user_token", data.token);
        localStorage.setItem("user_role", roleUpper.toLowerCase());

        const dest =
          data.redirect ||
          (roleUpper === 'ADMIN'
            ? '/admin-dashboard'
            : roleUpper === 'MANAGER'
            ? '/manager-dashboard'
            : '/staff-portal');
        navigate(dest, { replace: true });
        return true;
      }
    } else if (res.status === 401 || res.status === 400) {
      const errorData = await res.json().catch(() => ({}));
      setError(errorData.error || "Invalid credentials");
      return false;
    }
  } catch (err) {
    console.warn("Backend /api/login error:", err);
  }

  setError("Invalid credentials");
  return false;
};

