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
  // 1. Server session destroy & cookie header clearance via /api/logout endpoint
  try {
    await fetch('/api/logout', {
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
    fetch('/api/logout', { method: 'POST' }).catch(() => {});
  } catch {}

  // Redirect to Login cleanly
  if (navigate) {
    navigate('/login', { replace: true });
  } else if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// Mock User Database with aliases and direct role routing
export const USERS_DB = [
  {
    id: "admin",
    aliases: ["admin", "admin001", "admin-001"],
    pass: "admin123",
    role: "ADMIN",
    redirect: "/admin-dashboard",
    name: "ApexCare Admin",
  },
  {
    id: "manager",
    aliases: ["manager", "mgr001", "mgr-001"],
    pass: "manager123",
    role: "MANAGER",
    redirect: "/manager-dashboard",
    name: "Operations Manager",
  },
  {
    id: "hk001",
    aliases: ["hk001", "hk-001", "ramesh"],
    pass: "staff123",
    role: "STAFF",
    redirect: "/staff-portal",
    name: "Ramesh Sharma",
  },
  {
    id: "hk002",
    aliases: ["hk002", "hk-002", "sunita"],
    pass: "staff123",
    role: "STAFF",
    redirect: "/staff-portal",
    name: "Sunita Devi",
  },
  {
    id: "hk003",
    aliases: ["hk003", "hk-003", "amit"],
    pass: "staff123",
    role: "STAFF",
    redirect: "/staff-portal",
    name: "Amit Patel",
  },
];

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

  // 1. First check mock credentials (Guarantees instant, zero-failure login on Vercel deployment)
  const mockUser = USERS_DB.find(
    (u) =>
      u.id.toLowerCase() === cleanId ||
      u.id.toLowerCase().replace(/[-_\s]/g, '') === normalizedId ||
      (u.aliases && u.aliases.some((a) => a.toLowerCase().replace(/[-_\s]/g, '') === normalizedId))
  );

  if (mockUser) {
    if (cleanPass === mockUser.pass) {
      const roleUpper = mockUser.role.toUpperCase();
      const token = "JWT_APEXCARE_" + roleUpper + "_" + Date.now();

      // Save Session Token & Role in Local Storage
      localStorage.setItem("userToken", token);
      localStorage.setItem("userRole", roleUpper);
      localStorage.setItem("userId", mockUser.id);
      localStorage.setItem("user_token", token);
      localStorage.setItem("user_role", mockUser.role.toLowerCase());

      // Set user profile in stored application data
      const allUsers = getStoredUsers();
      const matched = allUsers.find(
        (u) =>
          u.username.toLowerCase() === mockUser.id.toLowerCase() ||
          (u.staff_id && u.staff_id.toLowerCase().replace(/[-_\s]/g, '') === normalizedId)
      );

      if (matched) {
        saveStoredCurrentUser(matched);
      } else {
        saveStoredCurrentUser({
          id: mockUser.id === 'admin' ? 100 : mockUser.id === 'manager' ? 101 : 1,
          username: mockUser.id,
          name: mockUser.name,
          role: mockUser.role.toLowerCase() as any,
          is_approved: true,
          staff_id: mockUser.id.toUpperCase(),
          assigned_area: mockUser.role === 'STAFF' ? '3rd Floor Wards' : 'Hospital Wide',
        });
      }

      // Sync Session Cookies
      try {
        document.cookie = `session=active_${mockUser.id}; Path=/; SameSite=Lax`;
        document.cookie = `user_id=${mockUser.id}; Path=/; SameSite=Lax`;
        document.cookie = `role=${mockUser.role.toLowerCase()}; Path=/; SameSite=Lax`;
        document.cookie = `authToken=${token}; Path=/; SameSite=Lax`;
        document.cookie = `userRole=${roleUpper}; Path=/; SameSite=Lax`;
      } catch {}

      // Fire server endpoint asynchronously in background
      try {
        fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffId: cleanId, password: cleanPass }),
        }).catch(() => {});
      } catch {}

      // Dynamic Role-Based Redirection
      navigate(mockUser.redirect, { replace: true });
      return true;
    } else {
      setError("Invalid credentials");
      return false;
    }
  }

  // 2. Check dynamic registered staff in hospital database
  const allUsers = getStoredUsers();
  const registered = allUsers.find((u) => {
    if (u.staff_id && u.staff_id.toLowerCase().replace(/[-_\s]/g, '') === normalizedId) return true;
    if (u.username && u.username.toLowerCase() === cleanId) return true;
    return false;
  });

  if (registered) {
    if (registered.password === cleanPass) {
      const roleUpper = registered.role.toUpperCase();
      const token = "JWT_APEXCARE_" + roleUpper + "_" + Date.now();
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
      localStorage.setItem("user_role", registered.role.toLowerCase());
      saveStoredCurrentUser(registered);

      try {
        document.cookie = `session=active_${registered.id}; Path=/; SameSite=Lax`;
        document.cookie = `user_id=${registered.id}; Path=/; SameSite=Lax`;
        document.cookie = `role=${registered.role.toLowerCase()}; Path=/; SameSite=Lax`;
        document.cookie = `authToken=${token}; Path=/; SameSite=Lax`;
        document.cookie = `userRole=${roleUpper}; Path=/; SameSite=Lax`;
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

