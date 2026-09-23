/**
 * Production Live Database Service (Firebase Firestore)
 * 
 * Manages live real-time collections for:
 * - System Settings & Master Admin status
 * - User Accounts (Auth & RBAC)
 * - Hospital Staff Roster
 * - Shift & Duty Allocations
 * - Real-time Punch In/Out Audit Logs with GPS Coordinates
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  type Unsubscribe,
  type WhereFilterOp,
} from 'firebase/firestore';
import { db } from './firebase';
import { getActiveCompanyPrefix } from '../utils/tenantStorage';
import type {
  AppUser,
  StaffUser,
  DutyAllocation,
  AttendanceRecord,
  AttendanceSession,
  GeofenceConfig,
  Tenant,
  TaskItem,
} from '../types';
import { createPasswordHash } from './vaultService';
import {
  getStoredAttendance,
  getStoredUsers,
  saveStoredUsers,
  getStoredStaff,
  saveStoredStaff,
  saveStoredAttendance,
} from '../data/mockHousekeepingData';
import {
  HOSPITAL_LAT,
  HOSPITAL_LNG,
  DEFAULT_GEOFENCE_CONFIG,
  getStoredGeofenceConfig,
  saveStoredGeofenceConfig,
} from '../utils/geofence';

// Collection Names
export const COLLECTIONS = {
  SETTINGS: 'system_settings',
  USERS: 'users',
  STAFF: 'staff_roster',
  DUTY_ALLOCATIONS: 'duty_allocations',
  ATTENDANCE: 'attendance_records',
  AUDIT_LOGS: 'audit_logs',
  TENANTS: 'tenants',
  TASKS: 'tasks',
} as const;

/**
 * 🛑 FIRESTORE PAYLOAD SANITIZER:
 * Recursively sanitizes any payload before calling setDoc / addDoc / updateDoc.
 * Replaces any `undefined` value with `null` (or provided fallback) to prevent:
 * "FirebaseError: Function setDoc() called with invalid data. Unsupported field value: undefined"
 */
export function sanitizeFirestorePayload<T = any>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeFirestorePayload(item)) as any;
  }
  if (typeof obj === 'object') {
    if (obj instanceof Date || (obj as any)?.toMillis) {
      return obj;
    }
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      if (value === undefined) {
        clean[key] = null;
      } else if (value !== null && typeof value === 'object' && !(value instanceof Date) && !(value as any)?.toMillis) {
        clean[key] = sanitizeFirestorePayload(value);
      } else {
        clean[key] = value;
      }
    }
    return clean as T;
  }
  return obj;
}

export interface MasterAdminRegistrationData {
  companyName: string; // Company/Tenant Name
  fullName: string;
  password: string;
  email?: string;
  phone?: string;
  department?: string;
  siteId?: string;
  securityPasskey?: string;
  username?: string; // Optional alias for backward compatibility
}

/**
 * Auto-generate Company Prefix (3-4 uppercase characters)
 * e.g. "ApexCare" -> "APEX", "Metro Hospital" -> "METR" or "MH"
 */
export function generateCompanyPrefix(companyName: string): string {
  const clean = companyName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length <= 4) return clean || 'APEX';

  const words = companyName.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const acronym = words.map((w) => w.replace(/[^A-Z0-9]/g, '')[0]).join('');
    if (acronym.length >= 3 && acronym.length <= 5) return acronym;
  }
  return clean.slice(0, 4);
}

/**
 * Auto-generate unique Root Admin ID using company initials
 * e.g., Company 'ApexCare' -> Admin ID: 'APEX-ADM-001'
 */
export function generateRootAdminId(companyPrefix: string): string {
  const prefix = companyPrefix.trim().toUpperCase() || 'APEX';
  return `${prefix}-ADM-001`;
}

/**
 * Generate unique Tenant ID
 */
export function generateTenantId(companyName: string, prefix: string): string {
  const slug = companyName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `TENANT-${prefix.toUpperCase()}-${slug || 'CORP'}`;
}

/**
 * Auto-generate sequential unique IDs based on Role for Sub-Accounts:
 * - Manager: '{COMPANY_PREFIX}-MGR-001'
 * - Supervisor: '{COMPANY_PREFIX}-SUP-001'
 * - Staff: '{COMPANY_PREFIX}-STF-001'
 */
export function generateSubAccountId(
  companyPrefix: string,
  role: string,
  existingUsers: (AppUser | StaffUser | { staff_id?: string; staffCode?: string; username?: string })[]
): string {
  const prefix = companyPrefix.trim().toUpperCase() || 'APEX';
  const roleLower = role.toLowerCase();
  const roleTag =
    roleLower === 'manager'
      ? 'MGR'
      : roleLower === 'supervisor'
      ? 'SUP'
      : roleLower === 'admin'
      ? 'ADM'
      : 'STF';

  const pattern = new RegExp(`^${prefix}-${roleTag}-(\\d+)$`, 'i');
  let maxSeq = 0;
  existingUsers.forEach((u) => {
    const sid =
      ('staff_id' in u && typeof u.staff_id === 'string' ? u.staff_id : '') ||
      ('staffCode' in u && typeof u.staffCode === 'string' ? u.staffCode : '') ||
      ('username' in u && typeof u.username === 'string' ? u.username : '') ||
      '';
    const m = sid.match(pattern);
    if (m && m[1]) {
      const num = parseInt(m[1], 10);
      if (num > maxSeq) maxSeq = num;
    }
  });

  const nextSeq = maxSeq + 1;
  return `${prefix}-${roleTag}-${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Helper to get active tenant ID from local storage or memory
 */
export function getActiveTenantId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const companyCode = localStorage.getItem('company_code');
      if (companyCode && companyCode.trim()) return companyCode.trim().toUpperCase();

      const stored = localStorage.getItem('tenant_id') || localStorage.getItem('tenantId');
      if (stored && stored.trim()) return stored.trim().toUpperCase();

      const curUserStr = localStorage.getItem('hk_current_user_v2') || localStorage.getItem('currentUser');
      if (curUserStr) {
        const u = JSON.parse(curUserStr);
        if (u?.company_prefix) return u.company_prefix.trim().toUpperCase();
        if (u?.tenant_id) return u.tenant_id.trim().toUpperCase();
        if (u?.tenantId) return u.tenantId.trim().toUpperCase();
        const id = u?.id || u?.staff_id || u?.username;
        if (typeof id === 'string' && id.includes('-')) {
          return id.split('-')[0].toUpperCase();
        }
      }

      const userId = localStorage.getItem('userId');
      if (userId && userId.includes('-')) {
        return userId.split('-')[0].toUpperCase();
      }
    }
  } catch {}
  return '';
}

/**
 * Check if Master Admin is registered in Live Production Firestore
 */
export async function isMasterAdminRegistered(): Promise<boolean> {
  if (!db) {
    const local = localStorage.getItem('apexcare_master_admin_registered');
    return local === 'true';
  }

  try {
    const docRef = doc(db, COLLECTIONS.SETTINGS, 'master_admin');
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data()?.registered === true) {
      return true;
    }

    // Secondary check: search users for ADMIN role
    const q = query(collection(db, COLLECTIONS.USERS), where('role', '==', 'admin'));
    const userSnaps = await getDocs(q);
    if (!userSnaps.empty) {
      return true;
    }

    const local = localStorage.getItem('apexcare_master_admin_registered');
    return local === 'true';
  } catch (err) {
    console.warn('Firestore master admin check notice (falling back to cache):', err);
    const local = localStorage.getItem('apexcare_master_admin_registered');
    return local === 'true';
  }
}

/**
 * Register Master Admin into Live Production Database with Tenant Provisioning
 */
export async function registerMasterAdmin(data: MasterAdminRegistrationData): Promise<AppUser> {
  const companyName = (data.companyName || 'ApexCare').trim();
  const companyPrefix = generateCompanyPrefix(companyName);
  const tenantId = generateTenantId(companyName, companyPrefix);
  const rootAdminId = generateRootAdminId(companyPrefix); // e.g., 'APEX-ADM-001'
  const passwordHash = createPasswordHash(data.password);

  const adminUser: AppUser = {
    id: 1,
    tenant_id: tenantId,
    tenantId,
    company_name: companyName,
    company_prefix: companyPrefix,
    staff_id: rootAdminId,
    username: rootAdminId,
    full_name: data.fullName.trim(),
    name: data.fullName.trim(),
    role: 'admin',
    duty_type: 'FIXED',
    fixed_department: data.department || 'Hospital Executive Operations',
    assigned_shift: '7-3',
    password_hash: passwordHash,
    raw_password_vault: data.password,
    password: data.password,
    status: 'ACTIVE',
    is_approved: true,
    site_id: data.siteId || 'site-main',
    site_name: `${companyName} Central Hospital`,
    weeklyOffDay: 'Sunday',
    leaveBalance: { casual: 15, sick: 12, paid: 20 },
    leaveRequests: [],
  };

  const tenantRecord: Tenant = {
    tenant_id: tenantId,
    company_name: companyName,
    company_prefix: companyPrefix,
    root_admin_id: rootAdminId,
    admin_name: data.fullName.trim(),
    admin_email: data.email || `${rootAdminId.toLowerCase()}@${companyPrefix.toLowerCase()}.org`,
    created_at: new Date().toISOString(),
    status: 'ACTIVE',
  };

  // 1. Write to Firestore if connected
  if (db) {
    try {
      // a) Create Tenant record
      await setDoc(doc(db, COLLECTIONS.TENANTS, tenantId), tenantRecord);

      // b) Create user doc with tenant_id
      await setDoc(doc(db, COLLECTIONS.USERS, rootAdminId.toLowerCase()), {
        ...adminUser,
        email: data.email || `${rootAdminId.toLowerCase()}@${companyPrefix.toLowerCase()}.org`,
        phone: data.phone || '+91-9876543210',
        createdAt: new Date().toISOString(),
      });

      // c) Update system settings doc
      await setDoc(doc(db, COLLECTIONS.SETTINGS, 'master_admin'), {
        registered: true,
        registeredAt: new Date().toISOString(),
        adminUsername: rootAdminId,
        adminStaffId: rootAdminId,
        companyName,
        companyPrefix,
        tenantId,
        hospitalName: `${companyName} Central Hospital`,
        geofenceLat: HOSPITAL_LAT,
        geofenceLng: HOSPITAL_LNG,
        geofenceRadiusMeters: 100,
      });

      // d) Write audit log
      await setDoc(doc(db, COLLECTIONS.AUDIT_LOGS, `master_reg_${Date.now()}`), {
        event: 'MASTER_ADMIN_AND_TENANT_REGISTERED',
        tenant_id: tenantId,
        company_name: companyName,
        company_prefix: companyPrefix,
        root_admin_id: rootAdminId,
        username: rootAdminId,
        timestamp: new Date().toISOString(),
        details: `Initial Master Admin (${rootAdminId}) and Tenant (${companyName}) provisioned.`,
      });
    } catch (err) {
      console.warn('Firestore master admin save error:', err);
    }
  }

  // 2. Persist in local storage with tenant isolation
  localStorage.setItem('tenant_id', tenantId);
  localStorage.setItem('tenantId', tenantId);
  localStorage.setItem('company_code', companyPrefix);
  localStorage.setItem('company_name', companyName);
  localStorage.setItem('userId', rootAdminId);
  localStorage.setItem('userRole', 'ADMIN');
  localStorage.setItem('user_role', 'admin');
  localStorage.setItem('user_id', '1');
  localStorage.setItem('apexcare_master_admin_registered', 'true');

  // Save tenant in local list
  try {
    const existingTenantsStr = localStorage.getItem('hk_tenants_v1');
    const tenants: Tenant[] = existingTenantsStr ? JSON.parse(existingTenantsStr) : [];
    if (!tenants.some((t) => t.tenant_id === tenantId)) {
      tenants.push(tenantRecord);
      localStorage.setItem('hk_tenants_v1', JSON.stringify(tenants));
    }
  } catch {}

  const storedUsersStr = localStorage.getItem('hk_auth_users_v2');
  let currentUsers: AppUser[] = [];
  try {
    if (storedUsersStr) currentUsers = JSON.parse(storedUsersStr);
  } catch {}
  // Update or add adminUser
  const existingIdx = currentUsers.findIndex(
    (u) =>
      (u.staff_id && u.staff_id.toLowerCase() === rootAdminId.toLowerCase()) ||
      (u.username && u.username.toLowerCase() === rootAdminId.toLowerCase())
  );
  if (existingIdx >= 0) {
    currentUsers[existingIdx] = adminUser;
  } else {
    currentUsers.unshift(adminUser);
  }
  localStorage.setItem('hk_auth_users_v2', JSON.stringify(currentUsers));

  try {
    window.dispatchEvent(new Event('user-data-updated'));
    window.dispatchEvent(new Event('auth-state-change'));
    window.dispatchEvent(new Event('tenant-data-updated'));
  } catch {}

  return adminUser;
}

/**
 * Fetch all Users from Live Firestore scoped to tenant
 */
export async function fetchLiveUsers(tenantId?: string): Promise<AppUser[]> {
  const tid = tenantId || getActiveTenantId();
  if (!db) {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('housekeeping_users') : null;
      if (raw) {
        const users: AppUser[] = JSON.parse(raw);
        if (!tid) return users;
        const tidUpper = tid.toUpperCase();
        return users.filter((u) => {
          const sid = (u.staff_id || u.username || String(u.id || '')).toUpperCase();
          return sid.startsWith(tidUpper) || (u.tenant_id && u.tenant_id.toUpperCase() === tidUpper);
        });
      }
    } catch {}
    return [];
  }

  try {
    const baseRef = collection(db, COLLECTIONS.USERS);
    const q = tid ? query(baseRef, where('tenant_id', '==', tid)) : query(baseRef);
    const snap = await getDocs(q);
    if (snap.empty) return [];

    const users: AppUser[] = [];
    snap.forEach((d) => {
      const u = d.data() as AppUser;
      users.push(u);
    });
    return users;
  } catch (err) {
    console.warn('Error fetching live users from Firestore:', err);
    return [];
  }
}

/**
 * Save / Update user in Live Firestore stamped with tenant_id
 */
export async function saveUserToLiveDb(user: AppUser): Promise<void> {
  if (!db) return;
  try {
    const activeTid = user.tenant_id || getActiveTenantId();
    const docId = user.username?.toLowerCase() || `user_${user.id}`;
    const cleanUser = sanitizeFirestorePayload({
      ...user,
      temp_department: user.temp_department ?? null,
      tempDepartment: (user as any).tempDepartment ?? (user.temp_department ?? null),
      assigned_area: user.assigned_area || user.department || 'General Ward',
      tenant_id: activeTid,
      tenantId: activeTid,
      updatedAt: new Date().toISOString(),
    });

    await setDoc(
      doc(db, COLLECTIONS.USERS, docId),
      cleanUser,
      { merge: true }
    );
  } catch (err) {
    console.warn('Error saving user to Firestore:', err);
  }
}

/**
 * Fetch Staff Roster from Live Firestore scoped to tenant
 */
export async function fetchLiveStaff(tenantId?: string): Promise<StaffUser[]> {
  const tid = tenantId || getActiveTenantId();
  if (!db) {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('hk_staff_users_v2') : null;
      if (raw) {
        const staff: StaffUser[] = JSON.parse(raw);
        if (!tid) return staff;
        const tidUpper = tid.toUpperCase();
        return staff.filter((s) => {
          const sc = (s.staffCode || (s as any).staff_id || String(s.id || '')).toUpperCase();
          return sc.startsWith(tidUpper) || (s.tenant_id && s.tenant_id.toUpperCase() === tidUpper);
        });
      }
    } catch {}
    return [];
  }

  try {
    const baseRef = collection(db, COLLECTIONS.STAFF);
    const q = tid ? query(baseRef, where('tenant_id', '==', tid)) : query(baseRef);
    const snap = await getDocs(q);
    if (snap.empty) return [];

    const staff: StaffUser[] = [];
    snap.forEach((d) => {
      staff.push(d.data() as StaffUser);
    });
    return staff;
  } catch (err) {
    console.warn('Error fetching live staff from Firestore:', err);
    return [];
  }
}

/**
 * 🛑 FIX: Save Staff to Firestore 'staff_roster' handling undefined fields with fallbacks
 */
export async function saveStaffRosterPayload(data: {
  staffId?: string;
  staff_id?: string;
  staffCode?: string;
  fullName?: string;
  name?: string;
  tempDepartment?: string | null;
  temp_department?: string | null;
  assignedArea?: string;
  assigned_area?: string;
  role?: string;
  tenant_id?: string;
  created_at?: string;
  [key: string]: any;
}): Promise<any> {
  const staffId = (data.staff_id || data.staffId || data.staffCode || String(data.id || '')).trim();
  const fullName = (data.name || data.fullName || 'Staff Member').trim();
  const tempDepartment = data.tempDepartment !== undefined ? data.tempDepartment : (data.temp_department ?? null);
  const assignedArea = data.assigned_area || data.assignedArea || data.department || 'General Ward';
  const role = (data.role || 'STAFF').toUpperCase();

  // Firestore me payload bhejte waqt undefined fields ko handle karein:
  const staffPayload = sanitizeFirestorePayload({
    ...data,
    staff_id: staffId,
    name: fullName,
    // 🛑 FIX: Undefined value se bachne ke liye fallback set karein
    tempDepartment: tempDepartment ?? null, // Ya tempDepartment || ""
    assigned_area: assignedArea || 'General Ward',
    role: role || 'STAFF',
    created_at: data.created_at || new Date().toISOString(),
  });

  if (db && staffId) {
    try {
      // Phir setDoc call karein
      await setDoc(doc(db, 'staff_roster', staffId), staffPayload, { merge: true });
    } catch (err) {
      console.warn('Error saving to staff_roster in Firestore:', err);
    }
  }

  return staffPayload;
}

/**
 * Save Staff Member to Live Firestore stamped with tenant_id
 */
export async function saveStaffToLiveDb(staff: StaffUser): Promise<void> {
  if (!db) return;
  try {
    const activeTid = staff.tenant_id || getActiveTenantId();
    const docId = `staff_${staff.id}`;
    const staffId = (staff.staffCode || (staff as any).staff_id || `HK-${String(staff.id).padStart(3, '0')}`).trim();
    const fullName = (staff.name || '').trim();
    const tempDepartment = staff.tempDepartment !== undefined ? staff.tempDepartment : ((staff as any).temp_department ?? null);
    const assignedArea = staff.department || staff.fixedDepartment || (staff as any).assigned_area || 'General Ward';
    const role = (staff.role || 'STAFF').toUpperCase();

    // Firestore me payload bhejte waqt undefined fields ko handle karein:
    const staffPayload = sanitizeFirestorePayload({
      ...staff,
      staff_id: staffId,
      name: fullName,
      // 🛑 FIX: Undefined value se bachne ke liye fallback set karein
      tempDepartment: tempDepartment ?? null, // Ya tempDepartment || ""
      assigned_area: assignedArea || 'General Ward',
      role: role || 'STAFF',
      created_at: (staff as any).created_at || (staff as any).createdAt || new Date().toISOString(),
      tenant_id: activeTid,
      tenantId: activeTid,
      updatedAt: new Date().toISOString(),
    });

    await setDoc(
      doc(db, COLLECTIONS.STAFF, docId),
      staffPayload,
      { merge: true }
    );

    if (staffId) {
      // Phir setDoc call karein
      await setDoc(
        doc(db, 'staff_roster', staffId),
        staffPayload,
        { merge: true }
      );
    }
  } catch (err) {
    console.warn('Error saving staff to Firestore:', err);
  }
}

/**
 * Delete User from Live Firestore
 */
export async function deleteUserFromLiveDb(userOrId: Partial<AppUser> | number, staffCode?: string): Promise<void> {
  if (!db) return;
  try {
    const user: Partial<AppUser> = typeof userOrId === 'number' ? { id: userOrId } : userOrId;
    const docId = user.username?.toLowerCase() || `user_${user.id}`;
    await deleteDoc(doc(db, COLLECTIONS.USERS, docId));
    if (user.staff_id) {
      try {
        await deleteDoc(doc(db, COLLECTIONS.USERS, user.staff_id.toLowerCase()));
      } catch {}
    }
    if (staffCode) {
      try {
        await deleteDoc(doc(db, COLLECTIONS.USERS, staffCode.toLowerCase()));
      } catch {}
    }
  } catch (err) {
    console.warn('Error deleting user from Firestore:', err);
  }
}

/**
 * Delete Staff from Live Firestore
 */
export async function deleteStaffFromLiveDb(staffId: number, staffCode?: string): Promise<void> {
  if (!db) return;
  try {
    const docId = `staff_${staffId}`;
    await deleteDoc(doc(db, COLLECTIONS.STAFF, docId));
    if (staffCode) {
      try {
        await deleteDoc(doc(db, COLLECTIONS.STAFF, staffCode.toLowerCase()));
      } catch {}
    }
  } catch (err) {
    console.warn('Error deleting staff from Firestore:', err);
  }
}

/**
 * Fetch Duty Allocations from Live Firestore scoped to tenant
 */
export async function fetchLiveDutyAllocations(tenantId?: string): Promise<DutyAllocation[]> {
  if (!db) return [];
  try {
    const tid = tenantId || getActiveTenantId();
    const baseRef = collection(db, COLLECTIONS.DUTY_ALLOCATIONS);
    const q = tid ? query(baseRef, where('tenant_id', '==', tid)) : query(baseRef);
    const snap = await getDocs(q);
    if (snap.empty) return [];

    const allocations: DutyAllocation[] = [];
    snap.forEach((d) => {
      allocations.push(d.data() as DutyAllocation);
    });
    return allocations;
  } catch (err) {
    console.warn('Error fetching live duty allocations:', err);
    return [];
  }
}

/**
 * Save Duty Allocation to Live Firestore stamped with tenant_id
 */
export async function saveDutyAllocationToLiveDb(allocation: DutyAllocation): Promise<void> {
  if (!db) return;
  try {
    const activeTid = allocation.tenant_id || getActiveTenantId();
    const docId = String(allocation.id);
    await setDoc(
      doc(db, COLLECTIONS.DUTY_ALLOCATIONS, docId),
      sanitizeFirestorePayload({
        ...allocation,
        tenant_id: activeTid,
        tenantId: activeTid,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Error saving duty allocation to Firestore:', err);
  }
}

/**
 * Fetch Attendance Logs from Live Firestore scoped to tenant
 */
export async function fetchLiveAttendanceRecords(tenantId?: string): Promise<AttendanceRecord[]> {
  if (!db) return [];
  try {
    const tid = tenantId || getActiveTenantId();
    const baseRef = collection(db, COLLECTIONS.ATTENDANCE);
    const q = tid ? query(baseRef, where('tenant_id', '==', tid)) : query(baseRef);
    const snap = await getDocs(q);
    if (snap.empty) return [];

    const records: AttendanceRecord[] = [];
    snap.forEach((d) => {
      records.push(d.data() as AttendanceRecord);
    });
    return records;
  } catch (err) {
    console.warn('Error fetching live attendance records from Firestore:', err);
    return [];
  }
}

/**
 * Helper to fetch documents from Firestore or local storage fallback
 */
export async function getDocsFromFirestoreOrLocal(
  collectionName: string = 'attendance_records',
  staffId?: string
): Promise<any[]> {
  if (db) {
    try {
      const colRef = collection(db, collectionName);
      const q = staffId ? query(colRef, where('staff_id', '==', staffId)) : query(colRef);
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docs: any[] = [];
        snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
        return docs;
      }
    } catch (e) {
      console.warn(`[Firestore fetch fallback]: Failed to query ${collectionName}`, e);
    }
  }

  // Fallback to local storage
  if (collectionName === 'attendance_records' || collectionName === COLLECTIONS.ATTENDANCE) {
    const local = getStoredAttendance();
    if (staffId) {
      return local.filter((r: any) => r.staff_id === staffId || r.staffId === staffId);
    }
    return local;
  }
  return [];
}

// src/services/firestoreService.ts - CLEAN DATA FETCH GUARD

export const fetchStaffAttendanceLogs = async (staffId: string) => {
  // 🛑 GUARD: Check if this is a newly created ID without any historical records
  if (!staffId || staffId.trim() === '') {
    return {
      monthlyRecords: [],
      totalPresentDays: 0,
      totalRegularHours: 0,
      totalOvertimeHours: 0,
      otRecords: []
    };
  }

  // Fetch only records explicitly created for this unique staffId
  const rawRecords = await getDocsFromFirestoreOrLocal('attendance_records', staffId);

  // Filter out any fallback mock records if staffId does not match exactly
  const strictRecords = rawRecords.filter((doc: any) => doc.staff_id === staffId);

  return {
    monthlyRecords: strictRecords,
    totalPresentDays: strictRecords.filter((r: any) => r.status === 'PRESENT').length,
    totalRegularHours: strictRecords.reduce((acc: number, r: any) => acc + (Number(r.regularHours || r.regular_hours) || 0), 0),
    totalOvertimeHours: strictRecords.reduce((acc: number, r: any) => acc + (Number(r.overtimeHours || r.overtime_hours) || 0), 0),
    otRecords: strictRecords.filter((r: any) => (r.overtimeHours || r.overtime_hours || 0) > 0)
  };
};

/**
 * Delete a single document by ID from Firestore or Local Storage DB
 */
export const deleteDocFromDB = async (collectionName: string, docId: string): Promise<void> => {
  if (db) {
    try {
      await deleteDoc(doc(db, collectionName, docId));
      try {
        await deleteDoc(doc(db, collectionName, docId.toLowerCase()));
      } catch {}
      // also search by staff_id if applicable
      const colRef = collection(db, collectionName);
      const q = query(colRef, where('staff_id', '==', docId));
      const snap = await getDocs(q);
      const deletes = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletes);
    } catch (e) {
      console.warn(`[deleteDocFromDB]: Error deleting ${docId} from ${collectionName}`, e);
    }
  }

  // Local storage cleanup
  if (
    collectionName === 'staff_users' ||
    collectionName === COLLECTIONS.USERS ||
    collectionName === COLLECTIONS.STAFF
  ) {
    const users = getStoredUsers();
    const updatedUsers = users.filter(
      (u) =>
        u.staff_id !== docId &&
        (u as any).staffCode !== docId &&
        u.username !== docId &&
        String(u.id) !== docId
    );
    saveStoredUsers(updatedUsers);

    const staff = getStoredStaff();
    const updatedStaff = staff.filter(
      (s) => s.staffCode !== docId && String(s.id) !== docId
    );
    saveStoredStaff(updatedStaff);
  }
};

/**
 * Delete multiple documents matching a query condition from Firestore or Local Storage DB
 */
export const deleteDocsWhere = async (
  collectionName: string,
  field: string,
  operator: WhereFilterOp,
  value: any
): Promise<void> => {
  if (db) {
    try {
      const colRef = collection(db, collectionName);
      const q = query(colRef, where(field, operator, value));
      const snap = await getDocs(q);
      const deletes = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletes);
    } catch (e) {
      console.warn(
        `[deleteDocsWhere]: Error deleting docs from ${collectionName} where ${field} ${operator} ${value}`,
        e
      );
    }
  }

  // Local storage cleanup
  if (
    collectionName === 'attendance_records' ||
    collectionName === COLLECTIONS.ATTENDANCE
  ) {
    const records = getStoredAttendance();
    const updated = records.filter(
      (r) =>
        (r as any)[field] !== value &&
        (field === 'staff_id' ? (r as any).staffId !== value : true)
    );
    saveStoredAttendance(updated);
  }
};

// src/services/firestoreService.ts - DELETE USER FROM FIRESTORE / LOCAL DB

export const deleteStaffAccount = async (tenantId: string, staffId: string): Promise<boolean> => {
  try {
    // 1. Delete user profile from staff database
    await deleteDocFromDB("staff_users", staffId);

    // 2. Clear mapped temporary attendance sessions for this user
    await deleteDocsWhere("attendance_records", "staff_id", "==", staffId);

    console.log(`[Database Cleanup]: Account ${staffId} successfully removed from tenant ${tenantId}`);
    return true;
  } catch (error) {
    console.error(`[Delete Error]: Failed to remove staff ${staffId}`, error);
    throw error;
  }
};



/**
 * Fetch Tasks from Live Firestore scoped to tenant
 */
export async function fetchLiveTasks(tenantId?: string): Promise<TaskItem[]> {
  if (!db) return [];
  try {
    const tid = tenantId || getActiveTenantId();
    const baseRef = collection(db, COLLECTIONS.TASKS);
    const q = tid ? query(baseRef, where('tenant_id', '==', tid)) : query(baseRef);
    const snap = await getDocs(q);
    if (snap.empty) return [];

    const tasks: TaskItem[] = [];
    snap.forEach((d) => {
      tasks.push(d.data() as TaskItem);
    });
    return tasks;
  } catch (err) {
    console.warn('Error fetching live tasks from Firestore:', err);
    return [];
  }
}

/**
 * Save Task to Live Firestore stamped with tenant_id
 */
export async function saveTaskToLiveDb(task: TaskItem): Promise<void> {
  if (!db) return;
  try {
    const activeTid = task.tenant_id || getActiveTenantId();
    await setDoc(
      doc(db, COLLECTIONS.TASKS, task.id),
      sanitizeFirestorePayload({
        ...task,
        tenant_id: activeTid,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Error saving task to Firestore:', err);
  }
}

/**
 * Record Live Punch In with Real GPS Geofence Verification in Live Firestore
 */
export async function recordLivePunchInToDb(record: AttendanceRecord): Promise<void> {
  if (!db) return;
  try {
    const activeTid = record.tenant_id || getActiveTenantId();
    const docId = `att_${record.userId}_${record.date}_${record.id}`;
    await setDoc(
      doc(db, COLLECTIONS.ATTENDANCE, docId),
      sanitizeFirestorePayload({
        ...record,
        tenant_id: activeTid,
        tenantId: activeTid,
        recordedAt: new Date().toISOString(),
      }),
      { merge: true }
    );

    // Write audit log
    await setDoc(
      doc(db, COLLECTIONS.AUDIT_LOGS, `punch_in_${record.userId}_${Date.now()}`),
      sanitizeFirestorePayload({
        event: 'PUNCH_IN',
        tenant_id: activeTid,
        userId: record.userId,
        staffId: record.staff_id || record.userId,
        date: record.date,
        time: record.punchIn,
        lat: record.punchInLat ?? null,
        lng: record.punchInLng ?? null,
        distanceMeters: record.punchInDistanceMeters ?? null,
        verifiedWithin100m: (record.punchInDistanceMeters ?? 0) <= 100,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.warn('Error recording live punch in to Firestore:', err);
  }
}

/**
 * Record Live Punch Out with Real GPS Geofence Verification in Live Firestore
 */
export async function recordLivePunchOutToDb(record: AttendanceRecord): Promise<void> {
  if (!db) return;
  try {
    const activeTid = record.tenant_id || getActiveTenantId();
    const docId = `att_${record.userId}_${record.date}_${record.id}`;
    await setDoc(
      doc(db, COLLECTIONS.ATTENDANCE, docId),
      sanitizeFirestorePayload({
        ...record,
        tenant_id: activeTid,
        tenantId: activeTid,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );

    // Write audit log
    await setDoc(
      doc(db, COLLECTIONS.AUDIT_LOGS, `punch_out_${record.userId}_${Date.now()}`),
      sanitizeFirestorePayload({
        event: 'PUNCH_OUT',
        tenant_id: activeTid,
        userId: record.userId,
        staffId: record.staff_id || record.userId,
        date: record.date,
        time: record.punchOut,
        lat: record.punchOutLat ?? null,
        lng: record.punchOutLng ?? null,
        distanceMeters: record.punchOutDistanceMeters ?? null,
        verifiedWithin100m: (record.punchOutDistanceMeters ?? 0) <= 100,
        hoursWorked: (record.regularHours || 0) + (record.otHours || 0),
        timestamp: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.warn('Error recording live punch out to Firestore:', err);
  }
}

/**
 * Real-time Snapshot Subscriptions with explicit tenant isolation
 */
export const subscribeToLiveAttendance = (
  tenantId: string,
  onData: (records: any[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const activePrefix = getActiveCompanyPrefix(tenantId);
  if (!db) {
    return () => {};
  }
  const attendanceRef = collection(db, 'attendance_records');

  const q = query(attendanceRef, where('tenant_id', '==', activePrefix));

  // Return native Unsubscribe handler for React useEffect cleanup
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const liveRecords: any[] = [];
      snapshot.forEach((doc) => {
        liveRecords.push({ id: doc.id, ...doc.data() });
      });
      onData(liveRecords);
    },
    (err) => {
      console.error('[Firestore Live Attendance Error]:', err);
      if (onError) onError(err);
    }
  );

  return unsubscribe;
};

export function subscribeToAttendance(
  onUpdate: (records: AttendanceRecord[]) => void,
  tenantId?: string
): () => void {
  if (!db) return () => {};
  try {
    const tid = tenantId || getActiveTenantId();
    const baseRef = collection(db, COLLECTIONS.ATTENDANCE);
    const q = tid ? query(baseRef, where('tenant_id', '==', tid)) : query(baseRef);
    return onSnapshot(q, (snap) => {
      const records: AttendanceRecord[] = [];
      snap.forEach((d) => {
        records.push(d.data() as AttendanceRecord);
      });
      onUpdate(records);
    });
  } catch (e) {
    console.warn('Attendance subscription error:', e);
    return () => {};
  }
}

export function subscribeToDutyAllocations(
  onUpdate: (allocs: DutyAllocation[]) => void,
  tenantId?: string
): () => void {
  if (!db) return () => {};
  try {
    const tid = tenantId || getActiveTenantId();
    const baseRef = collection(db, COLLECTIONS.DUTY_ALLOCATIONS);
    const q = tid ? query(baseRef, where('tenant_id', '==', tid)) : query(baseRef);
    return onSnapshot(q, (snap) => {
      const allocs: DutyAllocation[] = [];
      snap.forEach((d) => {
        allocs.push(d.data() as DutyAllocation);
      });
      onUpdate(allocs);
    });
  } catch (e) {
    console.warn('Duty allocation subscription error:', e);
    return () => {};
  }
}

/**
 * Fetch Tenant by ID
 */
export async function fetchTenant(tenantId: string): Promise<Tenant | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.TENANTS, tenantId));
    if (snap.exists()) return snap.data() as Tenant;
  } catch {}
  return null;
}

/**
 * Fetch Tenant by Company Prefix (e.g. "APEX")
 */
export async function fetchTenantByPrefix(prefix: string): Promise<Tenant | null> {
  if (!db) return null;
  try {
    const q = query(
      collection(db, COLLECTIONS.TENANTS),
      where('company_prefix', '==', prefix.toUpperCase())
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as Tenant;
    }
  } catch {}
  return null;
}

export interface GeofenceSaveResult {
  success: boolean;
  savedToCloud: boolean;
  isOfflineFallback: boolean;
  message: string;
  error?: string;
}

/**
 * Fetch dynamic Geofence Settings from Live Firestore, synchronized with local cache.
 * Automatically falls back to local storage and in-memory cache if Firestore is offline
 * or returns "Failed to get document because the client is offline".
 */
export async function fetchLiveGeofenceSettings(): Promise<GeofenceConfig> {
  const localConfig = getStoredGeofenceConfig();
  if (!db) return localConfig;

  try {
    const docRef = doc(db, COLLECTIONS.SETTINGS, 'geofence_config');

    // Bound network fetch with a 3.5-second timeout to prevent indefinite hangs in offline state
    const fetchPromise = getDoc(docRef);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore client offline or network timed out')), 3500)
    );

    const snap = await Promise.race([fetchPromise, timeoutPromise]);
    if (snap.exists()) {
      const data = snap.data();
      const config: GeofenceConfig = {
        hospitalName: data.hospitalName || localConfig.hospitalName,
        hospitalLat: typeof data.hospitalLat === 'number' ? data.hospitalLat : localConfig.hospitalLat,
        hospitalLng: typeof data.hospitalLng === 'number' ? data.hospitalLng : localConfig.hospitalLng,
        maxAllowedRadiusMeters:
          typeof data.maxAllowedRadiusMeters === 'number'
            ? data.maxAllowedRadiusMeters
            : localConfig.maxAllowedRadiusMeters,
        requireHighAccuracyGps: data.requireHighAccuracyGps ?? true,
        gpsTimeoutSeconds: typeof data.gpsTimeoutSeconds === 'number' ? data.gpsTimeoutSeconds : 5,
        zones: Array.isArray(data.zones) && data.zones.length > 0 ? data.zones : localConfig.zones,
        updatedAt: data.updatedAt || new Date().toISOString(),
        updatedBy: data.updatedBy || 'Admin',
      };
      saveStoredGeofenceConfig(config);
      return config;
    }
  } catch (err: any) {
    const isOffline =
      err?.message?.includes('offline') ||
      err?.code === 'unavailable' ||
      err?.message?.includes('Failed to get document because the client is offline') ||
      err?.message?.includes('timed out');

    if (isOffline) {
      console.info('Firestore is currently offline; using local storage Geofence cache fallback.');
    } else {
      console.warn('Error fetching live geofence settings from Firestore (using local fallback):', err);
    }
  }

  return localConfig;
}

/**
 * Update and persist dynamic Geofence & GPS settings to Live Firestore with offline resilience.
 * - Always updates local storage and memory fallback first.
 * - Resolves safely even if Firestore client is offline or encounters network timeouts.
 */
export async function updateGeofenceSettings(
  config: GeofenceConfig,
  adminUsername = 'Admin'
): Promise<GeofenceSaveResult> {
  const updatedConfig: GeofenceConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUsername,
  };

  // 1. Immediately update local storage and notify UI components
  saveStoredGeofenceConfig(updatedConfig);

  // 2. Persist to Firestore with offline detection and 4-second bounded timeout
  if (!db) {
    return {
      success: true,
      savedToCloud: false,
      isOfflineFallback: true,
      message: 'Saved to local storage cache (Firestore instance not configured).',
    };
  }

  try {
    const docRef = doc(db, COLLECTIONS.SETTINGS, 'geofence_config');
    const masterAdminRef = doc(db, COLLECTIONS.SETTINGS, 'master_admin');
    const auditLogRef = doc(db, COLLECTIONS.AUDIT_LOGS, `geofence_update_${Date.now()}`);

    const cloudPersistPromise = Promise.all([
      setDoc(docRef, updatedConfig, { merge: true }),
      setDoc(
        masterAdminRef,
        {
          geofenceLat: updatedConfig.hospitalLat,
          geofenceLng: updatedConfig.hospitalLng,
          geofenceRadiusMeters: updatedConfig.maxAllowedRadiusMeters,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ),
      setDoc(auditLogRef, {
        event: 'GEOFENCE_SETTINGS_UPDATED',
        username: adminUsername,
        hospitalLat: updatedConfig.hospitalLat,
        hospitalLng: updatedConfig.hospitalLng,
        maxAllowedRadiusMeters: updatedConfig.maxAllowedRadiusMeters,
        zonesCount: updatedConfig.zones.length,
        timestamp: new Date().toISOString(),
        details: `Geofence coordinates updated to (${updatedConfig.hospitalLat}, ${updatedConfig.hospitalLng}) with ${updatedConfig.maxAllowedRadiusMeters}m radius tolerance and ${updatedConfig.zones.length} ward boundaries.`,
      }),
    ]);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore save timed out (client is offline)')), 4000)
    );

    await Promise.race([cloudPersistPromise, timeoutPromise]);

    return {
      success: true,
      savedToCloud: true,
      isOfflineFallback: false,
      message: 'Geofence settings persisted to Firestore database and local cache.',
    };
  } catch (err: any) {
    const isOffline =
      err?.message?.includes('offline') ||
      err?.code === 'unavailable' ||
      err?.message?.includes('Failed to get document because the client is offline') ||
      err?.message?.includes('timed out');

    if (isOffline) {
      console.info('Firestore client is offline. Geofence settings safely saved to local storage fallback cache.');
      return {
        success: true,
        savedToCloud: false,
        isOfflineFallback: true,
        message: 'Saved to local storage cache (Firestore is currently offline). Will sync when online.',
      };
    }

    console.warn('Error persisting geofence settings to Firestore (local fallback retained):', err);
    return {
      success: false,
      savedToCloud: false,
      isOfflineFallback: true,
      message: err?.message || 'Failed to persist to Firestore, but saved to local cache.',
      error: err?.message,
    };
  }
}

/**
 * Subscribe to real-time Geofence configuration updates from Firestore with offline resilience
 */
export function subscribeToGeofenceSettings(
  onUpdate: (config: GeofenceConfig) => void
): () => void {
  if (!db) return () => {};
  try {
    const docRef = doc(db, COLLECTIONS.SETTINGS, 'geofence_config');
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const base = getStoredGeofenceConfig();
          const config: GeofenceConfig = {
            hospitalName: data.hospitalName || base.hospitalName,
            hospitalLat: typeof data.hospitalLat === 'number' ? data.hospitalLat : base.hospitalLat,
            hospitalLng: typeof data.hospitalLng === 'number' ? data.hospitalLng : base.hospitalLng,
            maxAllowedRadiusMeters:
              typeof data.maxAllowedRadiusMeters === 'number'
                ? data.maxAllowedRadiusMeters
                : base.maxAllowedRadiusMeters,
            requireHighAccuracyGps: data.requireHighAccuracyGps ?? true,
            gpsTimeoutSeconds: typeof data.gpsTimeoutSeconds === 'number' ? data.gpsTimeoutSeconds : 5,
            zones: Array.isArray(data.zones) && data.zones.length > 0 ? data.zones : base.zones,
            updatedAt: data.updatedAt || new Date().toISOString(),
            updatedBy: data.updatedBy || 'Admin',
          };
          saveStoredGeofenceConfig(config);
          onUpdate(config);
        }
      },
      (error) => {
        // Gracefully handle offline or network error on the snapshot listener
        console.warn('Geofence settings snapshot offline / fallback note:', error?.message);
      }
    );
  } catch (err) {
    console.warn('Error subscribing to geofence settings:', err);
    return () => {};
  }
}
