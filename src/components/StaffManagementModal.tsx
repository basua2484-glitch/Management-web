import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Users,
  Check,
  Phone,
  Building,
  KeyRound,
  Trash2,
  UserCheck,
  AlertCircle,
  Shield,
  Plus,
  Clock,
  MapPin,
  User,
} from 'lucide-react';
import type { StaffUser, AppUser, UserRole } from '../types';
import type { CredentialCardData } from './CredentialCardModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { getStoredStaff, getStoredUsers } from '../data/mockHousekeepingData';
import {
  fetchZonesForSite,
  createZoneInDatabase,
  DEFAULT_HOSPITAL_WARDS,
} from '../services/zoneService';
import { UserProfileModal } from './UserProfileModal';

const PRECONFIGURED_WARDS: string[] = [
  'Floors & Rooms',
  'Lobby & Common Areas',
  'Laundry & Linen',
  'Kitchen & Dining Sanitation',
  'Deep Cleaning & Waste Mgmt',
  'Guest Suites',
  'Executive Floor',
  'Emergency / ICU',
  'General Ward',
  ...DEFAULT_HOSPITAL_WARDS,
];

interface StaffManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffUser[];
  users?: AppUser[];
  currentUser?: AppUser | null;
  currentUserRole?: UserRole;
  companyPrefix?: string;
  onAddStaff: (newStaff: Omit<StaffUser, 'id'> & { staffCode?: string }) => void;
  onToggleActive: (staffId: number | string) => void;
  onDeleteStaff?: (staffId: number | string) => void;
  onViewCredentialSlip?: (slip: CredentialCardData) => void;
}

export const StaffManagementModal: React.FC<StaffManagementModalProps> = ({
  isOpen,
  onClose,
  staff,
  users = [],
  currentUser,
  currentUserRole = 'admin',
  companyPrefix,
  onAddStaff,
  onToggleActive,
  onDeleteStaff,
  onViewCredentialSlip,
}) => {
  const [localStaffList, setLocalStaffList] = useState<StaffUser[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedProfileStaff, setSelectedProfileStaff] = useState<StaffUser | null>(null);

  // Ward / Area state
  const [department, setDepartment] = useState('Floors & Rooms');
  const [availableWards, setAvailableWards] = useState<string[]>(
    Array.from(new Set(PRECONFIGURED_WARDS))
  );
  const [isCustomWardMode, setIsCustomWardMode] = useState(false);
  const [customWardInput, setCustomWardInput] = useState('');
  const [isSavingWard, setIsSavingWard] = useState(false);

  // Shift schedule state (Default Morning/Evening/Night + Custom Shift Timing)
  const [shiftType, setShiftType] = useState<'Morning' | 'Evening' | 'Night' | 'Custom'>('Morning');
  const [customShiftStart, setCustomShiftStart] = useState('08:00');
  const [customShiftEnd, setCustomShiftEnd] = useState('16:00');
  const [customShiftLabel, setCustomShiftLabel] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<StaffUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const roleUpper = (currentUserRole || currentUser?.role || 'admin').toString().toUpperCase();
  const isMasterAdmin = roleUpper === 'MASTER_ADMIN' || roleUpper === 'ADMIN';
  const isOperationsManager = roleUpper === 'OPERATIONS_MANAGER' || roleUpper === 'MANAGER';
  const isSupervisor = roleUpper === 'SUPERVISOR';
  const isStaffOnly = roleUpper === 'STAFF';
  const isAdminOrManager = isMasterAdmin || isOperationsManager;

  // RBAC enforcement: custom ward and custom shift creation strictly restricted to MASTER_ADMIN & OPERATIONS_MANAGER
  const canCreateCustomWardAndShift = isMasterAdmin || isOperationsManager;

  // Active Employees Filter: ONLY active/existing employees (status = 'ACTIVE' and deleted_at IS NULL)
  // Terminated or deleted staff must never appear in the roster
  const isActiveEmployee = (u: any): boolean => {
    if (!u) return false;
    const statusUpper = String(u.status || '').toUpperCase();
    if (statusUpper === 'TERMINATED' || statusUpper === 'DELETED') return false;
    if (u.deleted_at || u.deletedAt || u.is_deleted) return false;
    if (statusUpper === 'DISABLED') return false;
    if (u.active === false) return false;
    return statusUpper === 'ACTIVE' || u.active === true || (u.is_approved !== false && statusUpper !== 'DISABLED');
  };

  // RBAC Filter for Roster:
  // - MASTER_ADMIN & OPERATIONS_MANAGER: View complete roster across the site
  // - SUPERVISOR: Strictly limited to assigned Ward, Floor, or Department
  // - STAFF: View only their own individual roster and attendance entries
  const filterByRBAC = (items: StaffUser[]): StaffUser[] => {
    if (isStaffOnly && currentUser) {
      const myId = currentUser.id;
      const myStaffCode = String(currentUser.staff_id || currentUser.username || '').toLowerCase();
      const myName = (currentUser.name || currentUser.full_name || '').toLowerCase();
      return items.filter((s) => {
        if (myId && s.id === myId) return true;
        if (myStaffCode && s.staffCode?.toLowerCase() === myStaffCode) return true;
        if (myName && s.name?.toLowerCase() === myName) return true;
        return false;
      });
    }

    if (isSupervisor && currentUser) {
      const supDept = (currentUser.fixed_department || currentUser.department || currentUser.assigned_area || '').trim().toLowerCase();
      const supWard = ((currentUser as any).ward || (currentUser as any).assigned_ward || '').trim().toLowerCase();
      const supFloor = ((currentUser as any).floor || '').trim().toLowerCase();
      const myId = String(currentUser.id || '').toLowerCase();
      const myStaffCode = String(currentUser.staff_id || currentUser.username || '').toLowerCase();

      return items.filter((s) => {
        const sDept = (s.department || '').trim().toLowerCase();
        const sFloor = ((s as any).floor || '').trim().toLowerCase();
        const sWard = ((s as any).ward || '').trim().toLowerCase();
        const sSupervisorId = String((s as any).supervisorId || (s as any).supervisor_id || '').toLowerCase();

        if (sSupervisorId && (sSupervisorId === myId || sSupervisorId === myStaffCode)) return true;
        if (supDept && sDept.includes(supDept)) return true;
        if (supWard && (sWard.includes(supWard) || sDept.includes(supWard))) return true;
        if (supFloor && sFloor.includes(supFloor)) return true;
        if (!supDept && !supWard && !supFloor) return true;
        return false;
      });
    }

    // MASTER_ADMIN & OPERATIONS_MANAGER see complete roster across the site
    return items;
  };

  // Sync and filter localStaffList when staff prop changes
  useEffect(() => {
    if (!isOpen) return;
    const activeStaff = staff.filter((s) => {
      const sStatus = String((s as any).status || '').toUpperCase();
      if (sStatus === 'TERMINATED' || sStatus === 'DELETED') return false;
      if ((s as any).deleted_at || (s as any).is_deleted) return false;
      return s.active !== false && sStatus !== 'DISABLED';
    });
    setLocalStaffList(filterByRBAC(activeStaff));
  }, [isOpen, staff, currentUser?.id, currentUser?.staff_id, currentUserRole]);

  // Real-time synchronization: Force Roster to re-fetch and sync state immediately
  // whenever staff or users are added, updated, or deleted
  useEffect(() => {
    const handleSyncRoster = () => {
      try {
        const storedUsers = getStoredUsers();
        const storedStaff = getStoredStaff();
        const activePrefix = (companyPrefix || '').toUpperCase();

        if (storedUsers && storedUsers.length > 0) {
          // Centralized staff query with ACTIVE ONLY and deleted_at IS NULL filter
          const activeUsers = storedUsers.filter((u) => {
            if (!isActiveEmployee(u)) return false;
            const uCode = String(u.staff_id || u.username || u.id || '').toUpperCase();
            const uTenant = (u.company_prefix || u.tenant_id || u.tenantId || '').toUpperCase();
            const isAdminAcc = u.role === 'admin' || uCode === 'BASU-ADM-001';
            if (activePrefix && !isAdminAcc && !uCode.startsWith(activePrefix) && uTenant !== activePrefix) {
              return false;
            }
            return true;
          });

          const mappedStaffList: StaffUser[] = activeUsers.map((u, idx) => {
            const extra = storedStaff.find(
              (s) =>
                (u.staffId && s.id === u.staffId) ||
                (u.staff_id && s.staffCode?.toLowerCase() === u.staff_id.toLowerCase()) ||
                (u.id && (s.id === u.id || String(s.id) === String(u.id)))
            );
            const shiftNamed: 'Morning' | 'Evening' | 'Night' =
              (u.shift as any) ||
              (u.assigned_shift === '11-7' ? 'Night' : u.assigned_shift === '3-11' ? 'Evening' : 'Morning');

            return {
              id: typeof u.id === 'number' ? u.id : (extra?.id || 1000 + idx),
              staffCode: u.staff_id || u.username || String(u.id || ''),
              name: u.full_name || u.name,
              role: (u.role as any) || 'staff',
              department: u.fixed_department || u.department || u.assigned_area || extra?.department || 'Floors & Rooms',
              shift: shiftNamed,
              phone: u.phone || u.mobile || extra?.phone || extra?.mobile,
              mobile: u.mobile || u.phone || extra?.mobile || extra?.phone,
              email: u.email || extra?.email,
              active: true,
              siteId: u.siteId || u.site_id || extra?.siteId,
              siteName: u.siteName || u.site_name || extra?.siteName,
              company_prefix: u.company_prefix || extra?.company_prefix || activePrefix,
              tenant_id: u.tenant_id || u.tenantId || extra?.tenant_id || activePrefix,
              dutyType: u.duty_type || extra?.dutyType || 'FIXED',
            } as StaffUser;
          });

          setLocalStaffList(filterByRBAC(mappedStaffList));
        } else {
          const activeStoredStaff = storedStaff.filter((s) => s.active !== false && !(s as any).deleted_at);
          setLocalStaffList(filterByRBAC(activeStoredStaff));
        }
      } catch (err) {
        console.warn('Roster re-fetch sync error:', err);
      }
    };

    window.addEventListener('staff-data-updated', handleSyncRoster);
    window.addEventListener('user-data-updated', handleSyncRoster);
    window.addEventListener('roster-data-updated', handleSyncRoster);

    return () => {
      window.removeEventListener('staff-data-updated', handleSyncRoster);
      window.removeEventListener('user-data-updated', handleSyncRoster);
      window.removeEventListener('roster-data-updated', handleSyncRoster);
    };
  }, [companyPrefix, currentUser, currentUserRole]);

  // Load dynamic zones for site on mount
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const loadWards = async () => {
      try {
        const siteId = currentUser?.siteId || currentUser?.site_id || '';
        const fetchedZones = await fetchZonesForSite(siteId, roleUpper);
        if (isMounted && fetchedZones && fetchedZones.length > 0) {
          const names = fetchedZones.map((z) => z.zone_name || z.department).filter(Boolean);
          const combined = Array.from(new Set([...PRECONFIGURED_WARDS, ...names]));
          setAvailableWards(combined);
        }
      } catch (err) {
        console.warn('Failed to fetch dynamic zones:', err);
      }
    };
    loadWards();
    return () => {
      isMounted = false;
    };
  }, [isOpen, currentUser, roleUpper]);

  // Keyboard shortcut: Escape to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // List of registered active users from database available for roster engagement assignment
  const assignableUsers = useMemo(() => {
    const activePrefix = (companyPrefix || '').toUpperCase();
    const allRegisteredUsers = users.length > 0 ? users : getStoredUsers();

    return allRegisteredUsers.filter((u) => {
      // Must be active and not deleted
      if (!isActiveEmployee(u)) return false;

      // Exclude Master Admin from housekeeping roster assignments
      const uCode = String(u.staff_id || u.username || u.id || '').toUpperCase();
      if (u.role === 'admin' || uCode === 'BASU-ADM-001') return false;

      // Scoped to tenant if prefix is active
      const uTenant = (u.company_prefix || u.tenant_id || u.tenantId || '').toUpperCase();
      if (activePrefix && !uCode.startsWith(activePrefix) && uTenant !== activePrefix) {
        return false;
      }

      // Scoped to supervisor's ward/department if user is a supervisor
      if (isSupervisor && currentUser) {
        const supDept = (currentUser.fixed_department || currentUser.department || currentUser.assigned_area || '').trim().toLowerCase();
        const supWard = ((currentUser as any).ward || (currentUser as any).assigned_ward || '').trim().toLowerCase();
        const supFloor = ((currentUser as any).floor || '').trim().toLowerCase();
        if (supDept || supWard || supFloor) {
          const uDept = (u.assigned_area || u.department || u.fixed_department || '').trim().toLowerCase();
          const uWard = ((u as any).ward || '').trim().toLowerCase();
          const uFloor = ((u as any).floor || '').trim().toLowerCase();
          const uSupervisorId = String((u as any).supervisor_id || (u as any).supervisorId || '').toLowerCase();
          const myId = String(currentUser.id || '').toLowerCase();
          const myStaffId = String(currentUser.staff_id || currentUser.username || '').toLowerCase();

          const matchesSupervisor = Boolean(uSupervisorId && (uSupervisorId === myId || uSupervisorId === myStaffId));
          const matchesDept = Boolean(supDept && (uDept.includes(supDept) || supDept.includes(uDept)));
          const matchesWard = Boolean(supWard && (uWard.includes(supWard) || uDept.includes(supWard)));
          const matchesFloor = Boolean(supFloor && uFloor.includes(supFloor));

          if (!matchesSupervisor && !matchesDept && !matchesWard && !matchesFloor) {
            return false;
          }
        }
      }

      return true;
    });
  }, [users, companyPrefix, isSupervisor, currentUser]);

  const handleAssignExistingStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Rule: Admins and Managers authorized to assign employees
    const roleUpper = (currentUserRole || '').toUpperCase();
    if (roleUpper !== 'ADMIN' && roleUpper !== 'MANAGER' && roleUpper !== 'SUPERVISOR') {
      setErrorMessage('Unauthorized Access: Elevated Privileges Required');
      return;
    }

    if (!selectedUserId) {
      setErrorMessage('Please select a registered staff member from the database list.');
      return;
    }

    const targetUser = assignableUsers.find(
      (u) =>
        String(u.id) === selectedUserId ||
        (u.staff_id && u.staff_id.toLowerCase() === selectedUserId.toLowerCase()) ||
        (u.username && u.username.toLowerCase() === selectedUserId.toLowerCase())
    );

    if (!targetUser) {
      setErrorMessage('Selected staff member was not found in the active database.');
      return;
    }

    // 1. Resolve Ward / Area Assignment (Default dropdown or Custom Ward)
    let assignedDept = department;
    if (isCustomWardMode) {
      const trimmedCustom = customWardInput.trim();
      if (!trimmedCustom) {
        setErrorMessage('Please enter a custom ward/area name or switch to selecting an existing ward.');
        return;
      }
      if (!canCreateCustomWardAndShift) {
        setErrorMessage('Access Denied: Only Master Admin and Operations Manager can create custom wards.');
        return;
      }

      setIsSavingWard(true);
      try {
        const siteId =
          targetUser.siteId ||
          targetUser.site_id ||
          currentUser?.siteId ||
          currentUser?.site_id ||
          'GLOBAL';
        await createZoneInDatabase(siteId, trimmedCustom, roleUpper);
        setAvailableWards((prev) => Array.from(new Set([...prev, trimmedCustom])));
        assignedDept = trimmedCustom;
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to save custom ward to database zones list.');
        setIsSavingWard(false);
        return;
      } finally {
        setIsSavingWard(false);
      }
    } else {
      assignedDept =
        department ||
        targetUser.fixed_department ||
        targetUser.department ||
        targetUser.assigned_area ||
        'Floors & Rooms';
    }

    // 2. Resolve Shift Schedule Assignment (Default options or Custom Shift Timing)
    let finalShift: string = shiftType;
    if (shiftType === 'Custom') {
      if (!canCreateCustomWardAndShift) {
        setErrorMessage('Access Denied: Only Master Admin and Operations Manager can configure custom shift schedules.');
        return;
      }
      if (!customShiftStart || !customShiftEnd) {
        setErrorMessage('Please specify both Start Time and End Time for the custom shift.');
        return;
      }
      const label = customShiftLabel.trim();
      finalShift = label
        ? `${label} (${customShiftStart} - ${customShiftEnd})`
        : `Custom (${customShiftStart} - ${customShiftEnd})`;
    }

    const assignedStaffCode = targetUser.staff_id || targetUser.username || `HK-${String(targetUser.id).padStart(3, '0')}`;
    const assignedName = targetUser.full_name || targetUser.name;

    onAddStaff({
      staffCode: assignedStaffCode,
      name: assignedName,
      department: assignedDept,
      shift: finalShift,
      role: (targetUser.role as any) || 'staff',
      phone: targetUser.phone || targetUser.mobile,
      active: true,
      siteId: targetUser.siteId || targetUser.site_id,
      siteName: targetUser.siteName || targetUser.site_name,
    });

    // Update localStaffList immediately for zero lag
    const newStaffItem: StaffUser = {
      id: typeof targetUser.id === 'number' ? targetUser.id : 1000 + localStaffList.length,
      staffCode: assignedStaffCode,
      name: assignedName,
      department: assignedDept,
      shift: finalShift,
      role: (targetUser.role as any) || 'staff',
      phone: targetUser.phone || targetUser.mobile,
      active: true,
      siteId: targetUser.siteId || targetUser.site_id,
      siteName: targetUser.siteName || targetUser.site_name,
    };

    setLocalStaffList((prev) => {
      const exists = prev.some(
        (s) =>
          s.id === newStaffItem.id ||
          s.staffCode?.toLowerCase() === newStaffItem.staffCode.toLowerCase()
      );
      if (exists) {
        return prev.map((s) =>
          s.id === newStaffItem.id || s.staffCode?.toLowerCase() === newStaffItem.staffCode.toLowerCase()
            ? { ...s, active: true, department: assignedDept, shift: finalShift }
            : s
        );
      }
      return [newStaffItem, ...prev];
    });

    setSelectedUserId('');
    setIsCustomWardMode(false);
    setCustomWardInput('');
    setIsAssigning(false);
  };

  // Guard: If modal is not open, do not render modal markup
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      id="modal-staff-management"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-[#1E3A8A]">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Housekeeping Staff Roster</h2>
                {isAdminOrManager && (
                  <span className="px-2 py-0.5 text-3xs font-extrabold uppercase rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Site-Wide View
                  </span>
                )}
                {isSupervisor && (
                  <span className="px-2 py-0.5 text-3xs font-extrabold uppercase rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    Ward / Dept Scope
                  </span>
                )}
                {isStaffOnly && (
                  <span className="px-2 py-0.5 text-3xs font-extrabold uppercase rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    My Roster
                  </span>
                )}
              </div>
              <p className="text-3xs text-slate-500">
                {isSupervisor
                  ? `Restricted to assigned ${currentUser?.fixed_department || currentUser?.department || currentUser?.assigned_area || 'Department'}`
                  : isStaffOnly
                  ? 'Viewing individual duty and attendance record'
                  : 'Master workforce roster with active employee filter'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAssigning && isAdminOrManager && (
              <button
                type="button"
                id="btn-assign-existing-staff"
                onClick={() => {
                  setIsAssigning(true);
                  setErrorMessage(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#1E3A8A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-900 transition-colors shadow-2xs cursor-pointer"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Assign Existing Staff</span>
              </button>
            )}

            <button
              type="button"
              id="btn-close-staff-modal-cross"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClose();
              }}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
              title="Close Roster"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Assign Existing Staff Form */}
          {isAssigning && (
            <form
              onSubmit={handleAssignExistingStaff}
              className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-3.5 shadow-xs"
            >
              {errorMessage && (
                <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-b border-blue-200/70 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1E3A8A] flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-[#1E3A8A]" />
                    Assign Registered Staff to Roster
                  </span>
                  <span className="text-3xs font-semibold text-slate-500">
                    ({assignableUsers.length} registered personnel available)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssigning(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Existing Staff Selector */}
                <div className="sm:col-span-1">
                  <label className="block text-3xs font-bold uppercase text-slate-700 mb-1">
                    Registered Database Staff *
                  </label>
                  <select
                    id="select-existing-staff"
                    required
                    value={selectedUserId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedUserId(val);
                      const found = assignableUsers.find(
                        (u) =>
                          String(u.id) === val ||
                          u.staff_id?.toLowerCase() === val.toLowerCase() ||
                          u.username?.toLowerCase() === val.toLowerCase()
                      );
                      if (found) {
                        if (found.fixed_department || found.department || found.assigned_area) {
                          setDepartment(found.fixed_department || found.department || found.assigned_area || 'Floors & Rooms');
                        }
                        if (found.shift) {
                          if (found.shift === 'Morning' || found.shift === 'Evening' || found.shift === 'Night') {
                            setShiftType(found.shift);
                          }
                        } else if (found.assigned_shift) {
                          if (found.assigned_shift === '11-7') setShiftType('Night');
                          else if (found.assigned_shift === '3-11') setShiftType('Evening');
                          else if (found.assigned_shift === '7-3') setShiftType('Morning');
                        }
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  >
                    <option value="">-- Choose Registered Staff Member --</option>
                    {assignableUsers.map((u) => {
                      const code = u.staff_id || u.username || `HK-${u.id}`;
                      const dept = u.fixed_department || u.department || u.assigned_area || 'General';
                      const isAlreadyActive = localStaffList.some(
                        (s) => s.id === u.id || (s.staffCode && code && s.staffCode.toLowerCase() === code.toLowerCase())
                      );
                      return (
                        <option key={u.id} value={String(u.id)}>
                          {code} • {u.full_name || u.name} ({dept}){isAlreadyActive ? ' • [On Roster]' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* 2. Department / Ward with Custom Ward Support */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-3xs font-bold uppercase text-slate-700 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-blue-600" />
                      <span>Ward / Area *</span>
                    </label>
                    {canCreateCustomWardAndShift && (
                      <button
                        type="button"
                        id="btn-toggle-custom-ward"
                        onClick={() => {
                          setIsCustomWardMode(!isCustomWardMode);
                          setErrorMessage(null);
                        }}
                        className="text-3xs font-semibold text-[#1E3A8A] hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="h-2.5 w-2.5" />
                        <span>{isCustomWardMode ? 'Select Existing' : '+ Add Custom Ward'}</span>
                      </button>
                    )}
                  </div>

                  {isCustomWardMode ? (
                    <div className="space-y-1">
                      <input
                        type="text"
                        id="input-custom-ward-name"
                        required
                        value={customWardInput}
                        onChange={(e) => setCustomWardInput(e.target.value)}
                        placeholder="Type custom ward/area name..."
                        className="w-full rounded-lg border border-blue-400 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium placeholder-slate-400 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                      />
                      <span className="text-4xs text-blue-700 font-semibold block">
                        ★ Auto-saves to site zones database on assignment
                      </span>
                    </div>
                  ) : (
                    <select
                      id="select-ward-dropdown"
                      value={department}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_CUSTOM_WARD__') {
                          setIsCustomWardMode(true);
                        } else {
                          setDepartment(e.target.value);
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                    >
                      {availableWards.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                      {canCreateCustomWardAndShift && (
                        <option value="__ADD_CUSTOM_WARD__">+ Add Custom Ward...</option>
                      )}
                    </select>
                  )}
                </div>

                {/* 3. Shift Schedule with Custom Shift Timing Support */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-3xs font-bold uppercase text-slate-700 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-blue-600" />
                      <span>Shift Schedule *</span>
                    </label>
                    {canCreateCustomWardAndShift && (
                      <span className="text-4xs font-bold uppercase px-1.5 py-0.2 rounded bg-blue-100 text-[#1E3A8A]">
                        Custom Allowed
                      </span>
                    )}
                  </div>

                  <select
                    id="select-shift-schedule"
                    value={shiftType}
                    onChange={(e) => setShiftType(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  >
                    <option value="Morning">Morning (07:00 - 15:00)</option>
                    <option value="Evening">Evening (15:00 - 23:00)</option>
                    <option value="Night">Night (23:00 - 07:00)</option>
                    {canCreateCustomWardAndShift && (
                      <option value="Custom">Custom Shift Timing</option>
                    )}
                  </select>

                  {shiftType === 'Custom' && canCreateCustomWardAndShift && (
                    <div className="mt-2 space-y-1.5 rounded-lg border border-blue-200 bg-white p-2 text-xs shadow-2xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-4xs font-bold uppercase text-slate-600 mb-0.5">
                            Start Time
                          </label>
                          <input
                            type="time"
                            required
                            value={customShiftStart}
                            onChange={(e) => setCustomShiftStart(e.target.value)}
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-[#1E3A8A]"
                          />
                        </div>
                        <div>
                          <label className="block text-4xs font-bold uppercase text-slate-600 mb-0.5">
                            End Time
                          </label>
                          <input
                            type="time"
                            required
                            value={customShiftEnd}
                            onChange={(e) => setCustomShiftEnd(e.target.value)}
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-[#1E3A8A]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-4xs font-bold uppercase text-slate-600 mb-0.5">
                          Shift Label (Optional)
                        </label>
                        <input
                          type="text"
                          value={customShiftLabel}
                          onChange={(e) => setCustomShiftLabel(e.target.value)}
                          placeholder="e.g. Ad-hoc, Split Shift, General"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs text-slate-800 placeholder-slate-400 focus:border-[#1E3A8A]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-3xs text-slate-500">
                  Creates an active shift/roster engagement entry for the selected database user.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAssigning(false)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#1E3A8A] px-3.5 py-1 text-xs font-semibold text-white hover:bg-blue-900 cursor-pointer shadow-xs"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Assign to Roster</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Roster List */}
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                <tr>
                  <th className="border border-slate-200 px-3 py-2.5 text-center">Staff ID</th>
                  <th className="border border-slate-200 px-4 py-2.5">Name</th>
                  <th className="border border-slate-200 px-3 py-2.5">Department</th>
                  <th className="border border-slate-200 px-3 py-2.5 text-center">Shift</th>
                  <th className="border border-slate-200 px-3 py-2.5">Contact</th>
                  <th className="border border-slate-200 px-3 py-2.5 text-center">Status</th>
                  <th className="border border-slate-200 px-3 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {localStaffList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-slate-200 py-10 px-4 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="h-8 w-8 text-slate-300" />
                        <span className="text-sm font-bold text-slate-700">
                          {isStaffOnly
                            ? 'No Active Roster Record Found'
                            : isSupervisor
                            ? 'No Active Personnel in Assigned Ward / Department'
                            : '0 Registered Accounts / No Active Staff Found'}
                        </span>
                        <p className="text-xs text-slate-500 max-w-xs">
                          {isStaffOnly
                            ? 'Your staff account is currently inactive or not yet assigned to an active roster shift.'
                            : isSupervisor
                            ? 'Only active staff members assigned to your designated ward, floor, or department appear here.'
                            : 'The Staff Vault contains 0 personnel. Click "+ Add Staff Member" above to enroll personnel.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  localStaffList.map((s, idx) => {
                  const matchingUser = users.find(
                    (u) =>
                      (u.staffId && u.staffId === s.id) ||
                      u.name?.toLowerCase() === s.name?.toLowerCase() ||
                      (u.username && s.staffCode && u.username.toLowerCase() === s.staffCode.toLowerCase()) ||
                      (u.staff_id && s.staffCode && u.staff_id.toLowerCase() === s.staffCode.toLowerCase()) ||
                      u.username?.toLowerCase() === `hk${s.id.toString().padStart(3, '0')}` ||
                      u.username?.toLowerCase() === `hk${s.id}`
                  );
                  const staffIdStr = matchingUser
                    ? matchingUser.username || matchingUser.staff_id
                    : s.staffCode || `hk${s.id.toString().padStart(3, '0')}`;
                  const passStr = matchingUser?.password || '123456';

                  const isMasterAdminRow =
                    (s.role || '').toLowerCase() === 'admin' ||
                    (s.role || '').toLowerCase() === 'master_admin' ||
                    String(s.staffCode || '').toUpperCase() === 'BASU-ADM-001' ||
                    String((s as any).staff_id || '').toUpperCase() === 'BASU-ADM-001' ||
                    (matchingUser && (
                      (matchingUser.role || '').toLowerCase() === 'admin' ||
                      (matchingUser.role || '').toLowerCase() === 'master_admin' ||
                      String(matchingUser.staff_id || matchingUser.username || '').toUpperCase() === 'BASU-ADM-001'
                    ));

                  return (
                    <tr key={s.staffCode || (s.id ? `mgmt-s-${s.id}` : `mgmt-s-${idx}`)} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-3 py-2.5 text-center font-mono font-bold text-[#1E3A8A]">
                        <button
                          type="button"
                          onClick={() => setSelectedProfileStaff(s)}
                          className="hover:underline cursor-pointer"
                          title="Click to view interactive profile card"
                        >
                          {s.staffCode}
                        </button>
                      </td>
                      <td className="border border-slate-200 px-4 py-2.5 font-medium text-slate-900">
                        <button
                          type="button"
                          onClick={() => setSelectedProfileStaff(s)}
                          className="flex items-center gap-1.5 text-left hover:text-[#1E3A8A] cursor-pointer group transition-colors"
                          title="Click to view interactive profile card"
                        >
                          <span className="h-6 w-6 rounded-full bg-blue-100 text-[#1E3A8A] flex items-center justify-center text-3xs font-black shrink-0 group-hover:scale-105 transition-transform">
                            {s.name[0]}
                          </span>
                          <span className="group-hover:underline">{s.name}</span>
                          {isMasterAdminRow && (
                            <span className="px-1.5 py-0.5 rounded text-3xs font-bold uppercase bg-blue-100 text-[#1E3A8A]">
                              Admin
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="border border-slate-200 px-3 py-2.5 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Building className="h-3 w-3 text-slate-400" />
                          <span>{s.department}</span>
                        </div>
                      </td>
                      <td className="border border-slate-200 px-3 py-2.5 text-center">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-700">
                          {s.shift}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-3 py-2.5 text-slate-600">
                        {s.phone ? (
                          <div className="flex items-center gap-1 font-mono text-2xs">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{s.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="border border-slate-200 px-3 py-2.5 text-center">
                        {isMasterAdminRow || isStaffOnly ? (
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                          >
                            Active
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onToggleActive(s.id)}
                            className={`inline-flex rounded-full px-2 py-0.5 text-2xs font-semibold cursor-pointer ${
                              s.active
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {s.active ? 'Active' : 'Inactive'}
                          </button>
                        )}
                      </td>
                      <td className="border border-slate-200 px-2.5 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedProfileStaff(s)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-semibold text-2xs transition-colors border border-indigo-200 cursor-pointer"
                            title={`View & Edit Profile Card for ${s.name}`}
                          >
                            <User className="h-3 w-3 text-indigo-700" />
                            <span>Profile</span>
                          </button>

                          {onViewCredentialSlip && (!isStaffOnly || (currentUser && (s.id === currentUser.id || s.staffCode === currentUser.staff_id))) && (
                            <button
                              type="button"
                              onClick={() =>
                                onViewCredentialSlip({
                                  name: s.name,
                                  staffId: staffIdStr,
                                  defaultPass: passStr,
                                  url: 'hk-app.hospital.com',
                                  department: s.department,
                                  role: s.role,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] font-semibold text-2xs transition-colors border border-blue-200 cursor-pointer"
                              title={`View & Print Credential Slip for ${s.name}`}
                            >
                              <KeyRound className="h-3 w-3" />
                              <span>Slip</span>
                            </button>
                          )}
                          {isMasterAdminRow ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200 text-3xs font-semibold cursor-not-allowed select-none"
                              title="Master Admin account is protected and cannot be deleted"
                            >
                              <Shield className="h-3 w-3 text-blue-600" />
                              <span>Protected</span>
                            </span>
                          ) : (
                            isAdminOrManager && onDeleteStaff && (
                              <button
                                type="button"
                                onClick={() => setStaffToDelete(s)}
                                className="inline-flex items-center p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                                title={`Delete ${s.name} from Vault & Roster`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 rounded-b-xl">
          <span className="text-xs text-slate-500">
            Total Staff: <strong>{localStaffList.length}</strong>
          </span>
          <button
            type="button"
            id="btn-close-staff-modal-bottom"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
            }}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>

      {/* Delete Staff Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={Boolean(staffToDelete)}
        title="Delete Staff Member & Roster"
        itemName={staffToDelete ? `${staffToDelete.name} (${staffToDelete.staffCode})` : undefined}
        message={
          staffToDelete ? (
            <p>
              Are you sure you want to permanently delete staff member{' '}
              <strong className="text-slate-900">{staffToDelete.name}</strong>{' '}
              (<span className="font-mono font-semibold text-[#1E3A8A]">{staffToDelete.staffCode}</span>)?
              This will remove them from the centralized users database, revoke portal access, and purge all linked roster and engagement entries.
            </p>
          ) : undefined
        }
        dangerDetails="Cascade deletion: Deleting this staff member permanently deletes them from both Staff Vault and Housekeeping Staff Roster."
        confirmText="Accept & Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
        onCancel={() => {
          if (!isDeleting) setStaffToDelete(null);
        }}
        onConfirm={async () => {
          if (!staffToDelete) return;
          const isTargetAdmin =
            (staffToDelete.role || '').toLowerCase() === 'admin' ||
            String(staffToDelete.staffCode || '').toUpperCase() === 'BASU-ADM-001' ||
            String((staffToDelete as any).staff_id || '').toUpperCase() === 'BASU-ADM-001';
          if (isTargetAdmin) {
            setStaffToDelete(null);
            return;
          }
          try {
            setIsDeleting(true);
            const targetId = staffToDelete.id || staffToDelete.staffCode;
            if (onDeleteStaff) {
              await onDeleteStaff(targetId);
            }
            // Filter local state immediately
            setLocalStaffList((prev) =>
              prev.filter(
                (s) =>
                  s.id !== staffToDelete.id &&
                  s.staffCode?.toLowerCase() !== staffToDelete.staffCode?.toLowerCase()
              )
            );
          } finally {
            setIsDeleting(false);
            setStaffToDelete(null);
          }
        }}
      />

      {/* Interactive Social-Style User Profile Modal */}
      {selectedProfileStaff && (
        <UserProfileModal
          isOpen={Boolean(selectedProfileStaff)}
          onClose={() => setSelectedProfileStaff(null)}
          targetUser={
            users.find(
              (u) =>
                u.id === selectedProfileStaff.id ||
                u.staff_id?.toLowerCase() === selectedProfileStaff.staffCode?.toLowerCase() ||
                u.username?.toLowerCase() === selectedProfileStaff.staffCode?.toLowerCase()
            ) || (selectedProfileStaff as any)
          }
          currentUser={currentUser}
          currentUserRole={currentUserRole}
          onUpdateUser={(updated) => {
            setLocalStaffList((prev) =>
              prev.map((s) =>
                s.id === updated.id || s.staffCode?.toLowerCase() === updated.staff_id?.toLowerCase()
                  ? {
                      ...s,
                      name: updated.name,
                      department: updated.department || s.department,
                      shift: updated.shift || s.shift,
                      phone: updated.phone,
                      mobile: updated.mobile,
                      email: updated.email,
                      avatar: updated.avatar,
                    }
                  : s
              )
            );
          }}
        />
      )}
    </div>
  );
};
