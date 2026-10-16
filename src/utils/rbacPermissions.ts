import type {
  PermissionAction,
  RoleName,
  RolePermissionsMatrix,
  UserCustomPermissionsMap,
} from '../types/permissionsAndPosts';
import { DEFAULT_ROLE_PERMISSIONS } from '../types/permissionsAndPosts';
import type { AppUser, StaffUser } from '../types';

const ROLE_PERMS_KEY = 'basu_role_permissions_matrix_v2';
const USER_PERMS_KEY = 'basu_user_custom_permissions_v2';

export function normalizeRoleToRoleName(role?: string): RoleName {
  const r = (role || '').toLowerCase().trim();
  if (r === 'admin' || r === 'master_admin') return 'MASTER_ADMIN';
  if (r === 'manager' || r === 'operations_manager') return 'OPERATIONS_MANAGER';
  if (r === 'supervisor') return 'SUPERVISOR';
  return 'STAFF';
}

/**
 * Retrieve cached or saved role permission matrix
 */
export function getStoredRolePermissions(): RolePermissionsMatrix {
  try {
    const raw = localStorage.getItem(ROLE_PERMS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure MASTER_ADMIN is always fully privileged
      return {
        ...DEFAULT_ROLE_PERMISSIONS,
        ...parsed,
        MASTER_ADMIN: { ...DEFAULT_ROLE_PERMISSIONS.MASTER_ADMIN },
      };
    }
  } catch (err) {
    console.warn('[RBAC] Error loading role permissions from storage:', err);
  }
  return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
}

/**
 * Retrieve stored user custom permission overrides
 */
export function getStoredUserCustomPermissions(): UserCustomPermissionsMap {
  try {
    const raw = localStorage.getItem(USER_PERMS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[RBAC] Error loading user custom permissions from storage:', err);
  }
  return {};
}

/**
 * Save role permission matrix to localStorage and sync to backend API
 */
export async function saveRolePermissionsMatrix(
  matrix: RolePermissionsMatrix,
  requesterUser?: AppUser | null
): Promise<boolean> {
  try {
    // Master admin permissions are always all true
    const sanitizedMatrix: RolePermissionsMatrix = {
      ...matrix,
      MASTER_ADMIN: { ...DEFAULT_ROLE_PERMISSIONS.MASTER_ADMIN },
    };

    localStorage.setItem(ROLE_PERMS_KEY, JSON.stringify(sanitizedMatrix));

    // Dispatch instant sync event across frontend
    window.dispatchEvent(new CustomEvent('permissions-updated', { detail: { matrix: sanitizedMatrix } }));

    // Sync with backend API
    const requesterRole = requesterUser?.role || 'admin';
    const requesterId = String(requesterUser?.id || requesterUser?.staff_id || 'admin');

    await fetch('/api/permissions/matrix', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': requesterRole,
        'x-user-id': requesterId,
      },
      body: JSON.stringify({ matrix: sanitizedMatrix }),
    }).catch((err) => {
      console.warn('[RBAC] Backend sync failed, local changes retained:', err);
    });

    return true;
  } catch (err) {
    console.error('[RBAC] Failed to save role permissions matrix:', err);
    return false;
  }
}

/**
 * Save per-user custom permission overrides
 */
export async function saveUserCustomPermissions(
  userId: string,
  overrides: Partial<Record<PermissionAction, boolean>>,
  requesterUser?: AppUser | null
): Promise<boolean> {
  try {
    const currentMap = getStoredUserCustomPermissions();
    const updatedMap = {
      ...currentMap,
      [userId]: overrides,
    };

    localStorage.setItem(USER_PERMS_KEY, JSON.stringify(updatedMap));

    // Dispatch event
    window.dispatchEvent(new CustomEvent('permissions-updated', { detail: { userCustomMap: updatedMap } }));

    // Sync with backend API
    const requesterRole = requesterUser?.role || 'admin';
    const requesterId = String(requesterUser?.id || requesterUser?.staff_id || 'admin');

    await fetch(`/api/permissions/user/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': requesterRole,
        'x-user-id': requesterId,
      },
      body: JSON.stringify({ overrides }),
    }).catch((err) => {
      console.warn('[RBAC] Backend user perms sync failed:', err);
    });

    return true;
  } catch (err) {
    console.error('[RBAC] Failed to save user custom permissions:', err);
    return false;
  }
}

/**
 * Reset all permissions back to system defaults
 */
export async function resetPermissionsToDefaults(requesterUser?: AppUser | null): Promise<void> {
  try {
    localStorage.setItem(ROLE_PERMS_KEY, JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
    localStorage.setItem(USER_PERMS_KEY, JSON.stringify({}));

    window.dispatchEvent(new CustomEvent('permissions-updated', { detail: { reset: true } }));

    const requesterRole = requesterUser?.role || 'admin';
    const requesterId = String(requesterUser?.id || requesterUser?.staff_id || 'admin');

    await fetch('/api/permissions/reset', {
      method: 'POST',
      headers: {
        'x-user-role': requesterRole,
        'x-user-id': requesterId,
      },
    }).catch(() => {});
  } catch (err) {
    console.error('[RBAC] Failed to reset permissions:', err);
  }
}

/**
 * Master permission check:
 * 1. If MASTER_ADMIN or staff_id BASU-ADM-001 -> ALWAYS true
 * 2. If user has explicit individual override for action -> Return override boolean
 * 3. Fall back to current role permission from dynamic matrix
 */
export function checkPermission(
  user: AppUser | StaffUser | null | undefined,
  action: PermissionAction
): boolean {
  if (!user) return false;

  const role = (user.role || '').toLowerCase().trim();
  const staffId = ((user as any).staff_id || '').toUpperCase().trim();

  // 1. Master Admin has full, immutable access
  if (role === 'admin' || role === 'master_admin' || staffId === 'BASU-ADM-001') {
    return true;
  }

  // 2. Check individual user custom override
  const userKey = String(user.id || (user as any).staff_id || '').trim();
  const customMap = getStoredUserCustomPermissions();
  if (userKey && customMap[userKey] && typeof customMap[userKey][action] === 'boolean') {
    return customMap[userKey][action] as boolean;
  }

  // Also check by staff_id if userKey was id
  if (staffId && customMap[staffId] && typeof customMap[staffId][action] === 'boolean') {
    return customMap[staffId][action] as boolean;
  }

  // 3. Fall back to role matrix
  const roleName = normalizeRoleToRoleName(role);
  const matrix = getStoredRolePermissions();
  const rolePerms = matrix[roleName];

  return rolePerms ? Boolean(rolePerms[action]) : false;
}
