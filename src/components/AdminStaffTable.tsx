import React, { useState } from 'react';
import {
  Users,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Search,
  Filter,
  Shield,
  ShieldAlert,
  UserPlus,
  Edit2,
  Trash2,
  RefreshCw,
  Clock,
  Building,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRightLeft,
  Calendar,
  Lock,
  User,
} from 'lucide-react';
import type { AppUser, UserRole, DutyType, ShiftName, UserStatus } from '../types';
import { decryptVaultPassword, createPasswordHash } from '../services/vaultService';
import { DUTY_AREAS } from '../data/mockHousekeepingData';

interface AdminStaffTableProps {
  users: AppUser[];
  currentUserRole?: UserRole;
  onUpdateUser: (updatedUser: AppUser) => void;
  onDeleteUser?: (userId: number) => void;
  onOpenAddUser?: () => void;
  onOpenVaultModal?: () => void;
  onOpenPendingApprovals?: () => void;
  pendingCount?: number;
  onOpenProfileModal?: (staffId: string) => void;
}

export const AdminStaffTable: React.FC<AdminStaffTableProps> = ({
  users,
  currentUserRole = 'admin',
  onUpdateUser,
  onDeleteUser,
  onOpenAddUser,
  onOpenVaultModal,
  onOpenPendingApprovals,
  pendingCount = 0,
  onOpenProfileModal,
}) => {
  const isAdmin = currentUserRole === 'admin';

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [dutyTypeFilter, setDutyTypeFilter] = useState<'ALL' | DutyType>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserStatus>('ALL');

  // Vault reveal state: record of userId -> boolean
  const [revealedPasswords, setRevealedPasswords] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Reset Password Modal State
  const [resettingUser, setResettingUser] = useState<AppUser | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // Toggle eye reveal for a single staff row
  const handleToggleReveal = (userId: number) => {
    if (!isAdmin) return;
    setRevealedPasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Copy decrypted password
  const handleCopyPassword = (userId: number, plaintext: string) => {
    navigator.clipboard.writeText(plaintext);
    setCopiedId(userId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open reset password modal
  const handleOpenReset = (user: AppUser) => {
    setResettingUser(user);
    setNewPasswordInput('');
    setResetSuccessMsg(null);
  };

  const handleGenerateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let rand = 'Pass@';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPasswordInput(rand);
  };

  const handleSaveResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !newPasswordInput.trim()) return;

    const trimmed = newPasswordInput.trim();
    const updated: AppUser = {
      ...resettingUser,
      password: trimmed,
      raw_password_vault: trimmed,
      password_hash: createPasswordHash(trimmed),
    };

    onUpdateUser(updated);
    setResetSuccessMsg(`Password successfully reset to: ${trimmed}`);
    setTimeout(() => {
      setResettingUser(null);
      setResetSuccessMsg(null);
    }, 1800);
  };

  // Inline Quick Updates for Duty Type, Shift, Department, and Status
  const handleInlineDutyTypeChange = (user: AppUser, newDutyType: DutyType) => {
    const isTemp = newDutyType === 'TEMP_RELIEVER';
    const updated: AppUser = {
      ...user,
      duty_type: newDutyType,
      is_temp_reliever: isTemp,
      temp_department: isTemp ? (user.temp_department || 'ICU / Critical Care') : null,
      assigned_area: isTemp ? (user.temp_department || 'ICU / Critical Care') : (user.fixed_department || user.assigned_area || 'General Wards'),
    };
    onUpdateUser(updated);
  };

  const handleInlineDepartmentChange = (user: AppUser, newDept: string) => {
    const updated: AppUser = {
      ...user,
      fixed_department: newDept,
      assigned_area: user.is_temp_reliever && user.temp_department ? user.temp_department : newDept,
      department: newDept,
    };
    onUpdateUser(updated);
  };

  const handleInlineShiftChange = (user: AppUser, newShift: string) => {
    const shiftNamed = newShift === '11-7' ? 'Night' : newShift === '3-11' ? 'Evening' : 'Morning';
    const updated: AppUser = {
      ...user,
      assigned_shift: newShift,
      shift: shiftNamed,
    };
    onUpdateUser(updated);
  };

  const handleInlineStatusToggle = (user: AppUser) => {
    const nextStatus: UserStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    const updated: AppUser = {
      ...user,
      status: nextStatus,
      is_approved: nextStatus === 'ACTIVE',
    };
    onUpdateUser(updated);
  };

  // Filtered staff users
  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (u.staff_id && u.staff_id.toLowerCase().includes(q)) ||
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.fixed_department && u.fixed_department.toLowerCase().includes(q)) ||
      (u.assigned_area && u.assigned_area.toLowerCase().includes(q));

    const matchesDutyType = dutyTypeFilter === 'ALL' || u.duty_type === dutyTypeFilter;
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && u.status === 'ACTIVE') ||
      (statusFilter === 'DISABLED' && u.status === 'DISABLED') ||
      (statusFilter === 'PENDING_APPROVAL' && (u.status === 'PENDING_APPROVAL' || u.is_approved === false));

    return matchesSearch && matchesDutyType && matchesRole && matchesStatus;
  });

  // Metric counts
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.status === 'ACTIVE' || (u.is_approved !== false && u.status !== 'DISABLED')).length;
  const fixedDutyCount = users.filter((u) => u.duty_type === 'FIXED' || !u.duty_type).length;
  const relieverCount = users.filter((u) => u.duty_type === 'PERMANENT_RELIEVER' || u.duty_type === 'TEMP_RELIEVER' || u.is_temp_reliever).length;

  return (
    <div className="space-y-4 text-slate-800 font-sans" id="admin-staff-table-section">
      {/* Top Header & Fast Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E3A8A] text-white font-bold">
              <Users className="h-4.5 w-4.5" />
            </span>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              Admin Staff Directory &amp; Duty Management
            </h3>
            <span className="rounded-md bg-blue-100 border border-blue-200 px-2 py-0.5 text-2xs font-extrabold text-[#1E3A8A]">
              Full CRUD Admin Mode
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin Vault credentials, inline duty allocation (Fixed / Relievers), and instant password control.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenPendingApprovals && (
            <button
              type="button"
              id="btn-admin-table-pending"
              onClick={onOpenPendingApprovals}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pendingCount > 0
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs animate-pulse'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Pending Approvals</span>
              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white text-amber-800 text-[10px] font-extrabold">
                  {pendingCount}
                </span>
              )}
            </button>
          )}

          {onOpenVaultModal && (
            <button
              type="button"
              id="btn-admin-open-vault-modal"
              onClick={onOpenVaultModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/10 border border-amber-500/30 text-amber-800 hover:bg-amber-500/20 text-xs font-bold transition-colors"
            >
              <KeyRound className="h-3.5 w-3.5 text-amber-600" />
              <span>Open Vault Terminal</span>
            </button>
          )}

          {onOpenAddUser && (
            <button
              type="button"
              id="btn-admin-table-add-user"
              onClick={onOpenAddUser}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>+ Add User / Staff</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs border-l-4 border-l-[#1E3A8A]">
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">Total Users</span>
          <div className="text-xl font-bold text-slate-900 mt-0.5">{totalCount}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs border-l-4 border-l-emerald-600">
          <span className="text-2xs font-bold uppercase tracking-wider text-emerald-700">Active Accounts</span>
          <div className="text-xl font-bold text-emerald-700 mt-0.5">{activeCount}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs border-l-4 border-l-purple-600">
          <span className="text-2xs font-bold uppercase tracking-wider text-purple-700">Fixed Staff</span>
          <div className="text-xl font-bold text-purple-700 mt-0.5">{fixedDutyCount}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs border-l-4 border-l-amber-500">
          <span className="text-2xs font-bold uppercase tracking-wider text-amber-700">Relievers (Perm/Temp)</span>
          <div className="text-xl font-bold text-amber-700 mt-0.5">{relieverCount}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Search */}
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

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Duty Type Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
            <ArrowRightLeft className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={dutyTypeFilter}
              onChange={(e) => setDutyTypeFilter(e.target.value as any)}
              className="bg-transparent text-xs text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Duty Types</option>
              <option value="FIXED">FIXED Duty</option>
              <option value="PERMANENT_RELIEVER">PERMANENT_RELIEVER</option>
              <option value="TEMP_RELIEVER">TEMP_RELIEVER</option>
            </select>
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
            <Shield className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-transparent text-xs text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="supervisor">Supervisor</option>
              <option value="staff">Staff</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-xs text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="DISABLED">DISABLED</option>
              <option value="PENDING_APPROVAL">PENDING</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#1E293B] text-white uppercase text-2xs font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Staff ID &amp; User</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Duty Type</th>
                <th className="py-3 px-3">Assigned Area / Dept</th>
                <th className="py-3 px-3">Shift</th>
                <th className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                    <span>Password Vault</span>
                  </div>
                </th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No users matching criteria found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isRevealed = Boolean(revealedPasswords[user.id]);
                  const vaultResult = decryptVaultPassword(user, currentUserRole);
                  const rawPlaintext = vaultResult.password || user.raw_password_vault || user.password || '••••••••';
                  const userStatus = user.status || (user.is_approved === false ? 'PENDING_APPROVAL' : 'ACTIVE');
                  const currentDutyType: DutyType = user.duty_type || 'FIXED';
                  const effectiveArea =
                    user.is_temp_reliever && user.temp_department
                      ? user.temp_department
                      : user.fixed_department || user.assigned_area || 'General Wards';

                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      {/* Staff ID & Name */}
                      <td className="py-3 px-4 font-sans">
                        <button
                          type="button"
                          onClick={() => onOpenProfileModal?.(user.staff_id || String(user.id))}
                          className="font-bold text-slate-900 text-xs hover:text-[#1E3A8A] text-left transition-colors cursor-pointer bg-transparent border-0 p-0 hover:underline underline-offset-2 block"
                          title="Open employee profile modal"
                        >
                          {user.full_name || user.name}
                        </button>
                        <div className="flex items-center gap-2 mt-0.5">
                          <button
                            type="button"
                            onClick={() => onOpenProfileModal?.(user.staff_id || String(user.id))}
                            className="font-mono text-2xs font-bold text-[#1E3A8A] bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                            title="Inspect profile & shift metrics"
                          >
                            {user.staff_id || `USER-${user.id}`}
                          </button>
                          {user.username && user.username !== user.staff_id && (
                            <span className="text-2xs text-slate-400 font-mono">@{user.username}</span>
                          )}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-2xs font-bold uppercase tracking-wider ${
                            user.role === 'admin'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : user.role === 'manager'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : user.role === 'supervisor'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>

                      {/* Duty Type (Editable inline by Admin) */}
                      <td className="py-3 px-3">
                        <select
                          value={currentDutyType}
                          onChange={(e) => handleInlineDutyTypeChange(user, e.target.value as DutyType)}
                          disabled={!isAdmin}
                          className={`rounded-md border text-2xs font-bold py-1 px-1.5 focus:outline-hidden cursor-pointer ${
                            currentDutyType === 'FIXED'
                              ? 'bg-slate-50 border-slate-300 text-slate-700'
                              : currentDutyType === 'PERMANENT_RELIEVER'
                              ? 'bg-purple-50 border-purple-300 text-purple-800'
                              : 'bg-amber-50 border-amber-300 text-amber-800'
                          }`}
                        >
                          <option value="FIXED">FIXED</option>
                          <option value="PERMANENT_RELIEVER">PERM RELIEVER</option>
                          <option value="TEMP_RELIEVER">TEMP RELIEVER</option>
                        </select>
                      </td>

                      {/* Assigned Department / Area */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 max-w-[200px]">
                          <select
                            value={effectiveArea}
                            onChange={(e) => handleInlineDepartmentChange(user, e.target.value)}
                            disabled={!isAdmin}
                            className="w-full truncate rounded-md border border-slate-200 bg-white py-1 px-1.5 text-2xs text-slate-800 font-medium focus:border-[#1E3A8A] focus:outline-hidden"
                          >
                            {DUTY_AREAS.map((area) => (
                              <option key={area} value={area}>
                                {area}
                              </option>
                            ))}
                          </select>
                        </div>
                        {user.is_temp_reliever && (
                          <span className="inline-block mt-0.5 text-[10px] text-amber-600 font-bold">
                            • Temp Override Active
                          </span>
                        )}
                      </td>

                      {/* Shift */}
                      <td className="py-3 px-3">
                        <select
                          value={user.assigned_shift || '7-3'}
                          onChange={(e) => handleInlineShiftChange(user, e.target.value)}
                          disabled={!isAdmin}
                          className="rounded-md border border-slate-200 bg-white py-1 px-1.5 font-mono text-2xs font-bold text-slate-800 focus:border-[#1E3A8A] focus:outline-hidden"
                        >
                          <option value="7-3">7-3 (Morning)</option>
                          <option value="3-11">3-11 (Evening)</option>
                          <option value="11-7">11-7 (Night)</option>
                        </select>
                      </td>

                      {/* Password Vault (Eye Icon toggle, Copy, Reset) */}
                      <td className="py-3 px-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-block px-2 py-1 rounded border text-xs tracking-wider ${
                              isRevealed && isAdmin
                                ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                                : 'bg-slate-100 border-slate-200 text-slate-500 font-normal'
                            }`}
                          >
                            {isRevealed && isAdmin ? rawPlaintext : '••••••••'}
                          </span>

                          {/* Eye Toggle Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleReveal(user.id)}
                            title={isRevealed ? 'Hide Password' : 'Reveal Raw Password (Admin Vault)'}
                            className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors border-0 bg-transparent cursor-pointer"
                          >
                            {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>

                          {/* Copy Button */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleCopyPassword(user.id, rawPlaintext)}
                              title="Copy plaintext password"
                              className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors border-0 bg-transparent cursor-pointer"
                            >
                              {copiedId === user.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}

                          {/* Reset Password Button */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleOpenReset(user)}
                              title="Reset Password"
                              className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors border-0 bg-transparent cursor-pointer"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleInlineStatusToggle(user)}
                          disabled={!isAdmin}
                          title="Click to toggle status"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-extrabold cursor-pointer border transition-colors ${
                            userStatus === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                              : userStatus === 'DISABLED'
                              ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                              : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                          }`}
                        >
                          {userStatus === 'ACTIVE' ? (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              <span>ACTIVE</span>
                            </>
                          ) : userStatus === 'DISABLED' ? (
                            <>
                              <XCircle className="h-3 w-3" />
                              <span>DISABLED</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3 w-3" />
                              <span>PENDING</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenProfileModal?.(user.staff_id || String(user.id))}
                            title="View Employee Profile & Duty Modal"
                            className="p-1.5 rounded-md text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <User className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingUser(user)}
                            title="Edit full user details"
                            className="p-1.5 rounded-md text-slate-500 hover:text-[#1E3A8A] hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {onDeleteUser && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to remove user "${user.full_name || user.name}"?`)) {
                                  onDeleteUser(user.id);
                                }
                              }}
                              title="Delete user account"
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
          <span>Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> staff accounts</span>
          <span className="text-2xs text-slate-400">
            Click Eye icon to decrypt • Duty Type dropdown auto-saves to StaffDutyProfile
          </span>
        </div>
      </div>

      {/* Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden text-left">
            <div className="bg-[#1E293B] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-400" />
                <div>
                  <h4 className="font-bold text-sm text-white">Reset Staff Password</h4>
                  <p className="text-2xs text-slate-400">
                    {resettingUser.full_name || resettingUser.name} ({resettingUser.staff_id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResettingUser(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveResetPassword} className="p-5 space-y-4">
              {resetSuccessMsg ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{resetSuccessMsg}</span>
                </div>
              ) : (
                <>
                  <div className="text-xs text-slate-600">
                    Update the user's password in both the <code>raw_password_vault</code> and encrypted <code>password_hash</code>.
                  </div>

                  <div>
                    <label className="block text-2xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      New Raw Password *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        placeholder="Enter new password"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-800 focus:border-[#1E3A8A] focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateRandomPassword}
                        className="px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-2xs font-bold"
                      >
                        Auto-Gen
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setResettingUser(null)}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold shadow-xs"
                    >
                      Save Password
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Edit User Details Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden text-left">
            <div className="bg-[#1E3A8A] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5" />
                <div>
                  <h4 className="font-bold text-sm text-white">Edit Staff &amp; Duty Profile</h4>
                  <p className="text-2xs text-blue-200">
                    Staff ID: {editingUser.staff_id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-blue-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingUser.full_name || editingUser.name}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, full_name: e.target.value, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
                  >
                    <option value="staff">Staff</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Duty Type</label>
                  <select
                    value={editingUser.duty_type || 'FIXED'}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        duty_type: e.target.value as DutyType,
                        is_temp_reliever: e.target.value === 'TEMP_RELIEVER',
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
                  >
                    <option value="FIXED">FIXED</option>
                    <option value="PERMANENT_RELIEVER">PERMANENT_RELIEVER</option>
                    <option value="TEMP_RELIEVER">TEMP_RELIEVER</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Department</label>
                  <select
                    value={editingUser.fixed_department || editingUser.assigned_area || 'General Wards'}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        fixed_department: e.target.value,
                        assigned_area: e.target.value,
                        department: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
                  >
                    {DUTY_AREAS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Shift</label>
                  <select
                    value={editingUser.assigned_shift || '7-3'}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        assigned_shift: e.target.value,
                        shift: e.target.value === '11-7' ? 'Night' : e.target.value === '3-11' ? 'Evening' : 'Morning',
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
                  >
                    <option value="7-3">7-3 (Morning)</option>
                    <option value="3-11">3-11 (Evening)</option>
                    <option value="11-7">11-7 (Night)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Account Status</label>
                <select
                  value={editingUser.status || 'ACTIVE'}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      status: e.target.value as UserStatus,
                      is_approved: e.target.value === 'ACTIVE',
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DISABLED">DISABLED</option>
                  <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateUser(editingUser);
                    setEditingUser(null);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
