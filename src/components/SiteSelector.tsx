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

  // Unique Sites Filter Logic
  const uniqueSites = useMemo(() => {
    if (!sites || !Array.isArray(sites)) return [];
    
    const seen = new Set<string>();
    return sites.filter((site) => {
      // Unique ID ya Name check
      const identifier = site.id || site.name;
      if (!identifier || seen.has(identifier)) {
        return false; // Skip duplicates
      }
      seen.add(identifier);
      return true;
    });
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

      {uniqueSites.length > 0 ? (
        uniqueSites.map((site) => {
          const siteKey = site.id || site.siteId || site.name;
          const siteLabel = site.name || site.siteName || siteKey;
          return (
            <option key={siteKey} value={siteKey}>
              {siteLabel}
            </option>
          );
        })
      ) : (
        !(roleUpper === 'SUPER_ADMIN' || isSuperAdmin) && (
          <option value="" disabled>No sites configured</option>
        )
      )}
    </select>
  );
};

export default SiteSelector;
