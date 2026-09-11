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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<'ADMIN' | 'MANAGER' | 'STAFF' | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const restoreAuth = useCallback(() => {
    try {
      // 1. Retrieve token and role from localStorage or cookies
      const storedToken =
        localStorage.getItem('userToken') ||
        localStorage.getItem('user_token') ||
        getCookie('authToken');

      const storedRole =
        localStorage.getItem('userRole') ||
        localStorage.getItem('user_role') ||
        getCookie('userRole') ||
        getCookie('role');

      const storedUserId =
        localStorage.getItem('userId') ||
        getCookie('user_id');

      if (storedToken && storedRole) {
        const roleUpper = storedRole.toUpperCase() as 'ADMIN' | 'MANAGER' | 'STAFF';

        // 2. Retrieve user object or reconstruct from stored data
        let userProfile: AppUser | null = getStoredCurrentUser();
        if (!userProfile && storedUserId) {
          const allUsers = getStoredUsers();
          const cleanId = storedUserId.toLowerCase().replace(/[-_\s]/g, '');
          userProfile =
            allUsers.find(
              (u) =>
                u.username.toLowerCase() === storedUserId.toLowerCase() ||
                (u.staff_id && u.staff_id.toLowerCase().replace(/[-_\s]/g, '') === cleanId)
            ) || null;
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
          saveStoredCurrentUser(userProfile);
        }

        setToken((prev) => (prev === storedToken ? prev : storedToken));
        setRole((prev) => (prev === roleUpper ? prev : roleUpper));
        setUser((prev) => {
          if (!prev && !userProfile) return null;
          if (
            prev &&
            userProfile &&
            prev.id === userProfile.id &&
            prev.role === userProfile.role &&
            prev.username === userProfile.username
          ) {
            return prev;
          }
          return userProfile;
        });
      } else {
        setToken((prev) => (prev === null ? null : null));
        setRole((prev) => (prev === null ? null : null));
        setUser((prev) => (prev === null ? null : null));
      }
    } catch (err) {
      console.warn('Authentication restoration notice:', err);
      setToken((prev) => (prev === null ? null : null));
      setRole((prev) => (prev === null ? null : null));
      setUser((prev) => (prev === null ? null : null));
    } finally {
      setIsLoading((prev) => (prev === false ? false : false));
    }
  }, []);

  // Check auth state on app initialization
  useEffect(() => {
    restoreAuth();

    // Listen for storage or custom auth changes across tabs or windows
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'userToken' ||
        e.key === 'userRole' ||
        e.key === 'userId' ||
        e.key === 'user_token' ||
        e.key === 'user_role'
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
      const success = await authServiceLogin(staffId, password, navigate, setError);
      if (success) {
        restoreAuth();
      }
      return success;
    },
    [restoreAuth]
  );

  const logout = useCallback(
    (navigate?: (to: string, options?: { replace?: boolean }) => void) => {
      setToken(null);
      setRole(null);
      setUser(null);
      authServiceLogout();
      if (navigate) {
        navigate('/login', { replace: true });
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
