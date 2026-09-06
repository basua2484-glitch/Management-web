import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  FileSpreadsheet,
  PlusCircle,
  Users,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  FileText,
  Clock,
  Activity,
  LogOut,
  Building,
  UserCheck,
  Plus,
  Shield,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Lock,
  BookOpen
} from 'lucide-react';
import type { StaffUser, AttendanceRecord, MonthlyStaffSummary, AppUser, FlashMessage, UserRole } from './types';
import {
  getStoredStaff,
  saveStoredStaff,
  getStoredAttendance,
  saveStoredAttendance,
  getStoredUsers,
  saveStoredUsers,
  getStoredCurrentUser,
  saveStoredCurrentUser,
} from './data/mockHousekeepingData';
import { initAuth, logout } from './services/firebase';
import { downloadMonthlyReportPdf } from './services/pdfGenerator';
import { ReportTable } from './components/ReportTable';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { DailyAttendanceModal } from './components/DailyAttendanceModal';
import { StaffManagementModal } from './components/StaffManagementModal';
import { PdfPreviewModal } from './components/PdfPreviewModal';
import { LiveAttendanceView } from './components/LiveAttendanceView';
import { DutyAssignmentModal } from './components/DutyAssignmentModal';
import { StaffPunchPortal } from './components/StaffPunchPortal';
import { StaffPunchPortalModal } from './components/StaffPunchPortalModal';
import { LoginView } from './components/LoginView';
import { RegisterStaffModal } from './components/RegisterStaffModal';

export default function App() {
  // Current monthly report period
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(9);

  // Live overview date (defaults to 2026-09-06 matching user template)
  const [selectedLiveDate, setSelectedLiveDate] = useState<string>('2026-09-06');

  // App Authentication Users & Current User (matching Flask User & Flask-Login)
  const [users, setUsers] = useState<AppUser[]>(() => getStoredUsers());
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getStoredCurrentUser());

  const isAdminOrManager = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'admin' || currentUser.role === 'manager';
  }, [currentUser]);

  // Flask Flash Messages Queue
  const [flashes, setFlashes] = useState<FlashMessage[]>([]);

  const addFlash = (message: string, type: 'danger' | 'warning' | 'success' | 'info' = 'info') => {
    const id = `flash_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    setFlashes((prev) => [...prev, { id, message, type }]);
    // Auto remove after 5.5 seconds
    setTimeout(() => {
      setFlashes((prev) => prev.filter((f) => f.id !== id));
    }, 5500);
  };

  const removeFlash = (id: string) => {
    setFlashes((prev) => prev.filter((f) => f.id !== id));
  };

  // Navigation tab: 'live' (Live Daily Ops), 'monthly' (Monthly Report & PDF/Sheets), or 'portal' (Staff Punching Kiosk)
  const [activeTab, setActiveTab] = useState<'live' | 'monthly' | 'portal'>(() => {
    const user = getStoredCurrentUser();
    if (user?.role === 'staff') return 'portal';
    return 'live';
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

  // Listen for Firebase Auth on load
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        if (user?.email) {
          setGoogleUserEmail(user.email);
        }
      },
      () => {
        setGoogleUserEmail(null);
      }
    );
    return () => unsubscribe();
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

  // Aggregate monthly data matching Python ReportLab backend formula
  const summaryData = useMemo<MonthlyStaffSummary[]>(() => {
    const monthPrefix = `${year}-${month.toString().padStart(2, '0')}`;

    return staff
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
  }, [staff, records, year, month]);

  // Totals for the Geometric Balance metric cards
  const aggregatePresentDays = summaryData.reduce((acc, s) => acc + s.daysPresent, 0);
  const totalRegularHours = summaryData.reduce((acc, s) => acc + s.totalRegHours, 0);
  const totalOtHours = summaryData.reduce((acc, s) => acc + s.totalOtHours, 0);
  const totalPossibleDays = summaryData.length * daysInMonth;

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

  // Download PDF matching Python ReportLab code
  const handleDownloadPdf = () => {
    downloadMonthlyReportPdf({
      year,
      month,
      monthName,
      summaryData,
    });
  };

  const openPunchLogModal = () => {
    setSelectedStaffForPunch(null);
    setIsPunchModalOpen(true);
    setIsMobileSidebarOpen(false);
  };

  useEffect(() => {
    (window as any).openPunchLogModal = openPunchLogModal;
    return () => {
      delete (window as any).openPunchLogModal;
    };
  }, []);

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

  // Save duty & shift assignment from DutyAssignmentModal
  const handleSaveDutyAssignment = (record: AttendanceRecord, updatedDutyArea?: string) => {
    handleSavePunchRecord(record);

    // If duty area provided, also update staff's department/role notes if needed
    if (updatedDutyArea) {
      const updatedStaff = staff.map((s) => {
        if (s.id === record.userId && !s.department) {
          return { ...s, department: updatedDutyArea };
        }
        return s;
      });
      handleSaveStaff(updatedStaff);
    }
  };

  const handleDeletePunchRecord = (recordId: string) => {
    const updated = records.filter((r) => r.id !== recordId);
    handleSaveRecords(updated);
  };

  const handleAddStaffMember = (newStaffData: Omit<StaffUser, 'id' | 'staffCode'>) => {
    const newId = staff.length > 0 ? Math.max(...staff.map((s) => s.id)) + 1 : 1;
    const newCode = `HK-${newId.toString().padStart(3, '0')}`;
    const newMember: StaffUser = {
      ...newStaffData,
      id: newId,
      staffCode: newCode,
    };
    handleSaveStaff([...staff, newMember]);
  };

  const handleToggleStaffActive = (staffId: number) => {
    const updated = staff.map((s) =>
      s.id === staffId ? { ...s, active: !s.active } : s
    );
    handleSaveStaff(updated);
  };

  const handleOpenAssignModal = (staffId?: number) => {
    setDutyModalStaffId(staffId || null);
    setIsDutyModalOpen(true);
  };

  const handleLogout = async () => {
    await logout();
    setGoogleUserEmail(null);
  };

  // Flask Authentication Handlers
  const handleAppLogin = (user: AppUser) => {
    saveStoredCurrentUser(user);
    setCurrentUser(user);
    // Flask redirection: if user.role in ['admin', 'manager']: redirect to admin_dashboard
    if (user.role === 'admin' || user.role === 'manager') {
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

  const handleAppLogout = () => {
    saveStoredCurrentUser(null);
    setCurrentUser(null);
    addFlash('Aap safaltapurvak logout ho gaye hain.', 'info');
  };

  // Role Access Control Decorator logic: role_required
  const handleNavigateTab = (targetTab: 'live' | 'monthly' | 'portal') => {
    if (!currentUser) {
      setCurrentUser(null);
      return;
    }

    // Admin / Manager Dashboard: @role_required(['admin', 'manager'])
    if (targetTab === 'live' || targetTab === 'monthly') {
      const allowedRoles: UserRole[] = ['admin', 'manager'];
      if (!allowedRoles.includes(currentUser.role)) {
        // Exact flash: "Aapko is page ko access karne ki anumati nahi hai." ("danger")
        addFlash('Aapko is page ko access karne ki anumati nahi hai.', 'danger');
        // Redirect to respective home
        if (currentUser.role === 'staff') {
          setActiveTab('portal');
        } else {
          setActiveTab('live');
        }
        return;
      }
    }

    // Staff portal: @role_required(['staff', 'admin', 'manager'])
    setActiveTab(targetTab);
    setIsMobileSidebarOpen(false);
  };

  // Route: /admin/add_user (Admin Only)
  const handleAddUser = (data: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
    department: string;
    shift: 'Morning' | 'Evening' | 'Night';
  }): { success: boolean; message: string } => {
    // @role_required(['admin'])
    if (currentUser?.role !== 'admin') {
      const msg = 'Aapko is page ko access karne ki anumati nahi hai.';
      addFlash(msg, 'danger');
      return { success: false, message: msg };
    }

    // Check if username already exists: flash("Username pehle se exist karta hai!", "warning")
    const existing = users.find(
      (u) => u.username.toLowerCase().trim() === data.username.toLowerCase().trim()
    );
    if (existing) {
      const msg = 'Username pehle se exist karta hai!';
      addFlash(msg, 'warning');
      return { success: false, message: msg };
    }

    const newUserId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
    const newStaffId = staff.length > 0 ? Math.max(...staff.map((s) => s.id)) + 1 : 1;
    const staffCode = `HK-${newStaffId.toString().padStart(3, '0')}`;

    const newAppUser: AppUser = {
      id: newUserId,
      username: data.username,
      password: data.password,
      name: data.name,
      role: data.role,
      staffId: data.role === 'staff' ? newStaffId : undefined,
      department: data.department,
      shift: data.shift,
    };

    const updatedUsers = [...users, newAppUser];
    setUsers(updatedUsers);
    saveStoredUsers(updatedUsers);

    if (data.role === 'staff') {
      const newStaffUser: StaffUser = {
        id: newStaffId,
        staffCode,
        name: data.name,
        role: 'staff',
        department: data.department,
        shift: data.shift,
        hourlyRate: 15,
        active: true,
      };
      const updatedStaff = [...staff, newStaffUser];
      setStaff(updatedStaff);
      saveStoredStaff(updatedStaff);
    }

    // flash("Naya User Safaltapurvak Create Ho Gaya!", "success")
    const successMsg = 'Naya User Safaltapurvak Create Ho Gaya!';
    addFlash(successMsg, 'success');
    return { success: true, message: successMsg };
  };

  // User avatar letter and name
  const userInitial = currentUser
    ? currentUser.name.charAt(0).toUpperCase()
    : googleUserEmail
    ? googleUserEmail[0].toUpperCase()
    : 'U';
  const userName = currentUser ? currentUser.name : 'Guest User';

  // If not authenticated, show Login View
  if (!currentUser) {
    return (
      <div className="relative min-h-screen">
        {/* Flash Notifications */}
        {flashes.length > 0 && (
          <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-2" id="login-flashes">
            {flashes.map((f) => (
              <div
                key={f.id}
                className={`flex items-start justify-between gap-3 p-3.5 rounded-xl shadow-lg border text-xs font-semibold ${
                  f.type === 'danger'
                    ? 'bg-rose-900/90 border-rose-700 text-rose-100'
                    : f.type === 'warning'
                    ? 'bg-amber-900/90 border-amber-700 text-amber-100'
                    : f.type === 'success'
                    ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100'
                    : 'bg-blue-900/90 border-blue-700 text-blue-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  {f.type === 'danger' && <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />}
                  {f.type === 'warning' && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />}
                  {f.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
                  {f.type === 'info' && <Shield className="h-4 w-4 shrink-0 text-blue-400" />}
                  <span>{f.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFlash(f.id)}
                  className="text-slate-300 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <LoginView
          users={users}
          onLoginSuccess={handleAppLogin}
          onFlashMessage={addFlash}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F1F5F9] font-sans text-[#1E293B] antialiased">
      {/* Floating Flash Alerts (Flask get_flashed_messages) */}
      {flashes.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-2" id="flask-app-flashes">
          {flashes.map((f) => (
            <div
              key={f.id}
              className={`flex items-start justify-between gap-3 p-3.5 rounded-xl shadow-xl border text-xs font-semibold backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 ${
                f.type === 'danger'
                  ? 'bg-rose-950/95 border-rose-600 text-rose-100 shadow-rose-950/20'
                  : f.type === 'warning'
                  ? 'bg-amber-950/95 border-amber-600 text-amber-100 shadow-amber-950/20'
                  : f.type === 'success'
                  ? 'bg-emerald-950/95 border-emerald-600 text-emerald-100 shadow-emerald-950/20'
                  : 'bg-blue-950/95 border-blue-600 text-blue-100 shadow-blue-950/20'
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
                className="text-slate-300 hover:text-white p-0.5 rounded-md"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Top Navigation Bar matching user template:
          <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
            <a class="navbar-brand fw-bold text-teal" href="#"><i class="bi bi-building-gear me-2"></i>HK Ops Admin Portal</a>
            <div class="d-flex text-white align-items-center">
              <span class="me-3"><i class="bi bi-person-circle me-1"></i> Admin Staff</span>
              <a href="/logout" class="btn btn-outline-light btn-sm">Logout</a>
            </div>
      */}
      <nav className="w-full bg-[#0F172A] text-white shadow-md border-b border-slate-800 z-30">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-slate-950 font-bold shadow-xs">
                <Building className="h-5 w-5" />
              </span>
              <div>
                <span className="text-base sm:text-lg font-bold text-teal-400 tracking-tight flex items-center gap-1.5">
                  HK Ops Admin Portal
                </span>
              </div>
            </div>

            {/* Quick View Switcher in Top Bar */}
            <div className="hidden md:flex items-center gap-1 ml-6 border-l border-slate-800 pl-4 text-xs font-medium">
              <button
                type="button"
                id="top-tab-live"
                onClick={() => handleNavigateTab('live')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'live'
                    ? 'bg-[#1E3A8A] text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-teal-300" />
                  <span>Live Attendance & Duties</span>
                  {currentUser?.role === 'staff' && (
                    <Lock className="h-3 w-3 text-slate-400 ml-0.5" />
                  )}
                </span>
              </button>

              <button
                type="button"
                id="top-tab-monthly"
                onClick={() => handleNavigateTab('monthly')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'monthly'
                    ? 'bg-[#1E3A8A] text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-blue-300" />
                  <span>Monthly Reports & Export</span>
                  {currentUser?.role === 'staff' && (
                    <Lock className="h-3 w-3 text-slate-400 ml-0.5" />
                  )}
                </span>
              </button>

              <button
                type="button"
                id="top-tab-portal"
                onClick={() => handleNavigateTab('portal')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'portal'
                    ? 'bg-emerald-700 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Staff Punch Portal</span>
                </span>
              </button>
            </div>
          </div>

          {/* User Section & Actions */}
          <div className="flex items-center gap-3 text-sm">
            {/* Route: POST /admin/add_user -> Admin Only */}
            {currentUser?.role === 'admin' && (
              <button
                type="button"
                id="btn-nav-register-staff"
                data-bs-toggle="modal"
                data-bs-target="#addUserModal"
                onClick={() => setIsRegisterStaffModalOpen(true)}
                className="btn btn-primary btn-sm fw-bold shadow-xs inline-flex items-center gap-1.5 rounded-lg bg-[#0d6efd] hover:bg-[#0b5ed7] active:bg-[#0a58ca] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
                title="Add New Staff / User (/admin/add_user)"
              >
                <UserPlus className="h-3.5 w-3.5 me-1" />
                <span>Add New Staff / User</span>
              </button>
            )}

            <button
              type="button"
              id="btn-quick-punch-nav"
              onClick={() => {
                setPunchPortalStaffId(currentUser?.staffId || 1);
                setIsPunchPortalModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Punch Portal</span>
            </button>

            {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
              <button
                type="button"
                onClick={() => handleOpenAssignModal()}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Assign Duty</span>
              </button>
            )}

            {/* User Profile info with Role Badge */}
            <div className="flex items-center gap-2 text-slate-200 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs ${
                  currentUser?.role === 'admin'
                    ? 'bg-blue-500 text-white'
                    : currentUser?.role === 'manager'
                    ? 'bg-purple-500 text-white'
                    : 'bg-emerald-500 text-white'
                }`}
              >
                {userInitial}
              </div>
              <div className="flex flex-col">
                <span className="hidden md:inline text-xs font-semibold text-slate-100 leading-tight">
                  {userName}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase leading-none ${
                    currentUser?.role === 'admin'
                      ? 'text-blue-400'
                      : currentUser?.role === 'manager'
                      ? 'text-purple-300'
                      : 'text-emerald-400'
                  }`}
                >
                  {currentUser?.role || 'staff'}
                </span>
              </div>
            </div>

            {/* Logout Button (Flask @app.route('/logout')) */}
            <button
              type="button"
              id="btn-nav-logout"
              onClick={handleAppLogout}
              className="rounded-md border border-rose-700/50 bg-rose-950/30 text-rose-300 hover:bg-rose-900/60 px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1"
              title="Logout from system"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container with Geometric Balance Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Mobile Sidebar Overlay */}
        {isMobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* Geometric Balance Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#1E3A8A] text-white flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          id="sidebar-admin"
        >
          {/* Sidebar Header */}
          <div className="p-6 border-b border-blue-800/50 flex items-center justify-between">
            <div>
              <h2 className="text-xs uppercase tracking-widest font-bold text-blue-300 mb-0.5">
                Admin Console
              </h2>
              <p className="text-xl font-semibold">Housekeeping Ops</p>
            </div>
            <button
              type="button"
              className="lg:hidden p-1 text-blue-200 hover:text-white"
              onClick={() => setIsMobileSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Items: sidebar-menu */}
          <nav className="sidebar-menu flex-1 p-4 space-y-1.5 overflow-y-auto" id="sidebar-menu">
            {/* Always Visible for Staff */}
            <a
              href="/staff/portal"
              id="nav-staff-punch-portal"
              onClick={(e) => {
                e.preventDefault();
                handleNavigateTab('portal');
                setIsMobileSidebarOpen(false);
              }}
              className={`menu-item w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'portal'
                  ? 'active bg-emerald-800/80 text-white font-semibold shadow-xs'
                  : 'text-blue-100 hover:bg-blue-800/20'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-emerald-300" />
                <span>Staff Punching Portal</span>
              </div>
              <span className="text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-sm">
                Kiosk
              </span>
            </a>

            {/* Admin & Manager Only Routes */}
            {isAdminOrManager && (
              <>
                <a
                  href="/admin/live_attendance"
                  id="nav-live-attendance"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigateTab('live');
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`menu-item w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'live'
                      ? 'active bg-blue-800/60 text-white font-semibold shadow-xs'
                      : 'text-blue-100 hover:bg-blue-800/20'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Activity className="h-4 w-4 text-teal-300" />
                    <span>Live Attendance & Duties</span>
                  </div>
                </a>

                <a
                  href="/admin/monthly_report"
                  id="nav-monthly-reports"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigateTab('monthly');
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`menu-item w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'monthly'
                      ? 'active bg-blue-800/60 text-white font-semibold shadow-xs'
                      : 'text-blue-100 hover:bg-blue-800/20'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-4 w-4 text-blue-300" />
                    <span>Monthly Attendance & OT</span>
                  </div>
                </a>

                <a
                  href="/admin/roster"
                  id="nav-staff-roster"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsStaffModalOpen(true);
                    setIsMobileSidebarOpen(false);
                  }}
                  className="menu-item w-full flex items-center justify-between px-4 py-3 text-blue-100 hover:bg-blue-800/20 rounded-lg text-sm font-medium transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="h-4 w-4 text-blue-300" />
                    <span>Staff Roster</span>
                  </div>
                  <span className="text-xs text-blue-300 font-semibold bg-blue-900/40 px-2 py-0.5 rounded-full">
                    {staff.length}
                  </span>
                </a>
              </>
            )}

            {/* Punch Log History (Accessible to all, but restricted inside) */}
            <a
              href="#"
              id="nav-punch-log-history"
              onClick={(e) => {
                e.preventDefault();
                openPunchLogModal();
              }}
              className="menu-item w-full flex items-center gap-2.5 px-4 py-3 text-blue-100 hover:bg-blue-800/20 rounded-lg text-sm font-medium transition-colors"
            >
              <BookOpen className="h-4 w-4 text-amber-300" />
              <span>Punch Log History</span>
            </a>

            {/* Admin & Operations Operations Drawer */}
            {isAdminOrManager && (
              <div className="pt-3 mt-3 border-t border-blue-800/40 space-y-1.5">
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-blue-300/70">
                  Operations & Tools
                </div>

                {currentUser?.role === 'admin' && (
                  <button
                    type="button"
                    id="sidebar-register-staff"
                    data-bs-toggle="modal"
                    data-bs-target="#addUserModal"
                    onClick={() => {
                      setIsRegisterStaffModalOpen(true);
                      setIsMobileSidebarOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/30 rounded-lg text-xs font-bold text-blue-100 transition-colors flex items-center gap-2"
                  >
                    <UserPlus className="h-4 w-4 text-teal-300" />
                    <span>Add New Staff / User</span>
                  </button>
                )}

                <button
                  type="button"
                  id="sidebar-duty-assign"
                  onClick={() => {
                    handleOpenAssignModal();
                    setIsMobileSidebarOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-blue-100 hover:bg-blue-800/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
                >
                  <PlusCircle className="h-4 w-4 text-teal-300" />
                  <span>Duty & Shift Assignment</span>
                </button>

                <button
                  type="button"
                  id="sidebar-sheets-sync"
                  onClick={() => {
                    setIsSheetsModalOpen(true);
                    setIsMobileSidebarOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-blue-100 hover:bg-blue-800/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                  <span>Google Sheets Sync</span>
                </button>

                <button
                  type="button"
                  id="sidebar-pdf-preview"
                  onClick={() => {
                    setIsPdfPreviewOpen(true);
                    setIsMobileSidebarOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-blue-100 hover:bg-blue-800/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
                >
                  <Eye className="h-4 w-4 text-blue-300" />
                  <span>PDF Document Preview</span>
                </button>
              </div>
            )}
          </nav>

          {/* User Profile Footer */}
          <div className="p-5 bg-blue-900/50 border-t border-blue-800/40">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center font-bold text-white shadow-2xs">
                {userInitial}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-medium text-white truncate">{userName}</p>
                <p className="text-[10px] text-blue-300 uppercase tracking-tighter truncate">
                  {currentUser?.role === 'admin'
                    ? 'System Administrator'
                    : currentUser?.role === 'manager'
                    ? 'Operations Manager'
                    : 'Housekeeping Staff'}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Column */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {activeTab === 'portal' ? (
            /* Tab 3: Standalone Kiosk Staff Punching Portal */
            <div className="flex-1 bg-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 min-h-[calc(100vh-65px)]">
              <div className="w-full max-w-[420px]">
                <StaffPunchPortal
                  staff={staff}
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
          ) : activeTab === 'live' ? (
            /* Tab 1: Live Daily Attendance & Duty Log matching user's template */
            <div className="flex-1 p-6 lg:p-10 space-y-6">
              <LiveAttendanceView
                selectedDate={selectedLiveDate}
                onDateChange={setSelectedLiveDate}
                staff={staff}
                records={records}
                onOpenAssignModal={handleOpenAssignModal}
                onOpenPunchPortal={(staffId) => {
                  setPunchPortalStaffId(staffId || 1);
                  setIsPunchPortalModalOpen(true);
                }}
                onOpenAddUser={() => setIsRegisterStaffModalOpen(true)}
                currentUserRole={currentUser?.role}
              />
            </div>
          ) : (
            /* Tab 2: Monthly Attendance & OT Report (Geometric Balance Theme) */
            <div className="flex-1 flex flex-col min-w-0">
              {/* Header with Month Navigator & Actions */}
              <header className="min-h-24 bg-white border-b border-[#CBD5E1] flex flex-col md:flex-row items-start md:items-center justify-between px-6 lg:px-10 py-4 gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-[#1E3A8A]">
                    Monthly Attendance & OT Report
                  </h1>
                  <p className="text-sm text-slate-500">
                    Generate and export monthly staff performance data
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Period Selector */}
                  <div className="flex border border-[#CBD5E1] rounded-md overflow-hidden bg-white shadow-2xs">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      title="Previous Month"
                      className="px-3 py-2 bg-white text-slate-600 hover:bg-slate-100 border-r border-[#CBD5E1] transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <div className="px-4 py-2 bg-white border-r border-[#CBD5E1] text-sm font-medium text-slate-800">
                      {monthName}
                    </div>

                    <button
                      type="button"
                      onClick={handleNextMonth}
                      title="Next Month"
                      className="px-3 py-2 bg-white text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Export PDF Button */}
                  <button
                    type="button"
                    id="btn-export-pdf-top"
                    onClick={handleDownloadPdf}
                    className="bg-[#1E3A8A] hover:bg-blue-800 text-white px-5 py-2 rounded-md font-semibold text-sm flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export PDF</span>
                  </button>

                  {/* Export Google Sheets */}
                  <button
                    type="button"
                    id="btn-export-sheets-top"
                    onClick={() => setIsSheetsModalOpen(true)}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-md font-semibold text-sm flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Export to Sheets</span>
                  </button>
                </div>
              </header>

              {/* Monthly Summary Section */}
              <section className="flex-1 p-6 lg:p-10 bg-[#F8FAFC] space-y-8">
                {/* Main Data Summary Card & Report Table */}
                <ReportTable
                  summaryData={summaryData}
                  monthName={monthName}
                  year={year}
                  month={month}
                  onSelectStaff={handleSelectStaffRow}
                />

                {/* 3 Geometric Balance Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-xl border border-[#CBD5E1] shadow-sm">
                    <p className="text-xs text-slate-500 uppercase tracking-widest mb-1 font-semibold">
                      Aggregate Present Days
                    </p>
                    <p className="text-3xl font-bold text-[#1E3A8A]">
                      {aggregatePresentDays}{' '}
                      <span className="text-sm text-slate-400 font-normal">
                        / {totalPossibleDays} possible
                      </span>
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-[#CBD5E1] shadow-sm">
                    <p className="text-xs text-slate-500 uppercase tracking-widest mb-1 font-semibold">
                      Total Regular Hours
                    </p>
                    <p className="text-3xl font-bold text-[#1E3A8A]">
                      {totalRegularHours.toFixed(1)}{' '}
                      <span className="text-sm text-slate-400 font-normal">hrs</span>
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-[#CBD5E1] shadow-sm">
                    <p className="text-xs text-slate-500 uppercase tracking-widest mb-1 font-semibold">
                      Total OT Hours
                    </p>
                    <p className="text-3xl font-bold text-orange-600">
                      {totalOtHours.toFixed(1)}{' '}
                      <span className="text-sm text-slate-400 font-normal">hrs</span>
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* Duty & Shift Assignment Modal matching #assignModal */}
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
        onAddStaff={handleAddStaffMember}
        onToggleActive={handleToggleStaffActive}
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

      {/* User Creation Modal matching POST /admin/add_user */}
      <RegisterStaffModal
        isOpen={isRegisterStaffModalOpen}
        onClose={() => setIsRegisterStaffModalOpen(false)}
        onRegister={handleAddUser}
      />
    </div>
  );
}
