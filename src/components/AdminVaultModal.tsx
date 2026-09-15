import React, { useState } from 'react';
import { X, Shield, KeyRound, Eye, EyeOff, Lock, Copy, Check, Search, ShieldAlert, AlertTriangle } from 'lucide-react';
import type { AppUser, UserRole } from '../types';
import { decryptVaultPassword } from '../services/vaultService';

interface AdminVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: AppUser[];
  currentUserRole?: UserRole;
  onUpdateUserStatus?: (userId: number, newStatus: 'ACTIVE' | 'DISABLED') => void;
}

export const AdminVaultModal: React.FC<AdminVaultModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUserRole = 'admin',
  onUpdateUserStatus,
}) => {
  const [search, setSearch] = useState('');
  const [revealedIds, setRevealedIds] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);

  if (!isOpen) return null;

  const isAdmin = currentUserRole === 'admin';

  const toggleReveal = (userId: number) => {
    setRevealedIds((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const copyPassword = (userId: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(userId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.staff_id && u.staff_id.toLowerCase().includes(q)) ||
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q)) ||
      (u.assigned_area && u.assigned_area.toLowerCase().includes(q)) ||
      (u.status && u.status.toLowerCase().includes(q))
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      id="admin-vault-modal"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl my-auto">
        <div className="bg-[#0F172A] border border-slate-700 shadow-2xl rounded-2xl overflow-hidden text-left text-slate-100 font-sans">
          
          {/* Header */}
          <div className="bg-[#1E293B] px-6 py-4 flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <KeyRound className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Admin Password Vault Support
                  </h3>
                  <span className="rounded-md bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-2xs font-semibold text-amber-300">
                    raw_password_vault
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Decryption key restricted to Admin role only • Secure Credential Vault
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white rounded-lg p-1 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Access Security Barrier for Non-Admins */}
          {!isAdmin ? (
            <div className="p-8 text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-white">Unauthorized Access: Admin Privileges Required</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Admin Vault Support: Decryption key is cryptographically restricted to the <code>admin</code> role.
                  Your current role (<code>{currentUserRole}</code>) does not possess permission to decrypt <code>raw_password_vault</code> credentials.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {/* Security Banner */}
              <div className="rounded-xl bg-amber-950/40 border border-amber-500/30 p-3.5 flex items-start gap-3">
                <Shield className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/90 leading-relaxed">
                  <strong>Admin Vault Active:</strong> As an authenticated administrator, you have permission to decrypt and view plaintext passwords stored in the <code>raw_password_vault</code>. All access attempts are logged.
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search staff ID, name, role..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/90 pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
                <div className="text-xs text-slate-400 self-end sm:self-center">
                  Total Vault Accounts: <strong className="text-white">{filteredUsers.length}</strong>
                </div>
              </div>

              {/* User Accounts Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 max-h-[50vh] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-800/80 text-slate-300 font-semibold text-2xs uppercase tracking-wider sticky top-0 z-10 border-b border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Staff ID &amp; Name</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Area &amp; Shift</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Password Hash</th>
                      <th className="py-2.5 px-3">Raw Vault Password</th>
                      <th className="py-2.5 px-3 text-right">Account Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-slate-300 font-mono">
                    {filteredUsers.map((user) => {
                      const isRevealed = !!revealedIds[user.id];
                      const vaultResult = decryptVaultPassword(user, currentUserRole);
                      const rawPassword = vaultResult.password || '••••••••';
                      const userStatus = user.status || (user.is_approved === false ? 'PENDING_APPROVAL' : 'ACTIVE');

                      return (
                        <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                          {/* Staff ID & Name */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-white text-xs">{user.full_name || user.name}</div>
                            <div className="text-2xs text-amber-400 font-semibold tracking-wider">{user.staff_id}</div>
                          </td>

                          {/* Role */}
                          <td className="py-3 px-3 font-sans">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${
                                user.role === 'admin'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : user.role === 'manager'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : user.role === 'supervisor'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {user.role}
                            </span>
                          </td>

                          {/* Area & Shift */}
                          <td className="py-3 px-3 font-sans text-2xs">
                            <div className="text-slate-200 font-medium">{user.assigned_area || 'General Ward'}</div>
                            <div className="text-slate-400">
                              Shift: <span className="text-cyan-400 font-mono font-semibold">{user.assigned_shift || '7-3'}</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 font-sans">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-2xs font-semibold ${
                                userStatus === 'ACTIVE'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : userStatus === 'PENDING_APPROVAL'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {userStatus}
                            </span>
                          </td>

                          {/* Password Hash */}
                          <td className="py-3 px-3 text-2xs text-slate-400">
                            <span
                              className="block max-w-[120px] truncate bg-slate-950/80 px-2 py-1 rounded border border-slate-800 text-slate-400"
                              title={user.password_hash || 'No hash recorded'}
                            >
                              {user.password_hash ? `${user.password_hash.substring(0, 18)}...` : 'N/A'}
                            </span>
                          </td>

                          {/* Raw Vault Password */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-xs text-amber-300 font-bold min-w-[90px] text-center">
                                {isRevealed ? rawPassword : '••••••••'}
                              </span>

                              <button
                                type="button"
                                onClick={() => toggleReveal(user.id)}
                                title={isRevealed ? 'Hide Password' : 'Decrypt & View Password'}
                                className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                              >
                                {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>

                              {isRevealed && (
                                <button
                                  type="button"
                                  onClick={() => copyPassword(user.id, rawPassword)}
                                  title="Copy Plain Password"
                                  className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                                >
                                  {copiedId === user.id ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Account Control */}
                          <td className="py-3 px-3 text-right font-sans">
                            {user.role !== 'admin' && onUpdateUserStatus && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateUserStatus(
                                    user.id,
                                    userStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
                                  )
                                }
                                className={`text-2xs font-semibold px-2.5 py-1 rounded transition-colors ${
                                  userStatus === 'ACTIVE'
                                    ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30'
                                    : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                                }`}
                              >
                                {userStatus === 'ACTIVE' ? 'Disable Account' : 'Activate Account'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Model Description Footnote */}
              <div className="bg-slate-800/40 rounded-lg p-3 text-2xs text-slate-400 flex items-center justify-between">
                <span>
                  Schema: <code>User(staff_id, full_name, role, assigned_area, assigned_shift, password_hash, raw_password_vault, status)</code>
                </span>
                <span className="text-amber-400 font-semibold">Security: AES / Role-Guarded Vault</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="bg-[#1E293B] px-6 py-3 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
            <span>Admin Vault Key: Active Session</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-700 text-white font-semibold hover:bg-slate-600 transition-colors"
            >
              Close Vault
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
