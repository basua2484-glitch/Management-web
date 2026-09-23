import React, { useState, useMemo } from 'react';
import {
  Users,
  KeyRound,
  Shield,
  Eye,
  EyeOff,
  Copy,
  Check,
  Search,
  Lock,
  AlertCircle,
  CheckCircle,
  UserPlus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { AppUser, UserRole, UserStatus, DutyType } from '../types';
import { decryptVaultPassword } from '../services/vaultService';
import { getStoredUsers, getStoredCurrentUser } from '../data/mockHousekeepingData';

export interface StaffVaultProps {
  users?: AppUser[];
  currentUser?: {
    id?: string | number;
    staff_id?: string;
    username?: string;
    role?: string;
    [key: string]: any;
  } | null;
  currentUserRole?: UserRole;
  currentUserId?: string | number;
  currentStaffId?: string;
  onUpdateUser?: (user: AppUser) => void;
  onDeleteUser?: (userId: number | string) => void;
  onOpenAddUser?: () => void;
  onOpenVaultModal?: () => void;
}

export const StaffVault: React.FC<StaffVaultProps> = ({
  users: propUsers,
  currentUser: propCurrentUser,
  currentUserRole = 'admin',
  currentUserId,
  currentStaffId,
  onUpdateUser,
  onDeleteUser,
  onOpenAddUser,
  onOpenVaultModal,
}) => {
  // 1. Retrieve active user session from state/localStorage (e.g., currentUser)
  const currentUser: { id?: string; [key: string]: any } | null = useMemo(() => {
    if (propCurrentUser) {
      const staffCode = String(propCurrentUser.staff_id || propCurrentUser.username || propCurrentUser.id || '');
      return {
        ...propCurrentUser,
        id: staffCode.includes('-') ? staffCode : (propCurrentUser.staff_id || propCurrentUser.username || String(propCurrentUser.id || '')),
      };
    }
    const sessionUser = getStoredCurrentUser();
    if (sessionUser) {
      const staffCode = String(sessionUser.staff_id || sessionUser.username || sessionUser.id || '');
      return {
        ...sessionUser,
        id: staffCode.includes('-') ? staffCode : (sessionUser.staff_id || sessionUser.username || String(sessionUser.id || '')),
      };
    }
    if (typeof localStorage !== 'undefined') {
      const curUserStr = localStorage.getItem('hk_current_user_v2') || localStorage.getItem('currentUser');
      if (curUserStr) {
        try {
          const parsed = JSON.parse(curUserStr);
          const staffCode = String(parsed.staff_id || parsed.username || parsed.id || '');
          return {
            ...parsed,
            id: staffCode.includes('-') ? staffCode : (parsed.staff_id || parsed.username || String(parsed.id || '')),
          };
        } catch {}
      }
      const userId = localStorage.getItem('userId');
      if (userId) {
        return { id: String(userId), staff_id: String(userId) };
      }
    }
    return null;
  }, [propCurrentUser]);

  // Extract active tenant prefix:
  const activeTenantPrefix = currentUser?.id?.split('-')[0] || '';

  // Retrieve raw allUsers list (from props or localStorage)
  const allUsers: Array<any> = useMemo(() => {
    const rawList = propUsers && propUsers.length > 0 ? propUsers : getStoredUsers();
    // Ensure user.id starts with tenant prefix if it contains staff_id
    return rawList.map((u: any) => {
      const staffCode = String(u.staff_id || u.username || u.id || '');
      const formattedId = staffCode.includes('-')
        ? staffCode
        : (u.staff_id || u.username || String(u.id || ''));
      return {
        ...u,
        id: formattedId,
        _originalId: u.id,
      };
    });
  }, [propUsers]);

  // 2. Filter User List Before Rendering:
  // Do NOT pass raw 'users' or 'localStorage' array directly to the table.
  // Filter strictly by matching tenant prefix:
  const tenantScopedUsers = useMemo(() => {
    if (!activeTenantPrefix) {
      return allUsers;
    }
    return allUsers.filter(
      (user) => user.id && user.id.startsWith(activeTenantPrefix)
    );
  }, [allUsers, activeTenantPrefix]);

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserStatus>('ALL');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isAdmin = (currentUserRole || currentUser?.role || '').toLowerCase() === 'admin';

  const toggleReveal = (userId: string) => {
    if (!isAdmin) return;
    setRevealedPasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const copyPassword = (userId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(userId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter scoped users by search and filter criteria
  const displayedUsers = useMemo(() => {
    return tenantScopedUsers.filter((u) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (u.id && String(u.id).toLowerCase().includes(q)) ||
        (u.staff_id && u.staff_id.toLowerCase().includes(q)) ||
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.fixed_department && u.fixed_department.toLowerCase().includes(q)) ||
        (u.assigned_area && u.assigned_area.toLowerCase().includes(q));

      const matchesRole = roleFilter === 'ALL' || (u.role && u.role.toLowerCase() === roleFilter.toLowerCase());
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.status === 'ACTIVE') ||
        (statusFilter === 'DISABLED' && u.status === 'DISABLED');

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [tenantScopedUsers, searchTerm, roleFilter, statusFilter]);

  // 3. Render Only Tenant-Scoped Data:
  // Update 'TOTAL USERS' and 'ACTIVE ACCOUNTS' summary cards to count ONLY 'tenantScopedUsers.length'
  const totalUsersCount = tenantScopedUsers.length;
  const activeAccountsCount = tenantScopedUsers.filter(
    (u) => u.status === 'ACTIVE' || (u.is_approved !== false && u.status !== 'DISABLED')
  ).length;

  return (
    <div className="space-y-4 text-slate-800 font-sans" id="staff-vault-container">
      {/* Top Header & Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E3A8A] text-white font-bold">
              <KeyRound className="h-4.5 w-4.5 text-amber-400" />
            </span>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              Staff Vault Table
            </h3>
            {activeTenantPrefix && (
              <span
                id="staff-vault-tenant-badge"
                className="rounded-md bg-blue-100 border border-blue-200 px-2 py-0.5 text-2xs font-extrabold text-[#1E3A8A] uppercase tracking-wider"
              >
                Tenant: {activeTenantPrefix}
              </span>
            )}
            <span className="rounded-md bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-2xs font-bold text-emerald-800">
              Strict Tenant Isolation
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tenant-scoped credential storage, encrypted access management, and role-guarded password decryption.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenAddUser && (
            <button
              type="button"
              id="btn-staff-vault-add-user"
              onClick={onOpenAddUser}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-[#152e6f] text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>+ Add User / Staff</span>
            </button>
          )}

          {onOpenVaultModal && (
            <button
              type="button"
              id="btn-staff-vault-open-modal"
              onClick={onOpenVaultModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Vault Terminal</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Summary Cards: 'TOTAL USERS' and 'ACTIVE ACCOUNTS' count ONLY 'tenantScopedUsers.length' */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" id="staff-vault-summary-cards">
        <div
          className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs border-l-4 border-l-[#1E3A8A]"
          id="summary-card-total-users"
        >
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 block">
            TOTAL USERS
          </span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5" id="val-total-users">
            {totalUsersCount}
          </div>
        </div>

        <div
          className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs border-l-4 border-l-emerald-600"
          id="summary-card-active-accounts"
        >
          <span className="text-2xs font-bold uppercase tracking-wider text-emerald-700 block">
            ACTIVE ACCOUNTS
          </span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-700 mt-0.5" id="val-active-accounts">
            {activeAccountsCount}
          </div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs border-l-4 border-l-purple-600">
          <span className="text-2xs font-bold uppercase tracking-wider text-purple-700 block">
            FIXED STAFF
          </span>
          <div className="text-xl sm:text-2xl font-bold text-purple-700 mt-0.5">
            {tenantScopedUsers.filter((u) => u.duty_type === 'FIXED' || !u.duty_type).length}
          </div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs border-l-4 border-l-amber-500">
          <span className="text-2xs font-bold uppercase tracking-wider text-amber-700 block">
            RELIEVERS
          </span>
          <div className="text-xl sm:text-2xl font-bold text-amber-700 mt-0.5">
            {
              tenantScopedUsers.filter(
                (u) =>
                  u.duty_type === 'PERMANENT_RELIEVER' ||
                  u.duty_type === 'TEMP_RELIEVER' ||
                  u.is_temp_reliever
              ).length
            }
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Staff ID, Name, Department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#1E3A8A] focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="supervisor">Supervisor</option>
            <option value="staff">Staff</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DISABLED">DISABLED</option>
          </select>
        </div>
      </div>

      {/* Staff Vault Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700" id="staff-vault-table">
            <thead className="bg-slate-50 text-2xs uppercase tracking-wider font-extrabold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">Staff ID</th>
                <th className="py-3 px-3.5">Personnel Name</th>
                <th className="py-3 px-3.5">Role</th>
                <th className="py-3 px-3.5">Department</th>
                <th className="py-3 px-3.5">Shift</th>
                <th className="py-3 px-3.5 text-amber-900 bg-amber-50/50">
                  <div className="flex items-center gap-1">
                    <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                    <span>Password Vault</span>
                  </div>
                </th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <KeyRound className="h-8 w-8 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-600">
                        {searchTerm
                          ? 'No staff accounts match your search filter.'
                          : `The Staff Vault database currently has 0 registered accounts for tenant "${activeTenantPrefix || 'ALL'}".`}
                      </p>
                      {onOpenAddUser && (
                        <button
                          type="button"
                          onClick={onOpenAddUser}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E3A8A] text-white text-xs font-bold hover:bg-[#152e6f]"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>+ Add User / Staff</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                /* 3. Map over 'tenantScopedUsers' (via displayedUsers) in the table rows */
                displayedUsers.map((user) => {
                  const uidStr = String(user.id || user.staff_id);
                  const isRevealed = !!revealedPasswords[uidStr];
                  const vaultResult = decryptVaultPassword(user as any, currentUserRole);
                  const rawPass = vaultResult.password || '••••••••';
                  const roleStr = (user.role || 'staff').toUpperCase();

                  return (
                    <tr
                      key={uidStr}
                      className="hover:bg-slate-50/70 transition-colors"
                      id={`staff-vault-row-${uidStr}`}
                    >
                      {/* Staff ID */}
                      <td className="py-3 px-3.5 font-bold font-mono text-slate-900">
                        {user.staff_id || user.username || user.id}
                      </td>

                      {/* Personnel Name */}
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-slate-900">
                          {user.full_name || user.name || user.username}
                        </div>
                        {user.username && user.username !== (user.staff_id || user.id) && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            @{user.username}
                          </div>
                        )}
                      </td>

                      {/* Role */}
                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-extrabold tracking-wide ${
                            roleStr === 'ADMIN'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : roleStr === 'MANAGER'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : roleStr === 'SUPERVISOR'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {roleStr}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-3.5 text-slate-700">
                        {user.fixed_department || user.assigned_area || user.department || 'Hospital Wide'}
                      </td>

                      {/* Shift */}
                      <td className="py-3 px-3.5 text-slate-700 font-mono">
                        {user.assigned_shift || '7-3'}
                      </td>

                      {/* Password Vault Column */}
                      <td className="py-3 px-3.5 bg-amber-50/40 border-x border-amber-100/60">
                        {!isAdmin ? (
                          <div
                            className="flex items-center gap-1 text-slate-400 text-2xs italic"
                            title="Decryption key restricted to Admin role"
                          >
                            <Lock className="h-3 w-3 text-slate-400" />
                            <span>Encrypted Vault</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-2xs px-1.5 py-0.5 rounded-sm bg-amber-100/80 text-amber-900 font-bold max-w-[90px] truncate select-all">
                              {isRevealed ? rawPass : '••••••••'}
                            </span>

                            <button
                              type="button"
                              onClick={() => toggleReveal(uidStr)}
                              className="p-1 text-amber-700 hover:text-amber-900 rounded-sm hover:bg-amber-200/50 cursor-pointer transition-colors"
                              title={isRevealed ? 'Hide Password' : 'Reveal Raw Password (Admin Vault)'}
                              aria-label={isRevealed ? 'Hide Password' : 'Reveal Raw Password'}
                            >
                              {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>

                            {isRevealed && rawPass && rawPass !== '••••••••' && (
                              <button
                                type="button"
                                onClick={() => copyPassword(uidStr, rawPass)}
                                className="p-1 text-amber-700 hover:text-amber-900 rounded-sm hover:bg-amber-200/50 cursor-pointer transition-colors"
                                title="Copy Plaintext Password"
                                aria-label="Copy Password"
                              >
                                {copiedId === uidStr ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-bold ${
                            user.status === 'ACTIVE' || (user.is_approved !== false && user.status !== 'DISABLED')
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {user.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right space-x-1">
                        {onUpdateUser && (
                          <button
                            type="button"
                            onClick={() => {
                              const nextStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
                              const originalId = user._originalId !== undefined ? user._originalId : user.id;
                              onUpdateUser({
                                ...user,
                                id: originalId,
                                status: nextStatus,
                                is_approved: nextStatus === 'ACTIVE',
                              } as any);
                            }}
                            className="px-2 py-1 rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-700 text-2xs font-bold cursor-pointer transition-colors"
                          >
                            {user.status === 'ACTIVE' ? 'Disable' : 'Activate'}
                          </button>
                        )}

                        {onDeleteUser && (
                          <button
                            type="button"
                            onClick={() => onDeleteUser(user._originalId !== undefined ? user._originalId : user.id)}
                            className="p-1 text-rose-600 hover:text-rose-800 rounded-sm hover:bg-rose-50 cursor-pointer transition-colors"
                            title="Delete user"
                            aria-label="Delete user"
                          >
                            <Trash2 className="h-3.5 w-3.5 inline" />
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
      </div>
    </div>
  );
};

export default StaffVault;
