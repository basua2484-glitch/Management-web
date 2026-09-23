import React, { useState } from 'react';
import {
  X,
  CheckCircle,
  ShieldAlert,
  ShieldCheck,
  Building,
  UserCheck,
  UserPlus,
  Clock,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  Users,
  Timer,
  Calendar,
  Plus,
  UserMinus,
  Trash2,
} from 'lucide-react';
import type { AppUser, UserRole, StaffRequest, DutyAllocation, RemovalRequest } from '../types';

interface PendingApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingUsers: AppUser[];
  onApproveUser: (userId: number, role: UserRole, assignedArea: string) => void;
  onRejectUser?: (userId: number) => void;
  currentUserRole?: UserRole;
  staffRequests?: StaffRequest[];
  onApproveStaffRequest?: (requestId: number, assignedShift?: string) => void;
  onRejectStaffRequest?: (requestId: number) => void;
  dutyAllocations?: DutyAllocation[];
  onApproveOtRequest?: (allocationId: number) => void;
  onRejectOtRequest?: (allocationId: number) => void;
  onOpenNewStaffRequest?: () => void;
  removalRequests?: RemovalRequest[];
  onApproveRemovalRequest?: (requestId: string | number) => void;
  onRejectRemovalRequest?: (requestId: string | number) => void;
  defaultTab?: 'requests' | 'overtime' | 'users' | 'removals';
}

export const PendingApprovalModal: React.FC<PendingApprovalModalProps> = ({
  isOpen,
  onClose,
  pendingUsers,
  onApproveUser,
  onRejectUser,
  currentUserRole = 'admin',
  staffRequests = [],
  onApproveStaffRequest,
  onRejectStaffRequest,
  dutyAllocations = [],
  onApproveOtRequest,
  onRejectOtRequest,
  onOpenNewStaffRequest,
  removalRequests = [],
  onApproveRemovalRequest,
  onRejectRemovalRequest,
  defaultTab = 'requests',
}) => {
  const [activeTab, setActiveTab] = useState<'requests' | 'overtime' | 'users' | 'removals'>(defaultTab);
  const [selectedRoles, setSelectedRoles] = useState<Record<number, UserRole>>({});
  const [selectedAreas, setSelectedAreas] = useState<Record<number, string>>({});
  const [requestFilter, setRequestFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  if (!isOpen) return null;

  const isUserAdmin = currentUserRole === 'admin' || currentUserRole === 'manager';

  const handleRoleChange = (userId: number, role: UserRole) => {
    setSelectedRoles((prev) => ({ ...prev, [userId]: role }));
  };

  const handleAreaChange = (userId: number, area: string) => {
    setSelectedAreas((prev) => ({ ...prev, [userId]: area }));
  };

  const handleApprove = (userId: number) => {
    const role = selectedRoles[userId] || 'staff';
    const area = selectedAreas[userId] || 'General Wards';
    onApproveUser(userId, role, area);
  };

  const pendingRequestsCount = staffRequests.filter((r) => r.status === 'PENDING').length;
  const pendingOtCount = dutyAllocations.filter((d) => d.ot_status === 'PENDING').length;
  const pendingRemovalCount = removalRequests.filter((r) => r.status === 'PENDING').length;

  const filteredStaffRequests = staffRequests.filter((r) => {
    if (requestFilter === 'ALL') return true;
    return r.status === requestFilter;
  });

  const filteredOtAllocations = dutyAllocations.filter((d) => {
    if (requestFilter === 'ALL') return true;
    return d.ot_status === requestFilter;
  });

  const filteredRemovalRequests = removalRequests.filter((r) => {
    if (requestFilter === 'ALL') return true;
    return r.status === requestFilter;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      id="admin-approval-modal"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl my-auto font-sans">
        <div className="bg-white border-0 shadow-2xl rounded-2xl overflow-hidden text-left transition-all">
          
          {/* Header */}
          <div className="bg-[#1E3A8A] text-white px-6 py-4 flex items-center justify-between border-b border-blue-900">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/30 text-white font-bold">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Pending Approvals Queue Portal
                </h3>
                <p className="text-xs text-blue-200">
                  Staff joining requests, overtime authorizations, and user signup approvals
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenNewStaffRequest && (
                <button
                  type="button"
                  onClick={onOpenNewStaffRequest}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-500/30 hover:bg-blue-500/50 text-white px-2.5 py-1 text-xs font-bold transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ New Request</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-blue-200 hover:text-white rounded-lg p-1 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 pt-3 gap-2 overflow-x-auto">
            {/* Tab 1: Staff Requests */}
            <button
              type="button"
              id="tab-approval-requests"
              onClick={() => setActiveTab('requests')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === 'requests'
                  ? 'border-[#1E3A8A] text-[#1E3A8A]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              <span>Staff Joining Requests</span>
              {pendingRequestsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {pendingRequestsCount}
                </span>
              )}
            </button>

            {/* Tab 2: Overtime Requests */}
            <button
              type="button"
              id="tab-approval-overtime"
              onClick={() => setActiveTab('overtime')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === 'overtime'
                  ? 'border-[#1E3A8A] text-[#1E3A8A]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Timer className="h-4 w-4 text-amber-600" />
              <span>Overtime Requests</span>
              {pendingOtCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                  {pendingOtCount}
                </span>
              )}
            </button>

            {/* Tab 3: Pending Users */}
            <button
              type="button"
              id="tab-approval-users"
              onClick={() => setActiveTab('users')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === 'users'
                  ? 'border-[#1E3A8A] text-[#1E3A8A]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Pending Signups</span>
              {pendingUsers.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  {pendingUsers.length}
                </span>
              )}
            </button>

            {/* Tab 4: Removal Requests */}
            <button
              type="button"
              id="tab-approval-removals"
              onClick={() => setActiveTab('removals')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === 'removals'
                  ? 'border-[#1E3A8A] text-[#1E3A8A]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserMinus className="h-4 w-4 text-rose-600" />
              <span>Removal Requests</span>
              {pendingRemovalCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                  {pendingRemovalCount}
                </span>
              )}
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {!isUserAdmin && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600" />
                <span>
                  <strong>Access Restricted:</strong> Only Admin accounts possess approval authority.
                </span>
              </div>
            )}

            {/* TAB 1: Staff Joining Request Queue Model */}
            {activeTab === 'requests' && (
              <div className="space-y-4">
                {/* Filter and stats */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="text-xs text-slate-500">
                    Model: <code>StaffRequest(requested_by, candidate_name, proposed_area, status)</code>
                  </div>
                  <div className="flex items-center gap-1">
                    {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setRequestFilter(filter)}
                        className={`px-2.5 py-1 rounded text-2xs font-bold transition-colors ${
                          requestFilter === filter
                            ? 'bg-[#1E3A8A] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredStaffRequests.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 space-y-2">
                    <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
                    <h4 className="font-semibold text-slate-800 text-sm">
                      No Staff Requests Found
                    </h4>
                    <p className="text-xs text-slate-400">
                      Supervisors can submit new candidate joining requests from the dashboard.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredStaffRequests.map((req) => {
                      const isPending = req.status === 'PENDING';
                      return (
                        <div
                          key={req.id}
                          className={`rounded-xl border p-4 transition-all shadow-2xs space-y-3 ${
                            isPending
                              ? 'border-amber-200 bg-amber-50/40'
                              : req.status === 'APPROVED'
                              ? 'border-emerald-200 bg-emerald-50/30'
                              : 'border-slate-200 bg-slate-50/50'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5 border-inherit">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-base">{req.candidate_name}</span>
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold ${
                                    isPending
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : req.status === 'APPROVED'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                                  }`}
                                >
                                  {req.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Requested by Supervisor: <code className="text-slate-800 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">{req.requested_by}</code>
                                {req.created_at && (
                                  <span className="ml-2 text-2xs text-slate-400">
                                    • {new Date(req.created_at).toLocaleDateString()}
                                  </span>
                                )}
                              </p>
                            </div>

                            <div className="text-xs text-slate-600">
                              Proposed Area: <strong className="text-slate-900">{req.proposed_area || 'General Ward'}</strong>
                              {req.proposed_shift && (
                                <span className="ml-2 bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold text-2xs">
                                  {req.proposed_shift}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons for Pending Requests */}
                          {isPending && isUserAdmin && onApproveStaffRequest && onRejectStaffRequest && (
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => onRejectStaffRequest(req.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 px-3 py-1.5 text-xs font-semibold transition-colors"
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                                Reject
                              </button>
                              <button
                                type="button"
                                onClick={() => onApproveStaffRequest(req.id, req.proposed_shift)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-2xs transition-colors"
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                                Approve &amp; Generate User Account
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Overtime Requests Queue (DutyAllocation ot_requested_hours) */}
            {activeTab === 'overtime' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="text-xs text-slate-500">
                    Model: <code>DutyAllocation(staff_id, ot_requested_hours, ot_status, approved_by)</code>
                  </div>
                  <div className="flex items-center gap-1">
                    {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setRequestFilter(filter)}
                        className={`px-2.5 py-1 rounded text-2xs font-bold transition-colors ${
                          requestFilter === filter
                            ? 'bg-[#1E3A8A] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredOtAllocations.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 space-y-2">
                    <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
                    <h4 className="font-semibold text-slate-800 text-sm">
                      No Overtime Requests Found
                    </h4>
                    <p className="text-xs text-slate-400">
                      Staff overtime beyond 8.0 baseline hours will appear here for authorization.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredOtAllocations.map((ot) => {
                      const isPending = ot.ot_status === 'PENDING';
                      return (
                        <div
                          key={ot.id}
                          className={`rounded-xl border p-4 transition-all shadow-2xs space-y-3 ${
                            isPending
                              ? 'border-amber-200 bg-amber-50/40'
                              : ot.ot_status === 'APPROVED'
                              ? 'border-emerald-200 bg-emerald-50/30'
                              : 'border-slate-200 bg-slate-50/50'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5 border-inherit">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900 text-base">{ot.staff_id}</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  <Clock className="h-3 w-3" />
                                  {ot.ot_requested_hours} Hours Requested
                                </span>
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold ${
                                    isPending
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : ot.ot_status === 'APPROVED'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                                  }`}
                                >
                                  {ot.ot_status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                <span>Date: <strong className="text-slate-800">{ot.date}</strong></span>
                                <span>• Supervisor: <code className="text-slate-800 font-mono bg-white px-1 py-0.2 rounded border border-slate-200">{ot.assigned_by_supervisor || 'Supervisor'}</code></span>
                                {ot.approved_by && <span>• Approved by: <code className="text-emerald-800 font-bold">{ot.approved_by}</code></span>}
                              </p>
                            </div>

                            <div className="text-xs text-slate-600">
                              Assigned Department: <strong className="text-slate-900">{ot.assigned_department}</strong>
                            </div>
                          </div>

                          {/* Action Buttons for Pending OT */}
                          {isPending && isUserAdmin && onApproveOtRequest && onRejectOtRequest && (
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => onRejectOtRequest(ot.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 px-3 py-1.5 text-xs font-semibold transition-colors"
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                                Reject OT
                              </button>
                              <button
                                type="button"
                                onClick={() => onApproveOtRequest(ot.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-2xs transition-colors"
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                                Approve {ot.ot_requested_hours}h Overtime
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Pending User Signups */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                {pendingUsers.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 text-base">
                        No Pending User Registrations
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                        All registered accounts are verified and approved.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-100">
                      <span>Pending Registrations: <strong className="text-slate-800">{pendingUsers.length}</strong></span>
                      <span>Admin assigns role &amp; duty area</span>
                    </div>

                    {pendingUsers.map((user, idx) => {
                      const currentAssignedRole = selectedRoles[user.id] || (user.role || 'staff');
                      const currentAssignedArea =
                        selectedAreas[user.id] ||
                        (user.assigned_area && user.assigned_area !== 'Unassigned'
                          ? user.assigned_area
                          : '3rd Floor Wards');

                      return (
                        <div
                          key={user.staff_id || (user.id ? `pending-${user.id}` : `pending-u-${idx}`)}
                          className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5 transition-all shadow-2xs space-y-4"
                          id={`pending-user-card-${user.id}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-base">{user.name}</span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-2xs font-bold text-amber-800">
                                  <ShieldAlert className="h-3 w-3" />
                                  Pending Approval
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Username: <code className="text-slate-800 font-mono bg-white px-1 py-0.5 rounded border border-slate-200">{user.username}</code> • Staff ID: {user.staff_id}
                              </p>
                            </div>

                            <div className="text-2xs text-slate-400">
                              Status: <span className="font-semibold text-amber-700">is_approved = False</span>
                            </div>
                          </div>

                          {/* Role & Area Assignment Form */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div>
                              <label className="block text-2xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Assign Role *
                              </label>
                              <select
                                value={currentAssignedRole}
                                onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                                disabled={!isUserAdmin}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#1E3A8A] focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A]/20"
                              >
                                <option value="staff">Staff (Floor Worker / Attendant)</option>
                                <option value="supervisor">Supervisor (Floor Lead)</option>
                                <option value="manager">Manager (Operations Supervisor)</option>
                                <option value="admin">Admin (Full System Administrator)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-2xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Assigned Duty Area *
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={currentAssignedArea}
                                  onChange={(e) => handleAreaChange(user.id, e.target.value)}
                                  placeholder="e.g. 3rd Floor Wards"
                                  disabled={!isUserAdmin}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#1E3A8A] focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A]/20 pl-8"
                                />
                                <Building className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="flex justify-end gap-2 pt-2">
                            {onRejectUser && (
                              <button
                                type="button"
                                onClick={() => onRejectUser(user.id)}
                                disabled={!isUserAdmin}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 px-3 py-2 text-xs font-semibold transition-colors"
                              >
                                <ThumbsDown className="h-4 w-4" />
                                <span>Reject</span>
                              </button>
                            )}
                            <button
                              type="button"
                              id={`btn-approve-user-${user.id}`}
                              onClick={() => handleApprove(user.id)}
                              disabled={!isUserAdmin}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white px-4 py-2 text-xs font-bold shadow-xs transition-colors"
                            >
                              <UserCheck className="h-4 w-4" />
                              <span>Approve Account &amp; Grant Access</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Supervisor Staff Removal Requests */}
            {activeTab === 'removals' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="text-xs text-slate-500">
                    Model: <code>RemovalRequest(requested_by, staff_name, reason, status)</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">Filter:</span>
                    <select
                      value={requestFilter}
                      onChange={(e) => setRequestFilter(e.target.value as any)}
                      className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 bg-white font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ALL">All Requests ({removalRequests.length})</option>
                      <option value="PENDING">Pending Only ({pendingRemovalCount})</option>
                      <option value="APPROVED">Approved Only</option>
                      <option value="REJECTED">Rejected Only</option>
                    </select>
                  </div>
                </div>

                {filteredRemovalRequests.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm">No Removal Requests</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Supervisor requests to remove or de-allocate staff members will appear here.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRemovalRequests.map((req) => {
                      const isPending = req.status === 'PENDING';
                      return (
                        <div
                          key={req.id}
                          className={`rounded-xl border p-4 transition-all shadow-2xs space-y-3 ${
                            isPending
                              ? 'border-rose-200 bg-rose-50/30'
                              : req.status === 'APPROVED'
                              ? 'border-emerald-200 bg-emerald-50/20'
                              : 'border-slate-200 bg-slate-50/50 opacity-75'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm">
                                  {req.staff_name}
                                </span>
                                <span className="font-mono text-2xs px-2 py-0.5 rounded-md bg-blue-50 text-[#1E3A8A] font-semibold border border-blue-200">
                                  {req.staff_id}
                                </span>
                                {req.role && (
                                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                    {req.role}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Requested by <strong className="text-slate-700">{req.requested_by_name || req.requested_by}</strong> on{' '}
                                {new Date(req.created_at).toLocaleDateString()}
                              </p>
                            </div>

                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-bold uppercase tracking-wider self-start sm:self-auto ${
                                req.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : req.status === 'REJECTED'
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse'
                              }`}
                            >
                              {req.status}
                            </span>
                          </div>

                          {/* Reason */}
                          <div className="bg-white/80 rounded-lg p-2.5 border border-slate-200 text-xs text-slate-700">
                            <span className="font-bold text-slate-900 block mb-0.5">Removal Reason:</span>
                            <p className="italic text-slate-600">"{req.reason}"</p>
                          </div>

                          {/* Action Buttons for Admins & Managers */}
                          {isPending && isUserAdmin && (
                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                              {onRejectRemovalRequest && (
                                <button
                                  type="button"
                                  onClick={() => onRejectRemovalRequest(req.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                                >
                                  <ThumbsDown className="h-3.5 w-3.5" />
                                  <span>Reject Request</span>
                                </button>
                              )}
                              {onApproveRemovalRequest && (
                                <button
                                  type="button"
                                  onClick={() => onApproveRemovalRequest(req.id)}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Approve &amp; Delete User</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Flask Route: <code>/admin/approve_user</code> &bull; <code>/admin/approve_ot</code></span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

