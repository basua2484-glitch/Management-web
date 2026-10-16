import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Building,
  Lock,
  Plus,
  Loader2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import type { StaffUser, AttendanceRecord } from '../types';
import { SHIFTS, process_shift_attendance } from '../utils/attendanceCalculator';
import {
  canSupervisorAction,
  OFF_DUTY_RESTRICTION_MESSAGE,
  showOffDutyToast,
} from '../utils/dutyPermissionGuard';
import {
  fetchZonesForSite,
  createZoneInDatabase,
  isRoleAuthorizedToCreateWard,
  DEFAULT_HOSPITAL_WARDS,
} from '../services/zoneService';

export interface DutyAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffUser[];
  selectedDate: string;
  onSaveAssignment: (record: AttendanceRecord, updatedDutyArea?: string) => void;
  initialStaffId?: number | null;
  currentUserRole?: string;
  isOnDuty?: boolean;
  isShiftGated?: boolean;
  canPerformAction?: boolean;
  activeSiteId?: string;
  activeSiteName?: string;
}

// Clean default hospital wards exported for backwards-compatibility
export const DUTY_AREAS = DEFAULT_HOSPITAL_WARDS;

export const DutyAssignmentModal: React.FC<DutyAssignmentModalProps> = ({
  isOpen,
  onClose,
  staff,
  selectedDate,
  onSaveAssignment,
  initialStaffId,
  currentUserRole,
  isOnDuty,
  isShiftGated,
  canPerformAction,
  activeSiteId,
  activeSiteName,
}) => {
  const [dutyType, setDutyType] = useState<'FIXED' | 'PERMANENT_RELIEVER' | 'TEMP_RELIEVER'>('FIXED');
  const [isTempReliever, setIsTempReliever] = useState<boolean>(false);
  const [tempDepartment, setTempDepartment] = useState<string>('');
  const [staffId, setStaffId] = useState<number>(initialStaffId || staff[0]?.id || 1);
  const [date, setDate] = useState<string>(selectedDate);
  const [dutyArea, setDutyArea] = useState<string>(DEFAULT_HOSPITAL_WARDS[0]);
  const [shift, setShift] = useState<'Morning' | 'Evening' | 'Night'>('Morning');
  const [punchIn, setPunchIn] = useState<string>(SHIFTS.MORNING.start);
  const [punchOut, setPunchOut] = useState<string>(SHIFTS.MORNING.end);
  const [status, setStatus] = useState<'Present' | 'Absent' | 'Half Day' | 'On Leave'>('Present');
  const [regularHours, setRegularHours] = useState<number>(8.0);
  const [otHours, setOtHours] = useState<number>(0.0);
  const [notes, setNotes] = useState<string>('');

  // Dynamic Wards loaded from Database 'zones' table
  const [availableWards, setAvailableWards] = useState<string[]>(DEFAULT_HOSPITAL_WARDS);
  const [isLoadingWards, setIsLoadingWards] = useState<boolean>(false);

  // Manual Creatable Ward State (Restricted to MASTER_ADMIN & OPERATIONS_MANAGER)
  const [customWardInput, setCustomWardInput] = useState<string>('');
  const [isAddingWard, setIsAddingWard] = useState<boolean>(false);
  const [wardFeedback, setWardFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // RBAC Permission check
  const canCreateWard = isRoleAuthorizedToCreateWard(currentUserRole);

  // Fetch dynamic pre-approved zones for the active site
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    setIsLoadingWards(true);

    fetchZonesForSite(activeSiteId, currentUserRole)
      .then((zones) => {
        if (isCancelled) return;
        const wardNames = zones.map((z) => (z.zone_name || z.department || '').trim()).filter(Boolean);
        if (wardNames.length > 0) {
          const unique = Array.from(new Set(wardNames));
          setAvailableWards(unique);

          // If current dutyArea is not in the site's zones, sync it with staff department or first available
          setDutyArea((currentArea) => {
            if (unique.includes(currentArea)) return currentArea;
            const staffMatch = staff.find((s) => s.id === staffId);
            const staffDept = staffMatch?.fixed_department || staffMatch?.fixedDepartment || staffMatch?.assigned_area || staffMatch?.department;
            if (staffDept && unique.includes(staffDept)) return staffDept;
            return unique[0];
          });
        }
      })
      .catch((err) => {
        console.warn('Failed to load site zones:', err);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingWards(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, activeSiteId, currentUserRole, staffId, staff]);

  // Sync initial staff department when staffId changes or modal opens
  useEffect(() => {
    if (initialStaffId) {
      setStaffId(initialStaffId);
    }
  }, [initialStaffId]);

  useEffect(() => {
    const targetStaff = staff.find((s) => s.id === staffId);
    if (targetStaff) {
      const preferred = (
        targetStaff.fixed_department ||
        targetStaff.fixedDepartment ||
        targetStaff.assigned_area ||
        targetStaff.department ||
        ''
      ).trim();
      if (preferred) {
        setDutyArea(preferred);
        setAvailableWards((prev) => (prev.includes(preferred) ? prev : [preferred, ...prev]));
      }
    }
  }, [staffId, staff]);

  // Reset feedback when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setWardFeedback(null);
      setCustomWardInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const roleUpper = (currentUserRole || '').toUpperCase();
  const effectiveAllowed =
    canPerformAction !== undefined
      ? canPerformAction
      : isShiftGated !== undefined
      ? !isShiftGated
      : canSupervisorAction(roleUpper || 'SUPERVISOR', isOnDuty ?? true);
  const isRestricted = !effectiveAllowed;

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

  // Manual Ward Creation Handler (saves to database 'zones' table)
  const handleAddNewWard = async () => {
    const trimmed = customWardInput.trim();
    if (!trimmed) {
      setWardFeedback({ type: 'error', message: 'Ward / Area name cannot be empty.' });
      return;
    }

    if (!canCreateWard) {
      setWardFeedback({
        type: 'error',
        message: 'RBAC Restriction: Only MASTER_ADMIN and OPERATIONS_MANAGER can create custom wards.',
      });
      return;
    }

    setIsAddingWard(true);
    setWardFeedback(null);

    try {
      const createdZone = await createZoneInDatabase(activeSiteId, trimmed, currentUserRole);
      const newWardName = createdZone.zone_name || trimmed;

      setAvailableWards((prev) => (prev.includes(newWardName) ? prev : [...prev, newWardName]));
      setDutyArea(newWardName);
      setCustomWardInput('');
      setWardFeedback({
        type: 'success',
        message: `✓ Ward "${newWardName}" registered into database 'zones' table linked to active site!`,
      });

      setTimeout(() => {
        setWardFeedback(null);
      }, 4000);
    } catch (err: any) {
      setWardFeedback({
        type: 'error',
        message: err?.message || 'Failed to save custom ward into database zones table.',
      });
    } finally {
      setIsAddingWard(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRestricted) {
      showOffDutyToast();
      return;
    }
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
                {activeSiteName && (
                  <span className="ml-1 font-medium text-blue-700">
                    • Site: {activeSiteName}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
          {isRestricted && (
            <div
              id="duty-modal-off-duty-banner"
              className="p-3 bg-amber-500/15 border border-amber-500/50 rounded-xl text-xs text-amber-950 flex items-start gap-2.5 shadow-2xs"
            >
              <Lock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <b className="font-bold">Action Restricted:</b> You are currently OFF-DUTY. Please Punch-In to make operational entries.
                <div className="text-2xs text-amber-800 mt-0.5">
                  Duty logging and shift assignments are locked in read-only mode until you punch in on the supervisor terminal.
                </div>
              </div>
            </div>
          )}

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

          {/* ========================================================================= */}
          {/* Primary Ward / Area (fixed_department) with Dynamic DB & RBAC Support    */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Primary Ward / Area (fixed_department)
              </label>

              {canCreateWard ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                  <Sparkles className="h-3 w-3 text-blue-600" />
                  Creatable Zone Access (Admin/Manager)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                  <Lock className="h-3 w-3 text-slate-500" />
                  Pre-Approved Wards Only
                </span>
              )}
            </div>

            {/* Standard Dropdown of Wards Linked to Active Site */}
            <div className="relative">
              <select
                value={dutyArea}
                onChange={(e) => setDutyArea(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
              >
                {availableWards.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>

              {isLoadingWards && (
                <span className="absolute right-8 top-2.5 text-xs text-slate-400 flex items-center gap-1 pointer-events-none">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Syncing...
                </span>
              )}
            </div>

            {/* RBAC Conditional: Manual Creation Bar strictly for MASTER_ADMIN and OPERATIONS_MANAGER */}
            {canCreateWard ? (
              <div className="rounded-lg border border-blue-200/80 bg-blue-50/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-blue-900">
                    + Add New Custom Ward to Database:
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Table: 'zones' (Site-Linked)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Type custom Ward name & press Enter (e.g., Cardiac ICU, Pediatric Wing)..."
                    value={customWardInput}
                    onChange={(e) => setCustomWardInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewWard();
                      }
                    }}
                    className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  />

                  <button
                    type="button"
                    onClick={handleAddNewWard}
                    disabled={isAddingWard || !customWardInput.trim()}
                    className="inline-flex items-center gap-1 rounded-md bg-[#1E3A8A] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-900 disabled:opacity-50 transition cursor-pointer disabled:cursor-not-allowed shrink-0"
                  >
                    {isAddingWard ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>+ Add Ward</span>
                      </>
                    )}
                  </button>
                </div>

                {wardFeedback && (
                  <div
                    className={`flex items-center gap-1.5 text-xs font-medium pt-1 ${
                      wardFeedback.type === 'success' ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {wardFeedback.type === 'success' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    )}
                    <span>{wardFeedback.message}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 flex items-center gap-1 px-1">
                <Lock className="h-3 w-3 text-slate-400 shrink-0" />
                <span>
                  Wards are managed and approved by your Operations Manager or Master Admin.
                </span>
              </p>
            )}
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
              placeholder="e.g. VIP floor inspection, Specialized ward sanitation"
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
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRestricted}
              title={isRestricted ? OFF_DUTY_RESTRICTION_MESSAGE : 'Duty & Shift Assign Karein'}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold shadow-xs transition ${
                isRestricted
                  ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                  : 'bg-[#1E3A8A] text-white hover:bg-blue-900 cursor-pointer'
              }`}
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

export default DutyAssignmentModal;
