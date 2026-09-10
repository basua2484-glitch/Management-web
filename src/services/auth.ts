import { getStoredUsers, saveStoredCurrentUser } from '../data/mockHousekeepingData';
import { logout as firebaseLogout } from './firebase';

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
  // 1. Server session destroy & cookie header clearance via /logout endpoint
  try {
    await fetch('/logout', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    }).catch(() => {
      // Fallback in case POST not accepted
      return fetch('/api/logout', { method: 'POST', credentials: 'include' });
    });
  } catch (err) {
    console.warn('Server logout request warning:', err);
  }

  // 2. Clear client-side session cookies (expires=0)
  try {
    const expiredCookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax';
    document.cookie = expiredCookie;
    document.cookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;';
    // Clear any other session tokens
    document.cookie = 'session_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;';
    document.cookie = 'auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;';
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

  // 6. Update browser URL to /login if possible
  try {
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState({}, '', '/login');
    }
  } catch (err) {
    // Ignore history error
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
  // Check if user is logged in AND is an admin
  if (!user || !user.id || user.role !== 'admin') {
    return {
      authorized: false,
      redirectUrl: '/login',
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
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState({}, '', check.redirectUrl || '/login');
      }
      onUnauthorized?.();
      return;
    }
    return fn(...args);
  };
}

/**
 * Direct client-side handleLogout:
 * function handleLogout() {
 *     // Local Tokens Wipe Out
 *     localStorage.removeItem("user_token");
 *     localStorage.removeItem("user_role");
 *     sessionStorage.clear();
 *     
 *     // Redirect to Login
 *     window.location.href = "/login";
 * }
 */
export function handleLogout(): void {
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
    document.cookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;';
    document.cookie = 'user_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;';
    document.cookie = 'role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;';
  } catch (e) {}

  // Redirect to Login
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
}

// Mock User Database (Aap ise apne Backend API / Firebase se replace kar sakte hain)
export const USERS_DB = [
  { id: "admin", pass: "admin123", role: "ADMIN", redirect: "/admin-dashboard" },
  { id: "manager", pass: "manager123", role: "MANAGER", redirect: "/manager-dashboard" },
  { id: "hk001", pass: "staff123", role: "STAFF", redirect: "/staff-portal" }
];

export const handleLogin = async (
  staffId: string,
  password: string,
  navigate: (to: string, options?: { replace?: boolean }) => void,
  setError: (msg: string) => void
): Promise<boolean> => {
  const cleanId = staffId.trim().toLowerCase();
  const cleanPass = password;

  // 1. Try server-side /api/login endpoint with bcrypt & signed JWT
  try {
    const res = await fetch('/api/login', {
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

        const allUsers = getStoredUsers();
        const matched = allUsers.find(
          (u) =>
            u.username.toLowerCase() === cleanId ||
            (u.staff_id && u.staff_id.toLowerCase().replace(/[-_\s]/g, '') === cleanId.replace(/[-_\s]/g, ''))
        );
        if (matched) {
          saveStoredCurrentUser(matched);
        } else {
          saveStoredCurrentUser({
            id: cleanId === 'admin' ? 1 : cleanId === 'manager' ? 2 : 3,
            username: cleanId,
            name:
              cleanId === 'admin'
                ? 'ApexCare Admin'
                : cleanId === 'manager'
                ? 'Operations Manager'
                : `Staff Member (${cleanId.toUpperCase()})`,
            role: roleUpper.toLowerCase() as any,
            is_approved: true,
            staff_id: cleanId.toUpperCase(),
            assigned_area: roleUpper === 'STAFF' ? 'General Ward' : 'Hospital Wide',
          });
        }

        const dest = data.redirect || (roleUpper === 'ADMIN' ? '/admin-dashboard' : roleUpper === 'MANAGER' ? '/manager-dashboard' : '/staff-portal');
        navigate(dest, { replace: true });
        return true;
      }
    } else if (res.status === 401 || res.status === 400) {
      const errorData = await res.json().catch(() => ({}));
      setError(errorData.error || "Invalid credentials");
      return false;
    }
  } catch (err) {
    // Graceful fallback to client-side database verification if offline
    console.warn("Backend /api/login offline, using client database verification:", err);
  }

  // 2. Credentials Verification from USERS_DB
  const user = USERS_DB.find(
    (u) => u.id.toLowerCase() === cleanId && u.pass === cleanPass
  );

  if (!user) {
    // Also check dynamic registered staff in mock/persistent storage
    const allUsers = getStoredUsers();
    const registered = allUsers.find((u) => {
      if (u.staff_id && u.staff_id.toLowerCase().replace(/[-_\s]/g, '') === cleanId.replace(/[-_\s]/g, '')) return true;
      if (u.username && u.username.toLowerCase() === cleanId) return true;
      return false;
    });

    if (registered && registered.password === cleanPass) {
      const roleUpper = registered.role.toUpperCase();
      const token = "JWT_SECRET_SESSION_TOKEN_" + Date.now();
      const redirect =
        roleUpper === 'ADMIN'
          ? '/admin-dashboard'
          : roleUpper === 'MANAGER'
          ? '/manager-dashboard'
          : '/staff-portal';

      localStorage.setItem("userToken", token);
      localStorage.setItem("userRole", roleUpper);
      localStorage.setItem("userId", registered.staff_id || registered.username);
      localStorage.setItem("user_token", token);
      localStorage.setItem("user_role", registered.role);
      saveStoredCurrentUser(registered);

      navigate(redirect, { replace: true });
      return true;
    }

    setError("Invalid credentials");
    return false;
  }

  // 3. Save Session Token & Role in Local Storage / Session
  const token = "JWT_SECRET_SESSION_TOKEN_" + Date.now();
  localStorage.setItem("userToken", token);
  localStorage.setItem("userRole", user.role);
  localStorage.setItem("userId", user.id);

  // Cross-compatibility session keys
  localStorage.setItem("user_token", token);
  localStorage.setItem("user_role", user.role.toLowerCase());

  // Set current user details for application views
  const allUsers = getStoredUsers();
  const matched = allUsers.find(
    (u) =>
      u.username.toLowerCase() === user.id.toLowerCase() ||
      (u.staff_id && u.staff_id.toLowerCase().replace(/[-_\s]/g, '') === user.id.toLowerCase().replace(/[-_\s]/g, ''))
  );

  if (matched) {
    saveStoredCurrentUser(matched);
  } else {
    saveStoredCurrentUser({
      id: user.id === 'admin' ? 1 : user.id === 'manager' ? 2 : 3,
      username: user.id,
      name:
        user.id === 'admin'
          ? 'ApexCare Admin'
          : user.id === 'manager'
          ? 'Operations Manager'
          : `Staff Member (${user.id.toUpperCase()})`,
      role: user.role.toLowerCase() as any,
      is_approved: true,
      staff_id: user.id.toUpperCase(),
      assigned_area: user.role === 'STAFF' ? 'General Ward' : 'Hospital Wide',
    });
  }

  try {
    document.cookie = `session=active_${user.id}; Path=/; SameSite=Lax`;
    document.cookie = `user_id=${user.id}; Path=/; SameSite=Lax`;
    document.cookie = `role=${user.role.toLowerCase()}; Path=/; SameSite=Lax`;
  } catch (e) {}

  // 4. Automatic Role-Based Dynamic Redirection
  navigate(user.redirect, { replace: true });
  return true;
};

