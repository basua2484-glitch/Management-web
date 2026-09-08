import React, { useState } from 'react';
import {
  Plus,
  Building,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Edit2,
  Search,
  Filter,
  LogIn,
  UserPlus,
  UserCheck,
} from 'lucide-react';
import type { StaffUser, AttendanceRecord } from '../types';

interface LiveAttendanceViewProps {
  selectedDate: string;
  onDateChange: (newDate: string) => void;
  staff: StaffUser[];
  records: AttendanceRecord[];
  onOpenAssignModal: (staffId?: number) => void;
  onOpenPunchPortal?: (staffId?: number) => void;
  onOpenAddUser?: () => void;
  pendingUsersCount?: number;
  onOpenPendingApprovalModal?: () => void;
  currentUserRole?: string;
}

export const LiveAttendanceView: React.FC<LiveAttendanceViewProps> = ({
  selectedDate,
  onDateChange,
  staff,
  records,
  onOpenAssignModal,
  onOpenPunchPortal,
  onOpenAddUser,
  pendingUsersCount = 0,
  onOpenPendingApprovalModal,
  currentUserRole,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ON_DUTY' | 'OT_ACTIVE' | 'ABSENT'>('ALL');

  // Map each active staff member to their record for the selected date
  const dateRecordsMap = new Map<number, AttendanceRecord>();
  records
    .filter((r) => r.date === selectedDate)
    .forEach((r) => {
      dateRecordsMap.set(r.userId, r);
    });

  // Calculate live metrics for the 4 cards
  const totalStaffCount = staff.filter((s) => s.active).length;

  let presentTodayCount = 0;
  let otActiveCount = 0;
  let absentCount = 0;

  const staffAttendanceList = staff
    .filter((s) => s.active)
    .map((user) => {
      const rec = dateRecordsMap.get(user.id);
      const isPresent = Boolean(rec?.punchIn);
      const otHours = rec?.otHours || 0;
      const regularHours = rec?.regularHours || (isPresent ? 8.0 : 0);
      const punchIn = rec?.punchIn || null;
      const punchOut = rec?.punchOut || null;
      const assignment = rec?.notes || user.department || 'General Duty';

      let statusType: 'OT_ACTIVE' | 'DUTY_COMPLETED' | 'ON_DUTY' | 'ABSENT';
      if (otHours > 0) {
        statusType = 'OT_ACTIVE';
        presentTodayCount++;
        otActiveCount++;
      } else if (rec?.status === 'Duty Completed' || Boolean(rec?.punchOut)) {
        statusType = 'DUTY_COMPLETED';
        presentTodayCount++;
      } else if (isPresent) {
        statusType = 'ON_DUTY';
        presentTodayCount++;
      } else {
        statusType = 'ABSENT';
        absentCount++;
      }

      return {
        userId: user.id,
        staffName: user.name,
        staffCode: user.staffCode,
        assignment,
        punchIn,
        punchOut,
        regularHours,
        otHours,
        statusType,
        record: rec,
      };
    });

  // Filter staff based on search & status filter
  const filteredList = staffAttendanceList.filter((item) => {
    const term = (searchTerm || '').toLowerCase();
    const matchesSearch =
      (item.staffName || '').toLowerCase().includes(term) ||
      (item.staffCode || '').toLowerCase().includes(term) ||
      (item.assignment || '').toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ON_DUTY' && (item.statusType === 'ON_DUTY' || item.statusType === 'OT_ACTIVE' || item.statusType === 'DUTY_COMPLETED')) ||
      (statusFilter === 'OT_ACTIVE' && item.statusType === 'OT_ACTIVE') ||
      (statusFilter === 'ABSENT' && item.statusType === 'ABSENT');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6" id="live-attendance-overview">
      {/* Top Title & Duty Assign Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
            Housekeeping Live Attendance Overview
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time duty allocations, daily punch logs, and active overtime monitoring
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {currentUserRole === 'admin' && onOpenPendingApprovalModal && (
            <button
              type="button"
              id="btn-open-pending-approvals"
              onClick={onOpenPendingApprovalModal}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-bold shadow-xs transition-all ${
                pendingUsersCount > 0
                  ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300'
              }`}
            >
              <UserCheck className="h-4 w-4" />
              <span>Pending Approvals</span>
              {pendingUsersCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-xs font-extrabold leading-none text-amber-900 bg-amber-200 rounded-full">
                  {pendingUsersCount}
                </span>
              )}
            </button>
          )}

          {currentUserRole === 'admin' && onOpenAddUser && (
            <button
              type="button"
              id="btn-add-user-modal-trigger"
              data-bs-toggle="modal"
              data-bs-target="#addUserModal"
              onClick={onOpenAddUser}
              className="btn btn-primary btn-sm fw-bold shadow-xs inline-flex items-center justify-center gap-1.5 rounded-md bg-[#0d6efd] hover:bg-[#0b5ed7] active:bg-[#0a58ca] px-3.5 py-2 text-sm font-bold text-white shadow-xs transition-colors"
            >
              <UserPlus className="h-4 w-4 me-1" />
              <span>Add New Staff / User</span>
            </button>
          )}

          <button
            type="button"
            id="btn-open-staff-punch-portal"
            onClick={() => onOpenPunchPortal?.(1)}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white shadow-xs transition-colors"
          >
            <LogIn className="h-4 w-4" />
            <span>Staff Punch Portal</span>
          </button>

          <button
            type="button"
            id="btn-assign-duty-modal"
            onClick={() => onOpenAssignModal()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1E3A8A] px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-900 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Duty & Shift Assign Karein</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Metrics Cards matching user's template */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL HOUSEKEEPERS */}
        <div className="rounded-xl bg-white p-4 shadow-sm border-l-4 border-l-[#1E3A8A] border border-slate-200">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            TOTAL HOUSEKEEPERS
          </div>
          <div className="text-3xl font-bold text-slate-900">
            {totalStaffCount}
          </div>
          <div className="text-2xs text-slate-400 mt-1">Active Roster Workforce</div>
        </div>

        {/* PRESENT TODAY */}
        <div className="rounded-xl bg-white p-4 shadow-sm border-l-4 border-l-emerald-600 border border-slate-200">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            PRESENT TODAY
          </div>
          <div className="text-3xl font-bold text-emerald-600">
            {presentTodayCount}
          </div>
          <div className="text-2xs text-emerald-600/80 mt-1">
            {totalStaffCount > 0
              ? `${Math.round((presentTodayCount / totalStaffCount) * 100)}% Attendance Rate`
              : '0%'}
          </div>
        </div>

        {/* OVERTIME (OT) ACTIVE */}
        <div className="rounded-xl bg-white p-4 shadow-sm border-l-4 border-l-amber-500 border border-slate-200">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            OVERTIME (OT) ACTIVE
          </div>
          <div className="text-3xl font-bold text-amber-600">
            {otActiveCount} Staff
          </div>
          <div className="text-2xs text-amber-600/80 mt-1">Working past 8.0 hr baseline</div>
        </div>

        {/* ABSENT / LEAVE */}
        <div className="rounded-xl bg-white p-4 shadow-sm border-l-4 border-l-rose-500 border border-slate-200">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            ABSENT / LEAVE
          </div>
          <div className="text-3xl font-bold text-rose-600">
            {absentCount < 10 ? `0${absentCount}` : absentCount}
          </div>
          <div className="text-2xs text-rose-600/80 mt-1">Pending replacement or off</div>
        </div>
      </div>

      {/* Live Attendance Log Table Card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Card Header matching user's template */}
        <div className="border-b border-slate-200 bg-white px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h4 className="text-base font-bold text-slate-900">
              Daily Punch & Duty Assignment Log
            </h4>
            <span className="hidden sm:inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#1E3A8A]">
              Live Ops
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff or duty..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48 sm:w-56 rounded-md border border-slate-300 py-1.5 pl-8 pr-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
              />
            </div>

            {/* Date Input matching user's template */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <input
                type="date"
                id="input-live-date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Table matching user's template */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="table-live-attendance">
            <thead className="bg-[#1E293B] text-white text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3.5">Staff Name</th>
                <th className="px-6 py-3.5">Assigned Duty / Area</th>
                <th className="px-6 py-3.5 text-center">Punch In</th>
                <th className="px-6 py-3.5 text-center">Punch Out</th>
                <th className="px-6 py-3.5 text-center">Regular Hrs</th>
                <th className="px-6 py-3.5 text-center">OT Hours</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                    No staff attendance found matching filters for {selectedDate}.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr
                    key={item.userId}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Staff Name & ID */}
                    <td className="px-6 py-3.5 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#1E3A8A]">
                          {item.staffCode}
                        </span>
                        <span>{item.staffName}</span>
                      </div>
                    </td>

                    {/* Assigned Duty / Area badge */}
                    <td className="px-6 py-3.5">
                      <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                        {item.assignment}
                      </span>
                    </td>

                    {/* Punch In */}
                    <td className="px-6 py-3.5 text-center font-mono text-xs">
                      {item.punchIn ? (
                        <span className="font-semibold text-slate-800">{item.punchIn}</span>
                      ) : (
                        <span className="text-slate-400">--:--</span>
                      )}
                    </td>

                    {/* Punch Out */}
                    <td className="px-6 py-3.5 text-center font-mono text-xs">
                      {item.punchOut ? (
                        <span className="font-semibold text-slate-800">{item.punchOut}</span>
                      ) : (
                        <span className="text-slate-400">--:--</span>
                      )}
                    </td>

                    {/* Regular Hrs */}
                    <td className="px-6 py-3.5 text-center font-medium">
                      {item.regularHours.toFixed(1)} hrs
                    </td>

                    {/* OT Hours */}
                    <td className="px-6 py-3.5 text-center">
                      <span className="font-bold text-amber-600">
                        {item.otHours.toFixed(1)} hrs
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-3.5 text-center">
                      {item.statusType === 'OT_ACTIVE' ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                          OT Active
                        </span>
                      ) : item.statusType === 'DUTY_COMPLETED' ? (
                        <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800 border border-sky-200">
                          Duty Completed
                        </span>
                      ) : item.statusType === 'ON_DUTY' ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                          On Duty
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
                          Absent
                        </span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenPunchPortal?.(item.userId)}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                          title="Open Staff Punching Card"
                        >
                          <LogIn className="h-3 w-3 text-emerald-700" />
                          <span>Punch</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenAssignModal(item.userId)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#1E3A8A]"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>Edit Duty</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
          <span>Date: <strong>{selectedDate}</strong> • Showing {filteredList.length} staff records</span>
          <span className="italic">Click "Edit Duty" or "Duty & Shift Assign Karein" to update punches</span>
        </div>
      </div>
    </div>
  );
};
