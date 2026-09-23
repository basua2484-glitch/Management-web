// src/services/attendanceService.ts - STRICT TENANT ATTENDANCE ISOLATION

import { getDocsFromFirestoreOrLocal } from './firestoreService';
import { getStoredAttendance } from '../data/mockHousekeepingData';
import { getActiveCompanyPrefix } from '../utils/tenantStorage';

/**
 * Fetch all attendance logs scoped strictly to the specified tenant
 */
export const fetchAttendanceLogsFromDB = async (tenantId: string): Promise<any[]> => {
  const activePrefix = getActiveCompanyPrefix(tenantId);

  try {
    const rawRecords = await getDocsFromFirestoreOrLocal('attendance_records');
    return rawRecords.filter((doc: any) => {
      const docTenant = doc.tenant_id || getActiveCompanyPrefix(doc.staff_id || '');
      return docTenant === activePrefix || docTenant === tenantId;
    });
  } catch (err) {
    console.warn('[attendanceService] Failed to fetch logs from DB, falling back to local storage', err);
    const local = getStoredAttendance();
    return local.filter((doc: any) => {
      const docTenant = (doc as any).tenant_id || getActiveCompanyPrefix((doc as any).staff_id || '');
      return docTenant === activePrefix || docTenant === tenantId;
    });
  }
};

export const getStaffMonthlyAttendance = async (staffId: string, tenantId: string) => {
  // 🛑 GUARD: Strictly verify that both staffId AND tenantId match exactly
  if (!staffId || !tenantId) {
    return { records: [], totalPresent: 0, totalOT: 0 };
  }

  // Fetch from database
  const allLogs = await fetchAttendanceLogsFromDB(tenantId);

  // 🛑 STRICT FILTER: Ensure NO mock records bleed into newly created tenant staff IDs
  const filteredLogs = allLogs.filter(
    (log: any) => log.staff_id === staffId && log.tenant_id === tenantId
  );

  // For a newly onboarded staff member who hasn't punched in yet, return 0 logs
  if (filteredLogs.length === 0) {
    return {
      records: [],
      totalPresent: 0,
      totalOT: 0,
      reliabilityScore: 100
    };
  }

  return {
    records: filteredLogs,
    totalPresent: filteredLogs.filter((l: any) => l.status === 'PRESENT').length,
    totalOT: filteredLogs.reduce((sum: number, l: any) => sum + (l.ot_hours || l.overtimeHours || 0), 0)
  };
};
