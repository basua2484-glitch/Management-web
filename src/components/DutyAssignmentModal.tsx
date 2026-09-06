import React, { useState } from 'react';
import { X, Check, Clock, Building, User, Calendar, ShieldAlert } from 'lucide-react';
import type { StaffUser, AttendanceRecord } from '../types';

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
  const [staffId, setStaffId] = useState<number>(initialStaffId || staff[0]?.id || 1);
  const [date, setDate] = useState<string>(selectedDate);
  const [dutyArea, setDutyArea] = useState<string>(DUTY_AREAS[0]);
  const [shift, setShift] = useState<'Morning' | 'Evening' | 'Night'>('Morning');
  const [punchIn, setPunchIn] = useState<string>('08:00');
  const [punchOut, setPunchOut] = useState<string>('17:00');
  const [status, setStatus] = useState<'Present' | 'Absent' | 'Half Day' | 'On Leave'>('Present');
  const [regularHours, setRegularHours] = useState<number>(8.0);
  const [otHours, setOtHours] = useState<number>(1.0);
  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  const handlePunchTimes = (inVal: string, outVal: string) => {
    setPunchIn(inVal);
    setPunchOut(outVal);

    if (inVal && outVal) {
      const [inH, inM] = inVal.split(':').map(Number);
      const [outH, outM] = outVal.split(':').map(Number);
      let diffMinutes = outH * 60 + outM - (inH * 60 + inM);
      if (diffMinutes < 0) diffMinutes += 24 * 60;

      // 30 min lunch break if shift > 5 hrs
      if (diffMinutes > 300) diffMinutes -= 30;
      const totalHrs = Math.max(0, diffMinutes / 60);

      if (totalHrs <= 8.0) {
        setRegularHours(Number(totalHrs.toFixed(1)));
        setOtHours(0);
      } else {
        setRegularHours(8.0);
        setOtHours(Number((totalHrs - 8.0).toFixed(1)));
      }
    }
  };

  const handleShiftPreset = (newShift: 'Morning' | 'Evening' | 'Night') => {
    setShift(newShift);
    if (newShift === 'Morning') {
      handlePunchTimes('08:00', '16:30');
    } else if (newShift === 'Evening') {
      handlePunchTimes('14:00', '22:30');
    } else {
      handlePunchTimes('22:00', '06:30');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isPresent = status === 'Present' || status === 'Half Day';

    const record: AttendanceRecord = {
      id: `att_${staffId}_${date}`,
      userId: staffId,
      date,
      punchIn: isPresent ? punchIn : null,
      punchOut: isPresent ? punchOut : null,
      regularHours: isPresent ? regularHours : 0,
      otHours: isPresent ? otHours : 0,
      status: status === 'Present' && otHours > 0 ? 'Present' : status,
      notes: notes || dutyArea,
    };

    onSaveAssignment(record, dutyArea);
    onClose();
  };

  const selectedStaffMember = staff.find((s) => s.id === staffId);

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
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
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

          {/* Assigned Duty / Area */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assigned Duty / Area (Karyakshetra)
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
                  className={`rounded-md py-2 px-3 text-xs font-medium border text-center transition-colors ${
                    shift === s
                      ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {s} Shift
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
