import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LogIn,
  LogOut,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Users,
  ChevronDown,
  ArrowLeft,
  Sparkles,
  ShieldAlert,
  Layers,
  History,
  RotateCw,
  Navigation,
  Smartphone,
  X,
  RefreshCw,
} from 'lucide-react';
import type { StaffUser, AttendanceRecord, AppUser, AttendanceSession, StaffSummaryResponse } from '../types';
import {
  calculateDailyAttendance,
  getSessionDurationInMinutes,
  getStaffSummary,
  autoCloseActiveSessions,
  formatTimeTo12hStr,
  updateUI,
  process_shift_attendance,
  SHIFTS,
} from '../utils/attendanceCalculator';
import { GeofenceStatusCard } from './GeofenceStatusCard';
import { GeofenceRejectionModal } from './GeofenceRejectionModal';
import { GpsHardwareAlertModal } from './GpsHardwareAlertModal';
import { getApiEndpoint } from '../services/apiConfig';
import { getTodayIso } from '../data/mockHousekeepingData';
import {
  HOSPITAL_LAT,
  HOSPITAL_LNG,
  verifyHospitalGeofence,
  requestLocationOnPunch,
  getStoredGeofenceConfig,
  GPS_OFF_ALERT_MESSAGE,
  type GeofenceVerificationResult,
} from '../utils/geofence';
import {
  recordLivePunchInToDb,
  recordLivePunchOutToDb,
  fetchLiveGeofenceSettings,
  subscribeToGeofenceSettings,
} from '../services/firestoreService';

interface StaffPunchPortalProps {
  staff: StaffUser[];
  records: AttendanceRecord[];
  selectedDate?: string;
  initialStaffId?: number;
  currentUser?: AppUser | null;
  onSaveRecord: (record: AttendanceRecord) => void;
  onFlash?: (message: string, type: 'success' | 'danger' | 'warning' | 'info') => void;
  onBackToAdmin?: () => void;
  onLogout?: () => void;
  onUnauthorizedAttempt?: () => void;
  isModal?: boolean;
}

const DEFAULT_STAFF_FALLBACK: StaffUser = {
  id: 1,
  name: 'Ramesh Kumar',
  staffCode: 'HK-001',
  role: 'staff',
  department: 'General',
  shift: 'Morning',
  active: true,
};

export const StaffPunchPortal: React.FC<StaffPunchPortalProps> = ({
  staff,
  records,
  selectedDate = getTodayIso(),
  initialStaffId = 1, // Defaults to Ramesh Kumar (id: 1)
  currentUser,
  onSaveRecord,
  onFlash,
  onBackToAdmin,
  onLogout,
  onUnauthorizedAttempt,
  isModal = false,
}) => {
  // If current logged-in user is staff, lock or default to their staffId
  const effectiveDefaultId = currentUser?.role === 'staff' && currentUser.staffId
    ? currentUser.staffId
    : initialStaffId;

  const [selectedStaffId, setSelectedStaffId] = useState<number>(effectiveDefaultId);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'warning' | 'info';
    text: string;
  } | null>(null);

  // Sync when initialStaffId or currentUser changes
  useEffect(() => {
    if (currentUser?.role === 'staff' && currentUser.staffId) {
      setSelectedStaffId((prev) => (prev === currentUser.staffId ? prev : currentUser.staffId!));
    } else if (initialStaffId) {
      setSelectedStaffId((prev) => (prev === initialStaffId ? prev : initialStaffId));
    }
  }, [initialStaffId, currentUser?.role, currentUser?.staffId]);

  // Time formatting helper
  const formatTime12h = (timeStr: string) => {
    if (!timeStr) return '--:--';
    if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
    if (timeStr.includes('T') || (timeStr.includes('-') && timeStr.includes(':'))) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    }
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
  };

  // Convert 12h or Date to HH:MM 24h string
  const getCurrent24hTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Active staff user resolution:
  const isStaffLoggedIn = currentUser?.role === 'staff';
  const activeStaff = useMemo(() => {
    if (isStaffLoggedIn && currentUser?.staffId) {
      return staff.find((s) => s.id === currentUser.staffId) || staff[0] || DEFAULT_STAFF_FALLBACK;
    }
    return staff.find((s) => s.id === selectedStaffId) || staff[0] || DEFAULT_STAFF_FALLBACK;
  }, [isStaffLoggedIn, currentUser?.staffId, staff, selectedStaffId]);

  // Formatted Staff ID from User model staff_id or staffCode HK-%03d
  const formattedStaffId =
    (isStaffLoggedIn && currentUser?.staff_id)
      ? currentUser.staff_id
      : (activeStaff.staffCode || `HK-${String(activeStaff.id).padStart(3, '0')}`);
  const assignedArea = activeStaff.department || currentUser?.department || 'General';

  // Find attendance record for selected staff & selected date
  const todayRecord = useMemo(() => {
    return records.find(
      (r) => r.userId === activeStaff.id && r.date === selectedDate
    );
  }, [records, activeStaff.id, selectedDate]);

  // Dynamic active sessions for selected staff & date
  const activeSessions: AttendanceSession[] = useMemo(() => {
    if (todayRecord?.sessions && todayRecord.sessions.length > 0) {
      return todayRecord.sessions;
    }
    if (todayRecord?.punchIn) {
      return [
        {
          id: `sess_${todayRecord.id}_1`,
          staff_id: activeStaff.id,
          date: selectedDate,
          punch_in: todayRecord.punchInTimestamp || todayRecord.punchIn,
          punch_out: todayRecord.punchOutTimestamp || todayRecord.punchOut || null,
          notes: assignedArea,
        },
      ];
    }
    return [];
  }, [todayRecord, activeStaff.id, selectedDate, assignedArea]);

  // Dynamic Total Calculation (NO HARDCODED 8.0h / 1.5h) matching @app.route('/api/get_staff_summary/<staff_id>')
  const staffSummary: StaffSummaryResponse = useMemo(() => {
    return getStaffSummary(activeSessions);
  }, [activeSessions]);

  const regularHours = staffSummary.regular_hours;
  const otHours = staffSummary.overtime_hours;
  const isDutyActive = staffSummary.is_duty_active;

  // Active in-progress session (if any)
  const currentOpenSession = useMemo(() => {
    return activeSessions.find((s) => !s.punch_out) || null;
  }, [activeSessions]);

  // Global/State Variables for exact real-time punch timestamp tracking
  const punchInTimestampRef = useRef<Date | null>(null);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [geofenceResult, setGeofenceResult] = useState<GeofenceVerificationResult | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [gpsHardwareOffAlert, setGpsHardwareOffAlert] = useState<string | null>(null);
  const [isGpsModalOpen, setIsGpsModalOpen] = useState<boolean>(false);
  const [rejectionModalState, setRejectionModalState] = useState<{
    isOpen: boolean;
    result: GeofenceVerificationResult | null;
    punchType: 'IN' | 'OUT';
  }>({
    isOpen: false,
    result: null,
    punchType: 'IN',
  });
  const [punchInTimestamp, setPunchInTimestamp] = useState<Date | null>(() => {
    if (todayRecord?.punchInTimestamp) {
      return new Date(todayRecord.punchInTimestamp);
    }
    if (todayRecord?.punchIn) {
      const [h, m] = todayRecord.punchIn.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    }
    return null;
  });

  // Sync punchInTimestamp with todayRecord updates
  useEffect(() => {
    let nextTimestamp: Date | null = null;
    if (currentOpenSession?.punch_in) {
      const d = new Date(currentOpenSession.punch_in);
      if (!isNaN(d.getTime())) {
        nextTimestamp = d;
      }
    }
    if (!nextTimestamp) {
      if (todayRecord?.punchInTimestamp) {
        const d = new Date(todayRecord.punchInTimestamp);
        if (!isNaN(d.getTime())) {
          nextTimestamp = d;
        }
      } else if (todayRecord?.punchIn) {
        const [h, m] = todayRecord.punchIn.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) {
          const d = new Date();
          d.setHours(h, m, 0, 0);
          nextTimestamp = d;
        }
      }
    }

    punchInTimestampRef.current = nextTimestamp;
    setPunchInTimestamp((prev) => {
      if (!prev && !nextTimestamp) return null;
      if (prev && nextTimestamp && prev.getTime() === nextTimestamp.getTime()) return prev;
      return nextTimestamp;
    });
  }, [todayRecord?.punchIn, todayRecord?.punchInTimestamp, currentOpenSession?.punch_in, selectedDate, activeStaff.id]);

  // Synchronize updateUI(data) dynamically with current staffSummary and expose to window
  useEffect(() => {
    (window as unknown as { updateUI: typeof updateUI }).updateUI = updateUI;
    updateUI(staffSummary);
  }, [staffSummary.regular_hours, staffSummary.overtime_hours, staffSummary.is_duty_active, staffSummary.sessions.length]);

  // Synchronize dynamic Admin-configured geofence settings from database
  useEffect(() => {
    fetchLiveGeofenceSettings();
    const unsub = subscribeToGeofenceSettings(() => {
      // triggers dynamic config refresh
    });
    return () => unsub();
  }, []);

  // 3. BACKEND API SYNC
  const syncPunchWithBackend = (
    action: 'IN' | 'OUT',
    timestamp: Date,
    reg: string | number = 0,
    ot: string | number = 0,
    lat?: number,
    lng?: number,
    distanceMeters?: number
  ) => {
    try {
      fetch(getApiEndpoint('/api/attendance/punch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: action,
          timestamp: timestamp.toISOString(),
          regular_hours: parseFloat(String(reg)),
          overtime_hours: parseFloat(String(ot)),
          lat,
          lng,
          distance_meters: distanceMeters,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            return { message: `Backend punch responded with status ${response.status}` };
          }
          return response.json().catch(() => ({ message: 'Punch synced' }));
        })
        .then((data) => {
          if (data?.message) {
            console.log('Sync Status:', data.message);
          }
        })
        .catch((error) => console.warn('Sync notice:', error));
    } catch (err) {
      console.warn('Network sync notice:', err);
    }
  };

  // 1. PUNCH IN FUNCTION
  const handlePunchIn = async () => {
    setIsLocating(true);
    setGpsHardwareOffAlert(null);
    let punchLocationResult;
    try {
      // Explicitly triggers navigator.geolocation only upon Punch In button click with 5-second timeout
      punchLocationResult = await requestLocationOnPunch('IN', activeStaff.department);
    } catch (err: any) {
      console.warn('Location capture error on punch in:', err);
      if (err?.isGpsOff || err?.code === 2 || err?.code === 3 || err?.message === GPS_OFF_ALERT_MESSAGE) {
        const liveCfg = getStoredGeofenceConfig();
        punchLocationResult = {
          allowed: false,
          userCoords: { lat: 0, lng: 0 },
          distanceMeters: 999999,
          maxRadiusMeters: liveCfg.maxAllowedRadiusMeters,
          isGps: false,
          isGpsOff: true,
          gpsErrorMessage: GPS_OFF_ALERT_MESSAGE,
          reason: GPS_OFF_ALERT_MESSAGE,
          source: 'DEVICE_GPS' as const,
        };
      }
    } finally {
      setIsLocating(false);
    }

    // 3. If device GPS is turned OFF, immediately display clear alert
    if (punchLocationResult?.isGpsOff) {
      const alertMsg = GPS_OFF_ALERT_MESSAGE;
      setGpsHardwareOffAlert(alertMsg);
      setIsGpsModalOpen(true);
      setFeedbackMessage({ type: 'warning', text: alertMsg });
      if (onFlash) onFlash(alertMsg, 'danger');
      try {
        window.alert(alertMsg);
      } catch {}
      return;
    }

    const currentGeofenceConfig = getStoredGeofenceConfig();

    if (!punchLocationResult || !punchLocationResult.isGps || !punchLocationResult.allowed) {
      const activeGeofence: GeofenceVerificationResult = punchLocationResult
        ? verifyHospitalGeofence(
            punchLocationResult.userCoords.lat,
            punchLocationResult.userCoords.lng,
            activeStaff.department,
            currentGeofenceConfig
          )
        : {
            allowed: false,
            distanceMeters: 999999,
            maxAllowedRadius: currentGeofenceConfig.maxAllowedRadiusMeters,
            maxRadiusMeters: currentGeofenceConfig.maxAllowedRadiusMeters,
            hospitalCoords: { lat: currentGeofenceConfig.hospitalLat, lng: currentGeofenceConfig.hospitalLng },
            userCoords: { lat: 0, lng: 0 },
            status: 'OUTSIDE_GEOFENCE' as const,
            message: 'Real GPS lock required. Live coordinates could not be verified.',
            reason: `GPS lock required within ${currentGeofenceConfig.maxAllowedRadiusMeters}m perimeter.`,
          };

      setGeofenceResult(activeGeofence);
      setRejectionModalState({
        isOpen: true,
        result: activeGeofence,
        punchType: 'IN',
      });
      const blockMsg = `Punch Failed: You are Outside Hospital Boundary (${activeGeofence.distanceMeters < 900000 ? activeGeofence.distanceMeters.toFixed(1) + 'm away' : 'GPS lock required'})`;
      setFeedbackMessage({ type: 'warning', text: blockMsg });
      if (onFlash) onFlash(blockMsg, 'danger');
      return;
    }

    const activeGeofence: GeofenceVerificationResult = verifyHospitalGeofence(
      punchLocationResult.userCoords.lat,
      punchLocationResult.userCoords.lng,
      activeStaff.department,
      currentGeofenceConfig
    );

    setGeofenceResult(activeGeofence);

    const timestamp = new Date(); // Captures exact real-time Punch In
    punchInTimestampRef.current = timestamp;
    setPunchInTimestamp(timestamp);

    const formattedTime = timestamp.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const hours = timestamp.getHours().toString().padStart(2, '0');
    const minutes = timestamp.getMinutes().toString().padStart(2, '0');
    const time24h = `${hours}:${minutes}`;

    const recordId = todayRecord ? todayRecord.id : `att_${activeStaff.id}_${selectedDate}`;
    
    // Fix multi-session loop bug: Auto-close any active unclosed sessions before opening a new one
    const autoClosedSessions = autoCloseActiveSessions(activeSessions, timestamp.toISOString(), 'Auto-closed on new punch-in');
    const userLat = activeGeofence?.userCoords.lat ?? HOSPITAL_LAT;
    const userLng = activeGeofence?.userCoords.lng ?? HOSPITAL_LNG;
    const distM = activeGeofence?.distanceMeters ?? 0.0;
    const sessionGpsNote = `[GPS: ${distM.toFixed(1)}m]`;

    const newSession: AttendanceSession = {
      id: `sess_${recordId}_${autoClosedSessions.length + 1}_${Date.now()}`,
      staff_id: activeStaff.id,
      date: selectedDate,
      punch_in: timestamp.toISOString(),
      punch_out: null,
      notes: `${assignedArea} ${sessionGpsNote}`,
      punch_in_lat: userLat,
      punch_in_lng: userLng,
      punch_in_distance_meters: distM,
    };

    const allSessions = [...autoClosedSessions, newSession];
    const summary = getStaffSummary(allSessions);

    // Update Attendance State
    const updatedRecord: AttendanceRecord = {
      id: recordId,
      userId: activeStaff.id,
      date: selectedDate,
      punchIn: todayRecord?.punchIn || time24h,
      punchOut: null,
      punchInTimestamp: todayRecord?.punchInTimestamp || timestamp.toISOString(),
      punchOutTimestamp: null,
      regularHours: summary.regular_hours,
      otHours: summary.overtime_hours,
      sessions: allSessions,
      status: 'Present',
      notes: todayRecord?.notes || assignedArea,
      punchInLat: userLat,
      punchInLng: userLng,
      punchInDistanceMeters: distM,
    };
    onSaveRecord(updatedRecord);
    recordLivePunchInToDb(updatedRecord);

    // Backend API Call
    syncPunchWithBackend('IN', timestamp, summary.regular_hours, summary.overtime_hours, userLat, userLng, distM);

    const sessionNum = allSessions.length;
    const sessionLabel = sessionNum > 1 ? ` (Session #${sessionNum})` : '';
    const msg = `Punch In successful (${formattedTime})${sessionLabel}! Duty active (${distM.toFixed(1)}m from center).`;
    if (onFlash) onFlash(msg, 'success');
    setFeedbackMessage({ type: 'success', text: msg });
    setTimeout(() => setFeedbackMessage(null), 4500);
  };

  // 2. PUNCH OUT & REAL-TIME HOURS CALCULATION
  const handlePunchOut = async () => {
    setIsLocating(true);
    setGpsHardwareOffAlert(null);
    let punchLocationResult;
    try {
      // Explicitly triggers navigator.geolocation only upon Punch Out button click with 5-second timeout
      punchLocationResult = await requestLocationOnPunch('OUT', activeStaff.department);
    } catch (err: any) {
      console.warn('Location capture error on punch out:', err);
      if (err?.isGpsOff || err?.code === 2 || err?.code === 3 || err?.message === GPS_OFF_ALERT_MESSAGE) {
        const liveCfg = getStoredGeofenceConfig();
        punchLocationResult = {
          allowed: false,
          userCoords: { lat: 0, lng: 0 },
          distanceMeters: 999999,
          maxRadiusMeters: liveCfg.maxAllowedRadiusMeters,
          isGps: false,
          isGpsOff: true,
          gpsErrorMessage: GPS_OFF_ALERT_MESSAGE,
          reason: GPS_OFF_ALERT_MESSAGE,
          source: 'DEVICE_GPS' as const,
        };
      }
    } finally {
      setIsLocating(false);
    }

    // 3. If device GPS is turned OFF, immediately display clear alert
    if (punchLocationResult?.isGpsOff) {
      const alertMsg = GPS_OFF_ALERT_MESSAGE;
      setGpsHardwareOffAlert(alertMsg);
      setIsGpsModalOpen(true);
      setFeedbackMessage({ type: 'warning', text: alertMsg });
      if (onFlash) onFlash(alertMsg, 'danger');
      try {
        window.alert(alertMsg);
      } catch {}
      return;
    }

    const currentGeofenceConfig = getStoredGeofenceConfig();

    if (!punchLocationResult || !punchLocationResult.isGps || !punchLocationResult.allowed) {
      const activeGeofence: GeofenceVerificationResult = punchLocationResult
        ? verifyHospitalGeofence(
            punchLocationResult.userCoords.lat,
            punchLocationResult.userCoords.lng,
            activeStaff.department,
            currentGeofenceConfig
          )
        : {
            allowed: false,
            distanceMeters: 999999,
            maxAllowedRadius: currentGeofenceConfig.maxAllowedRadiusMeters,
            maxRadiusMeters: currentGeofenceConfig.maxAllowedRadiusMeters,
            hospitalCoords: { lat: currentGeofenceConfig.hospitalLat, lng: currentGeofenceConfig.hospitalLng },
            userCoords: { lat: 0, lng: 0 },
            status: 'OUTSIDE_GEOFENCE' as const,
            message: 'Real GPS lock required. Live coordinates could not be verified.',
            reason: `GPS lock required within ${currentGeofenceConfig.maxAllowedRadiusMeters}m perimeter.`,
          };

      setGeofenceResult(activeGeofence);
      setRejectionModalState({
        isOpen: true,
        result: activeGeofence,
        punchType: 'OUT',
      });
      const blockMsg = `Punch Failed: You are Outside Hospital Boundary (${activeGeofence.distanceMeters < 900000 ? activeGeofence.distanceMeters.toFixed(1) + 'm away' : 'GPS lock required'})`;
      setFeedbackMessage({ type: 'warning', text: blockMsg });
      if (onFlash) onFlash(blockMsg, 'danger');
      return;
    }

    const activeGeofence: GeofenceVerificationResult = verifyHospitalGeofence(
      punchLocationResult.userCoords.lat,
      punchLocationResult.userCoords.lng,
      activeStaff.department,
      currentGeofenceConfig
    );

    setGeofenceResult(activeGeofence);

    const punchOutTimestamp = new Date(); // Captures exact Punch Out
    const recordId = todayRecord ? todayRecord.id : `att_${activeStaff.id}_${selectedDate}`;
    const userLat = activeGeofence?.userCoords.lat ?? HOSPITAL_LAT;
    const userLng = activeGeofence?.userCoords.lng ?? HOSPITAL_LNG;
    const distM = activeGeofence?.distanceMeters ?? 0.0;

    let allSessions = [...activeSessions];
    const openIdx = allSessions.findIndex((s) => !s.punch_out);

    if (openIdx !== -1) {
      allSessions[openIdx] = {
        ...allSessions[openIdx],
        punch_out: punchOutTimestamp.toISOString(),
        punch_out_lat: userLat,
        punch_out_lng: userLng,
        punch_out_distance_meters: distM,
      };
    } else {
      const effectiveInTimestamp =
        punchInTimestampRef.current ||
        punchInTimestamp ||
        (todayRecord?.punchInTimestamp ? new Date(todayRecord.punchInTimestamp) : null) ||
        (todayRecord?.punchIn ? new Date() : null);

      if (!effectiveInTimestamp) {
        const errMsg = 'Error: Punch In time record nahi mila!';
        setFeedbackMessage({ type: 'warning', text: errMsg });
        if (onFlash) onFlash(errMsg, 'danger');
        return;
      }

      allSessions.push({
        id: `sess_${recordId}_${allSessions.length + 1}`,
        staff_id: activeStaff.id,
        date: selectedDate,
        punch_in: effectiveInTimestamp.toISOString(),
        punch_out: punchOutTimestamp.toISOString(),
        notes: assignedArea,
        punch_out_lat: userLat,
        punch_out_lng: userLng,
        punch_out_distance_meters: distM,
      });
    }

    // Shift Attendance processing (Standard 8h Baseline & Night shift handling)
    const effectiveIn = allSessions[0]?.punch_in ? new Date(allSessions[0].punch_in) : punchOutTimestamp;
    const shiftResult = process_shift_attendance(
      effectiveIn,
      punchOutTimestamp,
      (activeStaff.shift || 'MORNING').toUpperCase(),
      selectedDate
    );

    // Dynamic Total Calculation (NO HARDCODED 8.0h / 1.5h) matching get_staff_summary
    const summary = getStaffSummary(allSessions);
    const regHours = allSessions.length <= 1 ? shiftResult.regular_hours : summary.regular_hours;
    const overtimeHours = allSessions.length <= 1 ? shiftResult.overtime_hours : summary.overtime_hours;
    const targetCalendarDate = shiftResult.calendar_date || selectedDate;

    // Formatting values (2 decimal places)
    const regFormatted = regHours.toFixed(2);
    const otFormatted = overtimeHours.toFixed(2);

    const hours = punchOutTimestamp.getHours().toString().padStart(2, '0');
    const minutes = punchOutTimestamp.getMinutes().toString().padStart(2, '0');
    const time24h = `${hours}:${minutes}`;

    // Update Attendance Record (Assigned to Calendar Base Date)
    const updatedRecord: AttendanceRecord = {
      id: `att_${activeStaff.id}_${targetCalendarDate}`,
      userId: activeStaff.id,
      date: targetCalendarDate,
      punchIn: todayRecord?.punchIn || getCurrent24hTime(),
      punchOut: time24h,
      punchInTimestamp: todayRecord?.punchInTimestamp || punchOutTimestamp.toISOString(),
      punchOutTimestamp: punchOutTimestamp.toISOString(),
      regularHours: regHours,
      otHours: overtimeHours,
      sessions: allSessions,
      status: 'Duty Completed',
      notes: todayRecord?.notes || assignedArea,
      punchInLat: todayRecord?.punchInLat ?? userLat,
      punchInLng: todayRecord?.punchInLng ?? userLng,
      punchInDistanceMeters: todayRecord?.punchInDistanceMeters ?? distM,
      punchOutLat: userLat,
      punchOutLng: userLng,
      punchOutDistanceMeters: distM,
    };
    onSaveRecord(updatedRecord);
    recordLivePunchOutToDb(updatedRecord);

    // Backend Sync
    syncPunchWithBackend('OUT', punchOutTimestamp, regFormatted, otFormatted, userLat, userLng, distM);

    const sessionCountText = allSessions.length > 1 ? ` (Session #${allSessions.length})` : '';
    const totalDurationText = summary.total_hours !== undefined ? ` • Total: ${summary.total_hours.toFixed(2)}h` : '';
    const msg = `Punch Out successful${sessionCountText} • Reg: ${regFormatted}h, OT: ${otFormatted}h${totalDurationText}`;
    if (onFlash) onFlash(msg, 'success');
    setFeedbackMessage({ type: 'success', text: msg });
    setTimeout(() => setFeedbackMessage(null), 4500);
  };

  // @app.route('/api/reset_punch', methods=['POST'])
  // @login_required
  // def reset_punch():
  //     # Strict Guard: Block normal staff from resetting punches
  //     if current_user.role != 'admin':
  //         return jsonify({"status": "error", "message": "Permission Denied! Only Admin can reset records."}), 403
  const handleResetPunch = () => {
    // Strict Guard: Block normal staff from resetting punches
    if (currentUser?.role !== 'admin') {
      const errorMsg = 'Permission Denied! Only Admin can reset records.';
      if (onFlash) onFlash(errorMsg, 'danger');
      setFeedbackMessage({
        type: 'warning',
        text: errorMsg,
      });
      return { status: 'error', message: errorMsg, statusCode: 403 };
    }

    punchInTimestampRef.current = null;
    setPunchInTimestamp(null);

    const recordId = todayRecord ? todayRecord.id : `att_${activeStaff.id}_${selectedDate}`;
    const resetRecord: AttendanceRecord = {
      id: recordId,
      userId: activeStaff.id,
      date: selectedDate,
      punchIn: null,
      punchOut: null,
      punchInTimestamp: null,
      punchOutTimestamp: null,
      regularHours: 0,
      otHours: 0,
      status: 'Absent',
      notes: assignedArea,
    };
    onSaveRecord(resetRecord);
    const successMsg = 'Punch record reset successfully.';
    if (onFlash) onFlash(successMsg, 'info');
    setFeedbackMessage({
      type: 'info',
      text: successMsg,
    });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 3000);
    return { status: 'success', message: successMsg };
  };

  const confirmReset = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (currentUser?.role !== 'admin') {
      const errorMsg = 'Permission Denied! Only Admin can reset records.';
      if (onFlash) onFlash(errorMsg, 'danger');
      setFeedbackMessage({
        type: 'warning',
        text: errorMsg,
      });
      return;
    }
    setIsConfirmingReset(true);
  };

  const handleExecuteReset = () => {
    setIsConfirmingReset(false);
    handleResetPunch();
  };

  const handleCancelReset = () => {
    setIsConfirmingReset(false);
  };

  return (
    <div className={`w-full flex flex-col items-center justify-center ${isModal ? 'py-2' : 'min-h-[85vh] py-8 px-4'}`} id="staff-punching-portal-root">
      {/* Top Header Bar for Kiosk/Page Mode */}
      {!isModal && (
        <div className="w-full max-w-[420px] mb-4 flex flex-col gap-2">
          {/* User Account & Logout Banner */}
          <div className="flex items-center justify-between bg-slate-200/80 px-3.5 py-2 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${currentUser?.role === 'admin' ? 'bg-blue-600' : currentUser?.role === 'manager' ? 'bg-purple-600' : 'bg-emerald-600'}`} />
              <div className="flex flex-col">
                <span className="font-semibold text-slate-800 leading-tight">
                  {currentUser ? currentUser.name : activeStaff.name}
                </span>
                <span className={`text-[10px] uppercase font-bold ${
                  currentUser?.role === 'admin'
                    ? 'text-blue-600'
                    : currentUser?.role === 'manager'
                    ? 'text-purple-600'
                    : 'text-emerald-600'
                }`}>
                  Role: {currentUser?.role || 'staff'}
                </span>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                id="btn-portal-logout"
                onClick={onLogout}
                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-md transition-colors"
                title="Logout"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </button>
            )}
          </div>

          {/* Navigation Bar */}
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              id="btn-portal-back-admin"
              onClick={() => {
                if (currentUser && currentUser.role === 'staff') {
                  onUnauthorizedAttempt?.();
                } else if (onBackToAdmin) {
                  onBackToAdmin();
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#1E3A8A] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Admin Dashboard</span>
            </button>

            <span className="text-2xs font-mono text-slate-400 bg-slate-200/80 px-2 py-0.5 rounded-md">
              {selectedDate}
            </span>
          </div>
        </div>
      )}

      {/* Supervisor Staff Selector Dropdown (Active in Authorized Kiosk Mode) */}
      {!isStaffLoggedIn && (
        <div className="w-full max-w-[420px] mb-3">
          <div className="flex items-center justify-between text-2xs text-slate-500 font-semibold mb-1 px-1">
            <span>Hospital Kiosk Staff Selection (Authorized Terminal):</span>
            <span className="text-slate-400">Total: {staff.length} staff</span>
          </div>
          <div className="relative">
            <select
              id="select-portal-staff"
              value={activeStaff.id}
              onChange={(e) => {
                setSelectedStaffId(Number(e.target.value));
                setFeedbackMessage(null);
              }}
              className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-2 pl-3.5 pr-8 text-xs font-semibold text-slate-800 shadow-xs focus:border-[#1E3A8A] focus:outline-hidden focus:ring-1 focus:ring-[#1E3A8A]"
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (HK-{String(s.id).padStart(3, '0')}) - {s.department || 'General'}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      )}

      {/* Main Staff Punching Card matching user's exact template:
          <div class="card border-0 shadow-sm p-4 rounded-4 mx-auto" style="max-width: 420px;">
      */}
      <div
        className="card border-0 shadow-sm p-4 rounded-4 mx-auto bg-white border border-slate-100 shadow-md p-6 rounded-2xl mx-auto w-full transition-all duration-150"
        style={{ maxWidth: '420px' }}
        id="card-staff-punch-portal"
      >
        {/* Logged-in Staff Info (Locked) */}
        <div className="text-center mb-3">
          <span className="badge bg-primary-subtle text-primary fw-bold px-3 py-2 rounded-pill mb-2 inline-block bg-[#cfe2ff] text-[#084298] font-bold px-3.5 py-1.5 rounded-full text-xs mb-2 shadow-2xs">
            Staff Punching Portal
          </span>
          <h3 className="fw-bold mb-1 text-dark text-2xl font-bold mb-1 text-[#212529] tracking-tight" id="staff-name-display">
            {activeStaff.name}
          </h3>
          <p className="text-muted small mb-0 text-[#6c757d] text-xs sm:text-sm mb-0">
            Staff ID: <b className="text-slate-900 font-bold">{formattedStaffId}</b>
          </p>
          <p className="text-muted small text-[#6c757d] text-xs sm:text-sm mb-0">
            Assigned Area: <b className="text-slate-900 font-bold">{assignedArea}</b>
          </p>
        </div>

        {/* Toast / Notification feedback */}
        {feedbackMessage && (
          <div
            className={`mb-3 p-2.5 rounded-xl text-xs font-medium border flex items-center gap-2 ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : feedbackMessage.type === 'warning'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* GPS Hardware OFF Immediate Alert */}
        {gpsHardwareOffAlert && (
          <div
            role="alert"
            id="gps-hardware-off-alert-banner"
            className="mb-3 p-3.5 rounded-xl bg-amber-50 border-2 border-amber-500 text-amber-950 shadow-xs"
          >
            <div className="flex items-start gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <Smartphone className="h-5 w-5 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xs font-black text-amber-950 uppercase tracking-wider">
                    GPS Turned OFF
                  </span>
                  <button
                    type="button"
                    id="btn-dismiss-gps-off-alert"
                    onClick={() => setGpsHardwareOffAlert(null)}
                    className="text-amber-700 hover:text-amber-950 p-1 rounded-md cursor-pointer"
                    aria-label="Dismiss alert"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs sm:text-sm font-bold text-amber-900 mt-1 leading-snug">
                  {gpsHardwareOffAlert}
                </p>
                <div className="mt-2 text-3xs sm:text-2xs text-amber-800 bg-amber-100/70 p-2 rounded-lg border border-amber-200/80 space-y-0.5">
                  <p>
                    &bull; <strong>Android:</strong> Swipe down Quick Settings &rarr; Tap <strong>Location</strong> icon to turn <strong>ON</strong>.
                  </p>
                  <p>
                    &bull; <strong>iPhone:</strong> Go to <strong>Settings</strong> &rarr; <strong>Privacy &amp; Security</strong> &rarr; <strong>Location Services</strong> &rarr; Turn <strong>ON</strong>.
                  </p>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-gps-retry-punch"
                    onClick={handlePunchIn}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCw className="h-3 w-3" />
                    <span>I have turned ON GPS &mdash; Retry</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GPS Geofence Verification Status Card */}
        <div className="mb-3">
          <GeofenceStatusCard
            compact
            onStatusChange={(res) => setGeofenceResult(res)}
          />
        </div>

        {/* 1. Top Summary Cards (regularHoursCard & otHoursCard) */}
        <div className="row g-2 mb-3 grid grid-cols-2 gap-2.5">
          <div className="col card bg-slate-50 border border-slate-200 rounded-xl p-3 text-center shadow-2xs">
            <span className="text-2xs text-muted text-slate-500 font-bold uppercase tracking-wider block">
              Regular Hours
            </span>
            <h4
              id="regularHoursCard"
              className="fw-bold text-primary text-[#0d6efd] font-bold text-xl mb-0 mt-1 tracking-tight"
            >
              {staffSummary.regular_hours}h
            </h4>
          </div>
          <div className="col card bg-slate-50 border border-slate-200 rounded-xl p-3 text-center shadow-2xs">
            <span className="text-2xs text-muted text-slate-500 font-bold uppercase tracking-wider block">
              Overtime Hours
            </span>
            <h4
              id="otHoursCard"
              className="fw-bold text-warning text-amber-600 font-bold text-xl mb-0 mt-1 tracking-tight"
            >
              {staffSummary.overtime_hours}h
            </h4>
          </div>
        </div>

        {/* TODAY DUTY STATUS CARD */}
        <div className="card p-3 text-center bg-slate-50 border border-slate-200 rounded-xl">
          <h5 className="font-bold text-xs uppercase tracking-wider text-slate-600 mb-2.5">
            TODAY'S DUTY STATUS
          </h5>

          <div id="dutyStatusText" className="mb-2.5">
            {isDutyActive ? (
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                  Active Duty in Progress {activeSessions.length > 1 ? `(Session #${activeSessions.length})` : ''}
                </span>
                <p className="text-warning fw-bold text-amber-700 font-bold text-sm mb-0">
                  Punched In at {formatTimeTo12hStr(currentOpenSession?.punch_in || todayRecord?.punchIn)}
                </p>
              </div>
            ) : staffSummary.sessions.length > 0 ? (
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  Duty Completed ({staffSummary.sessions.length} session{staffSummary.sessions.length > 1 ? 's' : ''})
                </span>
                <p className="text-success fw-bold text-[#198754] font-bold text-sm mb-0">
                  Total Worked: {(staffSummary.total_hours ?? (regularHours + otHours)).toFixed(2)}h
                </p>
              </div>
            ) : (
              <p className="text-muted text-xs text-slate-500 mb-0">Not Punched Today</p>
            )}
          </div>

          {isDutyActive ? (
            <div>
              <button
                type="button"
                id="punchOutBtn"
                onClick={handlePunchOut}
                disabled={isLocating}
                className={`btn btn-danger w-100 w-full bg-[#dc3545] hover:bg-[#bb2d3b] active:bg-[#b02a37] text-white font-bold py-2.5 px-4 rounded-lg text-base shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  isLocating ? 'opacity-70 cursor-wait' : ''
                }`}
              >
                {isLocating ? (
                  <>
                    <RotateCw className="h-5 w-5 animate-spin me-1 inline" />
                    <span>VERIFYING GPS LOCATION...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="h-5 w-5 stroke-[2.5] me-1 inline" />
                    <span>PUNCH OUT</span>
                  </>
                )}
              </button>

              {/* 3. Status Subtitle */}
              <small id="statusSummaryText" className="text-muted mt-2 d-block text-xs text-slate-500 block">
                Reg: <span id="regHoursDisplay">{staffSummary.regular_hours}h</span> &bull; OT:{' '}
                <span id="otHoursDisplay">{staffSummary.overtime_hours}h</span> &bull; Sessions: {staffSummary.sessions.length}
              </small>

              {/* 2. Daily Sessions Container (sessionList) */}
              {staffSummary.sessions && staffSummary.sessions.length > 0 && (
                <div className="mt-2.5 p-2 bg-white rounded-lg border border-slate-200 text-left">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3 text-indigo-600" /> Daily Sessions ({staffSummary.sessions.length})
                    </span>
                    <span className="text-[10px] text-slate-400">Dynamic 8h Baseline</span>
                  </div>
                  <div id="sessionList" className="space-y-1 session-container">
                    {staffSummary.sessions.map((s) => (
                      <div
                        key={s.session_num}
                        className="d-flex justify-content-between border-bottom py-2 flex items-center justify-between border-b border-slate-100 py-2 text-xs"
                      >
                        <span>
                          #{s.session_num} &nbsp; {s.in_time} – {s.out_time}
                        </span>
                        <span className="fw-bold text-success font-bold text-[#198754]">
                          {s.hours}h
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : staffSummary.sessions.length > 0 ? (
            <div>
              <button
                type="button"
                id="punchOutBtn"
                className="btn btn-secondary disabled w-100 w-full bg-[#6c757d] text-white font-semibold py-2 px-4 rounded-lg text-sm cursor-not-allowed opacity-80"
                disabled
              >
                Duty Completed
              </button>

              {/* 3. Status Subtitle */}
              <small id="statusSummaryText" className="text-muted mt-2 d-block text-xs text-slate-500 block">
                Reg: <span id="regHoursDisplay">{staffSummary.regular_hours}h</span> &bull; OT:{' '}
                <span id="otHoursDisplay">{staffSummary.overtime_hours}h</span> &bull; Sessions: {staffSummary.sessions.length}
              </small>

              {/* 2. Daily Sessions Container (sessionList) */}
              <div className="mt-2.5 p-2 bg-white rounded-lg border border-slate-200 text-left">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3 text-indigo-600" /> Daily Sessions ({staffSummary.sessions.length})
                  </span>
                  <span className="text-[10px] text-slate-400">Dynamic 8h Baseline</span>
                </div>
                <div id="sessionList" className="space-y-1 session-container">
                  {staffSummary.sessions.map((s) => (
                    <div
                      key={s.session_num}
                      className="d-flex justify-content-between border-bottom py-2 flex items-center justify-between border-b border-slate-100 py-2 text-xs"
                    >
                      <span>
                        #{s.session_num} &nbsp; {s.in_time} – {s.out_time}
                      </span>
                      <span className="fw-bold text-success font-bold text-[#198754]">
                        {s.hours}h
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional multi-session punch in */}
              <button
                type="button"
                onClick={handlePunchIn}
                disabled={isLocating}
                className={`mt-2.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline block mx-auto cursor-pointer ${
                  isLocating ? 'opacity-50 cursor-wait' : ''
                }`}
              >
                {isLocating ? 'Acquiring GPS & Punching In...' : '+ Punch In for Next Session'}
              </button>

              {/* FIX: Reset link is only shown to ADMIN, NOT to STAFF */}
              {currentUser?.role === 'admin' && (
                <div className="mt-2 text-center">
                  {isConfirmingReset ? (
                    <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-1.5">
                      <p className="text-rose-800 font-semibold">Reset today's punch record?</p>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={handleExecuteReset}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-xs cursor-pointer shadow-xs"
                        >
                          Yes, Reset
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelReset}
                          className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-semibold text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <a
                      href="#reset"
                      id="link-admin-reset-punch-log"
                      onClick={confirmReset}
                      className="text-danger small d-block text-xs text-rose-600 hover:text-rose-800 hover:underline font-semibold block cursor-pointer"
                    >
                      Admin: Reset Punch Log
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <button
                type="button"
                id="punchInBtn"
                onClick={handlePunchIn}
                disabled={isLocating}
                className={`btn w-100 w-full font-bold py-2.5 px-4 rounded-lg text-base shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  isLocating ? 'opacity-80 cursor-wait bg-[#198754] text-white' :
                  geofenceResult && !geofenceResult.allowed
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'btn-success bg-[#198754] hover:bg-[#157347] active:bg-[#146c43] text-white'
                }`}
              >
                {isLocating ? (
                  <>
                    <RotateCw className="h-5 w-5 animate-spin me-1 inline" />
                    <span>VERIFYING GPS LOCATION...</span>
                  </>
                ) : geofenceResult && !geofenceResult.allowed ? (
                  <>
                    <ShieldAlert className="h-5 w-5 me-1 inline" />
                    <span>PUNCH IN (OUTSIDE 100M GEOFENCE)</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5 stroke-[2.5] me-1 inline" />
                    <span>PUNCH IN</span>
                  </>
                )}
              </button>

              {/* 3. Status Subtitle */}
              <small id="statusSummaryText" className="text-muted mt-2 d-block text-xs text-slate-500 block">
                Reg: <span id="regHoursDisplay">{staffSummary.regular_hours}h</span> &bull; OT:{' '}
                <span id="otHoursDisplay">{staffSummary.overtime_hours}h</span> &bull; Sessions: {staffSummary.sessions.length}
              </small>

              {/* 2. Daily Sessions Container (sessionList) */}
              <div id="sessionList" className="space-y-1 session-container mt-2"></div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Helper Footer */}
      <div className="w-full max-w-[420px] mt-4 text-center">
        <p className="text-2xs text-slate-500">
          Housekeeping Attendance Engine &bull; Real-time punch tracking &amp; OT calculation
        </p>
      </div>

      {/* Hospital GPS Geofence Rejection Popup Modal */}
      <GeofenceRejectionModal
        isOpen={rejectionModalState.isOpen}
        result={rejectionModalState.result}
        punchType={rejectionModalState.punchType}
        onClose={() => setRejectionModalState((prev) => ({ ...prev, isOpen: false }))}
        onLocationCorrected={() => {
          setRejectionModalState((prev) => ({ ...prev, isOpen: false }));
          const activeLimit = getStoredGeofenceConfig().maxAllowedRadiusMeters;
          const successMsg = `Location verified within ${activeLimit}m boundary. You may now punch.`;
          setFeedbackMessage({ type: 'success', text: successMsg });
          if (onFlash) onFlash(successMsg, 'success');
        }}
      />

      {/* Hospital GPS Hardware OFF Alert Popup Modal */}
      <GpsHardwareAlertModal
        isOpen={isGpsModalOpen}
        punchType="IN"
        onClose={() => setIsGpsModalOpen(false)}
        onRetry={handlePunchIn}
      />
    </div>
  );
};
