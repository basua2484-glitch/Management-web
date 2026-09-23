// src/components/modals/PunchKioskModal.tsx - ENABLE PUNCH FOR ALL ROLES

import React, { useState, useEffect } from 'react';

export interface PunchKioskModalProps {
  isOpen: boolean;
  tenantId: string;
  allCompanyUsers?: Array<{
    staff_id: string;
    tenant_id: string;
    name: string;
    role: 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'STAFF' | string;
    assigned_area?: string;
    assigned_shift?: string;
  }>;
  activeStaffList?: Array<any>;
  onClose: () => void;
  onPunchSubmit?: (punchRecord: {
    staff_id: string;
    name: string;
    role: string;
    timestamp: string;
    type: 'PUNCH_IN' | 'PUNCH_OUT';
  }) => Promise<void>;
  onPunchSuccess?: (punchData: any) => Promise<void>;
}

export const PunchKioskModal: React.FC<PunchKioskModalProps> = ({
  isOpen,
  tenantId,
  allCompanyUsers = [],
  activeStaffList = [],
  onClose,
  onPunchSubmit,
  onPunchSuccess
}) => {
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 🛑 FIX: Filter ALL roles (Admin, Manager, Supervisor, Staff) under active tenant
  const userSource = allCompanyUsers.length > 0 ? allCompanyUsers : activeStaffList;
  const eligiblePunchUsers = userSource
    .map((u: any) => ({
      ...u,
      staff_id: u.staff_id || u.staffCode || u.username || String(u.id || ''),
      name: u.name || u.full_name || 'Staff Member',
      role: (u.role || 'STAFF').toUpperCase(),
      tenant_id: u.tenant_id || u.tenantId || (u.staff_id?.includes('-') ? u.staff_id.split('-')[0].toUpperCase() : tenantId),
      assigned_area: u.assigned_area || u.fixed_department || u.department || 'Main Office / General',
    }))
    .filter(
      (u) =>
        !tenantId ||
        tenantId === 'ALL' ||
        u.tenant_id?.toUpperCase() === tenantId.toUpperCase() ||
        u.staff_id?.toUpperCase().startsWith(tenantId.toUpperCase())
    );

  useEffect(() => {
    if (eligiblePunchUsers.length > 0) {
      if (!selectedStaffId || !eligiblePunchUsers.some((u) => u.staff_id === selectedStaffId)) {
        setSelectedStaffId(eligiblePunchUsers[0].staff_id);
        setSelectedUser(eligiblePunchUsers[0]);
      }
    } else {
      setSelectedStaffId('');
      setSelectedUser(null);
    }
  }, [eligiblePunchUsers, selectedStaffId]);

  if (!isOpen) return null;

  const handlePunchAction = async (punchType: 'PUNCH_IN' | 'PUNCH_OUT') => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    setFeedback(null);

    const payload = {
      staff_id: selectedUser.staff_id,
      name: selectedUser.name,
      role: selectedUser.role,
      timestamp: new Date().toISOString(),
      type: punchType,
    };

    try {
      if (onPunchSubmit) {
        await onPunchSubmit(payload);
      } else if (onPunchSuccess) {
        await onPunchSuccess({ ...selectedUser, punchType, ...payload });
      }

      const successMsg = `✅ ${selectedUser.name} (${selectedUser.role}) ka ${punchType} successful ho gaya!`;
      setFeedback({ type: 'success', message: successMsg });

      // Safe notification fallback
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        try {
          window.alert(successMsg);
        } catch {
          // If alert is suppressed by browser iframe sandbox, feedback is shown in UI
        }
      }

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 700);
    } catch (err: any) {
      console.error("Punch Submission Error:", err);
      setFeedback({ type: 'error', message: err?.message || 'Failed to submit punch record.' });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" id="modal-punch-kiosk">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-mono text-emerald-400">Universal Punch Kiosk (All Roles)</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" type="button">✕</button>
        </div>

        {feedback && (
          <div
            className={`p-3 mb-4 rounded-xl text-xs font-mono font-semibold ${
              feedback.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/80 border border-rose-500/40 text-rose-300'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {eligiblePunchUsers.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No active accounts found for this hospital unit.
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-mono text-slate-400">SELECT PERSON / USER</label>
              <select
                value={selectedStaffId}
                onChange={(e) => {
                  const found = eligiblePunchUsers.find((u) => u.staff_id === e.target.value);
                  setSelectedStaffId(e.target.value);
                  setSelectedUser(found);
                }}
                className="w-full mt-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-sm outline-none"
              >
                {eligiblePunchUsers.map((usr, idx) => (
                  <option key={usr.staff_id || `kiosk-u-${idx}`} value={usr.staff_id}>
                    {usr.name} [{usr.role}] ({usr.staff_id})
                  </option>
                ))}
              </select>
            </div>

            {selectedUser && (
              <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 text-center space-y-3">
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-mono rounded-md font-bold uppercase">
                  Role: {selectedUser.role}
                </span>

                <div className="text-xl font-bold text-white pt-1">{selectedUser.name}</div>
                <div className="text-xs font-mono text-slate-400">ID: {selectedUser.staff_id}</div>
                <div className="text-xs font-mono text-slate-400">
                  Duty Area: {selectedUser.assigned_area || 'Main Office / General'}
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handlePunchAction('PUNCH_IN')}
                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold font-mono text-xs rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                  >
                    ➔ PUNCH IN
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handlePunchAction('PUNCH_OUT')}
                    className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold font-mono text-xs rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                  >
                    ⏹ PUNCH OUT
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
