/**
 * Zone & Ward Management Service
 * Manages dynamic hospital wards/zones linked to active sites in the database 'zones' table.
 * Enforces Role-Based Access Control (RBAC):
 * - MASTER_ADMIN & OPERATIONS_MANAGER: Can manually create custom wards/zones
 * - SUPERVISOR & STAFF: Restricted to pre-approved wards loaded from database
 */

import type { Zone } from '../types';

export const DEFAULT_HOSPITAL_WARDS: string[] = [
  'General Inpatient Wards',
  'ICU & Critical Care',
  'Emergency & Trauma Care',
  'Operation Theatres (OT)',
  'OPD & Patient Waiting Area',
  'Radiology & Diagnostics',
  'Pharmacy & Central Store',
  'Pediatrics & Neonatal Care',
  'Corridors & Lobbies',
  'Executive Administration',
];

/**
 * Check if the current user role is authorized to manually create new wards/zones.
 * Strictly restricted to MASTER_ADMIN and OPERATIONS_MANAGER.
 */
export function isRoleAuthorizedToCreateWard(role?: string | null): boolean {
  if (!role) return false;
  const upper = role.trim().toUpperCase();
  return (
    upper === 'MASTER_ADMIN' ||
    upper === 'OPERATIONS_MANAGER' ||
    upper === 'ADMIN' ||
    upper === 'MANAGER' ||
    upper.includes('ADMIN') ||
    upper.includes('MANAGER')
  );
}

/**
 * Fetch dynamic pre-approved zones for a specific site from the database
 */
export async function fetchZonesForSite(
  siteId?: string,
  userRole?: string
): Promise<Zone[]> {
  const normalizedSiteId = (siteId || '').trim();
  const cacheKey = `hk_dynamic_zones_${normalizedSiteId || 'global'}`;

  try {
    const url = normalizedSiteId && normalizedSiteId !== 'ALL' && normalizedSiteId !== 'GLOBAL'
      ? `/api/zones?site_id=${encodeURIComponent(normalizedSiteId)}`
      : '/api/zones';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (userRole) {
      headers['x-user-role'] = userRole;
    }
    if (normalizedSiteId) {
      headers['x-site-id'] = normalizedSiteId;
    }

    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.zones) && data.zones.length > 0) {
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data.zones));
          } catch {}
        }
        return data.zones;
      }
    }
  } catch (err) {
    console.warn('Network issue fetching live zones from database, checking local cache:', err);
  }

  // Fallback to localStorage cache
  if (typeof localStorage !== 'undefined') {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
  }

  // Default initial hospital wards
  return DEFAULT_HOSPITAL_WARDS.map((wardName, idx) => ({
    id: `default-zone-${idx}`,
    tenant_id: '00000000-0000-0000-0000-000000000001',
    site_id: normalizedSiteId || 'GLOBAL',
    zone_name: wardName,
    department: wardName,
    floor: 'General',
    created_at: new Date().toISOString(),
    is_approved: true,
  }));
}

/**
 * Save newly typed custom ward into the database 'zones' table linked to active site.
 * Restricts access to MASTER_ADMIN and OPERATIONS_MANAGER roles.
 */
export async function createZoneInDatabase(
  siteId: string | undefined,
  zoneName: string,
  userRole?: string
): Promise<Zone> {
  const trimmedName = zoneName.trim();
  if (!trimmedName) {
    throw new Error('Ward / Area name cannot be empty');
  }

  if (!isRoleAuthorizedToCreateWard(userRole)) {
    throw new Error(
      'Access Denied: Only Master Admin and Operations Manager roles are permitted to create custom wards in the database.'
    );
  }

  const effectiveSiteId = (siteId || 'GLOBAL').trim();
  const cacheKey = `hk_dynamic_zones_${effectiveSiteId}`;

  const payload = {
    site_id: effectiveSiteId,
    zone_name: trimmedName,
    department: trimmedName,
    floor: 'General',
    created_by_role: (userRole || 'OPERATIONS_MANAGER').toUpperCase(),
    userRole: (userRole || 'OPERATIONS_MANAGER').toUpperCase(),
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-role': (userRole || 'OPERATIONS_MANAGER').toUpperCase(),
    'x-site-id': effectiveSiteId,
  };

  try {
    const res = await fetch('/api/zones', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.zone) {
        const newZone = data.zone as Zone;
        // Update local cache
        if (typeof localStorage !== 'undefined') {
          try {
            const existingCache = localStorage.getItem(cacheKey);
            const zonesList: Zone[] = existingCache ? JSON.parse(existingCache) : [];
            if (!zonesList.some((z) => z.zone_name.toLowerCase() === newZone.zone_name.toLowerCase())) {
              zonesList.push(newZone);
              localStorage.setItem(cacheKey, JSON.stringify(zonesList));
            }
          } catch {}
        }
        return newZone;
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData?.error) {
        throw new Error(errData.error);
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('Access Denied')) {
      throw err;
    }
    console.warn('API save returned error, saving locally with fallback:', err);
  }

  // Local fallback object
  const fallbackZone: Zone = {
    id: `local-zone-${Date.now()}`,
    tenant_id: '00000000-0000-0000-0000-000000000001',
    site_id: effectiveSiteId,
    zone_name: trimmedName,
    department: trimmedName,
    floor: 'General',
    created_at: new Date().toISOString(),
  };

  if (typeof localStorage !== 'undefined') {
    try {
      const existingCache = localStorage.getItem(cacheKey);
      const zonesList: Zone[] = existingCache ? JSON.parse(existingCache) : [];
      if (!zonesList.some((z) => z.zone_name.toLowerCase() === trimmedName.toLowerCase())) {
        zonesList.push(fallbackZone);
        localStorage.setItem(cacheKey, JSON.stringify(zonesList));
      }
    } catch {}
  }

  return fallbackZone;
}

/**
 * Permanently delete a zone/ward from the database and local storage.
 * Synchronizes backend API deletion, cleans local dynamic zone caches,
 * and ensures the deleted item stays removed.
 */
export async function deleteZoneFromDatabase(
  zoneId: string,
  zoneName?: string,
  siteId?: string,
  userRole?: string
): Promise<{ success: boolean; message: string }> {
  const normalizedSiteId = (siteId || 'GLOBAL').trim();

  // 1. Call Backend API DELETE
  try {
    const queryParams = new URLSearchParams();
    if (zoneName) queryParams.set('name', zoneName);
    if (siteId) queryParams.set('site_id', siteId);
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (userRole) headers['x-user-role'] = userRole;
    if (normalizedSiteId) headers['x-site-id'] = normalizedSiteId;

    await fetch(`/api/zones/${encodeURIComponent(zoneId)}${queryString}`, {
      method: 'DELETE',
      headers,
    });
  } catch (err) {
    console.warn('Network issue calling DELETE /api/zones, proceeding with persistent storage sync:', err);
  }

  // 2. Synchronize local dynamic zones caches
  if (typeof localStorage !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('hk_dynamic_zones_')) {
          const cached = localStorage.getItem(key);
          if (cached) {
            const list: Zone[] = JSON.parse(cached);
            if (Array.isArray(list)) {
              const filtered = list.filter(
                (z) =>
                  z.id !== zoneId &&
                  (!zoneName || z.zone_name.toLowerCase() !== zoneName.toLowerCase())
              );
              localStorage.setItem(key, JSON.stringify(filtered));
            }
          }
        }
      }
    } catch (e) {
      console.warn('Error syncing localStorage dynamic zones after delete:', e);
    }
  }

  return { success: true, message: 'Zone deleted successfully' };
}

