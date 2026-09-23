import React, { useState } from 'react';
import { X, Check, Clock, Building, User, Calendar, ShieldAlert } from 'lucide-react';
import type { StaffUser, AttendanceRecord } from '../types';
import { SHIFTS, process_shift_attendance } from '../utils/attendanceCalculator';

interface DutyAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffUser[];
  selectedDate: string;
  onSaveAssignment: (record: AttendanceRecord, updatedDutyArea?: string) => void;
  initialStaffId?: number | null;
}

export const DUTY_AREAS = [
  'Rooms 101-125 Cleaning',
  'Rooms 201-225 Deep Clean',
  'Executive Suites Sanitization',
  'Lobby & Reception Polish',
  'Corridors & Elevators Floor Care',
  'Kitchen & Dining Sanitation',
  'Laundry & Linen Sorting',
  'Pool & Restroom Maintenance',
  'Deep Cleaning & Waste Mgmt',
  'Banquet Hall Turnover',
];

export const DutyAssignmentModal: React.FC<DutyAssignmentModalProps> = ({
  isOpen,
  onClose,
  staff,
  selectedDate,
  onSaveAssignment,
  initialStaffId,
}) => {
  const [dutyType, setDutyType] = useState<'FIXED' | 'PERMANENT_RELIEVER' | 'TEMP_RELIEVER'>('FIXED');
  const [isTempReliever, setIsTempReliever] = useState<boolean>(false);
  const [tempDepartment, setTempDepartment] = useState<string>('');
  const [staffId, setStaffId] = useState<number>(initialStaffId || staff[0]?.id || 1);
  const [date, setDate] = useState<string>(selectedDate);
  const [dutyArea, setDutyArea] = useState<string>(DUTY_AREAS[0]);
  const [shift, setShift] = useState<'Morning' | 'Evening' | 'Night'>('Morning');
  const [punchIn, setPunchIn] = useState<string>(SHIFTS.MORNING.start);
  const [punchOut, setPunchOut] = useState<string>(SHIFTS.MORNING.end);
  const [status, setStatus] = useState<'Present' | 'Absent' | 'Half Day' | 'On Leave'>('Present');
  const [regularHours, setRegularHours] = useState<number>(8.0);
  const [otHours, setOtHours] = useState<number>(0.0);
  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  const handlePunchTimes = (inVal: string, outVal: string, shiftName?: string) => {
    setPunchIn(inVal);
    setPunchOut(outVal);

    if (inVal && outVal) {
      const activeShift = (shiftName || shift).toUpperCase();
      const calc = process_shift_attendance(
        `${date}T${inVal}:00`,
        `${date}T${outVal}:00`,
        activeShift,
        date
      );
      setRegularHours(calc.regular_hours);
      setOtHours(calc.overtime_hours);
    }
  };

  const handleShiftPreset = (newShift: 'Morning' | 'Evening' | 'Night') => {
    setShift(newShift);
    const key = newShift.toUpperCase() as keyof typeof SHIFTS;
    const config = SHIFTS[key];
    if (config) {
      handlePunchTimes(config.start, config.end, newShift);
    }
  };

  const selectedStaffMember = staff.find((s) => s.id === staffId);
  const shiftCode = shift === 'Night' ? '11-7' : shift === 'Evening' ? '3-11' : '7-3';
  const effectiveDepartment = isTempReliever && tempDepartment.trim() ? tempDepartment.trim() : dutyArea;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isPresent = status === 'Present' || status === 'Half Day';
    let assignedDate = date;
    let finalReg = regularHours;
    let finalOt = otHours;

    if (isPresent && punchIn && punchOut) {
      const activeShift = shift.toUpperCase();
      const calc = process_shift_attendance(
        `${date}T${punchIn}:00`,
        `${date}T${punchOut}:00`,
        activeShift,
        date
      );
      assignedDate = calc.calendar_date;
      finalReg = calc.regular_hours;
      finalOt = calc.overtime_hours;
    }

    const staffCodeStr = selectedStaffMember?.staffCode || `HK-${staffId.toString().padStart(3, '0')}`;

    const record: AttendanceRecord = {
      id: `att_${staffId}_${assignedDate}`,
      userId: staffId,
      staff_id: staffCodeStr,
      calendar_date: assignedDate,
      date: assignedDate,
      shift_name: shiftCode,
      department_worked: effectiveDepartment,
      punchIn: isPresent ? punchIn : null,
      punchOut: isPresent ? punchOut : null,
      punch_in_time: isPresent && punchIn ? `${assignedDate}T${punchIn}:00` : null,
      punch_out_time: isPresent && punchOut ? `${assignedDate}T${punchOut}:00` : null,
      regularHours: isPresent ? finalReg : 0,
      regular_hours: isPresent ? finalReg : 0,
      otHours: isPresent ? finalOt : 0,
      ot_hours: isPresent ? finalOt : 0,
      ot_status: finalOt > 0 ? 'PENDING' : 'NONE',
      status: status === 'Present' && finalOt > 0 ? 'Present' : status,
      notes: notes || (isTempReliever ? `[Temp Reliever] ${effectiveDepartment}` : dutyArea),
    };

    onSaveAssignment(record, effectiveDepartment);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      id="assignModal"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E3A8A] text-white">
              <Building className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Duty & Shift Assign Karein
              </h2>
              <p className="text-xs text-slate-500">
                Housekeeping Staff Shift Allocation & Live Punch Setup
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
          {/* Staff Member & Date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Staff Member
              </label>
              <select
                value={staffId}
                onChange={(e) => setStaffId(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
              >
                {staff.map((s, idx) => (
                  <option key={s.staffCode || (s.id ? `duty-s-${s.id}` : `duty-s-${idx}`)} value={s.id}>
                    {s.staffCode} - {s.name} ({s.department})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assignment Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
              />
            </div>
          </div>

          {/* Duty Allocation Settings & Temp Reliever Overrides */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Duty Type (Duty Allocation Settings)
              </label>
              <span className="text-[10px] font-mono font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                Model: User.duty_type
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'FIXED' as const, label: 'Fixed Ward' },
                { type: 'PERMANENT_RELIEVER' as const, label: 'Perm Reliever' },
                { type: 'TEMP_RELIEVER' as const, label: 'Temp Reliever' },
              ].map((dt) => (
                <button
                  key={dt.type}
                  type="button"
                  onClick={() => {
                    setDutyType(dt.type);
                    if (dt.type === 'TEMP_RELIEVER') {
                      setIsTempReliever(true);
                    }
                  }}
                  className={`py-1.5 px-2 rounded-md text-xs font-semibold border transition-all text-center ${
                    dutyType === dt.type
                      ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {dt.label}
                </button>
              ))}
            </div>

            {/* Temporary Shift/Department Override */}
            <div className="pt-2 border-t border-slate-200/80">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTempReliever}
                  onChange={(e) => setIsTempReliever(e.target.checked)}
                  className="rounded border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A]"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Temporary Reliever Shift Override (is_temp_reliever = True)
                </span>
              </label>

              {isTempReliever && (
                <div className="mt-2 pl-5">
                  <label className="block text-2xs font-medium text-slate-600 mb-1">
                    Temporary Department / Ward (temp_department)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Emergency Sanitation, ICU Ward 2"
                    value={tempDepartment}
                    onChange={(e) => setTempDepartment(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Assigned Duty / Area */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Primary Ward / Area (fixed_department)
            </label>
            <select
              value={dutyArea}
              onChange={(e) => setDutyArea(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
            >
              {DUTY_AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          {/* Shift Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Shift Timing
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Morning', 'Evening', 'Night'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleShiftPreset(s)}
                  className={`rounded-md py-2 px-2 text-xs font-medium border text-center transition-colors flex flex-col items-center justify-center ${
                    shift === s
                      ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-semibold">{s} Shift</span>
                  <span className={`text-[10px] mt-0.5 ${shift === s ? 'text-blue-100' : 'text-slate-500'}`}>
                    {s === 'Morning' ? '07:00 - 15:00' : s === 'Evening' ? '15:00 - 23:00' : '23:00 - 07:00'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Attendance Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Attendance Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
            >
              <option value="Present">Present / On Duty</option>
              <option value="Half Day">Half Day Duty</option>
              <option value="Absent">Absent</option>
              <option value="On Leave">On Leave</option>
            </select>
          </div>

          {/* Punch Timings & Hours */}
          {(status === 'Present' || status === 'Half Day') && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Punch In Time
                  </label>
                  <input
                    type="time"
                    value={punchIn}
                    onChange={(e) => handlePunchTimes(e.target.value, punchOut)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Punch Out Time
                  </label>
                  <input
                    type="time"
                    value={punchOut}
                    onChange={(e) => handlePunchTimes(punchIn, e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="block text-xs font-medium text-slate-500">Regular Hours</span>
                  <p className="text-base font-bold text-slate-800">{regularHours.toFixed(1)} hrs</p>
                </div>

                <div>
                  <span className="block text-xs font-medium text-amber-700">Overtime (OT)</span>
                  <p className="text-base font-bold text-amber-600">
                    {otHours > 0 ? `+${otHours.toFixed(1)} hrs (OT Active)` : '0.0 hrs'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Special Notes / Instructions */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Duty Notes / Instructions (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. VIP floor inspection, Deep polish ballroom"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1E3A8A] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-900"
            >
              <Check className="h-4 w-4" />
              <span>Duty & Shift Assign Karein</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
