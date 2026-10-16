import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Check,
  RotateCcw,
  Save,
  Search,
  User,
  SlidersHorizontal,
  Info,
  CheckCircle2,
  Lock,
  Sparkles,
} from 'lucide-react';
import {
  SYSTEM_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  type PermissionAction,
  type RoleName,
  type RolePermissionsMatrix,
  type UserCustomPermissionsMap,
} from '../types/permissionsAndPosts';
import {
  getStoredRolePermissions,
  getStoredUserCustomPermissions,
  saveRolePermissionsMatrix,
  saveUserCustomPermissions,
  resetPermissionsToDefaults,
} from '../utils/rbacPermissions';
import type { AppUser, StaffUser } from '../types';

interface AccessControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: AppUser | StaffUser | null;
  allStaffUsers?: Array<StaffUser | AppUser | any>;
  onFlash?: (msg: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export const AccessControlModal: React.FC<AccessControlModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allStaffUsers = [],
  onFlash,
}) => {
  const [activeTab, setActiveTab] = useState<'ROLE_MATRIX' | 'USER_OVERRIDES' | 'SECURITY_AUDIT'>('ROLE_MATRIX');
  const [matrix, setMatrix] = useState<RolePermissionsMatrix>(getStoredRolePermissions());
  const [userCustomMap, setUserCustomMap] = useState<UserCustomPermissionsMap>(getStoredUserCustomPermissions());
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Strict Master Admin RBAC Check
  const userRole = (currentUser?.role || '').toLowerCase();
  const staffId = ((currentUser as any)?.staff_id || '').toUpperCase();
  const isMasterAdmin = userRole === 'admin' || userRole === 'master_admin' || staffId === 'BASU-ADM-001';

  // Load latest matrix on open
  useEffect(() => {
    if (isOpen) {
      setMatrix(getStoredRolePermissions());
      setUserCustomMap(getStoredUserCustomPermissions());
      setHasUnsavedChanges(false);
      setSaveSuccessMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // If not master admin, display security lock out
  if (!isMasterAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-300 p-6 text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Restricted Security Boundary</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            The Access Control & Dynamic Permission Matrix is strictly reserved for{' '}
            <strong className="text-slate-900">MASTER_ADMIN (BASU-ADM-001)</strong>. Your role ({userRole.toUpperCase()}) does not possess authorization to view or alter system security policies.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors"
          >
            Acknowledge & Exit
          </button>
        </div>
      </div>
    );
  }

  // Toggle role permission
  const handleToggleRolePermission = (role: RoleName, action: PermissionAction) => {
    if (role === 'MASTER_ADMIN') {
      // Master Admin is immutable for system security
      return;
    }

    setMatrix((prev) => {
      const next = {
        ...prev,
        [role]: {
          ...prev[role],
          [action]: !prev[role][action],
        },
      };
      setHasUnsavedChanges(true);
      return next;
    });
  };

  // Toggle individual user override
  const handleToggleUserOverride = (action: PermissionAction) => {
    if (!selectedStaffId) return;

    setUserCustomMap((prev) => {
      const currentOverrides = prev[selectedStaffId] || {};
      const currentVal = currentOverrides[action];

      // If already true -> toggle false; if false -> remove override (revert to role default); if undefined -> set true
      let nextOverrides = { ...currentOverrides };
      if (currentVal === true) {
        nextOverrides[action] = false;
      } else if (currentVal === false) {
        delete nextOverrides[action];
      } else {
        nextOverrides[action] = true;
      }

      setHasUnsavedChanges(true);
      return {
        ...prev,
        [selectedStaffId]: nextOverrides,
      };
    });
  };

  // Save changes
  const handleSaveMatrix = async () => {
    setIsSaving(true);
    setSaveSuccessMsg('');
    try {
      await saveRolePermissionsMatrix(matrix, currentUser as any);
      if (selectedStaffId && userCustomMap[selectedStaffId]) {
        await saveUserCustomPermissions(selectedStaffId, userCustomMap[selectedStaffId], currentUser as any);
      }

      setHasUnsavedChanges(false);
      setSaveSuccessMsg('Permission rules successfully deployed & synced across all endpoints!');
      onFlash?.('Security Access Matrix updated and enforced globally.', 'success');

      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Failed to save matrix:', err);
      onFlash?.('Failed to save permission matrix: ' + (err.message || 'Error'), 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to Defaults
  const handleResetDefaults = async () => {
    if (confirm('Are you sure you want to revert all role permissions to the verified hospital baseline defaults?')) {
      await resetPermissionsToDefaults(currentUser as any);
      setMatrix(JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS)));
      setUserCustomMap({});
      setHasUnsavedChanges(false);
      setSaveSuccessMsg('Permissions reset to baseline defaults.');
      onFlash?.('Permissions reset to verified defaults.', 'info');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    }
  };

  // Categories list
  const categories = ['ALL', 'Staff & Directory', 'Duty & Scheduling', 'Attendance & GPS', 'Operations & Reports'];

  const filteredPermissions = SYSTEM_PERMISSIONS.filter((perm) => {
    if (categoryFilter !== 'ALL' && perm.category !== categoryFilter) return false;
    return true;
  });

  // Selected staff user for custom override
  const selectedUserObj = allStaffUsers.find(
    (u: any) => (u.staff_id || u.staffCode || String(u.id)) === selectedStaffId || String(u.id) === selectedStaffId
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-[#1E3A8A] to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Access Control & Dynamic Permission Matrix</h2>
                <span className="px-2 py-0.5 rounded-full text-3xs font-extrabold bg-emerald-400 text-emerald-950 uppercase tracking-wider font-mono">
                  Master Admin Exclusive
                </span>
              </div>
              <p className="text-2xs text-blue-200">
                Configure role capabilities, custom individual overrides, and enforce live security boundaries
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 justify-between items-center">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('ROLE_MATRIX')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ROLE_MATRIX'
                  ? 'border-[#1E3A8A] text-[#1E3A8A] bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Role Permissions Matrix</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('USER_OVERRIDES')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'USER_OVERRIDES'
                  ? 'border-[#1E3A8A] text-[#1E3A8A] bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>User Custom Overrides</span>
              {Object.keys(userCustomMap).length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-blue-100 text-[#1E3A8A] text-3xs font-bold">
                  {Object.keys(userCustomMap).length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('SECURITY_AUDIT')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'SECURITY_AUDIT'
                  ? 'border-[#1E3A8A] text-[#1E3A8A] bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Info className="h-3.5 w-3.5" />
              <span>Security Summary & Audit</span>
            </button>
          </div>

          {hasUnsavedChanges && (
            <span className="text-3xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 animate-pulse">
              ● Unsaved Changes Pending
            </span>
          )}
        </div>

        {/* Success Banner */}
        {saveSuccessMsg && (
          <div className="mx-6 mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{saveSuccessMsg}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* TAB 1: ROLE MATRIX */}
          {activeTab === 'ROLE_MATRIX' && (
            <div className="space-y-4">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 mr-1">
                    Category:
                  </span>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition-colors cursor-pointer ${
                        categoryFilter === cat
                          ? 'bg-[#1E3A8A] text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="text-3xs text-slate-400 flex items-center gap-1">
                  <Lock className="h-3 w-3 text-emerald-600" />
                  <span>Master Admin privileges are system-locked and immutable.</span>
                </div>
              </div>

              {/* Matrix Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/90 text-slate-700 text-3xs uppercase font-extrabold tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4 w-2/5">System Feature / Action</th>
                      <th className="py-3 px-3 text-center text-[#1E3A8A] bg-blue-50/60 border-l border-r border-slate-200">
                        Master Admin
                      </th>
                      <th className="py-3 px-3 text-center text-slate-800 border-r border-slate-200">
                        Operations Manager
                      </th>
                      <th className="py-3 px-3 text-center text-slate-800 border-r border-slate-200">
                        Ward Supervisor
                      </th>
                      <th className="py-3 px-3 text-center text-slate-800">
                        Floor Staff
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredPermissions.map((perm) => {
                      const isManagerAllowed = matrix.OPERATIONS_MANAGER?.[perm.id] ?? false;
                      const isSupervisorAllowed = matrix.SUPERVISOR?.[perm.id] ?? false;
                      const isStaffAllowed = matrix.STAFF?.[perm.id] ?? false;

                      return (
                        <tr key={perm.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Feature info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{perm.name}</span>
                              <span
                                className={`text-3xs font-bold px-1.5 py-0.2 rounded-md ${
                                  perm.riskLevel === 'CRITICAL'
                                    ? 'bg-rose-100 text-rose-800'
                                    : perm.riskLevel === 'HIGH'
                                    ? 'bg-amber-100 text-amber-800'
                                    : perm.riskLevel === 'MEDIUM'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {perm.riskLevel}
                              </span>
                            </div>
                            <p className="text-3xs text-slate-500 mt-0.5 leading-snug">
                              {perm.description}
                            </p>
                          </td>

                          {/* MASTER_ADMIN: Always Granted & Locked */}
                          <td className="py-3 px-3 text-center bg-blue-50/30 border-l border-r border-slate-200">
                            <div className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-emerald-100 text-emerald-800 font-bold" title="Master Admin has immutable full authority">
                              <Check className="h-4 w-4" />
                            </div>
                          </td>

                          {/* OPERATIONS_MANAGER */}
                          <td className="py-3 px-3 text-center border-r border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleToggleRolePermission('OPERATIONS_MANAGER', perm.id)}
                              className={`inline-flex items-center justify-center h-6 w-6 rounded-md transition-all cursor-pointer ${
                                isManagerAllowed
                                  ? 'bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700'
                                  : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'
                              }`}
                              title={isManagerAllowed ? 'Click to Revoke' : 'Click to Grant'}
                            >
                              {isManagerAllowed ? <Check className="h-4 w-4" /> : <X className="h-3.5 w-3.5" />}
                            </button>
                          </td>

                          {/* SUPERVISOR */}
                          <td className="py-3 px-3 text-center border-r border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleToggleRolePermission('SUPERVISOR', perm.id)}
                              className={`inline-flex items-center justify-center h-6 w-6 rounded-md transition-all cursor-pointer ${
                                isSupervisorAllowed
                                  ? 'bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700'
                                  : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'
                              }`}
                              title={isSupervisorAllowed ? 'Click to Revoke' : 'Click to Grant'}
                            >
                              {isSupervisorAllowed ? <Check className="h-4 w-4" /> : <X className="h-3.5 w-3.5" />}
                            </button>
                          </td>

                          {/* STAFF */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleRolePermission('STAFF', perm.id)}
                              className={`inline-flex items-center justify-center h-6 w-6 rounded-md transition-all cursor-pointer ${
                                isStaffAllowed
                                  ? 'bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700'
                                  : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'
                              }`}
                              title={isStaffAllowed ? 'Click to Revoke' : 'Click to Grant'}
                            >
                              {isStaffAllowed ? <Check className="h-4 w-4" /> : <X className="h-3.5 w-3.5" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: USER CUSTOM OVERRIDES */}
          {activeTab === 'USER_OVERRIDES' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-slate-700 flex items-start gap-3">
                <Info className="h-4 w-4 text-[#1E3A8A] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-[#1E3A8A]">Granular Individual User Overrides</h4>
                  <p className="text-3xs text-slate-600 mt-0.5 leading-relaxed">
                    Select any individual staff member to grant elevated privileges (e.g. allow a senior supervisor to download reports or publish notices) or revoke specific actions regardless of their standard role group.
                  </p>
                </div>
              </div>

              {/* Staff Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-3xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Select Staff Member to Customize
                  </label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A]"
                  >
                    <option value="">-- Choose Staff Member --</option>
                    {allStaffUsers.map((u: any, idx) => {
                      const uid = u.staff_id || u.staffCode || String(u.id || idx);
                      return (
                        <option key={uid} value={uid}>
                          {u.name || u.full_name} ({uid}) — {u.role?.toUpperCase()}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {selectedUserObj && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{selectedUserObj.name}</span>
                      <span className="text-3xs text-slate-500 block">
                        Base Role: <strong className="uppercase">{(selectedUserObj as any).role}</strong> | Ward: {(selectedUserObj as any).ward || (selectedUserObj as any).department || 'ALL'}
                      </span>
                    </div>
                    {userCustomMap[selectedStaffId] && Object.keys(userCustomMap[selectedStaffId]).length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-amber-100 text-amber-800">
                        {Object.keys(userCustomMap[selectedStaffId]).length} Custom Override(s)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Overrides Table */}
              {selectedStaffId ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-3xs uppercase font-extrabold tracking-wider border-b border-slate-200">
                        <th className="py-2.5 px-4">System Feature / Action</th>
                        <th className="py-2.5 px-3 text-center">Role Baseline</th>
                        <th className="py-2.5 px-3 text-center">Custom Override State</th>
                        <th className="py-2.5 px-4 text-right">Action Toggle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {SYSTEM_PERMISSIONS.map((perm) => {
                        const userRoleName = (selectedUserObj?.role || 'staff').toUpperCase() as RoleName;
                        const baselineVal = matrix[userRoleName]?.[perm.id] ?? false;
                        const overrideVal = userCustomMap[selectedStaffId]?.[perm.id];
                        const effectiveVal = typeof overrideVal === 'boolean' ? overrideVal : baselineVal;

                        return (
                          <tr key={perm.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-4">
                              <span className="font-bold text-slate-900">{perm.name}</span>
                              <p className="text-3xs text-slate-500">{perm.description}</p>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold ${
                                  baselineVal ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'
                                }`}
                              >
                                {baselineVal ? 'Default Allowed' : 'Default Denied'}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              {typeof overrideVal === 'boolean' ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-extrabold ${
                                    overrideVal
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                                  }`}
                                >
                                  {overrideVal ? 'EXPLICITLY GRANTED' : 'EXPLICITLY REVOKED'}
                                </span>
                              ) : (
                                <span className="text-3xs text-slate-400 font-mono">Inherited from Role</span>
                              )}
                            </td>

                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleToggleUserOverride(perm.id)}
                                className={`px-3 py-1 rounded-lg text-3xs font-bold transition-all cursor-pointer ${
                                  effectiveVal
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                              >
                                {effectiveVal ? 'Allowed (Toggle)' : 'Denied (Toggle)'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  Select a staff member from the dropdown above to inspect and assign user-specific custom permission overrides.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SECURITY SUMMARY & AUDIT */}
          {activeTab === 'SECURITY_AUDIT' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-3xs uppercase font-bold text-slate-500">Master Admin Level</span>
                  <div className="text-xl font-extrabold text-[#1E3A8A] mt-1">12 / 12 Features</div>
                  <p className="text-3xs text-emerald-700 mt-1 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Full Root Access
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-3xs uppercase font-bold text-slate-500">Operations Managers</span>
                  <div className="text-xl font-extrabold text-slate-800 mt-1">
                    {Object.values(matrix.OPERATIONS_MANAGER || {}).filter(Boolean).length} / 12 Features
                  </div>
                  <p className="text-3xs text-slate-500 mt-1">Site & Floor Jurisdiction Authority</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-3xs uppercase font-bold text-slate-500">Custom User Overrides</span>
                  <div className="text-xl font-extrabold text-amber-600 mt-1">
                    {Object.keys(userCustomMap).length} Active Exceptions
                  </div>
                  <p className="text-3xs text-slate-500 mt-1">Dynamic Per-User Rule Exceptions</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2 text-2xs font-mono">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Enforcement Architecture: Strict Multi-Tenant RBAC</span>
                </div>
                <p className="text-slate-300 leading-relaxed font-sans">
                  Permission evaluations are evaluated hierarchically: (1) Root master admin privileges are constant; (2) User explicit custom grant/revoke overrides take precedence; (3) Evaluated against the active role matrix synced across client and Express controllers.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset to Baseline Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              type="button"
              id="btn-save-permissions"
              onClick={handleSaveMatrix}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#1E3A8A] hover:bg-blue-900 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? 'Deploying Rules...' : 'Save & Deploy Rules'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
