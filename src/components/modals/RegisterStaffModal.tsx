// src/components/modals/RegisterStaffModal.tsx - DYNAMIC AUTO-INCREMENT ID FIX

import React, { useState, useEffect } from 'react';
import { getActiveCompanyPrefix } from '../../utils/tenantStorage';

export interface RegisterStaffModalProps {
  isOpen: boolean;
  currentUserTenantId: string;
  existingStaffList?: Array<{ staff_id: string }>;
  onClose: () => void;
  onSuccess: (newStaffData: any) => Promise<void>;
}

export const RegisterStaffModal: React.FC<RegisterStaffModalProps> = ({
  isOpen,
  currentUserTenantId,
  existingStaffList = [],
  onClose,
  onSuccess
}) => {
  const [generatedStaffId, setGeneratedStaffId] = useState('');
  const [fullName, setFullName] = useState('');
  const [tempPassword, setTempPassword] = useState('123456');
  const [role, setRole] = useState<'STAFF' | 'SUPERVISOR' | 'MANAGER'>('STAFF');
  const [assignedArea, setAssignedArea] = useState('General Ward');
  const [assignedShift, setAssignedShift] = useState('7-3 (Morning)');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🛑 FIX: Calculate Next Sequential Unique ID on Modal Open
  useEffect(() => {
    if (isOpen) {
      const tenantPrefix = getActiveCompanyPrefix(currentUserTenantId) || 'SAHO';
      const roleTag = role === 'SUPERVISOR' ? 'SUP' : role === 'MANAGER' ? 'MGR' : 'STF';
      
      // Extract existing numeric IDs (e.g. SAHO-STF-001 -> 1)
      const existingNumbers = (existingStaffList || [])
        .map(s => {
          const match = s.staff_id?.match(/-(\d+)$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(num => !isNaN(num));

      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      const formattedSeq = String(nextNumber).padStart(3, '0'); // 002, 003, etc.
      
      setGeneratedStaffId(`${tenantPrefix}-${roleTag}-${formattedSeq}`);
    }
  }, [isOpen, role, currentUserTenantId, existingStaffList]);

  if (!isOpen) return null;

  const handleSubmitOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const tenantPrefix = getActiveCompanyPrefix(currentUserTenantId);

      // Clean Payload with FRESH Unique ID & undefined field protection
      const newStaffPayload = {
        staff_id: generatedStaffId, // Dynamic ID (e.g., SAHO-STF-002)
        tenant_id: tenantPrefix,
        name: fullName.trim(),
        // 🛑 FIX: Undefined value se bachne ke liye fallback set karein
        tempDepartment: null, // Ya tempDepartment || ""
        assigned_area: assignedArea || "General Ward",
        role: role || "STAFF",
        password_hash: tempPassword,
        assigned_shift: assignedShift || "7-3 (Morning)",
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      };

      await onSuccess(newStaffPayload);
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error("Onboarding Failed:", err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-mono text-emerald-400">// INTERNAL ONBOARDING • ADMIN ACCESS</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleSubmitOnboarding} className="space-y-4">
          <div>
            <label className="text-xs font-mono text-slate-400">STAFF ID (AUTO-GENERATED)</label>
            <input
              type="text"
              readOnly
              value={generatedStaffId}
              className="w-full mt-1 px-4 py-2.5 rounded-xl border border-emerald-500/40 bg-slate-800 text-emerald-400 font-mono text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400">FULL NAME *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Pooja Verma"
              className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono text-slate-400">ROLE</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm outline-none focus:border-emerald-500"
              >
                <option value="STAFF">Housekeeping Staff</option>
                <option value="SUPERVISOR">Floor Supervisor</option>
                <option value="MANAGER">Shift Manager</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-mono text-slate-400">SHIFT</label>
              <select
                value={assignedShift}
                onChange={(e) => setAssignedShift(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm outline-none focus:border-emerald-500"
              >
                <option value="7-3 (Morning)">7-3 (Morning)</option>
                <option value="3-11 (Evening)">3-11 (Evening)</option>
                <option value="11-7 (Night)">11-7 (Night)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400">TEMPORARY PASSWORD *</label>
            <input
              type="text"
              required
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-xs font-mono bg-slate-800 text-slate-300 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
