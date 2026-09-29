import type { DutyStatus } from '../types';

/**
 * Official UI Feedback Message for Off-Duty Supervisors attempting actions
 */
export const OFF_DUTY_RESTRICTION_MESSAGE =
  'Action Restricted: You are currently OFF-DUTY. Please Punch-In to make operational entries.';

/**
 * Supervisor Action Guard Function:
 * Check role and duty status to determine operational permissions:
 * - ADMIN / MANAGER: Always allowed (Full access 24/7 regardless of On-Duty or Off-Duty).
 * - SUPERVISOR: Only allowed when On-Duty (Restricted to READ-ONLY mode when Off-Duty).
 * - Others: False.
 */
export const canSupervisorAction = (
  role: string | null | undefined,
  isOnDuty: boolean
): boolean => {
  if (!role) return false;
  const normalized = role.toUpperCase();
  if (normalized === 'ADMIN' || normalized === 'MANAGER') return true; // Always allowed
  if (normalized === 'SUPERVISOR') return Boolean(isOnDuty); // Only allowed when On-Duty
  return false;
};

/**
 * Trigger UI feedback toast / banner and broadcast event when an Off-Duty supervisor attempts an action
 */
export const showOffDutyToast = (customNotify?: (msg: string) => void): string => {
  if (customNotify) {
    customNotify(OFF_DUTY_RESTRICTION_MESSAGE);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('off-duty-action-restricted', {
        detail: { message: OFF_DUTY_RESTRICTION_MESSAGE },
      })
    );
  }
  return OFF_DUTY_RESTRICTION_MESSAGE;
};
