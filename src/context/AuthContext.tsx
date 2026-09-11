import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AppUser } from '../types';
import { getStoredUsers, getStoredCurrentUser, saveStoredCurrentUser } from '../data/mockHousekeepingData';
import { handleLogin as authServiceLogin, handleLogout as authServiceLogout } from '../services/auth';

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

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

interface AuthSnapshot {
  token: string | null;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | null;
  user: AppUser | null;
  isLoading: boolean;
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
    userProfile = getStoredCurrentUser();
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
    try {
      saveStoredCurrentUser(userProfile);
    } catch {}
  }

  return userProfile;
}

function computeAuthSnapshot(): AuthSnapshot {
  const token = getStoredToken();
  const role = getStoredRole();
  const userId = getStoredUserId();

  if (token && role) {
    const user = resolveUserProfile(role, userId);
    return {
      token,
      role,
      user,
      isLoading: false,
    };
  }

  return {
    token: null,
    role: null,
    user: null,
    isLoading: false,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Synchronous initialization ensures no initial loading flicker, no redundant mount updates,
  // and no premature redirection loops on cold starts or page refreshes.
  const [authState, setAuthState] = useState<AuthSnapshot>(() => computeAuthSnapshot());

  const restoreAuth = useCallback(() => {
    try {
      const next = computeAuthSnapshot();
      setAuthState((prev) => {
        if (
          prev.token === next.token &&
          prev.role === next.role &&
          prev.isLoading === next.isLoading &&
          prev.user?.id === next.user?.id &&
          prev.user?.username === next.user?.username &&
          prev.user?.role === next.user?.role
        ) {
          return prev;
        }
        return next;
      });
    } catch (err) {
      console.warn('Authentication restoration notice:', err);
      setAuthState((prev) => {
        if (prev.token === null && prev.role === null && prev.user === null && !prev.isLoading) {
          return prev;
        }
        return {
          token: null,
          role: null,
          user: null,
          isLoading: false,
        };
      });
    }
  }, []);

  // Listen for storage or custom auth changes across tabs or windows
  useEffect(() => {
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
        // Synchronously recompute snapshot and commit to state BEFORE navigation
        const next = computeAuthSnapshot();
        setAuthState({ ...next, isLoading: false });

        const destination =
          targetRedirect ||
          (next.role === 'ADMIN'
            ? '/admin-dashboard'
            : next.role === 'MANAGER'
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
      authServiceLogout();
      setAuthState({
        token: null,
        role: null,
        user: null,
        isLoading: false,
      });
      if (navigate) {
        navigate('/login', { replace: true });
      }
    },
    []
  );

  const value = React.useMemo<AuthContextType>(
    () => ({
      user: authState.user,
      token: authState.token,
      role: authState.role,
      isAuthenticated: Boolean(authState.token && authState.role),
      isLoading: authState.isLoading,
      login,
      logout,
      refreshAuth: restoreAuth,
    }),
    [
      authState.user,
      authState.token,
      authState.role,
      authState.isLoading,
      login,
      logout,
      restoreAuth,
    ]
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
