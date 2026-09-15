export type UserRole = 'admin' | 'manager' | 'supervisor' | 'staff';
export type SystemRole = 'admin' | 'manager' | 'supervisor' | 'staff';

export interface StaffDashboardView {
  staffId: string;
  fullName: string;
  dutyType: 'FIXED' | 'PERMANENT_RELIEVER' | 'TEMP_RELIEVER';
  currentDepartment: string;
  assignedShift: ShiftName;
  shiftStatus: 'PUNCHED_IN' | 'PUNCHED_OUT' | 'NOT_STARTED';
  todayRegularHours: number;
  todayOtHours: number;
  otRequestStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface SupervisorAccessContext {
  supervisorId: string;
  isOnDuty: boolean; // Determines if Live updates or Historical view is served
  activeShiftWard?: string;
}

export type DutyType = 'FIXED' | 'PERMANENT_RELIEVER' | 'TEMP_RELIEVER';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type UserStatus = 'ACTIVE' | 'PENDING' | 'PENDING_APPROVAL' | 'DISABLED';
export type ShiftName = '7-3' | '3-11' | '11-7' | 'HALF_4H' | 'CONTINUOUS_EXTENDED_OT';
export type StaffRequestStatus = RequestStatus;
export type OtStatus = RequestStatus | 'NONE';

export interface EmergencyRecallAlert {
  id: string;
  staffId: string;
  staffName: string;
  supervisorId: string;
  supervisorName: string;
  date: string; // YYYY-MM-DD
  department: string;
  reason: string;
  status: 'DISPATCHED' | 'ACCEPTED' | 'REJECTED' | 'APPROVED' | 'APPROVED_OT';
  hoursWorked?: number;
  dispatchedAt: string;
  approvedAt?: string;

  // Aliases for compatibility
  staff_id?: string;
  supervisor_name?: string;
  dispatched_at?: string;
}

export type DayOfWeek = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export interface LeaveBalance {
  casual: number; // default: 12
  sick: number;   // default: 7
  paid: number;   // default: 15
}

export type LeaveType = 'Casual' | 'Sick' | 'Paid';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface LeaveRequest {
  requestId: string;
  userId: number;
  userName: string;
  role: string;
  siteId: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  status: LeaveStatus;
  actionBy?: string | null;
  actionDate?: string | null;
  reason?: string;
  daysCount?: number;
  createdAt?: string;
}

/**
 * Hospital Site & Location Model
 */
export interface HospitalSite {
  id: string; // e.g. 'site-main', 'site-east', 'site-north', 'site-south'
  name: string;
  code: string;
  city: string;
  totalBeds?: number;
  address?: string;
}

/**
 * Clean CamelCase TypeScript Models
 */
export interface UserProfile {
  id: number;
  staffId: string;
  fullName: string;
  role: UserRole;
  dutyType: DutyType;
  siteId?: string;
  siteName?: string;
  supervisorId?: string;
  supervisorName?: string;
  assignedArea?: string;
  fixedDepartment?: string;
  isTempReliever?: boolean;
  tempDepartment?: string;
  assignedShift: '7-3' | '3-11' | '11-7';
  rawPasswordVault?: string; // Visible to Admin only
  status: 'ACTIVE' | 'PENDING_APPROVAL' | 'DISABLED';
  weeklyOffDay?: DayOfWeek | string;
  leaveBalance?: LeaveBalance;
  leaveRequests?: LeaveRequest[];
}

export interface JoiningRequest {
  id: number;
  requestedBy: string;
  candidateName: string;
  siteId?: string;
  siteName?: string;
  proposedArea?: string;
  status: RequestStatus;
  createdAt: string;
}

export interface AttendanceEntry {
  id: number;
  staffId: string;
  calendarDate: string;
  shiftName: string;
  departmentWorked: string;
  siteId?: string;
  siteName?: string;
  supervisorId?: string;
  supervisorName?: string;
  checkInTime?: string;
  punchInTime: string;
  punchOutTime?: string;
  regularHours: number;
  otHours: number;
  otStatus: RequestStatus | 'NONE';
}

/**
 * User Profile Extension & Daily Duty Allocation Models
 */
export interface StaffDutyProfile {
  id: number;
  staff_id: string; // unique
  duty_type: 'FIXED' | 'PERMANENT_RELIEVER' | DutyType; // Primary Role: 'FIXED' or 'PERMANENT_RELIEVER'
  fixed_department?: string | null; // Default Fixed Department (e.g., 'ICU')
  is_temp_reliever: boolean; // Temporary Shift Override (Today's Reliever Duty)
  temp_assigned_department?: string | null;
  temp_assigned_date?: string | null; // Date YYYY-MM-DD
  last_updated_by?: string | null; // Staff ID of Admin/Manager/Supervisor

  // Site and Supervisor tracking
  site_id?: string | null;
  siteId?: string | null;
  site_name?: string | null;
  siteName?: string | null;
  supervisor_id?: string | null;
  supervisorId?: string | null;
  supervisor_name?: string | null;
  supervisorName?: string | null;
  check_in_time?: string | null;
  checkInTime?: string | null;

  // CamelCase aliases
  staffId?: string;
  dutyType?: 'FIXED' | 'PERMANENT_RELIEVER' | DutyType;
  fixedDepartment?: string | null;
  default_department?: string | null;
  defaultDepartment?: string | null;
  isTempReliever?: boolean;
  tempAssignedDepartment?: string | null;
  tempAssignedDate?: string | null;
  lastUpdatedBy?: string | null;
}

export interface DutyAllocation {
  id: number;
  staff_id: string;
  date: string; // YYYY-MM-DD
  assigned_department: string;
  assigned_by_supervisor?: string | null; // Supervisor Staff ID if Reliever

  // Site & Supervisor Tracking
  site_id?: string | null;
  siteId?: string | null;
  site_name?: string | null;
  siteName?: string | null;
  supervisor_id?: string | null;
  supervisorId?: string | null;
  supervisor_name?: string | null;
  supervisorName?: string | null;
  check_in_time?: string | null;
  checkInTime?: string | null;

  ot_requested_hours: number;
  ot_status: RequestStatus | 'NONE'; // 'NONE', 'PENDING', 'APPROVED', 'REJECTED'
  approved_by?: string | null;
  notes?: string | null;
  // CamelCase aliases
  staffId?: string;
  assignedDepartment?: string;
  assignedBySupervisor?: string | null;
  otRequestedHours?: number;
  otStatus?: RequestStatus | 'NONE';
  approvedBy?: string | null;
}

/**
 * 1. User Account Model (Complete Hierarchy & Admin Vault)
 * class User(db.Model):
 *     __tablename__ = 'users'
 *     id = db.Column(db.Integer, primary_key=True)
 *     staff_id = db.Column(db.String(50), unique=True, nullable=False) # e.g. HK-012
 *     full_name = db.Column(db.String(100), nullable=False)
 *     role = db.Column(db.String(20), nullable=False) # 'admin', 'manager', 'supervisor', 'staff'
 *     duty_type = db.Column(db.String(30), default='FIXED') # 'FIXED', 'PERMANENT_RELIEVER', 'TEMP_RELIEVER'
 *     fixed_department = db.Column(db.String(50), nullable=True) # e.g. 'ICU', 'General Ward'
 *     is_temp_reliever = db.Column(db.Boolean, default=False)
 *     temp_department = db.Column(db.String(50), nullable=True)
 *     assigned_shift = db.Column(db.String(20), default='7-3') # '7-3', '3-11', '11-7'
 *     password_hash = db.Column(db.String(255), nullable=False)
 *     raw_password_vault = db.Column(db.String(255), nullable=True) # Admin Eye Icon View
 *     status = db.Column(db.String(20), default='ACTIVE') # 'ACTIVE', 'PENDING_APPROVAL', 'DISABLED'
 */
export interface User {
  id: number;
  staff_id: string; // e.g. HK-012
  full_name: string;
  name: string; // alias for full_name for backward compatibility
  role: UserRole; // 'admin', 'manager', 'supervisor', 'staff'

  // Site Hierarchy & Scoping
  site_id?: string | null; // e.g. 'site-main', 'site-east', 'site-north'
  siteId?: string | null;
  site_name?: string | null;
  siteName?: string | null;

  // Supervisor Allocation
  supervisor_id?: string | null; // Supervisor Staff ID
  supervisorId?: string | null;
  supervisor_name?: string | null;
  supervisorName?: string | null;
  
  // Duty Allocation Settings
  duty_type: DutyType; // 'FIXED', 'PERMANENT_RELIEVER', 'TEMP_RELIEVER'
  fixed_department?: string | null; // e.g. 'ICU', 'General Ward'
  
  // Temporary Shift Overrides
  is_temp_reliever?: boolean;
  temp_department?: string | null;

  assigned_shift: ShiftName | string; // '7-3', '3-11', '11-7'
  password_hash: string;
  raw_password_vault?: string | null; // Admin Eye Icon View
  status: UserStatus; // 'ACTIVE', 'PENDING_APPROVAL', 'DISABLED'

  // Leave & Weekly Off Management
  weeklyOffDay?: DayOfWeek | string; // default 'Sunday'
  weekly_off_day?: DayOfWeek | string;
  leaveBalance?: LeaveBalance; // default { casual: 12, sick: 7, paid: 15 }
  leave_balance?: LeaveBalance;
  leaveRequests?: LeaveRequest[]; // default []
  leave_requests?: LeaveRequest[];

  // Backward compatibility fields
  assigned_area?: string; // alias for effective department
  password?: string;
  department?: string;
  shift?: 'Morning' | 'Evening' | 'Night';
  is_approved?: boolean;
}

export interface AppUser extends User {
  username: string; // alias for staff_id / login handle
  staffId?: number;
}

/**
 * 2. Staff Joining Requests Queue Model
 * class StaffRequest(db.Model):
 *     __tablename__ = 'staff_requests'
 *     id = db.Column(db.Integer, primary_key=True)
 *     requested_by = db.Column(db.String(50), nullable=False) # Supervisor Staff ID
 *     candidate_name = db.Column(db.String(100), nullable=False)
 *     proposed_area = db.Column(db.String(50), nullable=True)
 *     status = db.Column(db.String(20), default='PENDING') # 'PENDING', 'APPROVED', 'REJECTED'
 *     created_at = db.Column(db.DateTime, default=datetime.utcnow)
 */
export interface StaffRequest {
  id: number;
  requested_by: string; // Supervisor Staff ID
  candidate_name: string;
  proposed_area?: string | null;
  proposed_shift?: ShiftName | string; // '7-3', '3-11', '11-7'
  site_id?: string | null;
  siteId?: string | null;
  site_name?: string | null;
  siteName?: string | null;
  supervisor_id?: string | null;
  supervisorId?: string | null;
  status: StaffRequestStatus; // 'PENDING', 'APPROVED', 'REJECTED'
  created_at: string; // ISO string
}

export interface FlashMessage {
  id: string;
  type: 'danger' | 'warning' | 'success' | 'info';
  message: string;
}

export interface StaffUser {
  id: number;
  staffCode: string; // e.g., "HK-001"
  name: string;
  role: 'staff' | 'supervisor' | 'lead';
  department: string;
  shift: 'Morning' | 'Evening' | 'Night';
  siteId?: string;
  siteName?: string;
  supervisorId?: string;
  supervisorName?: string;
  hourlyRate?: number;
  phone?: string;
  active: boolean;
  dutyType?: DutyType;
  fixedDepartment?: string;
  isTempReliever?: boolean;
  tempDepartment?: string;
}

export interface AttendanceSession {
  id: string;
  staff_id: number | string; // staff ID or userId
  date: string; // YYYY-MM-DD
  punch_in: string; // ISO timestamp or HH:mm
  punch_out: string | null; // ISO timestamp or HH:mm
  notes?: string;
}

export interface StaffSummarySession {
  session_num: number;
  in_time: string; // '%I:%M %p' e.g. "08:00 AM" or "--"
  out_time: string; // '%I:%M %p' e.g. "05:30 PM" or "--"
  hours: number;
}

export interface StaffSummaryResponse {
  regular_hours: number;
  overtime_hours: number;
  sessions: StaffSummarySession[];
  is_duty_active: boolean;
  total_hours?: number;
}

export interface DailyAttendanceCalculation {
  regular_hours: number;
  overtime_hours: number;
  total_sessions: number;
  total_hours?: number;
  total_minutes_worked?: number;
}

/**
 * 3. Attendance & Shift OT Log Model
 * class AttendanceRecord(db.Model):
 *     __tablename__ = 'attendance_records'
 *     id = db.Column(db.Integer, primary_key=True)
 *     staff_id = db.Column(db.String(50), nullable=False)
 *     calendar_date = db.Column(db.Date, nullable=False) # YYYY-MM-DD
 *     shift_name = db.Column(db.String(20), nullable=False) # '7-3', '3-11', '11-7'
 *     department_worked = db.Column(db.String(50), nullable=False)
 *     punch_in_time = db.Column(db.DateTime, nullable=False)
 *     punch_out_time = db.Column(db.DateTime, nullable=True)
 *     regular_hours = db.Column(db.Float, default=0.0) # Up to 8.0 hrs
 *     ot_hours = db.Column(db.Float, default=0.0) # Hours beyond 8.0 hrs
 *     ot_status = db.Column(db.String(20), default='NONE') # 'NONE', 'PENDING', 'APPROVED', 'REJECTED'
 */
export interface AttendanceRecord {
  id: string;
  userId: number; // numeric user ID link
  staff_id?: string; // HK-012
  calendar_date?: string; // YYYY-MM-DD
  date: string; // YYYY-MM-DD (alias for calendar_date)
  shift_name?: ShiftName | string; // '7-3', '3-11', '11-7'
  department_worked?: string; // e.g. ICU, General Ward

  // Site & Supervisor Tracking (Requirement 2)
  siteId?: string;
  site_id?: string;
  siteName?: string;
  site_name?: string;
  supervisorId?: string;
  supervisor_id?: string;
  supervisorName?: string;
  supervisor_name?: string;
  checkInTime?: string; // e.g., '07:02 AM' or ISO string
  check_in_time?: string;
  
  punchIn: string | null; // HH:mm
  punchOut: string | null; // HH:mm
  punch_in_time?: string | null; // ISO DateTime
  punch_out_time?: string | null; // ISO DateTime
  punchInTimestamp?: string | null; // ISO string for exact ms calculation
  punchOutTimestamp?: string | null; // ISO string for exact ms calculation
  
  regularHours: number; // up to 8.0 hrs
  regular_hours?: number; // Python model alias
  otHours: number; // hours beyond 8.0 hrs
  ot_hours?: number; // Python model alias
  ot_status?: OtStatus; // 'NONE', 'PENDING', 'APPROVED', 'REJECTED'
  
  sessions?: AttendanceSession[]; // Multiple punch sessions per day
  status: 'Present' | 'Absent' | 'Half Day' | 'On Leave' | 'Weekly Off' | 'Duty Completed';
  notes?: string;
}

export interface MonthlyStaffSummary {
  userId: number;
  staffId: string; // e.g. "HK-001"
  staffName: string;
  role: string;
  department: string;
  daysPresent: number;
  totalRegHours: number;
  totalOtHours: number;
  grandTotalHours: number;
  recordsCount: number;
}

export interface GoogleSheetsExportStatus {
  isExporting: boolean;
  success?: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  sheetTitle?: string;
  error?: string;
  rowCount?: number;
}

/**
 * Model conversion helpers between Python backend models and Frontend interfaces
 */
export function toUserProfile(u: User): UserProfile {
  const shiftNormalized = (u.assigned_shift === '11-7' || u.assigned_shift === '3-11') ? u.assigned_shift : '7-3';
  return {
    id: u.id,
    staffId: u.staff_id,
    fullName: u.full_name || u.name,
    role: u.role,
    dutyType: u.duty_type || 'FIXED',
    siteId: u.siteId || u.site_id || undefined,
    siteName: u.siteName || u.site_name || undefined,
    supervisorId: u.supervisorId || u.supervisor_id || undefined,
    supervisorName: u.supervisorName || u.supervisor_name || undefined,
    assignedArea: u.assigned_area || u.fixed_department || u.department || undefined,
    fixedDepartment: u.fixed_department || u.assigned_area || u.department || undefined,
    isTempReliever: u.is_temp_reliever,
    tempDepartment: u.temp_department || undefined,
    assignedShift: shiftNormalized,
    rawPasswordVault: u.raw_password_vault || undefined,
    status: u.status === 'DISABLED' ? 'DISABLED' : u.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING_APPROVAL',
    weeklyOffDay: u.weeklyOffDay || u.weekly_off_day || 'Sunday',
    leaveBalance: u.leaveBalance || u.leave_balance || { casual: 12, sick: 7, paid: 15 },
    leaveRequests: u.leaveRequests || u.leave_requests || [],
  };
}

export function toJoiningRequest(r: StaffRequest): JoiningRequest {
  return {
    id: r.id,
    requestedBy: r.requested_by,
    candidateName: r.candidate_name,
    siteId: r.siteId || r.site_id || undefined,
    siteName: r.siteName || r.site_name || undefined,
    proposedArea: r.proposed_area || undefined,
    status: r.status,
    createdAt: r.created_at,
  };
}

export function toAttendanceEntry(a: AttendanceRecord): AttendanceEntry {
  return {
    id: typeof a.id === 'number' ? a.id : parseInt(String(a.id).replace(/\D/g, '')) || 0,
    staffId: a.staff_id || `HK-${String(a.userId).padStart(3, '0')}`,
    calendarDate: a.calendar_date || a.date,
    shiftName: a.shift_name || '7-3',
    departmentWorked: a.department_worked || a.notes || 'General Ward',
    siteId: a.siteId || a.site_id || undefined,
    siteName: a.siteName || a.site_name || undefined,
    supervisorId: a.supervisorId || a.supervisor_id || undefined,
    supervisorName: a.supervisorName || a.supervisor_name || undefined,
    checkInTime: a.checkInTime || a.check_in_time || a.punchIn || (a.punch_in_time ? a.punch_in_time.slice(11, 16) : undefined),
    punchInTime: a.punch_in_time || `${a.calendar_date || a.date}T${a.punchIn || '07:00'}:00`,
    punchOutTime: a.punch_out_time || (a.punchOut ? `${a.calendar_date || a.date}T${a.punchOut}:00` : undefined),
    regularHours: a.regular_hours ?? a.regularHours ?? 0,
    otHours: a.ot_hours ?? a.otHours ?? 0,
    otStatus: (a.ot_status as RequestStatus) || (a.otHours > 0 ? 'PENDING' : 'NONE'),
  };
}

export function toStaffDutyProfile(user: User): StaffDutyProfile {
  const isPermanentReliever = user.duty_type === 'PERMANENT_RELIEVER';
  const dutyType: 'FIXED' | 'PERMANENT_RELIEVER' = isPermanentReliever ? 'PERMANENT_RELIEVER' : 'FIXED';
  const todayStr = new Date().toISOString().split('T')[0];
  const isTemp = Boolean(user.is_temp_reliever);
  const tempDept = user.temp_department || null;
  const fixedDept = user.fixed_department || user.assigned_area || null;

  return {
    id: user.id,
    staff_id: user.staff_id,
    duty_type: dutyType,
    fixed_department: fixedDept,
    is_temp_reliever: isTemp,
    temp_assigned_department: tempDept,
    temp_assigned_date: isTemp ? todayStr : null,
    last_updated_by: 'ADMIN',

    // CamelCase aliases
    staffId: user.staff_id,
    dutyType: dutyType,
    fixedDepartment: fixedDept,
    default_department: fixedDept,
    defaultDepartment: fixedDept,
    isTempReliever: isTemp,
    tempAssignedDepartment: tempDept,
    tempAssignedDate: isTemp ? todayStr : null,
    lastUpdatedBy: 'ADMIN',
  };
}

export function toDutyAllocation(record: AttendanceRecord, supervisorId?: string): DutyAllocation {
  const idNum = typeof record.id === 'number' ? record.id : parseInt(String(record.id).replace(/\D/g, '')) || 1;
  return {
    id: idNum,
    staff_id: record.staff_id || `HK-${String(record.userId).padStart(3, '0')}`,
    date: record.calendar_date || record.date,
    assigned_department: record.department_worked || 'General Ward',
    assigned_by_supervisor: supervisorId || null,
    ot_requested_hours: record.ot_hours ?? record.otHours ?? 0,
    ot_status: (record.ot_status as RequestStatus) || (record.otHours > 0 ? 'PENDING' : 'NONE'),
    approved_by: record.ot_status === 'APPROVED' ? (supervisorId || 'SUPERVISOR') : null,
    staffId: record.staff_id || `HK-${String(record.userId).padStart(3, '0')}`,
    assignedDepartment: record.department_worked || 'General Ward',
    assignedBySupervisor: supervisorId || null,
    otRequestedHours: record.ot_hours ?? record.otHours ?? 0,
    otStatus: (record.ot_status as RequestStatus) || (record.otHours > 0 ? 'PENDING' : 'NONE'),
    approvedBy: record.ot_status === 'APPROVED' ? (supervisorId || 'SUPERVISOR') : null,
  };
}

