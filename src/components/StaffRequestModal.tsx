import React, { useState } from 'react';
import { X, UserPlus, Building, Clock, UserCheck, ShieldCheck } from 'lucide-react';
import { DUTY_AREAS } from '../data/mockHousekeepingData';
import type { StaffRequest } from '../types';

interface StaffRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserStaffId?: string;
  onSubmitRequest: (data: {
    candidate_name: string;
    proposed_area: string;
    proposed_shift: string;
    requested_by: string;
  }) => void;
}

export const StaffRequestModal: React.FC<StaffRequestModalProps> = ({
  isOpen,
  onClose,
  currentUserStaffId = '',
  onSubmitRequest,
}) => {
  const [candidateName, setCandidateName] = useState('');
  const [proposedArea, setProposedArea] = useState(DUTY_AREAS[0] || 'General Ward');
  const [proposedShift, setProposedShift] = useState<'7-3' | '3-11' | '11-7'>('7-3');
  const [requestedBy, setRequestedBy] = useState(currentUserStaffId);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim()) {
      setError('Candidate full name is required');
      return;
    }
    if (!requestedBy.trim()) {
      setError('Supervisor Staff ID is required');
      return;
    }

    onSubmitRequest({
      candidate_name: candidateName.trim(),
      proposed_area: proposedArea,
      proposed_shift: proposedShift,
      requested_by: requestedBy.trim(),
    });

    setCandidateName('');
    setError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      id="modal-staff-request"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md my-auto">
        <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden text-left font-sans">
          
          {/* Header */}
          <div className="bg-[#1E3A8A] text-white px-5 py-4 flex items-center justify-between border-b border-blue-900">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white font-bold">
                <UserPlus className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Staff Joining Request
                </h3>
                <p className="text-xs text-blue-200">
                  Supervisor candidate submission for Admin Approval Queue
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                {error}
              </div>
            )}

            {/* Candidate Name */}
            <div>
              <label className="block text-2xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Candidate Full Name *
              </label>
              <input
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="e.g. Vikas Mehra"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#1E3A8A] focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A]/20"
              />
            </div>

            {/* Proposed Duty Area */}
            <div>
              <label className="block text-2xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Proposed Duty Area
              </label>
              <div className="relative">
                <select
                  value={proposedArea}
                  onChange={(e) => setProposedArea(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#1E3A8A] focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A]/20 pl-8"
                >
                  {DUTY_AREAS.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                  <option value="ICU Ward 2">ICU Ward 2</option>
                  <option value="Emergency Sanitation">Emergency Sanitation</option>
                </select>
                <Building className="h-4 w-4 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            {/* Proposed Shift */}
            <div>
              <label className="block text-2xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Proposed Shift (assigned_shift)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: '7-3', label: '7-3 (Morning)', time: '07:00 - 15:00' },
                  { key: '3-11', label: '3-11 (Evening)', time: '15:00 - 23:00' },
                  { key: '11-7', label: '11-7 (Night)', time: '23:00 - 07:00' },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setProposedShift(s.key as any)}
                    className={`rounded-lg p-2 text-center border transition-all text-xs ${
                      proposedShift === s.key
                        ? 'border-[#1E3A8A] bg-blue-50 text-[#1E3A8A] font-bold ring-1 ring-[#1E3A8A]'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold text-xs">{s.key}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{s.time}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Requested By (Supervisor Staff ID) */}
            <div>
              <label className="block text-2xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Requested By (Supervisor Staff ID) *
              </label>
              <input
                type="text"
                value={requestedBy}
                onChange={(e) => setRequestedBy(e.target.value)}
                placeholder="e.g. SUP-001"
                required
                className="w-full rounded-lg border border-slate-300 bg-slate-50 font-mono px-3 py-2 text-xs text-slate-800 focus:border-[#1E3A8A] focus:outline-hidden"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Logged supervisor identity attached to <code>requested_by</code>.
              </p>
            </div>

            {/* Model Info */}
            <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-2.5 text-2xs text-blue-900 leading-normal">
              <strong>Model Queue:</strong> <code>StaffRequest(requested_by, candidate_name, proposed_area, status='PENDING')</code>. Once submitted, hospital administrators can approve or reject the request.
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#1E3A8A] hover:bg-[#1e3470] text-xs font-bold text-white shadow-xs transition-colors flex items-center gap-1.5"
              >
                <UserCheck className="h-4 w-4" />
                Submit Request
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
