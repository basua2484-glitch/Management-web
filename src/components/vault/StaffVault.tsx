// src/components/vault/StaffVault.tsx - SAFE DELETE FUNCTIONALITY

import React, { useState } from 'react';

export interface StaffUser {
  staff_id: string;
  tenant_id: string;
  name: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'STAFF' | string;
  assigned_area?: string;
  assigned_shift?: string;
}

export interface StaffVaultProps {
  currentTenantId: string;
  currentLoggedInUserId?: string; // Active Admin Ki ID
  allCompanyUsers?: StaffUser[];
  onDeleteStaff?: (staffIdToDelete: string) => Promise<void>;
}

export const StaffVault: React.FC<StaffVaultProps> = ({
  currentTenantId,
  currentLoggedInUserId = '',
  allCompanyUsers = [],
  onDeleteStaff
}) => {
  const [confirmTarget, setConfirmTarget] = useState<StaffUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ text: string; type: 'warning' | 'success' | 'error' } | null>(null);

  // Filter accounts strictly for this tenant
  const tenantScopedAccounts = allCompanyUsers.filter(
    (user) => user.tenant_id === currentTenantId || user.staff_id?.startsWith(currentTenantId)
  );

  const showAlert = (text: string, type: 'warning' | 'success' | 'error') => {
    setAlertMessage({ text, type });
    setTimeout(() => {
      setAlertMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const handleDeleteClick = (userToDelete: StaffUser) => {
    // 🛑 SAFETY RULE 1: Self-deletion check
    if (userToDelete.staff_id === currentLoggedInUserId) {
      showAlert("⚠️ Aap khud ka active Admin account delete nahi kar sakte. Pehle kisi aur ko Admin role assign karein.", "warning");
      return;
    }

    // Open in-app modal confirmation dialog (safe in all browser/iframe environments)
    setConfirmTarget(userToDelete);
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget || !onDeleteStaff) return;
    setIsDeleting(true);

    try {
      await onDeleteStaff(confirmTarget.staff_id);
      showAlert(`✅ Account ${confirmTarget.staff_id} safaltapoorvak delete ho gaya hai.`, 'success');
      setConfirmTarget(null);
    } catch (error) {
      console.error("Delete Error:", error);
      showAlert("❌ Account delete karne mein dikkat aayi. Kripya firse try karein.", 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4" id="staff-vault-safe-delete">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold font-mono">Staff Directory & Security Control</h2>
          <p className="text-xs text-slate-400">Manage user accounts and delete inactive personnel.</p>
        </div>
        <div className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-mono text-emerald-400">
          TOTAL ACCOUNTS: {tenantScopedAccounts.length}
        </div>
      </div>

      {alertMessage && (
        <div
          className={`p-3 rounded-xl border text-xs font-mono transition-all flex items-center justify-between ${
            alertMessage.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : alertMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <span>{alertMessage.text}</span>
          <button onClick={() => setAlertMessage(null)} className="ml-2 text-slate-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-800/60 text-slate-400 uppercase border-b border-slate-800">
            <tr>
              <th className="p-3">Staff ID & User</th>
              <th className="p-3">Role</th>
              <th className="p-3">Assigned Area</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {tenantScopedAccounts.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  No accounts found for this company session.
                </td>
              </tr>
            ) : (
              tenantScopedAccounts.map((account) => {
                const isSelf = account.staff_id === currentLoggedInUserId;

                return (
                  <tr key={account.staff_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-semibold text-white">
                      <div>
                        {account.name} {isSelf && <span className="text-[10px] text-emerald-400 font-bold ml-1">(You)</span>}
                      </div>
                      <div className="text-[10px] text-slate-400">{account.staff_id}</div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        account.role === 'ADMIN' 
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                          : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      }`}>
                        {account.role}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">{account.assigned_area || 'General Ward'}</td>
                    <td className="p-3 text-right">
                      {isSelf ? (
                        <span className="text-[10px] text-slate-500 italic">Protected Self</span>
                      ) : (
                        <button
                          onClick={() => handleDeleteClick(account)}
                          className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Dialog */}
      {confirmTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-base font-bold font-mono">Confirm Account Deletion</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-mono">
              Kya aap sach mein <span className="font-bold text-white">{confirmTarget.name}</span> ({confirmTarget.staff_id}) ka account delete karna chahte hain? Iska sara data permanently remove ho jayega.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 text-xs font-mono font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-500/20 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
