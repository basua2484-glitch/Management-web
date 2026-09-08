import type { AttendanceSession, AttendanceRecord, DailyAttendanceCalculation } from '../types';

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
export function calculateDailyAttendance(sessions: AttendanceSession[]): DailyAttendanceCalculation {
  let total_minutes_worked = 0;

  for (const session of sessions) {
    if (session.punch_in && session.punch_out) {
      const duration = getSessionDurationInMinutes(session.punch_in, session.punch_out);
      total_minutes_worked += duration;
    }
  }

  const total_hours = total_minutes_worked / 60.0;

  // 8 Hours Standard Shift (480 Minutes)
  let regular_hours = 0;
  let overtime_hours = 0;

  if (total_hours > 8.0) {
    regular_hours = 8.0;
    overtime_hours = Math.round((total_hours - 8.0) * 100) / 100;
  } else {
    regular_hours = Math.round(total_hours * 100) / 100;
    overtime_hours = 0.0;
  }

  return {
    regular_hours,
    overtime_hours,
    total_sessions: sessions.length,
    total_hours: Math.round(total_hours * 100) / 100,
    total_minutes_worked: Math.round(total_minutes_worked * 100) / 100,
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

  if (targetRecord.sessions && targetRecord.sessions.length > 0) {
    return calculateDailyAttendance(targetRecord.sessions);
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
    return calculateDailyAttendance([singleSession]);
  }

  return {
    regular_hours: targetRecord.regularHours || 0,
    overtime_hours: targetRecord.otHours || 0,
    total_sessions: targetRecord.punchIn ? 1 : 0,
    total_hours: (targetRecord.regularHours || 0) + (targetRecord.otHours || 0),
    total_minutes_worked: ((targetRecord.regularHours || 0) + (targetRecord.otHours || 0)) * 60,
  };
}
