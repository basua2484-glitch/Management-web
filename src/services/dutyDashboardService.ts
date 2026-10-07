// src/services/dutyDashboardService.ts
// Real-time Shift-based & Role-wise Live Dashboard Service for Daily Punch & Duty Assignments

import type { AppUser, StaffUser, AttendanceRecord } from '../types';

export type ShiftNameType = 'Morning' | 'Evening' | 'Night';
export type ShiftFilterType = 'ALL' | 'Morning' | 'Evening' | 'Night';
export type RoleGroupType = 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'STAFF';
export type LivePunchStatus = 'NOT_PUNCHED_IN' | 'PUNCHED_IN' | 'PUNCHED_OUT' | 'ABSENT' | 'PENDING';

export interface LiveDutyLog {
  id: string | number;
  userId: string; // e.g. "APEX-MGR-001", "APEX-SUP-001", "APEX-STF-001"
  numericId: number;
  userName: string;
  staffCode: string;
  role: RoleGroupType;
  assignedShift: ShiftNameType;
  assignedArea: string;
  status: LivePunchStatus;
  punchIn: string | null;
  punchOut: string | null;
  punchInTime?: string | null;
  punchOutTime?: string | null;
  punchInTimestamp?: string | null;
  punchOutTimestamp?: string | null;
  totalWorkedHours: number;
  regularHours: number;
  otHours: number;
  department?: string;
  phone?: string;
  notes?: string;
  siteId?: string;
  siteName?: string;
}

/**
 * 4. Real-Time Shift Auto-Detect:
 *    07:00 - 15:00 -> Morning Shift
 *    15:00 - 23:00 -> Evening Shift
 *    23:00 - 07:00 -> Night Shift
 */
export function detectCurrentShift(date: Date = new Date()): ShiftNameType {
  const hours = date.getHours();
  if (hours >= 7 && hours < 15) {
    return 'Morning';
  } else if (hours >= 15 && hours < 23) {
    return 'Evening';
  } else {
    return 'Night';
  }
}

/**
 * Shift details helper
 */
export function getShiftTimingDetails(shift: ShiftNameType | string): {
  shift: ShiftNameType;
  label: string;
  timeRange: string;
  startHour: number;
  endHour: number;
} {
  const norm = normalizeShift(shift);
  if (norm === 'Morning') {
    return {
      shift: 'Morning',
      label: 'Morning Shift',
      timeRange: '07:00 - 15:00',
      startHour: 7,
      endHour: 15,
    };
  } else if (norm === 'Evening') {
    return {
      shift: 'Evening',
      label: 'Evening Shift',
      timeRange: '15:00 - 23:00',
      startHour: 15,
      endHour: 23,
    };
  } else {
    return {
      shift: 'Night',
      label: 'Night Shift',
      timeRange: '23:00 - 07:00',
      startHour: 23,
      endHour: 7,
    };
  }
}

/**
 * Normalizes any string representation of a shift to 'Morning' | 'Evening' | 'Night'
 */
export function normalizeShift(rawShift?: string | null): ShiftNameType {
  if (!rawShift) return 'Morning';
  const clean = String(rawShift).trim().toLowerCase();
  if (clean.includes('night') || clean === '11-7') return 'Night';
  if (clean.includes('evening') || clean === '3-11') return 'Evening';
  return 'Morning';
}

/**
 * Normalizes role to 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'STAFF'
 */
export function normalizeRole(rawRole?: string | null): RoleGroupType {
  const r = String(rawRole || '').trim().toUpperCase();
  if (r.includes('ADMIN') || r === 'ADM') return 'ADMIN';
  if (r.includes('MANAGE') || r === 'MGR') return 'MANAGER';
  if (r.includes('SUPERVIS') || r === 'SUP') return 'SUPERVISOR';
  return 'STAFF';
}

/**
 * Computes live elapsed duration from punch-in timestamp or time string
 */
export function calculateLivePunchTimer(
  punchInTimeStr: string | null | undefined,
  punchInTimestamp?: string | null
): string {
  if (!punchInTimeStr && !punchInTimestamp) return '0h 0m';
  try {
    const now = new Date();
    let startTime: Date | null = null;

    if (punchInTimestamp) {
      startTime = new Date(punchInTimestamp);
    } else if (punchInTimeStr) {
      const timeMatch = punchInTimeStr.match(/(\d{1,2}):(\d{2})(?:\s*([AP]M))?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const ampm = timeMatch[3];
        if (ampm) {
          if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
          if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
        }
        startTime = new Date();
        startTime.setHours(hours, minutes, 0, 0);
      }
    }

    if (!startTime || isNaN(startTime.getTime())) {
      return '0h 0m';
    }

    const diffMs = Math.max(0, now.getTime() - startTime.getTime());
    const totalMinutes = Math.floor(diffMs / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  } catch {
    return '0h 0m';
  }
}

/**
 * Strict Dynamic Shift & Role Filtering Logic
 * 1. Filter logs strictly by logged-in company tenant AND selected shift:
 *    const filteredLogs = dutyLogs.filter(log => 
 *      log.userId.startsWith(activeTenantPrefix) &&
 *      (selectedShift === 'ALL' || log.assignedShift === selectedShift)
 *    );
 * 2. Enforce Exclusive Role Filtering (No Duplication Across Sections):
 *    // 1. Operations Managers
 *    const managers = filteredLogs.filter(user => 
 *      user.role === 'MANAGER' || user.role === 'MGR'
 *    );
 *    // 2. Ward & Floor Supervisors
 *    const supervisors = filteredLogs.filter(user => 
 *      user.role === 'SUPERVISOR' || user.role === 'SUP'
 *    );
 *    // 3. Housekeeping Staff (STRICT EXCLUSION of Supervisor/Admin/Manager)
 *    const housekeepingStaff = filteredLogs.filter(user => 
 *      user.role === 'STAFF' || 
 *      (user.role !== 'SUPERVISOR' && user.role !== 'ADMIN' && user.role !== 'MANAGER' && user.id.includes('-STF-'))
 *    );
 *    // 4. Facility Administration & Oversight
 *    const admins = filteredLogs.filter(user => 
 *      user.role === 'ADMIN'
 *    );
 */
export function filterAndGroupDutyLogs(
  dutyLogs: LiveDutyLog[],
  activeTenantPrefix: string,
  selectedShift: ShiftFilterType,
  siteFilter?: string
): {
  filteredLogs: LiveDutyLog[];
  managers: LiveDutyLog[];
  supervisors: LiveDutyLog[];
  housekeepingStaff: LiveDutyLog[];
  admins: LiveDutyLog[];
  managerLogs: LiveDutyLog[];
  supervisorLogs: LiveDutyLog[];
  staffLogs: LiveDutyLog[];
  adminLogs: LiveDutyLog[];
} {
  const cleanPrefix = (activeTenantPrefix || 'APEX').trim().toUpperCase();

  const filteredLogs = dutyLogs.filter((log) => {
    const id = String(log.userId || log.id || '').toUpperCase();
    const matchesTenant = id.startsWith(cleanPrefix);
    const matchesShift = selectedShift === 'ALL' || log.assignedShift === selectedShift;
    const matchesSite = !siteFilter || siteFilter === 'ALL' || log.siteId === siteFilter;
    return matchesTenant && matchesShift && matchesSite;
  });

  // 1. Operations Managers
  const managers = filteredLogs.filter((user) => {
    const r = (user.role || '').toUpperCase();
    return r === 'MANAGER' || r === 'MGR';
  });

  // 2. Ward & Floor Supervisors
  const supervisors = filteredLogs.filter((user) => {
    const r = (user.role || '').toUpperCase();
    return r === 'SUPERVISOR' || r === 'SUP';
  });

  // 3. Housekeeping Staff (STRICT EXCLUSION of Supervisor/Admin/Manager)
  const housekeepingStaff = filteredLogs.filter((user) => {
    const r = (user.role || '').toUpperCase();
    const idStr = String(user.id || user.userId || '');
    return (
      r === 'STAFF' ||
      (r !== 'SUPERVISOR' &&
        r !== 'SUP' &&
        r !== 'ADMIN' &&
        r !== 'MANAGER' &&
        r !== 'MGR' &&
        idStr.includes('-STF-'))
    );
  });

  // 4. Facility Administration & Oversight
  const admins = filteredLogs.filter((user) => {
    const r = (user.role || '').toUpperCase();
    return r === 'ADMIN';
  });

  return {
    filteredLogs,
    managers,
    supervisors,
    housekeepingStaff,
    admins,
    managerLogs: managers,
    supervisorLogs: supervisors,
    staffLogs: housekeepingStaff,
    adminLogs: admins,
  };
}

/**
 * Constructs comprehensive LiveDutyLog items from AppUsers, StaffUsers, and AttendanceRecords
 */
export function buildLiveDutyLogs(params: {
  users?: AppUser[];
  staff?: StaffUser[];
  records?: AttendanceRecord[];
  selectedDate: string;
  activeTenantPrefix: string;
}): LiveDutyLog[] {
  const { users = [], staff = [], records = [], selectedDate, activeTenantPrefix } = params;
  const prefix = (activeTenantPrefix || 'APEX').trim().toUpperCase();

  // Map attendance records for selectedDate by userId and staff_id
  const userRecordMap = new Map<number, AttendanceRecord>();
  const codeRecordMap = new Map<string, AttendanceRecord>();

  records
    .filter((r) => r.date === selectedDate)
    .forEach((rec) => {
      if (rec.userId) userRecordMap.set(rec.userId, rec);
      if (rec.staff_id) codeRecordMap.set(rec.staff_id.toUpperCase(), rec);
      if ((rec as any).staffId) codeRecordMap.set(String((rec as any).staffId).toUpperCase(), rec);
    });

  // Track processed codes to avoid duplicates
  const processedCodes = new Set<string>();
  const logs: LiveDutyLog[] = [];

  // Helper to ensure userId starts with activeTenantPrefix
  const formatTenantUserId = (code: string, role: RoleGroupType, numId: number): string => {
    const cleanCode = (code || '').trim().toUpperCase();
    if (cleanCode.startsWith(prefix)) {
      return cleanCode;
    }
    const roleSlug =
      role === 'ADMIN'
        ? 'ADM'
        : role === 'MANAGER'
        ? 'MGR'
        : role === 'SUPERVISOR'
        ? 'SUP'
        : 'STF';
    return `${prefix}-${roleSlug}-${String(numId).padStart(3, '0')}`;
  };

  // 1. Process AppUsers (covers Managers, Supervisors, registered Staff, and Admins)
  users.forEach((u) => {
    let roleUpper = normalizeRole(u.role);
    const numId = Number(u.id) || 1;
    const rawCode = u.staff_id || u.username || `HK-${numId}`;
    const rawCodeUpper = rawCode.toUpperCase();

    // Explicit Admin check
    if (roleUpper === 'STAFF' && (rawCodeUpper.includes('-ADM-') || rawCodeUpper.includes('ADMIN'))) {
      roleUpper = 'ADMIN';
    }

    const tenantUserId = formatTenantUserId(rawCode, roleUpper, numId);

    // Filter to active tenant
    const userTenant = (u.company_prefix || u.tenant_id || u.tenantId || '').toUpperCase();
    if (userTenant && userTenant !== prefix && !tenantUserId.startsWith(prefix)) {
      return;
    }

    if (processedCodes.has(tenantUserId)) return;
    processedCodes.add(tenantUserId);

    // Check if a VALID punch-in record actually exists in the database/localStorage for the current user and shift date
    const userPunchLog =
      userRecordMap.get(numId) ||
      codeRecordMap.get(tenantUserId) ||
      codeRecordMap.get(rawCode.toUpperCase());

    // Determine shift
    const assignedShift = normalizeShift(u.assigned_shift || u.shift || (userPunchLog?.shift_name as any));

    const rawPunchIn =
      userPunchLog?.punchIn ||
      (userPunchLog as any)?.punchInTime ||
      (userPunchLog?.punch_in_time ? userPunchLog.punch_in_time.slice(11, 16) : null) ||
      null;

    const rawPunchOut =
      userPunchLog?.punchOut ||
      (userPunchLog as any)?.punchOutTime ||
      (userPunchLog?.punch_out_time ? userPunchLog.punch_out_time.slice(11, 16) : null) ||
      null;

    const hasValidPunchIn = Boolean(
      rawPunchIn &&
      rawPunchIn.trim() !== '' &&
      rawPunchIn !== '--:--' &&
      rawPunchIn !== '--'
    );
    const hasValidPunchOut = Boolean(
      rawPunchOut &&
      rawPunchOut.trim() !== '' &&
      rawPunchOut !== '--:--' &&
      rawPunchOut !== '--'
    );

    // Enforce Strict Punch Status Logic (Requirements 1 & 2):
    // Do NOT default status to 'PUNCHED_IN' or inject fake '07:30 AM' timestamps.
    let status: LivePunchStatus = 'NOT_PUNCHED_IN';
    let punchIn: string | null = null;
    let punchOut: string | null = null;
    let punchInTimestamp: string | null = null;
    let punchOutTimestamp: string | null = null;
    let regularHours = 0;
    let otHours = 0;

    if (!userPunchLog || !hasValidPunchIn) {
      status = 'NOT_PUNCHED_IN'; // Show Red/Yellow Badge
      punchIn = null; // displays "--:--"
      punchOut = null; // displays "--:--"
      punchInTimestamp = null;
      punchOutTimestamp = null;
      regularHours = 0;
      otHours = 0;
    } else if (hasValidPunchIn && !hasValidPunchOut) {
      status = 'PUNCHED_IN'; // Show Green Badge
      punchIn = rawPunchIn;
      punchOut = null; // displays "--:--"
      punchInTimestamp = userPunchLog.punchInTimestamp || userPunchLog.punch_in_time || null;
      punchOutTimestamp = null;
      regularHours = userPunchLog.regularHours || 0;
      otHours = userPunchLog.otHours || 0;
    } else if (hasValidPunchIn && hasValidPunchOut) {
      status = 'PUNCHED_OUT'; // Show Blue Badge
      punchIn = rawPunchIn;
      punchOut = rawPunchOut;
      punchInTimestamp = userPunchLog.punchInTimestamp || userPunchLog.punch_in_time || null;
      punchOutTimestamp = userPunchLog.punchOutTimestamp || userPunchLog.punch_out_time || null;
      regularHours = userPunchLog.regularHours || 0;
      otHours = userPunchLog.otHours || 0;
    }

    const totalWorkedHours = regularHours + otHours;

    logs.push({
      id: `duty-user-${numId}`,
      userId: tenantUserId,
      numericId: numId,
      userName: u.full_name || u.name || tenantUserId,
      staffCode: tenantUserId,
      role: roleUpper,
      assignedShift,
      assignedArea: u.fixed_department || u.department || u.assigned_area || 'Hospital Operations',
      status,
      punchIn,
      punchOut,
      punchInTime: punchIn,
      punchOutTime: punchOut,
      punchInTimestamp,
      punchOutTimestamp,
      totalWorkedHours,
      regularHours,
      otHours,
      department: u.department || u.fixed_department,
      phone: u.mobile || u.phone,
      notes: userPunchLog?.notes,
      siteId: u.siteId || u.site_id || 'SITE_APEX_MAIN',
      siteName: u.siteName || u.site_name || 'Apex Main Hospital',
    });
  });

  // 2. Process any StaffUser not already in logs
  staff.forEach((s) => {
    let roleUpper = normalizeRole(s.role);
    const numId = Number(s.id) || 1;
    const rawCode = s.staffCode || `HK-${numId}`;
    const rawCodeUpper = rawCode.toUpperCase();

    // Explicit Admin check
    if (roleUpper === 'STAFF' && (rawCodeUpper.includes('-ADM-') || rawCodeUpper.includes('ADMIN'))) {
      roleUpper = 'ADMIN';
    }

    const tenantUserId = formatTenantUserId(rawCode, roleUpper, numId);

    if (processedCodes.has(tenantUserId)) return;
    processedCodes.add(tenantUserId);

    const userPunchLog =
      userRecordMap.get(numId) ||
      codeRecordMap.get(tenantUserId) ||
      codeRecordMap.get(rawCode.toUpperCase());

    const assignedShift = normalizeShift(s.shift || (userPunchLog?.shift_name as any));

    const rawPunchIn =
      userPunchLog?.punchIn ||
      (userPunchLog as any)?.punchInTime ||
      (userPunchLog?.punch_in_time ? userPunchLog.punch_in_time.slice(11, 16) : null) ||
      null;

    const rawPunchOut =
      userPunchLog?.punchOut ||
      (userPunchLog as any)?.punchOutTime ||
      (userPunchLog?.punch_out_time ? userPunchLog.punch_out_time.slice(11, 16) : null) ||
      null;

    const hasValidPunchIn = Boolean(
      rawPunchIn &&
      rawPunchIn.trim() !== '' &&
      rawPunchIn !== '--:--' &&
      rawPunchIn !== '--'
    );
    const hasValidPunchOut = Boolean(
      rawPunchOut &&
      rawPunchOut.trim() !== '' &&
      rawPunchOut !== '--:--' &&
      rawPunchOut !== '--'
    );

    // Enforce Strict Punch Status Logic (Requirements 1 & 2):
    let status: LivePunchStatus = 'NOT_PUNCHED_IN';
    let punchIn: string | null = null;
    let punchOut: string | null = null;
    let punchInTimestamp: string | null = null;
    let punchOutTimestamp: string | null = null;
    let regularHours = 0;
    let otHours = 0;

    if (!userPunchLog || !hasValidPunchIn) {
      status = 'NOT_PUNCHED_IN';
      punchIn = null;
      punchOut = null;
      punchInTimestamp = null;
      punchOutTimestamp = null;
      regularHours = 0;
      otHours = 0;
    } else if (hasValidPunchIn && !hasValidPunchOut) {
      status = 'PUNCHED_IN';
      punchIn = rawPunchIn;
      punchOut = null;
      punchInTimestamp = userPunchLog.punchInTimestamp || userPunchLog.punch_in_time || null;
      punchOutTimestamp = null;
      regularHours = userPunchLog.regularHours || 0;
      otHours = userPunchLog.otHours || 0;
    } else if (hasValidPunchIn && hasValidPunchOut) {
      status = 'PUNCHED_OUT';
      punchIn = rawPunchIn;
      punchOut = rawPunchOut;
      punchInTimestamp = userPunchLog.punchInTimestamp || userPunchLog.punch_in_time || null;
      punchOutTimestamp = userPunchLog.punchOutTimestamp || userPunchLog.punch_out_time || null;
      regularHours = userPunchLog.regularHours || 0;
      otHours = userPunchLog.otHours || 0;
    }

    const totalWorkedHours = regularHours + otHours;

    logs.push({
      id: `duty-staff-${numId}`,
      userId: tenantUserId,
      numericId: numId,
      userName: s.name || tenantUserId,
      staffCode: tenantUserId,
      role: roleUpper,
      assignedShift,
      assignedArea: s.department || s.fixedDepartment || 'Floors & Rooms',
      status,
      punchIn,
      punchOut,
      punchInTime: punchIn,
      punchOutTime: punchOut,
      punchInTimestamp,
      punchOutTimestamp,
      totalWorkedHours,
      regularHours,
      otHours,
      department: s.department,
      phone: s.phone || s.mobile,
      notes: userPunchLog?.notes,
      siteId: s.siteId || (s as any).site_id || 'SITE_APEX_MAIN',
      siteName: s.siteName || (s as any).site_name || 'Apex Main Hospital',
    });
  });

  return logs;
}
