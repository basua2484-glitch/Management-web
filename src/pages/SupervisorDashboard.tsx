import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  LogIn,
  LogOut,
  Users,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  Filter,
  Search,
  UserCheck,
  History,
  Building2,
  Lock,
  ChevronRight,
  Timer,
  FileSpreadsheet,
  RefreshCw,
  PlusCircle,
  ThumbsUp,
  ThumbsDown,
  PhoneCall,
  AlertTriangle,
  Flame,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getStoredUsers,
  getStoredAttendance,
  saveStoredAttendance,
  getStoredDutyAllocations,
  approveDutyOtRequest,
  rejectDutyOtRequest,
  getSupervisorDutyState,
  setSupervisorDutyPunch,
  type SupervisorDutyState,
  INITIAL_STAFF,
  DUTY_AREAS,
  assignContinuousExtendedOt,
  dispatchEmergencyRecall,
  approveEmergencyRecall,
  getStoredEmergencyRecalls,
  getTodayIso,
} from '../data/mockHousekeepingData';
import type { AppUser, AttendanceRecord, DutyAllocation, StaffUser, EmergencyRecallAlert } from '../types';
import { DutyAssignmentModal } from '../components/DutyAssignmentModal';
import { EmployeeProfileModal } from '../components/EmployeeProfileModal';
import { GeofenceRejectionModal } from '../components/GeofenceRejectionModal';
import { GpsHardwareAlertModal } from '../components/GpsHardwareAlertModal';
import {
  verifyHospitalGeofence,
  requestLocationOnPunch,
  HOSPITAL_LAT,
  HOSPITAL_LNG,
  GPS_OFF_ALERT_MESSAGE,
  getStoredGeofenceConfig,
  type GeofenceVerificationResult,
} from '../utils/geofence';
import { formatTimeTo12hStr, SHIFTS } from '../utils/attendanceCalculator';

export const SupervisorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user: authUser, logout, role: authRole } = useAuth();

  const effectiveSupervisorId = authUser?.staff_id || authUser?.username || 'SUP-001';
  const supervisorName = authUser?.full_name || authUser?.name || 'Supervisor';

  // Selected date for attendance (defaults to current dynamic system date)
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayIso());
  const [users, setUsers] = useState<AppUser[]>(() => getStoredUsers());
  const [records, setRecords] = useState<AttendanceRecord[]>(() => getStoredAttendance());
  const [dutyAllocations, setDutyAllocations] = useState<DutyAllocation[]>(() => getStoredDutyAllocations());
  const [emergencyRecalls, setEmergencyRecalls] = useState<EmergencyRecallAlert[]>(() => getStoredEmergencyRecalls());

  // Supervisor On-Duty Punch State
  const [dutyState, setDutyState] = useState<SupervisorDutyState>(() =>
    getSupervisorDutyState(effectiveSupervisorId, selectedDate)
  );
  const [isLocatingDuty, setIsLocatingDuty] = useState(false);
  const [isGpsModalOpen, setIsGpsModalOpen] = useState(false);

  // Geofence Rejection Popup Modal State
  const [rejectionModalState, setRejectionModalState] = useState<{
    isOpen: boolean;
    result: GeofenceVerificationResult | null;
    punchType: 'IN' | 'OUT';
  }>({
    isOpen: false,
    result: null,
    punchType: 'IN',
  });

  // Search & Filter state for Live Staff
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ON_DUTY' | 'OT_ACTIVE' | 'ABSENT'>('ALL');

  // Reliever Assignment Modal state
  const [isRelieverModalOpen, setIsRelieverModalOpen] = useState(false);
  const [selectedStaffForReliever, setSelectedStaffForReliever] = useState<number | null>(null);
  const [selectedProfileStaffId, setSelectedProfileStaffId] = useState<string | null>(null);

  // Continuous Extended OT Modal State
  const [isContinuousOtModalOpen, setIsContinuousOtModalOpen] = useState(false);
  const [continuousOtStaffCode, setContinuousOtStaffCode] = useState('HK-001');
  const [continuousOtHours, setContinuousOtHours] = useState(4.0);
  const [continuousOtWard, setContinuousOtWard] = useState('3rd Floor Wards & Critical Care');
  const [continuousOtNotes, setContinuousOtNotes] = useState('Immediate Post-Shift Back-to-Back Deep Sanitation Coverage');
  const [isSubmittingContinuousOt, setIsSubmittingContinuousOt] = useState(false);

  // Emergency Recall Modal State
  const [isRecallModalOpen, setIsRecallModalOpen] = useState(false);
  const [recallStaffCode, setRecallStaffCode] = useState('HK-002');
  const [recallWard, setRecallWard] = useState('Emergency / Trauma Center');
  const [recallReason, setRecallReason] = useState('Critical Ward Understaffing & Acute Patient Spill Sanitization');
  const [isSubmittingRecall, setIsSubmittingRecall] = useState(false);

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'info'; text: string } | null>(null);

  // Sync data on window events
  useEffect(() => {
    const handleUpdate = () => {
      setRecords(getStoredAttendance());
      setDutyAllocations(getStoredDutyAllocations());
      setUsers(getStoredUsers());
      setEmergencyRecalls(getStoredEmergencyRecalls());
    };

    const handleDutyPunch = (e: any) => {
      if (e.detail && e.detail.supervisorId === effectiveSupervisorId) {
        setDutyState(e.detail);
      }
    };

    window.addEventListener('attendance-updated', handleUpdate);
    window.addEventListener('ot-requests-updated', handleUpdate);
    window.addEventListener('emergency-recall-updated', handleUpdate);
    window.addEventListener('emergency-recall-dispatched', handleUpdate);
    window.addEventListener('continuous-ot-assigned', handleUpdate);
    window.addEventListener('supervisor-duty-punch-changed', handleDutyPunch);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('attendance-updated', handleUpdate);
      window.removeEventListener('ot-requests-updated', handleUpdate);
      window.removeEventListener('emergency-recall-updated', handleUpdate);
      window.removeEventListener('emergency-recall-dispatched', handleUpdate);
      window.removeEventListener('continuous-ot-assigned', handleUpdate);
      window.removeEventListener('supervisor-duty-punch-changed', handleDutyPunch);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [effectiveSupervisorId]);

  // Handle Supervisor Duty Punch In / Punch Out
  const handleToggleSupervisorDuty = async () => {
    const nextAction = dutyState.isPunchedIn ? 'OUT' : 'IN';
    setIsLocatingDuty(true);
    let punchLocationResult;
    try {
      // Explicitly triggers navigator.geolocation only upon click with 5-second timeout
      punchLocationResult = await requestLocationOnPunch(nextAction);
    } catch (err: any) {
      console.warn('Supervisor location check error:', err);
      if (err?.isGpsOff || err?.code === 2 || err?.code === 3 || err?.message === GPS_OFF_ALERT_MESSAGE) {
        punchLocationResult = {
          allowed: false,
          userCoords: { lat: 0, lng: 0 },
          distanceMeters: 999999,
          maxRadiusMeters: 100,
          isGps: false,
          isGpsOff: true,
          gpsErrorMessage: GPS_OFF_ALERT_MESSAGE,
          reason: GPS_OFF_ALERT_MESSAGE,
          source: 'DEVICE_GPS' as const,
        };
      }
    } finally {
      setIsLocatingDuty(false);
    }

    // 3. If device GPS is turned OFF, immediately display clear alert
    if (punchLocationResult?.isGpsOff) {
      const alertMsg = GPS_OFF_ALERT_MESSAGE;
      setIsGpsModalOpen(true);
      setFeedback({
        type: 'warning',
        text: alertMsg,
      });
      try {
        window.alert(alertMsg);
      } catch {}
      return;
    }

    if (!punchLocationResult || !punchLocationResult.isGps || !punchLocationResult.allowed) {
      const verification: GeofenceVerificationResult = punchLocationResult
        ? verifyHospitalGeofence(punchLocationResult.userCoords.lat, punchLocationResult.userCoords.lng)
        : (() => {
            const activeGeofence = getStoredGeofenceConfig();
            return {
              allowed: false,
              distanceMeters: 999999,
              maxAllowedRadius: activeGeofence.maxAllowedRadiusMeters,
              maxRadiusMeters: activeGeofence.maxAllowedRadiusMeters,
              hospitalCoords: { lat: activeGeofence.hospitalLat, lng: activeGeofence.hospitalLng },
              userCoords: { lat: 0, lng: 0 },
              status: 'OUTSIDE_GEOFENCE' as const,
              message: 'Real GPS lock required. Live coordinates could not be verified.',
              reason: `GPS lock required within ${activeGeofence.maxAllowedRadiusMeters}m perimeter.`,
            };
          })();

      setRejectionModalState({
        isOpen: true,
        result: verification,
        punchType: nextAction,
      });
      setFeedback({
        type: 'warning',
        text: `Punch Failed: You are Outside Hospital Boundary (${verification.distanceMeters < 900000 ? verification.distanceMeters.toFixed(1) + 'm away' : 'Real GPS signal required'})`,
      });
      return;
    }

    const verification: GeofenceVerificationResult = verifyHospitalGeofence(
      punchLocationResult.userCoords.lat,
      punchLocationResult.userCoords.lng
    );

    const next = setSupervisorDutyPunch(
      effectiveSupervisorId,
      nextAction,
      dutyState.activeShiftWard || '3rd Floor Wards & Critical Care',
      selectedDate
    );
    setDutyState(next);

    setFeedback({
      type: next.isPunchedIn ? 'success' : 'warning',
      text: next.isPunchedIn
        ? `Supervisor Punched In for duty at ${next.punchInTime} (${verification.distanceMeters.toFixed(1)}m from center). Live operational tools & OT approvals are active.`
        : `Supervisor Punched Out at ${next.punchOutTime}. System switched to Read-Only Past History mode.`,
    });
  };

  // Housekeeping staff list
  const staffList: StaffUser[] = useMemo(() => {
    return users
      .filter((u) => u.role === 'staff' || !u.role)
      .map((u) => {
        const uAny = u as any;
        return {
          id: u.id,
          staffCode: u.staff_id || `HK-${String(u.id).padStart(3, '0')}`,
          name: u.name,
          role: 'staff' as const,
          department: u.assigned_area || u.department || 'General',
          shift: (u.assigned_shift === '7-3' ? 'Morning' : u.assigned_shift === '3-11' ? 'Evening' : 'Night') as any,
          hourlyRate: uAny.hourly_rate || uAny.hourlyRate || 15,
          phone: uAny.phone || '',
          active: u.status !== 'DISABLED',
        };
      });
  }, [users]);

  // Active pending Overtime requests submitted by staff
  const pendingOtRequests = useMemo(() => {
    return dutyAllocations.filter((a) => a.ot_status === 'PENDING');
  }, [dutyAllocations]);

  // Past / approved OT requests for history view
  const historicalOtRequests = useMemo(() => {
    return dutyAllocations.filter((a) => a.ot_status === 'APPROVED' || a.ot_status === 'REJECTED');
  }, [dutyAllocations]);

  // Handle OT Approval
  const handleApproveOt = (allocationId: number) => {
    if (!dutyState.isPunchedIn) {
      setFeedback({
        type: 'warning',
        text: 'Action restricted: You must Punch In on duty to approve active overtime requests.',
      });
      return;
    }

    const res = approveDutyOtRequest(allocationId, `${supervisorName} (${effectiveSupervisorId})`);
    setDutyAllocations(getStoredDutyAllocations());
    setRecords(getStoredAttendance());

    setFeedback({
      type: 'success',
      text: 'Overtime extension request approved successfully. Staff record synchronized.',
    });
  };

  // Handle OT Rejection
  const handleRejectOt = (allocationId: number) => {
    if (!dutyState.isPunchedIn) {
      setFeedback({
        type: 'warning',
        text: 'Action restricted: You must Punch In on duty to manage overtime requests.',
      });
      return;
    }

    const res = rejectDutyOtRequest(allocationId, `${supervisorName} (${effectiveSupervisorId})`);
    setDutyAllocations(getStoredDutyAllocations());

    setFeedback({
      type: 'info',
      text: 'Overtime extension request rejected.',
    });
  };

  // Handle Dispatch Emergency Recall
  const handleDispatchRecall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dutyState.isPunchedIn) {
      setFeedback({
        type: 'warning',
        text: 'Action restricted: You must Punch In on duty to dispatch emergency recall alerts.',
      });
      return;
    }

    setIsSubmittingRecall(true);
    try {
      const res = dispatchEmergencyRecall({
        staffId: recallStaffCode,
        date: selectedDate,
        reason: recallReason,
        department: recallWard,
        supervisorId: effectiveSupervisorId,
        supervisorName,
      });

      if (res && res.id) {
        setFeedback({
          type: 'success',
          text: `🚨 Emergency Recall dispatched to ${recallStaffCode} for ${recallWard}. Hours will convert to 100% pure OT upon authorization.`,
        });
        setEmergencyRecalls(getStoredEmergencyRecalls());
        setIsRecallModalOpen(false);
      } else {
        setFeedback({ type: 'warning', text: 'Unable to dispatch recall alert.' });
      }
    } catch (err) {
      setFeedback({ type: 'warning', text: 'Failed to dispatch recall alert.' });
    } finally {
      setIsSubmittingRecall(false);
    }
  };

  // Handle Approve Emergency Recall Pure OT
  const handleApproveRecallOt = (alertId: string) => {
    if (!dutyState.isPunchedIn) {
      setFeedback({
        type: 'warning',
        text: 'Action restricted: You must Punch In on duty to authorize emergency recall overtime.',
      });
      return;
    }

    const res = approveEmergencyRecall(alertId, supervisorName);
    if (res.success) {
      setFeedback({
        type: 'success',
        text: `Emergency recall approved! ${res.message} (Strict 8.0h OT cap enforced).`,
      });
      setEmergencyRecalls(getStoredEmergencyRecalls());
      setRecords(getStoredAttendance());
    } else {
      setFeedback({ type: 'warning', text: res.message });
    }
  };

  // Handle Assign Continuous Extended OT
  const handleAssignContinuousOt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dutyState.isPunchedIn) {
      setFeedback({
        type: 'warning',
        text: 'Action restricted: You must Punch In on duty to assign continuous overtime shifts.',
      });
      return;
    }

    setIsSubmittingContinuousOt(true);
    try {
      const res = assignContinuousExtendedOt({
        staffId: continuousOtStaffCode,
        date: selectedDate,
        hours: continuousOtHours,
        department: continuousOtWard,
        notes: continuousOtNotes,
        supervisorId: effectiveSupervisorId,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          text: `Continuous Extended OT shift assigned to ${continuousOtStaffCode} (+${continuousOtHours}h pure OT, capped at 8.0h). Staff record synchronized.`,
        });
        setRecords(getStoredAttendance());
        setDutyAllocations(getStoredDutyAllocations());
        setIsContinuousOtModalOpen(false);
      } else {
        setFeedback({ type: 'warning', text: res.message });
      }
    } catch (err) {
      setFeedback({ type: 'warning', text: 'Failed to assign continuous overtime.' });
    } finally {
      setIsSubmittingContinuousOt(false);
    }
  };

  // Live Staff Roster enriched with today's attendance & duty details
  const enrichedStaffRoster = useMemo(() => {
    return staffList.map((staff) => {
      const user = users.find((u) => u.id === staff.id);
      const rec = records.find(
        (r) =>
          r.date === selectedDate &&
          (r.userId === staff.id || (r.staff_id && r.staff_id.toLowerCase() === staff.staffCode.toLowerCase()))
      );
      const otAlloc = dutyAllocations.find(
        (a) => a.date === selectedDate && a.staff_id.toLowerCase() === staff.staffCode.toLowerCase()
      );

      // Determine attendance state
      let statusLabel: 'PUNCHED_IN' | 'PUNCHED_OUT' | 'NOT_STARTED' | 'WEEKLY_OFF' | 'ON_LEAVE' = 'NOT_STARTED';
      if (rec?.status === 'Weekly Off') {
        statusLabel = 'WEEKLY_OFF';
      } else if (rec?.status === 'On Leave' || rec?.status === 'Absent') {
        statusLabel = 'ON_LEAVE';
      } else if (rec?.punchOut) {
        statusLabel = 'PUNCHED_OUT';
      } else if (rec?.punchIn) {
        statusLabel = 'PUNCHED_IN';
      }

      const isOtActive = (rec?.otHours && rec.otHours > 0) || otAlloc?.ot_status === 'APPROVED';

      return {
        ...staff,
        dutyType: user?.duty_type || 'FIXED',
        assignedShift: user?.assigned_shift || '7-3',
        department: otAlloc?.assigned_department || user?.assigned_area || staff.department,
        punchIn: rec?.punchIn || null,
        punchOut: rec?.punchOut || null,
        regularHours: rec?.regularHours || 0,
        otHours: rec?.otHours || (otAlloc?.ot_status === 'APPROVED' ? otAlloc.ot_requested_hours : 0),
        statusLabel,
        isOtActive,
        otStatus: otAlloc?.ot_status || 'NONE',
      };
    });
  }, [staffList, users, records, dutyAllocations, selectedDate]);

  // Filtered live staff
  const filteredStaff = useMemo(() => {
    return enrichedStaffRoster.filter((staff) => {
      const matchesSearch =
        staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.staffCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.department.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'ON_DUTY') return staff.statusLabel === 'PUNCHED_IN';
      if (statusFilter === 'OT_ACTIVE') return staff.isOtActive;
      if (statusFilter === 'ABSENT') return staff.statusLabel === 'ON_LEAVE' || staff.statusLabel === 'WEEKLY_OFF';

      return true;
    });
  }, [enrichedStaffRoster, searchTerm, statusFilter]);

  // Metrics calculation
  const totalStaffCount = staffList.length;
  const punchedInCount = enrichedStaffRoster.filter((s) => s.statusLabel === 'PUNCHED_IN').length;
  const otActiveCount = enrichedStaffRoster.filter((s) => s.isOtActive).length;
  const absentCount = enrichedStaffRoster.filter((s) => s.statusLabel === 'ON_LEAVE' || s.statusLabel === 'WEEKLY_OFF').length;
  const relieversCount = enrichedStaffRoster.filter((s) => s.dutyType !== 'FIXED').length;

  // Save reliever assignment from modal
  const handleSaveDutyAssignment = (rec: AttendanceRecord, updatedArea?: string) => {
    const updated = records.map((r) => (r.id === rec.id ? rec : r));
    if (!records.some((r) => r.id === rec.id)) {
      updated.unshift(rec);
    }
    saveStoredAttendance(updated);
    setRecords(updated);

    if (updatedArea && selectedStaffForReliever) {
      const updatedUsers = users.map((u) => {
        if (u.id === selectedStaffForReliever) {
          return {
            ...u,
            assigned_area: updatedArea,
            is_temp_reliever: true,
            temp_department: updatedArea,
          };
        }
        return u;
      });
      setUsers(updatedUsers);
    }

    setIsRelieverModalOpen(false);
    setSelectedStaffForReliever(null);
    setFeedback({
      type: 'success',
      text: `Reliever successfully assigned to ${updatedArea || 'Ward'}.`,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-16">
      {/* Top Header */}
      <header className="bg-[#1E3A8A] text-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <ShieldCheck className="h-5 w-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base tracking-tight text-white">ApexCare Health</span>
                <span className="bg-amber-500/90 text-amber-950 text-3xs font-bold px-2 py-0.5 rounded-full uppercase">
                  Supervisor Terminal
                </span>
              </div>
              <p className="text-3xs text-blue-200">
                Supervisor: <b className="text-white">{supervisorName}</b> ({effectiveSupervisorId}) &bull; Active Sector: {dutyState.activeShiftWard}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Direct Switch to Staff Portal if testing */}
            <button
              type="button"
              id="btn-switch-staff-portal"
              onClick={() => navigate('/staff/dashboard')}
              className="text-xs bg-white/10 hover:bg-white/20 text-white font-medium px-3 py-1.5 rounded-lg border border-white/20 transition-colors"
            >
              Staff Portal
            </button>

            {authRole === 'ADMIN' && (
              <button
                type="button"
                id="btn-switch-admin-dash"
                onClick={() => navigate('/admin/dashboard')}
                className="text-xs bg-white/10 hover:bg-white/20 text-white font-medium px-3 py-1.5 rounded-lg border border-white/20 transition-colors"
              >
                Admin Dashboard
              </button>
            )}

            {/* Logout */}
            <button
              type="button"
              id="btn-supervisor-logout"
              onClick={() => logout(navigate)}
              className="flex items-center gap-1 text-xs bg-rose-600/90 hover:bg-rose-600 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-6">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl text-xs font-medium border flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : feedback.type === 'warning'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-blue-50 text-blue-900 border-blue-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 text-xs px-1 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 1. SUPERVISOR ON-DUTY STATUS CHECK BAR */}
        <section
          id="supervisor-duty-status-card"
          className={`rounded-2xl p-4 sm:p-5 border shadow-sm transition-all ${
            dutyState.isPunchedIn
              ? 'bg-gradient-to-r from-emerald-900/10 via-emerald-800/5 to-white border-emerald-500/40 text-emerald-950'
              : 'bg-gradient-to-r from-amber-900/10 via-amber-800/5 to-white border-amber-500/40 text-amber-950'
          }`}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {dutyState.isPunchedIn ? (
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                </span>
              ) : (
                <div className="h-4 w-4 rounded-full bg-amber-500"></div>
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    {dutyState.isPunchedIn
                      ? 'Supervisor On-Duty Check: ACTIVE (Live Controls & Approvals Enabled)'
                      : 'Supervisor On-Duty Check: OFF-DUTY (Read-Only Past History Mode)'}
                  </h2>
                  <span
                    className={`text-2xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                      dutyState.isPunchedIn
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {dutyState.isPunchedIn ? 'LIVE OPERATIONAL' : 'READ-ONLY ARCHIVE'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {dutyState.isPunchedIn
                    ? `Punched In at ${dutyState.punchInTime} • Supervising ${dutyState.activeShiftWard} • Live WebSocket feed authorized`
                    : `Punched Out at ${dutyState.punchOutTime || '03:00 PM'} • Live controls and OT approvals are disabled until punched in`}
                </p>
              </div>
            </div>

            {/* Duty Punch In / Punch Out Toggle */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                type="button"
                id="btn-supervisor-duty-punch"
                onClick={handleToggleSupervisorDuty}
                disabled={isLocatingDuty}
                className={`w-full md:w-auto px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer ${
                  isLocatingDuty
                    ? 'opacity-70 cursor-wait bg-slate-700 text-white'
                    : dutyState.isPunchedIn
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isLocatingDuty ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Verifying Location & GPS...</span>
                  </>
                ) : dutyState.isPunchedIn ? (
                  <>
                    <LogOut className="h-4 w-4" />
                    <span>Punch Out of Shift (Go Off-Duty)</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>Punch In for Shift (Activate Live Tools)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Off-Duty Notice if Punched Out */}
          {!dutyState.isPunchedIn && (
            <div className="mt-4 p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <b className="font-bold">Notice to Supervisor:</b> You are currently in Off-Duty state. Live operational controls, reliever allocation actions, and real-time overtime approval buttons are locked. You may inspect past shift history below, or click <b>"Punch In for Shift"</b> to resume active on-duty supervision.
              </div>
            </div>
          )}
        </section>

        {/* 2. SUMMARY COUNTERS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-2xs font-bold text-slate-500 uppercase">Total Housekeeping Staff</div>
            <div className="text-2xl font-bold text-[#1E3A8A] mt-0.5">{totalStaffCount}</div>
            <div className="text-3xs text-slate-400">Registered hospital roster</div>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-2xs font-bold text-slate-500 uppercase">Currently Punched In</div>
            <div className="text-2xl font-bold text-emerald-600 mt-0.5">{punchedInCount}</div>
            <div className="text-3xs text-slate-400">Active on floors right now</div>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-2xs font-bold text-slate-500 uppercase">Pending Overtime (OT)</div>
            <div className="text-2xl font-bold text-amber-600 mt-0.5">{pendingOtRequests.length}</div>
            <div className="text-3xs text-slate-400">Awaiting supervisor sign-off</div>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-2xs font-bold text-slate-500 uppercase">Relievers Available</div>
            <div className="text-2xl font-bold text-purple-600 mt-0.5">{relieversCount}</div>
            <div className="text-3xs text-slate-400">Perm &amp; Temp reliever staff</div>
          </div>
        </div>

        {/* 3. CONDITIONAL WORKSPACE: IF ON-DUTY (LIVE TOOLS + OT APPROVALS) VS OFF-DUTY (READ-ONLY HISTORY) */}
        {dutyState.isPunchedIn ? (
          /* =========================================================================
             ON-DUTY WORKSPACE: LIVE STAFF STATUS, RELIEVER TOOLS, AND OT APPROVALS
             ========================================================================= */
          <div className="space-y-6">
            {/* Active OT Approvals Section */}
            <section
              id="supervisor-active-ot-approvals"
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Timer className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Active Overtime (OT) Extension Approvals</h3>
                    <p className="text-3xs text-slate-500">
                      Authorize or decline extra hours requested by housekeeping staff for today
                    </p>
                  </div>
                </div>

                <span className="text-2xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  {pendingOtRequests.length} Pending Approval{pendingOtRequests.length === 1 ? '' : 's'}
                </span>
              </div>

              {pendingOtRequests.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-emerald-500" />
                  All overtime requests are cleared. No pending requests awaiting supervisor authorization.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {pendingOtRequests.map((alloc) => {
                    const staff = staffList.find((s) => s.staffCode.toLowerCase() === alloc.staff_id.toLowerCase());
                    return (
                      <div
                        key={alloc.id}
                        className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2.5 hover:shadow-xs transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-xs font-bold text-slate-900">{staff?.name || 'Staff Member'}</div>
                            <div className="text-2xs font-mono text-slate-500">{alloc.staff_id}</div>
                          </div>
                          <span className="font-mono text-xs font-extrabold bg-amber-500 text-white px-2 py-0.5 rounded-md">
                            +{alloc.ot_requested_hours}h OT
                          </span>
                        </div>

                        <div className="text-2xs text-slate-600 space-y-0.5">
                          <div>
                            Area: <b className="text-slate-800">{alloc.assigned_department}</b>
                          </div>
                          {alloc.notes && (
                            <div className="italic text-slate-500">Reason: "{alloc.notes}"</div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-amber-200/60">
                          <button
                            type="button"
                            onClick={() => handleApproveOt(alloc.id)}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-2xs font-bold flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            <span>Approve OT (+{alloc.ot_requested_hours}h)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectOt(alloc.id)}
                            className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-2xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Emergency Staff Shortage & Recall Console */}
            <section
              id="supervisor-emergency-recalls"
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <PhoneCall className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Emergency Staff Recall &amp; Shortage Management</h3>
                    <p className="text-3xs text-slate-500">
                      Dispatch immediate recall alerts to off-duty staff. Accepted recalls convert 100% of hours into Overtime (Capped at 8.0h Max).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-open-dispatch-recall-modal"
                  onClick={() => setIsRecallModalOpen(true)}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span>Dispatch Emergency Recall</span>
                </button>
              </div>

              {/* Recalls List */}
              {emergencyRecalls.filter((r) => r.date === selectedDate).length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <ShieldCheck className="h-6 w-6 mx-auto mb-1 text-emerald-500" />
                  No emergency shortages or active recalls dispatched for today.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {emergencyRecalls
                    .filter((r) => r.date === selectedDate)
                    .map((alert) => {
                      const staffCode = alert.staffId || alert.staff_id || '';
                      const staff = staffList.find(
                        (s) => s.staffCode.toLowerCase() === staffCode.toLowerCase()
                      );
                      const isApproved = alert.status === 'APPROVED' || alert.status === 'APPROVED_OT';
                      return (
                        <div
                          key={alert.id}
                          className={`p-4 rounded-xl border space-y-2.5 hover:shadow-xs transition-all ${
                            alert.status === 'ACCEPTED'
                              ? 'border-emerald-300 bg-emerald-50/40'
                              : isApproved
                              ? 'border-blue-300 bg-blue-50/40'
                              : 'border-rose-200 bg-rose-50/40'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="text-xs font-bold text-slate-900">{staff?.name || alert.staffName || staffCode}</div>
                              <div className="text-2xs font-mono text-slate-500">{staffCode}</div>
                            </div>
                            <span
                              className={`text-2xs font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${
                                alert.status === 'ACCEPTED'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse'
                                  : isApproved
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : 'bg-rose-100 text-rose-800 border-rose-300'
                              }`}
                            >
                              {alert.status === 'ACCEPTED'
                                ? 'STAFF ACCEPTED - READY FOR OT'
                                : isApproved
                                ? '✓ APPROVED PURE OT'
                                : 'AWAITING STAFF RESPONSE'}
                            </span>
                          </div>

                          <div className="text-2xs text-slate-600 space-y-0.5">
                            <div>
                              Shortage Area: <b className="text-slate-800">{alert.department}</b>
                            </div>
                            <div className="italic text-slate-500">Reason: "{alert.reason}"</div>
                            <div className="text-3xs text-slate-400">
                              Dispatched: {new Date(alert.dispatchedAt || alert.dispatched_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} by {alert.supervisorName || alert.supervisor_name || 'Supervisor'}
                            </div>
                          </div>

                          {alert.status === 'ACCEPTED' && (
                            <div className="pt-2 border-t border-emerald-200/60">
                              <button
                                type="button"
                                id={`btn-approve-recall-${alert.id}`}
                                onClick={() => handleApproveRecallOt(alert.id)}
                                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-2xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Authorize 100% Pure OT (Max 8.0h Cap)</span>
                              </button>
                            </div>
                          )}

                          {isApproved && (
                            <div className="text-3xs font-bold text-blue-700 bg-blue-100/70 p-2 rounded-lg flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                              <span>Pure Overtime conversion active for this shift (Tagged as RECALL_OT).</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </section>

            {/* Reliever & Dynamic Shift Allocation Tools Bar */}
            <section
              id="supervisor-reliever-tools"
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Reliever &amp; Dynamic Duty Allocation Tools</h3>
                    <p className="text-3xs text-slate-500">
                      Deploy reliever staff or assign back-to-back Continuous Extended OT shifts (pure OT tagged)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    id="btn-open-continuous-ot-modal"
                    onClick={() => setIsContinuousOtModalOpen(true)}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Timer className="h-4 w-4" />
                    <span>Assign Continuous Extended OT</span>
                  </button>
                  <button
                    type="button"
                    id="btn-open-reliever-modal"
                    onClick={() => setIsRelieverModalOpen(true)}
                    className="px-3.5 py-1.5 bg-[#1E3A8A] hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>Allocate Reliever to Ward</span>
                  </button>
                </div>
              </div>

              {/* Relievers quick status chips */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {enrichedStaffRoster
                  .filter((s) => s.dutyType !== 'FIXED')
                  .map((reliever) => (
                    <div
                      key={reliever.id}
                      className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{reliever.name}</div>
                        <div className="text-2xs text-purple-700 font-semibold">{reliever.department}</div>
                        <div className="text-3xs text-slate-400 font-mono">{reliever.dutyType}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStaffForReliever(reliever.id);
                          setIsRelieverModalOpen(true);
                        }}
                        className="text-3xs bg-white text-purple-800 border border-purple-300 font-bold px-2 py-1 rounded-lg hover:bg-purple-100 transition-colors"
                      >
                        Re-allocate
                      </button>
                    </div>
                  ))}
              </div>
            </section>

            {/* Live Staff Status Table */}
            <section
              id="supervisor-live-staff-status"
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Live Staff Floor Status</h3>
                  <p className="text-3xs text-slate-500">Real-time attendance, active shifts, and punch-in timestamps</p>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                  <div className="relative flex-1 sm:w-48">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search staff, code, ward..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-2xs font-semibold">
                    {(['ALL', 'ON_DUTY', 'OT_ACTIVE', 'ABSENT'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setStatusFilter(filter)}
                        className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                          statusFilter === filter ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500'
                        }`}
                      >
                        {filter.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-2xs font-bold uppercase text-slate-500 tracking-wider">
                      <th className="py-2.5 px-3">Staff Member</th>
                      <th className="py-2.5 px-3">Assigned Ward</th>
                      <th className="py-2.5 px-3">Shift</th>
                      <th className="py-2.5 px-3">Duty Type</th>
                      <th className="py-2.5 px-3">Punch Status</th>
                      <th className="py-2.5 px-3 text-right">Hours (Reg / OT)</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStaff.map((staff) => (
                      <tr
                        key={staff.id}
                        id={`row-supervisor-live-staff-${staff.id}`}
                        onClick={() => setSelectedProfileStaffId(staff.staffCode)}
                        className="hover:bg-blue-50/60 transition-colors cursor-pointer group"
                        title="Click row to open Employee Profile Drill-Down Modal"
                      >
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProfileStaffId(staff.staffCode);
                            }}
                            className="text-left font-bold text-slate-900 group-hover:text-[#1E3A8A] hover:underline underline-offset-2 transition-colors cursor-pointer bg-transparent border-0 p-0 block"
                            title="Click to inspect profile and manage reliever/ward"
                          >
                            {staff.name}
                          </button>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-2xs font-mono text-slate-500 bg-slate-100 px-1 rounded">{staff.staffCode}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700">{staff.department}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {staff.assignedShift}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`text-3xs font-bold px-2 py-0.5 rounded-full uppercase ${
                              staff.dutyType === 'FIXED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {staff.dutyType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            {staff.statusLabel === 'PUNCHED_IN' ? (
                              <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                In: {formatTimeTo12hStr(staff.punchIn)}
                              </span>
                            ) : staff.statusLabel === 'PUNCHED_OUT' ? (
                              <span className="text-2xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                Out: {formatTimeTo12hStr(staff.punchOut)}
                              </span>
                            ) : staff.statusLabel === 'WEEKLY_OFF' ? (
                              <span className="text-2xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                                Weekly Off
                              </span>
                            ) : staff.statusLabel === 'ON_LEAVE' ? (
                              <span className="text-2xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                                On Leave
                              </span>
                            ) : (
                              <span className="text-2xs text-slate-400">Not Punched</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <span className="font-bold text-[#1E3A8A]">{staff.regularHours}h</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="font-bold text-amber-600">{staff.otHours}h</span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProfileStaffId(staff.staffCode);
                            }}
                            className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-1 rounded bg-blue-50 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                            title="Inspect full profile, assign reliever duty or change ward"
                          >
                            Profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          /* =========================================================================
             OFF-DUTY WORKSPACE: READ-ONLY PAST HISTORY ONLY (SHIFT-GATING ENFORCED)
             ========================================================================= */
          <div className="space-y-6">
            {/* Shift-Gating Operational Lockdown Banner */}
            <div
              id="supervisor-shift-gating-banner"
              className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      Shift-Gating Enforced
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Supervisor Status: Off-Duty</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Live operational controls, reliever allocation actions, and real-time overtime approval buttons are locked. Click any historical log row to inspect complete employee profiles in read-only mode.
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-shift-gating-punch-in"
                onClick={handleToggleSupervisorDuty}
                disabled={isLocatingDuty}
                className={`px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm shrink-0 ${
                  isLocatingDuty ? 'opacity-70 cursor-wait' : ''
                }`}
              >
                {isLocatingDuty ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Verifying GPS...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>Punch In for Shift</span>
                  </>
                )}
              </button>
            </div>

            <section
              id="supervisor-readonly-past-history"
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-amber-600" />
                    <h3 className="text-sm font-bold text-slate-900">Read-Only Past History Archive</h3>
                  </div>
                  <p className="text-3xs text-slate-500">
                    Historical attendance logs and finalized shift reports. Punch In to modify or approve records. Click any row to view employee profile.
                  </p>
                </div>

                {/* Past Date Selector */}
                <div className="flex items-center gap-2">
                  <label htmlFor="history-date-picker" className="text-2xs font-bold text-slate-500">
                    Archived Date:
                  </label>
                  <input
                    type="date"
                    id="history-date-picker"
                    value={selectedDate}
                    max={getTodayIso()}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-xl border border-slate-300 bg-slate-50 text-slate-700 cursor-pointer"
                  />
                </div>
              </div>

              {/* Historical Records Table (Read-Only, Clickable rows) */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-2xs font-bold uppercase text-slate-500 tracking-wider">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Staff Member</th>
                      <th className="py-2.5 px-3">Assigned Area</th>
                      <th className="py-2.5 px-3">In &rarr; Out Times</th>
                      <th className="py-2.5 px-3">Regular Hours</th>
                      <th className="py-2.5 px-3">OT Hours</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records
                      .filter((r) => r.date === selectedDate)
                      .slice(0, 15)
                      .map((rec) => {
                        const staff = staffList.find((s) => s.id === rec.userId);
                        const staffCode = staff?.staffCode || rec.staff_id;
                        return (
                          <tr
                            key={rec.id}
                            id={`row-archive-staff-${rec.id}`}
                            onClick={() => {
                              if (staffCode) setSelectedProfileStaffId(staffCode);
                            }}
                            className="hover:bg-blue-50/60 transition-colors cursor-pointer group"
                            title="Click to view complete employee profile and historical records"
                          >
                            <td className="py-2.5 px-3 font-mono text-2xs text-slate-500">{rec.date}</td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900 group-hover:text-[#1E3A8A] transition-colors">
                                {staff?.name || rec.staff_id || 'Staff'}
                              </div>
                              <div className="text-2xs font-mono text-slate-400">
                                {staff?.staffCode || rec.staff_id}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">{rec.notes || staff?.department || 'Ward'}</td>
                            <td className="py-2.5 px-3 font-mono text-2xs">
                              {rec.punchIn ? formatTimeTo12hStr(rec.punchIn) : '--:--'} &rarr;{' '}
                              {rec.punchOut ? formatTimeTo12hStr(rec.punchOut) : '--:--'}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{rec.regularHours}h</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-amber-700">{rec.otHours}h</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-slate-100 text-slate-600">
                                {rec.status || 'Archived'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (staffCode) setSelectedProfileStaffId(staffCode);
                                }}
                                className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-1 rounded bg-blue-50 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                                title="Open full Employee Profile drill-down modal"
                              >
                                Profile
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Historical OT Approvals Audit Log */}
              <div className="pt-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Past Overtime Authorizations Log
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {historicalOtRequests.map((ot) => (
                    <div
                      key={ot.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{ot.staff_id}</div>
                        <div className="text-2xs text-slate-500">{ot.assigned_department} &bull; {ot.date}</div>
                        <div className="text-3xs text-emerald-700 font-bold">
                          Authorized By: {ot.approved_by || 'Supervisor'}
                        </div>
                      </div>
                      <span
                        className={`text-2xs font-bold px-2 py-0.5 rounded-md ${
                          ot.ot_status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {ot.ot_status} (+{ot.ot_requested_hours}h)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Reliever Duty Assignment Modal */}
      <DutyAssignmentModal
        isOpen={isRelieverModalOpen}
        onClose={() => {
          setIsRelieverModalOpen(false);
          setSelectedStaffForReliever(null);
        }}
        staff={staffList}
        selectedDate={selectedDate}
        initialStaffId={selectedStaffForReliever}
        onSaveAssignment={handleSaveDutyAssignment}
      />

      {/* Continuous Extended OT Assignment Modal */}
      {isContinuousOtModalOpen && (
        <div
          id="modal-continuous-ot"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-[#1E3A8A] px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                  <Timer className="h-5 w-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Assign Continuous Extended OT</h3>
                  <p className="text-3xs text-blue-200">Back-to-back shift &bull; 0h baseline &bull; Max 8.0h Cap</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsContinuousOtModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAssignContinuousOt} className="p-6 space-y-4">
              <div>
                <label htmlFor="continuous-ot-staff-select" className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                  Staff Member
                </label>
                <select
                  id="continuous-ot-staff-select"
                  value={continuousOtStaffCode}
                  onChange={(e) => setContinuousOtStaffCode(e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-300 bg-white p-2.5 focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.staffCode}>
                      {s.name} ({s.staffCode}) &bull; Current: {s.department}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="continuous-ot-hours-select" className="text-2xs font-bold text-slate-700 uppercase">
                      Pure OT Hours
                    </label>
                    <span className="text-3xs font-bold text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">
                      Max 8.0h
                    </span>
                  </div>
                  <select
                    id="continuous-ot-hours-select"
                    value={continuousOtHours}
                    onChange={(e) => setContinuousOtHours(parseFloat(e.target.value))}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 bg-white p-2.5 focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                  >
                    <option value={1.0}>1.0 Hour</option>
                    <option value={2.0}>2.0 Hours</option>
                    <option value={3.0}>3.0 Hours</option>
                    <option value={4.0}>4.0 Hours (Half Shift)</option>
                    <option value={6.0}>6.0 Hours</option>
                    <option value={8.0}>8.0 Hours (Strict Maximum Cap)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="continuous-ot-ward-select" className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                    Assigned Ward
                  </label>
                  <select
                    id="continuous-ot-ward-select"
                    value={continuousOtWard}
                    onChange={(e) => setContinuousOtWard(e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 bg-white p-2.5 focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                  >
                    {DUTY_AREAS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="continuous-ot-notes-input" className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                  Extension Reason / Floor Task
                </label>
                <input
                  type="text"
                  id="continuous-ot-notes-input"
                  value={continuousOtNotes}
                  onChange={(e) => setContinuousOtNotes(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white p-2.5 focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                  placeholder="e.g. Critical ICU Disinfection Spill Coverage"
                  required
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-3xs text-amber-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0" />
                <span>
                  Staff working this shift will have a 0.0-hour regular baseline. All logged attendance hours are automatically recognized as pure OT, strictly capped at 8.0h.
                </span>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsContinuousOtModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-confirm-assign-continuous-ot"
                  disabled={isSubmittingContinuousOt}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Timer className="h-4 w-4" />
                  <span>{isSubmittingContinuousOt ? 'Assigning...' : 'Assign Continuous OT'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Emergency Recall Dispatch Modal */}
      {isRecallModalOpen && (
        <div
          id="modal-dispatch-recall"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-700 to-amber-600 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                  <Flame className="h-5 w-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Dispatch Emergency Recall Alert</h3>
                  <p className="text-3xs text-rose-100">Critical Ward Shortage &bull; 100% Pure OT on Approval</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecallModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleDispatchRecall} className="p-6 space-y-4">
              <div>
                <label htmlFor="recall-staff-select" className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                  Target Staff Member for Recall
                </label>
                <select
                  id="recall-staff-select"
                  value={recallStaffCode}
                  onChange={(e) => setRecallStaffCode(e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-300 bg-white p-2.5 focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.staffCode}>
                      {s.name} ({s.staffCode}) &bull; {s.department}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="recall-ward-select" className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                  Emergency Shortage Ward / Department
                </label>
                <select
                  id="recall-ward-select"
                  value={recallWard}
                  onChange={(e) => setRecallWard(e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-300 bg-white p-2.5 focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                >
                  {DUTY_AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="recall-reason-select" className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                  Reason for Emergency Shortage Recall
                </label>
                <select
                  id="recall-reason-select"
                  value={recallReason}
                  onChange={(e) => setRecallReason(e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-300 bg-white p-2.5 focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                >
                  <option value="Critical Ward Understaffing & Acute Patient Spill Sanitization">Critical Ward Understaffing & Acute Patient Spill Sanitization</option>
                  <option value="Trauma Center Mass Casualty Emergency Influx">Trauma Center Mass Casualty Emergency Influx</option>
                  <option value="Infection Control Outbreak Disinfection & Isolation Fogging">Infection Control Outbreak Disinfection & Isolation Fogging</option>
                  <option value="Severe Staff Absentee Coverage & Unplanned Shift Reliever">Severe Staff Absentee Coverage & Unplanned Shift Reliever</option>
                </select>
              </div>

              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-3xs text-rose-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>
                  The employee will immediately see a critical notification banner on their portal. Once accepted and approved by supervisor, all worked hours convert directly to Overtime (Capped at 8.0h max).
                </span>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsRecallModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-confirm-dispatch-recall"
                  disabled={isSubmittingRecall}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <PhoneCall className="h-4 w-4" />
                  <span>{isSubmittingRecall ? 'Dispatching...' : 'Dispatch Emergency Recall'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Profile, Quick Actions & Duty Assignment Modal */}
      <EmployeeProfileModal
        staffId={selectedProfileStaffId}
        onClose={() => setSelectedProfileStaffId(null)}
        userRole="supervisor"
        selectedDate={selectedDate}
        isShiftGated={!dutyState.isPunchedIn}
        onActionComplete={() => {
          setUsers(getStoredUsers());
          setRecords(getStoredAttendance());
          setDutyAllocations(getStoredDutyAllocations());
        }}
      />

      {/* Geofence Rejection Popup Modal */}
      <GeofenceRejectionModal
        isOpen={rejectionModalState.isOpen}
        result={rejectionModalState.result}
        punchType={rejectionModalState.punchType}
        onClose={() => setRejectionModalState((prev) => ({ ...prev, isOpen: false }))}
        onLocationCorrected={() => {
          setRejectionModalState((prev) => ({ ...prev, isOpen: false }));
          const activeLimit = getStoredGeofenceConfig().maxAllowedRadiusMeters;
          setFeedback({
            type: 'success',
            text: `Location verified within ${activeLimit}m boundary. You may now punch duty.`,
          });
        }}
      />

      {/* GPS Hardware OFF Alert Popup Modal */}
      <GpsHardwareAlertModal
        isOpen={isGpsModalOpen}
        punchType={dutyState.isPunchedIn ? 'OUT' : 'IN'}
        onClose={() => setIsGpsModalOpen(false)}
        onRetry={handleToggleSupervisorDuty}
      />
    </div>
  );
};

export default SupervisorDashboard;
