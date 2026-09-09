import type { AttendanceSession, AttendanceRecord, DailyAttendanceCalculation, StaffSummaryResponse, StaffSummarySession } from '../types';

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

/**
 * Direct implementation of Flask /api/get_staff_summary/<staff_id>:
 *
 * @app.route('/api/get_staff_summary/<staff_id>', methods=['GET'])
 * @login_required
 * def get_staff_summary(staff_id):
 *     today = datetime.today().date()
 *     sessions = AttendanceSession.query.filter_by(staff_id=staff_id, date=today).all()
 *     total_minutes = 0
 *     session_list = []
 *     for idx, s in enumerate(sessions, 1):
 *         duration_hrs = 0.0
 *         if s.punch_in and s.punch_out:
 *             diff = (s.punch_out - s.punch_in).total_seconds() / 60.0
 *             duration_hrs = round(diff / 60.0, 2)
 *             total_minutes += diff
 *         session_list.append({
 *             "session_num": idx,
 *             "in_time": s.punch_in.strftime('%I:%M %p') if s.punch_in else "--",
 *             "out_time": s.punch_out.strftime('%I:%M %p') if s.punch_out else "--",
 *             "hours": duration_hrs
 *         })
 *     # Dynamic Total Calculation (NO HARDCODED 8.0h / 1.5h)
 *     total_hours = round(total_minutes / 60.0, 2)
 *     if total_hours >= 8.0:
 *         reg_hours = 8.0
 *         ot_hours = round(total_hours - 8.0, 2)
 *     else:
 *         reg_hours = total_hours
 *         ot_hours = 0.0
 *     return jsonify({
 *         "regular_hours": reg_hours,
 *         "overtime_hours": ot_hours,
 *         "sessions": session_list,
 *         "is_duty_active": any(s.punch_out is None for s in sessions)
 *     })
 */
export function getStaffSummary(sessions: AttendanceSession[]): StaffSummaryResponse {
  let total_minutes = 0;
  const session_list: StaffSummarySession[] = [];

  for (let idx = 0; idx < sessions.length; idx++) {
    const s = sessions[idx];
    let duration_hrs = 0.0;
    if (s.punch_in && s.punch_out) {
      // Calculate exact session duration in minutes
      const diff = getSessionDurationInMinutes(s.punch_in, s.punch_out);
      duration_hrs = Math.round((diff / 60.0) * 100) / 100;
      total_minutes += diff;
    }

    session_list.push({
      session_num: idx + 1,
      in_time: s.punch_in ? formatTimeTo12hStr(s.punch_in) : '--',
      out_time: s.punch_out ? formatTimeTo12hStr(s.punch_out) : '--',
      hours: duration_hrs,
    });
  }

  // Dynamic Total Calculation (NO HARDCODED 8.0h / 1.5h)
  const total_hours = Math.round((total_minutes / 60.0) * 100) / 100;
  let reg_hours = 0.0;
  let ot_hours = 0.0;

  if (total_hours >= 8.0) {
    reg_hours = 8.0;
    ot_hours = Math.round((total_hours - 8.0) * 100) / 100;
  } else {
    reg_hours = total_hours;
    ot_hours = 0.0;
  }

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

