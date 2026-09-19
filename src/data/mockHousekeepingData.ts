import type {
  StaffUser,
  AttendanceRecord,
  AppUser,
  StaffRequest,
  UserRole,
  SystemRole,
  StaffDashboardView,
  SupervisorAccessContext,
  UserStatus,
  DutyAllocation,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  LeaveStatus,
  DayOfWeek,
  HospitalSite,
  ShiftName,
  EmergencyRecallAlert,
} from '../types';
import { createPasswordHash } from '../services/vaultService';

export const HOSPITAL_SITES: HospitalSite[] = [
  { id: 'site-main', name: 'ApexCare Central Hospital', code: 'MAIN', city: 'Metro Central', address: 'Plot 42, Medical Enclave' },
  { id: 'site-east', name: 'ApexCare East Wing & Trauma', code: 'EAST', city: 'East Zone', address: 'Tower B, East Campus' },
  { id: 'site-north', name: 'ApexCare North Super-Speciality', code: 'NORTH', city: 'North Enclave', address: 'Sector 9, North Hub' },
];

/**
 * Returns today's ISO date string (YYYY-MM-DD) based on local system clock
 */
export function getTodayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * State & Schema Normalization Helper:
 * Ensures every user profile automatically initializes with default schema if missing:
 * - weeklyOffDay (default: "Sunday")
 * - leaveBalance ({ casual: 12, sick: 7, paid: 15 })
 * - leaveRequests ([])
 * Normalizes Leave Request object fields:
 * - requestId, userId, userName, role, siteId, leaveType, startDate, endDate, status ("Pending" | "Approved" | "Rejected"), actionBy
 */
export function normalizeUser(u: any): AppUser {
  if (!u) return u;
  const staff_id =
    u.staff_id ||
    u.username ||
    (u.staffId ? `HK-${u.staffId.toString().padStart(3, '0')}` : `USER-${u.id || 1}`);
  const full_name = u.full_name || u.name || 'Staff Member';
  const password = u.raw_password_vault || u.password || '123456';
  const password_hash = u.password_hash || createPasswordHash(password);
  const raw_password_vault = u.raw_password_vault || password;
  const status: UserStatus = u.status || (u.is_approved === false ? 'PENDING_APPROVAL' : 'ACTIVE');
  const assigned_shift =
    u.assigned_shift ||
    (u.shift === 'Night' ? '11-7' : u.shift === 'Evening' ? '3-11' : '7-3');
  const duty_type = u.duty_type || 'FIXED';
  const fixed_department = u.fixed_department ?? u.assigned_area ?? u.department ?? 'General Ward';
  const is_temp_reliever = Boolean(u.is_temp_reliever);
  const temp_department = u.temp_department ?? null;

  // Site normalization
  const siteId = u.siteId || u.site_id || 'site-main';
  const siteName = u.siteName || u.site_name || 'ApexCare Central Memorial';

  // 1. Ensure weeklyOffDay defaults to "Sunday"
  const weeklyOffDay: string = u.weeklyOffDay || u.weekly_off_day || 'Sunday';

  // 2. Ensure leaveBalance defaults to { casual: 12, sick: 7, paid: 15 }
  const rawBal = u.leaveBalance || u.leave_balance;
  const leaveBalance: LeaveBalance = {
    casual: typeof rawBal?.casual === 'number' ? rawBal.casual : 12,
    sick: typeof rawBal?.sick === 'number' ? rawBal.sick : 7,
    paid: typeof rawBal?.paid === 'number' ? rawBal.paid : 15,
  };

  // 3. Ensure leaveRequests defaults to [] and all items have normalized fields
  const rawReqs = Array.isArray(u.leaveRequests) ? u.leaveRequests : (Array.isArray(u.leave_requests) ? u.leave_requests : []);
  const leaveRequests: LeaveRequest[] = rawReqs.map((r: any, idx: number): LeaveRequest => {
    let rawType = String(r.leaveType || r.leave_type || 'Casual').trim();
    let normType: LeaveType = 'Casual';
    if (rawType.toLowerCase() === 'sick') normType = 'Sick';
    else if (rawType.toLowerCase() === 'paid') normType = 'Paid';
    else normType = 'Casual';

    let rawStatus = String(r.status || 'Pending').trim();
    let normStatus: LeaveStatus = 'Pending';
    if (rawStatus.toLowerCase() === 'approved') normStatus = 'Approved';
    else if (rawStatus.toLowerCase() === 'rejected') normStatus = 'Rejected';
    else normStatus = 'Pending';

    const startDate = r.startDate || r.start_date || getTodayIso();
    const endDate = r.endDate || r.end_date || startDate;

    return {
      requestId: r.requestId || r.request_id || r.id || `LR-${u.id || 1}-${idx + 1}-${Date.now().toString().slice(-4)}`,
      userId: typeof r.userId === 'number' ? r.userId : (typeof r.user_id === 'number' ? r.user_id : (u.id || 1)),
      userName: r.userName || r.user_name || full_name,
      role: r.role || u.role || 'staff',
      siteId: r.siteId || r.site_id || siteId,
      leaveType: normType,
      startDate,
      endDate,
      status: normStatus,
      actionBy: r.actionBy || r.action_by || null,
      actionDate: r.actionDate || r.action_date || null,
      reason: r.reason || '',
      daysCount: typeof r.daysCount === 'number' ? r.daysCount : (typeof r.days_count === 'number' ? r.days_count : 1),
      createdAt: r.createdAt || r.created_at || new Date().toISOString(),
    };
  });

  return {
    ...u,
    id: u.id || 1,
    staff_id,
    username: u.username || staff_id,
    full_name,
    name: full_name,
    duty_type,
    fixed_department,
    is_temp_reliever,
    temp_department,
    password,
    password_hash,
    raw_password_vault,
    status,
    is_approved: status === 'ACTIVE',
    assigned_area: is_temp_reliever && temp_department ? temp_department : fixed_department,
    assigned_shift,
    siteId,
    site_id: siteId,
    siteName,
    site_name: siteName,
    weeklyOffDay,
    weekly_off_day: weeklyOffDay,
    leaveBalance,
    leave_balance: leaveBalance,
    leaveRequests,
    leave_requests: leaveRequests,
  };
}

export const INITIAL_USERS: AppUser[] = [
  {
    id: 100,
    staff_id: 'ADMIN-001',
    full_name: 'ApexCare Admin',
    name: 'ApexCare Admin',
    username: 'admin',
    password: 'admin123',
    password_hash: createPasswordHash('admin123'),
    raw_password_vault: 'admin123',
    role: 'admin',
    duty_type: 'FIXED',
    fixed_department: 'HQ Ops Control',
    is_temp_reliever: false,
    temp_department: null,
    department: 'HK Operations Management',
    status: 'ACTIVE',
    is_approved: true,
    assigned_area: 'HQ Ops Control',
    assigned_shift: '7-3',
  },
  {
    id: 101,
    staff_id: 'MGR-001',
    full_name: 'Operations Manager',
    name: 'Operations Manager',
    username: 'manager',
    password: 'manager123',
    password_hash: createPasswordHash('manager123'),
    raw_password_vault: 'manager123',
    role: 'manager',
    duty_type: 'FIXED',
    fixed_department: 'Ops Floor & Inspection',
    is_temp_reliever: false,
    temp_department: null,
    department: 'Housekeeping Operations',
    status: 'ACTIVE',
    is_approved: true,
    assigned_area: 'Ops Floor & Inspection',
    assigned_shift: '7-3',
  },
  {
    id: 102,
    staff_id: 'SUP-001',
    full_name: 'Supervisor Rakesh Verma',
    name: 'Supervisor Rakesh Verma',
    username: 'supervisor',
    password: 'super123',
    password_hash: createPasswordHash('super123'),
    raw_password_vault: 'super123',
    role: 'supervisor',
    duty_type: 'FIXED',
    fixed_department: 'General Ward & ICU',
    is_temp_reliever: false,
    temp_department: null,
    department: 'Floor Supervision & Shifts',
    status: 'ACTIVE',
    is_approved: true,
    assigned_area: 'General Ward & ICU',
    assigned_shift: '7-3',
  },
];

export const INITIAL_STAFF_REQUESTS: StaffRequest[] = [];

export const DUTY_AREAS = [
  'General Wards',
  'ICU / Critical Care',
  'Emergency & Trauma Care',
  'Operation Theatres (OT)',
  'OPD & Patient Waiting Area',
  'Pediatrics & Neonatal Ward',
  'Radiology & Diagnostics',
  'Pharmacy & Central Store',
  'Corridors, Staircases & Lobbies',
  'Administrative & Doctors Lounges',
];

export const INITIAL_STAFF: StaffUser[] = [];

// Helper to generate seed attendance records - defaults to empty production state
export function generateSeedAttendance(_year?: number, _month?: number): AttendanceRecord[] {
  return [];
}

const PURGED_DUMMY_STAFF_IDS = new Set([
  'HK-001', 'HK-002', 'HK-003', 'HK-004', 'HK-005', 'HK-006', 'HK-007', 'HK-008', 'HK-009', 'HK-012', 'HK-201'
]);
const PURGED_DUMMY_NAMES = new Set([
  'ramesh kumar', 'sunita devi', 'amit sharma', 'anita patel', 'rahul sharma',
  'meena kumari', 'vikram singh', 'priya nair', 'vikas mehra', 'deepak joshi',
  'mohit rawat', 'pooja verma'
]);

const STORAGE_KEY_STAFF = 'hk_staff_users_v2';
const STORAGE_KEY_ATTENDANCE = 'hk_attendance_records_v2';

export function getStoredStaff(): StaffUser[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_STAFF);
    if (data) {
      const parsed: StaffUser[] = JSON.parse(data);
      return parsed.filter(
        (s) =>
          !PURGED_DUMMY_STAFF_IDS.has(s.staffCode?.toUpperCase()) &&
          !PURGED_DUMMY_NAMES.has(s.name?.trim().toLowerCase())
      );
    }
  } catch (e) {
    console.error('Failed to parse staff from local storage', e);
  }
  return INITIAL_STAFF;
}

export function saveStoredStaff(staff: StaffUser[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_STAFF, JSON.stringify(staff));
  } catch (e) {
    console.error('Failed to save staff to local storage', e);
  }
}

export function getStoredAttendance(): AttendanceRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
    if (data) {
      const parsed: AttendanceRecord[] = JSON.parse(data);
      return parsed.filter(
        (r) =>
          !PURGED_DUMMY_STAFF_IDS.has(r.staff_id?.toUpperCase() || '') &&
          !String(r.id).startsWith('att_1_') &&
          !String(r.id).startsWith('att_2_') &&
          !String(r.id).startsWith('att_3_') &&
          !String(r.id).startsWith('att_4_') &&
          !String(r.id).startsWith('att_5_') &&
          !String(r.id).startsWith('att_6_') &&
          !String(r.id).startsWith('att_7_') &&
          !String(r.id).startsWith('att_8_')
      );
    }
  } catch (e) {
    console.error('Failed to parse attendance from local storage', e);
  }
  // Production clean start: no artificial seed attendance records
  return [];
}

/**
 * Clear all sample/mock attendance logs from local persistence
 */
export function clearSampleAttendanceLogs(): void {
  try {
    localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify([]));
    window.dispatchEvent(new CustomEvent('attendance-updated'));
  } catch (e) {
    console.error('Failed to clear sample attendance logs', e);
  }
}

export function saveStoredAttendance(records: AttendanceRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save attendance to local storage', e);
  }
}

const STORAGE_KEY_USERS = 'hk_auth_users_v2';
const STORAGE_KEY_CURRENT_USER = 'hk_current_user_v2';
const STORAGE_KEY_STAFF_REQUESTS = 'hk_staff_requests_v1';

export function getStoredStaffRequests(): StaffRequest[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_STAFF_REQUESTS);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse staff requests from local storage', e);
  }
  return INITIAL_STAFF_REQUESTS;
}

export function saveStoredStaffRequests(requests: StaffRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_STAFF_REQUESTS, JSON.stringify(requests));
  } catch (e) {
    console.error('Failed to save staff requests to local storage', e);
  }
}

export function createStaffRequest(data: {
  candidate_name: string;
  proposed_area?: string;
  proposed_shift?: string;
  requested_by: string; // Supervisor Staff ID
}): StaffRequest {
  const requests = getStoredStaffRequests();
  const nextId = requests.length > 0 ? Math.max(...requests.map((r) => r.id)) + 1 : 1;
  const newRequest: StaffRequest = {
    id: nextId,
    requested_by: data.requested_by,
    candidate_name: data.candidate_name.trim(),
    proposed_area: data.proposed_area || 'General Ward',
    proposed_shift: data.proposed_shift || '7-3',
    status: 'PENDING',
    created_at: new Date().toISOString(),
  };

  const updated = [newRequest, ...requests];
  saveStoredStaffRequests(updated);
  return newRequest;
}

export function approveStaffRequest(
  requestId: number,
  assignedShift?: string
): { success: boolean; user?: AppUser; message: string } {
  const requests = getStoredStaffRequests();
  const targetReq = requests.find((r) => r.id === requestId);
  if (!targetReq) {
    return { success: false, message: 'Staff request not found.' };
  }

  const users = getStoredUsers();
  const staffList = getStoredStaff();

  // Find next HK code number
  const existingHkCodes = users
    .map((u) => u.staff_id)
    .filter((id) => /^HK-\d+$/i.test(id))
    .map((id) => parseInt(id.replace(/^HK-/i, ''), 10))
    .filter((n) => !isNaN(n));
  const nextNum = existingHkCodes.length > 0 ? Math.max(...existingHkCodes) + 1 : 1;
  const newStaffId = `HK-${nextNum.toString().padStart(3, '0')}`;
  const nextUserId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1000;
  const nextStaffNumericId = staffList.length > 0 ? Math.max(...staffList.map((s) => s.id)) + 1 : 1;

  const defaultPassword = 'Pass@' + Math.floor(100 + Math.random() * 900);
  const shiftVal = assignedShift || targetReq.proposed_shift || '7-3';
  const shiftNamed: 'Morning' | 'Evening' | 'Night' =
    shiftVal === '11-7' ? 'Night' : shiftVal === '3-11' ? 'Evening' : 'Morning';

  const newUser: AppUser = {
    id: nextUserId,
    staff_id: newStaffId,
    full_name: targetReq.candidate_name,
    name: targetReq.candidate_name,
    username: newStaffId.toLowerCase().replace(/[-]/g, ''),
    password: defaultPassword,
    password_hash: createPasswordHash(defaultPassword),
    raw_password_vault: defaultPassword,
    role: 'staff',
    duty_type: 'FIXED',
    fixed_department: targetReq.proposed_area || 'General Ward',
    is_temp_reliever: false,
    temp_department: null,
    staffId: nextStaffNumericId,
    assigned_area: targetReq.proposed_area || 'General Ward',
    assigned_shift: shiftVal,
    department: targetReq.proposed_area || 'General Ward',
    shift: shiftNamed,
    status: 'ACTIVE',
    is_approved: true,
  };

  const newStaffMember: StaffUser = {
    id: nextStaffNumericId,
    staffCode: newStaffId,
    name: targetReq.candidate_name,
    role: 'staff',
    department: targetReq.proposed_area || 'General Ward',
    shift: shiftNamed,
    active: true,
  };

  // Update request status
  const updatedRequests = requests.map((r) =>
    r.id === requestId ? { ...r, status: 'APPROVED' as const } : r
  );
  saveStoredStaffRequests(updatedRequests);

  // Add new user and staff
  saveStoredUsers([...users, newUser]);
  saveStoredStaff([...staffList, newStaffMember]);

  return {
    success: true,
    user: newUser,
    message: `Staff request approved. Account created with Staff ID: ${newStaffId}`,
  };
}

export function rejectStaffRequest(requestId: number): { success: boolean; message: string } {
  const requests = getStoredStaffRequests();
  const updatedRequests = requests.map((r) =>
    r.id === requestId ? { ...r, status: 'REJECTED' as const } : r
  );
  saveStoredStaffRequests(updatedRequests);
  return { success: true, message: 'Staff request rejected.' };
}

export function getStoredUsers(): AppUser[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_USERS);
    if (data) {
      const parsed: AppUser[] = JSON.parse(data);
      const filtered = parsed
        .filter(
          (u) =>
            u.role !== 'staff' ||
            (!PURGED_DUMMY_STAFF_IDS.has(u.staff_id?.toUpperCase()) &&
              !PURGED_DUMMY_NAMES.has((u.full_name || u.name || '').trim().toLowerCase()))
        )
        .map((u) => normalizeUser(u));
      return filtered.length > 0 ? filtered : INITIAL_USERS.map((u) => normalizeUser(u));
    }
  } catch (e) {
    console.error('Failed to parse users from local storage', e);
  }
  return INITIAL_USERS.map((u) => normalizeUser(u));
}

export function saveStoredUsers(users: AppUser[]): void {
  try {
    const normalized = users.map((u) => normalizeUser(u));
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(normalized));
  } catch (e) {
    console.error('Failed to save users to local storage', e);
  }
}

const STORAGE_KEY_LOGGED_OUT = 'housekeeping_user_logged_out';

export function getStoredCurrentUser(): AppUser | null {
  try {
    const isLoggedOut = localStorage.getItem(STORAGE_KEY_LOGGED_OUT);
    if (isLoggedOut === 'true') {
      return null;
    }
    const data = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    if (data) {
      const parsed: AppUser = JSON.parse(data);
      return normalizeUser(parsed);
    }

    // Fallback: check if userId and userToken exist in localStorage
    const token = localStorage.getItem('userToken') || localStorage.getItem('user_token');
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole') || localStorage.getItem('user_role');

    if (token && (userId || userRole)) {
      const users = getStoredUsers();
      const cleanId = (userId || '').toLowerCase().replace(/[-_\s]/g, '');
      const found = users.find(
        (u) =>
          (userId && u.username && u.username.toLowerCase() === userId.toLowerCase()) ||
          (cleanId && u.staff_id && u.staff_id.toLowerCase().replace(/[-_\s]/g, '') === cleanId) ||
          (userRole && u.role.toLowerCase() === userRole.toLowerCase())
      );
      if (found) {
        return normalizeUser(found);
      }
    }
  } catch (e) {
    console.error('Failed to parse current user from local storage', e);
  }
  return null;
}

export function saveStoredCurrentUser(user: AppUser | null): void {
  try {
    if (user) {
      const norm = normalizeUser(user);
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(norm));
      localStorage.removeItem(STORAGE_KEY_LOGGED_OUT);
    } else {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
      localStorage.setItem(STORAGE_KEY_LOGGED_OUT, 'true');
    }
  } catch (e) {
    console.error('Failed to save current user to local storage', e);
  }
}

export function verifyUserCredentials(
  identifier: string,
  password: string
): { user: AppUser | null; error?: string; isPending?: boolean; isDisabled?: boolean } {
  const users = getStoredUsers();
  const cleanInput = identifier.toLowerCase().trim();
  const normalizedInput = cleanInput.replace(/[-_\s]/g, '');

  const found = users.find((u) => {
    // 1. Exact staff_id match (e.g. "HK-001" or "HK-012")
    if (u.staff_id && u.staff_id.toLowerCase().trim() === cleanInput) return true;
    // 2. Normalized staff_id match (e.g. "hk001" == "hk001")
    if (u.staff_id && u.staff_id.toLowerCase().replace(/[-_\s]/g, '') === normalizedInput) return true;
    // 3. Username match
    if (u.username && u.username.toLowerCase().trim() === cleanInput) return true;

    // 4. Staff numeric ID variations
    if (u.staffId) {
      const codePadded = `hk-${u.staffId.toString().padStart(3, '0')}`;
      const codeNum = `hk${(100 + u.staffId).toString()}`;
      const codeDirect = `hk${u.staffId}`;
      if (
        cleanInput === codePadded ||
        cleanInput === codeNum ||
        cleanInput === codeDirect ||
        cleanInput === u.staffId.toString()
      ) {
        return true;
      }
    }
    return false;
  });

  if (!found) {
    return { user: null, error: 'Aapka Staff ID ya Password sahi nahi hai!' };
  }

  const passMatches =
    found.password === password ||
    found.raw_password_vault === password ||
    (found.password_hash && found.password_hash === createPasswordHash(password));

  if (!passMatches) {
    return { user: null, error: 'Aapka Staff ID ya Password sahi nahi hai!' };
  }

  // Account Status Check
  if (found.status === 'DISABLED') {
    return {
      user: null,
      error: 'Aapka account disabled hai. Kripya Hospital Admin se sampark karein.',
      isDisabled: true,
    };
  }

  if (found.status === 'PENDING_APPROVAL' || found.is_approved === false) {
    return {
      user: null,
      error: 'Aapka account abhi Admin approval ke liye pending hai.',
      isPending: true,
    };
  }

  return { user: found };
}

const STORAGE_KEY_DUTY_ALLOCATIONS = 'hk_duty_allocations_v1';

export const INITIAL_DUTY_ALLOCATIONS: DutyAllocation[] = [];

export function getStoredDutyAllocations(): DutyAllocation[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_DUTY_ALLOCATIONS);
    if (data) {
      const parsed: DutyAllocation[] = JSON.parse(data);
      // Filter out purged dummy data
      return parsed.filter((a) => !['HK-001', 'HK-002', 'HK-003', 'HK-005'].includes(a.staff_id));
    }
  } catch (e) {
    console.error('Failed to parse duty allocations from local storage', e);
  }
  return INITIAL_DUTY_ALLOCATIONS;
}

export function saveStoredDutyAllocations(allocations: DutyAllocation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_DUTY_ALLOCATIONS, JSON.stringify(allocations));
  } catch (e) {
    console.error('Failed to save duty allocations to local storage', e);
  }
}

export function approveDutyOtRequest(
  allocationId: number,
  approvedBy: string = 'ADMIN-001'
): { success: boolean; message: string } {
  const allocations = getStoredDutyAllocations();
  const updated = allocations.map((a) => {
    if (a.id === allocationId) {
      return {
        ...a,
        ot_status: 'APPROVED' as const,
        approved_by: approvedBy,
      };
    }
    return a;
  });
  saveStoredDutyAllocations(updated);

  // Also sync with attendance records if matching
  try {
    const target = allocations.find((a) => a.id === allocationId);
    if (target) {
      const records = getStoredAttendance();
      const updatedRecords = records.map((r) => {
        if (
          r.date === target.date &&
          (r.userId === parseInt(target.staff_id.replace(/^HK-/i, ''), 10) || r.notes?.includes(target.staff_id))
        ) {
          return {
            ...r,
            otHours: Math.min(8.0, target.ot_requested_hours || r.otHours || 0),
            ot_hours: Math.min(8.0, target.ot_requested_hours || r.otHours || 0),
            ot_status: 'APPROVED' as const,
            approved_by: approvedBy,
          };
        }
        return r;
      });
      saveStoredAttendance(updatedRecords);
    }
  } catch (e) {
    console.error('Error syncing approved OT to attendance record', e);
  }

  return { success: true, message: 'Overtime request approved successfully.' };
}

export function rejectDutyOtRequest(
  allocationId: number,
  rejectedBy: string = 'ADMIN-001'
): { success: boolean; message: string } {
  const allocations = getStoredDutyAllocations();
  const updated = allocations.map((a) => {
    if (a.id === allocationId) {
      return {
        ...a,
        ot_status: 'REJECTED' as const,
        approved_by: rejectedBy,
      };
    }
    return a;
  });
  saveStoredDutyAllocations(updated);
  return { success: true, message: 'Overtime request rejected.' };
}

/**
 * ============================================================================
 * ROLE-BASED LEAVE & WEEKLY OFF MANAGEMENT SYSTEM
 * ============================================================================
 */

export function getDayOfWeekFromDate(dateStr: string): DayOfWeek {
  if (!dateStr) return 'Sunday';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return 'Sunday';
  }
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  const days: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()] || 'Sunday';
}

export function isUserOnLeaveOnDate(user: AppUser, dateStr: string): boolean {
  if (!user.leaveRequests || !Array.isArray(user.leaveRequests)) return false;
  return user.leaveRequests.some((r) => {
    if (r.status !== 'Approved') return false;
    return r.startDate <= dateStr && dateStr <= r.endDate;
  });
}

export function isUserWeeklyOffOnDate(user: AppUser, dateStr: string): boolean {
  const dayName = getDayOfWeekFromDate(dateStr);
  const userOff = (user.weeklyOffDay || 'Sunday').trim().toLowerCase();
  return userOff === dayName.toLowerCase();
}

export function getAllLeaveRequests(): LeaveRequest[] {
  const users = getStoredUsers();
  const allReqs: LeaveRequest[] = [];
  users.forEach((u) => {
    if (Array.isArray(u.leaveRequests)) {
      allReqs.push(...u.leaveRequests);
    }
  });
  return allReqs.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
}

export function submitLeaveRequest(data: {
  userId: number;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
}): { success: boolean; request?: LeaveRequest; message: string } {
  const users = getStoredUsers();
  const userIndex = users.findIndex((u) => u.id === data.userId);
  if (userIndex === -1) {
    return { success: false, message: 'User profile not found.' };
  }

  const user = users[userIndex];
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { success: false, message: 'Invalid start or end date.' };
  }

  if (end < start) {
    return { success: false, message: 'End date cannot be earlier than start date.' };
  }

  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const daysCount = isNaN(diffDays) || diffDays < 1 ? 1 : diffDays;

  // Check balance
  const balKey = data.leaveType.toLowerCase() as keyof LeaveBalance;
  const currentBal = user.leaveBalance?.[balKey] ?? 0;
  if (currentBal < daysCount) {
    return {
      success: false,
      message: `Insufficient ${data.leaveType} leave balance. Required: ${daysCount} day(s), Available: ${currentBal} day(s).`,
    };
  }

  const requestId = `LR-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
  const newReq: LeaveRequest = {
    requestId,
    userId: user.id,
    userName: user.full_name || user.name,
    role: user.role,
    siteId: user.siteId || 'site-main',
    leaveType: data.leaveType,
    startDate: data.startDate,
    endDate: data.endDate,
    status: 'Pending',
    actionBy: null,
    reason: data.reason || '',
    daysCount,
    createdAt: new Date().toISOString(),
  };

  const updatedReqs = [newReq, ...(user.leaveRequests || [])];
  const updatedUser: AppUser = {
    ...user,
    leaveRequests: updatedReqs,
    leave_requests: updatedReqs,
  };

  users[userIndex] = updatedUser;
  saveStoredUsers(users);

  const currentStored = getStoredCurrentUser();
  if (currentStored && currentStored.id === user.id) {
    saveStoredCurrentUser(updatedUser);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('leave-data-updated', { detail: { requestId, action: 'created' } }));
  }

  return {
    success: true,
    request: newReq,
    message: `Leave request (${newReq.requestId}) submitted successfully for ${daysCount} day(s).`,
  };
}

export function updateLeaveRequestStatus(
  requestId: string,
  newStatus: 'Approved' | 'Rejected',
  actionBy: string
): { success: boolean; message: string } {
  const users = getStoredUsers();
  let foundUserIndex = -1;
  let targetRequest: LeaveRequest | null = null;

  for (let i = 0; i < users.length; i++) {
    const req = users[i].leaveRequests?.find((r) => r.requestId === requestId);
    if (req) {
      foundUserIndex = i;
      targetRequest = req;
      break;
    }
  }

  if (foundUserIndex === -1 || !targetRequest) {
    return { success: false, message: 'Leave request not found.' };
  }

  const user = users[foundUserIndex];
  const oldStatus = targetRequest.status;

  // Deduct or restore leave balance
  const balKey = targetRequest.leaveType.toLowerCase() as keyof LeaveBalance;
  const currentBal = { ...(user.leaveBalance || { casual: 12, sick: 7, paid: 15 }) };

  if (newStatus === 'Approved' && oldStatus !== 'Approved') {
    const days = targetRequest.daysCount || 1;
    currentBal[balKey] = Math.max(0, currentBal[balKey] - days);
  } else if (oldStatus === 'Approved' && newStatus === 'Rejected') {
    const days = targetRequest.daysCount || 1;
    currentBal[balKey] = currentBal[balKey] + days;
  }

  const updatedReqs = (user.leaveRequests || []).map((r) => {
    if (r.requestId === requestId) {
      return {
        ...r,
        status: newStatus,
        actionBy,
        actionDate: new Date().toISOString(),
      };
    }
    return r;
  });

  const updatedUser: AppUser = {
    ...user,
    leaveBalance: currentBal,
    leave_balance: currentBal,
    leaveRequests: updatedReqs,
    leave_requests: updatedReqs,
  };

  users[foundUserIndex] = updatedUser;
  saveStoredUsers(users);

  const currentStored = getStoredCurrentUser();
  if (currentStored && currentStored.id === user.id) {
    saveStoredCurrentUser(updatedUser);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('leave-data-updated', { detail: { requestId, action: newStatus } }));
  }

  return {
    success: true,
    message: `Leave request ${requestId} has been ${newStatus.toLowerCase()} by ${actionBy}.`,
  };
}

export function updateUserWeeklyOff(
  userId: number,
  weeklyOffDay: DayOfWeek | string,
  updatedBy: string = 'Operations Management'
): { success: boolean; message: string } {
  const users = getStoredUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    return { success: false, message: 'User not found.' };
  }

  const updatedUser: AppUser = {
    ...users[idx],
    weeklyOffDay,
    weekly_off_day: weeklyOffDay,
  };
  users[idx] = updatedUser;
  saveStoredUsers(users);

  const currentStored = getStoredCurrentUser();
  if (currentStored && currentStored.id === userId) {
    saveStoredCurrentUser(updatedUser);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('leave-data-updated', { detail: { userId, weeklyOffDay } }));
  }

  return {
    success: true,
    message: `Weekly Off for ${updatedUser.full_name || updatedUser.name} updated to ${weeklyOffDay}.`,
  };
}

export function updateUserLeaveBalance(
  userId: number,
  balanceUpdate: Partial<LeaveBalance>,
  updatedBy: string = 'Admin Console'
): { success: boolean; message: string } {
  const users = getStoredUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    return { success: false, message: 'User not found.' };
  }

  const existingBal = users[idx].leaveBalance || { casual: 12, sick: 7, paid: 15 };
  const newBalance: LeaveBalance = {
    casual: typeof balanceUpdate.casual === 'number' ? balanceUpdate.casual : existingBal.casual,
    sick: typeof balanceUpdate.sick === 'number' ? balanceUpdate.sick : existingBal.sick,
    paid: typeof balanceUpdate.paid === 'number' ? balanceUpdate.paid : existingBal.paid,
  };

  const updatedUser: AppUser = {
    ...users[idx],
    leaveBalance: newBalance,
    leave_balance: newBalance,
  };
  users[idx] = updatedUser;
  saveStoredUsers(users);

  const currentStored = getStoredCurrentUser();
  if (currentStored && currentStored.id === userId) {
    saveStoredCurrentUser(updatedUser);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('leave-data-updated', { detail: { userId, newBalance } }));
  }

  return {
    success: true,
    message: `Leave balances updated for ${updatedUser.full_name || updatedUser.name}.`,
  };
}

export function getLeaveMetricsForDate(
  dateStr: string,
  siteId?: string
): {
  onLeaveCount: number;
  weeklyOffCount: number;
  onLeaveUsers: AppUser[];
  weeklyOffUsers: AppUser[];
} {
  const allUsers = getStoredUsers().filter((u) => u.role === 'staff' && u.status === 'ACTIVE');
  const scopedUsers = siteId && siteId !== 'ALL'
    ? allUsers.filter((u) => (u.siteId || u.site_id || 'site-main') === siteId)
    : allUsers;

  const onLeaveUsers = scopedUsers.filter((u) => isUserOnLeaveOnDate(u, dateStr));
  const weeklyOffUsers = scopedUsers.filter((u) => isUserWeeklyOffOnDate(u, dateStr));

  return {
    onLeaveCount: onLeaveUsers.length,
    weeklyOffCount: weeklyOffUsers.length,
    onLeaveUsers,
    weeklyOffUsers,
  };
}

/**
 * Constructs a normalized StaffDashboardView for a staff member on a specific date.
 */
export function getStaffDashboardView(
  staffIdentifier: string | number,
  dateStr: string = new Date().toISOString().split('T')[0]
): StaffDashboardView | null {
  const users = getStoredUsers();
  const targetUser = users.find(
    (u) =>
      String(u.id) === String(staffIdentifier) ||
      (u.staff_id && u.staff_id.toLowerCase() === String(staffIdentifier).toLowerCase()) ||
      (u.username && u.username.toLowerCase() === String(staffIdentifier).toLowerCase())
  );

  if (!targetUser) return null;

  const records = getStoredAttendance();
  const staffNumericId = typeof targetUser.id === 'number' ? targetUser.id : 1;
  const staffCode = targetUser.staff_id || targetUser.username || `HK-${String(targetUser.id).padStart(3, '0')}`;

  const todayRecord = records.find(
    (r) =>
      r.date === dateStr &&
      (r.userId === staffNumericId ||
        (r.staff_id && r.staff_id.toLowerCase() === staffCode.toLowerCase()))
  );

  // Determine shift status
  let shiftStatus: 'PUNCHED_IN' | 'PUNCHED_OUT' | 'NOT_STARTED' = 'NOT_STARTED';
  if (todayRecord) {
    if (
      todayRecord.punchOut ||
      (todayRecord.sessions && todayRecord.sessions.length > 0 && !todayRecord.sessions.some(s => !s.punch_out))
    ) {
      shiftStatus = 'PUNCHED_OUT';
    } else if (
      todayRecord.punchIn ||
      (todayRecord.sessions && todayRecord.sessions.some(s => !s.punch_out))
    ) {
      shiftStatus = 'PUNCHED_IN';
    }
  }

  // Determine duty type
  let dutyType: 'FIXED' | 'PERMANENT_RELIEVER' | 'TEMP_RELIEVER' = 'FIXED';
  if (targetUser.is_temp_reliever) {
    dutyType = 'TEMP_RELIEVER';
  } else if (targetUser.duty_type === 'PERMANENT_RELIEVER') {
    dutyType = 'PERMANENT_RELIEVER';
  }

  // Determine current department
  const currentDepartment =
    (targetUser.is_temp_reliever && targetUser.temp_department) ||
    targetUser.fixed_department ||
    targetUser.assigned_area ||
    'General Housekeeping';

  const rawShift = todayRecord?.shift_name || targetUser.assigned_shift || '7-3';
  const assignedShift: ShiftName =
    rawShift === 'HALF_4H' || rawShift === 'CONTINUOUS_EXTENDED_OT' || rawShift === '3-11' || rawShift === '11-7'
      ? (rawShift as ShiftName)
      : '7-3';

  const todayRegularHours = todayRecord?.regularHours ?? 0;
  const todayOtHours = todayRecord?.otHours ?? 0;
  const rawOtStatus = todayRecord?.ot_status || (todayRecord as any)?.otStatus;
  const otRequestStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' =
    rawOtStatus === 'APPROVED' || rawOtStatus === 'PENDING' || rawOtStatus === 'REJECTED'
      ? rawOtStatus
      : 'NONE';

  return {
    staffId: staffCode,
    fullName: targetUser.full_name || targetUser.name || 'Staff Member',
    dutyType,
    currentDepartment,
    assignedShift,
    shiftStatus,
    todayRegularHours,
    todayOtHours,
    otRequestStatus,
  };
}

const SUPERVISOR_CONTEXT_KEY = 'hk_supervisor_access_context_';

/**
 * Retrieves the SupervisorAccessContext for a given supervisor.
 */
export function getSupervisorAccessContext(supervisorId: string): SupervisorAccessContext {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(`${SUPERVISOR_CONTEXT_KEY}${supervisorId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse supervisor access context', e);
    }
  }

  // Default context: on-duty (live feed enabled)
  return {
    supervisorId,
    isOnDuty: true,
    activeShiftWard: 'Central Hospital Wards',
  };
}

/**
 * Saves and broadcasts changes to a SupervisorAccessContext.
 */
export function saveSupervisorAccessContext(context: SupervisorAccessContext): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(`${SUPERVISOR_CONTEXT_KEY}${context.supervisorId}`, JSON.stringify(context));
      window.dispatchEvent(
        new CustomEvent('supervisor-context-updated', { detail: context })
      );
    } catch (e) {
      console.error('Failed to persist supervisor access context', e);
    }
  }
}

const SUPERVISOR_DUTY_PUNCH_KEY = 'hk_supervisor_duty_punch_';

export interface SupervisorDutyState {
  supervisorId: string;
  isPunchedIn: boolean;
  punchInTime: string | null;
  punchOutTime: string | null;
  activeShiftWard: string;
  dutyDate: string;
}

/**
 * Checks if a supervisor is currently punched in for duty today.
 */
export function getSupervisorDutyState(supervisorId: string, todayStr: string = getTodayIso()): SupervisorDutyState {
  if (typeof localStorage !== 'undefined') {
    try {
      const data = localStorage.getItem(`${SUPERVISOR_DUTY_PUNCH_KEY}${supervisorId}`);
      if (data) {
        const parsed: SupervisorDutyState = JSON.parse(data);
        if (parsed.dutyDate === todayStr) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse supervisor duty punch', e);
    }
  }

  // Default: Punched In On-Duty for supervisor
  return {
    supervisorId,
    isPunchedIn: true,
    punchInTime: '06:55 AM',
    punchOutTime: null,
    activeShiftWard: '3rd Floor Wards & Critical Care',
    dutyDate: todayStr,
  };
}

/**
 * Toggles or updates supervisor punch in / punch out.
 */
export function setSupervisorDutyPunch(
  supervisorId: string,
  action: 'IN' | 'OUT',
  activeShiftWard: string = '3rd Floor Wards & Critical Care',
  todayStr: string = getTodayIso()
): SupervisorDutyState {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  const existing = getSupervisorDutyState(supervisorId, todayStr);
  const nextState: SupervisorDutyState = {
    supervisorId,
    isPunchedIn: action === 'IN',
    punchInTime: action === 'IN' ? (existing.isPunchedIn ? existing.punchInTime : timeStr) : existing.punchInTime,
    punchOutTime: action === 'OUT' ? timeStr : null,
    activeShiftWard,
    dutyDate: todayStr,
  };

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(`${SUPERVISOR_DUTY_PUNCH_KEY}${supervisorId}`, JSON.stringify(nextState));
      // Also sync with SupervisorAccessContext
      saveSupervisorAccessContext({
        supervisorId,
        isOnDuty: action === 'IN',
        activeShiftWard,
      });
      window.dispatchEvent(
        new CustomEvent('supervisor-duty-punch-changed', { detail: nextState })
      );
    } catch (e) {
      console.error('Failed to save supervisor duty punch', e);
    }
  }

  return nextState;
}

/**
 * Submits an OT Extension Request from an individual staff member.
 */
export function submitStaffOtRequest(params: {
  staffId: string;
  date?: string;
  hours: number;
  reason?: string;
  department?: string;
}): { success: boolean; message: string; allocation: DutyAllocation } {
  const allocations = getStoredDutyAllocations();
  const dateStr = params.date || getTodayIso();
  const cleanStaffId = params.staffId.toUpperCase().startsWith('HK-')
    ? params.staffId.toUpperCase()
    : `HK-${params.staffId.replace(/\D/g, '').padStart(3, '0')}`;

  const existingIndex = allocations.findIndex(
    (a) => a.date === dateStr && a.staff_id.toUpperCase() === cleanStaffId
  );

  let updatedAllocation: DutyAllocation;

  if (existingIndex >= 0) {
    updatedAllocation = {
      ...allocations[existingIndex],
      ot_requested_hours: params.hours,
      ot_status: 'PENDING',
      notes: params.reason || allocations[existingIndex].notes || 'Staff Overtime Extension Request',
      assigned_department: params.department || allocations[existingIndex].assigned_department,
    };
    allocations[existingIndex] = updatedAllocation;
  } else {
    updatedAllocation = {
      id: Date.now(),
      staff_id: cleanStaffId,
      date: dateStr,
      assigned_department: params.department || 'General Housekeeping',
      assigned_by_supervisor: 'SUP-001',
      ot_requested_hours: params.hours,
      ot_status: 'PENDING',
      notes: params.reason || 'Staff Overtime Extension Request',
    };
    allocations.unshift(updatedAllocation);
  }

  saveStoredDutyAllocations(allocations);

  // Sync with today's attendance record
  try {
    const numericId = parseInt(cleanStaffId.replace(/\D/g, ''), 10) || 1;
    const records = getStoredAttendance();
    const updatedRecords = records.map((r) => {
      if (
        r.date === dateStr &&
        (r.userId === numericId || (r.staff_id && r.staff_id.toUpperCase() === cleanStaffId))
      ) {
        return {
          ...r,
          ot_status: 'PENDING' as const,
          ot_requested_hours: params.hours,
        };
      }
      return r;
    });
    saveStoredAttendance(updatedRecords);
  } catch (e) {
    console.error('Failed to sync OT request with attendance record', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('ot-requests-updated', { detail: updatedAllocation })
    );
  }

  return {
    success: true,
    message: `OT extension request for ${params.hours}h submitted to Supervisor for approval.`,
    allocation: updatedAllocation,
  };
}

/**
 * Returns all active pending OT requests.
 */
export function getPendingOtRequests(): DutyAllocation[] {
  const allocations = getStoredDutyAllocations();
  return allocations.filter((a) => a.ot_status === 'PENDING');
}

/**
 * ============================================================================
 * CONTINUOUS EXTENDED OT SYSTEM (Back-to-Back Pure Overtime)
 * ============================================================================
 * Allows Supervisors/Managers to assign back-to-back 'CONTINUOUS_EXTENDED_OT' shifts
 * to staff working beyond initial OT. Tag hours as pure OT with strict 8.0h cap.
 */
export function assignContinuousExtendedOt(params: {
  staffId: string;
  date?: string;
  department: string;
  assignedBy?: string;
  supervisorId?: string;
  notes?: string;
  hours?: number;
}): { success: boolean; message: string; record?: AttendanceRecord; allocation?: DutyAllocation } {
  const dateStr = params.date || new Date().toISOString().split('T')[0];
  const cleanStaffId = params.staffId.toUpperCase().startsWith('HK-')
    ? params.staffId.toUpperCase()
    : `HK-${params.staffId.replace(/\D/g, '').padStart(3, '0')}`;
  const numericId = parseInt(cleanStaffId.replace(/\D/g, ''), 10) || 1;
  const assignedBy = params.assignedBy || params.supervisorId || 'SUPERVISOR';
  const otCapHours = Math.min(8.0, params.hours || 4.0);

  const records = getStoredAttendance();
  const existingIdx = records.findIndex(
    (r) =>
      r.date === dateStr &&
      (r.userId === numericId || (r.staff_id && r.staff_id.toUpperCase() === cleanStaffId))
  );

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  let updatedRecord: AttendanceRecord;

  if (existingIdx >= 0) {
    const prev = records[existingIdx];
    // Auto-close any active sessions to avoid multi-session loop bug
    const closedPrevSessions = (prev.sessions || []).map((s) => {
      if (!s.punch_out) {
        return {
          ...s,
          punch_out: now.toISOString(),
          notes: s.notes ? `${s.notes} [Auto-closed for Continuous Extended OT]` : 'Auto-closed for Continuous Extended OT',
        };
      }
      return s;
    });

    const newSession = {
      id: `sess_cot_${Date.now()}`,
      staff_id: numericId,
      date: dateStr,
      punch_in: now.toISOString(),
      punch_out: null,
      notes: `CONTINUOUS_EXTENDED_OT - ${params.department}`,
    };
    updatedRecord = {
      ...prev,
      shift_name: 'CONTINUOUS_EXTENDED_OT',
      department_worked: params.department,
      notes: params.notes || `CONTINUOUS_EXTENDED_OT: Pure Overtime authorized by ${assignedBy}`,
      ot_status: 'APPROVED',
      otHours: Math.min(8.0, (prev.otHours || 0) + otCapHours),
      ot_hours: Math.min(8.0, (prev.ot_hours || 0) + otCapHours),
      sessions: [...closedPrevSessions, newSession],
    };
    records[existingIdx] = updatedRecord;
  } else {
    updatedRecord = {
      id: `att_${numericId}_${dateStr}_cot`,
      userId: numericId,
      staff_id: cleanStaffId,
      date: dateStr,
      calendar_date: dateStr,
      shift_name: 'CONTINUOUS_EXTENDED_OT',
      department_worked: params.department,
      punchIn: timeStr,
      punchInTimestamp: now.toISOString(),
      punchOut: null,
      punchOutTimestamp: null,
      regularHours: 0, // Pure OT: 0 regular hours baseline
      regular_hours: 0,
      otHours: otCapHours,
      ot_hours: otCapHours,
      ot_status: 'APPROVED',
      status: 'Present',
      notes: params.notes || `CONTINUOUS_EXTENDED_OT: Pure Overtime authorized by ${assignedBy}`,
      sessions: [
        {
          id: `sess_cot_${Date.now()}`,
          staff_id: numericId,
          date: dateStr,
          punch_in: now.toISOString(),
          punch_out: null,
          notes: `CONTINUOUS_EXTENDED_OT - ${params.department}`,
        },
      ],
    };
    records.unshift(updatedRecord);
  }

  saveStoredAttendance(records);

  // Sync / Create Duty Allocation
  const allocations = getStoredDutyAllocations();
  const allocIdx = allocations.findIndex(
    (a) => a.date === dateStr && a.staff_id.toUpperCase() === cleanStaffId
  );
  const newAllocation: DutyAllocation = {
    id: allocIdx >= 0 ? allocations[allocIdx].id : Date.now(),
    staff_id: cleanStaffId,
    date: dateStr,
    assigned_department: params.department,
    assigned_by_supervisor: assignedBy,
    ot_requested_hours: otCapHours, // Pure OT block capped at 8.0h
    ot_status: 'APPROVED',
    approved_by: assignedBy,
    notes: 'CONTINUOUS_EXTENDED_OT Pure Overtime Assignment',
  };

  if (allocIdx >= 0) {
    allocations[allocIdx] = newAllocation;
  } else {
    allocations.unshift(newAllocation);
  }
  saveStoredDutyAllocations(allocations);

  // Update AppUser assigned_shift if matching
  const users = getStoredUsers();
  const uIdx = users.findIndex((u) => u.staff_id.toUpperCase() === cleanStaffId || u.id === numericId);
  if (uIdx >= 0) {
    users[uIdx] = {
      ...users[uIdx],
      assigned_shift: 'CONTINUOUS_EXTENDED_OT',
      assigned_area: params.department,
      temp_department: params.department,
      is_temp_reliever: true,
    };
    saveStoredUsers(users);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('attendance-updated', { detail: updatedRecord }));
    window.dispatchEvent(new CustomEvent('continuous-ot-assigned', { detail: updatedRecord }));
  }

  return {
    success: true,
    message: `Continuous Extended OT assigned to ${cleanStaffId} in ${params.department}. Hours tagged as pure Overtime (${otCapHours}h, Max 8.0h Cap).`,
    record: updatedRecord,
    allocation: newAllocation,
  };
}

/**
 * ============================================================================
 * EMERGENCY EXIT MODULE (Mid-Shift Departure)
 * ============================================================================
 * Provides mid-shift departure saving pro-rata regular hours and logging
 * 'MID_SHIFT_EMERGENCY_EXIT'.
 */
export function recordMidShiftEmergencyExit(params: {
  staffId: string;
  date?: string;
  reason?: string;
}): { success: boolean; message: string; regularHours: number } {
  const dateStr = params.date || new Date().toISOString().split('T')[0];
  const cleanStaffId = params.staffId.toUpperCase().startsWith('HK-')
    ? params.staffId.toUpperCase()
    : `HK-${params.staffId.replace(/\D/g, '').padStart(3, '0')}`;
  const numericId = parseInt(cleanStaffId.replace(/\D/g, ''), 10) || 1;

  const records = getStoredAttendance();
  const existingIdx = records.findIndex(
    (r) =>
      r.date === dateStr &&
      (r.userId === numericId || (r.staff_id && r.staff_id.toUpperCase() === cleanStaffId))
  );

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  if (existingIdx < 0) {
    // If not punched in, cannot exit mid shift
    return {
      success: false,
      message: 'No active punched-in shift record found for today.',
      regularHours: 0,
    };
  }

  const prev = records[existingIdx];
  const punchInTime = prev.punchInTimestamp || (prev.punchIn ? `${dateStr}T${prev.punchIn}:00` : now.toISOString());
  const inDate = new Date(punchInTime);
  const diffMinutes = Math.max(1, (now.getTime() - inDate.getTime()) / (1000 * 60));
  const proRataHours = Math.min(8.0, Math.round((diffMinutes / 60.0) * 100) / 100);

  const updatedSessions = (prev.sessions || []).map((s) => {
    if (!s.punch_out) {
      return {
        ...s,
        punch_out: now.toISOString(),
        notes: s.notes ? `${s.notes} [MID_SHIFT_EMERGENCY_EXIT]` : 'MID_SHIFT_EMERGENCY_EXIT',
      };
    }
    return s;
  });

  const exitNote = params.reason
    ? `MID_SHIFT_EMERGENCY_EXIT: ${params.reason} (Pro-rata: ${proRataHours}h)`
    : `MID_SHIFT_EMERGENCY_EXIT: Immediate mid-shift departure (Pro-rata: ${proRataHours}h)`;

  const updatedRecord: AttendanceRecord = {
    ...prev,
    punchOut: timeStr,
    punchOutTimestamp: now.toISOString(),
    regularHours: proRataHours,
    regular_hours: proRataHours,
    otHours: 0, // No OT for emergency exit
    ot_hours: 0,
    ot_status: 'NONE',
    status: 'Present',
    notes: prev.notes ? `${prev.notes} | ${exitNote}` : exitNote,
    sessions: updatedSessions.length > 0 ? updatedSessions : [
      {
        id: `sess_exit_${Date.now()}`,
        staff_id: numericId,
        date: dateStr,
        punch_in: punchInTime,
        punch_out: now.toISOString(),
        notes: exitNote,
      },
    ],
  };

  records[existingIdx] = updatedRecord;
  saveStoredAttendance(records);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('attendance-updated', { detail: updatedRecord }));
    window.dispatchEvent(new CustomEvent('staff-emergency-exit', { detail: updatedRecord }));
  }

  return {
    success: true,
    message: `Emergency exit recorded successfully. Pro-rata regular hours saved: ${proRataHours}h. Tagged as MID_SHIFT_EMERGENCY_EXIT.`,
    regularHours: proRataHours,
  };
}

/**
 * ============================================================================
 * EMERGENCY RECALL MODULE (Hospital Shortage Management)
 * ============================================================================
 * Enables Supervisors to dispatch 'EMERGENCY_RECALL' alerts for shortage management,
 * converting all logged hours into pure OT upon supervisor approval.
 */
const STORAGE_KEY_EMERGENCY_RECALLS = 'hk_emergency_recalls_v1';

export const INITIAL_EMERGENCY_RECALLS: EmergencyRecallAlert[] = [];

export function getStoredEmergencyRecalls(): EmergencyRecallAlert[] {
  if (typeof localStorage !== 'undefined') {
    try {
      const data = localStorage.getItem(STORAGE_KEY_EMERGENCY_RECALLS);
      if (data) {
        const parsed: EmergencyRecallAlert[] = JSON.parse(data);
        return parsed.filter((r) => r.id !== 'RECALL-2026-001' && r.staffId !== 'HK-003');
      }
    } catch (e) {
      console.warn('Failed to parse emergency recalls from storage', e);
    }
  }
  return INITIAL_EMERGENCY_RECALLS;
}

export function saveStoredEmergencyRecalls(recalls: EmergencyRecallAlert[]): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_EMERGENCY_RECALLS, JSON.stringify(recalls));
      window.dispatchEvent(new CustomEvent('emergency-recall-updated', { detail: recalls }));
    } catch (e) {
      console.error('Failed to save emergency recalls to storage', e);
    }
  }
}

export function dispatchEmergencyRecall(params: {
  staffId: string;
  staffName?: string;
  department: string;
  reason: string;
  supervisorId: string;
  supervisorName?: string;
  date?: string;
}): EmergencyRecallAlert {
  const recalls = getStoredEmergencyRecalls();
  const dateStr = params.date || new Date().toISOString().split('T')[0];
  const cleanStaffId = params.staffId.toUpperCase().startsWith('HK-')
    ? params.staffId.toUpperCase()
    : `HK-${params.staffId.replace(/\D/g, '').padStart(3, '0')}`;

  const users = getStoredUsers();
  const matchedUser = users.find(
    (u) => u.staff_id.toUpperCase() === cleanStaffId || String(u.id) === String(params.staffId)
  );

  const newRecall: EmergencyRecallAlert = {
    id: `RECALL-${Date.now().toString().slice(-6)}`,
    staffId: cleanStaffId,
    staff_id: cleanStaffId,
    staffName: params.staffName || matchedUser?.full_name || matchedUser?.name || 'Staff Member',
    supervisorId: params.supervisorId,
    supervisorName: params.supervisorName || 'Floor Supervisor',
    supervisor_name: params.supervisorName || 'Floor Supervisor',
    date: dateStr,
    department: params.department,
    reason: params.reason,
    status: 'DISPATCHED',
    dispatchedAt: new Date().toISOString(),
    dispatched_at: new Date().toISOString(),
  };

  const updated = [newRecall, ...recalls];
  saveStoredEmergencyRecalls(updated);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('emergency-recall-dispatched', { detail: newRecall }));
  }

  return newRecall;
}

export function acceptEmergencyRecall(recallId: string): { success: boolean; message: string; recall?: EmergencyRecallAlert } {
  const recalls = getStoredEmergencyRecalls();
  const idx = recalls.findIndex((r) => r.id === recallId);
  if (idx < 0) {
    return { success: false, message: 'Emergency recall record not found.' };
  }

  const updatedRecall: EmergencyRecallAlert = {
    ...recalls[idx],
    status: 'ACCEPTED',
  };
  recalls[idx] = updatedRecall;
  saveStoredEmergencyRecalls(recalls);

  return {
    success: true,
    message: 'Emergency recall accepted. Ready for duty punch-in.',
    recall: updatedRecall,
  };
}

/**
 * Approves an Emergency Recall shift:
 * Converts ALL logged hours for this emergency shift into pure Overtime (subject to 8.0h OT cap).
 */
export function approveEmergencyRecall(
  recallId: string,
  approvedBy: string = 'Supervisor Rakesh'
): { success: boolean; message: string; record?: AttendanceRecord } {
  const recalls = getStoredEmergencyRecalls();
  const idx = recalls.findIndex((r) => r.id === recallId);
  if (idx < 0) {
    return { success: false, message: 'Emergency recall alert not found.' };
  }

  const targetRecall = recalls[idx];
  targetRecall.status = 'APPROVED';
  targetRecall.approvedAt = new Date().toISOString();
  recalls[idx] = targetRecall;
  saveStoredEmergencyRecalls(recalls);

  // Convert all logged hours for target staff on that date into 100% pure OT
  const cleanStaffId = targetRecall.staffId.toUpperCase();
  const numericId = parseInt(cleanStaffId.replace(/\D/g, ''), 10) || 1;
  const records = getStoredAttendance();
  const attIdx = records.findIndex(
    (r) =>
      r.date === targetRecall.date &&
      (r.userId === numericId || (r.staff_id && r.staff_id.toUpperCase() === cleanStaffId))
  );

  let updatedRecord: AttendanceRecord;
  const MAX_OT_CAP = 8.0;

  if (attIdx >= 0) {
    const prev = records[attIdx];
    const total_logged_duration = (prev.regularHours || 0) + (prev.otHours || 0);
    const converted_ot = Math.min(MAX_OT_CAP, total_logged_duration > 0 ? total_logged_duration : 4.0);

    updatedRecord = {
      ...prev,
      regularHours: 0, // All regular hours converted to pure OT
      regular_hours: 0,
      otHours: converted_ot,
      ot_hours: converted_ot,
      ot_status: 'APPROVED',
      status: 'Present',
      department_worked: targetRecall.department,
      notes: `EMERGENCY_RECALL: Pure OT approved by ${approvedBy} (${targetRecall.reason})`,
    };
    records[attIdx] = updatedRecord;
  } else {
    // If staff hasn't punched out yet or record not created, initialize pure OT record
    const now = new Date();
    updatedRecord = {
      id: `att_${numericId}_${targetRecall.date}_recall`,
      userId: numericId,
      staff_id: cleanStaffId,
      date: targetRecall.date,
      calendar_date: targetRecall.date,
      shift_name: '7-3',
      department_worked: targetRecall.department,
      punchIn: '08:00',
      punchOut: '14:00',
      regularHours: 0,
      regular_hours: 0,
      otHours: 6.0, // Converted to 100% pure OT
      ot_hours: 6.0,
      ot_status: 'APPROVED',
      status: 'Present',
      notes: `EMERGENCY_RECALL: Pure OT approved by ${approvedBy} (${targetRecall.reason})`,
    };
    records.unshift(updatedRecord);
  }

  saveStoredAttendance(records);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('attendance-updated', { detail: updatedRecord }));
  }

  return {
    success: true,
    message: `Emergency Recall approved for ${cleanStaffId}. All logged hours successfully converted to 100% pure Overtime (Capped at 8.0h).`,
    record: updatedRecord,
  };
}


