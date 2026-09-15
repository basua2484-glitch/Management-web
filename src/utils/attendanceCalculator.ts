import type { AttendanceSession, AttendanceRecord, DailyAttendanceCalculation, StaffSummaryResponse, StaffSummarySession } from '../types';

// Shift Definitions (Standard 8h Baseline + 4h Half Duty & Continuous OT)
export const SHIFTS = {
  MORNING: { start: '07:00', end: '15:00', baseline: 8.0, label: 'Morning (7-3)' },
  EVENING: { start: '15:00', end: '23:00', baseline: 8.0, label: 'Evening (3-11)' },
  NIGHT:   { start: '23:00', end: '07:00', baseline: 8.0, label: 'Night (11-7)' }, // Crosses midnight
  HALF_4H: { start: '07:00', end: '11:00', baseline: 4.0, label: 'Half Duty (4h Baseline)' },
  CONTINUOUS_EXTENDED_OT: { start: '15:00', end: '23:00', baseline: 0.0, label: 'Continuous Extended OT (Pure OT)' },
} as const;

export const MAX_OT_CAP_HOURS = 8.0;

export type ShiftKey = keyof typeof SHIFTS;

export interface ProcessShiftAttendanceResult {
  calendar_date: string;
  shift: string;
  regular_hours: number;
  overtime_hours: number;
  total_worked_hours: number;
}

/**
 * Parses date or time string into a valid Date object.
 * If input is a time string (e.g. '07:00' or '23:00'), baseDate provides the date context.
 */
export function parsePunchDateTime(input: Date | string, baseDate?: Date): Date {
  if (input instanceof Date) {
    return new Date(input.getTime());
  }

  const str = input.trim();
  // If ISO string or formatted YYYY-MM-DD
  if (str.includes('T') || (str.includes('-') && str.includes(':'))) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }

  // If time-only "HH:mm" or "HH:mm:ss"
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    const base = baseDate ? new Date(baseDate.getTime()) : new Date();
    base.setHours(hours, minutes, seconds, 0);
    return base;
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

/**
 * Exact implementation of Python backend function:
 *
 * def process_shift_attendance(punch_in, punch_out, assigned_shift):
 *     """
 *     punch_in: datetime object
 *     punch_out: datetime object
 *     assigned_shift: 'MORNING', 'EVENING', or 'NIGHT'
 *     """
 *     # Total duration worked in hours
 *     total_seconds = (punch_out - punch_in).total_seconds()
 *     total_hours = total_seconds / 3600.0
 *
 *     # 8-Hour Baseline Logic
 *     SHIFT_BASELINE = 8.0
 *
 *     if total_hours >= SHIFT_BASELINE:
 *         regular_hours = SHIFT_BASELINE
 *         overtime_hours = round(total_hours - SHIFT_BASELINE, 2)
 *     else:
 *         regular_hours = round(total_hours, 2)
 *         overtime_hours = 0.0
 *
 *     # Assign to Calendar Base Date (Night shift handling)
 *     # If Night Shift, assign whole shift to the Punch-In Date
 *     calendar_date = punch_in.date()
 *
 *     return {
 *         "calendar_date": calendar_date.strftime("%Y-%m-%d"),
 *         "shift": assigned_shift,
 *         "regular_hours": regular_hours,
 *         "overtime_hours": overtime_hours,
 *         "total_worked_hours": round(total_hours, 2)
 *     }
 */
export function process_shift_attendance(
  punch_in: Date | string,
  punch_out: Date | string,
  assigned_shift: string,
  baseDate?: string | Date
): ProcessShiftAttendanceResult {
  const base = baseDate
    ? typeof baseDate === 'string'
      ? new Date(`${baseDate}T00:00:00`)
      : new Date(baseDate.getTime())
    : undefined;

  const inDate = parsePunchDateTime(punch_in, base);
  let outDate = parsePunchDateTime(punch_out, inDate);

  // If punch_out time is earlier than punch_in (e.g. cross-midnight night shift like 23:00 -> 07:00),
  // advance outDate to the next day
  if (outDate.getTime() < inDate.getTime()) {
    outDate = new Date(outDate.getTime() + 24 * 60 * 60 * 1000);
  }

  // Total duration worked in hours
  const total_seconds = (outDate.getTime() - inDate.getTime()) / 1000.0;
  const total_hours = total_seconds / 3600.0;

  // Dynamic Baseline Logic & 8.0h OT Capping
  const normalizedShift = assigned_shift ? assigned_shift.toUpperCase() : 'MORNING';
  let regular_hours = 0.0;
  let overtime_hours = 0.0;

  if (normalizedShift === 'CONTINUOUS_EXTENDED_OT' || normalizedShift.includes('CONTINUOUS')) {
    // Pure OT shift: baseline is 0.0h regular, all worked time is tagged as pure OT up to 8.0h cap
    regular_hours = 0.0;
    overtime_hours = Math.min(MAX_OT_CAP_HOURS, Math.round(total_hours * 100) / 100);
  } else if (normalizedShift === 'HALF_4H' || normalizedShift === 'HALF_DUTY' || normalizedShift.includes('4H')) {
    // 4-Hour Baseline Logic for Half Duty
    const SHIFT_BASELINE = 4.0;
    if (total_hours >= SHIFT_BASELINE) {
      regular_hours = SHIFT_BASELINE;
      overtime_hours = Math.min(MAX_OT_CAP_HOURS, Math.round((total_hours - SHIFT_BASELINE) * 100) / 100);
    } else {
      regular_hours = Math.round(total_hours * 100) / 100;
      overtime_hours = 0.0;
    }
  } else {
    // Standard 8-Hour Baseline Logic with 8.0h strict OT Capping
    const SHIFT_BASELINE = 8.0;
    if (total_hours >= SHIFT_BASELINE) {
      regular_hours = SHIFT_BASELINE;
      overtime_hours = Math.min(MAX_OT_CAP_HOURS, Math.round((total_hours - SHIFT_BASELINE) * 100) / 100);
    } else {
      regular_hours = Math.round(total_hours * 100) / 100;
      overtime_hours = 0.0;
    }
  }

  // Assign to Calendar Base Date (Night shift handling)
  // If Night Shift, assign whole shift to the Punch-In Date
  const year = inDate.getFullYear();
  const month = String(inDate.getMonth() + 1).padStart(2, '0');
  const day = String(inDate.getDate()).padStart(2, '0');
  const calendar_date = `${year}-${month}-${day}`;

  return {
    calendar_date,
    shift: normalizedShift,
    regular_hours,
    overtime_hours,
    total_worked_hours: Math.round(total_hours * 100) / 100,
  };
}

export const processShiftAttendance = process_shift_attendance;

if (typeof window !== 'undefined') {
  (window as unknown as { SHIFTS: typeof SHIFTS }).SHIFTS = SHIFTS;
  (window as unknown as { process_shift_attendance: typeof process_shift_attendance }).process_shift_attendance = process_shift_attendance;
  (window as unknown as { processShiftAttendance: typeof process_shift_attendance }).processShiftAttendance = process_shift_attendance;
}

/**
 * Formats date or time to %I:%M %p (e.g. "08:00 AM") or returns "--"
 */
export function formatTimeTo12hStr(val: string | Date | null | undefined): string {
  if (!val) return '--';
  if (typeof val === 'string') {
    if (val === '--' || val === '-') return '--';
    if (val.includes('AM') || val.includes('PM')) return val;
    if (val.includes('T') || (val.includes('-') && val.includes(':'))) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    }
    const parts = val.split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) {
        const period = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 === 0 ? 12 : h % 12;
        return `${hour12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
      }
    }
    return val;
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  return '--';
}

/**
 * Calculates session duration in minutes.
 * Supports ISO date strings, full Date objects, and HH:mm 24-hour time strings.
 */
export function getSessionDurationInMinutes(punchIn: string | Date, punchOut: string | Date): number {
  if (!punchIn || !punchOut) return 0;

  const punchInStr = typeof punchIn === 'string' ? punchIn : punchIn.toISOString();
  const punchOutStr = typeof punchOut === 'string' ? punchOut : punchOut.toISOString();

  // If ISO timestamps with date components
  if (punchInStr.includes('T') || punchInStr.includes('-')) {
    const startMs = new Date(punchInStr).getTime();
    const endMs = new Date(punchOutStr).getTime();
    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) return 0;
    return (endMs - startMs) / (1000 * 60); // minutes
  }

  // If HH:mm format
  const [inH, inM] = punchInStr.split(':').map(Number);
  const [outH, outM] = punchOutStr.split(':').map(Number);

  if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return 0;

  let diffMinutes = (outH * 60 + outM) - (inH * 60 + inM);
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60; // Cross-midnight shift
  }

  return diffMinutes;
}

/**
 * Direct TypeScript implementation of Python backend function:
 * def calculate_daily_attendance(staff_id, duty_date):
 *     sessions = AttendanceSession.query.filter_by(staff_id=staff_id, date=duty_date).all()
 *     total_minutes_worked = 0
 *     for session in sessions:
 *         if session.punch_in and session.punch_out:
 *             duration = (session.punch_out - session.punch_in).total_seconds() / 60
 *             total_minutes_worked += duration
 *     total_hours = total_minutes_worked / 60.0
 *     if total_hours > 8.0:
 *         regular_hours = 8.0
 *         overtime_hours = round(total_hours - 8.0, 2)
 *     else:
 *         regular_hours = round(total_hours, 2)
 *         overtime_hours = 0.0
 *     return {
 *         "regular_hours": regular_hours,
 *         "overtime_hours": overtime_hours,
 *         "total_sessions": len(sessions)
 *     }
 */
/**
 * Fix multi-session loop bug:
 * Auto-closes any unclosed active sessions (where punch_out is null or missing)
 * with the specified close timestamp (defaults to current ISO timestamp).
 * Ensures proper duration calculation and eliminates hanging/overlapping active session loops.
 */
export function autoCloseActiveSessions(
  sessions: AttendanceSession[] | undefined,
  closeTimestamp: string = new Date().toISOString(),
  autoCloseNote = 'Auto-closed on new punch-in'
): AttendanceSession[] {
  if (!sessions || sessions.length === 0) return [];
  return sessions.map((s) => {
    if (!s.punch_out) {
      return {
        ...s,
        punch_out: closeTimestamp,
        notes: s.notes ? `${s.notes} [${autoCloseNote}]` : autoCloseNote,
      };
    }
    return s;
  });
}

export function calculateDailyAttendance(
  sessions: AttendanceSession[],
  shiftType?: string
): DailyAttendanceCalculation {
  let total_standard_minutes = 0;
  let pure_ot_minutes = 0;

  for (const session of sessions) {
    if (session.punch_in && session.punch_out) {
      const duration = getSessionDurationInMinutes(session.punch_in, session.punch_out);
      const isPureOt = Boolean(
        session.notes?.includes('CONTINUOUS_EXTENDED_OT') ||
        session.notes?.includes('EMERGENCY_RECALL')
      );
      if (isPureOt) {
        pure_ot_minutes += duration;
      } else {
        total_standard_minutes += duration;
      }
    }
  }

  const isContinuous = shiftType?.toUpperCase() === 'CONTINUOUS_EXTENDED_OT' || shiftType?.toUpperCase().includes('CONTINUOUS');
  const isHalfDuty = shiftType?.toUpperCase() === 'HALF_4H' || shiftType?.toUpperCase().includes('4H');
  const baseline = isContinuous ? 0.0 : isHalfDuty ? 4.0 : 8.0;

  let regular_hours = 0;
  let overtime_hours = 0;

  if (isContinuous) {
    regular_hours = 0;
    const total_ot = (total_standard_minutes + pure_ot_minutes) / 60.0;
    overtime_hours = Math.min(MAX_OT_CAP_HOURS, Math.round(total_ot * 100) / 100);
  } else {
    const standard_hours = total_standard_minutes / 60.0;
    if (standard_hours >= baseline) {
      regular_hours = baseline;
      const extra_ot = standard_hours - baseline;
      const raw_total_ot = extra_ot + (pure_ot_minutes / 60.0);
      overtime_hours = Math.min(MAX_OT_CAP_HOURS, Math.round(raw_total_ot * 100) / 100);
    } else {
      regular_hours = Math.round(standard_hours * 100) / 100;
      const raw_total_ot = pure_ot_minutes / 60.0;
      overtime_hours = Math.min(MAX_OT_CAP_HOURS, Math.round(raw_total_ot * 100) / 100);
    }
  }

  const total_worked_hours = (total_standard_minutes + pure_ot_minutes) / 60.0;

  return {
    regular_hours,
    overtime_hours,
    total_sessions: sessions.length,
    total_hours: Math.round(total_worked_hours * 100) / 100,
    total_minutes_worked: Math.round((total_standard_minutes + pure_ot_minutes) * 100) / 100,
  };
}

/**
 * Calculates daily attendance for a staff member and duty date from records,
 * taking into account either record.sessions or root punchIn/punchOut.
 */
export function calculateDailyAttendanceForStaffDate(
  records: AttendanceRecord[],
  staffId: number | string,
  dutyDate: string
): DailyAttendanceCalculation {
  const numericId = typeof staffId === 'string' ? parseInt(staffId, 10) : staffId;
  const targetRecord = records.find((r) => (r.userId === numericId || String(r.userId) === String(staffId)) && r.date === dutyDate);

  if (!targetRecord) {
    return {
      regular_hours: 0,
      overtime_hours: 0,
      total_sessions: 0,
      total_hours: 0,
      total_minutes_worked: 0,
    };
  }

  const shiftType = targetRecord.shift_name;

  if (targetRecord.sessions && targetRecord.sessions.length > 0) {
    return calculateDailyAttendance(targetRecord.sessions, shiftType);
  }

  if (targetRecord.punchIn && targetRecord.punchOut) {
    const singleSession: AttendanceSession = {
      id: `sess_${targetRecord.id}_1`,
      staff_id: targetRecord.userId,
      date: targetRecord.date,
      punch_in: targetRecord.punchInTimestamp || targetRecord.punchIn,
      punch_out: targetRecord.punchOutTimestamp || targetRecord.punchOut,
      notes: targetRecord.notes,
    };
    return calculateDailyAttendance([singleSession], shiftType);
  }

  return {
    regular_hours: targetRecord.regularHours || 0,
    overtime_hours: Math.min(MAX_OT_CAP_HOURS, targetRecord.otHours || 0),
    total_sessions: targetRecord.punchIn ? 1 : 0,
    total_hours: (targetRecord.regularHours || 0) + Math.min(MAX_OT_CAP_HOURS, targetRecord.otHours || 0),
    total_minutes_worked: ((targetRecord.regularHours || 0) + Math.min(MAX_OT_CAP_HOURS, targetRecord.otHours || 0)) * 60,
  };
}

export function getStaffSummary(
  sessions: AttendanceSession[],
  shiftType?: string
): StaffSummaryResponse {
  let total_minutes = 0;
  let pure_ot_minutes = 0;
  const session_list: StaffSummarySession[] = [];

  for (let idx = 0; idx < sessions.length; idx++) {
    const s = sessions[idx];
    let duration_hrs = 0.0;
    if (s.punch_in && s.punch_out) {
      // Calculate exact session duration in minutes
      const diff = getSessionDurationInMinutes(s.punch_in, s.punch_out);
      duration_hrs = Math.round((diff / 60.0) * 100) / 100;
      if (s.notes?.includes('CONTINUOUS_EXTENDED_OT') || s.notes?.includes('EMERGENCY_RECALL')) {
        pure_ot_minutes += diff;
      } else {
        total_minutes += diff;
      }
    }

    session_list.push({
      session_num: idx + 1,
      in_time: s.punch_in ? formatTimeTo12hStr(s.punch_in) : '--',
      out_time: s.punch_out ? formatTimeTo12hStr(s.punch_out) : '--',
      hours: duration_hrs,
    });
  }

  const isContinuous = shiftType?.toUpperCase() === 'CONTINUOUS_EXTENDED_OT' || shiftType?.toUpperCase().includes('CONTINUOUS');
  const isHalfDuty = shiftType?.toUpperCase() === 'HALF_4H' || shiftType?.toUpperCase().includes('4H');
  const baseline = isContinuous ? 0.0 : isHalfDuty ? 4.0 : 8.0;

  const standard_hours = Math.round((total_minutes / 60.0) * 100) / 100;
  let reg_hours = 0.0;
  let ot_hours = 0.0;

  if (isContinuous) {
    reg_hours = 0.0;
    const rawOt = (total_minutes + pure_ot_minutes) / 60.0;
    ot_hours = Math.min(MAX_OT_CAP_HOURS, Math.round(rawOt * 100) / 100);
  } else if (standard_hours >= baseline) {
    reg_hours = baseline;
    const extra_ot = standard_hours - baseline;
    const rawOt = extra_ot + (pure_ot_minutes / 60.0);
    ot_hours = Math.min(MAX_OT_CAP_HOURS, Math.round(rawOt * 100) / 100);
  } else {
    reg_hours = standard_hours;
    const rawOt = pure_ot_minutes / 60.0;
    ot_hours = Math.min(MAX_OT_CAP_HOURS, Math.round(rawOt * 100) / 100);
  }

  const total_hours = Math.round(((total_minutes + pure_ot_minutes) / 60.0) * 100) / 100;

  return {
    regular_hours: reg_hours,
    overtime_hours: ot_hours,
    sessions: session_list,
    is_duty_active: sessions.some((s) => !s.punch_out),
    total_hours,
  };
}

/**
 * Calculates staff summary for a staff member and date from records.
 * Resolves all sessions (or single punchIn/punchOut session) dynamically.
 */
export function getStaffSummaryForStaffDate(
  records: AttendanceRecord[],
  staffId: number | string,
  dutyDate: string
): StaffSummaryResponse {
  const numericId = typeof staffId === 'string' ? parseInt(staffId, 10) : staffId;
  const targetRecord = records.find(
    (r) => (r.userId === numericId || String(r.userId) === String(staffId)) && r.date === dutyDate
  );

  if (!targetRecord) {
    return {
      regular_hours: 0,
      overtime_hours: 0,
      sessions: [],
      is_duty_active: false,
      total_hours: 0,
    };
  }

  if (targetRecord.sessions && targetRecord.sessions.length > 0) {
    return getStaffSummary(targetRecord.sessions);
  }

  if (targetRecord.punchIn) {
    const singleSession: AttendanceSession = {
      id: `sess_${targetRecord.id}_1`,
      staff_id: targetRecord.userId,
      date: targetRecord.date,
      punch_in: targetRecord.punchInTimestamp || targetRecord.punchIn,
      punch_out: targetRecord.punchOutTimestamp || targetRecord.punchOut || null,
      notes: targetRecord.notes,
    };
    return getStaffSummary([singleSession]);
  }

  return {
    regular_hours: targetRecord.regularHours || 0,
    overtime_hours: targetRecord.otHours || 0,
    sessions: [],
    is_duty_active: false,
    total_hours: (targetRecord.regularHours || 0) + (targetRecord.otHours || 0),
  };
}

/**
 * Updates UI elements dynamically from StaffSummaryResponse:
 * - document.getElementById('regularHoursCard').innerText = `${data.regular_hours}h`;
 * - document.getElementById('otHoursCard').innerText = `${data.overtime_hours}h`;
 * - document.getElementById('sessionList').innerHTML = ...
 * - document.getElementById('statusSummaryText').innerText = ...
 */
export function updateUI(data: StaffSummaryResponse): void {
  // 1. Update Top Summary Cards dynamically
  const regCard = document.getElementById('regularHoursCard');
  if (regCard) {
    regCard.innerText = `${data.regular_hours}h`;
  }
  const otCard = document.getElementById('otHoursCard');
  if (otCard) {
    otCard.innerText = `${data.overtime_hours}h`;
  }

  // 2. Clear & Render Daily Sessions
  const sessionContainer = document.getElementById('sessionList');
  if (sessionContainer) {
    sessionContainer.innerHTML = '';
    data.sessions.forEach((s) => {
      sessionContainer.innerHTML += `
            <div class="d-flex justify-content-between border-bottom py-2">
                <span>#${s.session_num} &nbsp; ${s.in_time} – ${s.out_time}</span>
                <span class="fw-bold text-success">${s.hours}h</span>
            </div>
        `;
    });
  }

  // 3. Update Status Subtitle
  const statusSummaryText = document.getElementById('statusSummaryText');
  if (statusSummaryText) {
    statusSummaryText.innerText = `Reg: ${data.regular_hours}h • OT: ${data.overtime_hours}h • Sessions: ${data.sessions.length}`;
  }
}

