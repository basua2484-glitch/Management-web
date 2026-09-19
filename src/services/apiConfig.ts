/**
 * Centralized API endpoint resolver and network safeguard.
 * Ensures all API calls use relative paths (/api/...) or dynamic VITE_API_URL.
 * Completely eliminates any internal cloud metadata IPs (http://169.254.169.1)
 * and hardcoded localhost URLs.
 */

function sanitizeBaseUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  // Strip internal cloud metadata service IPs or link-local addresses
  if (
    trimmed.includes('169.254.169') ||
    trimmed.includes('169.254.') ||
    trimmed.startsWith('http://169.254') ||
    trimmed.startsWith('https://169.254')
  ) {
    console.warn('Blocked attempt to use cloud metadata IP (169.254.x.x) as API base. Falling back to relative endpoints.');
    return '';
  }
  // Strip trailing slashes
  return trimmed.replace(/\/+$/, '');
}

export const API_BASE_URL: string = sanitizeBaseUrl((import.meta as any).env?.VITE_API_URL);

/**
 * Returns a fully qualified or relative endpoint string.
 * e.g. getApiEndpoint('/api/login') -> '/api/login' or 'https://example.com/api/login'
 */
export function getApiEndpoint(endpointPath: string): string {
  const normalized = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  if (API_BASE_URL) {
    return `${API_BASE_URL}${normalized}`;
  }
  return normalized;
}
