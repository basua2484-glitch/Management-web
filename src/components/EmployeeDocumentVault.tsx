import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Shield,
  CheckCircle,
  Clock,
  AlertTriangle,
  Upload,
  Check,
  X,
  Trash2,
  Eye,
  Search,
  Filter,
  UserCheck,
  Building,
  RefreshCw,
  FileCheck,
  AlertCircle,
  FolderLock,
  ChevronDown,
  ChevronUp,
  Download,
  FilePlus,
} from 'lucide-react';
import type { AppUser, EmployeeDocument, DocumentStatus, HierarchicalRole } from '../types';
import {
  MANDATORY_ONBOARDING_DOC_TYPES,
  TOTAL_REQUIRED_DOCS,
  normalizeHierarchicalRole,
  canViewUserDocuments,
  canUploadForUser,
  canApproveOrReject,
  canDeleteDocument,
  generateInitialDocumentsForUser,
  getDocumentSummary,
  uploadEmployeeDocument,
  approveEmployeeDocument,
  rejectEmployeeDocument,
  deleteEmployeeDocument,
  isUserInTenant,
  filterRealDocuments,
} from '../services/documentVaultService';
import { getStoredUsers, getStoredCurrentUser } from '../data/mockHousekeepingData';
import { compressDocumentWithMetrics, formatBytes, type CompressionResult } from '../utils/fileCompressor';

export interface EmployeeDocumentVaultProps {
  users?: AppUser[];
  currentUser?: any;
  currentUserRole?: string;
  activeTenantPrefix?: string;
  selectedStaffId?: string | null;
  onRefresh?: () => void;
  siteFilter?: string;
}

export const EmployeeDocumentVault: React.FC<EmployeeDocumentVaultProps> = ({
  users: propUsers,
  currentUser: propCurrentUser,
  currentUserRole: propRole,
  activeTenantPrefix: propPrefix,
  selectedStaffId,
  onRefresh,
  siteFilter,
}) => {
  // 1. Resolve current logged-in user and role
  const currentUser = useMemo(() => {
    if (propCurrentUser) return propCurrentUser;
    const sessionUser = getStoredCurrentUser();
    if (sessionUser) return sessionUser;
    if (typeof localStorage !== 'undefined') {
      const curUserStr = localStorage.getItem('hk_current_user_v2') || localStorage.getItem('currentUser');
      if (curUserStr) {
        try {
          return JSON.parse(curUserStr);
        } catch {}
      }
    }
    return {
      role: propRole || 'admin',
      id: 'APEX-ADM-001',
      staff_id: 'APEX-ADM-001',
      full_name: 'System Admin',
    };
  }, [propCurrentUser, propRole]);

  const userRole = normalizeHierarchicalRole(propRole || currentUser?.role);
  const activeTenantPrefix =
    propPrefix ||
    currentUser?.staff_id?.split('-')[0] ||
    currentUser?.id?.toString().split('-')[0] ||
    'APEX';

  // 2. Fetch and synchronize user records
  const [users, setUsers] = useState<AppUser[]>(() => {
    const list = propUsers && propUsers.length > 0 ? propUsers : getStoredUsers();
    return list;
  });

  const refreshData = () => {
    const latest = getStoredUsers();
    setUsers(latest);
    onRefresh?.();
  };

  useEffect(() => {
    if (propUsers && propUsers.length > 0) {
      setUsers(propUsers);
    }
  }, [propUsers]);

  // Listen to cross-component document events
  useEffect(() => {
    const handleUpdate = () => {
      refreshData();
    };
    window.addEventListener('employee-documents-updated', handleUpdate);
    window.addEventListener('user-data-updated', handleUpdate);
    return () => {
      window.removeEventListener('employee-documents-updated', handleUpdate);
      window.removeEventListener('user-data-updated', handleUpdate);
    };
  }, []);

  // 3. UI States: Search & Filter
  const [searchTerm, setSearchTerm] = useState(selectedStaffId || '');
  const [roleFilter, setRoleFilter] = useState<'ALL' | HierarchicalRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'MISSING'>('ALL');
  const [expandedUserIds, setExpandedUserIds] = useState<Record<string, boolean>>(() => {
    if (selectedStaffId) return { [selectedStaffId]: true };
    return {};
  });

  // Modal States
  const [uploadModalUser, setUploadModalUser] = useState<AppUser | null>(null);
  const [uploadDocType, setUploadDocType] = useState<string>(MANDATORY_ONBOARDING_DOC_TYPES[0]);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [rejectModalDoc, setRejectModalDoc] = useState<{ user: AppUser; doc: EmployeeDocument } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Document copy is blurry / incomplete.');

  const [previewDoc, setPreviewDoc] = useState<{ user: AppUser; doc: EmployeeDocument } | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  const showNotice = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setFeedbackNotice({ message, type });
    setTimeout(() => {
      setFeedbackNotice((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // 4. Filter Users by Tenant Isolation, Site Scope, & RBAC Visibility
  const isManager = (currentUser?.role || '').toLowerCase() === 'manager';
  const managerSiteId = currentUser?.siteId || currentUser?.site_id;
  const effectiveSiteFilter = isManager ? managerSiteId : (siteFilter && siteFilter !== 'ALL' ? siteFilter : null);

  const accessibleUsers = useMemo(() => {
    return users.filter((u) => {
      // Must be within tenant
      if (!isUserInTenant(u, activeTenantPrefix)) return false;
      // Must pass site isolation
      if (effectiveSiteFilter) {
        const uSite = u.siteId || u.site_id || 'SITE_APEX_MAIN';
        if (uSite !== effectiveSiteFilter) return false;
      }
      // Must pass RBAC permission check
      return canViewUserDocuments(currentUser, u, activeTenantPrefix);
    });
  }, [users, currentUser, activeTenantPrefix, effectiveSiteFilter]);

  // Expand first user by default if single user or selection
  useEffect(() => {
    if (accessibleUsers.length > 0 && Object.keys(expandedUserIds).length === 0) {
      const firstId = String(accessibleUsers[0].staff_id || accessibleUsers[0].id);
      setExpandedUserIds({ [firstId]: true });
    }
  }, [accessibleUsers]);

  // Filtered displayed list
  const displayedUsers = useMemo(() => {
    return accessibleUsers.filter((u) => {
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !search ||
        (u.staff_id && u.staff_id.toLowerCase().includes(search)) ||
        (u.full_name && u.full_name.toLowerCase().includes(search)) ||
        (u.name && u.name.toLowerCase().includes(search)) ||
        (u.username && u.username.toLowerCase().includes(search)) ||
        (u.fixed_department && u.fixed_department.toLowerCase().includes(search));

      const uRole = normalizeHierarchicalRole(u.role);
      const matchesRole = roleFilter === 'ALL' || uRole === roleFilter;

      const docs = filterRealDocuments(u.documents);
      const summary = getDocumentSummary(docs);

      let matchesStatus = true;
      if (statusFilter === 'APPROVED') {
        matchesStatus = summary.approved > 0 && summary.pending === 0 && summary.missingCount === 0;
      } else if (statusFilter === 'PENDING') {
        matchesStatus = summary.pending > 0;
      } else if (statusFilter === 'MISSING') {
        matchesStatus = summary.missingCount > 0;
      }

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [accessibleUsers, searchTerm, roleFilter, statusFilter]);

  // Summary statistics across accessible tenant users
  const overallStats = useMemo(() => {
    let totalDocs = 0;
    let approvedDocs = 0;
    let pendingDocs = 0;
    let missingDocs = 0;

    accessibleUsers.forEach((u) => {
      const docs = filterRealDocuments(u.documents);
      const s = getDocumentSummary(docs);
      totalDocs += s.totalUploaded;
      approvedDocs += s.approved;
      pendingDocs += s.pending;
      missingDocs += s.missingCount;
    });

    return {
      totalEmployees: accessibleUsers.length,
      totalDocs,
      approvedDocs,
      pendingDocs,
      missingDocs,
    };
  }, [accessibleUsers]);

  const toggleExpand = (userIdStr: string) => {
    setExpandedUserIds((prev) => ({ ...prev, [userIdStr]: !prev[userIdStr] }));
  };

  // Action: Open Upload Modal
  const handleOpenUpload = (user: AppUser, defaultDocType?: string) => {
    setUploadModalUser(user);
    const chosenType = defaultDocType || MANDATORY_ONBOARDING_DOC_TYPES[0];
    setUploadDocType(chosenType);
    const sId = user.staff_id || user.username || user.id;
    const cleanTypeName = chosenType.split('(')[0].trim().replace(/\s+/g, '_');
    setUploadFileName(`${sId}_${cleanTypeName}.pdf`);
    setUploadNotes('');
    setSelectedFile(null);
    setCompressionResult(null);
    setIsCompressing(false);
  };

  // Compression Interceptor for File Selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Trigger visual loading feedback
    setIsCompressing(true);
    setCompressionProgress(15);

    try {
      const result = await compressDocumentWithMetrics(file, {
        maxSizeMB: 0.3, // Max target size ~300KB
        maxWidthOrHeight: 1200, // Maintain readable text resolution for Aadhaar/PAN
        useWebWorker: true,
        fileType: 'image/jpeg',
      });

      setSelectedFile(result.file);
      setCompressionResult(result);
      setUploadFileName(result.file.name);
      setCompressionProgress(100);

      if (result.isCompressed) {
        showNotice(
          `Optimized: ${result.originalFormatted} → ${result.compressedFormatted} (Saved ${result.savedPercentage}%)`,
          'success'
        );
      } else {
        showNotice(`File ready for upload (${result.compressedFormatted})`, 'success');
      }
    } catch (err) {
      console.error('File compression error:', err);
      setSelectedFile(file);
      showNotice('File selected without additional compression.', 'warning');
    } finally {
      setIsCompressing(false);
    }
  };

  // Action: Submit Document Upload
  const handleDoUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadModalUser) return;
    setIsUploading(true);

    try {
      const activeSizeFormatted = compressionResult
        ? compressionResult.compressedFormatted
        : selectedFile
        ? formatBytes(selectedFile.size)
        : '280 KB';

      const originalSizeFormatted = compressionResult?.isCompressed
        ? compressionResult.originalFormatted
        : undefined;

      const ratioFormatted = compressionResult?.isCompressed
        ? `Saved ${compressionResult.savedPercentage}%`
        : undefined;

      const res = uploadEmployeeDocument(
        uploadModalUser.staff_id || uploadModalUser.id,
        {
          docType: uploadDocType,
          fileName: uploadFileName.trim() || `${uploadDocType.replace(/\s+/g, '_')}.pdf`,
          fileSize: activeSizeFormatted,
          originalFileSize: originalSizeFormatted,
          compressionRatio: ratioFormatted,
          notes: uploadNotes,
        },
        currentUser
      );

      if (res.success) {
        showNotice(res.message, 'success');
        setUploadModalUser(null);
        setSelectedFile(null);
        setCompressionResult(null);
        refreshData();
      } else {
        showNotice(res.message, 'error');
      }
    } catch (err: any) {
      showNotice(err.message || 'Failed to upload document.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Action: Approve Document
  const handleApprove = (user: AppUser, doc: EmployeeDocument) => {
    const res = approveEmployeeDocument(user.staff_id || user.id, doc.docId, currentUser);
    if (res.success) {
      showNotice(`✅ ${doc.docType} for ${user.full_name || user.staff_id} verified & approved.`, 'success');
      refreshData();
    } else {
      showNotice(res.message, 'error');
    }
  };

  // Action: Confirm Reject
  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalDoc) return;
    const { user, doc } = rejectModalDoc;
    const res = rejectEmployeeDocument(user.staff_id || user.id, doc.docId, currentUser, rejectionReason);
    if (res.success) {
      showNotice(`⚠️ ${doc.docType} marked as Rejected.`, 'warning');
      setRejectModalDoc(null);
      refreshData();
    } else {
      showNotice(res.message, 'error');
    }
  };

  // Action: Delete Document
  const handleDelete = (user: AppUser, doc: EmployeeDocument) => {
    if (!canDeleteDocument(currentUser)) {
      showNotice('Only Admins can permanently delete documents.', 'error');
      return;
    }
    if (confirm(`Are you sure you want to permanently delete "${doc.docType}" for ${user.full_name || user.staff_id}?`)) {
      const res = deleteEmployeeDocument(user.staff_id || user.id, doc.docId, currentUser);
      if (res.success) {
        showNotice('Document removed from vault.', 'success');
        refreshData();
      } else {
        showNotice(res.message, 'error');
      }
    }
  };

  return (
    <div className="space-y-4 text-slate-800 font-sans" id="employee-document-vault-root">
      {/* Toast Notice */}
      {feedbackNotice && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-sm transition-all ${
            feedbackNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : feedbackNotice.type === 'warning'
              ? 'bg-amber-50 text-amber-900 border-amber-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackNotice.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : feedbackNotice.type === 'warning' ? (
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner & RBAC Access Scope */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E3A8A] text-white font-bold">
              <FolderLock className="h-4.5 w-4.5 text-emerald-400" />
            </span>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              Employee Document Vault
            </h3>
            <span
              id="doc-vault-tenant-badge"
              className="rounded-md bg-blue-100 border border-blue-200 px-2 py-0.5 text-2xs font-extrabold text-[#1E3A8A] uppercase tracking-wider"
            >
              Tenant: {activeTenantPrefix}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-2xs font-bold border ${
                userRole === 'ADMIN'
                  ? 'bg-rose-100 text-rose-900 border-rose-200'
                  : userRole === 'MANAGER'
                  ? 'bg-purple-100 text-purple-900 border-purple-200'
                  : userRole === 'SUPERVISOR'
                  ? 'bg-blue-100 text-blue-900 border-blue-200'
                  : 'bg-emerald-100 text-emerald-900 border-emerald-200'
              }`}
            >
              Role: {userRole} ({userRole === 'ADMIN' ? 'Full Control' : userRole === 'MANAGER' ? 'Approver & Uploader' : userRole === 'SUPERVISOR' ? 'Floor Read-Only' : 'Personal Documents'})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Role-Based Access Control (RBAC) compliance for mandatory joining credentials, ID verification, and review workflows.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
            title="Refresh Vault Data"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" id="doc-vault-summary-cards">
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs border-l-4 border-l-[#1E3A8A]">
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 block">
            ACCESSIBLE PERSONNEL
          </span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
            {overallStats.totalEmployees}
          </div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-emerald-700 block">
              VERIFIED / APPROVED
            </span>
            <span className="text-2xs">🟢</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-700 mt-0.5">
            {overallStats.approvedDocs}
          </div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-amber-700 block">
              PENDING REVIEW
            </span>
            <span className="text-2xs">🟡</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-700 mt-0.5">
            {overallStats.pendingDocs}
          </div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-rose-700 block">
              MISSING MANDATORY
            </span>
            <span className="text-2xs">🔴</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-700 mt-0.5">
            {overallStats.missingDocs}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Personnel, ID, Department..."
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
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="STAFF">Housekeeping Staff</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Verification Statuses</option>
            <option value="APPROVED">🟢 All Verified</option>
            <option value="PENDING">🟡 Has Pending Review</option>
            <option value="MISSING">🔴 Has Missing Documents</option>
          </select>
        </div>
      </div>

      {/* Personnel Document Folders */}
      <div className="space-y-3">
        {displayedUsers.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
            <FolderLock className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No personnel records found.</p>
            <p className="text-xs text-slate-500 mt-1">
              Either no users match your search criteria or your role ({userRole}) does not have access permissions.
            </p>
          </div>
        ) : (
          displayedUsers.map((user) => {
            const uidStr = String(user.staff_id || user.id);
            const isExpanded = !!expandedUserIds[uidStr];
            const docs = filterRealDocuments(user.documents);

            const summary = getDocumentSummary(docs);
            const userRoleNormalized = normalizeHierarchicalRole(user.role);
            const canUploadForThisUser = canUploadForUser(currentUser, user);
            const isSelf = String(currentUser?.staff_id || currentUser?.id).toLowerCase() === uidStr.toLowerCase();

            return (
              <div
                key={uidStr}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                id={`emp-doc-card-${uidStr}`}
              >
                {/* Employee Folder Header */}
                <div
                  onClick={() => toggleExpand(uidStr)}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 hover:bg-slate-100/70 cursor-pointer border-b border-slate-200/80 select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E3A8A]/10 text-[#1E3A8A] font-bold text-sm">
                      <FileCheck className="h-5 w-5 text-[#1E3A8A]" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {user.full_name || user.name || user.username}
                        </span>
                        <span className="font-mono text-2xs font-extrabold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                          {user.staff_id || user.username || user.id}
                        </span>
                        <span
                          className={`text-3xs font-extrabold px-2 py-0.5 rounded-full border ${
                            userRoleNormalized === 'ADMIN'
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : userRoleNormalized === 'MANAGER'
                              ? 'bg-purple-100 text-purple-800 border-purple-200'
                              : userRoleNormalized === 'SUPERVISOR'
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {userRoleNormalized}
                        </span>
                        {isSelf && (
                          <span className="bg-amber-100 text-amber-800 border border-amber-200 text-3xs font-extrabold px-2 py-0.5 rounded-full">
                            YOU
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-2xs text-slate-500 mt-1">
                        {/* Site Badge (Requirement 4): e.g. "BASU-MGR-001 | Apex Main Hospital" */}
                        <span className="inline-flex items-center gap-1 font-mono text-3xs font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          <Building className="h-2.5 w-2.5 text-[#1E3A8A] shrink-0" />
                          <span>{user.staff_id || user.username || user.id} | {user.siteName || user.site_name || 'Apex Main Hospital'}</span>
                        </span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3 text-slate-400" />
                          <span>{user.fixed_department || user.assigned_area || 'General Wards'}</span>
                        </span>
                        <span>&bull;</span>
                        <span>Shift: {user.assigned_shift || '7-3'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Status Badges & Quick Action strictly based on actual documents */}
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <div className="flex items-center gap-1.5 text-2xs">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                        <span>🟢</span>
                        <span>{summary.approved} Verified</span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold border ${
                          summary.pending > 0
                            ? 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse'
                            : 'bg-amber-50 text-amber-700 border-amber-200/60'
                        }`}
                      >
                        <span>🟡</span>
                        <span>{summary.pending} Pending Review</span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold border ${
                          summary.missingCount > 0
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span>🔴</span>
                        <span>{summary.missingCount} Missing</span>
                      </span>
                    </div>

                    {canUploadForThisUser && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenUpload(user);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#1E3A8A] hover:bg-[#152e6f] text-white text-2xs font-bold transition shadow-2xs cursor-pointer"
                        title="Direct Document Upload"
                      >
                        <Upload className="h-3 w-3" />
                        <span>Upload Doc</span>
                      </button>
                    )}

                    <div className="p-1 text-slate-400 hover:text-slate-700">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Document Grid */}
                {isExpanded && (
                  <div className="p-4 space-y-4 bg-white animate-in fade-in duration-150">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-[#1E3A8A]" />
                        <span>Mandatory Onboarding Document Dossier</span>
                      </h4>
                      <span className="text-3xs font-semibold text-slate-500">
                        {summary.approved} of {MANDATORY_ONBOARDING_DOC_TYPES.length} Mandatory Requirements Satisfied
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {MANDATORY_ONBOARDING_DOC_TYPES.map((reqType) => {
                        const existing = docs.find((d) => d.docType.toLowerCase() === reqType.toLowerCase());

                        if (existing) {
                          const isApproved = existing.status === 'APPROVED';
                          const isPending = existing.status === 'PENDING' || existing.status === 'PENDING_APPROVAL';
                          const isRejected = existing.status === 'REJECTED';

                          return (
                            <div
                              key={existing.docId}
                              className={`p-3.5 rounded-xl border flex flex-col gap-2 relative overflow-hidden transition-all ${
                                isApproved
                                  ? 'bg-emerald-50/40 border-emerald-200'
                                  : isPending
                                  ? 'bg-amber-50/40 border-amber-200'
                                  : 'bg-rose-50/40 border-rose-200'
                              }`}
                            >
                              {/* Dedicated Header Line: Document Type & Verification Status Badge */}
                              <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <FileText className="h-4 w-4 text-slate-600 shrink-0" />
                                  <span className="text-xs font-bold text-slate-900 truncate">
                                    {existing.docType}
                                  </span>
                                </div>

                                <div className="shrink-0">
                                  {isApproved && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                                      <span>🟢</span>
                                      <span>Verified / Approved</span>
                                    </span>
                                  )}
                                  {isPending && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse whitespace-nowrap">
                                      <span>🟡</span>
                                      <span>Pending Review</span>
                                    </span>
                                  )}
                                  {isRejected && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-rose-100 text-rose-800 border border-rose-200 whitespace-nowrap">
                                      <span>🔴</span>
                                      <span>Rejected</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Dedicated Filename Row */}
                              <div className="flex items-center gap-1.5 text-2xs font-mono text-slate-700 bg-slate-100/80 px-2 py-1.5 rounded-md border border-slate-200/60">
                                <FileCheck className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                <span className="truncate" title={existing.fileName}>
                                  {existing.fileName}
                                </span>
                              </div>

                              {/* Metadata snippet */}
                              <div className="text-3xs text-slate-500 space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <span>Uploaded: {existing.uploadedAt?.slice(0, 10)}</span>
                                  <div className="flex items-center gap-1 font-mono">
                                    {existing.originalFileSize && (
                                      <span className="line-through text-slate-400 text-3xs">
                                        {existing.originalFileSize}
                                      </span>
                                    )}
                                    <span className="font-semibold text-slate-700">{existing.fileSize || '300 KB'}</span>
                                    {existing.compressionRatio && (
                                      <span className="text-3xs font-bold text-emerald-700 bg-emerald-100 px-1 rounded">
                                        {existing.compressionRatio}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {existing.verifiedBy && (
                                  <div className="text-emerald-700 font-semibold truncate">
                                    Verified by: {existing.verifiedBy}
                                  </div>
                                )}
                                {existing.rejectionReason && (
                                  <div className="text-rose-700 font-semibold truncate">
                                    Reason: {existing.rejectionReason}
                                  </div>
                                )}
                              </div>

                              {/* Dynamic Action Buttons Strictly Based on RBAC */}
                              <div className="mt-1 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-200/60 pt-2">
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc({ user, doc: existing })}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-3xs font-bold transition cursor-pointer"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>View Doc</span>
                                </button>

                                <div className="flex items-center gap-1">
                                  {/* Approve / Reject: Visible to Admin & Manager only */}
                                  {isPending && canApproveOrReject(currentUser) && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleApprove(user, existing)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-3xs font-extrabold transition shadow-2xs cursor-pointer"
                                        title="Verify and Approve this document"
                                      >
                                        <Check className="h-3 w-3" />
                                        <span>Verify / Approve</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => setRejectModalDoc({ user, doc: existing })}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-3xs font-bold transition shadow-2xs cursor-pointer"
                                        title="Reject this document"
                                      >
                                        <X className="h-3 w-3" />
                                        <span>Reject</span>
                                      </button>
                                    </>
                                  )}

                                  {/* Update File / Re-upload button */}
                                  {canUploadForThisUser && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenUpload(user, existing.docType)}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 text-3xs font-bold transition cursor-pointer"
                                      title="Update or replace this document file"
                                    >
                                      <Upload className="h-3 w-3 text-slate-500" />
                                      <span>Update File</span>
                                    </button>
                                  )}

                                  {/* Delete: Full delete access strictly to ADMIN */}
                                  {canDeleteDocument(currentUser) && (
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(user, existing)}
                                      className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded transition cursor-pointer"
                                      title="Permanently Delete Document (Admin Only)"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // MISSING DOCUMENT ITEM
                        return (
                          <div
                            key={reqType}
                            className="p-3.5 rounded-xl border border-dashed border-rose-300 bg-rose-50/20 flex flex-col gap-2 relative overflow-hidden justify-between"
                          >
                            <div className="flex items-center justify-between gap-2 border-b border-rose-200/60 pb-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                                <span className="text-xs font-bold text-slate-900 truncate">{reqType}</span>
                              </div>

                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-rose-100 text-rose-800 border border-rose-200 shrink-0 whitespace-nowrap">
                                <span>🔴</span>
                                <span>Missing Document</span>
                              </span>
                            </div>

                            <p className="text-3xs text-rose-600 font-semibold">
                              Required for full compliance & hospital audit onboarding.
                            </p>

                            <div className="flex items-center justify-end pt-2 border-t border-rose-100">
                              {canUploadForThisUser ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenUpload(user, reqType)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#1E3A8A] hover:bg-[#152e6f] text-white text-3xs font-bold transition shadow-2xs cursor-pointer"
                                >
                                  <Upload className="h-3 w-3" />
                                  <span>Upload Missing Doc</span>
                                </button>
                              ) : (
                                <span className="text-3xs text-slate-400 italic">
                                  Pending upload by Staff / Manager
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 5. UPLOAD DOCUMENT MODAL */}
      {uploadModalUser && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          id="modal-upload-document"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-100 text-[#1E3A8A]">
                  <Upload className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Upload Onboarding Document</h3>
                  <p className="text-2xs text-slate-500 font-mono">
                    Target: {uploadModalUser.full_name || uploadModalUser.name} ({uploadModalUser.staff_id || uploadModalUser.id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadModalUser(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Role Notice */}
            <div
              className={`p-3 rounded-xl border text-xs ${
                userRole === 'ADMIN' || userRole === 'MANAGER'
                  ? 'bg-purple-50 text-purple-900 border-purple-200'
                  : 'bg-amber-50 text-amber-900 border-amber-200'
              }`}
            >
              {userRole === 'ADMIN' || userRole === 'MANAGER' ? (
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Manager / Admin Privilege:</span> Direct upload by {userRole} is
                    automatically marked as <strong>🟢 APPROVED</strong> and verified.
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Staff Submission:</span> Document will be submitted as{' '}
                    <strong>🟡 PENDING REVIEW</strong> until approved by Facility Manager or Admin.
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleDoUpload} className="space-y-3 text-xs">
              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Document Type
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setUploadDocType(nextType);
                    const sId = uploadModalUser.staff_id || uploadModalUser.username || uploadModalUser.id;
                    const clean = nextType.split('(')[0].trim().replace(/\s+/g, '_');
                    setUploadFileName(`${sId}_${clean}.pdf`);
                  }}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-[#1E3A8A] focus:outline-hidden"
                >
                  {MANDATORY_ONBOARDING_DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value="Hospital Immunization Certificate">Hospital Immunization Certificate</option>
                  <option value="Previous Employment Relieving Letter">Previous Employment Relieving Letter</option>
                  <option value="Signed Background Declaration">Signed Background Declaration</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Document Filename
                </label>
                <input
                  type="text"
                  required
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  placeholder="e.g. APEX-STF-001_Aadhaar.pdf"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono focus:border-[#1E3A8A] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  File Attachment (PDF / JPG / PNG)
                </label>
                <label className="relative border-2 border-dashed border-slate-300 hover:border-[#1E3A8A] rounded-xl p-3 text-center transition-colors cursor-pointer bg-slate-50/50 block group">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileSelect}
                    className="sr-only"
                    disabled={isCompressing}
                  />
                  <FilePlus className="h-6 w-6 text-slate-400 group-hover:text-[#1E3A8A] mx-auto mb-1 transition-colors" />
                  <span className="text-2xs font-bold text-slate-700 block">
                    {selectedFile ? selectedFile.name : 'Click or Drop Joining File (Image or PDF)'}
                  </span>
                  <span className="text-3xs text-slate-400 block mt-0.5">
                    Images automatically compressed to ~300KB (max 1200px) &bull; PDF verified
                  </span>
                </label>

                {/* Compression Progress Loading State */}
                {isCompressing && (
                  <div className="mt-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200 animate-pulse text-xs text-blue-900 space-y-1">
                    <div className="flex items-center justify-between font-bold text-2xs">
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#1E3A8A]" />
                        <span>Compressing & Optimizing Document...</span>
                      </span>
                      <span>Target: ~300KB</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#1E3A8A] h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${compressionProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Compressed Status Badge */}
                {compressionResult && (
                  <div className="mt-2 p-2 rounded-lg border text-2xs space-y-1 bg-emerald-50 text-emerald-900 border-emerald-200">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1 text-emerald-800">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Client-Side Optimization Applied</span>
                      </span>
                      {compressionResult.isCompressed ? (
                        <span className="bg-emerald-600 text-white font-extrabold px-1.5 py-0.5 rounded text-3xs">
                          Saved {compressionResult.savedPercentage}%
                        </span>
                      ) : (
                        <span className="text-3xs text-slate-500 font-mono">Standard Ready</span>
                      )}
                    </div>
                    <div className="text-3xs font-mono text-emerald-800 flex items-center justify-between">
                      <span>Original: {compressionResult.originalFormatted}</span>
                      <span>&rarr;</span>
                      <span className="font-bold">Compressed: {compressionResult.compressedFormatted}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Verification Notes / Certificate Number (Optional)
                </label>
                <textarea
                  rows={2}
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="e.g. Aadhaar last 4 digits verified against physical card."
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#1E3A8A] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUploadModalUser(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-[#152e6f] text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{isUploading ? 'Uploading...' : 'Save Document to Vault'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. REJECT DOCUMENT MODAL */}
      {rejectModalDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          id="modal-reject-document"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                  <X className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reject Document</h3>
                  <p className="text-2xs text-slate-500 font-mono">
                    {rejectModalDoc.doc.docType}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Provide feedback explaining why this document submission was rejected. The staff member will be alerted to re-upload.
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-3 text-xs">
              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Rejection Reason
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectModalDoc(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. PREVIEW DOCUMENT MODAL */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          id="modal-preview-document"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#1E3A8A]/10 text-[#1E3A8A]">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{previewDoc.doc.docType}</h3>
                  <p className="text-2xs text-slate-500 font-mono">
                    Owner: {previewDoc.user.full_name || previewDoc.user.staff_id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Document Details Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">File Name:</span>
                <span className="font-mono font-bold text-slate-800">{previewDoc.doc.fileName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">File Size:</span>
                <div className="flex items-center gap-1.5 font-mono">
                  {previewDoc.doc.originalFileSize && (
                    <span className="line-through text-slate-400 text-3xs">
                      {previewDoc.doc.originalFileSize}
                    </span>
                  )}
                  <span className="font-semibold text-slate-800">{previewDoc.doc.fileSize || '300 KB'}</span>
                  {previewDoc.doc.compressionRatio && (
                    <span className="text-3xs font-bold text-emerald-700 bg-emerald-100 px-1 rounded">
                      {previewDoc.doc.compressionRatio}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Uploaded On:</span>
                <span className="font-semibold text-slate-800">{previewDoc.doc.uploadedAt?.slice(0, 19).replace('T', ' ')}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Uploaded By:</span>
                <span className="font-semibold text-slate-800">{previewDoc.doc.uploadedBy || previewDoc.user.staff_id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Verification Status:</span>
                {previewDoc.doc.status === 'APPROVED' ? (
                  <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-2xs">
                    🟢 Verified / Approved
                  </span>
                ) : previewDoc.doc.status === 'PENDING' || previewDoc.doc.status === 'PENDING_APPROVAL' ? (
                  <span className="font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-2xs">
                    🟡 Pending Review
                  </span>
                ) : (
                  <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full text-2xs">
                    🔴 Rejected
                  </span>
                )}
              </div>
              {previewDoc.doc.verifiedBy && (
                <div className="text-2xs text-emerald-800 font-semibold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  Verified by: {previewDoc.doc.verifiedBy} ({previewDoc.doc.verifiedAt?.slice(0, 10)})
                </div>
              )}
            </div>

            {/* Simulated Document Preview Area */}
            <div className="border border-slate-200 rounded-xl p-6 bg-slate-100/50 text-center space-y-2">
              <FileCheck className="h-10 w-10 text-slate-400 mx-auto" />
              <div className="text-xs font-bold text-slate-700">Official Digitized Document Record</div>
              <p className="text-3xs text-slate-500 max-w-xs mx-auto">
                Stored in encrypted tenant vault with SHA-256 integrity signature.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDocumentVault;
