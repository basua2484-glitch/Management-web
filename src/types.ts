export type UserRole = 'admin' | 'manager' | 'staff';

export interface AppUser {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  password?: string;
  is_approved?: boolean; // Security Check for Self-Signup
  assigned_area?: string; // Default: 'Unassigned'
  staffId?: number;
  department?: string;
  shift?: 'Morning' | 'Evening' | 'Night';
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

export interface AttendanceRecord {
  id: string;
  userId: number;
  date: string; // YYYY-MM-DD
  punchIn: string | null; // HH:mm
  punchOut: string | null; // HH:mm
  regularHours: number;
  otHours: number;
  status: 'Present' | 'Absent' | 'Half Day' | 'On Leave' | 'Weekly Off';
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
