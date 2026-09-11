import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AppUser } from '../types';
import { getStoredUsers, getStoredCurrentUser, saveStoredCurrentUser } from '../data/mockHousekeepingData';
import { handleLogin as authServiceLogin, handleLogout as authServiceLogout } from '../services/auth';
import { auth } from '../firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';

interface AuthContextType {
  user: AppUser | null;
  token: string | null;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    staffId: string,
    password: string,
    navigate: (to: string, options?: { replace?: boolean }) => void,
    setError: (msg: string) => void
  ) => Promise<boolean>;
  logout: (navigate?: (to: string, options?: { replace?: boolean }) => void) => void;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isSameUser(a: AppUser | null, b: AppUser | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.username === b.username &&
    a.role === b.role &&
    a.staff_id === b.staff_id &&
    a.name === b.name &&
    a.is_approved === b.is_approved
  );
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function getStoredToken(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('userToken') || localStorage.getItem('user_token');
      if (stored) return stored;
    }
    return getCookie('authToken');
  } catch {
    return null;
  }
}

function getStoredRole(): 'ADMIN' | 'MANAGER' | 'STAFF' | null {
  try {
    let rawRole: string | null = null;
    if (typeof localStorage !== 'undefined') {
      rawRole = localStorage.getItem('userRole') || localStorage.getItem('user_role');
    }
    if (!rawRole) {
      rawRole = getCookie('userRole') || getCookie('role');
    }
    if (rawRole) {
      const upper = rawRole.toUpperCase();
      if (upper === 'ADMIN' || upper === 'MANAGER' || upper === 'STAFF') {
        return upper;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function getStoredUserId(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const id = localStorage.getItem('userId');
      if (id) return id;
    }
    return getCookie('user_id');
  } catch {
    return null;
  }
}

function resolveUserProfile(
  roleUpper: 'ADMIN' | 'MANAGER' | 'STAFF',
  storedUserId: string | null
): AppUser {
  let userProfile: AppUser | null = null;
  try {
    const stored = getStoredCurrentUser();
    if (stored && stored.role && stored.role.toUpperCase() === roleUpper) {
      if (
        !storedUserId ||
        stored.username.toLowerCase() === storedUserId.toLowerCase() ||
        (stored.staff_id &&
          stored.staff_id.toLowerCase().replace(/[-_\s]/g, '') ===
            storedUserId.toLowerCase().replace(/[-_\s]/g, ''))
      ) {
        userProfile = stored;
      }
    }
  } catch {}

  if (!userProfile && storedUserId) {
    try {
      const allUsers = getStoredUsers();
      const cleanId = storedUserId.toLowerCase().replace(/[-_\s]/g, '');
      userProfile =
        allUsers.find(
          (u) =>
            u.username.toLowerCase() === storedUserId.toLowerCase() ||
            (u.staff_id && u.staff_id.toLowerCase().replace(/[-_\s]/g, '') === cleanId)
        ) || null;
    } catch {}
  }

  if (!userProfile) {
    try {
      const allUsers = getStoredUsers();
      userProfile = allUsers.find((u) => u.role && u.role.toUpperCase() === roleUpper) || null;
    } catch {}
  }

  if (!userProfile) {
    const fallbackId =
      storedUserId ||
      (roleUpper === 'ADMIN' ? 'admin' : roleUpper === 'MANAGER' ? 'manager' : 'hk001');

    userProfile = {
      id: fallbackId === 'admin' ? 100 : fallbackId === 'manager' ? 101 : 1,
      username: fallbackId,
      name:
        fallbackId === 'admin'
          ? 'ApexCare Admin'
          : fallbackId === 'manager'
          ? 'Operations Manager'
          : `Staff Member (${fallbackId.toUpperCase()})`,
      role: roleUpper.toLowerCase() as any,
      is_approved: true,
      staff_id: fallbackId.toUpperCase(),
      assigned_area: roleUpper === 'STAFF' ? '3rd Floor Wards' : 'Hospital Wide',
    };
  }

  // Ensure current user is saved in storage for components that inspect it
  try {
    saveStoredCurrentUser(userProfile);
  } catch {}

  return userProfile;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Synchronous initial check for persistent storage - instant boot, no refresh lag
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [role, setRole] = useState<'ADMIN' | 'MANAGER' | 'STAFF' | null>(() => getStoredRole());
  const [user, setUser] = useState<AppUser | null>(() => {
    const t = getStoredToken();
    const r = getStoredRole();
    const uid = getStoredUserId();
    if (t && r) {
      return resolveUserProfile(r, uid);
    }
    return null;
  });

  // Since storage is checked synchronously, initialize isLoading to false immediately
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Stable authentication restoration function with guarded functional state setters
  const restoreAuth = useCallback(() => {
    try {
      const storedToken = getStoredToken();
      const storedRole = getStoredRole();
      const storedUserId = getStoredUserId();

      if (storedToken && storedRole) {
        const userProfile = resolveUserProfile(storedRole, storedUserId);

        // Guarded state setters - only trigger re-renders if actual value changes
        setToken((prev) => (prev !== storedToken ? storedToken : prev));
        setRole((prev) => (prev !== storedRole ? storedRole : prev));
        setUser((prev) => (isSameUser(prev, userProfile) ? prev : userProfile));
      } else {
        // Only clear if neither local session nor Firebase user is active
        if (!auth?.currentUser) {
          setToken((prev) => (prev !== null ? null : prev));
          setRole((prev) => (prev !== null ? null : prev));
          setUser((prev) => (prev !== null ? null : prev));
        }
      }
    } catch (err) {
      console.warn('Authentication restoration notice:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync with Firebase Authentication & cross-tab/window storage updates
  useEffect(() => {
    restoreAuth();

    // 1. Firebase onAuthStateChanged listener to persist session across reloads
    let unsubscribeFirebase: (() => void) | undefined;
    if (auth) {
      try {
        unsubscribeFirebase = onAuthStateChanged(
          auth,
          async (firebaseUser: FirebaseUser | null) => {
            try {
              if (firebaseUser) {
                const fbToken =
                  (await firebaseUser.getIdToken().catch(() => null)) ||
                  `FB_${firebaseUser.uid}`;
                const currentRole = getStoredRole();
                const emailLower = (firebaseUser.email || '').toLowerCase();
                let resolvedRole: 'ADMIN' | 'MANAGER' | 'STAFF' = currentRole || 'STAFF';

                if (emailLower.includes('admin')) {
                  resolvedRole = 'ADMIN';
                } else if (emailLower.includes('manager')) {
                  resolvedRole = 'MANAGER';
                }

                const storedUserId = getStoredUserId() || firebaseUser.uid;
                let userProfile = resolveUserProfile(resolvedRole, storedUserId);
                if (firebaseUser.displayName && userProfile) {
                  userProfile = {
                    ...userProfile,
                    name: firebaseUser.displayName || userProfile.name,
                  };
                }

                // Strictly prevent re-render loops by checking state equality
                setToken((prev) => (prev === fbToken ? prev : fbToken));
                setRole((prev) => (prev === resolvedRole ? prev : resolvedRole));
                setUser((prev) => (isSameUser(prev, userProfile) ? prev : userProfile));
              } else {
                // No active Firebase user -> check if local hospital session exists
                const storedToken = getStoredToken();
                const storedRole = getStoredRole();
                if (!storedToken || !storedRole) {
                  setToken((prev) => (prev !== null ? null : prev));
                  setRole((prev) => (prev !== null ? null : prev));
                  setUser((prev) => (prev !== null ? null : prev));
                }
              }
            } catch (authError) {
              console.warn('Firebase auth state listener error:', authError);
            } finally {
              setIsLoading((prev) => (prev ? false : prev));
            }
          },
          (err) => {
            console.warn('Firebase onAuthStateChanged error:', err);
            setIsLoading((prev) => (prev ? false : prev));
          }
        );
      } catch (err) {
        console.warn('Firebase subscription error:', err);
        setIsLoading((prev) => (prev ? false : prev));
      }
    } else {
      setIsLoading((prev) => (prev ? false : prev));
    }

    // Safety timeout to guarantee ProtectedRoute never remains locked
    const safetyTimeout = setTimeout(() => {
      setIsLoading((prev) => (prev ? false : prev));
    }, 1200);

    // 2. Storage event listeners for multi-tab synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'userToken' ||
        e.key === 'userRole' ||
        e.key === 'userId' ||
        e.key === 'user_token' ||
        e.key === 'user_role' ||
        e.key === null
      ) {
        restoreAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-state-change', restoreAuth);

    return () => {
      if (typeof unsubscribeFirebase === 'function') {
        unsubscribeFirebase();
      }
      clearTimeout(safetyTimeout);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-state-change', restoreAuth);
    };
  }, [restoreAuth]);

  const login = useCallback(
    async (
      staffId: string,
      password: string,
      navigate: (to: string, options?: { replace?: boolean }) => void,
      setError: (msg: string) => void
    ): Promise<boolean> => {
      let targetRedirect = '';
      const captureNavigate = (to: string) => {
        targetRedirect = to;
      };

      const success = await authServiceLogin(staffId, password, captureNavigate, setError);
      if (success) {
        const storedToken = getStoredToken();
        const storedRole = getStoredRole();
        const storedUserId = getStoredUserId();
        const userProfile = storedRole ? resolveUserProfile(storedRole, storedUserId) : null;

        // Synchronously update context state before route navigation
        setToken(storedToken);
        setRole(storedRole);
        setUser(userProfile);
        setIsLoading(false);

        const destination =
          targetRedirect ||
          (storedRole === 'ADMIN'
            ? '/admin-dashboard'
            : storedRole === 'MANAGER'
            ? '/manager-dashboard'
            : '/staff-portal');

        navigate(destination, { replace: true });
      }
      return success;
    },
    []
  );

  const logout = useCallback(
    (navigate?: (to: string, options?: { replace?: boolean }) => void) => {
      // 1. Wipe local tokens, storage, and cookies
      try {
        authServiceLogout();
      } catch (e) {
        console.warn('authServiceLogout error:', e);
      }

      // 2. Sign out Firebase if initialized
      if (auth) {
        try {
          auth.signOut().catch(() => {});
        } catch {}
      }

      // 3. Clear serverless session
      try {
        fetch('/api/logout', { method: 'POST' }).catch(() => {});
      } catch {}

      // 4. Immediately clear React AuthContext state
      setToken(null);
      setRole(null);
      setUser(null);
      setIsLoading(false);

      // 5. Navigate to login
      if (navigate) {
        navigate('/login', { replace: true });
      } else if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    },
    []
  );

  const value = React.useMemo<AuthContextType>(
    () => ({
      user,
      token,
      role,
      isAuthenticated: Boolean(token && role),
      isLoading,
      login,
      logout,
      refreshAuth: restoreAuth,
    }),
    [user, token, role, isLoading, login, logout, restoreAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

