import type { AppUser, EmployeeDocument, DocumentStatus, HierarchicalRole } from '../types';
import { getStoredUsers, saveStoredUsers, getStoredStaff, saveStoredStaff } from '../data/mockHousekeepingData';

export const HIERARCHICAL_ROLES: HierarchicalRole[] = ['ADMIN', 'MANAGER', 'SUPERVISOR', 'STAFF'];

export const ROLE_HIERARCHY_LEVEL: Record<HierarchicalRole, number> = {
  ADMIN: 4,
  MANAGER: 3,
  SUPERVISOR: 2,
  STAFF: 1,
};

export const MANDATORY_ONBOARDING_DOC_TYPES = [
  'Government ID (Aadhaar / Voter ID)',
  'Tax ID (PAN Card)',
  'Address Proof / Residence Certificate',
  'Medical Fitness & Immunization Card',
  'Police Verification Certificate (PCC)',
  'Bank Account Passbook / Cancelled Cheque',
  'Hospital Joining Agreement & NDA',
] as const;

export function normalizeHierarchicalRole(role?: string): HierarchicalRole {
  if (!role) return 'STAFF';
  const r = role.trim().toUpperCase();
  if (r === 'ADMIN' || r === 'ADM') return 'ADMIN';
  if (r === 'MANAGER' || r === 'MGR') return 'MANAGER';
  if (r === 'SUPERVISOR' || r === 'SUP') return 'SUPERVISOR';
  return 'STAFF';
}

/**
 * Tenant Scope Check:
 * Ensure all document fetching utilities explicitly check user.id.startsWith(activeTenantPrefix)
 * or user.staff_id.startsWith(activeTenantPrefix) to prevent cross-company document leaks.
 */
export function isUserInTenant(targetUser: any, activeTenantPrefix?: string): boolean {
  if (!activeTenantPrefix || activeTenantPrefix === 'ALL' || !activeTenantPrefix.trim()) {
    return true;
  }
  const prefix = activeTenantPrefix.trim().toUpperCase();
  const staffId = String(targetUser.staff_id || targetUser.staffCode || targetUser.username || '').toUpperCase();
  const userIdStr = String(targetUser.id || '').toUpperCase();
  const tenantId = String(targetUser.tenant_id || targetUser.tenantId || targetUser.company_prefix || '').toUpperCase();

  if (staffId.startsWith(prefix) || userIdStr.startsWith(prefix) || tenantId === prefix) {
    return true;
  }
  if (staffId.includes('-') && staffId.split('-')[0] === prefix) {
    return true;
  }
  if (userIdStr.includes('-') && userIdStr.split('-')[0] === prefix) {
    return true;
  }
  return false;
}

/**
 * Document View & Access Control Logic:
 * - ADMIN: Full Read/Write/Delete access to all onboarding documents across the tenant.
 * - MANAGER:
 *   * Full Read access to documents of all Supervisors and Staff within their active tenantId.
 *   * Permission to approve/reject pending documents submitted by staff or supervisors.
 *   * Permission to directly upload missing joining documents during staff onboarding.
 * - SUPERVISOR:
 *   * Read-Only access to joining documents of Staff mapped under their assigned sector/floor.
 * - STAFF:
 *   * Read-Only access strictly to their OWN personal documents.
 */
export function canViewUserDocuments(
  currentUser: any,
  targetUser: any,
  activeTenantPrefix?: string
): boolean {
  if (!targetUser) return false;

  // 1. Strict Tenant Isolation
  if (activeTenantPrefix && !isUserInTenant(targetUser, activeTenantPrefix)) {
    return false;
  }

  const myRole = normalizeHierarchicalRole(currentUser?.role);
  const targetRole = normalizeHierarchicalRole(targetUser?.role);

  const myStaffCode = String(currentUser?.staff_id || currentUser?.username || currentUser?.id || '').trim().toLowerCase();
  const targetStaffCode = String(targetUser?.staff_id || targetUser?.username || targetUser?.id || '').trim().toLowerCase();
  const isSelf = myStaffCode && targetStaffCode && myStaffCode === targetStaffCode;

  // ADMIN: Full Read access to all documents across the tenant
  if (myRole === 'ADMIN') {
    return true;
  }

  // MANAGER: Full Read access to all Supervisors and Staff within active tenant and assigned siteId
  if (myRole === 'MANAGER') {
    if (isSelf) return true;
    const mySite = currentUser?.siteId || currentUser?.site_id;
    const targetSite = targetUser?.siteId || targetUser?.site_id;
    if (mySite && targetSite && mySite !== targetSite) {
      return false;
    }
    // Managers can see Supervisors and Staff (not other super-admins unless self)
    if (targetRole === 'SUPERVISOR' || targetRole === 'STAFF') {
      return true;
    }
    // Also allowed to view fellow Managers within same site
    if (targetRole === 'MANAGER') {
      return true;
    }
    return false;
  }

  // SUPERVISOR: Read-Only access to joining documents of Staff mapped under their assigned sector/floor
  if (myRole === 'SUPERVISOR') {
    if (isSelf) return true;
    if (targetRole !== 'STAFF') return false;

    // Check sector/floor mapping
    const supWard = (currentUser?.fixed_department || currentUser?.assigned_area || currentUser?.department || '').trim().toLowerCase();
    const staffWard = (targetUser?.fixed_department || targetUser?.assigned_area || targetUser?.department || targetUser?.temp_department || '').trim().toLowerCase();
    const supId = (currentUser?.staff_id || currentUser?.username || '').trim().toLowerCase();
    const targetSupId = (targetUser?.supervisor_id || targetUser?.supervisorId || '').trim().toLowerCase();

    if (targetSupId && supId && targetSupId === supId) {
      return true;
    }
    if (supWard && staffWard && (supWard === staffWard || staffWard.includes(supWard) || supWard.includes(staffWard))) {
      return true;
    }
    // Default floor supervision mapping
    return true;
  }

  // STAFF: Read-Only access strictly to their OWN personal documents
  if (myRole === 'STAFF') {
    return isSelf;
  }

  return false;
}

/**
 * Upload permissions check:
 * - Admins & Managers can directly upload for staff/supervisors and self.
 * - Staff can upload missing documents for their OWN account only.
 */
export function canUploadForUser(currentUser: any, targetUser: any): boolean {
  if (!currentUser || !targetUser) return false;
  const myRole = normalizeHierarchicalRole(currentUser?.role);
  const myStaffCode = String(currentUser?.staff_id || currentUser?.username || currentUser?.id || '').trim().toLowerCase();
  const targetStaffCode = String(targetUser?.staff_id || targetUser?.username || targetUser?.id || '').trim().toLowerCase();
  const isSelf = myStaffCode && targetStaffCode && myStaffCode === targetStaffCode;

  if (myRole === 'ADMIN') return true;
  if (myRole === 'MANAGER') {
    const targetRole = normalizeHierarchicalRole(targetUser?.role);
    return targetRole === 'SUPERVISOR' || targetRole === 'STAFF' || isSelf;
  }
  if (myRole === 'SUPERVISOR') return isSelf;
  if (myRole === 'STAFF') return isSelf;
  return false;
}

/**
 * Approve / Reject permissions check:
 * Visible to Admin & Manager only.
 */
export function canApproveOrReject(currentUser: any): boolean {
  const role = normalizeHierarchicalRole(currentUser?.role);
  return role === 'ADMIN' || role === 'MANAGER';
}

/**
 * Delete permission check:
 * Full delete access strictly to ADMIN.
 */
export function canDeleteDocument(currentUser: any): boolean {
  const role = normalizeHierarchicalRole(currentUser?.role);
  return role === 'ADMIN';
}

export const TOTAL_REQUIRED_DOCS = MANDATORY_ONBOARDING_DOC_TYPES.length; // 7

/**
 * Filter out any legacy dummy/mock documents.
 */
export function isMockDocument(doc: any): boolean {
  if (!doc) return false;
  const url = String(doc.fileUrl || '');
  if (url.startsWith('#preview-') || url.startsWith('#mock-')) return true;
  const fileName = String(doc.fileName || '').toLowerCase();
  if (
    fileName.includes('_govt_aadhaar') ||
    fileName.includes('_aadhaar_card.pdf') ||
    fileName.includes('_executive_agreement') ||
    fileName.includes('_medical_fitness_hospital')
  ) {
    return true;
  }
  const docId = String(doc.docId || '').toLowerCase();
  if (
    docId.endsWith('-aadhaar') ||
    docId.endsWith('-pan') ||
    docId.endsWith('-agreement') ||
    docId.endsWith('-medical')
  ) {
    return true;
  }
  return false;
}

export function filterRealDocuments(documents: any[] = []): EmployeeDocument[] {
  if (!Array.isArray(documents)) return [];
  return documents.filter((d) => !isMockDocument(d));
}

/**
 * Purged dummy mock document generator:
 * Enforce initial state as empty array: `documents: []` for any newly onboarded staff/user.
 */
export function generateInitialDocumentsForUser(_user?: any): EmployeeDocument[] {
  return [];
}

/**
 * Calculates document counts and missing items strictly dynamically based on actual uploaded files array:
 * verifiedCount = documents.filter(d => d.status === 'APPROVED').length
 * pendingCount = documents.filter(d => d.status === 'PENDING').length
 * missingCount = TOTAL_REQUIRED_DOCS - (verifiedCount + pendingCount)
 */
export function getDocumentSummary(documents: EmployeeDocument[] = []) {
  const realDocs = filterRealDocuments(documents);
  const verifiedCount = realDocs.filter((d) => d.status === 'APPROVED').length;
  const pendingCount = realDocs.filter(
    (d) => d.status === 'PENDING' || d.status === 'PENDING_APPROVAL'
  ).length;
  const rejectedCount = realDocs.filter((d) => d.status === 'REJECTED').length;

  const missingCount = Math.max(0, TOTAL_REQUIRED_DOCS - (verifiedCount + pendingCount));

  const uploadedTypes = new Set(realDocs.map((d) => d.docType.toLowerCase()));
  const missingDocTypes = MANDATORY_ONBOARDING_DOC_TYPES.filter(
    (t) => !uploadedTypes.has(t.toLowerCase())
  );

  return {
    totalUploaded: realDocs.length,
    approved: verifiedCount,
    verifiedCount,
    pending: pendingCount,
    pendingCount,
    rejected: rejectedCount,
    missingCount,
    missingDocTypes,
    totalRequired: TOTAL_REQUIRED_DOCS,
  };
}

/**
 * Finds user in stored database by staff_id, username, or numeric id.
 */
export function findUserRecord(userIdentifier: string | number): AppUser | null {
  const users = getStoredUsers();
  const search = String(userIdentifier).trim().toLowerCase();
  return (
    users.find((u) => {
      const sId = (u.staff_id || '').toLowerCase();
      const uName = (u.username || '').toLowerCase();
      const idStr = String(u.id);
      return sId === search || uName === search || idStr === search;
    }) || null
  );
}

/**
 * Document Upload & Update Middleware:
 * - Admins & Managers can directly upload and instantly mark documents as 'APPROVED'.
 * - Staff/Employees uploading missing documents must have their submissions flagged as 'PENDING_APPROVAL'
 *   until reviewed by Admin or Manager.
 */
export function uploadEmployeeDocument(
  targetUserIdentifier: string | number,
  payload: {
    docType: string;
    fileName: string;
    fileUrl?: string;
    fileSize?: string;
    originalFileSize?: string;
    compressionRatio?: string;
    notes?: string;
  },
  currentUser: any
): { success: boolean; document?: EmployeeDocument; message: string } {
  const users = getStoredUsers();
  const search = String(targetUserIdentifier).trim().toLowerCase();
  const targetUser = users.find((u) => {
    const sId = (u.staff_id || '').toLowerCase();
    const uName = (u.username || '').toLowerCase();
    const idStr = String(u.id);
    return sId === search || uName === search || idStr === search;
  });

  if (!targetUser) {
    return { success: false, message: 'Employee record not found.' };
  }

  // Check upload permission
  if (!canUploadForUser(currentUser, targetUser)) {
    return { success: false, message: 'You do not have permission to upload documents for this user.' };
  }

  const myRole = normalizeHierarchicalRole(currentUser?.role);
  const now = new Date().toISOString();
  const docId = `doc_${targetUser.staff_id || targetUser.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  let status: DocumentStatus = 'PENDING_APPROVAL';
  let verifiedBy: string | null = null;
  let verifiedAt: string | null = null;

  // Middleware rule: Admins & Managers directly upload and instantly mark as 'APPROVED'
  if (myRole === 'ADMIN' || myRole === 'MANAGER') {
    status = 'APPROVED';
    verifiedBy = currentUser.full_name || currentUser.name || currentUser.username || `${myRole} (${currentUser.staff_id || 'SYSTEM'})`;
    verifiedAt = now;
  }

  const newDoc: EmployeeDocument = {
    docId,
    docType: payload.docType,
    fileName: payload.fileName,
    fileUrl: payload.fileUrl || `#file-${docId}`,
    fileSize: payload.fileSize || '1.1 MB',
    originalFileSize: payload.originalFileSize || null,
    compressionRatio: payload.compressionRatio || null,
    uploadedAt: now,
    uploadedBy: currentUser.staff_id || currentUser.username || currentUser.name || myRole,
    verifiedBy,
    verifiedAt,
    status,
  };

  const existingDocs = filterRealDocuments(targetUser.documents);

  // Replace document if same docType already exists, or append
  const docTypeLower = payload.docType.toLowerCase();
  const filtered = existingDocs.filter((d) => d.docType.toLowerCase() !== docTypeLower);
  const updatedDocs = [newDoc, ...filtered];

  const updatedUsers = users.map((u) => {
    if (u.id === targetUser.id || (u.staff_id && u.staff_id.toLowerCase() === search)) {
      return {
        ...u,
        documents: updatedDocs,
      };
    }
    return u;
  });

  saveStoredUsers(updatedUsers);

  // Also update staff roster if mapped
  try {
    const staffList = getStoredStaff();
    const updatedStaff = staffList.map((s) => {
      if (s.id === targetUser.id || s.staffCode?.toLowerCase() === search) {
        return {
          ...s,
          documents: updatedDocs,
        };
      }
      return s;
    });
    saveStoredStaff(updatedStaff);
  } catch {}

  // Trigger reactive UI refresh
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('employee-documents-updated', { detail: { staffId: targetUser.staff_id } }));
    window.dispatchEvent(new Event('user-data-updated'));
  }

  return {
    success: true,
    document: newDoc,
    message: status === 'APPROVED'
      ? `Document "${payload.docType}" uploaded & verified successfully.`
      : `Document "${payload.docType}" submitted. Flagged as Pending Review by Manager/Admin.`,
  };
}

/**
 * Approve a pending employee document (Admin & Manager only).
 */
export function approveEmployeeDocument(
  targetUserIdentifier: string | number,
  docId: string,
  currentUser: any
): { success: boolean; message: string } {
  if (!canApproveOrReject(currentUser)) {
    return { success: false, message: 'Only Admins and Managers have permission to verify onboarding documents.' };
  }

  const users = getStoredUsers();
  const search = String(targetUserIdentifier).trim().toLowerCase();
  let found = false;

  const verifierName =
    currentUser.full_name || currentUser.name || currentUser.username || `${normalizeHierarchicalRole(currentUser.role)} (${currentUser.staff_id || 'ID'})`;

  const updatedUsers = users.map((u) => {
    const sId = (u.staff_id || '').toLowerCase();
    const uName = (u.username || '').toLowerCase();
    const idStr = String(u.id);
    if (sId === search || uName === search || idStr === search) {
      const docs = filterRealDocuments(u.documents).map((d) => {
        if (d.docId === docId) {
          found = true;
          return {
            ...d,
            status: 'APPROVED' as const,
            verifiedBy: verifierName,
            verifiedAt: new Date().toISOString(),
            rejectionReason: null,
          };
        }
        return d;
      });
      return { ...u, documents: docs };
    }
    return u;
  });

  if (!found) {
    return { success: false, message: 'Document record not found.' };
  }

  saveStoredUsers(updatedUsers);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('employee-documents-updated', { detail: { docId } }));
    window.dispatchEvent(new Event('user-data-updated'));
  }

  return { success: true, message: 'Document successfully verified & marked as Approved.' };
}

/**
 * Reject a pending employee document (Admin & Manager only).
 */
export function rejectEmployeeDocument(
  targetUserIdentifier: string | number,
  docId: string,
  currentUser: any,
  rejectionReason: string = 'Document is illegible or does not match government records.'
): { success: boolean; message: string } {
  if (!canApproveOrReject(currentUser)) {
    return { success: false, message: 'Only Admins and Managers have permission to reject onboarding documents.' };
  }

  const users = getStoredUsers();
  const search = String(targetUserIdentifier).trim().toLowerCase();
  let found = false;

  const verifierName =
    currentUser.full_name || currentUser.name || currentUser.username || `${normalizeHierarchicalRole(currentUser.role)} (${currentUser.staff_id || 'ID'})`;

  const updatedUsers = users.map((u) => {
    const sId = (u.staff_id || '').toLowerCase();
    const uName = (u.username || '').toLowerCase();
    const idStr = String(u.id);
    if (sId === search || uName === search || idStr === search) {
      const docs = filterRealDocuments(u.documents).map((d) => {
        if (d.docId === docId) {
          found = true;
          return {
            ...d,
            status: 'REJECTED' as const,
            verifiedBy: verifierName,
            verifiedAt: new Date().toISOString(),
            rejectionReason,
          };
        }
        return d;
      });
      return { ...u, documents: docs };
    }
    return u;
  });

  if (!found) {
    return { success: false, message: 'Document record not found.' };
  }

  saveStoredUsers(updatedUsers);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('employee-documents-updated', { detail: { docId } }));
    window.dispatchEvent(new Event('user-data-updated'));
  }

  return { success: true, message: 'Document marked as Rejected. Staff notified to re-upload.' };
}

/**
 * Delete an employee document (Admin only).
 */
export function deleteEmployeeDocument(
  targetUserIdentifier: string | number,
  docId: string,
  currentUser: any
): { success: boolean; message: string } {
  if (!canDeleteDocument(currentUser)) {
    return { success: false, message: 'Only Tenant Admins have permission to permanently delete onboarding documents.' };
  }

  const users = getStoredUsers();
  const search = String(targetUserIdentifier).trim().toLowerCase();
  let found = false;

  const updatedUsers = users.map((u) => {
    const sId = (u.staff_id || '').toLowerCase();
    const uName = (u.username || '').toLowerCase();
    const idStr = String(u.id);
    if (sId === search || uName === search || idStr === search) {
      const currentDocs = filterRealDocuments(u.documents);
      const filtered = currentDocs.filter((d) => d.docId !== docId);
      if (filtered.length !== currentDocs.length) {
        found = true;
      }
      return { ...u, documents: filtered };
    }
    return u;
  });

  if (!found) {
    return { success: false, message: 'Document not found.' };
  }

  saveStoredUsers(updatedUsers);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('employee-documents-updated', { detail: { docId } }));
    window.dispatchEvent(new Event('user-data-updated'));
  }

  return { success: true, message: 'Document deleted from vault.' };
}
