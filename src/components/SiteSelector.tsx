import React, { useMemo } from 'react';
import type { HospitalSite, UserRole } from '../types';

export interface SiteSelectorProps {
  currentSite: string;
  onSiteChange: (site: string) => void;
  userRole?: string | UserRole;
  sites?: HospitalSite[];
  className?: string;
  id?: string;
}

/**
 * Site Selector Logic Component
 * Scope: Sirf Super Admin 'Global/All Sites' dekh sakta hai
 * Dynamically renders deduplicated site objects with unique 'site.id'
 */
export const SiteSelector: React.FC<SiteSelectorProps> = ({
  currentSite,
  onSiteChange,
  userRole,
  sites = [],
  className = 'bg-transparent text-slate-800 font-bold focus:outline-hidden cursor-pointer text-xs border-0 p-0',
  id = 'topbar-site-selector',
}) => {
  const roleUpper = String(userRole || '').toUpperCase();
  const isSuperAdmin = roleUpper === 'SUPER_ADMIN' || roleUpper === 'ADMIN' || roleUpper === 'MASTER_ADMIN';
  const selectedValue = currentSite === 'ALL' ? 'GLOBAL' : currentSite;

  // Deduplicate sites ensuring unique 'site.id'
  const deduplicatedSites = useMemo(() => {
    const map = new Map<string, HospitalSite>();
    (sites || []).forEach((s) => {
      const siteIdKey = s.id || s.siteId || '';
      if (siteIdKey && !map.has(siteIdKey)) {
        map.set(siteIdKey, s);
      }
    });
    return Array.from(map.values());
  }, [sites]);

  return (
    <select 
      id={id}
      value={selectedValue} 
      onChange={(e) => onSiteChange(e.target.value)}
      className={className}
      title="Site Selector: Filter operations by operational site"
      aria-label="Site Selector"
    >
      {/* Scope: Sirf Super Admin 'Global/All Sites' dekh sakta hai */}
      {(roleUpper === 'SUPER_ADMIN' || isSuperAdmin) && (
        <option value="GLOBAL">All Sites (Global)</option>
      )}

      {deduplicatedSites.length > 0 ? (
        deduplicatedSites.map((site) => {
          const siteKey = site.id || site.siteId || '';
          const siteLabel = site.name || site.siteName || siteKey;
          return (
            <option key={siteKey} value={siteKey}>
              {siteLabel}
            </option>
          );
        })
      ) : (
        <>
          <option value="SITE_A_UUID">Site A - East Wing & Trauma</option>
          <option value="SITE_B_UUID">Site B - North Super-Speciality</option>
        </>
      )}
    </select>
  );
};

export default SiteSelector;
