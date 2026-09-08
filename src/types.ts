export type UserRole = 'admin' | 'manager' | 'staff';

/**
 * User Model (matches Python Flask / Django: id, staff_id, name, role)
 * class User(db.Model):
 *     id = db.Column(db.Integer, primary_key=True)
 *     staff_id = db.Column(db.String(20), unique=True) # e.g. HK-001
 *     name = db.Column(db.String(100))
 *     role = db.Column(db.String(20), default='staff') # 'staff' OR 'admin'
 */
export interface User {
  id: number;
  staff_id: string; // e.g. 'HK-001' (unique)
  name: string;
  role: UserRole; // 'staff' | 'admin' | 'manager' (default: 'staff')
  password?: string;
  password_hash?: string;
  assigned_area?: string; // default: 'General Ward'
  department?: string;
  shift?: 'Morning' | 'Evening' | 'Night';
  is_approved?: boolean;
}

export interface AppUser extends User {
  username: string; // alias for staff_id / login handle
  staffId?: number;
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
  hourlyRate?: number;
  phone?: string;
  active: boolean;
}

export interface AttendanceSession {
  id: string;
  staff_id: number | string; // staff ID or userId
  date: string; // YYYY-MM-DD
  punch_in: string; // ISO timestamp or HH:mm
  punch_out: string | null; // ISO timestamp or HH:mm
  notes?: string;
}

export interface DailyAttendanceCalculation {
  regular_hours: number;
  overtime_hours: number;
  total_sessions: number;
  total_hours?: number;
  total_minutes_worked?: number;
}

export interface AttendanceRecord {
  id: string;
  userId: number;
  date: string; // YYYY-MM-DD
  punchIn: string | null; // HH:mm
  punchOut: string | null; // HH:mm
  punchInTimestamp?: string | null; // ISO string for exact ms calculation
  punchOutTimestamp?: string | null; // ISO string for exact ms calculation
  regularHours: number;
  otHours: number;
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
