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
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  AppUser,
  StaffUser,
  DutyAllocation,
  AttendanceRecord,
  AttendanceSession,
  GeofenceConfig,
} from '../types';
import { createPasswordHash } from './vaultService';
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
} as const;

export interface MasterAdminRegistrationData {
  fullName: string;
  username: string; // e.g., 'admin' or custom ID
  email: string;
  phone: string;
  password: string;
  department?: string;
  siteId?: string;
  securityPasskey?: string;
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
 * Register Master Admin into Live Production Database
 */
export async function registerMasterAdmin(data: MasterAdminRegistrationData): Promise<AppUser> {
  const cleanUsername = data.username.trim().toLowerCase();
  const staffId = cleanUsername.toUpperCase().startsWith('ADM')
    ? cleanUsername.toUpperCase()
    : `ADMIN-${cleanUsername.toUpperCase()}`;
  const passwordHash = createPasswordHash(data.password);

  const adminUser: AppUser = {
    id: 1,
    staff_id: staffId,
    username: cleanUsername,
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
    site_id: data.siteId || 'site-main',
    site_name: 'ApexCare Central Hospital',
    weeklyOffDay: 'Sunday',
    leaveBalance: { casual: 15, sick: 12, paid: 20 },
    leaveRequests: [],
  };

  // 1. Write to Firestore if connected
  if (db) {
    try {
      // Create user doc
      await setDoc(doc(db, COLLECTIONS.USERS, cleanUsername), {
        ...adminUser,
        email: data.email,
        phone: data.phone,
        createdAt: new Date().toISOString(),
      });

      // Update system settings doc
      await setDoc(doc(db, COLLECTIONS.SETTINGS, 'master_admin'), {
        registered: true,
        registeredAt: new Date().toISOString(),
        adminUsername: cleanUsername,
        adminStaffId: staffId,
        hospitalName: 'ApexCare Hospital (Mumbai)',
        geofenceLat: HOSPITAL_LAT,
        geofenceLng: HOSPITAL_LNG,
        geofenceRadiusMeters: 100,
      });

      // Write audit log
      await setDoc(doc(db, COLLECTIONS.AUDIT_LOGS, `master_reg_${Date.now()}`), {
        event: 'MASTER_ADMIN_REGISTERED',
        username: cleanUsername,
        timestamp: new Date().toISOString(),
        details: 'Initial Master Admin registered with executive administrative privileges.',
      });
    } catch (err) {
      console.warn('Firestore master admin save error:', err);
    }
  }

  // 2. Persist in local storage for instant offline / cache resilience
  localStorage.setItem('apexcare_master_admin_registered', 'true');
  const storedUsersStr = localStorage.getItem('hk_auth_users_v2');
  let currentUsers: AppUser[] = [];
  try {
    if (storedUsersStr) currentUsers = JSON.parse(storedUsersStr);
  } catch {}
  // Update or add adminUser
  const existingIdx = currentUsers.findIndex((u) => u.username?.toLowerCase() === cleanUsername);
  if (existingIdx >= 0) {
    currentUsers[existingIdx] = adminUser;
  } else {
    currentUsers.unshift(adminUser);
  }
  localStorage.setItem('hk_auth_users_v2', JSON.stringify(currentUsers));

  return adminUser;
}

/**
 * Fetch all Users from Live Firestore, synchronized with local storage
 */
export async function fetchLiveUsers(): Promise<AppUser[]> {
  if (!db) return [];

  try {
    const snap = await getDocs(collection(db, COLLECTIONS.USERS));
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
 * Save / Update user in Live Firestore
 */
export async function saveUserToLiveDb(user: AppUser): Promise<void> {
  if (!db) return;
  try {
    const docId = user.username?.toLowerCase() || `user_${user.id}`;
    await setDoc(doc(db, COLLECTIONS.USERS, docId), {
      ...user,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Error saving user to Firestore:', err);
  }
}

/**
 * Fetch Staff Roster from Live Firestore
 */
export async function fetchLiveStaff(): Promise<StaffUser[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.STAFF));
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
 * Save Staff Member to Live Firestore
 */
export async function saveStaffToLiveDb(staff: StaffUser): Promise<void> {
  if (!db) return;
  try {
    const docId = `staff_${staff.id}`;
    await setDoc(doc(db, COLLECTIONS.STAFF, docId), {
      ...staff,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Error saving staff to Firestore:', err);
  }
}

/**
 * Fetch Duty Allocations from Live Firestore
 */
export async function fetchLiveDutyAllocations(): Promise<DutyAllocation[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.DUTY_ALLOCATIONS));
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
 * Save Duty Allocation to Live Firestore
 */
export async function saveDutyAllocationToLiveDb(allocation: DutyAllocation): Promise<void> {
  if (!db) return;
  try {
    const docId = String(allocation.id);
    await setDoc(doc(db, COLLECTIONS.DUTY_ALLOCATIONS, docId), {
      ...allocation,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Error saving duty allocation to Firestore:', err);
  }
}

/**
 * Fetch Attendance Logs from Live Firestore
 */
export async function fetchLiveAttendanceRecords(): Promise<AttendanceRecord[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.ATTENDANCE));
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
 * Record Live Punch In with Real GPS Geofence Verification in Live Firestore
 */
export async function recordLivePunchInToDb(record: AttendanceRecord): Promise<void> {
  if (!db) return;
  try {
    const docId = `att_${record.userId}_${record.date}_${record.id}`;
    await setDoc(doc(db, COLLECTIONS.ATTENDANCE, docId), {
      ...record,
      recordedAt: new Date().toISOString(),
    }, { merge: true });

    // Write audit log
    await setDoc(doc(db, COLLECTIONS.AUDIT_LOGS, `punch_in_${record.userId}_${Date.now()}`), {
      event: 'PUNCH_IN',
      userId: record.userId,
      staffId: record.staff_id || record.userId,
      date: record.date,
      time: record.punchIn,
      lat: record.punchInLat ?? null,
      lng: record.punchInLng ?? null,
      distanceMeters: record.punchInDistanceMeters ?? null,
      verifiedWithin100m: (record.punchInDistanceMeters ?? 0) <= 100,
      timestamp: new Date().toISOString(),
    });
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
    const docId = `att_${record.userId}_${record.date}_${record.id}`;
    await setDoc(doc(db, COLLECTIONS.ATTENDANCE, docId), {
      ...record,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Write audit log
    await setDoc(doc(db, COLLECTIONS.AUDIT_LOGS, `punch_out_${record.userId}_${Date.now()}`), {
      event: 'PUNCH_OUT',
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
    });
  } catch (err) {
    console.warn('Error recording live punch out to Firestore:', err);
  }
}

/**
 * Real-time Snapshot Subscriptions
 */
export function subscribeToAttendance(
  onUpdate: (records: AttendanceRecord[]) => void
): () => void {
  if (!db) return () => {};
  try {
    return onSnapshot(collection(db, COLLECTIONS.ATTENDANCE), (snap) => {
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
  onUpdate: (allocs: DutyAllocation[]) => void
): () => void {
  if (!db) return () => {};
  try {
    return onSnapshot(collection(db, COLLECTIONS.DUTY_ALLOCATIONS), (snap) => {
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
