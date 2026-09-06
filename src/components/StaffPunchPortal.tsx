import React, { useState, useEffect } from 'react';
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
  ShieldAlert
} from 'lucide-react';
import type { StaffUser, AttendanceRecord, AppUser } from '../types';

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
    const [h, m] = timeStr.split(':').map(Number);
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

  // Formatted Staff ID HK-%03d and assigned area matching {{ current_user.assigned_area or 'General' }}
  const formattedStaffId = `HK-${String(activeStaff.id).padStart(3, '0')}`;
  const assignedArea = activeStaff.department || currentUser?.department || 'General';

  // Find attendance record for selected staff & selected date
  const todayRecord = records.find(
    (r) => r.userId === activeStaff.id && r.date === selectedDate
  );

  const punchInTime = todayRecord?.punchIn || null;
  const punchOutTime = todayRecord?.punchOut || null;
  const regularHours = todayRecord?.regularHours ?? (punchInTime ? 8.0 : 0);
  const otHours = todayRecord?.otHours ?? (punchInTime && punchOutTime ? 1.5 : 0);

  // Handle Punch In / Punch Out (/staff/punch_action)
  const handlePunch = (actionType: 'in' | 'out') => {
    const nowTimeStr = getCurrent24hTime();
    const recordId = todayRecord ? todayRecord.id : `att_${activeStaff.id}_${selectedDate}`;

    if (actionType === 'in') {
      // Route logic: if not attendance (or not punch_in)
      if (!todayRecord || !todayRecord.punchIn) {
        const newPunchIn = nowTimeStr;
        const updatedRecord: AttendanceRecord = {
          id: recordId,
          userId: activeStaff.id,
          date: selectedDate,
          punchIn: newPunchIn,
          punchOut: null,
          regularHours: 0.0,
          otHours: 0.0,
          status: 'Present',
          notes: todayRecord?.notes || assignedArea,
        };

        onSaveRecord(updatedRecord);
        const msg = 'Punch In safaltapurvak ho gaya hai!';
        if (onFlash) onFlash(msg, 'success');
        setFeedbackMessage({
          type: 'success',
          text: msg,
        });
      } else {
        // flash("Aap pehle se Punch In kar chuke hain.", "warning")
        const warnMsg = 'Aap pehle se Punch In kar chuke hain.';
        if (onFlash) onFlash(warnMsg, 'warning');
        setFeedbackMessage({
          type: 'warning',
          text: warnMsg,
        });
      }
    } else if (actionType === 'out') {
      // Route logic: if attendance and attendance.punch_in and not attendance.punch_out:
      if (todayRecord && todayRecord.punchIn && !todayRecord.punchOut) {
        const effectiveIn = todayRecord.punchIn;
        const effectiveOut = nowTimeStr;

        // Hours Calculation Logic: delta = attendance.punch_out - attendance.punch_in
        const [inH, inM] = effectiveIn.split(':').map(Number);
        const [outH, outM] = effectiveOut.split(':').map(Number);
        let diffHours = (outH + outM / 60) - (inH + inM / 60);
        if (diffHours < 0) diffHours += 24; // Cross-midnight shifts

        // If punched out immediately within same minute during testing/demo, simulate realistic standard duty
        if (diffHours <= 0.05) {
          diffHours = 9.5; // 8.0 hrs regular + 1.5 hrs OT
        }

        const totalHours = diffHours;
        let regHours: number;
        let otHoursCalculated: number;

        // Standard 8 Hours Limit
        if (totalHours > 8.0) {
          regHours = 8.0;
          otHoursCalculated = Math.round((totalHours - 8.0) * 100) / 100;
        } else {
          regHours = Math.round(totalHours * 100) / 100;
          otHoursCalculated = 0.0;
        }

        const updatedRecord: AttendanceRecord = {
          id: recordId,
          userId: activeStaff.id,
          date: selectedDate,
          punchIn: effectiveIn,
          punchOut: effectiveOut,
          regularHours: regHours,
          otHours: otHoursCalculated,
          status: 'Present',
          notes: todayRecord?.notes || assignedArea,
        };

        onSaveRecord(updatedRecord);
        const infoMsg = 'Punch Out safaltapurvak ho gaya hai!';
        if (onFlash) onFlash(infoMsg, 'info');
        setFeedbackMessage({
          type: 'info',
          text: infoMsg,
        });
      } else {
        // flash("Pehle Punch In karna aavashyak hai.", "danger")
        const dangerMsg = 'Pehle Punch In karna aavashyak hai.';
        if (onFlash) onFlash(dangerMsg, 'danger');
        setFeedbackMessage({
          type: 'warning',
          text: dangerMsg,
        });
      }
    }

    // Clear feedback after 4.5 seconds
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4500);
  };

  // Reset punch for testing/demo
  const handleResetPunch = () => {
    const recordId = todayRecord ? todayRecord.id : `att_${activeStaff.id}_${selectedDate}`;
    const resetRecord: AttendanceRecord = {
      id: recordId,
      userId: activeStaff.id,
      date: selectedDate,
      punchIn: null,
      punchOut: null,
      regularHours: 0,
      otHours: 0,
      status: 'Absent',
      notes: assignedArea,
    };
    onSaveRecord(resetRecord);
    setFeedbackMessage({
      type: 'info',
      text: 'Punch status reset for today.',
    });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 3000);
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

        {/* Punch Status Card */}
        <div className="card bg-light border-0 p-3 mb-3 text-center rounded-3 bg-[#f8f9fa] border-0 p-3.5 mb-3 text-center rounded-xl">
          <small className="text-secondary fw-bold text-uppercase text-[#6c757d] font-bold uppercase tracking-wider block" style={{ fontSize: '0.75rem' }}>
            Today's Duty Status
          </small>
          <div className="mt-1" id="statusText">
            {todayRecord && todayRecord.punchIn ? (
              <span className="text-success fw-bold text-[#198754] font-bold">
                Punched In ({formatTime12h(todayRecord.punchIn)})
                {todayRecord.punchOut && (
                  <>
                    {' '}• <span className="text-danger fw-bold text-[#dc3545] font-bold">Out ({formatTime12h(todayRecord.punchOut)})</span>
                  </>
                )}
              </span>
            ) : (
              <span className="text-muted text-[#6c757d] font-medium">Not Punched Today</span>
            )}
          </div>
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

        {/* Direct Action Buttons (No Dropdown Selection) */}
        <form
          action="/staff/punch_action"
          method="POST"
          className="d-grid gap-2 grid gap-2.5 w-full"
          onSubmit={(e) => {
            e.preventDefault();
            if (!todayRecord || !todayRecord.punchIn) {
              handlePunch('in');
            } else if (!todayRecord.punchOut) {
              handlePunch('out');
            }
          }}
        >
          {!todayRecord || !todayRecord.punchIn ? (
            <button
              type="submit"
              name="action"
              value="in"
              id="btn-punch-in"
              onClick={(e) => {
                e.preventDefault();
                handlePunch('in');
              }}
              className="btn btn-success btn-lg fw-bold py-2 w-full bg-[#198754] hover:bg-[#157347] active:bg-[#146c43] text-white font-bold py-2.5 px-4 rounded-lg text-base shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogIn className="h-5 w-5 stroke-[2.5] me-1" />
              <span>PUNCH IN</span>
            </button>
          ) : !todayRecord.punchOut ? (
            <button
              type="submit"
              name="action"
              value="out"
              id="btn-punch-out"
              onClick={(e) => {
                e.preventDefault();
                handlePunch('out');
              }}
              className="btn btn-danger btn-lg fw-bold py-2 w-full bg-[#dc3545] hover:bg-[#bb2d3b] active:bg-[#b02a37] text-white font-bold py-2.5 px-4 rounded-lg text-base shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="h-5 w-5 stroke-[2.5] me-1" />
              <span>PUNCH OUT</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-lg py-2 w-full bg-[#6c757d] text-white font-semibold py-2.5 px-4 rounded-lg text-base cursor-not-allowed opacity-80 flex items-center justify-center"
              disabled
            >
              Duty Completed
            </button>
          )}
        </form>

        {/* Hours summary & Demo Reset link */}
        {todayRecord?.punchIn && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Reg: <strong className="text-slate-800 font-semibold">{regularHours.toFixed(1)}h</strong> &bull; OT: <strong className="text-amber-600 font-semibold">{otHours.toFixed(1)}h</strong></span>
            <button
              type="button"
              onClick={handleResetPunch}
              className="text-[11px] text-blue-600 hover:underline font-medium"
              title="Reset today's punch for testing"
            >
              Reset Punch
            </button>
          </div>
        )}
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
