// src/services/userService.ts
// STRICT ATTENDANCE ISOLATION & ZERO-MOCK USER ONBOARDING SERVICE

import type { AppUser, StaffUser, AttendanceRecord } from '../types';
import { createPasswordHash } from './vaultService';

/**
 * 🛑 PROHIBITED AUTO-GENERATION RULE:
 * Any auto-generating mock attendance loop (e.g., generateMockAttendance(),
 * createDefaultLogs(), or initialAttendanceRecords) has been permanently DISABLED.
 *
 * Attendance history and 'Monthly Attendance' tab must ONLY display entries generated
 * from actual Punch-In / Punch-Out events or manual Admin overrides.
 * For newly created users, show: "No Attendance Records Found" until their first punch-in.
 */

/*
// PERMANENTLY REMOVED / DISABLED AUTO-GENERATION ROUTINES:
// function generateMockAttendance(staffId: string) { ... }
// function createDefaultLogs(staffId: string) { ... }
// const initialAttendanceRecords = [ ... ];
*/

/**
 * Enforce Empty Initial Attendance State for any new user (Staff, Supervisor, Manager)
 */
export interface InitialAttendanceState {
  attendanceLogs: AttendanceRecord[];
  presentDays: number;
  regularHours: number;
  overtimeHours: number;
}

export function getEmptyInitialAttendanceState(): InitialAttendanceState {
  return {
    attendanceLogs: [],
    presentDays: 0,
    regularHours: 0,
    overtimeHours: 0,
  };
}

/**
 * Helper to build an AppUser payload with empty initial attendance state
 */
export function buildNewAppUserPayload(params: {
  id: number;
  staffId: string;
  name: string;
  role: 'admin' | 'manager' | 'supervisor' | 'staff';
  tenantId: string;
  companyPrefix: string;
  password?: string;
  mobile?: string;
  email?: string;
  assignedArea?: string;
  assignedShift?: string;
  dutyType?: 'FIXED' | 'PERMANENT_RELIEVER' | 'TEMP_RELIEVER';
  fixedDepartment?: string;
  isTempReliever?: boolean;
  tempDepartment?: string | null;
  status?: 'ACTIVE' | 'PENDING' | 'DISABLED';
  isApproved?: boolean;
  numericStaffId?: number;
}): AppUser {
  const pwd = params.password || 'staff123';
  const emptyAttendance = getEmptyInitialAttendanceState();

  return {
    id: params.id,
    staff_id: params.staffId,
    username: params.staffId,
    tenant_id: params.tenantId,
    tenantId: params.tenantId,
    company_prefix: params.companyPrefix,
    name: params.name.trim(),
    full_name: params.name.trim(),
    mobile: params.mobile?.trim(),
    phone: params.mobile?.trim(),
    email: params.email?.trim(),
    role: params.role,
    duty_type: params.dutyType || 'FIXED',
    fixed_department: params.fixedDepartment || params.assignedArea || 'General Ward',
    is_temp_reliever: Boolean(params.isTempReliever),
    temp_department: params.tempDepartment ?? null,
    assigned_shift: params.assignedShift || '7-3',
    password: pwd,
    password_hash: createPasswordHash(pwd),
    raw_password_vault: pwd,
    status: (params.status as any) || 'ACTIVE',
    is_approved: params.isApproved !== undefined ? params.isApproved : true,
    assigned_area: params.assignedArea || 'General Ward',
    department: params.assignedArea || 'General Ward',
    staffId: params.numericStaffId || params.id,
    dutyStatus: 'OFF_DUTY',
    isOnDuty: false,
    ...emptyAttendance,
  };
}

/**
 * Helper to build a StaffUser payload with empty initial attendance state
 */
export function buildNewStaffUserPayload(params: {
  id: number;
  staffCode: string;
  name: string;
  role: 'staff' | 'supervisor' | 'manager' | 'lead' | 'admin';
  tenantId: string;
  companyPrefix: string;
  department?: string;
  shift?: 'Morning' | 'Evening' | 'Night';
  mobile?: string;
  phone?: string;
  email?: string;
  dutyType?: 'FIXED' | 'PERMANENT_RELIEVER' | 'TEMP_RELIEVER';
  fixedDepartment?: string;
  isTempReliever?: boolean;
  tempDepartment?: string | null;
}): StaffUser {
  const emptyAttendance = getEmptyInitialAttendanceState();

  return {
    id: params.id,
    staffCode: params.staffCode,
    tenant_id: params.tenantId,
    company_prefix: params.companyPrefix,
    name: params.name.trim(),
    role: params.role,
    department: params.department || 'General Ward',
    shift: params.shift || 'Morning',
    mobile: params.mobile?.trim(),
    phone: params.phone?.trim() || params.mobile?.trim(),
    email: params.email?.trim(),
    active: true,
    dutyType: (params.dutyType as any) || 'FIXED',
    fixedDepartment: params.fixedDepartment || params.department || 'General Ward',
    isTempReliever: Boolean(params.isTempReliever),
    tempDepartment: params.tempDepartment ?? undefined,
    dutyStatus: 'OFF_DUTY',
    isOnDuty: false,
    ...emptyAttendance,
  };
}
