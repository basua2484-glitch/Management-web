import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  FileSpreadsheet,
  Users,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Clock,
  Activity,
  LogOut,
  LogIn,
  Building,
  UserCheck,
  Plus,
  Shield,
  ShieldCheck,
  Power,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Terminal,
  HelpCircle,
  ShieldAlert,
  FileText,
  Hospital,
  Compass,
  MapPin,
  History,
  KeyRound,
  Eye,
  Check,
  Search,
  CalendarCheck,
  CalendarDays,
} from 'lucide-react';
import type { StaffUser, AttendanceRecord, MonthlyStaffSummary, AppUser, FlashMessage, UserRole, StaffRequest, DutyAllocation } from '../types';
import {
  getStoredStaff,
  saveStoredStaff,
  getStoredAttendance,
  saveStoredAttendance,
  getStoredUsers,
  saveStoredUsers,
  getStoredCurrentUser,
  saveStoredCurrentUser,
  getStoredDutyAllocations,
  saveStoredDutyAllocations,
  approveDutyOtRequest,
  rejectDutyOtRequest,
  getStoredStaffRequests,
  saveStoredStaffRequests,
  createStaffRequest,
  approveStaffRequest,
  rejectStaffRequest,
  HOSPITAL_SITES,
  getAllLeaveRequests,
  getTodayIso,
} from '../data/mockHousekeepingData';
import {
  deleteUserFromLiveDb,
  deleteStaffFromLiveDb,
  fetchLiveUsers,
  fetchLiveStaff,
  saveUserToLiveDb,
  saveStaffToLiveDb,
} from '../services/firestoreService';
import { logout, getCurrentUser, initAuth } from '../services/firebase';
import { performLogout, handleLogout, checkAdminRequired, adminRequired } from '../services/auth';
import { downloadMonthlyReportPdf } from '../services/pdfGenerator';
import { ReportTable } from './ReportTable';
import { GoogleSheetsModal } from './GoogleSheetsModal';
import { DailyAttendanceModal } from './DailyAttendanceModal';
import { StaffManagementModal } from './StaffManagementModal';
import { PdfPreviewModal } from './PdfPreviewModal';
import { LiveAttendanceView } from './LiveAttendanceView';
import { DutyAssignmentModal } from './DutyAssignmentModal';
import { StaffPunchPortal } from './StaffPunchPortal';
import { StaffPunchPortalModal } from './StaffPunchPortalModal';
import { RegisterStaffModal } from './RegisterStaffModal';
import { PendingApprovalModal } from './PendingApprovalModal';
import { AdminStaffTable } from './AdminStaffTable';
import { AdminVaultModal } from './AdminVaultModal';
import { StaffRequestModal } from './StaffRequestModal';
import { CredentialCardModal, type CredentialCardData } from './CredentialCardModal';
import { LeaveManagementView } from './LeaveManagementView';
import { EmployeeProfileModal } from './EmployeeProfileModal';
import { GeofenceSettingsPanel } from './GeofenceSettingsPanel';
import { createPasswordHash } from '../services/vaultService';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export interface DashboardPageProps {
  defaultTab?: 'live' | 'monthly' | 'portal' | 'admin-staff' | 'pending-approvals' | 'leaves' | 'geofence';
}

export function DashboardPage({ defaultTab }: DashboardPageProps = {}) {
  const navigate = useNavigate();
  const { user: authUser, role: authRole, logout: authLogout } = useAuth();
  // Current monthly report period
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(9);

  // Live overview date (defaults to current dynamic system date)
  const [selectedLiveDate, setSelectedLiveDate] = useState<string>(() => getTodayIso());

  // App Authentication Users & Current User (synchronous resolution, no refresh lag)
  const [users, setUsers] = useState<AppUser[]>(() => getStoredUsers());
  const currentUser = useMemo<AppUser | null>(() => {
    if (authUser) return authUser;
    return getStoredCurrentUser();
  }, [authUser]);

  // Case-insensitive role resolution for robust access controls
  const userRole: UserRole = ((authRole || currentUser?.role || 'staff').toLowerCase() as UserRole);
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager';
  const isSupervisor = userRole === 'supervisor';
  const isStaff = userRole === 'staff';
  const isAdminOrManager = isAdmin || isManager;
  const isElevatedRole = isAdmin || isManager || isSupervisor;

  // Leave Requests state for badge indicator
  const [allLeaveRequests, setAllLeaveRequests] = useState(() => getAllLeaveRequests());

  useEffect(() => {
    const handleLeaveUpdate = () => {
      setAllLeaveRequests(getAllLeaveRequests());
    };
    window.addEventListener('leave-data-updated', handleLeaveUpdate);
    return () => window.removeEventListener('leave-data-updated', handleLeaveUpdate);
  }, []);

  const pendingLeavesCount = useMemo(() => {
    if (isStaff && currentUser) {
      return allLeaveRequests.filter((r) => r.userId === currentUser.id && r.status === 'Pending').length;
    }
    return allLeaveRequests.filter((r) => r.status === 'Pending').length;
  }, [allLeaveRequests, isStaff, currentUser]);

  // Flask Flash Messages Queue
  const [flashes, setFlashes] = useState<FlashMessage[]>([]);

  const addFlash = (message: string, type: 'danger' | 'warning' | 'success' | 'info' = 'info') => {
    const id = `flash_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    setFlashes((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setFlashes((prev) => prev.filter((f) => f.id !== id));
    }, 5500);
  };

  const removeFlash = (id: string) => {
    setFlashes((prev) => prev.filter((f) => f.id !== id));
  };

  // Navigation tab: 'live', 'monthly', 'portal', 'admin-staff', 'pending-approvals', 'leaves', 'geofence'
  const [activeTab, setActiveTab] = useState<'live' | 'monthly' | 'portal' | 'admin-staff' | 'pending-approvals' | 'leaves' | 'geofence'>(() => {
    if (defaultTab) return defaultTab;
    const user = getStoredCurrentUser();
    if (user?.role === 'staff') return 'portal';
    if (user?.role === 'supervisor') return 'leaves';
    return 'live';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Staff and Attendance Records State
  const [staff, setStaff] = useState<StaffUser[]>(() => getStoredStaff());
  const [records, setRecords] = useState<AttendanceRecord[]>(() => getStoredAttendance());
  const [staffRequests, setStaffRequests] = useState<StaffRequest[]>(() => getStoredStaffRequests());
  const [dutyAllocations, setDutyAllocations] = useState<DutyAllocation[]>(() => getStoredDutyAllocations());

  // Google User / Auth
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);

  // Modals state
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isPunchModalOpen, setIsPunchModalOpen] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [isDutyModalOpen, setIsDutyModalOpen] = useState(false);
  const [dutyModalStaffId, setDutyModalStaffId] = useState<number | null>(null);
  const [selectedStaffForPunch, setSelectedStaffForPunch] = useState<number | null>(null);
  const [isPunchPortalModalOpen, setIsPunchPortalModalOpen] = useState(false);
  const [punchPortalStaffId, setPunchPortalStaffId] = useState<number>(1);
  const [isRegisterStaffModalOpen, setIsRegisterStaffModalOpen] = useState(false);
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [isAdminVaultModalOpen, setIsAdminVaultModalOpen] = useState(false);
  const [isStaffRequestModalOpen, setIsStaffRequestModalOpen] = useState(false);
  const [isSystemInfoOpen, setIsSystemInfoOpen] = useState(false);
  const [activeCredentialSlip, setActiveCredentialSlip] = useState<CredentialCardData | null>(null);
  const [profileModalStaffId, setProfileModalStaffId] = useState<string | null>(null);

  // Pending approvals (Signups, Staff Requests, Overtime Requests)
  const pendingUsers = useMemo(() => users.filter((u) => u.is_approved === false), [users]);
  const pendingStaffRequests = useMemo(() => staffRequests.filter((r) => r.status === 'PENDING'), [staffRequests]);
  const pendingOtRequests = useMemo(
    () => dutyAllocations.filter((a) => a.ot_status === 'PENDING' && (a.ot_requested_hours || 0) > 0),
    [dutyAllocations]
  );
  const totalPendingCount = pendingUsers.length + pendingStaffRequests.length + pendingOtRequests.length;

  // Listen for route changes and expose helpers
  useEffect(() => {
    const unsub = initAuth(
      (user) => {
        if (user?.email) {
          setGoogleUserEmail(user.email);
        }
      },
      () => {}
    );
    const existing = getCurrentUser();
    if (existing?.email) {
      setGoogleUserEmail(existing.email);
    }
    return () => {
      unsub();
    };
  }, []);

  // Real-time synchronization with primary database collections ('users' / 'staff')
  useEffect(() => {
    let isMounted = true;
    const syncWithFirestore = async () => {
      try {
        const [cloudUsers, cloudStaff] = await Promise.all([
          fetchLiveUsers(),
          fetchLiveStaff(),
        ]);
        if (!isMounted) return;
        if (cloudUsers && cloudUsers.length > 0) {
          setUsers(cloudUsers);
          saveStoredUsers(cloudUsers);
        }
        if (cloudStaff && cloudStaff.length > 0) {
          setStaff(cloudStaff);
          saveStoredStaff(cloudStaff);
        }
      } catch (err) {
        console.warn('Firestore live sync note:', err);
      }
    };
    syncWithFirestore();

    const handleDataUpdate = () => {
      setStaff(getStoredStaff());
      setUsers(getStoredUsers());
      setRecords(getStoredAttendance());
      setDutyAllocations(getStoredDutyAllocations());
      setStaffRequests(getStoredStaffRequests());
    };
    window.addEventListener('staff-data-updated', handleDataUpdate);
    window.addEventListener('user-data-updated', handleDataUpdate);
    window.addEventListener('duty-data-updated', handleDataUpdate);
    window.addEventListener('attendance-data-updated', handleDataUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('staff-data-updated', handleDataUpdate);
      window.removeEventListener('user-data-updated', handleDataUpdate);
      window.removeEventListener('duty-data-updated', handleDataUpdate);
      window.removeEventListener('attendance-data-updated', handleDataUpdate);
    };
  }, []);

  useEffect(() => {
    // Expose logout, handleLogout, and admin_required on window for direct testing/scripts
    (window as unknown as {
      logout: typeof handleAppLogout;
      handleLogout: typeof handleLogout;
      admin_required: typeof checkAdminRequired;
    }).logout = handleAppLogout;
    (window as unknown as {
      logout: typeof handleAppLogout;
      handleLogout: typeof handleLogout;
      admin_required: typeof checkAdminRequired;
    }).handleLogout = handleLogout;
    (window as unknown as {
      logout: typeof handleAppLogout;
      handleLogout: typeof handleLogout;
      admin_required: typeof checkAdminRequired;
    }).admin_required = checkAdminRequired;

    const handleRouteInspection = () => {
      if (typeof window === 'undefined') return;
      const pathname = window.location.pathname;

      if (pathname === '/logout') {
        handleAppLogout();
        return;
      }

      // @app.route('/admin/dashboard') with @admin_required
      // If 'user_id' not in session or session.get('role') != 'admin': return redirect('/login')
      if (pathname === '/admin-dashboard' || pathname === '/admin/dashboard' || pathname === '/admin') {
        if (currentUser && !isAdminOrManager) {
          // Unauthorized attempt -> Redirect to their appropriate portal
          navigate('/staff-portal', { replace: true });
          return;
        }
        // Authorized: open admin dashboard
        setActiveTab((prev) => (prev === 'live' ? prev : 'live'));
      }
    };

    handleRouteInspection();
    window.addEventListener('popstate', handleRouteInspection);

    return () => {
      window.removeEventListener('popstate', handleRouteInspection);
    };
  }, [currentUser, isAdminOrManager, navigate]);

  const handleSaveStaff = (updatedStaff: StaffUser[]) => {
    setStaff(updatedStaff);
    saveStoredStaff(updatedStaff);
  };

  const handleSaveRecords = (updatedRecords: AttendanceRecord[]) => {
    setRecords(updatedRecords);
    saveStoredAttendance(updatedRecords);
  };

  // Month formatting for Monthly Report
  const monthName = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }, [year, month]);

  const daysInMonth = useMemo(() => {
    return new Date(year, month, 0).getDate();
  }, [year, month]);

  // Staff Only View (Sirf apna data dekhne ke liye):
  // When staff role is logged in, restrict data view to only their own record
  const visibleStaff = useMemo(() => {
    if (currentUser?.role === 'staff') {
      const filtered = staff.filter((s) => {
        if (currentUser.staffId && s.id === currentUser.staffId) return true;
        if (currentUser.staff_id && s.staffCode.toLowerCase() === currentUser.staff_id.toLowerCase()) return true;
        if (currentUser.username && s.staffCode.toLowerCase() === currentUser.username.toLowerCase()) return true;
        return s.name.toLowerCase() === currentUser.name.toLowerCase();
      });
      return filtered.length > 0 ? filtered : staff.slice(0, 1);
    }
    return staff;
  }, [staff, currentUser]);

  // Aggregate monthly data matching Python backend formula
  const summaryData = useMemo<MonthlyStaffSummary[]>(() => {
    const monthPrefix = `${year}-${month.toString().padStart(2, '0')}`;

    return visibleStaff
      .filter((s) => s.active)
      .map((user) => {
        const userRecords = records.filter(
          (r) => r.userId === user.id && r.date.startsWith(monthPrefix)
        );

        const daysPresent = userRecords.filter((r) => Boolean(r.punchIn)).length;
        const totalRegHours = userRecords.reduce((sum, r) => sum + (r.regularHours || 0), 0);
        const totalOtHours = userRecords.reduce((sum, r) => sum + (r.otHours || 0), 0);
        const grandTotalHours = totalRegHours + totalOtHours;

        return {
          userId: user.id,
          staffId: user.staffCode,
          staffName: user.name,
          role: user.role,
          department: user.department,
          daysPresent,
          totalRegHours,
          totalOtHours,
          grandTotalHours,
          recordsCount: userRecords.length,
        };
      });
  }, [visibleStaff, records, year, month]);

  // Totals for stat-row
  const aggregatePresentDays = summaryData.reduce((acc, s) => acc + s.daysPresent, 0);
  const totalRegularHours = summaryData.reduce((acc, s) => acc + s.totalRegHours, 0);
  const totalOtHours = summaryData.reduce((acc, s) => acc + s.totalOtHours, 0);
  const totalPossibleDays = (visibleStaff.filter((s) => s.active).length || 1) * daysInMonth;

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  // Download PDF
  const handleDownloadPdf = () => {
    downloadMonthlyReportPdf({
      year,
      month,
      monthName,
      summaryData,
    });
    addFlash('Generating monthly PDF report artifact...', 'info');
  };

  const handleSelectStaffRow = (staffId: number) => {
    setSelectedStaffForPunch(staffId);
    setIsPunchModalOpen(true);
  };

  // Save single punch record
  const handleSavePunchRecord = (record: AttendanceRecord) => {
    const existingIndex = records.findIndex((r) => r.id === record.id);
    let updated: AttendanceRecord[];
    if (existingIndex >= 0) {
      updated = [...records];
      updated[existingIndex] = record;
    } else {
      updated = [record, ...records];
    }
    handleSaveRecords(updated);
  };

  const handleDeletePunchRecord = (recordId: string) => {
    const updated = records.filter((r) => r.id !== recordId);
    handleSaveRecords(updated);
  };

  const handleAddStaffMember = (newStaffData: Omit<StaffUser, 'id'>) => {
    // Strict Guard Check
    if (!isAdmin) {
      addFlash('Unauthorized Access: Admin Privileges Required', 'danger');
      return;
    }

    const newId = staff.length > 0 ? Math.max(...staff.map((s) => s.id)) + 1 : 1;
    const newMember: StaffUser = {
      ...newStaffData,
      id: newId,
    };
    const updatedStaff = [...staff, newMember];
    handleSaveStaff(updatedStaff);

    // Synchronize to User model (id, staff_id, name, role='staff')
    const cleanStaffId = newMember.staffCode;
    const existingUser = users.find(
      (u) =>
        (u.staff_id && u.staff_id.toLowerCase() === cleanStaffId.toLowerCase()) ||
        (u.username && u.username.toLowerCase() === cleanStaffId.toLowerCase())
    );
    if (!existingUser) {
      const newUserId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
      const linkedUser: AppUser = {
        id: newUserId,
        staff_id: cleanStaffId,
        username: cleanStaffId,
        name: newMember.name,
        full_name: newMember.name,
        role: 'staff',
        duty_type: 'FIXED',
        fixed_department: newMember.department,
        is_temp_reliever: false,
        temp_department: null,
        assigned_shift: newMember.shift === 'Night' ? '11-7' : newMember.shift === 'Evening' ? '3-11' : '7-3',
        password: 'staff123',
        password_hash: createPasswordHash('staff123'),
        raw_password_vault: 'staff123',
        status: 'ACTIVE',
        department: newMember.department,
        shift: newMember.shift,
        is_approved: true,
        staffId: newId,
        assigned_area: newMember.department,
      };
      const updatedUsers = [...users, linkedUser];
      setUsers(updatedUsers);
      saveStoredUsers(updatedUsers);
    }
  };

  const handleToggleStaffActive = (staffId: number) => {
    const updated = staff.map((s) => (s.id === staffId ? { ...s, active: !s.active } : s));
    handleSaveStaff(updated);
  };

  const handleOpenAssignModal = (staffId?: number) => {
    setDutyModalStaffId(staffId || null);
    setIsDutyModalOpen(true);
  };

  const handleSaveDutyAssignment = (
    recordOrData: AttendanceRecord | { staffId: number; department: string; shift: string },
    updatedDutyArea?: string
  ) => {
    if ('userId' in recordOrData) {
      handleSavePunchRecord(recordOrData);
      if (updatedDutyArea) {
        const updatedStaff = staff.map((s) =>
          s.id === recordOrData.userId ? { ...s, department: updatedDutyArea } : s
        );
        handleSaveStaff(updatedStaff);
      }
    } else {
      const updated = staff.map((s) =>
        s.id === recordOrData.staffId
          ? {
              ...s,
              department: recordOrData.department,
              shift: recordOrData.shift as 'Morning' | 'Evening' | 'Night',
            }
          : s
      );
      handleSaveStaff(updated);

      // Also update today's attendance record assignment
      const todayRec = records.find((r) => r.userId === recordOrData.staffId && r.date === selectedLiveDate);
      if (todayRec) {
        const updatedRecs = records.map((r) =>
          r.id === todayRec.id
            ? {
                ...r,
                department: recordOrData.department,
                shift: recordOrData.shift as 'Morning' | 'Evening' | 'Night',
              }
            : r
        );
        handleSaveRecords(updatedRecs);
      }
    }
  };

  // Flask Authentication Handlers
  const handleAppLogin = (user: AppUser) => {
    saveStoredCurrentUser(user);

    // Set user tokens & session cookies matching Flask session ('user_id', 'role', 'session')
    try {
      localStorage.setItem("user_token", `token_${user.id}_${Date.now()}`);
      localStorage.setItem("user_role", user.role);
      document.cookie = `session=active_${user.id}; Path=/; SameSite=Lax`;
      document.cookie = `user_id=${user.id}; Path=/; SameSite=Lax`;
      document.cookie = `role=${user.role}; Path=/; SameSite=Lax`;
    } catch (e) {
      console.warn('Cookie set notice:', e);
    }
    window.dispatchEvent(new Event('auth-state-change'));

    // Strict Role Redirection:
    // if user.role == 'admin': redirect(url_for('admin_dashboard')) -> /admin/dashboard
    // else: redirect(url_for('staff_portal'))
    if (user.role === 'admin') {
      setActiveTab('live');
      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState({}, '', '/admin-dashboard');
      }
    } else if (user.role === 'manager') {
      setActiveTab('live');
    } else {
      setActiveTab('portal');
    }
    addFlash(
      `Swagat hai, ${user.name}! (${
        user.role === 'admin'
          ? 'Admin Dashboard'
          : user.role === 'manager'
          ? 'Manager Dashboard'
          : 'Staff Punch Portal'
      })`,
      'success'
    );
  };

  const handleAppLogout = async () => {
    addFlash('Aap safaltapurvak logout ho gaye hain.', 'info');
    authLogout(navigate);
  };

  // Role Access Control Decorator: @admin_required & @role_required
  const handleNavigateTab = (targetTab: 'live' | 'monthly' | 'portal' | 'admin-staff' | 'pending-approvals' | 'leaves' | 'geofence') => {
    if (!currentUser) {
      handleAppLogout();
      return;
    }

    // Admin Dashboard / Staff Management / Approvals Queue / Geofence Settings protected by @admin_required
    if (targetTab === 'live' || targetTab === 'admin-staff' || targetTab === 'pending-approvals' || targetTab === 'geofence') {
      const check = checkAdminRequired(currentUser);
      if (!check.authorized && !isAdminOrManager && !isSupervisor) {
        // Unauthorized attempt -> Redirect to login
        addFlash('Unauthorized attempt: Elevated privileges required. Redirected to /login.', 'danger');
        handleAppLogout();
        return;
      }
      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState({}, '', targetTab === 'geofence' ? '/admin-geofence' : '/admin-dashboard');
      }
    } else if (targetTab === 'monthly') {
      if (!isAdminOrManager) {
        addFlash('Aapko is section ko access karne ki permission nahi hai.', 'danger');
        if (isStaff) {
          setActiveTab('portal');
        }
        return;
      }
    }

    setActiveTab(targetTab);
    setIsMobileSidebarOpen(false);
  };

  // Full Admin User & Duty Allocation CRUD Handlers
  const handleUpdateUser = (updatedUser: AppUser) => {
    if (!isAdmin) {
      addFlash('Unauthorized: Admin role required to modify user profiles.', 'danger');
      return;
    }
    const updatedUsers = users.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    setUsers(updatedUsers);
    saveStoredUsers(updatedUsers);

    // Sync to staff list if matching staff exists
    const matchingStaff = staff.find(
      (s) =>
        (updatedUser.staffId && s.id === updatedUser.staffId) ||
        (updatedUser.staff_id && s.staffCode.toLowerCase() === updatedUser.staff_id.toLowerCase()) ||
        s.name.toLowerCase() === updatedUser.name.toLowerCase()
    );

    if (matchingStaff) {
      const shiftNamed: 'Morning' | 'Evening' | 'Night' =
        updatedUser.assigned_shift === '11-7'
          ? 'Night'
          : updatedUser.assigned_shift === '3-11'
          ? 'Evening'
          : 'Morning';
      const updatedStaffList = staff.map((s) => {
        if (s.id === matchingStaff.id) {
          return {
            ...s,
            name: updatedUser.full_name || updatedUser.name,
            dutyType: updatedUser.duty_type || 'FIXED',
            fixedDepartment: updatedUser.fixed_department || s.department,
            isTempReliever: Boolean(updatedUser.is_temp_reliever),
            tempDepartment: updatedUser.temp_department || undefined,
            department:
              updatedUser.is_temp_reliever && updatedUser.temp_department
                ? updatedUser.temp_department
                : updatedUser.fixed_department || s.department,
            shift: shiftNamed,
            active: updatedUser.status === 'ACTIVE',
          };
        }
        return s;
      });
      setStaff(updatedStaffList);
      saveStoredStaff(updatedStaffList);

      const targetStaffDoc = updatedStaffList.find((s) => s.id === matchingStaff.id);
      if (targetStaffDoc) {
        saveStaffToLiveDb(targetStaffDoc).catch(console.warn);
      }
    }

    saveUserToLiveDb(updatedUser).catch(console.warn);
    window.dispatchEvent(new Event('staff-data-updated'));
    window.dispatchEvent(new Event('user-data-updated'));

    addFlash(`Updated ${updatedUser.full_name || updatedUser.name} duty profile & credentials.`, 'success');
  };

  const handleDeleteUser = async (userId: number) => {
    if (!isAdmin) {
      addFlash('Unauthorized: Admin role required to delete users.', 'danger');
      return;
    }
    const target = users.find((u) => u.id === userId);
    const updatedUsers = users.filter((u) => u.id !== userId);
    setUsers(updatedUsers);
    saveStoredUsers(updatedUsers);

    // Delete matching staff member by id, staffCode, or name
    const updatedStaff = staff.filter((s) => {
      if (target?.staffId && s.id === target.staffId) return false;
      if (s.id === userId) return false;
      if (target?.staff_id && s.staffCode?.toLowerCase() === target.staff_id.toLowerCase()) return false;
      if (target?.name && s.name.toLowerCase() === target.name.toLowerCase()) return false;
      return true;
    });
    setStaff(updatedStaff);
    saveStoredStaff(updatedStaff);

    // Also persist deletion to Firestore
    try {
      if (target) {
        await deleteUserFromLiveDb(target, target.staff_id);
      } else {
        await deleteUserFromLiveDb(userId);
      }
      if (target?.staffId || target?.staff_id) {
        await deleteStaffFromLiveDb(target.staffId || userId, target.staff_id);
      }
    } catch (err) {
      console.warn('Firestore deletion error:', err);
    }

    window.dispatchEvent(new Event('staff-data-updated'));
    window.dispatchEvent(new Event('user-data-updated'));
    addFlash(`User account ${target?.full_name || target?.name || ''} deleted successfully from database and vault.`, 'info');
  };

  const handleUpdateUserStatus = (userId: number, newStatus: 'ACTIVE' | 'DISABLED') => {
    if (!isAdmin) {
      addFlash('Unauthorized: Admin role required to toggle account status.', 'danger');
      return;
    }
    const updatedUsers = users.map((u) => (u.id === userId ? { ...u, status: newStatus } : u));
    setUsers(updatedUsers);
    saveStoredUsers(updatedUsers);
    const targetUser = updatedUsers.find((u) => u.id === userId);
    if (targetUser) {
      saveUserToLiveDb(targetUser).catch(console.warn);
    }
    window.dispatchEvent(new Event('user-data-updated'));
    addFlash(`Account status updated to ${newStatus}.`, 'info');
  };

  // Staff Joining Request Handlers
  const handleApproveStaffRequest = (requestId: number, assignedShift?: string) => {
    if (!isAdmin) {
      addFlash('Unauthorized: Admin role required for staff joining approvals.', 'danger');
      return;
    }
    const result = approveStaffRequest(requestId, assignedShift);
    if (result.success) {
      setStaffRequests(getStoredStaffRequests());
      const updatedU = getStoredUsers();
      const updatedS = getStoredStaff();
      setUsers(updatedU);
      setStaff(updatedS);

      // Save newly created user & staff to Firestore
      if (result.user) {
        saveUserToLiveDb(result.user).catch(console.warn);
        const newlyCreatedStaff = updatedS.find(
          (s) => s.id === result.user?.staffId || (result.user?.staff_id && s.staffCode === result.user.staff_id)
        );
        if (newlyCreatedStaff) {
          saveStaffToLiveDb(newlyCreatedStaff).catch(console.warn);
        }
      }

      window.dispatchEvent(new Event('staff-data-updated'));
      window.dispatchEvent(new Event('user-data-updated'));
      addFlash(result.message, 'success');
    } else {
      addFlash(result.message, 'warning');
    }
  };

  const handleRejectStaffRequest = (requestId: number) => {
    if (!isAdmin) {
      addFlash('Unauthorized: Admin role required for staff joining rejections.', 'danger');
      return;
    }
    const result = rejectStaffRequest(requestId);
    setStaffRequests(getStoredStaffRequests());
    addFlash(result.message, 'info');
  };

  const handleCreateStaffRequest = (data: {
    candidate_name: string;
    proposed_area: string;
    proposed_shift: string;
    requested_by: string;
  }) => {
    createStaffRequest(data);
    setStaffRequests(getStoredStaffRequests());
    addFlash(`Staff request for ${data.candidate_name} submitted successfully.`, 'success');
  };

  // Overtime (OT) Request Handlers
  const handleApproveOtRequest = (allocationId: number) => {
    if (!isAdmin) {
      addFlash('Unauthorized: Admin role required for overtime approvals.', 'danger');
      return;
    }
    const result = approveDutyOtRequest(allocationId, currentUser?.staff_id || 'ADMIN-001');
    setDutyAllocations(getStoredDutyAllocations());
    setRecords(getStoredAttendance());
    addFlash(result.message, 'success');
  };

  const handleRejectOtRequest = (allocationId: number) => {
    if (!isAdmin) {
      addFlash('Unauthorized: Admin role required for overtime rejections.', 'danger');
      return;
    }
    const result = rejectDutyOtRequest(allocationId, currentUser?.staff_id || 'ADMIN-001');
    setDutyAllocations(getStoredDutyAllocations());
    addFlash(result.message, 'info');
  };

  // 1. Staff Self Signup (Pending State) - @app.route('/signup', methods=['GET', 'POST'])
  const handleSignupUser = (data: {
    name: string;
    username: string;
    password: string;
  }): { success: boolean; message: string } => {
    const cleanUsername = data.username.trim().toLowerCase();

    // if User.query.filter_by(staff_id=staff_id).first() OR username: flash("Yeh Username pehle se registered hai!", "warning")
    if (
      users.some(
        (u) =>
          u.username.trim().toLowerCase() === cleanUsername ||
          (u.staff_id && u.staff_id.trim().toLowerCase() === cleanUsername)
      )
    ) {
      const msg = 'Yeh Username pehle se registered hai!';
      addFlash(msg, 'warning');
      return { success: false, message: msg };
    }

    const newUserId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
    // Account banega par is_approved = False rahega
    const newUser: AppUser = {
      id: newUserId,
      staff_id: data.username.trim(),
      username: data.username.trim(),
      name: data.name.trim(),
      full_name: data.name.trim(),
      password: data.password,
      password_hash: createPasswordHash(data.password),
      raw_password_vault: data.password,
      role: 'staff',
      duty_type: 'FIXED',
      fixed_department: 'Unassigned',
      is_temp_reliever: false,
      temp_department: null,
      assigned_shift: '7-3',
      status: 'PENDING',
      is_approved: false, // Security Check for Self-Signup
      assigned_area: 'Unassigned',
    };

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    saveStoredUsers(updatedUsers);

    // flash("Registration safal! Admin approval ke baad aap login kar paayenge.", "info")
    const infoMsg = 'Registration safal! Admin approval ke baad aap login kar paayenge.';
    addFlash(infoMsg, 'info');
    return { success: true, message: infoMsg };
  };

  // 3. Admin Approval Route - @app.route('/admin/approve_user/<int:user_id>', methods=['POST'])
  // @login_required
  // @role_required(['admin'])
  const handleApproveUser = (
    userId: number,
    assignedRole: UserRole = 'staff',
    assignedArea: string = 'General Wards'
  ) => {
    if (!isAdmin) {
      addFlash('Aapko is section ko access karne ki permission nahi hai.', 'danger');
      return;
    }

    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    let newStaffId = targetUser.staffId;
    let generatedStaffCode = targetUser.staff_id;
    if (assignedRole === 'staff' && !newStaffId) {
      newStaffId = staff.length > 0 ? Math.max(...staff.map((s) => s.id)) + 1 : 1;
      generatedStaffCode = `HK-${newStaffId.toString().padStart(3, '0')}`;
      const newStaffMember: StaffUser = {
        id: newStaffId,
        staffCode: generatedStaffCode,
        name: targetUser.name,
        role: 'staff',
        department: assignedArea || 'General Wards',
        shift: 'Morning',
        hourlyRate: 15,
        active: true,
      };
      const updatedStaff = [...staff, newStaffMember];
      setStaff(updatedStaff);
      saveStoredStaff(updatedStaff);
    }

    const updatedUsers = users.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          staff_id: u.staff_id || generatedStaffCode || u.username,
          is_approved: true,
          role: assignedRole,
          assigned_area: assignedArea,
          department: assignedArea,
          staffId: newStaffId,
        };
      }
      return u;
    });

    setUsers(updatedUsers);
    saveStoredUsers(updatedUsers);

    // flash(f"{user.name} ka account approve ho gaya hai!", "success")
    addFlash(`${targetUser.name} ka account approve ho gaya hai!`, 'success');
  };

  // @app.route('/create_staff', methods=['POST'])
  // @login_required
  // def create_staff():
  //     # Strict Guard Check
  //     if current_user.role != 'admin':
  //         return jsonify({"error": "Unauthorized Access: Admin Privileges Required"}), 403
  //     # Process Staff Creation Logic Here
  const handleCreateStaffAccount = (data: {
    staff_id?: string;
    username: string;
    password: string;
    name: string;
    role: UserRole;
    assigned_area: string;
    assigned_shift?: string;
    duty_type?: 'FIXED' | 'PERMANENT_RELIEVER' | 'TEMP_RELIEVER';
    fixed_department?: string;
    is_temp_reliever?: boolean;
    temp_department?: string | null;
  }): { success: boolean; message: string; status?: number } => {
    // Strict Guard Check
    if (!isAdmin) {
      const errorMsg = 'Unauthorized Access: Admin Privileges Required';
      addFlash(errorMsg, 'danger');
      return { success: false, message: errorMsg, status: 403 };
    }

    const chosenStaffId = (data.staff_id || data.username).trim();
    const cleanId = chosenStaffId.toLowerCase();
    if (
      users.some(
        (u) =>
          u.username.toLowerCase().trim() === cleanId ||
          (u.staff_id && u.staff_id.toLowerCase().trim() === cleanId)
      )
    ) {
      const msg = 'Yeh Staff ID pehle se bani hui hai!';
      addFlash(msg, 'warning');
      return { success: false, message: msg };
    }

    const newUserId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
    const newStaffId = staff.length > 0 ? Math.max(...staff.map((s) => s.id)) + 1 : 1;
    const area = data.assigned_area.trim() || 'General Ward';
    const pwd = data.password.trim();
    const dutyType = data.duty_type || 'FIXED';
    const fixedDept = data.fixed_department || area;
    const isTemp = Boolean(data.is_temp_reliever);
    const tempDept = data.temp_department || null;
    const shiftVal = data.assigned_shift || '7-3';

    const newAppUser: AppUser = {
      id: newUserId,
      staff_id: chosenStaffId,
      username: chosenStaffId,
      password: pwd,
      password_hash: createPasswordHash(pwd),
      raw_password_vault: pwd,
      name: data.name.trim(),
      full_name: data.name.trim(),
      role: data.role || 'staff',
      duty_type: dutyType,
      fixed_department: fixedDept,
      is_temp_reliever: isTemp,
      temp_department: tempDept,
      assigned_shift: shiftVal,
      status: 'ACTIVE',
      is_approved: true,
      assigned_area: isTemp && tempDept ? tempDept : fixedDept,
      department: isTemp && tempDept ? tempDept : fixedDept,
      staffId: data.role === 'staff' ? newStaffId : undefined,
    };

    const updatedUsers = [...users, newAppUser];
    setUsers(updatedUsers);
    saveStoredUsers(updatedUsers);

    if (data.role === 'staff') {
      const shiftNamed: 'Morning' | 'Evening' | 'Night' =
        shiftVal === '11-7' ? 'Night' : shiftVal === '3-11' ? 'Evening' : 'Morning';
      const newStaffUser: StaffUser = {
        id: newStaffId,
        staffCode: chosenStaffId.toUpperCase().startsWith('HK-')
          ? chosenStaffId.toUpperCase()
          : `HK-${newStaffId.toString().padStart(3, '0')}`,
        name: data.name.trim(),
        role: 'staff',
        dutyType,
        fixedDepartment: fixedDept,
        isTempReliever: isTemp,
        tempDepartment: tempDept || undefined,
        department: isTemp && tempDept ? tempDept : fixedDept,
        shift: shiftNamed,
        hourlyRate: 15,
        active: true,
      };
      const updatedStaff = [...staff, newStaffUser];
      setStaff(updatedStaff);
      saveStoredStaff(updatedStaff);
      saveStaffToLiveDb(newStaffUser).catch(console.warn);
    }

    saveUserToLiveDb(newAppUser).catch(console.warn);
    window.dispatchEvent(new Event('staff-data-updated'));
    window.dispatchEvent(new Event('user-data-updated'));

    const successMsg = `Staff Account (${data.name.trim()}) ready hai! Staff ID: ${chosenStaffId}`;
    addFlash(successMsg, 'success');
    return { success: true, message: successMsg };
  };

  const userInitial = currentUser ? currentUser.name.charAt(0).toUpperCase() : 'U';
  const userName = currentUser ? currentUser.name : 'Guest User';

  // If not authenticated, redirect to login page (/login)
  if (!currentUser && !authUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden antialiased text-slate-900 font-sans" style={{ backgroundColor: '#f8fafc' }}>
      {/* Floating Flask Alerts */}
      {flashes.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-2" id="flask-app-flashes">
          {flashes.map((f) => (
            <div
              key={f.id}
              className={`flex items-start justify-between gap-3 p-3.5 rounded-lg shadow-2xl border text-xs font-semibold backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 ${
                f.type === 'danger'
                  ? 'bg-rose-950/95 border-rose-600 text-rose-100'
                  : f.type === 'warning'
                  ? 'bg-amber-950/95 border-amber-500 text-amber-200'
                  : f.type === 'success'
                  ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100'
                  : 'bg-blue-950/95 border-blue-500 text-blue-100'
              }`}
              role="alert"
            >
              <div className="flex items-center gap-2">
                {f.type === 'danger' && <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />}
                {f.type === 'warning' && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />}
                {f.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
                {f.type === 'info' && <Shield className="h-4 w-4 shrink-0 text-blue-400" />}
                <span className="leading-snug">{f.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeFlash(f.id)}
                className="text-white/40 hover:text-white p-0.5 rounded-md"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Mobile Drawer Backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 d-md-none"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* 1. RESPONSIVE SIDEBAR DRAWER */}
      <aside
        className={`sidebar-drawer text-white p-3 d-flex flex-column justify-content-between shrink-0 select-none overflow-y-auto ${
          isMobileSidebarOpen ? 'show' : ''
        }`}
        id="sidebarDrawer"
      >
        <div>
          <div className="d-flex justify-content-between align-items-center mb-4 border-bottom border-white-50 pb-2">
            <div>
              <small className="text-info fw-bold text-uppercase" style={{ fontSize: '0.65rem', color: '#93c5fd' }}>
                Admin Console
              </small>
              <h6 className="fw-bold mb-0 text-white">Housekeeping Ops</h6>
            </div>
            <button
              type="button"
              className="btn text-white p-0 d-md-none bg-transparent border-0 cursor-pointer fs-4 leading-none"
              id="closeSidebarBtn"
              onClick={() => setIsMobileSidebarOpen(false)}
              title="Close Sidebar"
            >
              &times;
            </button>
          </div>

          <nav className="nav flex-column gap-1">
            {/* Live Attendance */}
            {isAdminOrManager ? (
              <button
                type="button"
                id="link-live-attendance"
                onClick={() => {
                  handleNavigateTab('live');
                  setIsMobileSidebarOpen(false);
                }}
                className={`nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full ${
                  activeTab === 'live' ? 'bg-white/15' : ''
                }`}
              >
                <Activity className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                <span>Live Attendance</span>
              </button>
            ) : (
              <div
                className="nav-link text-white-50 disabled-link py-2 px-2.5 rounded d-flex align-items-center justify-content-between"
                style={{ pointerEvents: 'none', opacity: 0.5 }}
              >
                <span className="d-flex align-items-center">
                  <Activity className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Live Attendance</span>
                </span>
                <Lock className="text-warning ms-auto shrink-0" style={{ width: '0.85rem', height: '0.85rem', color: '#f59e0b' }} />
              </div>
            )}

            {/* Admin Staff Table & Vault */}
            {isAdminOrManager ? (
              <button
                type="button"
                id="link-admin-staff-mgmt"
                onClick={() => {
                  handleNavigateTab('admin-staff');
                  setIsMobileSidebarOpen(false);
                }}
                className={`nav-link text-white py-2 px-2.5 rounded d-flex align-items-center justify-content-between cursor-pointer border-0 bg-transparent text-start w-full ${
                  activeTab === 'admin-staff' ? 'bg-white/15' : ''
                }`}
              >
                <span className="d-flex align-items-center">
                  <Users className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Staff &amp; Vault</span>
                </span>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: '0.65rem' }}>
                  {users.length}
                </span>
              </button>
            ) : (
              <div
                className="nav-link text-white-50 disabled-link py-2 px-2.5 rounded d-flex align-items-center justify-content-between"
                style={{ pointerEvents: 'none', opacity: 0.5 }}
              >
                <span className="d-flex align-items-center">
                  <Users className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Staff &amp; Vault</span>
                </span>
                <Lock className="text-warning ms-auto shrink-0" style={{ width: '0.85rem', height: '0.85rem', color: '#f59e0b' }} />
              </div>
            )}

            {/* Pending Approvals Queue */}
            {isAdminOrManager ? (
              <button
                type="button"
                id="link-pending-approvals-queue"
                onClick={() => {
                  handleNavigateTab('pending-approvals');
                  setIsMobileSidebarOpen(false);
                }}
                className={`nav-link text-white py-2 px-2.5 rounded d-flex align-items-center justify-content-between cursor-pointer border-0 bg-transparent text-start w-full ${
                  activeTab === 'pending-approvals' ? 'bg-white/15' : ''
                }`}
              >
                <span className="d-flex align-items-center">
                  <UserCheck className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Approvals Queue</span>
                </span>
                {totalPendingCount > 0 ? (
                  <span className="badge bg-warning text-dark font-bold animate-pulse" style={{ fontSize: '0.65rem' }}>
                    {totalPendingCount} PENDING
                  </span>
                ) : (
                  <span className="badge bg-secondary-subtle text-white-50" style={{ fontSize: '0.6rem' }}>
                    0
                  </span>
                )}
              </button>
            ) : (
              <div
                className="nav-link text-white-50 disabled-link py-2 px-2.5 rounded d-flex align-items-center justify-content-between"
                style={{ pointerEvents: 'none', opacity: 0.5 }}
              >
                <span className="d-flex align-items-center">
                  <UserCheck className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Approvals Queue</span>
                </span>
                <Lock className="text-warning ms-auto shrink-0" style={{ width: '0.85rem', height: '0.85rem', color: '#f59e0b' }} />
              </div>
            )}

            {/* Leaves & Weekly Off Management Tab (All Roles) */}
            <button
              type="button"
              id="link-leave-management"
              onClick={() => {
                handleNavigateTab('leaves');
                setIsMobileSidebarOpen(false);
              }}
              className={`nav-link text-white rounded py-2 px-2.5 d-flex align-items-center justify-content-between cursor-pointer border-0 bg-transparent text-start w-full ${
                activeTab === 'leaves' ? 'bg-white/15 border-l-2 border-cyan-400' : ''
              }`}
            >
              <span className="d-flex align-items-center">
                <CalendarCheck className="me-2 shrink-0 text-cyan-400" style={{ width: '1rem', height: '1rem' }} />
                <span>Leaves &amp; Weekly Off</span>
              </span>
              {pendingLeavesCount > 0 ? (
                <span className="badge bg-warning text-dark font-bold animate-pulse" style={{ fontSize: '0.65rem' }}>
                  {pendingLeavesCount} NEW
                </span>
              ) : (
                <span className="badge bg-info-subtle text-info border border-info-subtle" style={{ fontSize: '0.6rem' }}>
                  LIVE
                </span>
              )}
            </button>

            {/* Punching Kiosk */}
            <button
              type="button"
              id="link-staff-portal"
              onClick={() => {
                handleNavigateTab('portal');
                setIsMobileSidebarOpen(false);
              }}
              className={`nav-link text-white rounded py-2 px-2.5 d-flex align-items-center justify-content-between cursor-pointer border-0 bg-transparent text-start w-full ${
                activeTab === 'portal' ? 'active-kiosk' : ''
              }`}
            >
              <span className="d-flex align-items-center">
                <Clock className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                <span>Punching Kiosk</span>
              </span>
              <span className="badge bg-success" style={{ fontSize: '0.6rem' }}>
                ACTIVE
              </span>
            </button>

            {/* Monthly OT */}
            {isAdminOrManager ? (
              <button
                type="button"
                id="link-monthly-report"
                onClick={() => {
                  handleNavigateTab('monthly');
                  setIsMobileSidebarOpen(false);
                }}
                className={`nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full ${
                  activeTab === 'monthly' ? 'bg-white/15' : ''
                }`}
              >
                <FileSpreadsheet className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                <span>Monthly OT</span>
              </button>
            ) : (
              <div
                className="nav-link text-white-50 disabled-link py-2 px-2.5 rounded d-flex align-items-center justify-content-between"
                style={{ pointerEvents: 'none', opacity: 0.5 }}
              >
                <span className="d-flex align-items-center">
                  <FileSpreadsheet className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Monthly OT</span>
                </span>
                <Lock className="text-warning ms-auto shrink-0" style={{ width: '0.85rem', height: '0.85rem', color: '#f59e0b' }} />
              </div>
            )}

            {/* Admin Dynamic Geofence Configuration & GPS Settings Panel */}
            {isAdminOrManager ? (
              <button
                type="button"
                id="link-geofence-settings"
                onClick={() => {
                  handleNavigateTab('geofence');
                  setIsMobileSidebarOpen(false);
                }}
                className={`nav-link text-white py-2 px-2.5 rounded d-flex align-items-center justify-content-between cursor-pointer border-0 bg-transparent text-start w-full ${
                  activeTab === 'geofence' ? 'bg-white/15 border-l-2 border-amber-400 font-bold' : ''
                }`}
              >
                <span className="d-flex align-items-center">
                  <MapPin className="me-2 shrink-0 text-amber-400" style={{ width: '1rem', height: '1rem' }} />
                  <span>Geofence &amp; GPS</span>
                </span>
                <span className="badge bg-amber-500/20 text-amber-300 border border-amber-500/40" style={{ fontSize: '0.62rem' }}>
                  PERIMETER
                </span>
              </button>
            ) : (
              <div
                className="nav-link text-white-50 disabled-link py-2 px-2.5 rounded d-flex align-items-center justify-content-between"
                style={{ pointerEvents: 'none', opacity: 0.5 }}
              >
                <span className="d-flex align-items-center">
                  <MapPin className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Geofence &amp; GPS</span>
                </span>
                <Lock className="text-warning ms-auto shrink-0" style={{ width: '0.85rem', height: '0.85rem', color: '#f59e0b' }} />
              </div>
            )}

            {/* Admin Password Vault Modal Button */}
            {isAdmin && (
              <button
                type="button"
                id="link-admin-vault-modal"
                onClick={() => {
                  setIsAdminVaultModalOpen(true);
                  setIsMobileSidebarOpen(false);
                }}
                className="nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full hover:bg-white/10"
              >
                <KeyRound className="me-2 shrink-0 text-amber-400" style={{ width: '1rem', height: '1rem' }} />
                <span>Password Vault</span>
              </button>
            )}

            {/* + Request New Staff Modal Button */}
            {isAdminOrManager && (
              <button
                type="button"
                id="link-new-staff-modal"
                onClick={() => {
                  setIsStaffRequestModalOpen(true);
                  setIsMobileSidebarOpen(false);
                }}
                className="nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full hover:bg-white/10"
              >
                <UserPlus className="me-2 shrink-0 text-emerald-400" style={{ width: '1rem', height: '1rem' }} />
                <span>+ Request Staff</span>
              </button>
            )}

            {/* Duty & Shift Assignment: Sirf Admin/Manager ko dikhenge clickable, staff ke liye disabled & locked */}
            {isAdminOrManager ? (
              <button
                type="button"
                id="link-shifts"
                onClick={() => {
                  setIsDutyModalOpen(true);
                  setIsMobileSidebarOpen(false);
                }}
                className="nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full"
              >
                <Compass className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                <span>Duty &amp; Shift Assignment</span>
              </button>
            ) : (
              <div
                className="nav-link text-white-50 disabled-link py-2 px-2.5 rounded d-flex align-items-center justify-content-between"
                style={{ pointerEvents: 'none', opacity: 0.5 }}
              >
                <span className="d-flex align-items-center">
                  <Compass className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Duty &amp; Shift Assignment</span>
                </span>
                <Lock className="text-warning ms-auto shrink-0" style={{ width: '0.85rem', height: '0.85rem', color: '#f59e0b' }} />
              </div>
            )}

            {/* Staff Roster: Sirf Admin/Manager ko dikhenge clickable, staff ke liye disabled & locked */}
            {isAdminOrManager ? (
              <button
                type="button"
                id="link-roster"
                onClick={() => {
                  setIsStaffModalOpen(true);
                  setIsMobileSidebarOpen(false);
                }}
                className="nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full"
              >
                <Users className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                <span>Staff Roster ({staff.length})</span>
              </button>
            ) : (
              <div
                className="nav-link text-white-50 disabled-link py-2 px-2.5 rounded d-flex align-items-center justify-content-between"
                style={{ pointerEvents: 'none', opacity: 0.5 }}
              >
                <span className="d-flex align-items-center">
                  <Users className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Staff Roster</span>
                </span>
                <Lock className="text-warning ms-auto shrink-0" style={{ width: '0.85rem', height: '0.85rem', color: '#f59e0b' }} />
              </div>
            )}

            {/* Punch Log History */}
            <button
              type="button"
              id="link-punch-log-history"
              onClick={() => {
                if (isAdminOrManager) {
                  setIsDutyModalOpen(true);
                } else {
                  handleNavigateTab('portal');
                }
                setIsMobileSidebarOpen(false);
              }}
              className="nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full"
            >
              <History className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
              <span>Punch Log History</span>
            </button>

            {/* Google Sheets Sync (Admin/Manager) */}
            {isAdminOrManager && (
              <button
                type="button"
                id="link-sync-sheets"
                onClick={() => {
                  setIsSheetsModalOpen(true);
                  setIsMobileSidebarOpen(false);
                }}
                className="nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full"
              >
                <FileSpreadsheet className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                <span>Google Sheets Sync</span>
              </button>
            )}

            {/* PDF Document Preview (Admin/Manager) */}
            {isAdminOrManager && (
              <button
                type="button"
                id="link-pdf-preview"
                onClick={() => {
                  setIsPdfPreviewOpen(true);
                  setIsMobileSidebarOpen(false);
                }}
                className="nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full"
              >
                <FileText className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                <span>PDF Document Preview</span>
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar Bottom Profile Badge */}
        <div className="border-top border-light-subtle pt-3 d-flex align-items-center justify-content-between gap-2 mt-4">
          <div className="d-flex align-items-center gap-2 overflow-hidden">
            <div
              className="bg-primary rounded-circle text-center fw-bold text-white shrink-0"
              style={{ width: '34px', height: '34px', lineHeight: '34px', fontSize: '0.875rem' }}
            >
              {userInitial}
            </div>
            <div className="lh-1 overflow-hidden">
              <div className="fw-bold small text-white truncate">{userName}</div>
              <small className="text-white-50 text-uppercase truncate block font-mono" style={{ fontSize: '0.65rem' }}>
                {currentUser?.staff_id ? `${currentUser.staff_id} • ` : ''}
                {isAdmin
                  ? 'ADMIN_OPERATIONS'
                  : isManager
                  ? 'OPERATIONS_MGR'
                  : 'STAFF_USER'}
              </small>
            </div>
          </div>
          <button
            type="button"
            id="btn-sidebar-logout"
            onClick={handleAppLogout}
            title="Kill Session / Logout"
            className="text-white-50 hover:text-rose-400 p-1.5 rounded transition-colors bg-transparent border-0 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA (OPTIMIZED FOR SPACE) */}
      <div className="main-wrapper p-3 sm:p-4 min-h-screen">
        {/* Top Bar for Mobile Menu & Header */}
        <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-slate-200 gap-2 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm d-md-none cursor-pointer"
              id="openSidebarBtn"
              onClick={() => setIsMobileSidebarOpen(true)}
            >
              <Menu className="h-4 w-4 me-1 inline" /> Menu
            </button>
            <div>
              <h5 className="fw-bold mb-0 text-primary font-sans" style={{ color: '#1a3a8a' }}>
                {activeTab === 'monthly'
                  ? 'Attendance Terminal'
                  : activeTab === 'live'
                  ? 'Live Attendance Overview'
                  : activeTab === 'admin-staff'
                  ? 'Staff Management & Password Vault'
                  : activeTab === 'pending-approvals'
                  ? 'Pending Approvals Queue'
                  : activeTab === 'leaves'
                  ? 'Leave & Weekly Off Management'
                  : activeTab === 'geofence'
                  ? 'Hospital Geofence & GPS Configuration'
                  : 'Staff Punch Kiosk'}
              </h5>
              <small className="text-muted font-sans">
                {activeTab === 'monthly'
                  ? `${monthName} ${year} Summary Baseline`
                  : activeTab === 'live'
                  ? `Real-time duty allocations & active OT (${selectedLiveDate})`
                  : activeTab === 'admin-staff'
                  ? 'Manage duty types, assigned departments, shifts, and secure credential vault'
                  : activeTab === 'pending-approvals'
                  ? `Review and authorize staff joining requests, overtime extensions, and new signups (${totalPendingCount} pending)`
                  : activeTab === 'leaves'
                  ? `Shift coverage roster, leave balances, authorizations & assigned off days (${selectedLiveDate})`
                  : activeTab === 'geofence'
                  ? 'Admin dynamic coordinates, Haversine perimeter radius tolerances, and ward boundaries'
                  : 'Self-service PIN or code punching station'}
              </small>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            {/* Month Navigator if monthly tab */}
            {activeTab === 'monthly' && (
              <div className="d-flex align-items-center gap-1 p-1 rounded-md text-xs bg-white border border-slate-200 shadow-xs font-sans text-slate-700">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="px-2 py-0.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer border-0 bg-transparent"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="px-2 font-bold text-xs">
                  {monthName} {year}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="px-2 py-0.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer border-0 bg-transparent"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Single Profile Header Badge */}
            <span className="badge bg-light text-dark border d-flex align-items-center gap-1.5 px-2.5 py-1.5 rounded shadow-2xs font-semibold text-xs">
              <ShieldCheck className="text-success inline" style={{ width: '0.85rem', height: '0.85rem' }} />
              <span>
                {isAdmin
                  ? 'Admin Access'
                  : isManager
                  ? 'Manager Access'
                  : isSupervisor
                  ? 'Supervisor Access'
                  : 'Staff Access'}
              </span>
            </span>
          </div>
        </div>

        {/* Staff Only View (Sirf apna data dekhne ke liye) */}
        {isStaff && (
          <div className="alert alert-info d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3 shadow-xs">
            <div>
              Welcome <strong>{currentUser.name}</strong>! Aaj aapki duty:{' '}
              <span className="fw-semibold">
                {currentUser.assigned_area || currentUser.department || '3rd Floor Wards'}
              </span>.
            </div>
            <span className="badge bg-white text-sky-800 border border-sky-300 font-mono text-xs">
              ID: {currentUser.staff_id || (currentUser.staffId ? `HK-${String(currentUser.staffId).padStart(3, '0')}` : 'HK-001')}
            </span>
          </div>
        )}

        {/* CLEAN HORIZONTAL ACTION BAR (Replaces Space-Wasting Vertical Block) */}
        <div className="custom-card p-2.5 mb-3 shadow-xs">
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <button
              type="button"
              id="btn-export-pdf-bar"
              onClick={handleDownloadPdf}
              className="btn btn-primary btn-sm cursor-pointer"
            >
              <FileText className="me-1 inline" style={{ width: '0.875rem', height: '0.875rem' }} />
              <span>Generate PDF</span>
            </button>

            {/* Google Sheets Export / Sync Button - prominent in the action bar */}
            <button
              type="button"
              id="btn-sync-google-sheets"
              onClick={() => setIsSheetsModalOpen(true)}
              className="btn btn-outline-success btn-sm cursor-pointer d-flex align-items-center gap-1.5 font-medium"
              title="Export or sync current month's attendance data to a Google Sheet"
            >
              <FileSpreadsheet className="inline text-emerald-600" style={{ width: '0.875rem', height: '0.875rem' }} />
              <span>Sync to Google Sheets</span>
            </button>

            {/* Admin Only Buttons (Staff ko nahi dikhega) */}
            {isAdmin && (
              <>
                <button
                  type="button"
                  id="btn-admin-staff-tab"
                  onClick={() => handleNavigateTab('admin-staff')}
                  className={`btn btn-sm cursor-pointer ${
                    activeTab === 'admin-staff' ? 'btn-primary' : 'btn-outline-primary'
                  }`}
                  title="Open Staff Management & Vault Table"
                >
                  <Users className="me-1 inline" style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span>Staff &amp; Vault</span>
                </button>

                <button
                  type="button"
                  id="btn-approvals-bar"
                  onClick={() => handleNavigateTab('pending-approvals')}
                  className={`btn btn-sm cursor-pointer ${
                    totalPendingCount > 0 ? 'btn-warning animate-pulse' : 'btn-outline-secondary'
                  }`}
                  title="View Pending Approvals Queue"
                >
                  <UserCheck className="me-1 inline" style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span>Approvals ({totalPendingCount})</span>
                </button>

                <button
                  type="button"
                  id="btn-open-vault-modal"
                  onClick={() => setIsAdminVaultModalOpen(true)}
                  className="btn btn-outline-dark btn-sm cursor-pointer"
                  title="Open Admin Decrypted Password Vault Modal"
                >
                  <KeyRound className="me-1 inline text-amber-500" style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span>Vault</span>
                </button>

                <button
                  type="button"
                  id="btn-request-staff-bar"
                  onClick={() => setIsStaffRequestModalOpen(true)}
                  className="btn btn-outline-primary btn-sm cursor-pointer"
                  title="Submit New Staff Request to Queue"
                >
                  <Plus className="me-1 inline" style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span>+ Request Staff</span>
                </button>

                <button
                  type="button"
                  id="btn-add-staff-modal"
                  onClick={() => setIsStaffModalOpen(true)}
                  className="btn btn-outline-secondary btn-sm cursor-pointer"
                >
                  <Users className="me-1 inline" style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span>Roster</span>
                </button>

                <button
                  type="button"
                  id="btn-export-csv-bar"
                  onClick={() => setIsSheetsModalOpen(true)}
                  className="btn btn-outline-secondary btn-sm cursor-pointer"
                >
                  <FileSpreadsheet className="me-1 inline" style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span>Export</span>
                </button>

                <button
                  type="button"
                  id="btn-create-staff-bar"
                  onClick={() => setIsRegisterStaffModalOpen(true)}
                  className="btn btn-success btn-sm cursor-pointer"
                >
                  <UserPlus className="me-1 inline" style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span>Create Account</span>
                </button>

                <button
                  type="button"
                  id="btn-kill-session-bar"
                  onClick={handleAppLogout}
                  className="btn btn-danger btn-sm ms-auto cursor-pointer"
                >
                  <Power className="me-1 inline" style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span>Logout</span>
                </button>
              </>
            )}

            {/* Manager Only Actions */}
            {currentUser?.role === 'manager' && (
              <>
                <button
                  type="button"
                  id="btn-open-roster-bar-mgr"
                  onClick={() => setIsStaffModalOpen(true)}
                  className="btn btn-outline-secondary btn-sm cursor-pointer"
                >
                  <Users className="me-1 inline" style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span>Staff Roster</span>
                </button>
                <button
                  type="button"
                  id="btn-kill-session-bar-mgr"
                  onClick={handleAppLogout}
                  className="btn btn-outline-danger btn-sm ms-auto cursor-pointer"
                >
                  <Power className="me-1 inline" style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span>Logout</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stat Row */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-3">
          <div className="p-3 sm:p-4 border transition-all bg-white border-slate-200 rounded-lg border-l-4 border-l-blue-600 shadow-xs">
            <span className="text-2xs uppercase tracking-widest block font-bold truncate text-blue-700">
              Presence
            </span>
            <div className="text-lg sm:text-2xl font-bold mt-1 truncate text-slate-900 font-sans">
              {aggregatePresentDays}/{totalPossibleDays}
            </div>
          </div>

          <div className="p-3 sm:p-4 border transition-all bg-white border-slate-200 rounded-lg border-l-4 border-l-emerald-600 shadow-xs">
            <span className="text-2xs uppercase tracking-widest block font-bold truncate text-emerald-700">
              Regular Hours
            </span>
            <div className="text-lg sm:text-2xl font-bold mt-1 truncate text-slate-900 font-sans">
              {totalRegularHours.toFixed(1)}h
            </div>
          </div>

          <div className="p-3 sm:p-4 border transition-all bg-white border-slate-200 rounded-lg border-l-4 border-l-amber-500 shadow-xs">
            <span className="text-2xs uppercase tracking-widest block font-bold truncate text-amber-700">
              Overtime (OT)
            </span>
            <div className="text-lg sm:text-2xl font-bold mt-1 truncate text-amber-600 font-sans">
              {totalOtHours.toFixed(1)}h
            </div>
          </div>
        </div>

        {/* DATA TABLE SECTION / FULL WIDTH ACTIVE VIEW */}
        <div className="custom-card p-3 shadow-xs">
          {activeTab === 'monthly' ? (
            <ReportTable
              summaryData={summaryData}
              monthName={monthName}
              year={year}
              month={month}
              onSelectStaff={handleSelectStaffRow}
              onSyncGoogleSheets={() => setIsSheetsModalOpen(true)}
            />
          ) : activeTab === 'admin-staff' ? (
            /* Dedicated Admin Staff Table & Vault */
            <AdminStaffTable
              users={users}
              currentUserRole={userRole}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onOpenAddUser={() => setIsRegisterStaffModalOpen(true)}
              onOpenVaultModal={() => setIsAdminVaultModalOpen(true)}
              onOpenPendingApprovals={() => handleNavigateTab('pending-approvals')}
              pendingCount={totalPendingCount}
              onOpenProfileModal={(staffId) => setProfileModalStaffId(staffId)}
            />
          ) : activeTab === 'pending-approvals' ? (
            /* Dedicated Pending Approvals Queue View */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-50/70 border border-amber-200 rounded-xl">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-amber-600" />
                    <span>Pending Approvals Queue ({totalPendingCount})</span>
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Authorize staff candidate requests, overtime extensions, and self-registration signups.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsStaffRequestModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>+ New Staff Request</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPendingModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    <span>Open Modal View</span>
                  </button>
                </div>
              </div>

              {/* Three-column card queue overview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 1. Staff Joining Requests */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <UserPlus className="h-4 w-4 text-blue-600" />
                      <span>Staff Joining ({pendingStaffRequests.length})</span>
                    </span>
                    <span className="badge bg-blue-100 text-blue-800 text-2xs">Joining Queue</span>
                  </div>
                  {pendingStaffRequests.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No pending staff requests.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                      {pendingStaffRequests.map((req) => (
                        <div key={req.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-xs text-slate-900">{req.candidate_name}</div>
                              <div className="text-2xs text-slate-500">By: {req.requested_by}</div>
                            </div>
                            <span className="badge bg-amber-100 text-amber-800 text-2xs">PENDING</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-2xs text-slate-600">
                            <span className="px-1.5 py-0.5 bg-white border rounded">{req.proposed_area}</span>
                            <span className="px-1.5 py-0.5 bg-white border rounded">{req.proposed_shift}</span>
                          </div>
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleApproveStaffRequest(req.id)}
                              className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-2xs font-bold cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectStaffRequest(req.id)}
                              className="px-3 py-1 bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 rounded text-2xs font-semibold cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Overtime (OT) Requests */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span>Overtime (OT) ({pendingOtRequests.length})</span>
                    </span>
                    <span className="badge bg-amber-100 text-amber-800 text-2xs">OT Queue</span>
                  </div>
                  {pendingOtRequests.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No pending overtime requests.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                      {pendingOtRequests.map((ot) => (
                        <div key={ot.id} className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-xs text-slate-900 font-mono">{ot.staff_id}</div>
                              <div className="text-2xs text-slate-500">
                                {ot.date} • {ot.assigned_department}
                              </div>
                            </div>
                            <span className="font-bold text-amber-700 text-xs">+{ot.ot_requested_hours}h OT</span>
                          </div>
                          <div className="text-2xs text-slate-500">
                            Requested by: {ot.assigned_by_supervisor || 'Supervisor'}
                          </div>
                          <div className="flex items-center gap-2 pt-1 border-t border-amber-200">
                            <button
                              type="button"
                              onClick={() => handleApproveOtRequest(ot.id)}
                              className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-2xs font-bold cursor-pointer"
                            >
                              Approve OT
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectOtRequest(ot.id)}
                              className="px-3 py-1 bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 rounded text-2xs font-semibold cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. User Signups */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-purple-600" />
                      <span>User Signups ({pendingUsers.length})</span>
                    </span>
                    <span className="badge bg-purple-100 text-purple-800 text-2xs">Signups Queue</span>
                  </div>
                  {pendingUsers.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No pending user registrations.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                      {pendingUsers.map((pu) => (
                        <div key={pu.id} className="p-3 bg-purple-50/40 border border-purple-200 rounded-lg space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-xs text-slate-900">{pu.name}</div>
                              <div className="text-2xs text-slate-500 font-mono">Username: {pu.username || pu.staff_id}</div>
                            </div>
                            <span className="badge bg-amber-100 text-amber-800 text-2xs">PENDING</span>
                          </div>
                          <div className="flex items-center gap-2 pt-1 border-t border-purple-200">
                            <button
                              type="button"
                              onClick={() => handleApproveUser(pu.id, 'staff', 'General Wards')}
                              className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-2xs font-bold cursor-pointer"
                            >
                              Approve Staff
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'leaves' ? (
            /* Role-Based Leave and Weekly Off Management System */
            <LeaveManagementView
              currentUser={currentUser}
              selectedDate={selectedLiveDate}
              selectedSite="site-main"
              sites={HOSPITAL_SITES}
              onOpenDutyModal={() => handleOpenAssignModal()}
            />
          ) : activeTab === 'geofence' ? (
            /* Admin Dynamic Geofence Configuration & GPS Settings Panel */
            isAdminOrManager ? (
              <GeofenceSettingsPanel
                currentUsername={currentUser?.name || currentUser?.username || 'Admin'}
                onSavedNotification={(msg) => addFlash(msg, 'success')}
              />
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 shadow-sm max-w-md mx-auto my-8">
                <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800 mb-1">Access Restricted (@admin_required)</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Admin or Manager authorization required to modify hospital geofence coordinates and boundary tolerances.
                </p>
                <button
                  type="button"
                  onClick={handleAppLogout}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
                >
                  Return to Login
                </button>
              </div>
            )
          ) : activeTab === 'live' ? (
            /* @app.route('/admin/dashboard') protected by @admin_required */
            (isAdminOrManager || isSupervisor) ? (
              <LiveAttendanceView
                selectedDate={selectedLiveDate}
                onDateChange={setSelectedLiveDate}
                staff={visibleStaff}
                records={records}
                onOpenAssignModal={handleOpenAssignModal}
                onOpenPunchPortal={(staffId) => {
                  setPunchPortalStaffId(staffId || 1);
                  setIsPunchPortalModalOpen(true);
                }}
                onOpenAddUser={() => setIsRegisterStaffModalOpen(true)}
                pendingUsersCount={totalPendingCount}
                onOpenPendingApprovalModal={() => setIsPendingModalOpen(true)}
                currentUserRole={userRole}
                currentUserId={currentUser?.username || String(currentUser?.id || 'supervisor')}
                onOpenProfileModal={(staffId) => setProfileModalStaffId(staffId)}
              />
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 shadow-sm max-w-md mx-auto my-8">
                <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800 mb-1">Access Restricted (@admin_required)</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Admin or Manager authorization required. Unauthorized attempts are redirected to login.
                </p>
                <button
                  type="button"
                  onClick={handleAppLogout}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition-colors"
                >
                  Redirect to Login
                </button>
              </div>
            )
          ) : (
            <div className="p-3 sm:p-6 flex justify-center">
              <div className="w-full max-w-[460px]">
                <StaffPunchPortal
                  staff={visibleStaff}
                  records={records}
                  selectedDate={selectedLiveDate}
                  initialStaffId={currentUser?.staffId || punchPortalStaffId}
                  currentUser={currentUser}
                  onSaveRecord={handleSavePunchRecord}
                  onFlash={addFlash}
                  onBackToAdmin={() => handleNavigateTab('live')}
                  onLogout={handleAppLogout}
                  onUnauthorizedAttempt={() => handleNavigateTab('live')}
                />
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Duty & Shift Assignment Modal */}
      <DutyAssignmentModal
        isOpen={isDutyModalOpen}
        onClose={() => {
          setIsDutyModalOpen(false);
          setDutyModalStaffId(null);
        }}
        staff={staff}
        selectedDate={selectedLiveDate}
        initialStaffId={dutyModalStaffId}
        onSaveAssignment={handleSaveDutyAssignment}
      />

      {/* Google Sheets Modal */}
      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        monthName={monthName}
        summaryData={summaryData}
        users={staff}
        attendanceRecords={records.filter((r) =>
          r.date.startsWith(`${year}-${month.toString().padStart(2, '0')}`)
        )}
        currentUserEmail={googleUserEmail}
        onLoginSuccess={(email) => setGoogleUserEmail(email)}
      />

      {/* Daily Punch Records Modal */}
      <DailyAttendanceModal
        isOpen={isPunchModalOpen}
        onClose={() => {
          setIsPunchModalOpen(false);
          setSelectedStaffForPunch(null);
        }}
        staff={staff}
        records={records}
        selectedStaffId={selectedStaffForPunch}
        currentYear={year}
        currentMonth={month}
        monthName={monthName}
        currentUser={currentUser}
        onSaveRecord={handleSavePunchRecord}
        onDeleteRecord={handleDeletePunchRecord}
        onFlash={addFlash}
      />

      {/* Staff Management Modal */}
      <StaffManagementModal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        staff={staff}
        users={users}
        currentUserRole={userRole}
        onAddStaff={handleAddStaffMember}
        onToggleActive={handleToggleStaffActive}
        onViewCredentialSlip={(slip) => setActiveCredentialSlip(slip)}
      />

      {/* PDF Landscape Preview Modal */}
      <PdfPreviewModal
        isOpen={isPdfPreviewOpen}
        onClose={() => setIsPdfPreviewOpen(false)}
        year={year}
        month={month}
        monthName={monthName}
        summaryData={summaryData}
        onDownloadPdf={handleDownloadPdf}
      />

      {/* Staff Punching Portal Modal */}
      <StaffPunchPortalModal
        isOpen={isPunchPortalModalOpen}
        onClose={() => setIsPunchPortalModalOpen(false)}
        staff={staff}
        records={records}
        selectedDate={selectedLiveDate}
        initialStaffId={currentUser?.staffId || punchPortalStaffId}
        currentUser={currentUser}
        onSaveRecord={handleSavePunchRecord}
        onFlash={addFlash}
      />

      {/* Admin Only: New Staff Account Creator (No Public Signup) - POST /admin/create_staff_account */}
      <RegisterStaffModal
        isOpen={isRegisterStaffModalOpen}
        onClose={() => setIsRegisterStaffModalOpen(false)}
        currentUserRole={userRole}
        onStaffAccountCreated={(slip) => setActiveCredentialSlip(slip)}
        onRegister={handleCreateStaffAccount}
      />

      {/* Admin Approval Modal matching POST /admin/approve_user/<id> & Staff Requests & Overtime */}
      <PendingApprovalModal
        isOpen={isPendingModalOpen}
        onClose={() => setIsPendingModalOpen(false)}
        pendingUsers={pendingUsers}
        onApproveUser={handleApproveUser}
        currentUserRole={userRole}
        staffRequests={staffRequests}
        onApproveStaffRequest={handleApproveStaffRequest}
        onRejectStaffRequest={handleRejectStaffRequest}
        dutyAllocations={dutyAllocations}
        onApproveOtRequest={handleApproveOtRequest}
        onRejectOtRequest={handleRejectOtRequest}
        onOpenNewStaffRequest={() => setIsStaffRequestModalOpen(true)}
      />

      {/* Admin Decrypted Password Vault Terminal Modal */}
      <AdminVaultModal
        isOpen={isAdminVaultModalOpen}
        onClose={() => setIsAdminVaultModalOpen(false)}
        users={users}
        currentUserRole={userRole}
        onUpdateUserStatus={handleUpdateUserStatus}
        onDeleteUser={handleDeleteUser}
      />

      {/* Staff Joining Request Modal (Supervisor / Admin Queue Submission) */}
      <StaffRequestModal
        isOpen={isStaffRequestModalOpen}
        onClose={() => setIsStaffRequestModalOpen(false)}
        currentUserStaffId={currentUser?.staff_id || 'ADMIN-001'}
        onSubmitRequest={handleCreateStaffRequest}
      />

      {/* Official HK Ops Login Credential Card Slip Modal */}
      <CredentialCardModal
        isOpen={Boolean(activeCredentialSlip)}
        onClose={() => setActiveCredentialSlip(null)}
        data={activeCredentialSlip}
      />

      {/* Employee Profile, Quick Actions & Duty Assignment Modal */}
      <EmployeeProfileModal
        staffId={profileModalStaffId}
        onClose={() => setProfileModalStaffId(null)}
        userRole={userRole === 'admin' ? 'admin' : userRole === 'manager' ? 'manager' : 'supervisor'}
        selectedDate={selectedLiveDate}
        onActionComplete={() => {
          setUsers(getStoredUsers());
          setStaff(getStoredStaff());
          setRecords(getStoredAttendance());
          setDutyAllocations(getStoredDutyAllocations());
        }}
      />

      {/* System Terminal Info Modal (?) */}
      {isSystemInfoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-mono text-left animate-in fade-in"
          onClick={() => setIsSystemInfoOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[#151517] border border-white/20 rounded-lg p-6 space-y-4 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-[#00FF9C]" />
                <h3 className="font-display font-extrabold uppercase text-lg text-white">
                  HK Ops System Architecture
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSystemInfoOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs space-y-2.5 text-white/70">
              <p>
                <span className="text-[#00FF9C] font-bold">&gt; Backend Framework:</span> Flask + Flask-Login + SQLAlchemy
              </p>
              <p>
                <span className="text-[#00FF9C] font-bold">&gt; Database:</span> <code>sqlite:///housekeeping_secure.db</code>
              </p>
              <p>
                <span className="text-[#00FF9C] font-bold">&gt; Secret Key:</span> <code>app.config['SECRET_KEY'] = 'hk_secure_key_2026'</code>
              </p>
              <p>
                <span className="text-[#00FF9C] font-bold">&gt; User Model:</span> <code>User(username, name, role='staff', assigned_area='General Ward')</code>
              </p>
              <p>
                <span className="text-[#00FF9C] font-bold">&gt; Route 1 - Universal Login:</span> <code>/login</code> (Role auto-redirect to <code>admin_dashboard</code> or <code>staff_portal</code>)
              </p>
              <p>
                <span className="text-[#00FF9C] font-bold">&gt; Route 2 - Staff Creator:</span> <code>POST /admin/create_staff_account</code> (Admin-only, No Public Signup)
              </p>
              <p>
                <span className="text-[#00FF9C] font-bold">&gt; Overtime Policy:</span> &gt; 8.0 baseline hours per punch record
              </p>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSystemInfoOpen(false)}
                className="px-4 py-1.5 bg-[#00FF9C] text-[#0D0D0E] font-bold rounded text-xs uppercase"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
