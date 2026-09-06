import type { StaffUser, AttendanceRecord, AppUser } from '../types';

export const INITIAL_USERS: AppUser[] = [
  {
    id: 100,
    username: 'admin',
    password: 'admin123',
    name: 'Admin Staff',
    role: 'admin',
    department: 'HK Operations Management',
    is_approved: true,
    assigned_area: 'HQ Ops Control',
  },
  {
    id: 101,
    username: 'manager',
    password: 'manager123',
    name: 'Operations Manager Priya',
    role: 'manager',
    department: 'Housekeeping Operations',
    is_approved: true,
    assigned_area: 'Ops Floor & Inspection',
  },
  {
    id: 1,
    username: 'ramesh',
    password: 'staff123',
    name: 'Ramesh Kumar',
    role: 'staff',
    staffId: 1,
    department: '3rd Floor Wards',
    shift: 'Morning',
    is_approved: true,
    assigned_area: '3rd Floor Wards',
  },
  {
    id: 2,
    username: 'sunita',
    password: 'staff123',
    name: 'Sunita Devi',
    role: 'staff',
    staffId: 2,
    department: 'Lobby & Common Areas',
    shift: 'Morning',
    is_approved: true,
    assigned_area: 'Lobby & Common Areas',
  },
  {
    id: 3,
    username: 'amit',
    password: 'staff123',
    name: 'Amit Sharma',
    role: 'staff',
    staffId: 3,
    department: 'Laundry & Linen',
    shift: 'Evening',
    is_approved: true,
    assigned_area: 'Laundry & Linen',
  },
  {
    id: 4,
    username: 'anita',
    password: 'staff123',
    name: 'Anita Patel',
    role: 'staff',
    staffId: 4,
    department: 'Kitchen & Dining Sanitation',
    shift: 'Morning',
    is_approved: true,
    assigned_area: 'Kitchen & Dining Sanitation',
  },
  {
    id: 5,
    username: 'rameshv',
    password: 'staff123',
    name: 'Ramesh Verma',
    role: 'staff',
    staffId: 5,
    department: 'Deep Cleaning & Waste Mgmt',
    shift: 'Night',
    is_approved: true,
    assigned_area: 'Deep Cleaning & Waste Mgmt',
  },
  {
    id: 201,
    username: 'rahul',
    password: 'password123',
    name: 'Rahul Sharma',
    role: 'staff',
    is_approved: false, // Security Check: Self-signup pending Admin approval
    assigned_area: 'Unassigned',
    department: 'Unassigned',
  },
];

export const INITIAL_STAFF: StaffUser[] = [
  {
    id: 1,
    staffCode: 'HK-001',
    name: 'Ramesh Kumar',
    role: 'staff',
    department: '3rd Floor Wards',
    shift: 'Morning',
    hourlyRate: 15,
    phone: '+91 98765 43210',
    active: true,
  },
  {
    id: 2,
    staffCode: 'HK-002',
    name: 'Sunita Devi',
    role: 'staff',
    department: 'Lobby & Common Areas',
    shift: 'Morning',
    hourlyRate: 15,
    phone: '+91 98765 43211',
    active: true,
  },
  {
    id: 3,
    staffCode: 'HK-003',
    name: 'Amit Sharma',
    role: 'staff',
    department: 'Laundry & Linen',
    shift: 'Evening',
    hourlyRate: 16,
    phone: '+91 98765 43212',
    active: true,
  },
  {
    id: 4,
    staffCode: 'HK-004',
    name: 'Anita Patel',
    role: 'staff',
    department: 'Kitchen & Dining Sanitation',
    shift: 'Morning',
    hourlyRate: 15,
    phone: '+91 98765 43213',
    active: true,
  },
  {
    id: 5,
    staffCode: 'HK-005',
    name: 'Ramesh Verma',
    role: 'staff',
    department: 'Deep Cleaning & Waste Mgmt',
    shift: 'Night',
    hourlyRate: 17,
    phone: '+91 98765 43214',
    active: true,
  },
  {
    id: 6,
    staffCode: 'HK-006',
    name: 'Meena Kumari',
    role: 'staff',
    department: 'Guest Suites',
    shift: 'Morning',
    hourlyRate: 15,
    phone: '+91 98765 43215',
    active: true,
  },
  {
    id: 7,
    staffCode: 'HK-007',
    name: 'Vikram Singh',
    role: 'staff',
    department: 'Public Facilities & Pool',
    shift: 'Evening',
    hourlyRate: 16,
    phone: '+91 98765 43216',
    active: true,
  },
  {
    id: 8,
    staffCode: 'HK-008',
    name: 'Priya Nair',
    role: 'staff',
    department: 'Executive Floor',
    shift: 'Morning',
    hourlyRate: 16,
    phone: '+91 98765 43217',
    active: true,
  },
];

// Helper to generate seed attendance records for a given month and year
export function generateSeedAttendance(year = 2026, month = 9): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayDate = 6; // current date in September 2026

  INITIAL_STAFF.forEach((staff) => {
    // Generate records for all days up to the current day or for full month in prior months
    const maxDay = (year === 2026 && month === 9) ? todayDate : (month < 9 || year < 2026 ? daysInMonth : todayDate);

    for (let day = 1; day <= maxDay; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay(); // 0 is Sunday
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

      // Weekly off on Sundays for some, Mondays for others
      const isOffDay = (staff.id % 2 === 0 && dayOfWeek === 0) || (staff.id % 2 !== 0 && dayOfWeek === 1);

      if (isOffDay) {
        records.push({
          id: `att_${staff.id}_${dateStr}`,
          userId: staff.id,
          date: dateStr,
          punchIn: null,
          punchOut: null,
          regularHours: 0,
          otHours: 0,
          status: 'Weekly Off',
          notes: 'Scheduled weekly off',
        });
        continue;
      }

      // Random chance of absence / leave
      const pseudoRandom = (staff.id * 17 + day * 31) % 100;
      if (pseudoRandom < 8) {
        records.push({
          id: `att_${staff.id}_${dateStr}`,
          userId: staff.id,
          date: dateStr,
          punchIn: null,
          punchOut: null,
          regularHours: 0,
          otHours: 0,
          status: 'Absent',
          notes: 'Unplanned leave',
        });
        continue;
      }

      // Present shifts with occasional Overtime
      let punchIn = '08:00';
      let punchOut = '16:30';
      let regularHours = 8.0;
      let otHours = 0.0;

      if (staff.shift === 'Evening') {
        punchIn = '14:00';
        punchOut = '22:30';
      } else if (staff.shift === 'Night') {
        punchIn = '22:00';
        punchOut = '06:30';
      }

      // Calculate overtime based on pseudo variability (some staff do 1.5 - 3.5 hrs OT)
      if (pseudoRandom > 60) {
        if (pseudoRandom > 85) {
          otHours = 2.5;
          punchOut = staff.shift === 'Evening' ? '01:00' : '19:00';
        } else if (pseudoRandom > 75) {
          otHours = 1.5;
          punchOut = staff.shift === 'Evening' ? '00:00' : '18:00';
        } else {
          otHours = 1.0;
          punchOut = staff.shift === 'Evening' ? '23:30' : '17:30';
        }
      }

      // Explicit configuration for Ramesh Kumar on 2026-09-06 to match user template:
      // Punched In (08:00 AM), Regular: 8.0 hrs, Overtime: 1.5 hrs, Assigned: 3rd Floor Wards
      if (staff.id === 1 && dateStr === '2026-09-06') {
        punchIn = '08:00';
        punchOut = '17:30';
        regularHours = 8.0;
        otHours = 1.5;
      }

      records.push({
        id: `att_${staff.id}_${dateStr}`,
        userId: staff.id,
        date: dateStr,
        punchIn,
        punchOut,
        regularHours,
        otHours,
        status: 'Present',
        notes: staff.id === 1 && dateStr === '2026-09-06' ? '3rd Floor Wards' : (otHours > 0 ? `Late inspection & deep sanitize (+${otHours}h OT)` : undefined),
      });
    }
  });

  return records;
}

const STORAGE_KEY_STAFF = 'hk_staff_users_v2';
const STORAGE_KEY_ATTENDANCE = 'hk_attendance_records_v2';

export function getStoredStaff(): StaffUser[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_STAFF);
    if (data) return JSON.parse(data);
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
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse attendance from local storage', e);
  }
  // Generate default seed for August and September 2026
  const aug = generateSeedAttendance(2026, 8);
  const sep = generateSeedAttendance(2026, 9);
  return [...aug, ...sep];
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

export function getStoredUsers(): AppUser[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_USERS);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse users from local storage', e);
  }
  return INITIAL_USERS;
}

export function saveStoredUsers(users: AppUser[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save users to local storage', e);
  }
}

export function getStoredCurrentUser(): AppUser | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse current user from local storage', e);
  }
  // Default to admin user for convenient instant preview, or null if logged out
  return INITIAL_USERS[0];
}

export function saveStoredCurrentUser(user: AppUser | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    }
  } catch (e) {
    console.error('Failed to save current user to local storage', e);
  }
}

export function verifyUserCredentials(
  username: string,
  password: string
): { user: AppUser | null; error?: string; isPending?: boolean } {
  const users = getStoredUsers();
  const cleanInput = username.toLowerCase().trim();

  const found = users.find((u) => {
    if (u.username.toLowerCase().trim() === cleanInput) return true;
    if (u.role === 'staff' && u.staffId) {
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

  if (!found || found.password !== password) {
    return { user: null, error: 'Galat Username ya Password!' };
  }

  // Security Check for Self-Signup: if not user.is_approved
  if (found.is_approved === false) {
    return {
      user: null,
      error: 'Aapka account abhi Admin approval ke liye pending hai.',
      isPending: true,
    };
  }

  return { user: found };
}

