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
  History,
} from 'lucide-react';
import type { StaffUser, AttendanceRecord, MonthlyStaffSummary, AppUser, FlashMessage, UserRole } from '../types';
import {
  getStoredStaff,
  saveStoredStaff,
  getStoredAttendance,
  saveStoredAttendance,
  getStoredUsers,
  saveStoredUsers,
  getStoredCurrentUser,
  saveStoredCurrentUser,
} from '../data/mockHousekeepingData';
import { initAuth, logout } from '../services/firebase';
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
import { LoginView } from './LoginView';
import { RegisterStaffModal } from './RegisterStaffModal';
import { PendingApprovalModal } from './PendingApprovalModal';
import { CredentialCardModal, type CredentialCardData } from './CredentialCardModal';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import ProtectedRoute from './ProtectedRoute';
import { UnauthorizedPage } from './UnauthorizedPage';

export interface DashboardPageProps {
  defaultTab?: 'live' | 'monthly' | 'portal';
}

export function DashboardPage({ defaultTab }: DashboardPageProps = {}) {
  const navigate = useNavigate();
  // Current monthly report period
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(9);

  // Live overview date (defaults to 2026-09-06)
  const [selectedLiveDate, setSelectedLiveDate] = useState<string>('2026-09-06');

  // App Authentication Users & Current User (matching Flask User & Flask-Login)
  const [users, setUsers] = useState<AppUser[]>(() => getStoredUsers());
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const stored = getStoredCurrentUser();
    if (stored) return stored;
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      const allUsers = getStoredUsers();
      const matched = allUsers.find(
        (u) =>
          u.username.toLowerCase() === storedUserId.toLowerCase() ||
          (u.staff_id && u.staff_id.toLowerCase().replace(/[-_\s]/g, '') === storedUserId.toLowerCase().replace(/[-_\s]/g, ''))
      );
      if (matched) {
        saveStoredCurrentUser(matched);
        return matched;
      }
    }
    return null;
  });

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

  // Navigation tab: 'live' (Live Attendance A), 'monthly' (Monthly Reports R), or 'portal' (Staff Punch P)
  const [activeTab, setActiveTab] = useState<'live' | 'monthly' | 'portal'>(() => {
    if (defaultTab) return defaultTab;
    const user = getStoredCurrentUser();
    if (user?.role === 'staff') return 'portal';
    return 'monthly';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Staff and Attendance Records State
  const [staff, setStaff] = useState<StaffUser[]>(() => getStoredStaff());
  const [records, setRecords] = useState<AttendanceRecord[]>(() => getStoredAttendance());

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
  const [isSystemInfoOpen, setIsSystemInfoOpen] = useState(false);
  const [activeCredentialSlip, setActiveCredentialSlip] = useState<CredentialCardData | null>(null);

  // Pending user approvals (is_approved === false)
  const pendingUsers = useMemo(() => users.filter((u) => u.is_approved === false), [users]);

  // Role Access Checker
  const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  // Listen for Firebase Auth & URL routes on load
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
      if (pathname === '/admin/dashboard' || pathname === '/admin') {
        const check = checkAdminRequired(currentUser);
        if (!check.authorized) {
          // Unauthorized attempt -> Redirect to login
          window.history.replaceState({}, '', '/login');
          if (currentUser) {
            addFlash('Unauthorized attempt: Admin privileges required. Redirected to login.', 'danger');
            handleAppLogout();
          }
          return;
        }
        // Authorized: open admin dashboard
        setActiveTab('live');
      }
    };

    handleRouteInspection();
    window.addEventListener('popstate', handleRouteInspection);

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = initAuth(
        (user) => {
          if (user?.email) {
            setGoogleUserEmail(user.email);
          }
        },
        () => {
          setGoogleUserEmail(null);
        }
      );
    } catch (e) {
      console.warn('Notice: Auth listener could not be registered:', e);
    }
    return () => {
      if (typeof unsubscribe === 'function') {
        try {
          unsubscribe();
        } catch {
          // ignore cleanup
        }
      }
    };
  }, []);

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
    if (currentUser?.role !== 'admin') {
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
        role: 'staff',
        password: 'staff123',
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
    setCurrentUser(user);

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

    // Strict Role Redirection:
    // if user.role == 'admin': redirect(url_for('admin_dashboard')) -> /admin/dashboard
    // else: redirect(url_for('staff_portal'))
    if (user.role === 'admin') {
      setActiveTab('live');
      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState({}, '', '/admin/dashboard');
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
    // Local Tokens Wipe Out
    try {
      localStorage.removeItem("userToken");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userId");
      localStorage.removeItem("user_token");
      localStorage.removeItem("user_role");
      sessionStorage.clear();
    } catch (e) {
      console.warn("Storage wipe warning:", e);
    }

    await performLogout();
    setCurrentUser(null);
    addFlash('Aap safaltapurvak logout ho gaye hain.', 'info');
    navigate('/');
  };

  // Role Access Control Decorator: @admin_required & @role_required
  const handleNavigateTab = (targetTab: 'live' | 'monthly' | 'portal') => {
    if (!currentUser) {
      handleAppLogout();
      return;
    }

    // Admin Dashboard: @app.route('/admin/dashboard') protected by @admin_required
    if (targetTab === 'live') {
      const check = checkAdminRequired(currentUser);
      if (!check.authorized) {
        // Unauthorized attempt -> Redirect to login
        addFlash('Unauthorized attempt: Admin privileges required. Redirected to /login.', 'danger');
        handleAppLogout();
        return;
      }
      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState({}, '', '/admin/dashboard');
      }
    } else if (targetTab === 'monthly') {
      const allowedRoles: UserRole[] = ['admin', 'manager'];
      if (!allowedRoles.includes(currentUser.role)) {
        addFlash('Aapko is section ko access karne ki permission nahi hai.', 'danger');
        if (currentUser.role === 'staff') {
          setActiveTab('portal');
        }
        return;
      }
    }

    setActiveTab(targetTab);
    setIsMobileSidebarOpen(false);
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
      password: data.password,
      role: 'staff',
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
    if (currentUser?.role !== 'admin') {
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
  }): { success: boolean; message: string; status?: number } => {
    // Strict Guard Check
    if (currentUser?.role !== 'admin') {
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

    const newAppUser: AppUser = {
      id: newUserId,
      staff_id: chosenStaffId,
      username: chosenStaffId,
      password: data.password.trim(),
      name: data.name.trim(),
      role: data.role || 'staff',
      is_approved: true,
      assigned_area: area,
      department: area,
      staffId: data.role === 'staff' ? newStaffId : undefined,
    };

    const updatedUsers = [...users, newAppUser];
    setUsers(updatedUsers);
    saveStoredUsers(updatedUsers);

    if (data.role === 'staff') {
      const newStaffUser: StaffUser = {
        id: newStaffId,
        staffCode: chosenStaffId.toUpperCase().startsWith('HK-')
          ? chosenStaffId.toUpperCase()
          : `HK-${newStaffId.toString().padStart(3, '0')}`,
        name: data.name.trim(),
        role: 'staff',
        department: area,
        shift: 'Morning',
        hourlyRate: 15,
        active: true,
      };
      const updatedStaff = [...staff, newStaffUser];
      setStaff(updatedStaff);
      saveStoredStaff(updatedStaff);
    }

    const successMsg = `Staff Account (${data.name.trim()}) ready hai! Staff ID: ${chosenStaffId}`;
    addFlash(successMsg, 'success');
    return { success: true, message: successMsg };
  };

  const userInitial = currentUser ? currentUser.name.charAt(0).toUpperCase() : 'U';
  const userName = currentUser ? currentUser.name : 'Guest User';

  // If not authenticated, redirect to login page (/)
  if (!currentUser) {
    return <Navigate to="/" replace />;
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
                {currentUser?.role === 'admin'
                  ? 'ADMIN_OPERATIONS'
                  : currentUser?.role === 'manager'
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
                  : 'Staff Punch Kiosk'}
              </h5>
              <small className="text-muted font-sans">
                {activeTab === 'monthly'
                  ? `${monthName} ${year} Summary Baseline`
                  : activeTab === 'live'
                  ? `Real-time duty allocations & active OT (${selectedLiveDate})`
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
                {currentUser?.role === 'admin'
                  ? 'Admin Access'
                  : currentUser?.role === 'manager'
                  ? 'Manager Access'
                  : 'Staff Access'}
              </span>
            </span>
          </div>
        </div>

        {/* Staff Only View (Sirf apna data dekhne ke liye) */}
        {currentUser?.role === 'staff' && (
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

            {/* Admin Only Buttons (Staff ko nahi dikhega) */}
            {currentUser?.role === 'admin' && (
              <>
                <button
                  type="button"
                  id="btn-add-staff-modal"
                  onClick={() => setIsStaffModalOpen(true)}
                  className="btn btn-primary btn-sm cursor-pointer"
                >
                  <Plus className="me-1 inline" style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span>+ Add Staff</span>
                </button>

                <button
                  type="button"
                  id="btn-export-csv-bar"
                  onClick={() => setIsSheetsModalOpen(true)}
                  className="btn btn-outline-secondary btn-sm cursor-pointer"
                >
                  <FileSpreadsheet className="me-1 inline" style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  id="btn-open-roster-bar"
                  onClick={() => setIsStaffModalOpen(true)}
                  className="btn btn-outline-secondary btn-sm cursor-pointer"
                >
                  <Users className="me-1 inline" style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span>Staff Roster</span>
                </button>

                <button
                  type="button"
                  id="btn-create-staff-bar"
                  onClick={() => setIsRegisterStaffModalOpen(true)}
                  className="btn btn-success btn-sm cursor-pointer"
                >
                  <UserPlus className="me-1 inline" style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span>Create Staff Account</span>
                </button>

                {pendingUsers.length > 0 && (
                  <button
                    type="button"
                    id="btn-approvals-bar"
                    onClick={() => setIsPendingModalOpen(true)}
                    className="btn btn-warning btn-sm cursor-pointer animate-pulse"
                  >
                    <UserCheck className="me-1 inline" style={{ width: '0.875rem', height: '0.875rem' }} />
                    <span>Approvals ({pendingUsers.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  id="btn-kill-session-bar"
                  onClick={handleAppLogout}
                  className="btn btn-danger btn-sm ms-auto cursor-pointer"
                >
                  <Power className="me-1 inline" style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span>Kill Session</span>
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
            />
          ) : activeTab === 'live' ? (
            /* @app.route('/admin/dashboard') protected by @admin_required */
            currentUser?.role === 'admin' ? (
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
                pendingUsersCount={pendingUsers.length}
                onOpenPendingApprovalModal={() => setIsPendingModalOpen(true)}
                currentUserRole={currentUser?.role}
              />
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 shadow-sm max-w-md mx-auto my-8">
                <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800 mb-1">Access Restricted (@admin_required)</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Admin authorization required. Unauthorized attempts are redirected to login.
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
        currentUserRole={currentUser?.role}
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
        currentUserRole={currentUser?.role}
        onStaffAccountCreated={(slip) => setActiveCredentialSlip(slip)}
        onRegister={handleCreateStaffAccount}
      />

      {/* Admin Approval Modal matching POST /admin/approve_user/<id> */}
      <PendingApprovalModal
        isOpen={isPendingModalOpen}
        onClose={() => setIsPendingModalOpen(false)}
        pendingUsers={pendingUsers}
        onApproveUser={handleApproveUser}
        currentUserRole={currentUser?.role}
      />

      {/* Official HK Ops Login Credential Card Slip Modal */}
      <CredentialCardModal
        isOpen={Boolean(activeCredentialSlip)}
        onClose={() => setActiveCredentialSlip(null)}
        data={activeCredentialSlip}
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
