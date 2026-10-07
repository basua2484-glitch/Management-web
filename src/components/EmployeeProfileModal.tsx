import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  Building,
  Building2,
  Calendar,
  KeyRound,
  Shield,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Timer,
  ArrowRightLeft,
  Check,
  RefreshCw,
  LogOut,
  AlertCircle,
  Briefcase,
  Layers,
  Lock,
  Unlock,
  FileText,
  Activity,
  Flame,
  User,
  CheckCircle,
  ExternalLink,
  Upload,
  FolderLock,
  FileCheck,
  Eye,
  Trash2,
} from 'lucide-react';
import type { AppUser, StaffUser, AttendanceRecord, DutyType, AttendanceSession, EmployeeDocument } from '../types';
import {
  MANDATORY_ONBOARDING_DOC_TYPES,
  TOTAL_REQUIRED_DOCS,
  normalizeHierarchicalRole,
  canViewUserDocuments,
  canUploadForUser,
  canApproveOrReject,
  canDeleteDocument,
  generateInitialDocumentsForUser,
  getDocumentSummary,
  uploadEmployeeDocument,
  approveEmployeeDocument,
  rejectEmployeeDocument,
  deleteEmployeeDocument,
  filterRealDocuments,
} from '../services/documentVaultService';
import {
  getStoredUsers,
  saveStoredUsers,
  getStoredStaff,
  saveStoredStaff,
  getStoredAttendance,
  saveStoredAttendance,
  getStoredDutyAllocations,
  saveStoredDutyAllocations,
  DUTY_AREAS,
  getStoredEmergencyRecalls,
  getStoredCurrentUser,
} from '../data/mockHousekeepingData';
import { compressDocumentWithMetrics, formatBytes, type CompressionResult } from '../utils/fileCompressor';
import { formatTimeTo12hStr } from '../utils/attendanceCalculator';

export interface EmployeeModalProps {
  staffId: string | null;
  onClose: () => void;
  userRole: 'admin' | 'manager' | 'supervisor' | 'staff';
  initialTab?: 'duty' | 'monthly' | 'ot' | 'emergency' | 'documents' | 'actions';
  selectedDate?: string;
  isShiftGated?: boolean;
  onActionComplete?: () => void;
}

export const EmployeeProfileModal: React.FC<EmployeeModalProps> = ({
  staffId,
  onClose,
  userRole,
  initialTab,
  selectedDate,
  isShiftGated = false,
  onActionComplete,
}) => {
  // Duty state & role gating: Only Supervisors are subject to off-duty shift-gating. Managers have 24/7 full access.
  const effectiveIsShiftGated = userRole === 'supervisor' ? isShiftGated : false;
  const isAdminOrManager = userRole === 'admin' || userRole === 'manager';

  // Active tab selection
  const [activeTab, setActiveTab] = useState<'duty' | 'monthly' | 'ot' | 'emergency' | 'documents' | 'actions'>(initialTab || 'duty');

  // Interactive Action Sub-panels
  const [actionPanel, setActionPanel] = useState<'none' | 'reliever' | 'ward' | 'password'>('none');
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [selectedDutyType, setSelectedDutyType] = useState<DutyType>('PERMANENT_RELIEVER');
  const [newPassword, setNewPassword] = useState<string>('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Document Vault modal & action states
  const [docUploadType, setDocUploadType] = useState<string | null>(null);
  const [docUploadFileName, setDocUploadFileName] = useState('');
  const [docUploadNotes, setDocUploadNotes] = useState('');
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);
  const [isCompressingDoc, setIsCompressingDoc] = useState(false);
  const [docCompressionProgress, setDocCompressionProgress] = useState(0);
  const [docCompressionResult, setDocCompressionResult] = useState<CompressionResult | null>(null);
  const [docRejectTarget, setDocRejectTarget] = useState<EmployeeDocument | null>(null);
  const [docRejectReason, setDocRejectReason] = useState('Document copy is blurry or unreadable.');
  const [docPreviewTarget, setDocPreviewTarget] = useState<EmployeeDocument | null>(null);

  // Target / today date
  const effectiveDate = selectedDate || new Date().toISOString().split('T')[0];

  // Resolve staff & users from local stores
  const [users, setUsers] = useState<AppUser[]>(() => getStoredUsers());
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>(() => getStoredAttendance());
  const [staffList, setStaffList] = useState<StaffUser[]>(() => getStoredStaff());
  const [allocations, setAllocations] = useState(() => getStoredDutyAllocations());
  const [recalls, setRecalls] = useState(() => getStoredEmergencyRecalls());

  // Find user matching staffId
  const normalizedSearchId = (staffId || '').trim().toLowerCase();
  const matchedUser = useMemo(() => {
    return users.find((u) => {
      const uStaffId = (u.staff_id || '').toLowerCase();
      const uUsername = (u.username || '').toLowerCase();
      const uIdStr = String(u.id);
      const uCode = `hk-${String(u.id).padStart(3, '0')}`;
      return (
        uStaffId === normalizedSearchId ||
        uUsername === normalizedSearchId ||
        uIdStr === normalizedSearchId ||
        uCode === normalizedSearchId
      );
    });
  }, [users, normalizedSearchId]);

  const matchedStaff = useMemo(() => {
    return staffList.find((s) => {
      const sCode = s.staffCode.toLowerCase();
      const sIdStr = String(s.id);
      return (
        sCode === normalizedSearchId ||
        sIdStr === normalizedSearchId ||
        (matchedUser && s.id === matchedUser.id)
      );
    });
  }, [staffList, normalizedSearchId, matchedUser]);

  const displayName =
    matchedUser?.full_name || matchedUser?.name || matchedStaff?.name || 'Employee';
  const displayStaffCode =
    matchedUser?.staff_id || matchedStaff?.staffCode || staffId || '';
  const currentDutyType: DutyType =
    matchedUser?.duty_type || (matchedStaff?.department.includes('Reliever') ? 'PERMANENT_RELIEVER' : 'FIXED');
  const assignedWard =
    matchedUser?.is_temp_reliever && matchedUser.temp_department
      ? matchedUser.temp_department
      : matchedUser?.fixed_department || matchedUser?.assigned_area || matchedStaff?.department || '3rd Floor Wards';
  const assignedShift = matchedUser?.assigned_shift || matchedStaff?.shift || '7-3';

  // Shift Timing Label
  const shiftTimingLabel = useMemo(() => {
    switch (assignedShift) {
      case '11-7':
        return '11:00 PM – 07:00 AM (Night Shift)';
      case '3-11':
        return '03:00 PM – 11:00 PM (Evening Shift)';
      case 'HALF_4H':
        return '07:00 AM – 11:00 AM (Half Day 4h)';
      case 'CONTINUOUS_EXTENDED_OT':
        return 'Continuous Pure Overtime Shift';
      case '7-3':
      default:
        return '07:00 AM – 03:00 PM (Morning Shift)';
    }
  }, [assignedShift]);

  // Find Target Attendance Record
  const numericId = matchedStaff?.id || matchedUser?.id || (parseInt((staffId || '').replace(/\D/g, ''), 10) || 1);
  const todayRecord = useMemo(() => {
    return attendanceList.find((r) => {
      const matchDate = r.date === effectiveDate;
      const matchUser =
        r.userId === numericId ||
        (r.staff_id && r.staff_id.toLowerCase() === displayStaffCode.toLowerCase());
      return matchDate && matchUser;
    });
  }, [attendanceList, effectiveDate, numericId, displayStaffCode]);

  // Compute Today's Stats
  const punchInTime = todayRecord?.punchIn || (todayRecord?.sessions?.[0]?.punch_in ? new Date(todayRecord.sessions[0].punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null);
  const punchOutTime = todayRecord?.punchOut || (todayRecord?.sessions?.find(s => Boolean(s.punch_out))?.punch_out ? new Date(todayRecord.sessions.find(s => Boolean(s.punch_out))!.punch_out!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null);
  const isActiveOnFloor = Boolean(todayRecord && !punchOutTime);

  const regularHours = todayRecord ? (todayRecord.regularHours ?? todayRecord.regular_hours ?? 0.0) : 0.0;
  const otHours = todayRecord ? (todayRecord.otHours ?? todayRecord.ot_hours ?? (todayRecord.ot_status === 'APPROVED' ? (todayRecord.otHours || 0.0) : 0.0)) : 0.0;

  const isEmergencyExitToday = Boolean(
    (todayRecord as any)?.emergency_departure ||
    (todayRecord?.notes && todayRecord.notes.includes('EMERGENCY_EXIT'))
  );

  // Active Punch Sessions list
  const activeSessionsList: AttendanceSession[] = useMemo(() => {
    if (todayRecord?.sessions && todayRecord.sessions.length > 0) {
      return todayRecord.sessions;
    }
    if (todayRecord?.punchInTimestamp || todayRecord?.punchIn) {
      return [
        {
          id: `sess_${numericId}_${effectiveDate}`,
          staff_id: numericId,
          date: effectiveDate,
          punch_in: todayRecord?.punchInTimestamp || `${effectiveDate}T${todayRecord.punchIn || '07:00'}:00.000Z`,
          punch_out: todayRecord?.punchOutTimestamp || (todayRecord?.punchOut ? `${effectiveDate}T${todayRecord.punchOut}:00.000Z` : null),
          notes: assignedWard,
        },
      ];
    }
    return [];
  }, [todayRecord, numericId, effectiveDate, assignedWard]);

  // Monthly Records - REAL-TIME PUNCH ONLY RULE:
  // Strictly display only entries created from actual Punch-In/Punch-Out events or manual Admin overrides.
  // Any auto-generating mock attendance loop (e.g. day = 1 <= 15) has been removed.
  const currentMonthPrefix = effectiveDate.slice(0, 7);
  const monthlyRecords = useMemo(() => {
    const recordsForStaff = attendanceList.filter((r) => {
      const inMonth = (r.date || '').startsWith(currentMonthPrefix);
      const isStaff =
        r.userId === numericId ||
        (r.staff_id && r.staff_id.toLowerCase() === displayStaffCode.toLowerCase());
      return inMonth && isStaff;
    });

    return recordsForStaff.sort((a, b) => (b.date || (b as any).calendar_date || '').localeCompare(a.date || (a as any).calendar_date || ''));
  }, [attendanceList, currentMonthPrefix, numericId, displayStaffCode]);

  const totalPresentDays = useMemo(() => {
    return monthlyRecords.filter(
      (r) => r.status === 'Present' || (r.regularHours || 0) > 0 || (r.regular_hours || 0) > 0
    ).length;
  }, [monthlyRecords]);

  const totalMonthRegHours = useMemo(() => {
    return monthlyRecords.reduce((acc, r) => acc + (r.regularHours ?? r.regular_hours ?? 0), 0);
  }, [monthlyRecords]);

  const totalMonthOtHours = useMemo(() => {
    return monthlyRecords.reduce((acc, r) => acc + (r.otHours ?? r.ot_hours ?? 0), 0);
  }, [monthlyRecords]);

  // Overtime Records
  const staffOtRecords = useMemo(() => {
    const otList: {
      id: string | number;
      date: string;
      department: string;
      type: string;
      hours: number;
      status: 'APPROVED' | 'PENDING' | 'REJECTED';
      authorizedBy: string;
      notes: string;
    }[] = [];

    // Allocations
    allocations
      .filter((a) => (a.staff_id || '').toLowerCase() === displayStaffCode.toLowerCase())
      .forEach((a) => {
        if (a.ot_requested_hours > 0 || a.ot_status !== 'NONE') {
          otList.push({
            id: a.id,
            date: a.date,
            department: a.assigned_department,
            type: a.notes?.includes('CONTINUOUS') ? 'Continuous Extended OT' : 'Shift Overtime Extension',
            hours: a.ot_requested_hours || 2.0,
            status: a.ot_status === 'APPROVED' ? 'APPROVED' : a.ot_status === 'REJECTED' ? 'REJECTED' : 'PENDING',
            authorizedBy: a.assigned_by_supervisor || 'Supervisor Rakesh',
            notes: a.notes || 'Emergency floor turnover assistance',
          });
        }
      });

    // Attendance records with OT
    monthlyRecords.forEach((r) => {
      const otH = r.otHours ?? r.ot_hours ?? 0;
      if (otH > 0 && !otList.some((o) => o.date === r.date)) {
        otList.push({
          id: `att_ot_${r.id}`,
          date: r.date,
          department: r.department_worked || r.notes || assignedWard,
          type: r.shift_name === 'CONTINUOUS_EXTENDED_OT' ? 'Continuous Extended OT' : 'Post-Shift Extension',
          hours: otH,
          status: 'APPROVED',
          authorizedBy: 'Supervisor Rakesh',
          notes: r.notes || 'Bed turnover & ward deep cleaning completion',
        });
      }
    });

    return otList.sort((a, b) => (b.date || (b as any).calendar_date || '').localeCompare(a.date || (a as any).calendar_date || ''));
  }, [allocations, displayStaffCode, monthlyRecords]);

  // Emergency Exit Logs
  const emergencyExitLogs = useMemo(() => {
    const logs: {
      id: string;
      date: string;
      exitTime: string;
      shift: string;
      regularHoursCredited: number;
      reason: string;
      status: string;
      supervisor: string;
    }[] = [];

    monthlyRecords.forEach((r) => {
      const isExit =
        Boolean((r as any)?.emergency_departure) ||
        (r.notes && r.notes.includes('EMERGENCY_EXIT')) ||
        (r.notes && r.notes.includes('EMERGENCY'));
      if (isExit) {
        logs.push({
          id: `exit_${r.id}`,
          date: r.date,
          exitTime: (r as any)?.departure_time || '11:45 AM',
          shift: r.shift_name || '7-3 (Morning)',
          regularHoursCredited: r.regularHours || 0,
          reason: (r as any)?.departure_reason || 'Mid-shift medical departure. Reliever dispatched.',
          status: 'VERIFIED & CREDITED',
          supervisor: (r as any)?.supervisor || 'Duty Supervisor',
        });
      }
    });

    return logs;
  }, [monthlyRecords]);

  // Default ward for select dropdown
  useEffect(() => {
    if (assignedWard) {
      setSelectedWard(assignedWard);
    }
  }, [assignedWard]);

  // Quick Action: Assign Reliever Duty
  const handleAssignRelieverDuty = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isShiftGated) return;

    const updatedUsers = getStoredUsers().map((u) => {
      if (u.id === matchedUser?.id || (u.staff_id && u.staff_id.toLowerCase() === displayStaffCode.toLowerCase())) {
        const isTemp = selectedDutyType === 'TEMP_RELIEVER';
        return {
          ...u,
          duty_type: selectedDutyType,
          is_temp_reliever: isTemp,
          temp_department: isTemp ? selectedWard || 'ICU / Critical Care' : null,
          assigned_area: selectedWard || u.assigned_area,
          department: selectedWard || u.department,
        };
      }
      return u;
    });

    saveStoredUsers(updatedUsers);
    setUsers(updatedUsers);

    // Update duty allocations
    const currentAllocations = getStoredDutyAllocations();
    const newAllocation = {
      id: Date.now(),
      staff_id: displayStaffCode,
      date: effectiveDate,
      assigned_department: selectedWard || 'ICU / Critical Care',
      assigned_by_supervisor: `Supervisor (${userRole.toUpperCase()})`,
      ot_requested_hours: 0,
      ot_status: 'NONE' as const,
      notes: `Duty assigned as ${selectedDutyType.replace('_', ' ')}`,
      created_at: new Date().toISOString(),
    };
    saveStoredDutyAllocations([newAllocation as any, ...currentAllocations]);
    setAllocations(getStoredDutyAllocations());

    setActionSuccessMsg(`Assigned as ${selectedDutyType.replace('_', ' ')} in ${selectedWard || 'assigned ward'}.`);
    setTimeout(() => {
      setActionPanel('none');
      setActionSuccessMsg(null);
      onActionComplete?.();
    }, 1800);
  };

  // Quick Action: Change Assigned Ward
  const handleChangeWard = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isShiftGated) return;

    const updatedUsers = getStoredUsers().map((u) => {
      if (u.id === matchedUser?.id || (u.staff_id && u.staff_id.toLowerCase() === displayStaffCode.toLowerCase())) {
        return {
          ...u,
          fixed_department: selectedWard,
          assigned_area: selectedWard,
          department: selectedWard,
        };
      }
      return u;
    });

    saveStoredUsers(updatedUsers);
    setUsers(updatedUsers);

    const updatedStaff = getStoredStaff().map((s) => {
      if (s.id === matchedStaff?.id || s.staffCode.toLowerCase() === displayStaffCode.toLowerCase()) {
        return {
          ...s,
          department: selectedWard,
        };
      }
      return s;
    });
    saveStoredStaff(updatedStaff);
    setStaffList(updatedStaff);

    setActionSuccessMsg(`Assigned ward updated to: ${selectedWard}`);
    setTimeout(() => {
      setActionPanel('none');
      setActionSuccessMsg(null);
      onActionComplete?.();
    }, 1800);
  };

  // Quick Action: Reset Password (Admin)
  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPassword.trim();
    if (!trimmed) return;

    const updatedUsers = getStoredUsers().map((u) => {
      if (u.id === matchedUser?.id || (u.staff_id && u.staff_id.toLowerCase() === displayStaffCode.toLowerCase())) {
        return {
          ...u,
          password: trimmed,
          plaintext_password: trimmed,
        };
      }
      return u;
    });

    saveStoredUsers(updatedUsers);
    setUsers(updatedUsers);
    setActionSuccessMsg(`Account password reset successfully to: ${trimmed}`);
    setTimeout(() => {
      setActionPanel('none');
      setNewPassword('');
      setActionSuccessMsg(null);
      onActionComplete?.();
    }, 1800);
  };

  // RBAC Document Vault Helper Logic
  const currentLoggedInUser = useMemo(() => {
    return getStoredCurrentUser() || { role: userRole, staff_id: 'SYSTEM', full_name: 'Admin' };
  }, [userRole]);

  const userDocuments: EmployeeDocument[] = useMemo(() => {
    return filterRealDocuments(matchedUser?.documents);
  }, [matchedUser]);

  const docSummary = useMemo(() => {
    return getDocumentSummary(userDocuments);
  }, [userDocuments]);

  const canUploadForThisUser = useMemo(() => {
    return canUploadForUser(currentLoggedInUser, matchedUser);
  }, [currentLoggedInUser, matchedUser]);

  const canApproveThisUser = useMemo(() => {
    return canApproveOrReject(currentLoggedInUser);
  }, [currentLoggedInUser]);

  const canDeleteThisUser = useMemo(() => {
    return canDeleteDocument(currentLoggedInUser);
  }, [currentLoggedInUser]);

  const handleApproveDoc = (doc: EmployeeDocument) => {
    if (!matchedUser) return;
    const res = approveEmployeeDocument(matchedUser.staff_id || matchedUser.id, doc.docId, currentLoggedInUser);
    if (res.success) {
      setActionSuccessMsg(`Verified: ${doc.docType} marked as Approved.`);
      setUsers(getStoredUsers());
      setTimeout(() => setActionSuccessMsg(null), 2500);
      onActionComplete?.();
    }
  };

  const handleConfirmRejectDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedUser || !docRejectTarget) return;
    const res = rejectEmployeeDocument(matchedUser.staff_id || matchedUser.id, docRejectTarget.docId, currentLoggedInUser, docRejectReason);
    if (res.success) {
      setActionSuccessMsg(`Rejected: ${docRejectTarget.docType}.`);
      setUsers(getStoredUsers());
      setDocRejectTarget(null);
      setTimeout(() => setActionSuccessMsg(null), 2500);
      onActionComplete?.();
    }
  };

  const handleDocFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingDoc(true);
    setDocCompressionProgress(20);

    try {
      const result = await compressDocumentWithMetrics(file, {
        maxSizeMB: 0.3, // Max target size ~300KB
        maxWidthOrHeight: 1200, // Maintain readable text resolution for Aadhaar/PAN
        useWebWorker: true,
        fileType: 'image/jpeg',
      });

      setSelectedDocFile(result.file);
      setDocCompressionResult(result);
      setDocUploadFileName(result.file.name);
      setDocCompressionProgress(100);

      if (result.isCompressed) {
        setActionSuccessMsg(
          `Optimized: ${result.originalFormatted} → ${result.compressedFormatted} (Saved ${result.savedPercentage}%)`
        );
        setTimeout(() => setActionSuccessMsg(null), 3500);
      }
    } catch (err) {
      console.error('File compression error:', err);
      setSelectedDocFile(file);
    } finally {
      setIsCompressingDoc(false);
    }
  };

  const handleConfirmUploadDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedUser || !docUploadType) return;
    const sId = matchedUser.staff_id || matchedUser.username || matchedUser.id;
    const cleanType = docUploadType.split('(')[0].trim().replace(/\s+/g, '_');
    const fileName = docUploadFileName.trim() || `${sId}_${cleanType}.pdf`;

    const activeSizeFormatted = docCompressionResult
      ? docCompressionResult.compressedFormatted
      : selectedDocFile
      ? formatBytes(selectedDocFile.size)
      : '290 KB';

    const originalSizeFormatted = docCompressionResult?.isCompressed
      ? docCompressionResult.originalFormatted
      : undefined;

    const ratioFormatted = docCompressionResult?.isCompressed
      ? `Saved ${docCompressionResult.savedPercentage}%`
      : undefined;

    const res = uploadEmployeeDocument(
      matchedUser.staff_id || matchedUser.id,
      {
        docType: docUploadType,
        fileName,
        fileSize: activeSizeFormatted,
        originalFileSize: originalSizeFormatted,
        compressionRatio: ratioFormatted,
        notes: docUploadNotes,
      },
      currentLoggedInUser
    );
    if (res.success) {
      setActionSuccessMsg(res.message);
      setUsers(getStoredUsers());
      setDocUploadType(null);
      setDocUploadFileName('');
      setDocUploadNotes('');
      setSelectedDocFile(null);
      setDocCompressionResult(null);
      setTimeout(() => setActionSuccessMsg(null), 2500);
      onActionComplete?.();
    }
  };

  const handleDeleteDoc = (doc: EmployeeDocument) => {
    if (!matchedUser) return;
    if (confirm(`Permanently delete "${doc.docType}" from vault?`)) {
      const res = deleteEmployeeDocument(matchedUser.staff_id || matchedUser.id, doc.docId, currentLoggedInUser);
      if (res.success) {
        setActionSuccessMsg(`Deleted "${doc.docType}" from vault.`);
        setUsers(getStoredUsers());
        setTimeout(() => setActionSuccessMsg(null), 2500);
        onActionComplete?.();
      }
    }
  };

  if (!staffId) return null;

  return (
    <div
      id="employee-profile-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="employee-profile-modal-drawer"
        className="max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 flex flex-col justify-between"
      >
        <div>
          {/* Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>{displayName}</span>
                  <span className="font-mono text-sm font-semibold text-[#1E3A8A] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                    {displayStaffCode}
                  </span>
                </h2>
                {isActiveOnFloor ? (
                  <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Active on Floor</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-2xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                    <span>Shift Completed</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold mt-1.5 text-slate-600">
                {/* Site Badge (Requirement 4): e.g. "BASU-MGR-001 | Apex Main Hospital" */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded font-mono text-2xs font-bold bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs">
                  <Building2 className="h-3.5 w-3.5 text-[#1E3A8A] shrink-0" />
                  <span>{displayStaffCode} | {matchedUser?.siteName || matchedUser?.site_name || 'Apex Main Hospital'}</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-100/70 text-blue-900 font-bold border border-blue-200">
                  Duty: {currentDutyType.replace('_', ' ')}
                </span>
                <span>&bull;</span>
                <span className="text-slate-800 font-bold flex items-center gap-1">
                  <Building className="h-3.5 w-3.5 text-slate-500" />
                  <span>{assignedWard}</span>
                </span>
                <span>&bull;</span>
                <span className="text-slate-600 text-2xs">{shiftTimingLabel}</span>
              </div>
            </div>

            <button
              type="button"
              id="btn-close-employee-profile-modal"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full font-bold text-slate-400 hover:text-slate-800 transition cursor-pointer"
              title="Close Profile Modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 mt-4 border-b border-slate-200 pb-2 overflow-x-auto">
            {[
              { id: 'duty', label: 'Duty & Punch' },
              { id: 'monthly', label: `Monthly Attendance (${monthlyRecords.length})` },
              { id: 'ot', label: `OT Records (${staffOtRecords.length})` },
              { id: 'emergency', label: `Emergency Exits (${emergencyExitLogs.length})` },
              { id: 'documents', label: `Document Vault (${docSummary.approved}/${MANDATORY_ONBOARDING_DOC_TYPES.length})` },
              { id: 'actions', label: 'Quick Actions' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                id={`tab-profile-${tab.id}`}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-[#1E3A8A] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: COMPLETE DUTY DETAILS & ACTIVE PUNCH STATUS */}
          {activeTab === 'duty' && (
            <div className="mt-5 space-y-5 animate-in fade-in duration-200">
              {/* Duty Details Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-[#1E3A8A]" />
                    <span>Complete Duty Specifications</span>
                  </h3>
                  <span className="text-3xs font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Hospital Site: Main Hospital Wing
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-2xs text-slate-500 font-semibold block">Duty Allocation Model</span>
                    <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                      {currentDutyType === 'FIXED'
                        ? 'Fixed Floor Assignment'
                        : currentDutyType === 'PERMANENT_RELIEVER'
                        ? 'Permanent Floor Reliever Pool'
                        : 'Temporary Emergency Shift Reliever'}
                    </span>
                    <p className="text-3xs text-slate-500 mt-1">
                      {currentDutyType === 'FIXED'
                        ? 'Assigned to permanent single ward. Not dynamically reallocated without supervisor consent.'
                        : 'Flexible floor deployment across patient rooms, ICU sanitization and surge wards.'}
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-2xs text-slate-500 font-semibold block">Assigned Ward / Department</span>
                    <span className="font-bold text-[#1E3A8A] text-sm mt-0.5 block">
                      {assignedWard}
                    </span>
                    <p className="text-3xs text-slate-500 mt-1">
                      Supervisor allocation: Authorized by Floor Supervisor Rakesh.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-3xs text-slate-500 font-semibold uppercase block">Shift Schedule</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{assignedShift}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-3xs text-slate-500 font-semibold uppercase block">Standard Baseline</span>
                    <span className="font-bold text-emerald-700 mt-0.5 block">8.0 hrs</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-3xs text-slate-500 font-semibold uppercase block">Overtime Cap</span>
                    <span className="font-bold text-amber-700 mt-0.5 block">Max 8.0 hrs</span>
                  </div>
                </div>
              </div>

              {/* Active Punch Status Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#1E3A8A]" />
                    <span>Active Punch Status ({effectiveDate})</span>
                  </h3>
                  <span
                    className={`text-2xs font-bold px-2.5 py-0.5 rounded-full border ${
                      isActiveOnFloor
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : todayRecord
                        ? 'bg-slate-100 text-slate-700 border-slate-300'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {isActiveOnFloor ? 'ON DUTY (Active)' : todayRecord ? 'DUTY COMPLETED' : 'OFF DUTY'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-3xs text-slate-500 font-semibold uppercase block">Punch In</span>
                    <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
                      {punchInTime ? formatTimeTo12hStr(punchInTime) : '--:--'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-3xs text-slate-500 font-semibold uppercase block">Punch Out</span>
                    <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
                      {punchOutTime ? formatTimeTo12hStr(punchOutTime) : (todayRecord ? 'Floor Active' : '--:--')}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-3xs text-slate-500 font-semibold uppercase block">Regular Hours</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm mt-0.5 block">
                      {regularHours.toFixed(1)}h
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-3xs text-slate-500 font-semibold uppercase block">Overtime Hours</span>
                    <span className="font-mono font-bold text-amber-600 text-sm mt-0.5 block">
                      {otHours.toFixed(1)}h
                    </span>
                  </div>
                </div>

                {/* Session Breakdown */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Shift Punch Sessions ({activeSessionsList.length})
                  </span>
                  {activeSessionsList.length === 0 ? (
                    <div className="text-center py-4 text-slate-400 text-xs italic bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                      No shift punch sessions recorded today
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {activeSessionsList.map((session, idx) => (
                        <div
                          key={session.id || idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-2xs">
                              #{idx + 1}
                            </span>
                            <span className="text-slate-800 font-semibold">
                              {formatTimeTo12hStr(session.punch_in)} &rarr;{' '}
                              {session.punch_out ? formatTimeTo12hStr(session.punch_out) : 'Current Active'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-3xs text-slate-500">{session.notes || assignedWard}</span>
                            {!session.punch_out && (
                              <span className="text-3xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                Live
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MONTHLY ATTENDANCE SUMMARY & DAILY LOGS */}
          {activeTab === 'monthly' && (
            <div className="mt-5 space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-3xs text-slate-500 font-bold uppercase block">Present Days</span>
                  <span className="font-bold text-slate-900 text-base mt-0.5 block">{totalPresentDays} Days</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-3xs text-slate-500 font-bold uppercase block">Regular Hours</span>
                  <span className="font-bold text-emerald-700 text-base mt-0.5 block">{totalMonthRegHours.toFixed(1)}h</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-3xs text-slate-500 font-bold uppercase block">Total Overtime</span>
                  <span className="font-bold text-amber-600 text-base mt-0.5 block">{totalMonthOtHours.toFixed(1)}h</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-3xs text-slate-500 font-bold uppercase block">Reliability</span>
                  <span className="font-bold text-blue-700 text-base mt-0.5 block">
                    {totalPresentDays === 0 ? '0%' : `${Math.min(100, Math.round((totalPresentDays / 26) * 100))}%`}
                  </span>
                </div>
              </div>

              {/* Monthly Daily Breakdown Table - REAL-TIME PUNCH ONLY */}
              {monthlyRecords.length === 0 ? (
                <div className="py-12 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50" id="empty-monthly-attendance">
                  <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    No Attendance Records Found
                  </h5>
                  <p className="text-2xs text-slate-400 mt-1 max-w-sm mx-auto">
                    This user has no attendance logs recorded yet. Entries will only be created from actual Punch-In / Punch-Out events or manual Admin overrides.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/70 border-b border-slate-200 text-2xs font-bold uppercase text-slate-600 tracking-wider">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Shift</th>
                        <th className="py-2.5 px-3">In &rarr; Out Times</th>
                        <th className="py-2.5 px-3 text-center">Regular</th>
                        <th className="py-2.5 px-3 text-center">OT Hours</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monthlyRecords.slice(0, 15).map((rec, idx) => (
                        <tr key={rec.id ? `mrec-${rec.id}` : `mrec-${rec.date}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-2xs font-bold text-slate-800">{rec.date}</td>
                          <td className="py-2.5 px-3 text-2xs text-slate-600">{rec.shift_name || assignedShift}</td>
                          <td className="py-2.5 px-3 font-mono text-2xs">
                            {rec.punchIn ? formatTimeTo12hStr(rec.punchIn) : '--:--'} &rarr;{' '}
                            {rec.punchOut ? formatTimeTo12hStr(rec.punchOut) : 'Active'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-semibold text-emerald-700">
                            {(rec.regularHours ?? rec.regular_hours ?? 0.0).toFixed(1)}h
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600">
                            {(rec.otHours ?? rec.ot_hours ?? 0.0).toFixed(1)}h
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span
                              className={`text-3xs font-bold px-2 py-0.5 rounded-full ${
                                rec.status === 'Present'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : rec.status === 'Weekly Off'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {rec.status || 'Present'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: OVERTIME (OT) RECORDS */}
          {activeTab === 'ot' && (
            <div className="mt-5 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 p-3.5 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-amber-600" />
                    <span>Overtime Policy &amp; Accumulated Balance</span>
                  </h4>
                  <p className="text-3xs text-amber-800 mt-0.5">
                    Strict hospital policy: Maximum 8.0h OT per day cap enforced. Continuous OT shifts count as 100% pure overtime.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xs text-amber-700 font-semibold block">Total OT Logged</span>
                  <span className="text-base font-extrabold text-amber-900 font-mono">
                    {totalMonthOtHours.toFixed(1)} hrs
                  </span>
                </div>
              </div>

              {/* OT Records Table */}
              {staffOtRecords.length === 0 ? (
                <div className="py-10 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50" id="empty-ot-records">
                  <Flame className="h-7 w-7 text-slate-300 mx-auto mb-1.5" />
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    No Attendance Records Found
                  </h5>
                  <p className="text-2xs text-slate-400 mt-1 max-w-xs mx-auto">
                    No overtime hours have been logged for this staff member yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/70 border-b border-slate-200 text-2xs font-bold uppercase text-slate-600 tracking-wider">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Department / Ward</th>
                        <th className="py-2.5 px-3">Shift Type</th>
                        <th className="py-2.5 px-3 text-center">OT Hours</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Authorized By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {staffOtRecords.map((ot, idx) => (
                        <tr key={ot.id ? `ot-${ot.id}` : `ot-${ot.date}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-2xs font-bold text-slate-800">{ot.date}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{ot.department}</td>
                          <td className="py-2.5 px-3 text-2xs text-slate-600">{ot.type}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600">
                            +{ot.hours.toFixed(1)}h
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-3xs font-bold px-2 py-0.5 rounded-full ${
                                ot.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ot.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {ot.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-2xs text-slate-500">{ot.authorizedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EMERGENCY EXIT LOGS */}
          {activeTab === 'emergency' && (
            <div className="mt-5 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between bg-rose-50 border border-rose-200 p-3.5 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    <span>Mid-Shift Emergency Departure Audit Trail</span>
                  </h4>
                  <p className="text-3xs text-rose-800 mt-0.5">
                    Records sudden departures during active duty. System computes pro-rata credited hours and notifies supervisor for reliever replacement.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xs text-rose-700 font-semibold block">Total Events</span>
                  <span className="text-base font-extrabold text-rose-900 font-mono">
                    {emergencyExitLogs.length} Event{emergencyExitLogs.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Emergency Departures Log Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-2xs font-bold uppercase text-slate-600 tracking-wider">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Departure Time</th>
                      <th className="py-2.5 px-3">Hours Credited</th>
                      <th className="py-2.5 px-3">Reason / Details</th>
                      <th className="py-2.5 px-3 text-right">Audit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {emergencyExitLogs.map((log, idx) => (
                      <tr key={log.id ? `elog-${log.id}` : `elog-${log.date}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-2xs font-bold text-slate-800">{log.date}</td>
                        <td className="py-2.5 px-3 font-mono text-2xs font-bold text-rose-700">{log.exitTime}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                          {log.regularHoursCredited.toFixed(1)}h Pro-rata
                        </td>
                        <td className="py-2.5 px-3 text-2xs text-slate-700 max-w-xs">{log.reason}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: QUICK ACTIONS (WITH SHIFT-GATING ENFORCEMENT) */}
          {activeTab === 'actions' && (
            <div className="mt-5 space-y-4 animate-in fade-in duration-200">
              {/* Shift-Gating Warning Banner if Supervisor is Off-Duty */}
              {effectiveIsShiftGated && (
                <div
                  id="profile-shift-gating-banner"
                  className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex items-start gap-3 shadow-xs"
                >
                  <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                      Shift-Gating Enforced (Supervisor Off-Duty)
                    </h4>
                    <p className="text-2xs text-amber-800 mt-0.5">
                      Live operational actions (reliever duty assignment and ward changes) are disabled because your supervisor status is currently Off-Duty. Punch In on the Supervisor Dashboard to unlock live floor re-allocations.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  id="btn-profile-assign-reliever"
                  disabled={effectiveIsShiftGated}
                  onClick={() => setActionPanel(actionPanel === 'reliever' ? 'none' : 'reliever')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    effectiveIsShiftGated
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                      : actionPanel === 'reliever'
                      ? 'bg-blue-800 text-white cursor-pointer shadow-xs'
                      : 'bg-[#1E3A8A] text-white hover:bg-blue-900 cursor-pointer shadow-xs'
                  }`}
                  title={effectiveIsShiftGated ? 'Locked: Supervisor is Off-Duty' : 'Assign reliever duty'}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  <span>Assign Reliever Duty</span>
                </button>

                <button
                  type="button"
                  id="btn-profile-change-ward"
                  disabled={effectiveIsShiftGated}
                  onClick={() => setActionPanel(actionPanel === 'ward' ? 'none' : 'ward')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    effectiveIsShiftGated
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                      : actionPanel === 'ward'
                      ? 'bg-black text-white cursor-pointer shadow-xs'
                      : 'bg-slate-800 text-white hover:bg-slate-900 cursor-pointer shadow-xs'
                  }`}
                  title={effectiveIsShiftGated ? 'Locked: Supervisor is Off-Duty' : 'Change assigned ward'}
                >
                  <Building className="h-3.5 w-3.5" />
                  <span>Change Assigned Ward</span>
                </button>

                {isAdminOrManager && (
                  <button
                    type="button"
                    id="btn-profile-reset-password"
                    onClick={() => setActionPanel(actionPanel === 'password' ? 'none' : 'password')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      actionPanel === 'password'
                        ? 'bg-amber-800 text-white shadow-xs'
                        : 'bg-amber-600 text-white hover:bg-amber-700 shadow-xs'
                    }`}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Reset Password ({userRole === 'admin' ? 'Admin' : 'Manager'})</span>
                  </button>
                )}
              </div>

              {/* Feedback Alert */}
              {actionSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{actionSuccessMsg}</span>
                </div>
              )}

              {/* Sub-panel: Assign Reliever Duty */}
              {actionPanel === 'reliever' && !isShiftGated && (
                <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-xl animate-in zoom-in-95">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
                      <ArrowRightLeft className="h-4 w-4 text-purple-700" />
                      <span>Assign Reliever Configuration</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setActionPanel('none')}
                      className="text-purple-700 hover:text-purple-900 text-xs font-bold p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <form onSubmit={handleAssignRelieverDuty} className="space-y-3">
                    <div>
                      <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                        Reliever Duty Type
                      </label>
                      <select
                        value={selectedDutyType}
                        onChange={(e) => setSelectedDutyType(e.target.value as DutyType)}
                        className="w-full text-xs font-semibold rounded-lg border border-purple-300 bg-white p-2 text-slate-800 cursor-pointer"
                      >
                        <option value="PERMANENT_RELIEVER">PERMANENT RELIEVER (Flexible Floor Pool)</option>
                        <option value="TEMP_RELIEVER">TEMPORARY RELIEVER (Active Emergency Shift)</option>
                        <option value="FIXED">FIXED DUTY (Standard Single Ward)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                        Target Ward / Duty Department
                      </label>
                      <select
                        value={selectedWard}
                        onChange={(e) => setSelectedWard(e.target.value)}
                        className="w-full text-xs font-semibold rounded-lg border border-purple-300 bg-white p-2 text-slate-800 cursor-pointer"
                      >
                        {DUTY_AREAS.map((ward) => (
                          <option key={ward} value={ward}>
                            {ward}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActionPanel('none')}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Confirm Reliever Assignment
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Sub-panel: Change Assigned Ward */}
              {actionPanel === 'ward' && !isShiftGated && (
                <div className="p-4 bg-slate-100 border border-slate-300 rounded-xl animate-in zoom-in-95">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Building className="h-4 w-4 text-slate-700" />
                      <span>Change Fixed Hospital Ward</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setActionPanel('none')}
                      className="text-slate-600 hover:text-slate-900 text-xs font-bold p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <form onSubmit={handleChangeWard} className="space-y-3">
                    <div>
                      <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                        Select New Assigned Ward
                      </label>
                      <select
                        value={selectedWard}
                        onChange={(e) => setSelectedWard(e.target.value)}
                        className="w-full text-xs font-semibold rounded-lg border border-slate-300 bg-white p-2 text-slate-800 cursor-pointer"
                      >
                        {DUTY_AREAS.map((ward) => (
                          <option key={ward} value={ward}>
                            {ward}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActionPanel('none')}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Save Assigned Ward
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Sub-panel: Reset Password */}
              {actionPanel === 'password' && userRole === 'admin' && (
                <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-xl animate-in zoom-in-95">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                      <KeyRound className="h-4 w-4 text-amber-700" />
                      <span>Admin Vault: Reset Account Password</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setActionPanel('none')}
                      className="text-amber-700 hover:text-amber-900 text-xs font-bold p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <form onSubmit={handleResetPassword} className="space-y-3">
                    <div>
                      <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                        New Plaintext Password
                      </label>
                      <input
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (e.g. Pass@1234)"
                        className="w-full text-xs font-mono rounded-lg border border-amber-300 bg-white p-2 text-slate-800"
                        required
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActionPanel('none')}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Update Vault Password
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: EMPLOYEE DOCUMENT VAULT (RBAC ONBOARDING) */}
          {activeTab === 'documents' && (
            <div className="mt-5 space-y-4 animate-in fade-in duration-200" id="profile-tab-documents">
              {/* Header Box */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <FolderLock className="h-4.5 w-4.5 text-[#1E3A8A]" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Onboarding Document Dossier
                    </h3>
                    <span className="text-2xs font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-[#1E3A8A] border border-blue-200 uppercase">
                      RBAC Mode: {userRole.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-2xs text-slate-500 mt-1">
                    Verified joining records, government identification, and mandatory hospital compliance credentials.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span>🟢</span>
                    <span>{docSummary.approved} Verified</span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-bold border ${
                      docSummary.pending > 0
                        ? 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse'
                        : 'bg-amber-50 text-amber-700 border-amber-200/60'
                    }`}
                  >
                    <span>🟡</span>
                    <span>{docSummary.pending} Pending Review</span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-bold border ${
                      docSummary.missingCount > 0
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>🔴</span>
                    <span>{docSummary.missingCount} Missing</span>
                  </span>
                </div>
              </div>

              {/* Action notice */}
              {actionSuccessMsg && (
                <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span>{actionSuccessMsg}</span>
                </div>
              )}

              {/* Mandatory Documents List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {MANDATORY_ONBOARDING_DOC_TYPES.map((reqType) => {
                  const existing = userDocuments.find((d) => d.docType.toLowerCase() === reqType.toLowerCase());

                  if (existing) {
                    const isApproved = existing.status === 'APPROVED';
                    const isPending = existing.status === 'PENDING' || existing.status === 'PENDING_APPROVAL';
                    const isRejected = existing.status === 'REJECTED';

                    return (
                      <div
                        key={existing.docId}
                        className={`p-3.5 rounded-xl border flex flex-col gap-2 relative overflow-hidden transition-all ${
                          isApproved
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : isPending
                            ? 'bg-amber-50/40 border-amber-200'
                            : 'bg-rose-50/40 border-rose-200'
                        }`}
                      >
                        {/* Dedicated Header Line: Document Type & Verification Status Badge */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <FileCheck className="h-4 w-4 text-[#1E3A8A] shrink-0" />
                            <span className="text-xs font-bold text-slate-900 truncate">{existing.docType}</span>
                          </div>

                          <div className="shrink-0">
                            {isApproved && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                                <span>🟢</span>
                                <span>Verified / Approved</span>
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse whitespace-nowrap">
                                <span>🟡</span>
                                <span>Pending Review</span>
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-rose-100 text-rose-800 border border-rose-200 whitespace-nowrap">
                                <span>🔴</span>
                                <span>Rejected</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Dedicated Filename Row */}
                        <div className="flex items-center gap-1.5 text-2xs font-mono text-slate-700 bg-slate-100/80 px-2 py-1.5 rounded-md border border-slate-200/60">
                          <FileText className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span className="truncate" title={existing.fileName}>
                            {existing.fileName}
                          </span>
                        </div>

                        {/* Metadata */}
                        <div className="text-3xs text-slate-500 space-y-0.5">
                          <div className="flex justify-between items-center">
                            <span>Uploaded: {existing.uploadedAt?.slice(0, 10)}</span>
                            <div className="flex items-center gap-1 font-mono">
                              {existing.originalFileSize && (
                                <span className="line-through text-slate-400 text-3xs">
                                  {existing.originalFileSize}
                                </span>
                              )}
                              <span className="font-semibold text-slate-700">{existing.fileSize || '300 KB'}</span>
                              {existing.compressionRatio && (
                                <span className="text-3xs font-bold text-emerald-700 bg-emerald-100 px-1 rounded">
                                  {existing.compressionRatio}
                                </span>
                              )}
                            </div>
                          </div>
                          {existing.verifiedBy && (
                            <div className="text-emerald-700 font-semibold truncate">
                              Verified by: {existing.verifiedBy} ({existing.verifiedAt?.slice(0, 10)})
                            </div>
                          )}
                          {existing.rejectionReason && (
                            <div className="text-rose-700 font-semibold truncate">
                              Reason: {existing.rejectionReason}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons strictly based on userRole RBAC */}
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-200/60 pt-2">
                          <button
                            type="button"
                            onClick={() => setDocPreviewTarget(existing)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-3xs font-bold cursor-pointer"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Preview</span>
                          </button>

                          <div className="flex items-center gap-1">
                            {/* Approve / Reject buttons visible to Admin & Manager only */}
                            {isPending && canApproveThisUser && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApproveDoc(existing)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-3xs font-bold cursor-pointer shadow-2xs"
                                  title="Approve and verify document"
                                >
                                  <Check className="h-3 w-3" />
                                  <span>Verify</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDocRejectTarget(existing)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-3xs font-bold cursor-pointer shadow-2xs"
                                  title="Reject document"
                                >
                                  <X className="h-3 w-3" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}

                            {/* Upload / Update file button */}
                            {canUploadForThisUser && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDocUploadType(existing.docType);
                                  const sId = matchedUser?.staff_id || matchedUser?.username || matchedUser?.id;
                                  const cleanType = existing.docType.split('(')[0].trim().replace(/\s+/g, '_');
                                  setDocUploadFileName(`${sId}_${cleanType}.pdf`);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 text-3xs font-bold cursor-pointer"
                              >
                                <Upload className="h-3 w-3 text-slate-500" />
                                <span>Update File</span>
                              </button>
                            )}

                            {/* Delete button: strictly Admin */}
                            {canDeleteThisUser && (
                              <button
                                type="button"
                                onClick={() => handleDeleteDoc(existing)}
                                className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded cursor-pointer"
                                title="Delete document (Admin Only)"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // MISSING DOCUMENT ITEM
                  return (
                    <div
                      key={reqType}
                      className="p-3.5 rounded-xl border border-dashed border-rose-300 bg-rose-50/20 flex flex-col gap-2 relative overflow-hidden justify-between"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-rose-200/60 pb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                          <span className="text-xs font-bold text-slate-900 truncate">{reqType}</span>
                        </div>

                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-rose-100 text-rose-800 border border-rose-200 shrink-0 whitespace-nowrap">
                          <span>🔴</span>
                          <span>Missing Document</span>
                        </span>
                      </div>

                      <p className="text-3xs text-rose-600 font-medium">
                        Mandatory joining file required for onboarding compliance.
                      </p>

                      <div className="flex items-center justify-end pt-1 border-t border-rose-100">
                        {canUploadForThisUser ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDocUploadType(reqType);
                              const sId = matchedUser?.staff_id || matchedUser?.username || matchedUser?.id;
                              const cleanType = reqType.split('(')[0].trim().replace(/\s+/g, '_');
                              setDocUploadFileName(`${sId}_${cleanType}.pdf`);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#1E3A8A] hover:bg-[#152e6f] text-white text-3xs font-bold transition shadow-2xs cursor-pointer"
                          >
                            <Upload className="h-3 w-3" />
                            <span>Upload Doc</span>
                          </button>
                        ) : (
                          <span className="text-3xs text-slate-400 italic">
                            Upload pending by Employee / Manager
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Upload Sub-Modal */}
              {docUploadType && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
                  <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4.5 w-4.5 text-[#1E3A8A]" />
                        <h4 className="text-xs font-bold text-slate-900">Upload: {docUploadType}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDocUploadType(null)}
                        className="p-1 text-slate-400 hover:text-slate-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className={`p-2.5 rounded-lg border text-2xs ${
                      userRole === 'admin' || userRole === 'manager'
                        ? 'bg-purple-50 text-purple-900 border-purple-200 font-semibold'
                        : 'bg-amber-50 text-amber-900 border-amber-200 font-semibold'
                    }`}>
                      {userRole === 'admin' || userRole === 'manager'
                        ? '🟢 Direct Manager/Admin Upload: Will be marked as Approved automatically.'
                        : '🟡 Staff Submission: Will be marked as PENDING_APPROVAL for Manager review.'}
                    </div>

                    <form onSubmit={handleConfirmUploadDoc} className="space-y-3 text-xs">
                      <div>
                        <label className="block text-3xs font-bold text-slate-700 uppercase mb-1">
                          File Name
                        </label>
                        <input
                          type="text"
                          required
                          value={docUploadFileName}
                          onChange={(e) => setDocUploadFileName(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-3xs font-bold text-slate-700 uppercase mb-1">
                          File Attachment (Automatic Client Compression)
                        </label>
                        <label className="relative border-2 border-dashed border-slate-300 hover:border-[#1E3A8A] rounded-xl p-3 text-center transition-colors cursor-pointer bg-slate-50 block group">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            onChange={handleDocFileSelect}
                            className="sr-only"
                            disabled={isCompressingDoc}
                          />
                          <FileText className="h-5 w-5 text-slate-400 group-hover:text-[#1E3A8A] mx-auto mb-1 transition-colors" />
                          <span className="text-2xs font-bold text-slate-700 block">
                            {selectedDocFile ? selectedDocFile.name : 'Click to Select Document (Image or PDF)'}
                          </span>
                          <span className="text-3xs text-slate-400 block mt-0.5">
                            Target ~300KB (1200px Max Dimension for Aadhaar/PAN)
                          </span>
                        </label>

                        {/* Progress Indicator */}
                        {isCompressingDoc && (
                          <div className="mt-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-2xs text-blue-900 space-y-1">
                            <div className="flex items-center justify-between font-bold">
                              <span className="flex items-center gap-1">
                                <RefreshCw className="h-3 w-3 animate-spin text-[#1E3A8A]" />
                                <span>Compressing & Optimizing Document...</span>
                              </span>
                              <span>{docCompressionProgress}%</span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-1">
                              <div
                                className="bg-[#1E3A8A] h-1 rounded-full transition-all duration-300"
                                style={{ width: `${docCompressionProgress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

                        {/* Compression Result Badge */}
                        {docCompressionResult && (
                          <div className="mt-2 p-2 rounded-lg border text-2xs space-y-1 bg-emerald-50 text-emerald-900 border-emerald-200 font-mono">
                            <div className="flex items-center justify-between font-bold">
                              <span className="flex items-center gap-1 text-emerald-800">
                                <CheckCircle className="h-3 w-3 text-emerald-600" />
                                <span>Compressed Successfully</span>
                              </span>
                              {docCompressionResult.isCompressed ? (
                                <span className="bg-emerald-600 text-white font-extrabold px-1.5 py-0.5 rounded text-3xs">
                                  Saved {docCompressionResult.savedPercentage}%
                                </span>
                              ) : (
                                <span className="text-3xs text-slate-500">PDF Ready</span>
                              )}
                            </div>
                            <div className="text-3xs text-emerald-800 flex items-center justify-between">
                              <span>Original: {docCompressionResult.originalFormatted}</span>
                              <span>&rarr;</span>
                              <span className="font-bold">Compressed: {docCompressionResult.compressedFormatted}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-3xs font-bold text-slate-700 uppercase mb-1">
                          Notes / ID Number (Optional)
                        </label>
                        <input
                          type="text"
                          value={docUploadNotes}
                          onChange={(e) => setDocUploadNotes(e.target.value)}
                          placeholder="e.g. Card verified against original"
                          className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setDocUploadType(null)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-[#152e6f] text-white text-xs font-bold cursor-pointer"
                        >
                          Save to Vault
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Reject Sub-Modal */}
              {docRejectTarget && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
                  <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2 text-rose-700">
                        <X className="h-4.5 w-4.5" />
                        <h4 className="text-xs font-bold">Reject Document</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDocRejectTarget(null)}
                        className="p-1 text-slate-400 hover:text-slate-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <form onSubmit={handleConfirmRejectDoc} className="space-y-3 text-xs">
                      <div>
                        <label className="block text-3xs font-bold text-slate-700 uppercase mb-1">
                          Rejection Reason
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={docRejectReason}
                          onChange={(e) => setDocRejectReason(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setDocRejectTarget(null)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Confirm Rejection
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Preview Sub-Modal */}
              {docPreviewTarget && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
                  <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-bold text-slate-900">{docPreviewTarget.docType}</h4>
                      <button
                        type="button"
                        onClick={() => setDocPreviewTarget(null)}
                        className="p-1 text-slate-400 hover:text-slate-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500">File:</span>
                        <span className="font-mono font-bold text-slate-800">{docPreviewTarget.fileName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Size:</span>
                        <div className="flex items-center gap-1 font-mono">
                          {docPreviewTarget.originalFileSize && (
                            <span className="line-through text-slate-400 text-3xs">
                              {docPreviewTarget.originalFileSize}
                            </span>
                          )}
                          <span className="font-semibold text-slate-800">{docPreviewTarget.fileSize || '300 KB'}</span>
                          {docPreviewTarget.compressionRatio && (
                            <span className="text-3xs font-bold text-emerald-700 bg-emerald-100 px-1 rounded">
                              {docPreviewTarget.compressionRatio}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Status:</span>
                        <span className="font-bold">
                          {docPreviewTarget.status === 'APPROVED' ? '🟢 Verified' : docPreviewTarget.status === 'REJECTED' ? '🔴 Rejected' : '🟡 Pending'}
                        </span>
                      </div>
                      {docPreviewTarget.verifiedBy && (
                        <div className="text-2xs text-emerald-800">
                          Verified by: {docPreviewTarget.verifiedBy}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setDocPreviewTarget(null)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-3xs text-slate-400">
          <span>ApexCare Hospital Housekeeping Management System</span>
          <span className="font-mono">Staff ID: {displayStaffCode}</span>
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfileModal;
