import { saveStoredCurrentUser } from '../data/mockHousekeepingData';
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
    window.location.href = '/login';
  }
}

