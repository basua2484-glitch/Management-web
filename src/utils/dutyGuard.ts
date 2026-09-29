/**
 * Role-Based Duty Permissions and Action Guards
 * 
 * Rules:
 * 1. MANAGER: Full access regardless of duty status (On-Duty or Off-Duty).
 *    Allowed to view live data, add users, process approvals, and perform all manager-level CRUD operations 24/7.
 * 2. SUPERVISOR:
 *    - On-Duty State: Allowed to perform supervisor-level actions (Duty logs, Removal Requests, Staff Verification).
 *    - Off-Duty State: Restricted to READ-ONLY mode. Can view live data and dashboards,
 *      but all action buttons (Add, Edit, Submit Request, Delete) MUST be disabled or hidden.
 * 3. Guard Function:
 *    canSupervisorAction = (role, isOnDuty) => {
 *      if (role === 'ADMIN' || role === 'MANAGER') return true; // Always allowed
 *      if (role === 'SUPERVISOR') return isOnDuty; // Only allowed when On-Duty
 *      return false;
 *    }
 */

export const OFF_DUTY_RESTRICTED_MESSAGE =
  "Action Restricted: You are currently OFF-DUTY. Please Punch-In to make operational entries.";

/**
 * Checks if a user role is permitted to perform operational/modification actions
 * given their current duty status.
 */
export const canSupervisorAction = (
  role: string | null | undefined,
  isOnDuty: boolean
): boolean => {
  const norm = (role || '').toUpperCase();
  if (norm === 'ADMIN' || norm === 'MANAGER') return true; // Always allowed
  if (norm === 'SUPERVISOR') return Boolean(isOnDuty); // Only allowed when On-Duty
  return false;
};

/**
 * Normalizes user duty status check: `currentUser.dutyStatus === 'ON_DUTY'`
 */
export const checkIsOnDuty = (
  user: { dutyStatus?: string; [key: string]: any } | null | undefined
): boolean => {
  return user?.dutyStatus === 'ON_DUTY';
};
