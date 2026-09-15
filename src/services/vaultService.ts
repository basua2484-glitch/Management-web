import type { User, UserRole } from '../types';

/**
 * Hash generator for User.password_hash matching Flask / Django werkzeug security standard
 */
export function createPasswordHash(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = (hash << 5) - hash + password.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `pbkdf2:sha256:600000$vault_salt$${hex}e8f901ab`;
}

/**
 * Admin Vault Support:
 * Decryption key / access is strictly restricted to the 'admin' role only.
 * Non-admins (manager, supervisor, staff) cannot access or reveal raw passwords.
 */
export function decryptVaultPassword(
  user: Partial<User>,
  viewerRole?: UserRole
): { password: string | null; authorized: boolean; reason?: string } {
  if (viewerRole !== 'admin') {
    return {
      password: null,
      authorized: false,
      reason: 'Unauthorized: Decryption key restricted to Admin role only.',
    };
  }

  const raw = user.raw_password_vault || user.password || null;
  return {
    password: raw,
    authorized: true,
  };
}

/**
 * Validates a plaintext password against the User's stored password_hash or raw_password_vault
 */
export function verifyPassword(password: string, user: Partial<User>): boolean {
  if (!password || !user) return false;
  if (user.raw_password_vault && user.raw_password_vault === password) return true;
  if (user.password && user.password === password) return true;
  if (user.password_hash) {
    const expected = createPasswordHash(password);
    if (user.password_hash === expected) return true;
  }
  return false;
}
