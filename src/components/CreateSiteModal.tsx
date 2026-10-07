import React, { useState } from 'react';
import {
  Building,
  MapPin,
  Crosshair,
  Shield,
  UserCheck,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Compass,
} from 'lucide-react';
import type { HospitalSite, AppUser, IndustryType } from '../types';

export interface CreateSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSiteCreated: (newSite: HospitalSite) => void;
  availableManagers?: AppUser[];
}

export const CreateSiteModal: React.FC<CreateSiteModalProps> = ({
  isOpen,
  onClose,
  onSiteCreated,
  availableManagers = [],
}) => {
  const [siteName, setSiteName] = useState('');
  const [industryType, setIndustryType] = useState<IndustryType>('HOSPITAL');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<string>('19.0760');
  const [longitude, setLongitude] = useState<string>('72.8777');
  const [radiusMeters, setRadiusMeters] = useState<number>(100);
  const [primaryManagerId, setPrimaryManagerId] = useState<string>('');

  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter manager accounts
  const managerOptions = availableManagers.filter((u) => {
    const r = String(u.role || '').toLowerCase();
    return r === 'manager' || r === 'admin' || r === 'supervisor';
  });

  // Fetch Current Device Location via Browser Geolocation API
  const handleFetchCurrentLocation = () => {
    setLocationError(null);
    setLocationSuccessMsg(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        setLatitude(lat);
        setLongitude(lng);
        setIsFetchingLocation(false);
        setLocationSuccessMsg(
          `Device GPS acquired: ${lat}, ${lng} (±${Math.round(position.coords.accuracy)}m)`
        );
      },
      (err) => {
        setIsFetchingLocation(false);
        setLocationError(`GPS error: ${err.message || 'Unable to retrieve location.'}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedName = siteName.trim();
    if (!trimmedName) {
      setErrorMessage('Site Name is required.');
      return;
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (isNaN(latNum) || isNaN(lngNum)) {
      setErrorMessage('Valid GPS coordinates (latitude and longitude) are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        site_name: trimmedName,
        industry_type: industryType,
        address: address.trim(),
        location_lat: latNum,
        location_lng: lngNum,
        radius_meters: radiusMeters,
        primary_manager_id: primaryManagerId || null,
      };

      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to save new site to database.');
      }

      const createdSite: HospitalSite = data.site || {
        id: crypto.randomUUID(),
        siteId: crypto.randomUUID(),
        name: trimmedName,
        siteName: trimmedName,
        code: trimmedName.replace(/[^A-Za-z0-9]/g, '-').toUpperCase().slice(0, 10),
        industry_type: industryType,
        address: address.trim(),
        locationLat: latNum,
        locationLng: lngNum,
        radiusMeters: radiusMeters,
        primaryManagerId: primaryManagerId || null,
      };

      setSuccessMessage(`Site "${trimmedName}" created and active with GPS geofence.`);

      // Persist to local storage helper for instant offline availability
      try {
        const stored = localStorage.getItem('hk_dynamic_sites');
        const list = stored ? JSON.parse(stored) : [];
        list.push(createdSite);
        localStorage.setItem('hk_dynamic_sites', JSON.stringify(list));
      } catch {}

      setTimeout(() => {
        onSiteCreated(createdSite);
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating site.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-create-site-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#1E3A8A] to-blue-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-lg">
              <Building className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 id="modal-create-site-title" className="text-base font-bold text-white leading-tight">
                Create New Operational Site
              </h2>
              <p className="text-xs text-blue-100 font-medium">
                Configure Site Identity, GPS Geofence & Assigned Manager
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. Site Name */}
          <div>
            <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Site Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Building className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder='e.g., "AIIMS Trauma Block" or "City Care South"'
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden text-xs"
              />
            </div>
          </div>

          {/* 2. Industry Type */}
          <div>
            <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Industry Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={industryType}
              onChange={(e) => setIndustryType(e.target.value as IndustryType)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden text-xs cursor-pointer"
            >
              <option value="HOSPITAL">HOSPITAL (Healthcare & Trauma)</option>
              <option value="COMMERCIAL">COMMERCIAL (Offices & Tech Parks)</option>
              <option value="HOTEL">HOTEL (Hospitality & Resorts)</option>
              <option value="MALL">MALL (Retail & Entertainment)</option>
              <option value="CONSTRUCTION">CONSTRUCTION (Industrial Sites)</option>
            </select>
            <span className="text-3xs text-slate-400 mt-0.5 block">
              Industry Type is strictly isolated to the Site level (never shared across tenant).
            </span>
          </div>

          {/* 3. Physical Address */}
          <div>
            <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Physical Address
            </label>
            <div className="relative">
              <MapPin className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., Gate No. 4, Ring Road, Medical Enclave, Sector 12"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden text-xs resize-none"
              />
            </div>
          </div>

          {/* 4. GPS Geofence Coordinates */}
          <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Compass className="h-4 w-4 text-blue-700" />
                <span>GPS Geofence Calibration</span>
              </div>
              <button
                type="button"
                onClick={handleFetchCurrentLocation}
                disabled={isFetchingLocation}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-2xs font-bold cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
              >
                {isFetchingLocation ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Acquiring GPS...</span>
                  </>
                ) : (
                  <>
                    <Crosshair className="h-3 w-3" />
                    <span>Fetch Current Device Location</span>
                  </>
                )}
              </button>
            </div>

            {locationSuccessMsg && (
              <div className="text-3xs text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                <span>{locationSuccessMsg}</span>
              </div>
            )}

            {locationError && (
              <div className="text-3xs text-rose-600 font-semibold flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{locationError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-3xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Latitude
                </label>
                <input
                  type="text"
                  required
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="19.0760"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 focus:border-blue-600 focus:outline-hidden text-xs"
                />
              </div>
              <div>
                <label className="block text-3xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Longitude
                </label>
                <input
                  type="text"
                  required
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="72.8777"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 focus:border-blue-600 focus:outline-hidden text-xs"
                />
              </div>
            </div>

            {/* Geofence Radius */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-3xs font-bold uppercase tracking-wider text-slate-600">
                  Geofence Radius (Meters)
                </label>
                <span className="font-mono font-bold text-blue-700">{radiusMeters}m</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="25"
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(Number(e.target.value))}
                  className="w-full h-1.5 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                {[50, 100, 200, 500].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadiusMeters(r)}
                    className={`px-2 py-0.5 rounded text-3xs font-bold border transition-colors cursor-pointer ${
                      radiusMeters === r
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {r}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Primary Operations Manager Dropdown */}
          <div>
            <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Primary Operations Manager
            </label>
            <div className="relative">
              <UserCheck className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <select
                value={primaryManagerId}
                onChange={(e) => setPrimaryManagerId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden text-xs cursor-pointer"
              >
                <option value="">-- Unassigned / Assign Later --</option>
                {managerOptions.map((mgr) => {
                  const mId = String(mgr.id || mgr.staff_id || mgr.username);
                  const mName = mgr.full_name || mgr.name || mgr.username;
                  const mRole = (mgr.role || 'MANAGER').toUpperCase();
                  return (
                    <option key={mId} value={mId}>
                      {mName} ({mRole} - {mgr.staff_id || mId})
                    </option>
                  );
                })}
              </select>
            </div>
            <span className="text-3xs text-slate-400 mt-0.5 block">
              When this Operations Manager logs in, their dashboard data will automatically scope to this site.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving Site...</span>
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  <span>Create Site &amp; Activate</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateSiteModal;
