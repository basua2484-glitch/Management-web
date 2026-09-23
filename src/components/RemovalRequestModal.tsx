import React, { useState } from 'react';
import { X, UserMinus, AlertTriangle } from 'lucide-react';
import type { AppUser } from '../types';

interface RemovalRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffUser: AppUser | null;
  currentSupervisorId: string;
  currentSupervisorName?: string;
  onSubmitRequest: (data: {
    staff_id: string;
    staff_name: string;
    user_id?: number;
    role?: string;
    reason: string;
    requested_by: string;
    requested_by_name?: string;
  }) => void;
}

export const RemovalRequestModal: React.FC<RemovalRequestModalProps> = ({
  isOpen,
  onClose,
  staffUser,
  currentSupervisorId,
  currentSupervisorName,
  onSubmitRequest,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !staffUser) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for the removal/termination request.');
      return;
    }

    setIsSubmitting(true);
    onSubmitRequest({
      staff_id: staffUser.staff_id || String(staffUser.id),
      staff_name: staffUser.full_name || staffUser.name || 'Staff Member',
      user_id: staffUser.id,
      role: staffUser.role,
      reason: reason.trim(),
      requested_by: currentSupervisorId || 'Supervisor',
      requested_by_name: currentSupervisorName || 'Supervisor',
    });

    setIsSubmitting(false);
    setReason('');
    setError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      id="modal-removal-request"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-amber-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
              <UserMinus className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Request Staff Removal</h3>
              <p className="text-2xs text-slate-500">Supervisor Termination / Removal Pipeline</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Target Staff Summary */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-2xs uppercase tracking-wider text-slate-500 font-bold">Target Staff</span>
              <span className="font-mono text-2xs px-2 py-0.5 rounded bg-blue-100 text-[#1E3A8A] font-bold">
                {staffUser.staff_id || staffUser.id}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900">{staffUser.full_name || staffUser.name}</div>
            <div className="text-2xs text-slate-500 flex items-center gap-2">
              <span>Role: <strong className="uppercase">{staffUser.role}</strong></span>
              <span>•</span>
              <span>Dept: <strong>{staffUser.fixed_department || staffUser.assigned_area || 'General Wards'}</strong></span>
            </div>
          </div>

          <div className="rounded-lg bg-amber-50/80 border border-amber-200/80 p-3 text-2xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Supervisors cannot directly delete records. This request will be routed directly to the <strong>Admin &amp; Manager Approvals Queue</strong> for review and final execution.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Reason for Removal / Termination <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              rows={3}
              placeholder="E.g., Contract ended, prolonged absenteeism without notice, relocated to another facility, disciplinary action..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-800 placeholder:text-slate-400"
              required
            />
          </div>

          <div className="text-2xs text-slate-400">
            Submitted by: <strong className="text-slate-600">{currentSupervisorName || currentSupervisorId || 'Supervisor'}</strong>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Removal Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
