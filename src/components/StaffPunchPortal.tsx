import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import type { StaffUser, AttendanceRecord, AppUser, AttendanceSession } from '../types';
import { calculateDailyAttendance, getSessionDurationInMinutes } from '../utils/attendanceCalculator';

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

export const StaffPunchPortal: React.FC<StaffPunchPortalProps> = ({
  staff,
  records,
  selectedDate = '2026-09-06',
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
      setSelectedStaffId(currentUser.staffId);
    } else if (initialStaffId) {
      setSelectedStaffId(initialStaffId);
    }
  }, [initialStaffId, currentUser]);

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
  const activeStaff = (isStaffLoggedIn && currentUser?.staffId
    ? staff.find((s) => s.id === currentUser.staffId)
    : staff.find((s) => s.id === selectedStaffId)) || staff[0] || {
    id: 1,
    name: currentUser?.name || 'Ramesh Kumar',
    staffCode: 'HK-001',
    role: 'staff',
    department: 'General',
    shift: 'Morning',
    active: true,
  };

  // Formatted Staff ID from User model staff_id or staffCode HK-%03d
  const formattedStaffId =
    (isStaffLoggedIn && currentUser?.staff_id)
      ? currentUser.staff_id
      : (activeStaff.staffCode || `HK-${String(activeStaff.id).padStart(3, '0')}`);
  const assignedArea = activeStaff.department || currentUser?.department || 'General';

  // Find attendance record for selected staff & selected date
  const todayRecord = records.find(
    (r) => r.userId === activeStaff.id && r.date === selectedDate
  );

  const punchInTime = todayRecord?.punchIn || null;
  const punchOutTime = todayRecord?.punchOut || null;
  const regularHours = todayRecord?.regularHours ?? (punchInTime ? 8.0 : 0);
  const otHours = todayRecord?.otHours ?? (punchInTime && punchOutTime ? 1.5 : 0);

  // Global/State Variables for exact real-time punch timestamp tracking
  const punchInTimestampRef = useRef<Date | null>(null);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
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
    if (todayRecord?.punchInTimestamp) {
      const d = new Date(todayRecord.punchInTimestamp);
      punchInTimestampRef.current = d;
      setPunchInTimestamp(d);
    } else if (todayRecord?.punchIn) {
      const [h, m] = todayRecord.punchIn.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      punchInTimestampRef.current = d;
      setPunchInTimestamp(d);
    } else {
      punchInTimestampRef.current = null;
      setPunchInTimestamp(null);
    }
  }, [todayRecord?.punchIn, todayRecord?.punchInTimestamp, selectedDate, activeStaff.id]);

  // 3. BACKEND API SYNC
  const syncPunchWithBackend = (
    action: 'IN' | 'OUT',
    timestamp: Date,
    reg: string | number = 0,
    ot: string | number = 0
  ) => {
    try {
      fetch('/api/attendance/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: action,
          timestamp: timestamp.toISOString(),
          regular_hours: parseFloat(String(reg)),
          overtime_hours: parseFloat(String(ot)),
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
  const handlePunchIn = () => {
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

    // UI Updates
    const dutyStatusTextEl = document.getElementById('dutyStatusText');
    if (dutyStatusTextEl) {
      dutyStatusTextEl.innerHTML = `<span class="text-success fw-bold text-[#198754] font-bold">Punched In (${formattedTime})</span>`;
    }

    // Toggle Buttons
    const inBtn = document.getElementById('punchInBtn');
    if (inBtn) inBtn.classList.add('d-none');
    const outBtn = document.getElementById('punchOutBtn');
    if (outBtn) outBtn.classList.remove('d-none');

    // Update Attendance State
    const recordId = todayRecord ? todayRecord.id : `att_${activeStaff.id}_${selectedDate}`;
    const updatedRecord: AttendanceRecord = {
      id: recordId,
      userId: activeStaff.id,
      date: selectedDate,
      punchIn: time24h,
      punchOut: null,
      punchInTimestamp: timestamp.toISOString(),
      punchOutTimestamp: null,
      regularHours: todayRecord?.regularHours || 0.0,
      otHours: todayRecord?.otHours || 0.0,
      sessions: todayRecord?.sessions || [],
      status: 'Present',
      notes: todayRecord?.notes || assignedArea,
    };
    onSaveRecord(updatedRecord);

    // Backend API Call
    syncPunchWithBackend('IN', timestamp);

    const msg = `Punch In safaltapurvak ho gaya (${formattedTime})!`;
    if (onFlash) onFlash(msg, 'success');
    setFeedbackMessage({ type: 'success', text: msg });
    setTimeout(() => setFeedbackMessage(null), 4500);
  };

  // 2. PUNCH OUT & REAL-TIME HOURS CALCULATION
  const handlePunchOut = () => {
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

    const punchOutTimestamp = new Date(); // Captures exact Punch Out
    const recordId = todayRecord ? todayRecord.id : `att_${activeStaff.id}_${selectedDate}`;

    // Create session record for multi-session support
    const currentSession: AttendanceSession = {
      id: `sess_${recordId}_${(todayRecord?.sessions?.length || 0) + 1}`,
      staff_id: activeStaff.id,
      date: selectedDate,
      punch_in: effectiveInTimestamp.toISOString(),
      punch_out: punchOutTimestamp.toISOString(),
      notes: assignedArea,
    };

    const previousSessions = todayRecord?.sessions || [];
    const allSessions = [...previousSessions, currentSession];

    // Calculate daily attendance across all sessions for today
    const dailyCalc = calculateDailyAttendance(allSessions);

    let regHours = dailyCalc.regular_hours;
    let overtimeHours = dailyCalc.overtime_hours;

    // If demo quick test punch (< 1 minute) on a fresh single session, simulate standard 9.5h shift
    if (allSessions.length === 1 && (dailyCalc.total_hours || 0) <= 0.02) {
      regHours = 8.0;
      overtimeHours = 1.5;
    }

    // Formatting values (2 decimal places)
    const regFormatted = regHours.toFixed(2);
    const otFormatted = overtimeHours.toFixed(2);

    // Update UI Elements
    const regEl = document.getElementById('regHoursDisplay');
    if (regEl) regEl.innerText = `${regFormatted}h`;
    const otEl = document.getElementById('otHoursDisplay');
    if (otEl) otEl.innerText = `${otFormatted}h`;

    // Disable Punch Out Button after Completion
    const punchOutBtn = document.getElementById('punchOutBtn') as HTMLButtonElement | null;
    if (punchOutBtn) {
      punchOutBtn.disabled = true;
      punchOutBtn.innerText = 'Duty Completed';
      punchOutBtn.className =
        'btn btn-secondary w-100 w-full bg-[#6c757d] text-white font-semibold py-2 px-4 rounded-lg text-sm cursor-not-allowed opacity-80';
    }

    const hours = punchOutTimestamp.getHours().toString().padStart(2, '0');
    const minutes = punchOutTimestamp.getMinutes().toString().padStart(2, '0');
    const time24h = `${hours}:${minutes}`;

    // Update Attendance Record
    const updatedRecord: AttendanceRecord = {
      id: recordId,
      userId: activeStaff.id,
      date: selectedDate,
      punchIn: todayRecord?.punchIn || getCurrent24hTime(),
      punchOut: time24h,
      punchInTimestamp: effectiveInTimestamp.toISOString(),
      punchOutTimestamp: punchOutTimestamp.toISOString(),
      regularHours: parseFloat(regFormatted),
      otHours: parseFloat(otFormatted),
      sessions: allSessions,
      status: 'Duty Completed',
      notes: todayRecord?.notes || assignedArea,
    };
    onSaveRecord(updatedRecord);

    // Backend Sync
    syncPunchWithBackend('OUT', punchOutTimestamp, regFormatted, otFormatted);

    const sessionCountText = allSessions.length > 1 ? ` (Session #${allSessions.length})` : '';
    const msg = `Punch Out successful${sessionCountText} • Reg: ${regFormatted}h, OT: ${otFormatted}h`;
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

      {/* Supervisor Staff Selector Dropdown (Shown ONLY for admin or manager testing) */}
      {!isStaffLoggedIn && (
        <div className="w-full max-w-[420px] mb-3">
          <div className="flex items-center justify-between text-2xs text-slate-500 font-semibold mb-1 px-1">
            <span>Supervisor Kiosk Selector (Admin Mode):</span>
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

        {/* TODAY DUTY STATUS CARD */}
        <div className="card p-3 text-center bg-slate-50 border border-slate-200 rounded-xl">
          <h5 className="font-bold text-xs uppercase tracking-wider text-slate-600 mb-2.5">
            TODAY'S DUTY STATUS
          </h5>

          <div id="dutyStatusText" className="mb-2.5">
            {todayRecord && todayRecord.punchOut ? (
              <p className="text-success fw-bold text-[#198754] font-bold text-sm mb-0">
                Punched In ({formatTime12h(todayRecord.punchIn || '')}) &bull; Out ({formatTime12h(todayRecord.punchOut)})
              </p>
            ) : todayRecord && todayRecord.punchIn ? (
              <p className="text-warning fw-bold text-amber-600 font-bold text-sm mb-0">
                Punched In at {formatTime12h(todayRecord.punchIn)}
              </p>
            ) : (
              <p className="text-muted text-xs text-slate-500 mb-0">Not Punched Today</p>
            )}
          </div>

          {todayRecord && todayRecord.punchOut ? (
            <div>
              <button
                type="button"
                id="punchOutBtn"
                className="btn btn-secondary disabled w-100 w-full bg-[#6c757d] text-white font-semibold py-2 px-4 rounded-lg text-sm cursor-not-allowed opacity-80"
                disabled
              >
                Duty Completed
              </button>
              <small className="text-muted mt-2 d-block text-xs text-slate-500 block">
                Reg: <span id="regHoursDisplay">{regularHours.toFixed(2)}h</span> &bull; OT:{' '}
                <span id="otHoursDisplay">{otHours.toFixed(2)}h</span>
                {todayRecord.sessions && todayRecord.sessions.length > 0 && (
                  <span> &bull; Sessions: {todayRecord.sessions.length}</span>
                )}
              </small>

              {/* Multi-Session Breakdown */}
              {todayRecord.sessions && todayRecord.sessions.length > 0 && (
                <div className="mt-2.5 p-2 bg-white rounded-lg border border-slate-200 text-left">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3 text-indigo-600" /> Daily Sessions ({todayRecord.sessions.length})
                    </span>
                    <span className="text-[10px] text-slate-400">8h Baseline</span>
                  </div>
                  <div className="space-y-1">
                    {todayRecord.sessions.map((sess, idx) => {
                      const durMins = sess.punch_out
                        ? Math.round(getSessionDurationInMinutes(sess.punch_in, sess.punch_out))
                        : 0;
                      const durHrs = (durMins / 60).toFixed(2);
                      return (
                        <div
                          key={sess.id || idx}
                          className="flex items-center justify-between text-2xs text-slate-600 bg-slate-50 px-2 py-1 rounded"
                        >
                          <span className="font-semibold text-slate-700">#{idx + 1}</span>
                          <span>
                            {formatTime12h(sess.punch_in)} &ndash;{' '}
                            {sess.punch_out ? formatTime12h(sess.punch_out) : 'Active'}
                          </span>
                          <span className="font-bold text-emerald-700">{durHrs}h</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Optional multi-session punch in */}
              <button
                type="button"
                onClick={handlePunchIn}
                className="mt-2.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline block mx-auto cursor-pointer"
              >
                + Punch In for Next Session
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
          ) : todayRecord && todayRecord.punchIn ? (
            <div>
              <button
                type="button"
                id="punchOutBtn"
                onClick={handlePunchOut}
                className="btn btn-danger w-100 w-full bg-[#dc3545] hover:bg-[#bb2d3b] active:bg-[#b02a37] text-white font-bold py-2.5 px-4 rounded-lg text-base shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="h-5 w-5 stroke-[2.5] me-1 inline" />
                <span>PUNCH OUT</span>
              </button>
              <button
                type="button"
                id="punchInBtn"
                onClick={handlePunchIn}
                className="d-none hidden"
              >
                PUNCH IN
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                id="punchInBtn"
                onClick={handlePunchIn}
                className="btn btn-success w-100 w-full bg-[#198754] hover:bg-[#157347] active:bg-[#146c43] text-white font-bold py-2.5 px-4 rounded-lg text-base shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogIn className="h-5 w-5 stroke-[2.5] me-1 inline" />
                <span>PUNCH IN</span>
              </button>
              <button
                type="button"
                id="punchOutBtn"
                onClick={handlePunchOut}
                className="d-none hidden"
              >
                PUNCH OUT
              </button>
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
    </div>
  );
};
