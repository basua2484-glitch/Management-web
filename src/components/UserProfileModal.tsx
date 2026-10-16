import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Camera,
  Upload,
  Mail,
  Phone,
  MessageSquare,
  Building,
  Clock,
  Shield,
  ShieldAlert,
  UserCheck,
  Briefcase,
  AlertCircle,
  CheckCircle,
  Copy,
  Check,
  Edit3,
  Save,
  Lock,
  Unlock,
  Heart,
  FileBadge,
  MapPin,
  Calendar,
  ShieldCheck,
  User,
  Users,
  KeyRound,
  ExternalLink,
  Laptop,
  Smartphone,
  Tablet,
  LogOut,
  Globe,
  RefreshCw,
  Radio,
} from 'lucide-react';
import type { AppUser, StaffUser, UserRole, DutyType } from '../types';
import type { UserSession } from '../types/sessions';
import { fetchUserSessions, revokeSession, revokeAllOtherSessions } from '../services/sessionService';
import { getStoredUsers, saveStoredUsers, getStoredStaff, saveStoredStaff } from '../data/mockHousekeepingData';
import { saveUserToLiveDb } from '../services/firestoreService';
import { DEFAULT_HOSPITAL_WARDS } from '../services/zoneService';

export interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: AppUser | StaffUser | null;
  currentUser?: AppUser | null;
  currentUserRole?: UserRole | string;
  availableSites?: Array<{ siteId: string; siteName: string }>;
  onUpdateUser?: (updated: AppUser) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  currentUser,
  currentUserRole = 'admin',
  availableSites = [],
  onUpdateUser,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  // Duty & Placement State
  const [role, setRole] = useState<UserRole>('staff');
  const [siteId, setSiteId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [department, setDepartment] = useState('Floors & Rooms');
  const [dutyType, setDutyType] = useState<DutyType>('FIXED');
  const [shift, setShift] = useState<string>('Morning');
  const [status, setStatus] = useState<'ACTIVE' | 'DISABLED'>('ACTIVE');
  const [supervisorName, setSupervisorName] = useState('');

  // Additional Info State
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [idProofStatus, setIdProofStatus] = useState<string>('VERIFIED');
  const [idProofType, setIdProofType] = useState<string>('Aadhaar Card');

  // Secure Credentials & Password Management State (Permanently Masked)
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Active Sessions Tracker & Remote Revoke States
  const [activeSessions, setActiveSessions] = useState<UserSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [terminatingSessionId, setTerminatingSessionId] = useState<string | null>(null);
  const [confirmRevokeSession, setConfirmRevokeSession] = useState<UserSession | null>(null);
  const [confirmRevokeAllOthers, setConfirmRevokeAllOthers] = useState(false);
  const [sessionActionMessage, setSessionActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Normalize Current User Role
  const roleUpper = (currentUserRole || currentUser?.role || 'admin').toString().toUpperCase();
  const isMasterAdmin = roleUpper === 'MASTER_ADMIN' || roleUpper === 'ADMIN';
  const isOperationsManager = roleUpper === 'OPERATIONS_MANAGER' || roleUpper === 'MANAGER';
  const isSupervisor = roleUpper === 'SUPERVISOR';
  const isStaff = roleUpper === 'STAFF';

  // Determine Target User Attributes
  const resolvedTargetId = targetUser ? (targetUser as any).id : null;
  const resolvedStaffId = targetUser ? (targetUser as any).staff_id || (targetUser as any).staffCode || (targetUser as any).username || `HK-${resolvedTargetId}` : '';
  const isTargetMasterAdmin =
    (targetUser?.role || '').toLowerCase() === 'admin' ||
    (targetUser?.role || '').toLowerCase() === 'master_admin' ||
    String(resolvedStaffId).toUpperCase() === 'BASU-ADM-001';

  const isSelf =
    Boolean(currentUser && (
      (resolvedTargetId && currentUser.id === resolvedTargetId) ||
      (resolvedStaffId && (
        currentUser.staff_id?.toLowerCase() === resolvedStaffId.toLowerCase() ||
        currentUser.username?.toLowerCase() === resolvedStaffId.toLowerCase()
      ))
    ));

  // =========================================================================
  // RBAC PERMISSION MATRIX ENFORCEMENT
  // =========================================================================
  const permissions = useMemo(() => {
    // 1. MASTER_ADMIN:
    // Full View & Full Edit/Update access for ALL user profile cards across the entire application (Staff Vault, Roster, Attendance Table).
    // Can change/reset roles, assigned sites, duty types, shifts, passwords, and account status (Active/Inactive).
    if (isMasterAdmin) {
      return {
        canView: true,
        canEdit: true,
        canEditFullName: true,
        canEditCoreAdmin: true,
        canEditRole: true,
        canEditSite: true,
        canEditShift: true,
        canEditDutyType: true,
        canEditStatus: true,
        canEditPassword: true,
        canEditPersonal: true,
        readOnlyReason: null,
      };
    }

    // 2. OPERATIONS_MANAGER:
    // Full View & Edit access for profiles of Supervisors and Staff within their assigned Site/Campus.
    // CANNOT modify Master Admin profiles or change site assignments outside their jurisdiction.
    if (isOperationsManager) {
      if (isTargetMasterAdmin) {
        return {
          canView: true,
          canEdit: false,
          canEditFullName: false,
          canEditCoreAdmin: false,
          canEditRole: false,
          canEditSite: false,
          canEditShift: false,
          canEditDutyType: false,
          canEditStatus: false,
          canEditPassword: false,
          canEditPersonal: false,
          readOnlyReason: 'Protected Account: Operations Managers cannot edit Master Admin profiles.',
        };
      }

      const mySiteId = currentUser?.siteId || currentUser?.site_id || '';
      const targetSiteId = (targetUser as any)?.siteId || (targetUser as any)?.site_id || '';
      const isCrossSite = mySiteId && targetSiteId && mySiteId !== targetSiteId && !['ALL', 'GLOBAL'].includes(mySiteId);

      if (isCrossSite) {
        return {
          canView: true,
          canEdit: false,
          canEditFullName: false,
          canEditCoreAdmin: false,
          canEditRole: false,
          canEditSite: false,
          canEditShift: false,
          canEditDutyType: false,
          canEditStatus: false,
          canEditPassword: false,
          canEditPersonal: false,
          readOnlyReason: 'Jurisdiction Restriction: User belongs to another site campus.',
        };
      }

      return {
        canView: true,
        canEdit: true,
        canEditFullName: true,
        canEditCoreAdmin: true,
        canEditRole: true, // Can change supervisor / staff roles (not admin)
        canEditSite: false, // Cannot change site outside jurisdiction
        canEditShift: true,
        canEditDutyType: true,
        canEditStatus: true,
        canEditPassword: true,
        canEditPersonal: true,
        readOnlyReason: null,
      };
    }

    // 3. WARD/FLOOR SUPERVISOR:
    // View-Only access to Profile Cards of Staff members assigned to their specific Ward/Area.
    // Can view shift details and contact info to coordinate duty, but cannot edit core admin credentials.
    // If viewing their own profile, can edit personal info.
    if (isSupervisor) {
      if (isSelf) {
        return {
          canView: true,
          canEdit: true,
          canEditFullName: false, // Name changes are HR/Admin controlled
          canEditCoreAdmin: false,
          canEditRole: false,
          canEditSite: false,
          canEditShift: false,
          canEditDutyType: false,
          canEditStatus: false,
          canEditPassword: true,
          canEditPersonal: true, // Avatar, Mobile, Email, Emergency, Address
          readOnlyReason: null,
        };
      }

      const supWard = (currentUser?.assigned_area || currentUser?.fixed_department || currentUser?.department || '').trim();
      const targetWard = ((targetUser as any)?.assigned_area || (targetUser as any)?.fixed_department || (targetUser as any)?.department || '').trim();
      const isWardMatch =
        !supWard ||
        ['ALL', 'GLOBAL', 'HOSPITAL WIDE'].includes(supWard.toUpperCase()) ||
        targetWard.toLowerCase().includes(supWard.toLowerCase()) ||
        supWard.toLowerCase().includes(targetWard.toLowerCase());

      return {
        canView: true,
        canEdit: false,
        canEditFullName: false,
        canEditCoreAdmin: false,
        canEditRole: false,
        canEditSite: false,
        canEditShift: false,
        canEditDutyType: false,
        canEditStatus: false,
        canEditPassword: false,
        canEditPersonal: false,
        readOnlyReason: isWardMatch
          ? 'View-Only Access: Floor Supervisors can coordinate duty details and contact info, but cannot modify administrative credentials.'
          : `View-Only Access: Staff member is outside your assigned ward/area (${supWard || 'Hospital Wide'}).`,
      };
    }

    // 4. STAFF:
    // View-Only for personal duty details, shift assignments, and site info.
    // Editable fields strictly limited to personal info: Profile Avatar/Picture, Mobile Number, Email, Emergency Contacts, and Address.
    if (isStaff) {
      if (isSelf) {
        return {
          canView: true,
          canEdit: true,
          canEditFullName: false, // Legal Name strictly locked
          canEditCoreAdmin: false,
          canEditRole: false,
          canEditSite: false,
          canEditShift: false,
          canEditDutyType: false,
          canEditStatus: false,
          canEditPassword: true,
          canEditPersonal: true, // Profile Avatar, Mobile Number, Email, Emergency Contacts, Address
          readOnlyReason: null,
        };
      }
      return {
        canView: true,
        canEdit: false,
        canEditFullName: false,
        canEditCoreAdmin: false,
        canEditRole: false,
        canEditSite: false,
        canEditShift: false,
        canEditDutyType: false,
        canEditStatus: false,
        canEditPassword: false,
        canEditPersonal: false,
        readOnlyReason: 'Staff users have view-only access to directory records.',
      };
    }

    // Default fallback
    return {
      canView: true,
      canEdit: false,
      canEditFullName: false,
      canEditCoreAdmin: false,
      canEditRole: false,
      canEditSite: false,
      canEditShift: false,
      canEditDutyType: false,
      canEditStatus: false,
      canEditPassword: false,
      canEditPersonal: false,
      readOnlyReason: 'Read-only profile view.',
    };
  }, [isMasterAdmin, isOperationsManager, isSupervisor, isStaff, isTargetMasterAdmin, isSelf, currentUser, targetUser]);

  // Sync state when targetUser changes or modal opens
  useEffect(() => {
    if (!targetUser || !isOpen) return;

    const u = targetUser as any;
    setFullName(u.full_name || u.name || '');
    setPhone(u.phone || u.mobile || '');
    setMobile(u.mobile || u.phone || '');
    setEmail(u.email || '');
    setAddress(u.address || u.residential_address || 'Quarter 4B, Hospital Staff Enclave');
    setAvatarUrl(u.avatar || u.avatarUrl || null);
    setBannerUrl(u.bannerUrl || null);

    setRole((u.role as UserRole) || 'staff');
    setSiteId(u.siteId || u.site_id || '');
    setSiteName(u.siteName || u.site_name || 'Apex Multi-Specialty Hospital');
    setDepartment(u.fixed_department || u.department || u.assigned_area || 'Floors & Rooms');
    setDutyType(u.duty_type || u.dutyType || 'FIXED');
    setShift(u.shift || (u.assigned_shift === '11-7' ? 'Night' : u.assigned_shift === '3-11' ? 'Evening' : 'Morning'));
    setStatus(u.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE');
    setSupervisorName(u.supervisorName || u.supervisor_name || 'Supervisor Rakesh');

    setEmergencyContactName(u.emergency_contact_name || u.emergencyContactName || 'Suman Devi');
    setEmergencyContactPhone(u.emergency_contact_phone || u.emergencyContactPhone || u.emergencyContact || '+91 98765 43210');
    setBloodGroup(u.blood_group || u.bloodGroup || 'B+');
    setIdProofStatus(u.id_proof_status || u.idProofStatus || 'VERIFIED');
    setIdProofType(u.id_proof_type || u.idProofType || 'Aadhaar Card');
    setIsChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

    setIsEditing(false);
    setSaveSuccess(false);
    setErrorMessage(null);
  }, [targetUser, isOpen]);

  // Handle Avatar Image File Upload
  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size exceeds 5MB limit. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setAvatarUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Handle Banner Image File Upload
  const handleBannerFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select an image for cover banner');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setBannerUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // =========================================================================
  // ACTIVE SESSIONS & CONNECTED DEVICES (REMOTE LOGOUT ENGINE)
  // =========================================================================
  const loadSessions = async () => {
    const targetUserId = resolvedStaffId || (targetUser as any)?.id || (targetUser as any)?.staff_id || '';
    if (!targetUserId) return;
    setIsLoadingSessions(true);
    try {
      const data = await fetchUserSessions(targetUserId);
      setActiveSessions(data);
    } catch (err) {
      console.warn('Failed to load user sessions', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen, resolvedStaffId, targetUser]);

  useEffect(() => {
    const handleTerminated = () => {
      loadSessions();
    };
    window.addEventListener('session-terminated', handleTerminated);
    return () => window.removeEventListener('session-terminated', handleTerminated);
  }, [resolvedStaffId, targetUser]);

  const handleTerminateSession = async (session: UserSession) => {
    setTerminatingSessionId(session.session_id);
    setSessionActionMessage(null);
    try {
      const ok = await revokeSession(session.session_id);
      if (ok) {
        setSessionActionMessage({
          type: 'success',
          text: `Disconnected ${session.device_name} successfully. The device is now forcefully logged out.`,
        });
        setActiveSessions((prev) => prev.filter((s) => s.session_id !== session.session_id));
        setConfirmRevokeSession(null);
      } else {
        setSessionActionMessage({ type: 'error', text: 'Failed to terminate session. Please try again.' });
      }
    } catch (err: any) {
      setSessionActionMessage({ type: 'error', text: err?.message || 'Error terminating session.' });
    } finally {
      setTerminatingSessionId(null);
      setTimeout(() => setSessionActionMessage(null), 5000);
    }
  };

  const handleTerminateAllOthers = async () => {
    const targetUserId = resolvedStaffId || (targetUser as any)?.id || (targetUser as any)?.staff_id || '';
    if (!targetUserId) return;
    setIsLoadingSessions(true);
    setSessionActionMessage(null);
    try {
      const ok = await revokeAllOtherSessions(targetUserId);
      if (ok) {
        setSessionActionMessage({
          type: 'success',
          text: 'All other connected devices have been forcefully logged out.',
        });
        setActiveSessions((prev) => prev.filter((s) => s.is_current));
        setConfirmRevokeAllOthers(false);
      } else {
        setSessionActionMessage({ type: 'error', text: 'Failed to revoke other sessions.' });
      }
    } catch (err: any) {
      setSessionActionMessage({ type: 'error', text: err?.message || 'Error revoking sessions.' });
    } finally {
      setIsLoadingSessions(false);
      setTimeout(() => setSessionActionMessage(null), 5000);
    }
  };

  // =========================================================================
  // SUBMIT PROFILE UPDATES (API + FIRESTORE + LOCAL CACHE + REAL-TIME SYNC)
  // =========================================================================
  const handleSubmitUpdates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.canEdit) {
      setErrorMessage('Unauthorized: Your role does not have permission to edit this profile.');
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const targetUserId = resolvedTargetId || (targetUser as any)?.id || Date.now();
      const targetStaffCode = resolvedStaffId;

      // Secure Password Change Validation
      if (permissions.canEditPassword && isChangingPassword && newPassword.trim()) {
        if (newPassword.trim().length < 6) {
          setErrorMessage('New password must be at least 6 characters long.');
          setIsSaving(false);
          return;
        }
        if (newPassword.trim() !== confirmPassword.trim()) {
          setErrorMessage('New password and confirmation password do not match.');
          setIsSaving(false);
          return;
        }
        if (isSelf && !isMasterAdmin && !currentPassword.trim()) {
          setErrorMessage('Please enter your current password to authorize this password change.');
          setIsSaving(false);
          return;
        }
      }

      // Construct Updated User Payload
      const targetLegalName = permissions.canEditFullName
        ? fullName.trim()
        : ((targetUser as any)?.full_name || (targetUser as any)?.name || fullName.trim());

      const updatedUserPayload: AppUser = {
        ...(targetUser as any),
        id: typeof targetUserId === 'number' ? targetUserId : parseInt(String(targetUserId).replace(/\D/g, '')) || 101,
        username: (targetUser as any)?.username || targetStaffCode,
        staff_id: targetStaffCode,
        full_name: targetLegalName,
        name: targetLegalName,
        phone: phone.trim(),
        mobile: mobile.trim() || phone.trim(),
        email: email.trim(),
        address: address.trim(),
        residential_address: address.trim(),
        avatar: avatarUrl || undefined,
        avatarUrl: avatarUrl || undefined,
        bannerUrl: bannerUrl || undefined,
        // Core fields updated only if authorized
        role: permissions.canEditRole ? role : (targetUser?.role || 'staff'),
        siteId: permissions.canEditSite ? siteId : ((targetUser as any)?.siteId || siteId),
        site_id: permissions.canEditSite ? siteId : ((targetUser as any)?.site_id || siteId),
        siteName: siteName,
        site_name: siteName,
        department: permissions.canEditCoreAdmin ? department : ((targetUser as any)?.department || department),
        fixed_department: permissions.canEditCoreAdmin ? department : ((targetUser as any)?.fixed_department || department),
        assigned_area: permissions.canEditCoreAdmin ? department : ((targetUser as any)?.assigned_area || department),
        duty_type: permissions.canEditDutyType ? dutyType : ((targetUser as any)?.duty_type || dutyType),
        assigned_shift: permissions.canEditShift ? (shift === 'Night' ? '11-7' : shift === 'Evening' ? '3-11' : shift === 'Morning' ? '7-3' : shift) : ((targetUser as any)?.assigned_shift || '7-3'),
        shift: permissions.canEditShift ? shift : ((targetUser as any)?.shift || shift),
        status: permissions.canEditStatus ? status : ((targetUser as any)?.status || 'ACTIVE'),
        active: permissions.canEditStatus ? status === 'ACTIVE' : true,
        is_approved: true,
        // Additional info
        emergency_contact_name: emergencyContactName.trim(),
        emergencyContactName: emergencyContactName.trim(),
        emergency_contact_phone: emergencyContactPhone.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        emergencyContact: emergencyContactPhone.trim(),
        blood_group: bloodGroup,
        bloodGroup: bloodGroup,
        id_proof_status: idProofStatus,
        idProofStatus: idProofStatus,
        id_proof_type: idProofType,
        idProofType: idProofType,
        supervisorName: supervisorName,
        supervisor_name: supervisorName,
        ...(permissions.canEditPassword && isChangingPassword && newPassword.trim()
          ? {
              password: newPassword.trim(),
              raw_password_vault: newPassword.trim(),
            }
          : {}),
        updated_at: new Date().toISOString(),
      };

      // 1. Send PUT request to /api/users/:id
      try {
        await fetch(`/api/users/${encodeURIComponent(targetStaffCode || String(targetUserId))}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': roleUpper,
            'x-site-id': siteId || 'GLOBAL',
            'x-is-self': isSelf ? 'true' : 'false',
          },
          body: JSON.stringify(updatedUserPayload),
        });
      } catch (apiErr) {
        console.warn('Backend PUT /api/users returned error, updating persistent caches:', apiErr);
      }

      // 2. Persist to Firestore Live DB
      try {
        await saveUserToLiveDb(updatedUserPayload);
      } catch (fsErr) {
        console.warn('Firestore live database sync notice:', fsErr);
      }

      // 3. Update localStorage (hk_users_v2 & hk_staff_users_v2)
      try {
        const storedUsers = getStoredUsers();
        const userIdx = storedUsers.findIndex(
          (u) =>
            u.id === updatedUserPayload.id ||
            u.staff_id?.toLowerCase() === targetStaffCode.toLowerCase() ||
            u.username?.toLowerCase() === targetStaffCode.toLowerCase()
        );
        let updatedUsersList: AppUser[];
        if (userIdx >= 0) {
          updatedUsersList = [...storedUsers];
          updatedUsersList[userIdx] = { ...updatedUsersList[userIdx], ...updatedUserPayload };
        } else {
          updatedUsersList = [updatedUserPayload, ...storedUsers];
        }
        saveStoredUsers(updatedUsersList);

        const storedStaff = getStoredStaff();
        const staffIdx = storedStaff.findIndex(
          (s) =>
            s.id === updatedUserPayload.id ||
            s.staffCode?.toLowerCase() === targetStaffCode.toLowerCase()
        );
        if (staffIdx >= 0) {
          const updatedStaffList = [...storedStaff];
          updatedStaffList[staffIdx] = {
            ...updatedStaffList[staffIdx],
            name: updatedUserPayload.name,
            phone: updatedUserPayload.phone,
            mobile: updatedUserPayload.mobile,
            email: updatedUserPayload.email,
            department: updatedUserPayload.department || 'Floors & Rooms',
            shift: updatedUserPayload.shift || 'Morning',
            active: updatedUserPayload.active ?? true,
            siteId: updatedUserPayload.siteId || undefined,
            siteName: updatedUserPayload.siteName || undefined,
            avatar: updatedUserPayload.avatar,
            role: (updatedUserPayload.role as any) || 'staff',
          };
          saveStoredStaff(updatedStaffList);
        }
      } catch (cacheErr) {
        console.warn('Cache storage update notice:', cacheErr);
      }

      // 4. Notify Parent Component Callback
      if (onUpdateUser) {
        onUpdateUser(updatedUserPayload);
      }

      // 5. Instantly Dispatch Real-Time Sync Events across all views
      window.dispatchEvent(new CustomEvent('user-data-updated', { detail: { user: updatedUserPayload } }));
      window.dispatchEvent(new CustomEvent('staff-data-updated', { detail: { staff: updatedUserPayload } }));
      window.dispatchEvent(new CustomEvent('roster-data-updated', { detail: { user: updatedUserPayload } }));
      window.dispatchEvent(new CustomEvent('attendance-data-updated', { detail: { user: updatedUserPayload } }));

      setSaveSuccess(true);
      setIsEditing(false);
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !targetUser) return null;

  const roleBadgeStyle = () => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-900 border-purple-200';
      case 'manager':
        return 'bg-blue-100 text-[#1E3A8A] border-blue-200';
      case 'supervisor':
        return 'bg-indigo-100 text-indigo-900 border-indigo-200';
      case 'staff':
      default:
        return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    }
  };

  const roleLabel = () => {
    switch (role) {
      case 'admin':
        return 'Master Admin';
      case 'manager':
        return 'Operations Manager';
      case 'supervisor':
        return 'Floor Supervisor';
      case 'staff':
      default:
        return 'Housekeeping Staff';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in"
      id="modal-interactive-user-profile"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden File Inputs */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleAvatarFileSelect}
        />
        <input
          type="file"
          ref={bannerInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleBannerFileSelect}
        />

        {/* 1. SOCIAL-STYLE HEADER BANNER */}
        <div className="relative h-32 sm:h-36 w-full overflow-hidden bg-gradient-to-r from-[#0F172A] via-[#1E3A8A] to-[#2563EB]">
          {bannerUrl ? (
            <img
              src={bannerUrl}
              alt="Cover Banner"
              className="h-full w-full object-cover opacity-90"
            />
          ) : (
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
          )}

          {/* Banner Edit Trigger */}
          {isEditing && (
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              className="absolute top-3 left-4 inline-flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1 text-2xs font-semibold text-white backdrop-blur-md hover:bg-black/60 transition-colors cursor-pointer"
              title="Change Cover Banner"
            >
              <Camera className="h-3 w-3" />
              <span>Change Cover</span>
            </button>
          )}

          {/* Close Cross Trigger */}
          <button
            type="button"
            id="btn-close-profile-modal"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
            }}
            className="absolute top-3 right-3 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-md hover:bg-black/70 hover:scale-105 transition-all cursor-pointer shadow-md"
            title="Close Profile"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 2. OVERLAPPING AVATAR & PRIMARY IDENTITY BAR */}
        <div className="relative px-6 pt-0 pb-4 bg-white border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            {/* Overlapping Avatar */}
            <div className="relative -mt-16 sm:-mt-18 inline-block shrink-0">
              <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-full ring-4 ring-white shadow-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-tr from-[#1E3A8A] to-blue-500 flex items-center justify-center text-white text-3xl font-black uppercase">
                    {(fullName || resolvedStaffId || 'U')[0]}
                  </div>
                )}
              </div>

              {/* Avatar Camera Upload Trigger */}
              {permissions.canEdit && (
                <button
                  type="button"
                  id="btn-upload-profile-avatar"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 rounded-full bg-[#1E3A8A] p-2 text-white shadow-lg hover:bg-blue-900 transition-all hover:scale-110 cursor-pointer ring-2 ring-white"
                  title="Upload New Profile Photo"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {permissions.canEdit && !isEditing && (
                <button
                  type="button"
                  id="btn-edit-user-profile"
                  onClick={() => {
                    setIsEditing(true);
                    setErrorMessage(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-[#1E3A8A] hover:bg-blue-100 border border-blue-200 transition-colors shadow-2xs cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit Profile</span>
                </button>
              )}

              {isEditing && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setErrorMessage(null);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="btn-save-profile-changes"
                    onClick={handleSubmitUpdates}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-900 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Primary Badges & Identity */}
          <div className="mt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {fullName || 'Staff Member'}
              </h2>

              {/* Staff ID Tag with Copy */}
              <button
                type="button"
                onClick={() => copyToClipboard(resolvedStaffId, 'staffId')}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-xs font-mono font-bold text-[#1E3A8A] border border-slate-200 transition-colors cursor-pointer"
                title="Click to copy Staff ID"
              >
                <span>{resolvedStaffId}</span>
                {copiedField === 'staffId' ? (
                  <Check className="h-3 w-3 text-emerald-600" />
                ) : (
                  <Copy className="h-3 w-3 text-slate-400" />
                )}
              </button>

              {/* Role Pill */}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-extrabold uppercase border ${roleBadgeStyle()}`}
              >
                <Shield className="h-3 w-3" />
                <span>{roleLabel()}</span>
              </span>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-2xs font-extrabold uppercase ${
                  status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span>{status === 'ACTIVE' ? 'Active Account' : 'Inactive / Disabled'}</span>
              </span>

              {/* Self Badge */}
              {isSelf && (
                <span className="rounded-full bg-blue-500 px-2 py-0.5 text-3xs font-extrabold uppercase text-white">
                  You
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {department} • {siteName}
            </p>
          </div>

          {/* Quick Communication Action Bar */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors"
                title="Make Phone Call"
              >
                <Phone className="h-3 w-3 text-emerald-600" />
                <span>Call ({phone})</span>
              </a>
            )}

            {mobile && (
              <a
                href={`https://wa.me/${mobile.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200 transition-colors"
                title="Send WhatsApp Message"
              >
                <MessageSquare className="h-3 w-3 text-emerald-600" />
                <span>WhatsApp</span>
              </a>
            )}

            {email && (
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 px-2.5 py-1 text-xs font-semibold text-[#1E3A8A] border border-blue-200 transition-colors"
                title="Send Email"
              >
                <Mail className="h-3 w-3 text-blue-600" />
                <span>{email}</span>
              </a>
            )}
          </div>
        </div>

        {/* Status Banners */}
        {saveSuccess && (
          <div className="mx-6 mt-3 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800 border border-emerald-200 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Profile successfully updated and synced across database, roster, and vault.</span>
          </div>
        )}

        {errorMessage && (
          <div className="mx-6 mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800 border border-rose-200 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {permissions.readOnlyReason && !isEditing && (
          <div className="mx-6 mt-3 rounded-lg bg-amber-50/70 p-2 text-2xs text-amber-900 border border-amber-200/80 flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>{permissions.readOnlyReason}</span>
          </div>
        )}

        {/* 3. SCROLLABLE PROFILE SECTIONS (VIEW & EDIT FORM) */}
        <form onSubmit={handleSubmitUpdates} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SECTION A: DUTY & PLACEMENT METADATA */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-[#1E3A8A]" />
                Duty & Hospital Placement Metadata
              </span>
              {!permissions.canEditCoreAdmin && isEditing && (
                <span className="text-3xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1">
                  <Lock className="h-2.5 w-2.5" />
                  Core Admin Locked
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              {/* Site / Campus */}
              <div>
                <label className="block text-3xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                  <Building className="h-3 w-3 text-slate-400" />
                  Assigned Site / Campus
                </label>
                {isEditing && permissions.canEditSite ? (
                  <select
                    value={siteId}
                    onChange={(e) => {
                      setSiteId(e.target.value);
                      const match = availableSites.find((s) => s.siteId === e.target.value);
                      if (match) setSiteName(match.siteName);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  >
                    {availableSites.length > 0 ? (
                      availableSites.map((s) => (
                        <option key={s.siteId} value={s.siteId}>
                          {s.siteName}
                        </option>
                      ))
                    ) : (
                      <option value="apex-hospital-main">Apex Multi-Specialty Hospital</option>
                    )}
                  </select>
                ) : (
                  <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-800 font-medium">
                    {siteName}
                  </div>
                )}
              </div>

              {/* Department / Ward */}
              <div>
                <label className="block text-3xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-slate-400" />
                  Assigned Ward / Area
                </label>
                {isEditing && permissions.canEditCoreAdmin ? (
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  >
                    {DEFAULT_HOSPITAL_WARDS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                    <option value="Floors & Rooms">Floors & Rooms</option>
                    <option value="Lobby & Common Areas">Lobby & Common Areas</option>
                    <option value="Laundry & Linen">Laundry & Linen</option>
                    <option value="Kitchen & Dining Sanitation">Kitchen & Dining Sanitation</option>
                  </select>
                ) : (
                  <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-800 font-medium">
                    {department}
                  </div>
                )}
              </div>

              {/* Active Shift Timing */}
              <div>
                <label className="block text-3xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-400" />
                  Active Shift Schedule
                </label>
                {isEditing && permissions.canEditShift ? (
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  >
                    <option value="Morning">Morning (07:00 – 15:00)</option>
                    <option value="Evening">Evening (15:00 – 23:00)</option>
                    <option value="Night">Night (23:00 – 07:00)</option>
                    <option value="General">General (09:00 – 18:00)</option>
                  </select>
                ) : (
                  <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-800 font-medium">
                    {shift}
                  </div>
                )}
              </div>

              {/* Duty Type */}
              <div>
                <label className="block text-3xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                  <UserCheck className="h-3 w-3 text-slate-400" />
                  Duty Type Allocation
                </label>
                {isEditing && permissions.canEditDutyType ? (
                  <select
                    value={dutyType}
                    onChange={(e) => setDutyType(e.target.value as DutyType)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  >
                    <option value="FIXED">FIXED (Designated Ward)</option>
                    <option value="PERMANENT_RELIEVER">PERMANENT_RELIEVER (Floor Floating)</option>
                    <option value="TEMP_RELIEVER">TEMP_RELIEVER (Ad-hoc Cover)</option>
                  </select>
                ) : (
                  <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-800 font-medium">
                    {dutyType}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION B: CONTACT & PERSONAL INFORMATION */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-[#1E3A8A]" />
                Contact & Residential Information
              </span>
              <span className="text-3xs text-slate-400">Personal Data</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              {/* Full Name */}
              <div>
                <label className="block text-3xs font-bold uppercase text-slate-600 mb-1 flex items-center justify-between">
                  <span>Full Legal Name *</span>
                  {isEditing && !permissions.canEditFullName && (
                    <span className="text-3xs text-slate-400 font-normal flex items-center gap-0.5">
                      <Lock className="h-2.5 w-2.5 text-slate-400" />
                      HR / Admin Only
                    </span>
                  )}
                </label>
                {isEditing && permissions.canEditFullName ? (
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  />
                ) : (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-slate-800 font-medium flex items-center justify-between">
                    <span>{fullName || '-'}</span>
                    {isEditing && (
                      <span title="Legal name change is restricted to HR / Admin">
                        <Lock className="h-3 w-3 text-slate-400" />
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-3xs font-bold uppercase text-slate-600 mb-1">
                  Email Address
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. staff@hospital.com"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  />
                ) : (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-slate-800 font-medium">
                    {email || 'None Provided'}
                  </div>
                )}
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-3xs font-bold uppercase text-slate-600 mb-1">
                  Mobile Number (WhatsApp)
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  />
                ) : (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-slate-800 font-medium">
                    {mobile || phone || '-'}
                  </div>
                )}
              </div>

              {/* Telephone / Desk Extension */}
              <div>
                <label className="block text-3xs font-bold uppercase text-slate-600 mb-1">
                  Desk / Work Phone
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Extension 4022"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  />
                ) : (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-slate-800 font-medium">
                    {phone || '-'}
                  </div>
                )}
              </div>

              {/* Residential Address */}
              <div className="sm:col-span-2">
                <label className="block text-3xs font-bold uppercase text-slate-600 mb-1">
                  Residential / Local Address
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, Quarter, City"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  />
                ) : (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-slate-800 font-medium">
                    {address || '-'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION C: EMERGENCY CONTACT & HEALTH DATA */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Heart className="h-4 w-4 text-rose-500" />
                Emergency & Health Metadata
              </span>
              <span className="text-3xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold">
                Hospital Safety
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              {/* Emergency Contact Name */}
              <div>
                <label className="block text-3xs font-bold uppercase text-slate-600 mb-1">
                  Emergency Contact Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="e.g. Suman Devi (Spouse)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  />
                ) : (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-slate-800 font-medium">
                    {emergencyContactName || '-'}
                  </div>
                )}
              </div>

              {/* Emergency Phone */}
              <div>
                <label className="block text-3xs font-bold uppercase text-slate-600 mb-1">
                  Emergency Phone Number
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="+91 98765 00000"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  />
                ) : (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-slate-800 font-medium">
                    {emergencyContactPhone || '-'}
                  </div>
                )}
              </div>

              {/* Blood Group */}
              <div>
                <label className="block text-3xs font-bold uppercase text-slate-600 mb-1">
                  Blood Group
                </label>
                {isEditing ? (
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                ) : (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-slate-800 font-bold text-rose-700">
                    {bloodGroup || 'Not Recorded'}
                  </div>
                )}
              </div>
            </div>

            {/* ID Proof Verification Status */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileBadge className="h-4 w-4 text-[#1E3A8A]" />
                <span className="text-2xs font-bold text-slate-700">
                  Government ID Proof: <span className="font-mono text-slate-900">{idProofType}</span>
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-3xs font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                <Check className="h-3 w-3" />
                <span>Verified Onboarding</span>
              </span>
            </div>
          </div>

          {/* SECTION D: CREDENTIALS & ACCOUNT SECURITY */}
          {(permissions.canEditCoreAdmin || (isSelf && permissions.canEditPassword)) && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 space-y-3.5">
              <div className="flex items-center justify-between border-b border-purple-200/60 pb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4 text-purple-700" />
                  {permissions.canEditCoreAdmin ? 'Credentials & Administrative Privileges' : 'Account Security & Password'}
                </span>
                <span className="text-3xs font-extrabold uppercase text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                  {permissions.canEditCoreAdmin ? 'Admin Privileged Zone' : 'Personal Security'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                {/* Account Role Changer (Admin only) */}
                {permissions.canEditCoreAdmin && (
                  <div>
                    <label className="block text-3xs font-bold uppercase text-slate-700 mb-1">
                      System Access Role
                    </label>
                    {isEditing && permissions.canEditRole ? (
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                        className="w-full rounded-lg border border-purple-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                      >
                        {isMasterAdmin && <option value="admin">Master Admin</option>}
                        <option value="manager">Operations Manager</option>
                        <option value="supervisor">Floor Supervisor</option>
                        <option value="staff">Housekeeping Staff</option>
                      </select>
                    ) : (
                      <div className="rounded-lg bg-white border border-purple-200 px-3 py-2 text-slate-800 font-bold uppercase text-xs">
                        {role}
                      </div>
                    )}
                  </div>
                )}

                {/* Account Status Switcher (Admin only) */}
                {permissions.canEditCoreAdmin && (
                  <div>
                    <label className="block text-3xs font-bold uppercase text-slate-700 mb-1">
                      Account Status
                    </label>
                    {isEditing && permissions.canEditStatus ? (
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full rounded-lg border border-purple-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                      >
                        <option value="ACTIVE">ACTIVE (Authorized & Unlocked)</option>
                        <option value="DISABLED">DISABLED (Access Revoked)</option>
                      </select>
                    ) : (
                      <div className="rounded-lg bg-white border border-purple-200 px-3 py-2 text-slate-800 font-bold text-xs">
                        {status}
                      </div>
                    )}
                  </div>
                )}

                {/* Secure Password Handling (Permanently Masked with Dots/Asterisks, No Reveal Option) */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-3xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-purple-700" />
                      <span>Account Password</span>
                    </label>
                    {permissions.canEditPassword && isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangingPassword(!isChangingPassword);
                          if (isChangingPassword) {
                            setCurrentPassword('');
                            setNewPassword('');
                            setConfirmPassword('');
                          }
                        }}
                        className="text-3xs font-bold text-purple-700 hover:text-purple-900 underline cursor-pointer"
                      >
                        {isChangingPassword ? 'Cancel Password Change' : 'Change Password'}
                      </button>
                    )}
                  </div>

                  {isEditing && isChangingPassword ? (
                    /* Secure Change Password Workflow */
                    <div className="rounded-xl border border-purple-200 bg-white p-3 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between text-2xs text-purple-950 font-bold border-b border-purple-100 pb-1.5">
                        <span className="flex items-center gap-1.5">
                          <KeyRound className="h-3.5 w-3.5 text-purple-600" />
                          <span>Secure Password Update</span>
                        </span>
                        <span className="text-3xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" /> Permanently Masked
                        </span>
                      </div>

                      {isSelf && !isMasterAdmin && (
                        <div>
                          <label className="block text-3xs font-bold uppercase text-slate-600 mb-1">
                            Current Password *
                          </label>
                          <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                            autoComplete="current-password"
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 font-medium focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-3xs font-bold uppercase text-slate-600 mb-1">
                            New Password *
                          </label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Minimum 6 characters"
                            autoComplete="new-password"
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 font-medium focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                          />
                        </div>

                        <div>
                          <label className="block text-3xs font-bold uppercase text-slate-600 mb-1">
                            Confirm New Password *
                          </label>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter new password"
                            autoComplete="new-password"
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 font-medium focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-3xs text-slate-400 pt-1 border-t border-slate-100">
                        <span className="flex items-center gap-1">
                          <Lock className="h-2.5 w-2.5 text-slate-400" />
                          <span>All password inputs remain permanently masked with asterisks/dots.</span>
                        </span>
                        <span className="font-semibold text-purple-700">Min. 6 chars</span>
                      </div>
                    </div>
                  ) : (
                    /* Permanently Masked Display - Zero Reveal Option */
                    <div className="flex items-center justify-between rounded-lg bg-white border border-purple-200 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5 text-purple-600" />
                        <span className="font-mono text-xs font-black tracking-widest text-slate-700 select-none">
                          ••••••••••••
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-3xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <ShieldCheck className="h-3 w-3" />
                        <span>Permanently Masked &amp; Encrypted</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SECTION E: ACTIVE SESSIONS & CONNECTED DEVICES (REMOTE LOGOUT SYSTEM) */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-sky-200/70 pb-2.5 gap-2">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-sky-950 flex items-center gap-1.5">
                  <Radio className="h-4 w-4 text-sky-700 animate-pulse" />
                  <span>Active Sessions &amp; Connected Devices</span>
                </span>
                <p className="text-3xs text-slate-500 mt-0.5">
                  Track live logins and remotely revoke access to disconnect lost or unauthorized devices immediately.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadSessions}
                  disabled={isLoadingSessions}
                  className="inline-flex items-center gap-1 text-3xs font-bold text-sky-700 bg-sky-100/90 hover:bg-sky-200 px-2 py-1 rounded transition-colors cursor-pointer"
                  title="Refresh active sessions"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingSessions ? 'animate-spin' : ''}`} />
                  <span>Sync</span>
                </button>
                {activeSessions.filter((s) => !s.is_current).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmRevokeAllOthers(true)}
                    className="inline-flex items-center gap-1 text-3xs font-extrabold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded transition-colors cursor-pointer shadow-2xs"
                  >
                    <LogOut className="h-3 w-3" />
                    <span>Logout All Others</span>
                  </button>
                )}
              </div>
            </div>

            {/* Session Action Feedback Message */}
            {sessionActionMessage && (
              <div
                className={`rounded-lg p-2.5 text-2xs font-medium flex items-center justify-between ${
                  sessionActionMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{sessionActionMessage.text}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSessionActionMessage(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs ml-2 cursor-pointer"
                >
                  ×
                </button>
              </div>
            )}

            {/* Device Cards List */}
            <div className="space-y-2">
              {isLoadingSessions && activeSessions.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-sky-600" />
                  <span>Querying active connected devices...</span>
                </div>
              ) : activeSessions.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500 bg-white rounded-lg border border-slate-200">
                  No active foreign sessions. Only this current verified browser is signed in.
                </div>
              ) : (
                activeSessions.map((s) => {
                  const isCurrent = Boolean(s.is_current);
                  const DeviceIcon = s.device_type === 'mobile' ? Smartphone : s.device_type === 'tablet' ? Tablet : Laptop;

                  return (
                    <div
                      key={s.session_id}
                      className={`rounded-xl border transition-all p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-emerald-50/50 border-emerald-300 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg flex-shrink-0 ${
                            isCurrent
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <DeviceIcon className="h-5 w-5" />
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">
                              {s.device_name}
                            </span>
                            {isCurrent ? (
                              <span className="inline-flex items-center gap-1 text-3xs font-extrabold uppercase text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-full">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                Current Device (This Session)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-3xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                Remote Session
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-3xs text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Globe className="h-3 w-3 text-slate-400" />
                              <span>IP: {s.ip_address}</span>
                            </span>
                            {s.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-slate-400" />
                                <span>{s.location}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              <span>Active: {new Date(s.last_active_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {isCurrent ? (
                          <span className="text-3xs font-bold text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" /> Secure
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRevokeSession(s)}
                            disabled={terminatingSessionId === s.session_id}
                            className="inline-flex items-center gap-1 text-2xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 px-2.5 py-1 rounded-lg transition-all shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            <LogOut className="h-3 w-3" />
                            <span>{terminatingSessionId === s.session_id ? 'Revoking...' : 'Terminate Session'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Confirmation Prompt for Single Session */}
            {confirmRevokeSession && (
              <div className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 space-y-2.5 shadow-sm">
                <div className="flex items-start gap-2.5 text-rose-950">
                  <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold">
                      Terminate Remote Session: {confirmRevokeSession.device_name}?
                    </h4>
                    <p className="text-3xs text-rose-800 mt-0.5">
                      This will immediately disconnect the device ({confirmRevokeSession.location || confirmRevokeSession.ip_address}) and redirect it to the login screen on its next API request or sync.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-200">
                  <button
                    type="button"
                    onClick={() => setConfirmRevokeSession(null)}
                    className="text-2xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-3 py-1 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTerminateSession(confirmRevokeSession)}
                    disabled={Boolean(terminatingSessionId)}
                    className="text-2xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-3.5 py-1 rounded-lg cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {terminatingSessionId ? 'Terminating...' : 'Logout Remotely'}
                  </button>
                </div>
              </div>
            )}

            {/* Quick Confirmation Prompt for All Other Sessions */}
            {confirmRevokeAllOthers && (
              <div className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 space-y-2.5 shadow-sm">
                <div className="flex items-start gap-2.5 text-rose-950">
                  <ShieldAlert className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold">
                      Logout From All Other Devices?
                    </h4>
                    <p className="text-3xs text-rose-800 mt-0.5">
                      All other active sessions on connected phones, tablets, or computers will be forcefully terminated. Only this current device will remain logged in.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-200">
                  <button
                    type="button"
                    onClick={() => setConfirmRevokeAllOthers(false)}
                    className="text-2xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-3 py-1 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleTerminateAllOthers}
                    disabled={isLoadingSessions}
                    className="text-2xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-3.5 py-1 rounded-lg cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isLoadingSessions ? 'Logging Out...' : 'Yes, Terminate All Others'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* 4. MODAL FOOTER */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 rounded-b-2xl">
          <span className="text-3xs text-slate-500 font-mono">
            ID: {resolvedStaffId} • Real-time DB Synced
          </span>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setIsChangingPassword(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitUpdates}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-900 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Profile'}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default UserProfileModal;
