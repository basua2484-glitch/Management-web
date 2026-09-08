import React, { useState, useEffect } from 'react';
import { X, Plus, Check, Trash2, Clock, CalendarDays } from 'lucide-react';
import type { StaffUser, AttendanceRecord, AppUser, AttendanceSession } from '../types';
import { calculateDailyAttendance } from '../utils/attendanceCalculator';

interface DailyAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffUser[];
  records: AttendanceRecord[];
  selectedStaffId: number | null;
  currentYear: number;
  currentMonth: number;
  monthName: string;
  currentUser?: AppUser | null;
  onSaveRecord: (record: AttendanceRecord) => void;
  onDeleteRecord: (recordId: string) => void;
  onFlash?: (message: string, type: 'success' | 'danger' | 'warning' | 'info') => void;
}

export const DailyAttendanceModal: React.FC<DailyAttendanceModalProps> = ({
  isOpen,
  onClose,
  staff,
  records,
  selectedStaffId,
  currentYear,
  currentMonth,
  monthName,
  currentUser,
  onSaveRecord,
  onDeleteRecord,
  onFlash,
}) => {
  // Check if current user is admin or manager
  const isAdminOrManager = currentUser
    ? currentUser.role === 'admin' || currentUser.role === 'manager'
    : true;

  // Personal staff ID for locked staff view
  const currentStaffId = currentUser?.staffId || currentUser?.id || 1;

  // Active filter: if staff, locked to their own ID; if admin/manager, defaults to selectedStaffId or 'all'
  const [activeStaffFilter, setActiveStaffFilter] = useState<number | 'all'>(
    isAdminOrManager ? (selectedStaffId || 'all') : currentStaffId
  );

  // Manual Entry Collapse Form State (Admin/Manager only)
  const [isManualLogOpen, setIsManualLogOpen] = useState(false);

  // Form states matching /admin/manual_log
  const [formStaffId, setFormStaffId] = useState<number>(
    selectedStaffId || (staff[0]?.id ?? 1)
  );
  const defaultDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
  const [formDate, setFormDate] = useState<string>(defaultDate);
  const [formPunchIn, setFormPunchIn] = useState('08:00');
  const [formPunchOut, setFormPunchOut] = useState('17:30');
  const [formRegHours, setFormRegHours] = useState<number>(8.0);
  const [formOtHours, setFormOtHours] = useState<number>(1.5);
  const [formStatus, setFormStatus] = useState<AttendanceRecord['status']>('Present');
  const [formNotes, setFormNotes] = useState('');

  // Keep filter synced if selectedStaffId changes or role changes
  useEffect(() => {
    if (!isAdminOrManager) {
      setActiveStaffFilter(currentStaffId);
    } else if (selectedStaffId) {
      setActiveStaffFilter(selectedStaffId);
      setFormStaffId(selectedStaffId);
    }
  }, [selectedStaffId, isAdminOrManager, currentStaffId]);

  if (!isOpen) return null;

  // Filter records for the current month and selected staff
  const monthPrefix = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
  const staffMap = new Map<number, StaffUser>(staff.map((s) => [s.id, s]));

  const monthRecords = records
    .filter((r) => {
      const matchesMonth = r.date.startsWith(monthPrefix);
      const effectiveFilter = isAdminOrManager ? activeStaffFilter : currentStaffId;
      const matchesStaff = effectiveFilter === 'all' || r.userId === effectiveFilter;
      return matchesMonth && matchesStaff;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  // Auto calculate regular and OT hours using calculate_daily_attendance
  const handlePunchTimeChange = (inTime: string, outTime: string) => {
    setFormPunchIn(inTime);
    setFormPunchOut(outTime);

    if (inTime && outTime) {
      const virtualSession: AttendanceSession = {
        id: 'virtual_form_session',
        staff_id: formStaffId,
        date: formDate,
        punch_in: inTime,
        punch_out: outTime,
      };
      const calc = calculateDailyAttendance([virtualSession]);
      setFormRegHours(calc.regular_hours);
      setFormOtHours(calc.overtime_hours);
    }
  };

  const handleManualLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isPresent = formStatus === 'Present' || formStatus === 'Half Day';
    const targetStaff = staffMap.get(formStaffId);
    const sessionsList: AttendanceSession[] | undefined =
      isPresent && formPunchIn && formPunchOut
        ? [
            {
              id: `sess_${formStaffId}_${formDate}_1`,
              staff_id: formStaffId,
              date: formDate,
              punch_in: formPunchIn,
              punch_out: formPunchOut,
              notes: formNotes || undefined,
            },
          ]
        : undefined;

    const newRecord: AttendanceRecord = {
      id: `att_${formStaffId}_${formDate}`,
      userId: formStaffId,
      date: formDate,
      punchIn: isPresent ? formPunchIn : null,
      punchOut: isPresent ? formPunchOut : null,
      regularHours: isPresent ? formRegHours : 0.0,
      otHours: isPresent ? formOtHours : 0.0,
      sessions: sessionsList,
      status: formStatus,
      notes: formNotes || targetStaff?.department || undefined,
    };

    onSaveRecord(newRecord);
    if (onFlash) {
      onFlash('Attendance record safaltapurvak save ho gaya!', 'success');
    }
    setIsManualLogOpen(false);
    setFormNotes('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
      id="modal-daily-attendance"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Body Matching Provided Jinja2 Template */}
        <div className="modal-body p-5 sm:p-6 overflow-y-auto flex-1">
          
          {/* Top Header Bar */}
          <div className="d-flex justify-content-between align-items-center mb-3 flex items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div>
              <h5 className="fw-bold mb-0 text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Daily Attendance & Punch Logs
              </h5>
              <small className="text-muted text-xs text-slate-500">
                Period: {monthName} {currentYear}
              </small>
            </div>

            <div className="flex items-center gap-2">
              {/* RULE 1: Direct Manual Entry Button sirf Admin/Manager ko dikhega */}
              {isAdminOrManager && (
                <button
                  type="button"
                  id="btn-log-punch-overtime"
                  onClick={() => setIsManualLogOpen(!isManualLogOpen)}
                  className="btn btn-navy btn-sm fw-bold bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 shadow-xs transition-colors"
                  data-bs-toggle="collapse"
                  data-bs-target="#manualLogForm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Punch / Overtime</span>
                </button>
              )}

              {/* Modal Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="btn-close p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* RULE 2: Staff Filter Buttons sirf Admin/Manager ko dikhenge */}
          {isAdminOrManager ? (
            <div className="d-flex flex-wrap gap-1 mb-3 flex items-center flex-wrap gap-1.5 mb-4 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-muted small align-self-center me-2 text-xs text-slate-500 font-semibold">
                Filter Staff:
              </span>
              <button
                type="button"
                onClick={() => setActiveStaffFilter('all')}
                className={`btn btn-sm text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                  activeStaffFilter === 'all'
                    ? 'btn-outline-primary active bg-[#1E3A8A] text-white font-bold shadow-xs'
                    : 'btn-outline-secondary bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                }`}
              >
                All Staff ({staff.length})
              </button>
              {staff.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveStaffFilter(s.id)}
                  className={`btn btn-sm text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                    activeStaffFilter === s.id
                      ? 'btn-outline-primary active bg-[#1E3A8A] text-white font-bold shadow-xs'
                      : 'btn-outline-secondary bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  HK-{String(s.id).padStart(3, '0')} - {s.name}
                </button>
              ))}
            </div>
          ) : (
            /* Staff ko sirf uski personal details ka non-clickable badge dikhega */
            <div className="alert alert-info py-2 px-3 mb-3 small d-flex align-items-center justify-content-between bg-sky-50 border border-sky-200 text-sky-900 rounded-xl py-2.5 px-4 mb-4 text-xs flex items-center justify-between shadow-2xs">
              <span>
                <b>Viewing Personal Records:</b> {currentUser?.name || 'Staff User'} (HK-{String(currentStaffId).padStart(3, '0')})
              </span>
              <span className="badge bg-primary bg-[#0d6efd] text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                Personal View
              </span>
            </div>
          )}

          {/* Manual Entry Collapse Form (Admin Only) */}
          {isAdminOrManager && isManualLogOpen && (
            <div className="collapse show mb-4" id="manualLogForm">
              <div className="card card-body bg-light border-0 bg-slate-50 border border-blue-200 p-4 rounded-xl shadow-xs">
                <div className="flex items-center justify-between mb-3 border-b border-blue-100 pb-2">
                  <h6 className="fw-bold mb-0 text-primary text-xs sm:text-sm font-bold text-[#1E3A8A]">
                    New Punch / Attendance Record
                  </h6>
                  <button
                    type="button"
                    onClick={() => setIsManualLogOpen(false)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </div>

                <form action="/admin/manual_log" method="POST" onSubmit={handleManualLogSubmit}>
                  <div className="row g-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="col-12 sm:col-span-2 lg:col-span-1">
                      <label className="form-label small fw-bold block text-xs font-semibold text-slate-700 mb-1">
                        Staff Member
                      </label>
                      <select
                        name="user_id"
                        value={formStaffId}
                        onChange={(e) => setFormStaffId(Number(e.target.value))}
                        className="form-select form-select-sm w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                        required
                      >
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            HK-{String(s.id).padStart(3, '0')} - {s.name} ({s.department})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label small fw-bold block text-xs font-semibold text-slate-700 mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        name="date"
                        required
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                      />
                    </div>

                    <div>
                      <label className="form-label small fw-bold block text-xs font-semibold text-slate-700 mb-1">
                        Status
                      </label>
                      <select
                        name="status"
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as any)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                      >
                        <option value="Present">Present</option>
                        <option value="Half Day">Half Day</option>
                        <option value="Absent">Absent</option>
                        <option value="On Leave">On Leave</option>
                        <option value="Weekly Off">Weekly Off</option>
                      </select>
                    </div>

                    {(formStatus === 'Present' || formStatus === 'Half Day') && (
                      <>
                        <div>
                          <label className="form-label small fw-bold block text-xs font-semibold text-slate-700 mb-1">
                            Punch In Time
                          </label>
                          <input
                            type="time"
                            name="punch_in"
                            value={formPunchIn}
                            onChange={(e) => handlePunchTimeChange(e.target.value, formPunchOut)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                          />
                        </div>

                        <div>
                          <label className="form-label small fw-bold block text-xs font-semibold text-slate-700 mb-1">
                            Punch Out Time
                          </label>
                          <input
                            type="time"
                            name="punch_out"
                            value={formPunchOut}
                            onChange={(e) => handlePunchTimeChange(formPunchIn, e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                          />
                        </div>

                        <div>
                          <label className="form-label small fw-bold block text-xs font-semibold text-slate-700 mb-1">
                            Regular Hours
                          </label>
                          <input
                            type="number"
                            name="regular_hours"
                            step="0.5"
                            min="0"
                            max="12"
                            value={formRegHours}
                            onChange={(e) => setFormRegHours(parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                          />
                        </div>

                        <div>
                          <label className="form-label small fw-bold block text-xs font-semibold text-amber-800 mb-1">
                            OT Hours (Overtime)
                          </label>
                          <input
                            type="number"
                            name="ot_hours"
                            step="0.1"
                            min="0"
                            max="12"
                            value={formOtHours}
                            onChange={(e) => setFormOtHours(parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs text-amber-900 font-bold focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </>
                    )}

                    <div className="sm:col-span-2">
                      <label className="form-label small fw-bold block text-xs font-semibold text-slate-700 mb-1">
                        Shift Notes / Duty Area
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Deep cleaning lobby, 4th floor VIP sanitized"
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                      />
                    </div>
                  </div>

                  <div className="text-end mt-3 flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsManualLogOpen(false)}
                      className="btn btn-sm px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 bg-white border border-slate-300 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm px-4 bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-semibold px-4 py-1.5 rounded-lg shadow-xs flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Record</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Attendance Data Table Matching User Template */}
          <div className="table-responsive overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="table table-hover align-middle small w-full text-left border-collapse text-xs">
              <thead className="table-light bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">DATE</th>
                  <th className="py-2.5 px-3">STAFF</th>
                  <th className="py-2.5 px-3">PUNCH IN</th>
                  <th className="py-2.5 px-3">PUNCH OUT</th>
                  <th className="py-2.5 px-3">REG HRS</th>
                  <th className="py-2.5 px-3">OT HRS</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  {isAdminOrManager && <th className="py-2.5 px-3 text-center">ACTION</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {monthRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdminOrManager ? 8 : 7}
                      className="py-8 text-center text-slate-400 italic text-xs"
                    >
                      No attendance logs recorded for {monthName} {currentYear}.
                    </td>
                  </tr>
                ) : (
                  monthRecords.map((log) => {
                    const st = staffMap.get(log.userId);
                    const formattedStaffCode = `HK-${String(st?.id || log.userId).padStart(3, '0')}`;
                    const staffName = st?.name || `Staff #${log.userId}`;

                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        {/* DATE */}
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-700">
                          {log.date}
                        </td>

                        {/* STAFF */}
                        <td className="py-2.5 px-3">
                          <b>{formattedStaffCode}</b>
                          <br />
                          <small className="text-muted text-slate-500 text-[11px]">{staffName}</small>
                        </td>

                        {/* PUNCH IN */}
                        <td className="py-2.5 px-3 font-mono">
                          {log.punchIn ? log.punchIn : '--:--'}
                        </td>

                        {/* PUNCH OUT */}
                        <td className="py-2.5 px-3 font-mono">
                          {log.punchOut ? log.punchOut : '--:--'}
                        </td>

                        {/* REG HRS */}
                        <td className="py-2.5 px-3 font-medium">
                          {log.regularHours.toFixed(1)}
                        </td>

                        {/* OT HRS */}
                        <td className="py-2.5 px-3 text-warning fw-bold text-amber-600 font-bold">
                          {log.otHours > 0 ? `+${log.otHours.toFixed(1)}` : '0.0'}
                        </td>

                        {/* STATUS */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`badge px-2.5 py-0.5 rounded-full font-semibold text-[11px] ${
                              log.status === 'Present'
                                ? 'bg-success-subtle text-success bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : log.status === 'Half Day'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : log.status === 'Weekly Off'
                                ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>

                        {/* ACTION (Admin Only) */}
                        {isAdminOrManager && (
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => onDeleteRecord(log.id)}
                              title="Delete log record"
                              className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Count & Close */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Total logs displayed: <b>{monthRecords.length}</b>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
