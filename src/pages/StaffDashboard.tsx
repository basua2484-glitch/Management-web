import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  LogIn,
  LogOut,
  Send,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
  ChevronDown,
  User,
  Coffee,
  Building2,
  Timer,
  AlertTriangle,
  History,
  XCircle,
  PhoneCall,
  Flame,
  ShieldAlert,
  X,
  RotateCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getStoredUsers,
  getStoredAttendance,
  saveStoredAttendance,
  getStaffDashboardView,
  submitStaffOtRequest,
  getStoredDutyAllocations,
  DUTY_AREAS,
  INITIAL_STAFF,
  getStoredEmergencyRecalls,
  acceptEmergencyRecall,
  recordMidShiftEmergencyExit,
} from '../data/mockHousekeepingData';
import type { AppUser, AttendanceRecord, StaffDashboardView, DutyAllocation, EmergencyRecallAlert, ShiftName } from '../types';
import { formatTimeTo12hStr, calculateDailyAttendance, autoCloseActiveSessions, SHIFTS } from '../utils/attendanceCalculator';
import { GeofenceStatusCard } from '../components/GeofenceStatusCard';
import { GeofenceRejectionModal } from '../components/GeofenceRejectionModal';
import { GpsHardwareAlertModal } from '../components/GpsHardwareAlertModal';
import {
  HOSPITAL_LAT,
  HOSPITAL_LNG,
  verifyHospitalGeofence,
  requestLocationOnPunch,
  GPS_OFF_ALERT_MESSAGE,
  type GeofenceVerificationResult,
} from '../utils/geofence';

export const StaffDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user: authUser, logout, role: authRole } = useAuth();

  const [selectedDate, setSelectedDate] = useState<string>('2026-09-06');
  const [users, setUsers] = useState<AppUser[]>(() => getStoredUsers());
  const [records, setRecords] = useState<AttendanceRecord[]>(() => getStoredAttendance());
  const [dutyAllocations, setDutyAllocations] = useState<DutyAllocation[]>(() => getStoredDutyAllocations());
  const [emergencyRecalls, setEmergencyRecalls] = useState<EmergencyRecallAlert[]>(() => getStoredEmergencyRecalls());

  // Emergency Exit Modal State
  const [showEmergencyExitModal, setShowEmergencyExitModal] = useState(false);
  const [emergencyExitReason, setEmergencyExitReason] = useState('Immediate Personal / Medical Emergency');
  const [isSubmittingExit, setIsSubmittingExit] = useState(false);

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

  // GPS Sensor & Hardware State
  const [isLocating, setIsLocating] = useState(false);
  const [isGpsModalOpen, setIsGpsModalOpen] = useState(false);
  const [gpsModalPunchType, setGpsModalPunchType] = useState<'IN' | 'OUT'>('IN');

  // Determine current staff user
  const effectiveStaffId = useMemo(() => {
    if (authUser?.staff_id) return authUser.staff_id;
    if (authUser?.staffId) return `HK-${String(authUser.staffId).padStart(3, '0')}`;
    if (authUser?.username && authUser.username.toLowerCase().startsWith('hk')) return authUser.username.toUpperCase();
    return 'HK-001'; // Default fallback: Ramesh Kumar
  }, [authUser]);

  const [activeStaffCode, setActiveStaffCode] = useState<string>(effectiveStaffId);

  // Sync with auth user changes
  useEffect(() => {
    if (authUser?.staff_id) {
      setActiveStaffCode(authUser.staff_id);
    }
  }, [authUser]);

  // Refresh records and allocations on custom events
  useEffect(() => {
    const handleStorageUpdate = () => {
      setRecords(getStoredAttendance());
      setDutyAllocations(getStoredDutyAllocations());
      setUsers(getStoredUsers());
    };

    window.addEventListener('attendance-updated', handleStorageUpdate);
    window.addEventListener('ot-requests-updated', handleStorageUpdate);
    window.addEventListener('emergency-recall-updated', handleStorageUpdate);
    window.addEventListener('emergency-recall-dispatched', handleStorageUpdate);
    window.addEventListener('staff-emergency-exit', handleStorageUpdate);
    window.addEventListener('storage', handleStorageUpdate);
    return () => {
      window.removeEventListener('attendance-updated', handleStorageUpdate);
      window.removeEventListener('ot-requests-updated', handleStorageUpdate);
      window.removeEventListener('emergency-recall-updated', handleStorageUpdate);
      window.removeEventListener('emergency-recall-dispatched', handleStorageUpdate);
      window.removeEventListener('staff-emergency-exit', handleStorageUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, []);

  // Compute normalized staff dashboard view
  const staffDashboard: StaffDashboardView | null = useMemo(() => {
    return getStaffDashboardView(activeStaffCode, selectedDate);
  }, [activeStaffCode, selectedDate, records, users, dutyAllocations]);

  // Active Emergency Recall Alert for this staff member
  const activeEmergencyRecall = useMemo(() => {
    return emergencyRecalls.find(
      (r) =>
        r.staffId.toUpperCase() === activeStaffCode.toUpperCase() &&
        r.date === selectedDate &&
        (r.status === 'DISPATCHED' || r.status === 'ACCEPTED')
    );
  }, [emergencyRecalls, activeStaffCode, selectedDate]);

  // Find full user details for leave balances & extra profile data
  const staffProfile = useMemo(() => {
    return (
      users.find(
        (u) =>
          (u.staff_id && u.staff_id.toLowerCase() === activeStaffCode.toLowerCase()) ||
          u.username?.toLowerCase() === activeStaffCode.toLowerCase()
      ) || users[0]
    );
  }, [users, activeStaffCode]);

  // Find today's attendance record for current staff
  const todayRecord = useMemo(() => {
    const numericId = parseInt(activeStaffCode.replace(/\D/g, ''), 10) || 1;
    return records.find(
      (r) =>
        r.date === selectedDate &&
        (r.userId === numericId || (r.staff_id && r.staff_id.toLowerCase() === activeStaffCode.toLowerCase()))
    );
  }, [records, selectedDate, activeStaffCode]);

  // Estimated Pro-Rata hours if Emergency Exit is triggered now
  const estimatedProRataHours = useMemo(() => {
    const punchInStr = todayRecord?.punchInTimestamp || (todayRecord?.punchIn ? `${selectedDate}T${todayRecord.punchIn}:00` : null);
    if (!punchInStr) return 0.0;
    const inMs = new Date(punchInStr).getTime();
    if (isNaN(inMs)) return 0.0;
    const diffMinutes = Math.max(1, (Date.now() - inMs) / (1000 * 60));
    return Math.min(8.0, Math.round((diffMinutes / 60.0) * 100) / 100);
  }, [todayRecord, selectedDate]);

  // Today's OT allocation record
  const currentOtAllocation = useMemo(() => {
    return dutyAllocations.find(
      (a) => a.date === selectedDate && a.staff_id.toLowerCase() === activeStaffCode.toLowerCase()
    );
  }, [dutyAllocations, selectedDate, activeStaffCode]);

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'info' | 'error'; text: string } | null>(
    null
  );

  // GPS Geofence Verification state
  const [geofenceResult, setGeofenceResult] = useState<GeofenceVerificationResult | null>(null);

  // OT Request form state
  const [otHours, setOtHours] = useState<number>(1.5);
  const [otReason, setOtReason] = useState<string>('Emergency Ward Sanitization Spill');
  const [otWard, setOtWard] = useState<string>(staffDashboard?.currentDepartment || '3rd Floor Wards');
  const [isSubmittingOt, setIsSubmittingOt] = useState(false);

  // Live timer for punched in staff
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');

  useEffect(() => {
    if (staffDashboard?.shiftStatus !== 'PUNCHED_IN') {
      setElapsedTime('00:00:00');
      return;
    }

    const timer = setInterval(() => {
      const punchInStr = todayRecord?.punchIn || todayRecord?.punchInTimestamp;
      if (!punchInStr) return;

      let startMs = 0;
      if (punchInStr.includes(':')) {
        const [h, m] = punchInStr.split(':').map(Number);
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
        startMs = start.getTime();
      } else {
        startMs = new Date(punchInStr).getTime();
      }

      if (isNaN(startMs) || startMs === 0) return;

      const diff = Math.max(0, Date.now() - startMs);
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setElapsedTime(
        `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [staffDashboard?.shiftStatus, todayRecord?.punchIn, todayRecord?.punchInTimestamp]);

  // Handle Punch In (Triggered STRICTLY on button click)
  const handlePunchIn = async () => {
    setIsLocating(true);
    let punchLocationResult;
    try {
      // Explicitly triggers navigator.geolocation only upon click with 5-second timeout
      punchLocationResult = await requestLocationOnPunch('IN');
    } catch (err: any) {
      console.warn('GPS location request on punch in error:', err);
    } finally {
      setIsLocating(false);
    }

    // If device GPS is turned OFF, immediately display clear alert
    if (punchLocationResult?.isGpsOff) {
      setGpsModalPunchType('IN');
      setIsGpsModalOpen(true);
      setFeedback({
        type: 'warning',
        text: GPS_OFF_ALERT_MESSAGE,
      });
      try {
        window.alert(GPS_OFF_ALERT_MESSAGE);
      } catch {}
      return;
    }

    // Hospital GPS Geofence Security Boundary Verification (100.0m limit)
    const activeGeofence: GeofenceVerificationResult = punchLocationResult
      ? verifyHospitalGeofence(punchLocationResult.userCoords.lat, punchLocationResult.userCoords.lng)
      : geofenceResult || verifyHospitalGeofence(HOSPITAL_LAT, HOSPITAL_LNG);

    setGeofenceResult(activeGeofence);

    if (activeGeofence && !activeGeofence.allowed) {
      setRejectionModalState({
        isOpen: true,
        result: activeGeofence,
        punchType: 'IN',
      });
      setFeedback({
        type: 'error',
        text: 'Punch Failed: You are Outside Hospital Boundary',
      });
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const numericId = parseInt(activeStaffCode.replace(/\D/g, ''), 10) || 1;
    const userLat = activeGeofence?.userCoords.lat ?? HOSPITAL_LAT;
    const userLng = activeGeofence?.userCoords.lng ?? HOSPITAL_LNG;
    const distM = activeGeofence?.distanceMeters ?? 0.0;
    const gpsNote = `[GPS: ${distM.toFixed(1)}m]`;
    const wardWithGps = `${staffDashboard?.currentDepartment || 'Assigned Ward'} ${gpsNote}`;

    const existingIndex = records.findIndex(
      (r) =>
        r.date === selectedDate &&
        (r.userId === numericId || (r.staff_id && r.staff_id.toLowerCase() === activeStaffCode.toLowerCase()))
    );

    let nextRecords: AttendanceRecord[];
    if (existingIndex >= 0) {
      const prev = records[existingIndex];
      // Fix multi-session loop bug: Auto-close any active sessions before starting new session
      const nextSessions = autoCloseActiveSessions(prev.sessions, now.toISOString(), 'Auto-closed on new punch-in');
      nextSessions.push({
        id: `sess_${Date.now()}`,
        staff_id: numericId,
        date: selectedDate,
        punch_in: now.toISOString(),
        punch_out: null,
        notes: wardWithGps,
        punch_in_lat: userLat,
        punch_in_lng: userLng,
        punch_in_distance_meters: distM,
      });

      const updated: AttendanceRecord = {
        ...prev,
        punchIn: prev.punchIn || timeStr,
        punchInTimestamp: prev.punchInTimestamp || now.toISOString(),
        punchOut: null,
        punchOutTimestamp: null,
        punchInLat: userLat,
        punchInLng: userLng,
        punchInDistanceMeters: distM,
        status: 'Present',
        sessions: nextSessions,
      };
      nextRecords = [...records];
      nextRecords[existingIndex] = updated;
    } else {
      const newRec: AttendanceRecord = {
        id: `att_${numericId}_${selectedDate}`,
        userId: numericId,
        staff_id: activeStaffCode,
        date: selectedDate,
        punchIn: timeStr,
        punchInTimestamp: now.toISOString(),
        punchOut: null,
        punchOutTimestamp: null,
        punchInLat: userLat,
        punchInLng: userLng,
        punchInDistanceMeters: distM,
        regularHours: 0,
        otHours: 0,
        status: 'Present',
        notes: wardWithGps,
        sessions: [
          {
            id: `sess_${Date.now()}`,
            staff_id: numericId,
            date: selectedDate,
            punch_in: now.toISOString(),
            punch_out: null,
            notes: wardWithGps,
            punch_in_lat: userLat,
            punch_in_lng: userLng,
            punch_in_distance_meters: distM,
          },
        ],
      };
      nextRecords = [newRec, ...records];
    }

    saveStoredAttendance(nextRecords);
    setRecords(nextRecords);
    window.dispatchEvent(new CustomEvent('attendance-updated'));

    setFeedback({
      type: 'success',
      text: `Punched in successfully at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })} (${distM.toFixed(1)}m from center)! Have a safe shift.`,
    });
  };

  // Handle Punch Out (Triggered STRICTLY on button click)
  const handlePunchOut = async () => {
    setIsLocating(true);
    let punchLocationResult;
    try {
      // Explicitly triggers navigator.geolocation only upon click with 5-second timeout
      punchLocationResult = await requestLocationOnPunch('OUT');
    } catch (err: any) {
      console.warn('GPS location request on punch out error:', err);
    } finally {
      setIsLocating(false);
    }

    // If device GPS is turned OFF, immediately display clear alert
    if (punchLocationResult?.isGpsOff) {
      setGpsModalPunchType('OUT');
      setIsGpsModalOpen(true);
      setFeedback({
        type: 'warning',
        text: GPS_OFF_ALERT_MESSAGE,
      });
      try {
        window.alert(GPS_OFF_ALERT_MESSAGE);
      } catch {}
      return;
    }

    // Hospital GPS Geofence Security Boundary Verification (100.0m limit)
    const activeGeofence: GeofenceVerificationResult = punchLocationResult
      ? verifyHospitalGeofence(punchLocationResult.userCoords.lat, punchLocationResult.userCoords.lng)
      : geofenceResult || verifyHospitalGeofence(HOSPITAL_LAT, HOSPITAL_LNG);

    setGeofenceResult(activeGeofence);

    if (activeGeofence && !activeGeofence.allowed) {
      setRejectionModalState({
        isOpen: true,
        result: activeGeofence,
        punchType: 'OUT',
      });
      setFeedback({
        type: 'error',
        text: 'Punch Failed: You are Outside Hospital Boundary',
      });
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const numericId = parseInt(activeStaffCode.replace(/\D/g, ''), 10) || 1;
    const userLat = activeGeofence?.userCoords.lat ?? HOSPITAL_LAT;
    const userLng = activeGeofence?.userCoords.lng ?? HOSPITAL_LNG;
    const distM = activeGeofence?.distanceMeters ?? 0.0;

    const existingIndex = records.findIndex(
      (r) =>
        r.date === selectedDate &&
        (r.userId === numericId || (r.staff_id && r.staff_id.toLowerCase() === activeStaffCode.toLowerCase()))
    );

    if (existingIndex < 0) return;

    const prev = records[existingIndex];
    const nextSessions = (prev.sessions || []).map((s) => {
      if (!s.punch_out) {
        return {
          ...s,
          punch_out: now.toISOString(),
          punch_out_lat: userLat,
          punch_out_lng: userLng,
          punch_out_distance_meters: distM,
        };
      }
      return s;
    });

    // Recalculate hours with dynamic baseline and 8.0h OT cap
    const shiftType = todayRecord?.shift_name || staffDashboard?.assignedShift;
    const calculated = calculateDailyAttendance(nextSessions, shiftType);

    const updated: AttendanceRecord = {
      ...prev,
      punchOut: timeStr,
      punchOutTimestamp: now.toISOString(),
      punchOutLat: userLat,
      punchOutLng: userLng,
      punchOutDistanceMeters: distM,
      regularHours: calculated.regular_hours,
      otHours: calculated.overtime_hours,
      status: 'Present',
      sessions: nextSessions,
    };

    const nextRecords = [...records];
    nextRecords[existingIndex] = updated;

    saveStoredAttendance(nextRecords);
    setRecords(nextRecords);
    window.dispatchEvent(new CustomEvent('attendance-updated'));

    setFeedback({
      type: 'success',
      text: `Punched out at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })} (${distM.toFixed(1)}m from center). Total Regular: ${calculated.regular_hours}h, OT: ${calculated.overtime_hours}h.`,
    });
  };

  // Handle Emergency Exit (Mid-Shift Departure)
  const handleConfirmEmergencyExit = () => {
    setIsSubmittingExit(true);
    try {
      const res = recordMidShiftEmergencyExit({
        staffId: activeStaffCode,
        date: selectedDate,
        reason: emergencyExitReason,
      });
      if (res.success) {
        setFeedback({
          type: 'warning',
          text: `Emergency Exit recorded. Pro-rata regular hours saved: ${res.regularHours}h. Tagged as MID_SHIFT_EMERGENCY_EXIT.`,
        });
        setRecords(getStoredAttendance());
        setShowEmergencyExitModal(false);
      } else {
        setFeedback({ type: 'error', text: res.message });
      }
    } catch (e) {
      setFeedback({ type: 'error', text: 'Failed to record emergency exit. Please try again.' });
    } finally {
      setIsSubmittingExit(false);
    }
  };

  // Handle Accepting Emergency Recall
  const handleAcceptRecall = (recallId: string) => {
    const res = acceptEmergencyRecall(recallId);
    if (res.success) {
      setFeedback({
        type: 'success',
        text: 'Hospital Emergency Recall accepted! Ready for duty punch-in. Hours will convert to 100% pure OT upon supervisor sign-off.',
      });
      setEmergencyRecalls(getStoredEmergencyRecalls());
      if (staffDashboard?.shiftStatus !== 'PUNCHED_IN') {
        handlePunchIn();
      }
    }
  };

  // Handle Overtime Extension Request Submission
  const handleSendOtRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (otHours <= 0) {
      setFeedback({ type: 'error', text: 'Please specify valid overtime hours (e.g. 1.0h, 2.0h).' });
      return;
    }

    setIsSubmittingOt(true);
    try {
      const res = submitStaffOtRequest({
        staffId: activeStaffCode,
        date: selectedDate,
        hours: Math.min(8.0, otHours),
        reason: otReason,
        department: otWard,
      });

      setFeedback({
        type: 'success',
        text: `OT request of ${Math.min(8.0, otHours)}h submitted to Supervisor. Status: PENDING authorization (Max 8.0h cap enforced).`,
      });
      setDutyAllocations(getStoredDutyAllocations());
    } catch (err) {
      setFeedback({ type: 'error', text: 'Failed to submit OT request. Please try again.' });
    } finally {
      setIsSubmittingOt(false);
    }
  };

  // Shift Timing display mapper
  const shiftDisplay = useMemo(() => {
    const shift = (todayRecord?.shift_name as ShiftName) || staffDashboard?.assignedShift || '7-3';
    if (shift === 'HALF_4H') {
      return { label: 'Half Duty (4H)', hours: '4-Hour Baseline Standard Shift', badge: 'bg-teal-100 text-teal-900 border-teal-300' };
    }
    if (shift === 'CONTINUOUS_EXTENDED_OT') {
      return { label: 'Continuous Extended OT', hours: 'Pure Overtime (Capped at 8.0h)', badge: 'bg-purple-100 text-purple-900 border-purple-300' };
    }
    if (shift === '7-3') return { label: 'Morning Shift', hours: '07:00 AM – 03:00 PM (8h Baseline)', badge: 'bg-amber-100 text-amber-900 border-amber-300' };
    if (shift === '3-11') return { label: 'Evening Shift', hours: '03:00 PM – 11:00 PM (8h Baseline)', badge: 'bg-blue-100 text-blue-900 border-blue-300' };
    return { label: 'Night Shift', hours: '11:00 PM – 07:00 AM (8h Baseline)', badge: 'bg-indigo-100 text-indigo-900 border-indigo-300' };
  }, [staffDashboard?.assignedShift, todayRecord?.shift_name]);

  // Is staff testing allowed for admin/supervisor?
  const canSwitchStaff = authRole === 'ADMIN' || authRole === 'MANAGER' || authRole === 'SUPERVISOR';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12">
      {/* Top Staff Navigation Bar */}
      <header className="bg-[#1E3A8A] text-white shadow-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <Building2 className="h-5 w-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base tracking-tight text-white">ApexCare Health</span>
                <span className="bg-blue-600/80 text-blue-100 text-3xs font-semibold px-2 py-0.5 rounded-full border border-blue-400/40">
                  Staff Self-Service Portal
                </span>
              </div>
              <p className="text-3xs text-blue-200">Personal Duty &amp; Overtime Management Terminal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Staff Switcher for Admin/Supervisor Testing */}
            {canSwitchStaff && (
              <div className="flex items-center gap-1.5 bg-blue-900/60 border border-blue-700/60 rounded-lg px-2.5 py-1 text-xs">
                <User className="h-3.5 w-3.5 text-blue-300" />
                <span className="text-3xs text-blue-200 hidden sm:inline">Viewing As:</span>
                <select
                  id="select-staff-switch"
                  value={activeStaffCode}
                  onChange={(e) => {
                    setActiveStaffCode(e.target.value);
                    setFeedback(null);
                  }}
                  className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  {users
                    .filter((u) => u.role === 'staff' || !u.role)
                    .map((u) => {
                      const code = u.staff_id || `HK-${String(u.id).padStart(3, '0')}`;
                      return (
                        <option key={u.id} value={code} className="bg-slate-900 text-white">
                          {u.name} ({code})
                        </option>
                      );
                    })}
                </select>
              </div>
            )}

            {/* Back to Elevated Dashboard if Admin/Supervisor */}
            {canSwitchStaff && (
              <button
                type="button"
                id="btn-back-elevated"
                onClick={() => {
                  if (authRole === 'ADMIN') navigate('/admin/dashboard');
                  else if (authRole === 'SUPERVISOR') navigate('/supervisor/dashboard');
                  else navigate('/manager-dashboard');
                }}
                className="text-xs bg-white/10 hover:bg-white/20 text-white font-medium px-3 py-1.5 rounded-lg border border-white/20 transition-colors"
              >
                Back to {authRole === 'ADMIN' ? 'Admin' : 'Supervisor'}
              </button>
            )}

            {/* Logout Button */}
            <button
              type="button"
              id="btn-staff-logout"
              onClick={() => logout(navigate)}
              className="flex items-center gap-1 text-xs bg-rose-600/90 hover:bg-rose-600 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl text-xs font-medium border flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : feedback.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : feedback.type === 'warning'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-blue-50 text-blue-900 border-blue-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
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

        {/* Hospital Emergency Recall Alert Banner */}
        {activeEmergencyRecall && (
          <div
            id="emergency-recall-alert-card"
            className="p-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white shadow-lg border border-red-300 animate-pulse flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0 border border-white/30">
                <ShieldAlert className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider">
                    🚨 URGENT HOSPITAL EMERGENCY RECALL
                  </span>
                  <span className="text-2xs font-semibold opacity-90">{activeEmergencyRecall.department}</span>
                </div>
                <h3 className="font-bold text-sm sm:text-base mt-0.5">
                  Critical Shortage: {activeEmergencyRecall.reason}
                </h3>
                <p className="text-3xs text-white/90">
                  Dispatched by <b>{activeEmergencyRecall.supervisorName}</b>. All hours logged for this emergency recall shift will be converted to 100% pure Overtime (capped at 8.0h) upon Supervisor approval.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
              {activeEmergencyRecall.status === 'DISPATCHED' ? (
                <button
                  type="button"
                  id="btn-accept-emergency-recall"
                  onClick={() => handleAcceptRecall(activeEmergencyRecall.id)}
                  className="px-4 py-2 bg-white text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1.5"
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  <span>Acknowledge &amp; Punch In</span>
                </button>
              ) : (
                <span className="px-3.5 py-1.5 bg-white/20 border border-white/30 text-white font-bold text-xs rounded-xl flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Recall Accepted (Pure OT Active)</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Staff Profile & Duty Shift Banner */}
        <section
          id="staff-duty-shift-card"
          className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-[#1E3A8A] via-blue-600 to-indigo-600"></div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* User Details */}
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#1E3A8A] to-blue-700 text-white font-bold text-xl flex items-center justify-center shadow-md">
                {staffDashboard?.fullName?.charAt(0) || 'S'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {staffDashboard?.fullName || 'Housekeeping Staff'}
                  </h1>
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                    {staffDashboard?.staffId || activeStaffCode}
                  </span>
                  <span
                    className={`text-3xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      staffDashboard?.dutyType === 'FIXED'
                        ? 'bg-blue-100 text-blue-800'
                        : staffDashboard?.dutyType === 'PERMANENT_RELIEVER'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {staffDashboard?.dutyType?.replace('_', ' ') || 'FIXED'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-slate-700 font-semibold">
                    <MapPin className="h-3.5 w-3.5 text-blue-600" />
                    {staffDashboard?.currentDepartment || 'Assigned Ward'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    Off Day: <b className="text-slate-700">{staffProfile?.weeklyOffDay || 'Sunday'}</b>
                  </span>
                  <span>•</span>
                  <span className="text-slate-400 font-mono text-2xs">{selectedDate}</span>
                </div>
              </div>
            </div>

            {/* Current Duty Shift Status Badge */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
              <div className={`p-3 rounded-xl border ${shiftDisplay.badge} text-left sm:text-right w-full sm:w-auto`}>
                <div className="text-3xs uppercase tracking-wider font-bold opacity-80">Shift Assignment</div>
                <div className="text-sm font-bold">{shiftDisplay.label} ({staffDashboard?.assignedShift})</div>
                <div className="text-xs font-mono">{shiftDisplay.hours}</div>
              </div>

              <div
                className={`p-3 rounded-xl border flex items-center gap-2.5 w-full sm:w-auto ${
                  staffDashboard?.shiftStatus === 'PUNCHED_IN'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : staffDashboard?.shiftStatus === 'PUNCHED_OUT'
                    ? 'bg-slate-100 border-slate-300 text-slate-700'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                {staffDashboard?.shiftStatus === 'PUNCHED_IN' ? (
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                ) : (
                  <Clock className="h-4 w-4 text-slate-400" />
                )}
                <div>
                  <div className="text-3xs font-bold uppercase tracking-wider">Duty Status</div>
                  <div className="text-xs font-bold">
                    {staffDashboard?.shiftStatus === 'PUNCHED_IN'
                      ? 'PUNCHED IN (Active)'
                      : staffDashboard?.shiftStatus === 'PUNCHED_OUT'
                      ? 'PUNCHED OUT (Shift Done)'
                      : 'NOT STARTED'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Hospital GPS Geofence Verification & Boundary Guard */}
        <GeofenceStatusCard
          onStatusChange={setGeofenceResult}
          className="mb-5 shadow-xs"
        />

        {/* 3-Column Quick Metrics: Regular Hours, Overtime, and Active Session Timer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Daily Regular Hours */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
              <span>Daily Regular Hours</span>
              <span className="text-2xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">8.0h Max</span>
            </div>
            <div className="text-3xl font-extrabold text-[#1E3A8A] tracking-tight">
              {staffDashboard?.todayRegularHours?.toFixed(1) || '0.0'}
              <span className="text-sm font-semibold text-slate-500 ml-1">hrs</span>
            </div>
            <p className="text-3xs text-slate-400 mt-1">Normal shift baseline hours worked today</p>
          </div>

          {/* Daily Overtime Hours */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
              <span>Overtime (OT) Hours</span>
              <span
                className={`text-2xs px-2 py-0.5 rounded-full font-bold ${
                  staffDashboard?.otRequestStatus === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : staffDashboard?.otRequestStatus === 'PENDING'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {staffDashboard?.otRequestStatus === 'APPROVED'
                  ? 'APPROVED'
                  : staffDashboard?.otRequestStatus === 'PENDING'
                  ? 'PENDING'
                  : 'NONE'}
              </span>
            </div>
            <div className="text-3xl font-extrabold text-amber-600 tracking-tight">
              {staffDashboard?.todayOtHours?.toFixed(1) || '0.0'}
              <span className="text-sm font-semibold text-slate-500 ml-1">hrs</span>
            </div>
            <p className="text-3xs text-slate-400 mt-1">Authorized beyond 8-hour shift ceiling</p>
          </div>

          {/* Real-time Duty Punch Clock */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
              <span>Active Duty Timer</span>
              <span className="text-2xs font-mono text-slate-400">Live Clock</span>
            </div>
            <div className="font-mono text-2xl font-bold text-slate-800 tracking-wider">
              {staffDashboard?.shiftStatus === 'PUNCHED_IN' ? elapsedTime : '--:--:--'}
            </div>
            <div className="mt-2 flex items-center gap-2">
              {staffDashboard?.shiftStatus !== 'PUNCHED_IN' ? (
                <button
                  type="button"
                  id="btn-staff-punch-in"
                  onClick={handlePunchIn}
                  disabled={isLocating}
                  className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60 ${
                    geofenceResult && !geofenceResult.allowed
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isLocating ? (
                    <>
                      <RotateCw className="h-4 w-4 animate-spin" />
                      <span>Acquiring GPS Location...</span>
                    </>
                  ) : geofenceResult && !geofenceResult.allowed ? (
                    <>
                      <ShieldAlert className="h-4 w-4" />
                      <span>PUNCH IN (OUTSIDE 100M GEOFENCE)</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      <span>PUNCH IN</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  <button
                    type="button"
                    id="btn-staff-punch-out"
                    onClick={handlePunchOut}
                    disabled={isLocating}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    {isLocating ? (
                      <>
                        <RotateCw className="h-4 w-4 animate-spin" />
                        <span>Acquiring GPS...</span>
                      </>
                    ) : (
                      <>
                        <LogOut className="h-4 w-4" />
                        <span>PUNCH OUT</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    id="btn-staff-emergency-exit"
                    onClick={() => setShowEmergencyExitModal(true)}
                    className="px-2.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer shrink-0"
                    title="Mid-Shift Emergency Exit (Saves Pro-Rata Hours)"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Emergency Exit</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2-Column Section: OT Extension Request Tool + Punch Session Log */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overtime (OT) Extension Request Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Timer className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Request Overtime Extension</h2>
                  <p className="text-3xs text-slate-500">Submit extra hours for Supervisor review (Capped at 8.0h Max)</p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="text-right">
                <span
                  className={`text-2xs font-bold px-2.5 py-1 rounded-full border ${
                    staffDashboard?.otRequestStatus === 'APPROVED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : staffDashboard?.otRequestStatus === 'PENDING'
                      ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
                      : staffDashboard?.otRequestStatus === 'REJECTED'
                      ? 'bg-rose-50 text-rose-700 border-rose-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {staffDashboard?.otRequestStatus === 'APPROVED'
                    ? '✓ OT APPROVED'
                    : staffDashboard?.otRequestStatus === 'PENDING'
                    ? '⏳ AWAITING SUPERVISOR'
                    : staffDashboard?.otRequestStatus === 'REJECTED'
                    ? '✕ OT REJECTED'
                    : 'NO ACTIVE REQUEST'}
                </span>
              </div>
            </div>

            {/* Current Active Request Details if Pending or Approved */}
            {currentOtAllocation && currentOtAllocation.ot_status !== 'NONE' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Latest OT Application:</span>
                  <span className="font-bold text-amber-700 font-mono">
                    +{currentOtAllocation.ot_requested_hours} Hours
                  </span>
                </div>
                <div className="text-slate-500 text-2xs">
                  Area: <b className="text-slate-700">{currentOtAllocation.assigned_department}</b> &bull; Date:{' '}
                  <b className="text-slate-700">{currentOtAllocation.date}</b>
                </div>
                {currentOtAllocation.notes && (
                  <div className="text-slate-600 text-2xs italic pt-0.5">
                    "{currentOtAllocation.notes}"
                  </div>
                )}
                {currentOtAllocation.approved_by && (
                  <div className="text-emerald-700 text-2xs font-bold flex items-center gap-1 pt-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Authorized by: {currentOtAllocation.approved_by}
                  </div>
                )}
              </div>
            )}

            {/* Submission Form */}
            <form onSubmit={handleSendOtRequest} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="ot-hours-input" className="text-2xs font-bold text-slate-600 uppercase">
                      Requested OT Hours
                    </label>
                    <span className="text-3xs font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                      Max 8.0h Cap
                    </span>
                  </div>
                  <select
                    id="ot-hours-input"
                    value={otHours}
                    onChange={(e) => setOtHours(parseFloat(e.target.value))}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 bg-white p-2.5 focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                  >
                    <option value={0.5}>0.5 Hour (30 Mins)</option>
                    <option value={1.0}>1.0 Hour</option>
                    <option value={1.5}>1.5 Hours (Standard)</option>
                    <option value={2.0}>2.0 Hours</option>
                    <option value={2.5}>2.5 Hours</option>
                    <option value={3.0}>3.0 Hours (Reliever)</option>
                    <option value={4.0}>4.0 Hours (Half Shift)</option>
                    <option value={6.0}>6.0 Hours (Extended Shift)</option>
                    <option value={8.0}>8.0 Hours (Strict Maximum Cap)</option>
                  </select>
                  <p className="text-3xs text-slate-400 mt-1">Hospital policy limits single OT sessions to max 8.0 hours.</p>
                </div>

                <div>
                  <label htmlFor="ot-ward-input" className="block text-2xs font-bold text-slate-600 uppercase mb-1">
                    Duty Ward / Department
                  </label>
                  <select
                    id="ot-ward-input"
                    value={otWard}
                    onChange={(e) => setOtWard(e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 bg-white p-2.5 focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                  >
                    {DUTY_AREAS.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="ot-reason-input" className="block text-2xs font-bold text-slate-600 uppercase mb-1">
                  Operational Reason for Extension
                </label>
                <select
                  id="ot-reason-input"
                  value={otReason}
                  onChange={(e) => setOtReason(e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-300 bg-white p-2.5 focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                >
                  <option value="Emergency Ward Sanitization Spill">Emergency Ward Sanitization Spill</option>
                  <option value="Staff Relief Shortage / Absentee Coverage">Staff Relief Shortage / Absentee Coverage</option>
                  <option value="Terminal Room Disinfection & Sterilization">Terminal Room Disinfection & Sterilization</option>
                  <option value="Post-Op Trauma Center Heavy Cleaning">Post-Op Trauma Center Heavy Cleaning</option>
                  <option value="Night Handover Buffer & Linen Stocking">Night Handover Buffer & Linen Stocking</option>
                  <option value="Executive Floor Deep Scrubbing">Executive Floor Deep Scrubbing</option>
                </select>
              </div>

              <button
                type="submit"
                id="btn-submit-ot-request"
                disabled={isSubmittingOt}
                className="w-full py-2.5 bg-[#1E3A8A] hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSubmittingOt ? 'Submitting...' : 'Send OT Extension Request to Supervisor'}</span>
              </button>
            </form>
          </div>

          {/* Today's Punch Session History & Leave Balances */}
          <div className="space-y-6">
            {/* Session History */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <History className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Today's Punch Log Sessions</h2>
                    <p className="text-3xs text-slate-500">Detailed punch in and out audit trail</p>
                  </div>
                </div>
                <span className="text-2xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  {todayRecord?.sessions?.length || (todayRecord?.punchIn ? 1 : 0)} Sessions
                </span>
              </div>

              {todayRecord?.sessions && todayRecord.sessions.length > 0 ? (
                <div className="space-y-2">
                  {todayRecord.sessions.map((sess, idx) => (
                    <div
                      key={sess.id || idx}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-800 font-bold text-2xs flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="font-semibold text-slate-800">
                            {formatTimeTo12hStr(sess.punch_in)} &rarr;{' '}
                            {sess.punch_out ? formatTimeTo12hStr(sess.punch_out) : <span className="text-emerald-600 font-bold">Active</span>}
                          </div>
                          <div className="text-3xs text-slate-400">{sess.notes || 'Hospital Floor'}</div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-600 text-2xs">
                        {sess.punch_out ? 'COMPLETED' : 'IN-PROGRESS'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : todayRecord?.punchIn ? (
                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-800 font-bold text-2xs flex items-center justify-center">
                      #1
                    </span>
                    <div>
                      <div className="font-semibold text-slate-800">
                        {formatTimeTo12hStr(todayRecord.punchIn)} &rarr;{' '}
                        {todayRecord.punchOut ? formatTimeTo12hStr(todayRecord.punchOut) : <span className="text-emerald-600 font-bold">Active</span>}
                      </div>
                      <div className="text-3xs text-slate-400">{staffDashboard?.currentDepartment || 'Assigned Area'}</div>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-slate-600 text-2xs">
                    {todayRecord.punchOut ? 'COMPLETED' : 'IN-PROGRESS'}
                  </span>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <Clock className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  No punches recorded for today yet. Use the punch in button above to start your shift.
                </div>
              )}
            </div>

            {/* Leave Balance & Entitlements Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Leave Balance Entitlement</h3>
                <span className="text-3xs font-semibold text-slate-400">Year 2026</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                  <div className="text-3xs font-bold text-blue-800 uppercase">Casual</div>
                  <div className="text-xl font-bold text-blue-900 mt-0.5">
                    {staffProfile?.leaveBalance?.casual ?? 12}
                  </div>
                  <div className="text-3xs text-slate-500">Days</div>
                </div>
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <div className="text-3xs font-bold text-emerald-800 uppercase">Sick</div>
                  <div className="text-xl font-bold text-emerald-900 mt-0.5">
                    {staffProfile?.leaveBalance?.sick ?? 7}
                  </div>
                  <div className="text-3xs text-slate-500">Days</div>
                </div>
                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                  <div className="text-3xs font-bold text-purple-800 uppercase">Paid / Earned</div>
                  <div className="text-xl font-bold text-purple-900 mt-0.5">
                    {staffProfile?.leaveBalance?.paid ?? 15}
                  </div>
                  <div className="text-3xs text-slate-500">Days</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Emergency Exit Confirmation Modal */}
      {showEmergencyExitModal && (
        <div
          id="modal-emergency-exit"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-600 to-rose-600 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/30">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Mid-Shift Emergency Exit</h3>
                  <p className="text-3xs text-white/80">Immediate duty termination &amp; pro-rata calculation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmergencyExitModal(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Calculated Pro-Rata Regular Hours:</span>
                  <span className="font-mono text-sm font-extrabold text-amber-800">
                    {estimatedProRataHours.toFixed(2)} hrs
                  </span>
                </div>
                <div className="flex items-center justify-between text-2xs text-slate-600">
                  <span>Shift Punch-In:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {todayRecord?.punchIn ? formatTimeTo12hStr(todayRecord.punchIn) : 'Active Shift'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-2xs text-slate-600">
                  <span>Departure Record Tag:</span>
                  <span className="font-mono font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                    MID_SHIFT_EMERGENCY_EXIT
                  </span>
                </div>
                <p className="text-3xs text-amber-700 pt-1 border-t border-amber-200/60">
                  Your worked time will be safely credited as pro-rata regular hours. Your supervisor will be notified immediately of your departure.
                </p>
              </div>

              <div>
                <label htmlFor="emergency-exit-reason-select" className="block text-2xs font-bold text-slate-700 uppercase mb-1.5">
                  Emergency Exit Reason
                </label>
                <select
                  id="emergency-exit-reason-select"
                  value={emergencyExitReason}
                  onChange={(e) => setEmergencyExitReason(e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-300 bg-white p-2.5 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="Immediate Personal Medical / Sickness">Immediate Personal Medical / Sickness</option>
                  <option value="Urgent Family Critical Emergency">Urgent Family Critical Emergency</option>
                  <option value="Ward Hazardous Spill / Physical Workplace Injury">Ward Hazardous Spill / Physical Workplace Injury</option>
                  <option value="In-Hospital Code Evacuation / Relocation">In-Hospital Code Evacuation / Relocation</option>
                  <option value="Severe Acute Fatigue / Fit-for-Duty Inability">Severe Acute Fatigue / Fit-for-Duty Inability</option>
                </select>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-3xs text-slate-500 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                <span>By confirming, your current punch session will close immediately with official emergency exit credentials.</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEmergencyExitModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
              >
                Cancel / Stay on Duty
              </button>
              <button
                type="button"
                id="btn-confirm-emergency-exit"
                disabled={isSubmittingExit}
                onClick={handleConfirmEmergencyExit}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
              >
                <AlertTriangle className="h-4 w-4" />
                <span>{isSubmittingExit ? 'Processing Exit...' : 'Confirm Emergency Exit'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hospital GPS Geofence Rejection Popup Modal */}
      <GeofenceRejectionModal
        isOpen={rejectionModalState.isOpen}
        result={rejectionModalState.result}
        punchType={rejectionModalState.punchType}
        onClose={() => setRejectionModalState((prev) => ({ ...prev, isOpen: false }))}
        onLocationCorrected={() => {
          setRejectionModalState((prev) => ({ ...prev, isOpen: false }));
          setFeedback({
            type: 'success',
            text: 'Location reset to inside hospital boundary. You can now punch in/out.',
          });
        }}
      />

      {/* GPS Hardware OFF Alert Modal */}
      <GpsHardwareAlertModal
        isOpen={isGpsModalOpen}
        punchType={gpsModalPunchType}
        onClose={() => setIsGpsModalOpen(false)}
        onRetry={() => {
          setIsGpsModalOpen(false);
          if (gpsModalPunchType === 'IN') {
            handlePunchIn();
          } else {
            handlePunchOut();
          }
        }}
      />
    </div>
  );
};

export default StaffDashboard;
