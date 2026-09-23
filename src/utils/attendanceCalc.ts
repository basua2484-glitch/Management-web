// src/utils/attendanceCalc.ts - SHIFT TIME MATH & NIGHT SHIFT CROSS-DAY ENGINE

export interface AttendancePunchSession {
  punchIn: string;   // ISO String or YYYY-MM-DDTHH:mm:ss
  punchOut?: string | null;
}

export interface ShiftCalculationResult {
  totalWorkingMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  isCrossDayNightShift: boolean;
}

export const processShiftAttendance = (
  sessions: AttendancePunchSession[],
  standardShiftHours: number = 8
): ShiftCalculationResult => {
  let totalMinutes = 0;

  sessions.forEach(session => {
    const startMs = new Date(session.punchIn).getTime();
    let endMs = session.punchOut ? new Date(session.punchOut).getTime() : 0;

    // Auto-Close active session at midnight if punchOut missing
    if (!endMs) {
      const midnightCutoff = new Date(session.punchIn);
      midnightCutoff.setHours(23, 59, 59, 999);
      endMs = midnightCutoff.getTime();
    }

    if (endMs > startMs) {
      const durationMs = endMs - startMs;
      totalMinutes += Math.floor(durationMs / (1000 * 60));
    }
  });

  const standardMinutes = standardShiftHours * 60;
  const regularMinutes = Math.min(totalMinutes, standardMinutes);
  const overtimeMinutes = Math.max(0, totalMinutes - standardMinutes);

  return {
    totalWorkingMinutes: totalMinutes,
    regularMinutes,
    overtimeMinutes,
    isCrossDayNightShift: totalMinutes > (12 * 60)
  };
};
