export type PermissionAction =
  | 'VIEW_STAFF_VAULT'
  | 'EDIT_STAFF_VAULT'
  | 'DELETE_RECORDS'
  | 'EDIT_ROSTER'
  | 'MANAGE_SHIFTS'
  | 'DOWNLOAD_REPORTS'
  | 'REGISTER_STAFF'
  | 'MANAGE_GEOFENCES'
  | 'MANAGE_SITES'
  | 'PUBLISH_POSTS'
  | 'OVERRIDE_PUNCHES'
  | 'APPROVE_LEAVES';

export interface PermissionDefinition {
  id: PermissionAction;
  name: string;
  description: string;
  category: 'Staff & Directory' | 'Duty & Scheduling' | 'Attendance & GPS' | 'Operations & Reports';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  {
    id: 'VIEW_STAFF_VAULT',
    name: 'View Staff Vault',
    description: 'Inspect full staff directory, contact info, shift allocations and encrypted credentials',
    category: 'Staff & Directory',
    riskLevel: 'LOW',
  },
  {
    id: 'EDIT_STAFF_VAULT',
    name: 'Edit Staff Profiles',
    description: 'Update employee metadata, contact details, assigned sites, duty types and passwords',
    category: 'Staff & Directory',
    riskLevel: 'MEDIUM',
  },
  {
    id: 'DELETE_RECORDS',
    name: 'Delete Records & Terminate',
    description: 'Permanently remove staff members, delete historical attendance logs or purge shifts',
    category: 'Staff & Directory',
    riskLevel: 'CRITICAL',
  },
  {
    id: 'REGISTER_STAFF',
    name: 'Register Onboarding Staff',
    description: 'Create new employee profiles, assign default passwords and generate onboarding slips',
    category: 'Staff & Directory',
    riskLevel: 'MEDIUM',
  },
  {
    id: 'EDIT_ROSTER',
    name: 'Edit Roster & Shifts',
    description: 'Assign staff to duty slots, modify shift allocations and reassign floor coverage',
    category: 'Duty & Scheduling',
    riskLevel: 'MEDIUM',
  },
  {
    id: 'MANAGE_SHIFTS',
    name: 'Manage Shift Templates',
    description: 'Create, modify or deactivate shift timing profiles and reliever rotation policies',
    category: 'Duty & Scheduling',
    riskLevel: 'HIGH',
  },
  {
    id: 'OVERRIDE_PUNCHES',
    name: 'Override Punches & Attendance',
    description: 'Manually correct clock-in/out timestamps, resolve GPS geofence rejections, adjust hours',
    category: 'Attendance & GPS',
    riskLevel: 'HIGH',
  },
  {
    id: 'APPROVE_LEAVES',
    name: 'Approve / Reject Leaves',
    description: 'Review staff absence and leave requests, issue approvals, adjust roster schedules',
    category: 'Attendance & GPS',
    riskLevel: 'MEDIUM',
  },
  {
    id: 'MANAGE_GEOFENCES',
    name: 'Manage GPS Geofences',
    description: 'Configure hospital coordinates, modify radius tolerance, toggle Strict Mode enforcement',
    category: 'Operations & Reports',
    riskLevel: 'HIGH',
  },
  {
    id: 'MANAGE_SITES',
    name: 'Manage Hospital Sites',
    description: 'Create new hospital branches, archive campuses and assign site operations managers',
    category: 'Operations & Reports',
    riskLevel: 'CRITICAL',
  },
  {
    id: 'PUBLISH_POSTS',
    name: 'Publish Operational Notices',
    description: 'Broadcast company-wide announcements, ward alerts and critical emergency bulletins',
    category: 'Operations & Reports',
    riskLevel: 'MEDIUM',
  },
  {
    id: 'DOWNLOAD_REPORTS',
    name: 'Download Reports & Exports',
    description: 'Export PDF landscape roster sheets, Google Sheets attendance logs and payroll data',
    category: 'Operations & Reports',
    riskLevel: 'LOW',
  },
];

export type RoleName = 'MASTER_ADMIN' | 'OPERATIONS_MANAGER' | 'SUPERVISOR' | 'STAFF';

export type RolePermissionsMatrix = Record<RoleName, Record<PermissionAction, boolean>>;

export type UserCustomPermissionsMap = Record<string, Partial<Record<PermissionAction, boolean>>>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMatrix = {
  MASTER_ADMIN: {
    VIEW_STAFF_VAULT: true,
    EDIT_STAFF_VAULT: true,
    DELETE_RECORDS: true,
    EDIT_ROSTER: true,
    MANAGE_SHIFTS: true,
    DOWNLOAD_REPORTS: true,
    REGISTER_STAFF: true,
    MANAGE_GEOFENCES: true,
    MANAGE_SITES: true,
    PUBLISH_POSTS: true,
    OVERRIDE_PUNCHES: true,
    APPROVE_LEAVES: true,
  },
  OPERATIONS_MANAGER: {
    VIEW_STAFF_VAULT: true,
    EDIT_STAFF_VAULT: true,
    DELETE_RECORDS: false,
    EDIT_ROSTER: true,
    MANAGE_SHIFTS: true,
    DOWNLOAD_REPORTS: true,
    REGISTER_STAFF: true,
    MANAGE_GEOFENCES: true,
    MANAGE_SITES: false,
    PUBLISH_POSTS: true,
    OVERRIDE_PUNCHES: true,
    APPROVE_LEAVES: true,
  },
  SUPERVISOR: {
    VIEW_STAFF_VAULT: true, // View-only for assigned ward
    EDIT_STAFF_VAULT: false,
    DELETE_RECORDS: false,
    EDIT_ROSTER: true, // When on duty
    MANAGE_SHIFTS: false,
    DOWNLOAD_REPORTS: true,
    REGISTER_STAFF: false,
    MANAGE_GEOFENCES: false,
    MANAGE_SITES: false,
    PUBLISH_POSTS: false,
    OVERRIDE_PUNCHES: false,
    APPROVE_LEAVES: true,
  },
  STAFF: {
    VIEW_STAFF_VAULT: false,
    EDIT_STAFF_VAULT: false,
    DELETE_RECORDS: false,
    EDIT_ROSTER: false,
    MANAGE_SHIFTS: false,
    DOWNLOAD_REPORTS: false,
    REGISTER_STAFF: false,
    MANAGE_GEOFENCES: false,
    MANAGE_SITES: false,
    PUBLISH_POSTS: false,
    OVERRIDE_PUNCHES: false,
    APPROVE_LEAVES: false,
  },
};

// =========================================================================
// CUSTOM POSTS & ANNOUNCEMENTS TYPES
// =========================================================================

export type PostPriority = 'NORMAL' | 'URGENT' | 'CRITICAL';
export type TargetAudienceType = 'ALL_SITES' | 'SPECIFIC_SITE' | 'SPECIFIC_WARD' | 'SPECIFIC_ROLE';

export interface CustomPost {
  id: string;
  tenant_id?: string;
  title: string;
  content: string;
  priority: PostPriority;
  target_audience_type: TargetAudienceType;
  target_site_id?: string;
  target_site_name?: string;
  target_ward?: string;
  target_role?: 'all' | 'operations_manager' | 'supervisor' | 'staff';
  pinned?: boolean;
  author_id: string | number;
  author_name: string;
  author_role: string;
  created_at: string;
  expires_at?: string;
  read_by?: string[]; // IDs of users who acknowledged
  tags?: string[];
}
