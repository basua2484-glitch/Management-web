// src/utils/tenantStorage.ts - STRICT MULTI-TENANT ISOLATION BRIDGE

import type { AppUser, StaffUser } from '../types';
import { getStoredUsers, getStoredStaff } from '../data/mockHousekeepingData';

export const getActiveCompanyPrefix = (userOrTenantId?: string | null): string => {
  if (userOrTenantId && userOrTenantId.trim()) {
    // Matches pattern prior to role suffix (-ADM, -MGR, -SUP, -STF)
    const tenantMatch = userOrTenantId.match(/^([A-Z0-9]+(-[A-Z0-9]+)?)(?=-ADM|-MGR|-SUP|-STF|-\d+)/i);

    if (tenantMatch && tenantMatch[1]) {
      return tenantMatch[1].toUpperCase();
    }

    // Fallback safe token
    return userOrTenantId.split('-')[0].toUpperCase();
  }

  // Session fallback when userOrTenantId is not provided
  try {
    if (typeof localStorage !== 'undefined') {
      const companyCode = localStorage.getItem('company_code');
      if (companyCode && companyCode.trim()) return getActiveCompanyPrefix(companyCode.trim());

      const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('tenantId');
      if (tenantId && tenantId.trim()) return getActiveCompanyPrefix(tenantId.trim());

      const curUserStr = localStorage.getItem('hk_current_user_v2') || localStorage.getItem('currentUser');
      if (curUserStr) {
        const u = JSON.parse(curUserStr);
        const code = u?.company_prefix || u?.tenant_id || u?.tenantId || u?.id || u?.staff_id || u?.username;
        if (typeof code === 'string' && code.trim()) return getActiveCompanyPrefix(code.trim());
      }

      const userId = localStorage.getItem('userId');
      if (userId && userId.trim()) return getActiveCompanyPrefix(userId.trim());
    }
  } catch {}

  return 'GLOBAL';
};

export const filterByTenantIsolation = <T extends { tenant_id?: string; staff_id?: string }>(
  dataset: T[],
  activeTenantId: string
): T[] => {
  const targetPrefix = getActiveCompanyPrefix(activeTenantId);

  return dataset.filter((item) => {
    const itemPrefix = item.tenant_id
      ? getActiveCompanyPrefix(item.tenant_id)
      : getActiveCompanyPrefix(item.staff_id || '');

    return itemPrefix === targetPrefix;
  });
};

/**
 * Central fetch function for Users scoped to the active tenant/company prefix.
 * Automatically filters by the logged-in user's company prefix.
 */
export function fetchTenantUsers(overridePrefix?: string): AppUser[] {
  const activePrefix = overridePrefix || getActiveCompanyPrefix();
  const allUsers = getStoredUsers();

  if (!activePrefix || activePrefix === 'GLOBAL' || activePrefix === 'ALL') {
    return allUsers;
  }

  const prefixUpper = activePrefix.toUpperCase();
  return allUsers.filter((user) => {
    const uid = String(user.id || '').toUpperCase();
    if (uid.startsWith(prefixUpper)) {
      return true;
    }
    const sid = (user.staff_id || user.username || String(user.id || '')).toUpperCase();
    if (sid && sid.startsWith(prefixUpper)) {
      return true;
    }
    const tid = (user.tenant_id || user.tenantId || user.company_prefix || '').toUpperCase();
    return tid === prefixUpper;
  });
}

/**
 * Central fetch function for Staff Roster scoped to the active tenant/company prefix.
 * Automatically filters by the logged-in user's company prefix.
 */
export function fetchTenantStaff(overridePrefix?: string): StaffUser[] {
  const activePrefix = overridePrefix || getActiveCompanyPrefix();
  const allStaff = getStoredStaff();

  if (!activePrefix || activePrefix === 'GLOBAL' || activePrefix === 'ALL') {
    return allStaff;
  }

  const prefixUpper = activePrefix.toUpperCase();
  return allStaff.filter((staff) => {
    const code = (staff.staffCode || (staff as any).staff_id || String(staff.id || '')).toUpperCase();
    if (code && code.startsWith(prefixUpper)) {
      return true;
    }
    const tid = (staff.tenant_id || staff.tenantId || '').toUpperCase();
    return tid === prefixUpper;
  });
}
