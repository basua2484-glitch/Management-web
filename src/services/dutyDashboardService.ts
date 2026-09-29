// src/services/dutyDashboardService.ts
// Real-time Shift-based & Role-wise Live Dashboard Service for Daily Punch & Duty Assignments

import type { AppUser, StaffUser, AttendanceRecord } from '../types';

export type ShiftNameType = 'Morning' | 'Evening' | 'Night';
export type ShiftFilterType = 'ALL' | 'Morning' | 'Evening' | 'Night';
export type RoleGroupType = 'MANAGER' | 'SUPERVISOR' | 'STAFF';
export type LivePunchStatus = 'PUNCHED_IN' | 'PUNCHED_OUT' | 'ABSENT' | 'PENDING';

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
  punchInTimestamp?: string | null;
  punchOutTimestamp?: string | null;
  totalWorkedHours: number;
  regularHours: number;
  otHours: number;
  department?: string;
  phone?: string;
  notes?: string;
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
 * Normalizes role to 'MANAGER' | 'SUPERVISOR' | 'STAFF'
 */
export function normalizeRole(rawRole?: string | null): RoleGroupType {
  const r = String(rawRole || '').trim().toUpperCase();
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
  if (!punchInTimeStr && !punchInTimestamp) return '--';
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
      return punchInTimeStr || '--';
    }

    const diffMs = Math.max(0, now.getTime() - startTime.getTime());
    const totalMinutes = Math.floor(diffMs / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  } catch {
    return punchInTimeStr || '--';
  }
}

/**
 * Strict Dynamic Shift & Role Filtering Logic
 * 1. Filter logs strictly by logged-in company tenant AND selected shift:
 *    const filteredLogs = dutyLogs.filter(log => 
 *      log.userId.startsWith(activeTenantPrefix) &&
 *      (selectedShift === 'ALL' || log.assignedShift === selectedShift)
 *    );
 * 2. Role-Based Grouping:
 *    const managerLogs = filteredLogs.filter(log => log.role === 'MANAGER');
 *    const supervisorLogs = filteredLogs.filter(log => log.role === 'SUPERVISOR');
 *    const staffLogs = filteredLogs.filter(log => log.role === 'STAFF');
 */
export function filterAndGroupDutyLogs(
  dutyLogs: LiveDutyLog[],
  activeTenantPrefix: string,
  selectedShift: ShiftFilterType
): {
  filteredLogs: LiveDutyLog[];
  managerLogs: LiveDutyLog[];
  supervisorLogs: LiveDutyLog[];
  staffLogs: LiveDutyLog[];
} {
  const cleanPrefix = (activeTenantPrefix || 'APEX').trim().toUpperCase();

  const filteredLogs = dutyLogs.filter((log) => {
    const matchesTenant = log.userId.startsWith(cleanPrefix);
    const matchesShift = selectedShift === 'ALL' || log.assignedShift === selectedShift;
    return matchesTenant && matchesShift;
  });

  const managerLogs = filteredLogs.filter((log) => log.role === 'MANAGER');
  const supervisorLogs = filteredLogs.filter((log) => log.role === 'SUPERVISOR');
  const staffLogs = filteredLogs.filter((log) => log.role === 'STAFF');

  return {
    filteredLogs,
    managerLogs,
    supervisorLogs,
    staffLogs,
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
    const roleSlug = role === 'MANAGER' ? 'MGR' : role === 'SUPERVISOR' ? 'SUP' : 'STF';
    return `${prefix}-${roleSlug}-${String(numId).padStart(3, '0')}`;
  };

  // 1. Process AppUsers (covers Managers, Supervisors, and registered Staff)
  users.forEach((u) => {
    // Only process roles: manager, supervisor, staff (skip superadmin/root unless desired)
    const roleUpper = normalizeRole(u.role);
    const numId = Number(u.id) || 1;
    const rawCode = u.staff_id || u.username || `HK-${numId}`;
    const tenantUserId = formatTenantUserId(rawCode, roleUpper, numId);

    // Filter to active tenant
    const userTenant = (u.company_prefix || u.tenant_id || u.tenantId || '').toUpperCase();
    if (userTenant && userTenant !== prefix && !tenantUserId.startsWith(prefix)) {
      return;
    }

    if (processedCodes.has(tenantUserId)) return;
    processedCodes.add(tenantUserId);

    // Find attendance record
    const rec = userRecordMap.get(numId) || codeRecordMap.get(tenantUserId) || codeRecordMap.get(rawCode.toUpperCase());

    // Determine shift
    const assignedShift = normalizeShift(u.assigned_shift || u.shift || (rec?.shift_name as any));

    // Determine status & hours
    let status: LivePunchStatus = 'PENDING';
    const punchIn = rec?.punchIn || (u.dutyStatus === 'ON_DUTY' ? ((u as any).check_in_time || '07:30 AM') : null);
    const punchOut = rec?.punchOut || null;
    const punchInTimestamp = rec?.punchInTimestamp || rec?.punch_in_time || null;
    const punchOutTimestamp = rec?.punchOutTimestamp || rec?.punch_out_time || null;

    let regularHours = rec?.regularHours || 0;
    let otHours = rec?.otHours || 0;

    if (punchIn && !punchOut) {
      status = 'PUNCHED_IN';
      if (regularHours === 0) regularHours = 8.0;
    } else if (punchIn && punchOut) {
      status = 'PUNCHED_OUT';
    } else if (rec?.status === 'Duty Completed') {
      status = 'PUNCHED_OUT';
    } else if (u.dutyStatus === 'ON_DUTY' || u.isOnDuty) {
      status = 'PUNCHED_IN';
    } else {
      // If no punch found on selectedDate:
      // If date is today and shift has not started yet -> PENDING, otherwise ABSENT
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      if (selectedDate === todayStr) {
        const { startHour } = getShiftTimingDetails(assignedShift);
        const currentHour = now.getHours();
        if (assignedShift === 'Night') {
          // Night starts at 23:00
          status = currentHour >= 23 || currentHour < 7 ? 'ABSENT' : 'PENDING';
        } else {
          status = currentHour >= startHour ? 'ABSENT' : 'PENDING';
        }
      } else if (selectedDate < todayStr) {
        status = 'ABSENT';
      } else {
        status = 'PENDING';
      }
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
      punchInTimestamp,
      punchOutTimestamp,
      totalWorkedHours,
      regularHours,
      otHours,
      department: u.department || u.fixed_department,
      phone: u.mobile || u.phone,
      notes: rec?.notes,
    });
  });

  // 2. Process any StaffUser not already in logs
  staff.forEach((s) => {
    const roleUpper = normalizeRole(s.role);
    const numId = Number(s.id) || 1;
    const rawCode = s.staffCode || `HK-${numId}`;
    const tenantUserId = formatTenantUserId(rawCode, roleUpper, numId);

    if (processedCodes.has(tenantUserId)) return;
    processedCodes.add(tenantUserId);

    const rec = userRecordMap.get(numId) || codeRecordMap.get(tenantUserId) || codeRecordMap.get(rawCode.toUpperCase());
    const assignedShift = normalizeShift(s.shift || (rec?.shift_name as any));

    let status: LivePunchStatus = 'PENDING';
    const punchIn = rec?.punchIn || null;
    const punchOut = rec?.punchOut || null;
    const punchInTimestamp = rec?.punchInTimestamp || rec?.punch_in_time || null;
    const punchOutTimestamp = rec?.punchOutTimestamp || rec?.punch_out_time || null;

    let regularHours = rec?.regularHours || 0;
    let otHours = rec?.otHours || 0;

    if (punchIn && !punchOut) {
      status = 'PUNCHED_IN';
      if (regularHours === 0) regularHours = 8.0;
    } else if (punchIn && punchOut) {
      status = 'PUNCHED_OUT';
    } else if (rec?.status === 'Duty Completed') {
      status = 'PUNCHED_OUT';
    } else {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      if (selectedDate === todayStr) {
        const { startHour } = getShiftTimingDetails(assignedShift);
        const currentHour = now.getHours();
        if (assignedShift === 'Night') {
          status = currentHour >= 23 || currentHour < 7 ? 'ABSENT' : 'PENDING';
        } else {
          status = currentHour >= startHour ? 'ABSENT' : 'PENDING';
        }
      } else if (selectedDate < todayStr) {
        status = 'ABSENT';
      } else {
        status = 'PENDING';
      }
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
      punchInTimestamp,
      punchOutTimestamp,
      totalWorkedHours,
      regularHours,
      otHours,
      department: s.department,
      phone: s.phone || s.mobile,
      notes: rec?.notes,
    });
  });

  return logs;
}
