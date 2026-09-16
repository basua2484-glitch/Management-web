import React, { useState, useEffect } from 'react';
import {
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Compass,
  Sliders,
  Info,
  Lock,
} from 'lucide-react';
import {
  HOSPITAL_LAT,
  HOSPITAL_LNG,
  MAX_ALLOWED_RADIUS_METERS,
  HOSPITAL_NAME,
  calculateDistanceMeters,
  verifyHospitalGeofence,
  GEOFENCE_PRESETS,
  getStoredGeofenceConfig,
  saveStoredGeofenceConfig,
  type GeofenceVerificationResult,
} from '../utils/geofence';

export interface GeofenceStatusCardProps {
  onStatusChange?: (result: GeofenceVerificationResult) => void;
  compact?: boolean;
  className?: string;
  showSimulator?: boolean;
}

export const GeofenceStatusCard: React.FC<GeofenceStatusCardProps> = ({
  onStatusChange,
  compact = false,
  className = '',
  showSimulator = true,
}) => {
  const [config, setConfig] = useState(() => getStoredGeofenceConfig());
  const [selectedPresetId, setSelectedPresetId] = useState<string>(config.simulatedPresetId || 'main_entrance');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(() => {
    if (config.mode === 'SIMULATED') {
      const preset = GEOFENCE_PRESETS.find((p) => p.id === config.simulatedPresetId) || GEOFENCE_PRESETS[1];
      return { lat: preset.lat, lng: preset.lng };
    }
    return { lat: HOSPITAL_LAT, lng: HOSPITAL_LNG };
  });

  const [gpsError, setGpsError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [showTesterDrawer, setShowTesterDrawer] = useState<boolean>(false);

  // Compute geofence verification
  const verification: GeofenceVerificationResult = verifyHospitalGeofence(coords.lat, coords.lng);

  // Notify parent component
  useEffect(() => {
    onStatusChange?.(verification);
  }, [coords.lat, coords.lng, onStatusChange]);

  // Synchronize with external changes (e.g., from error modal, punch triggers, or other tabs)
  useEffect(() => {
    const handleLocationAcquired = (e: any) => {
      if (e.detail?.lat && e.detail?.lng) {
        setCoords({ lat: e.detail.lat, lng: e.detail.lng });
        if (e.detail.accuracy) {
          setAccuracy(e.detail.accuracy);
        }
        setGpsError(null);
      }
    };
    const handlePresetChange = (e: any) => {
      const pId = e.detail?.presetId;
      if (pId) {
        setSelectedPresetId(pId);
        const preset = GEOFENCE_PRESETS.find((p) => p.id === pId);
        if (preset) {
          setCoords({ lat: preset.lat, lng: preset.lng });
          setGpsError(null);
        }
      }
    };
    const handleConfigChange = () => {
      const updatedCfg = getStoredGeofenceConfig();
      setConfig(updatedCfg);
      if (updatedCfg.simulatedPresetId) {
        setSelectedPresetId(updatedCfg.simulatedPresetId);
        const preset = GEOFENCE_PRESETS.find((p) => p.id === updatedCfg.simulatedPresetId);
        if (preset) {
          setCoords({ lat: preset.lat, lng: preset.lng });
        }
      }
    };
    window.addEventListener('geofence-location-acquired', handleLocationAcquired);
    window.addEventListener('geofence-preset-changed', handlePresetChange);
    window.addEventListener('geofence-config-updated', handleConfigChange);
    return () => {
      window.removeEventListener('geofence-location-acquired', handleLocationAcquired);
      window.removeEventListener('geofence-preset-changed', handlePresetChange);
      window.removeEventListener('geofence-config-updated', handleConfigChange);
    };
  }, []);

  // Handle choosing a preset (Safe testing without triggering browser GPS prompt)
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = GEOFENCE_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setCoords({ lat: preset.lat, lng: preset.lng });
      setGpsError(null);
      setAccuracy(null);
      const newCfg = {
        mode: 'SIMULATED' as const,
        simulatedPresetId: presetId,
      };
      setConfig(newCfg);
      saveStoredGeofenceConfig(newCfg);
    }
  };

  if (compact) {
    return (
      <div
        id="geofence-compact-status"
        className={`p-3 rounded-xl border transition-all ${
          verification.allowed
            ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
            : 'bg-rose-50/95 border-rose-300 text-rose-950'
        } ${className}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                verification.allowed ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white animate-pulse'
              }`}
            >
              {verification.allowed ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xs font-extrabold uppercase tracking-wide">
                  GPS Geofence: {verification.allowed ? 'VERIFIED ON-PREMISES' : 'VIOLATION DETECTED'}
                </span>
                <span className="text-3xs font-mono font-bold px-1.5 py-0.2 rounded bg-white/80 border border-current">
                  {verification.distanceMeters.toFixed(1)}m / {MAX_ALLOWED_RADIUS_METERS}m
                </span>
              </div>
              <p className="text-3xs opacity-85 mt-0.5">
                {verification.allowed
                  ? `Allowed to Punch In. Located within 100m perimeter of hospital center.`
                  : `Punch In is blocked. You are ${verification.distanceMeters.toFixed(1)}m away (>100m limit).`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowTesterDrawer(!showTesterDrawer)}
            className="px-2 py-1 bg-white/90 hover:bg-white text-slate-800 text-3xs font-bold rounded-md border border-slate-300 shadow-2xs shrink-0 cursor-pointer flex items-center gap-1"
          >
            <Sliders className="h-3 w-3" />
            <span>GPS Settings</span>
          </button>
        </div>

        {/* Expandable test controls */}
        {showTesterDrawer && (
          <div className="mt-3 pt-3 border-t border-current/20 text-xs space-y-2 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-3xs font-bold uppercase text-slate-700">Test Boundary Preset:</span>
              <select
                value={selectedPresetId}
                onChange={(e) => handleSelectPreset(e.target.value)}
                className="text-3xs font-semibold bg-white border border-slate-300 rounded px-2 py-1 cursor-pointer"
              >
                {GEOFENCE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.expectedInside ? '✓ Inside (<100m)' : '✕ Outside (>100m)'}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-3xs text-slate-500 font-medium">
              🔒 Phone GPS permission is queried strictly when you click &lsquo;Punch In&rsquo; or &lsquo;Punch Out&rsquo;.
            </p>
            {gpsError && <p className="text-3xs text-rose-700 font-semibold">{gpsError}</p>}
          </div>
        )}
      </div>
    );
  }

  // Full detailed card
  return (
    <div
      id="geofence-status-card"
      className={`bg-white rounded-2xl border ${
        verification.allowed ? 'border-slate-200 shadow-sm' : 'border-rose-300 bg-rose-50/30 shadow-sm'
      } p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div
            className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
              verification.allowed
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'bg-rose-500 text-white shadow-xs animate-pulse'
            }`}
          >
            {verification.allowed ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>Hospital Geofence Verification</span>
              </h3>
              <span
                className={`text-2xs font-extrabold px-2 py-0.5 rounded-full border ${
                  verification.allowed
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}
              >
                {verification.allowed ? 'WITHIN 100M PERIMETER' : 'OUTSIDE PERIMETER (>100M)'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{HOSPITAL_NAME} &bull; Center: 19.0760° N, 72.8777° E</span>
            </p>
          </div>
        </div>

        {/* Distance gauge */}
        <div className="flex items-center sm:text-right gap-3 sm:gap-2">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-center">
            <span className="text-3xs font-bold text-slate-500 uppercase block">Distance to Center</span>
            <span
              className={`font-mono text-base font-extrabold block ${
                verification.allowed ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {verification.distanceMeters.toFixed(2)}m
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-center">
            <span className="text-3xs font-bold text-slate-500 uppercase block">Allowed Boundary</span>
            <span className="font-mono text-base font-extrabold text-slate-800 block">
              {MAX_ALLOWED_RADIUS_METERS.toFixed(1)}m
            </span>
          </div>
        </div>
      </div>

      {/* Status description */}
      <div className="mt-3.5 flex items-start gap-2.5">
        {verification.allowed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
        )}
        <div className="text-xs flex-1">
          {verification.allowed ? (
            <p className="text-slate-700 font-medium">
              <span className="font-bold text-emerald-800">Attendance Punch-In Authorized:</span> You are{' '}
              <strong className="font-mono">{verification.distanceMeters.toFixed(1)} meters</strong> from the hospital center.
              Live GPS location is requested and verified when clicking Punch In or Punch Out.
            </p>
          ) : (
            <p className="text-rose-900 font-medium">
              <span className="font-bold text-rose-700">Attendance Punch-In Restricted:</span> You are currently{' '}
              <strong className="font-mono">{verification.distanceMeters.toFixed(1)} meters</strong> away, exceeding the maximum allowed{' '}
              <strong className="font-mono">{MAX_ALLOWED_RADIUS_METERS}m</strong> geofence perimeter. Staff must be physically on hospital grounds to punch in.
            </p>
          )}
        </div>
      </div>

      {/* Simulator / Device GPS Controls */}
      {showSimulator && (
        <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
              <Compass className="h-3.5 w-3.5 text-[#1E3A8A]" />
              <span>Location Coordinate Controls:</span>
              <span className="text-2xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-2xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              <Lock className="h-3 w-3 text-emerald-600" />
              <span>Permission strictly on Punch In / Out click</span>
            </div>
          </div>

          {/* Quick Simulation Presets */}
          <div>
            <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Testing &amp; Demonstration Location Presets:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {GEOFENCE_PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id && config.mode === 'SIMULATED';
                return (
                  <button
                    key={preset.id}
                    type="button"
                    id={`btn-geofence-preset-${preset.id}`}
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`p-2 rounded-lg text-left border transition-all cursor-pointer ${
                      isSelected
                        ? preset.expectedInside
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-2xs'
                          : 'bg-rose-50 border-rose-400 text-rose-950 font-bold shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-2xs">
                      <span className="font-bold truncate">{preset.name}</span>
                      <span
                        className={`text-3xs font-mono font-bold px-1 rounded shrink-0 ${
                          preset.expectedInside
                            ? 'text-emerald-700 bg-emerald-100/70'
                            : 'text-rose-700 bg-rose-100/70'
                        }`}
                      >
                        {preset.expectedInside ? 'Inside' : 'Blocked'}
                      </span>
                    </div>
                    <p className="text-3xs text-slate-500 line-clamp-1 mt-0.5">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
