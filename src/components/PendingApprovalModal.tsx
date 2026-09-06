import React, { useState } from 'react';
import { X, CheckCircle, ShieldAlert, ShieldCheck, Building, UserCheck } from 'lucide-react';
import type { AppUser, UserRole } from '../types';

interface PendingApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingUsers: AppUser[];
  onApproveUser: (userId: number, role: UserRole, assignedArea: string) => void;
  currentUserRole?: UserRole;
}

export const PendingApprovalModal: React.FC<PendingApprovalModalProps> = ({
  isOpen,
  onClose,
  pendingUsers,
  onApproveUser,
  currentUserRole,
}) => {
  const [selectedRoles, setSelectedRoles] = useState<Record<number, UserRole>>({});
  const [selectedAreas, setSelectedAreas] = useState<Record<number, string>>({});

  if (!isOpen) return null;

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

  const isUserAdmin = currentUserRole === 'admin';

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
      <div className="w-full max-w-2xl my-auto">
        <div className="bg-white border-0 shadow-2xl rounded-2xl overflow-hidden text-left transition-all">
          {/* Header */}
          <div className="bg-[#1E3A8A] text-white px-6 py-4 flex items-center justify-between border-b border-blue-900">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/30 text-white font-bold">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  User Approval Portal (@app.route('/admin/approve_user'))
                </h3>
                <p className="text-xs text-blue-200">
                  Review &amp; approve self-signed staff accounts (Admin Only)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-blue-200 hover:text-white rounded-lg p-1 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {!isUserAdmin && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600" />
                <span>
                  <strong>Access Restricted:</strong> Sirf Admin accounts ke paas user approval authority hai.
                </span>
              </div>
            )}

            {pendingUsers.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 text-base">
                    Koi Pending Approval Request Nahi Hai
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Sabhi registered accounts verified aur approved hain. Naye self-registered staff yahan dikhenge.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-100">
                  <span>Pending Registrations: <strong className="text-slate-800">{pendingUsers.length}</strong></span>
                  <span>Rule: Admin assign kar sakta hai role</span>
                </div>

                {pendingUsers.map((user) => {
                  const currentAssignedRole = selectedRoles[user.id] || (user.role || 'staff');
                  const currentAssignedArea = selectedAreas[user.id] || (user.assigned_area && user.assigned_area !== 'Unassigned' ? user.assigned_area : '3rd Floor Wards');

                  return (
                    <div
                      key={user.id}
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
                            Username: <code className="text-slate-800 font-mono bg-white px-1 py-0.5 rounded border border-slate-200">{user.username}</code> • ID: #{user.id}
                          </p>
                        </div>

                        <div className="text-2xs text-slate-400">
                          Status: <span className="font-semibold text-amber-700">is_approved = False</span>
                        </div>
                      </div>

                      {/* Role & Area Assignment Form (Flask: user.role = request.form.get('role', 'staff')) */}
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
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          id={`btn-approve-user-${user.id}`}
                          onClick={() => handleApprove(user.id)}
                          disabled={!isUserAdmin}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white px-4 py-2 text-xs font-bold shadow-xs transition-colors"
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

          {/* Footer */}
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Flask Route: <code>/admin/approve_user/&lt;user_id&gt;</code></span>
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
