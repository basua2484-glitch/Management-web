import React, { useState, useEffect } from 'react';
import {
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Radio,
  CheckCircle2,
  Lock,
  Compass,
} from 'lucide-react';
import {
  HOSPITAL_LAT,
  HOSPITAL_LNG,
  MAX_ALLOWED_RADIUS_METERS,
  HOSPITAL_NAME,
  verifyHospitalGeofence,
  getStoredGeofenceConfig,
  type GeofenceVerificationResult,
} from '../utils/geofence';
import type { GeofenceConfig } from '../types';

export interface GeofenceStatusCardProps {
  onStatusChange?: (result: GeofenceVerificationResult) => void;
  compact?: boolean;
  className?: string;
  showSimulator?: boolean; // kept for prop backward compatibility
}

export const GeofenceStatusCard: React.FC<GeofenceStatusCardProps> = ({
  onStatusChange,
  compact = false,
  className = '',
}) => {
  const [currentConfig, setCurrentConfig] = useState<GeofenceConfig>(() => getStoredGeofenceConfig());
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);

  // Synchronize when config updates
  useEffect(() => {
    const handleConfigUpdate = (e: any) => {
      if (e.detail) {
        setCurrentConfig(e.detail);
      } else {
        setCurrentConfig(getStoredGeofenceConfig());
      }
    };
    window.addEventListener('geofence-config-updated', handleConfigUpdate);
    return () => window.removeEventListener('geofence-config-updated', handleConfigUpdate);
  }, []);

  // Compute geofence verification if coords available using dynamic config
  const verification: GeofenceVerificationResult = coords
    ? verifyHospitalGeofence(coords.lat, coords.lng, undefined, currentConfig)
    : {
        allowed: true,
        distanceMeters: 0,
        maxAllowedRadius: currentConfig.maxAllowedRadiusMeters,
        maxRadiusMeters: currentConfig.maxAllowedRadiusMeters,
        hospitalCoords: { lat: currentConfig.hospitalLat, lng: currentConfig.hospitalLng },
        userCoords: { lat: currentConfig.hospitalLat, lng: currentConfig.hospitalLng },
        status: 'INSIDE_GEOFENCE',
        message: `Geofence perimeter active: ${currentConfig.maxAllowedRadiusMeters}m radius from hospital center. Verified upon punch.`,
        reason: 'Hospital Geofence Armed',
      };

  // Notify parent component
  useEffect(() => {
    if (coords) {
      onStatusChange?.(verification);
    }
  }, [coords, onStatusChange]);

  // Listen for real location acquired strictly on punch action
  useEffect(() => {
    const handleLocationAcquired = (e: any) => {
      if (e.detail?.lat && e.detail?.lng) {
        setCoords({ lat: e.detail.lat, lng: e.detail.lng });
        if (e.detail.accuracy) {
          setAccuracy(e.detail.accuracy);
        }
        setLastVerifiedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    };

    window.addEventListener('geofence-location-acquired', handleLocationAcquired);
    return () => {
      window.removeEventListener('geofence-location-acquired', handleLocationAcquired);
    };
  }, []);

  if (compact) {
    return (
      <div
        id="geofence-compact-status"
        className={`p-3 rounded-xl border transition-all ${
          !coords || verification.allowed
            ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
            : 'bg-rose-50/95 border-rose-300 text-rose-950'
        } ${className}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                !coords || verification.allowed ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white animate-pulse'
              }`}
            >
              {!coords || verification.allowed ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xs font-extrabold uppercase tracking-wide">
                  GPS Geofence: {!coords ? 'ARMED & ACTIVE' : verification.allowed ? 'VERIFIED ON-PREMISES' : 'VIOLATION DETECTED'}
                </span>
                <span className="text-3xs font-mono font-bold px-1.5 py-0.2 rounded bg-white/80 border border-current">
                  {coords ? `${verification.distanceMeters.toFixed(1)}m / ` : ''}{currentConfig.maxAllowedRadiusMeters}m
                </span>
              </div>
              <p className="text-3xs text-slate-600">
                {coords
                  ? `Lat: ${coords.lat.toFixed(4)}, Lng: ${coords.lng.toFixed(4)}`
                  : `Hospital Center: ${Number(currentConfig.hospitalLat).toFixed(4)}, ${Number(currentConfig.hospitalLng).toFixed(4)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-white/80 border border-current">
              <Radio className="h-3 w-3 animate-pulse text-emerald-600" />
              <span>Real GPS Locked</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="geofence-production-card"
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1E3A8A] via-indigo-900 to-slate-900 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Lock className="h-4 w-4 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold tracking-wide uppercase text-white">
                  Real GPS Geofence Security
                </h4>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Production Enforcement
                </span>
              </div>
              <p className="text-3xs text-blue-200 font-mono">
                Boundary: {currentConfig.maxAllowedRadiusMeters}m perimeter from {currentConfig.hospitalName}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-3xs font-mono text-slate-300 block">GPS Coordinates:</span>
            <span className="text-2xs font-mono font-bold text-white">
              {Number(currentConfig.hospitalLat).toFixed(4)}° N, {Number(currentConfig.hospitalLng).toFixed(4)}° E
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-3xs font-semibold text-slate-500 uppercase block mb-0.5">Enforcement Perimeter</span>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-mono font-extrabold text-slate-800">{currentConfig.maxAllowedRadiusMeters} Meters</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-3xs font-semibold text-slate-500 uppercase block mb-0.5">Location Verification</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800">Triggered on Punch In/Out</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-3xs font-semibold text-slate-500 uppercase block mb-0.5">Device GPS State</span>
            <div className="flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-indigo-600" />
              <span className="text-xs font-mono font-bold text-slate-800">
                {coords ? `${verification.distanceMeters.toFixed(1)}m from center` : 'Awaiting punch action'}
              </span>
            </div>
          </div>
        </div>

        {coords && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-2xs text-emerald-900">
            <span className="font-semibold">
              Live Coordinate Locked: {coords.lat.toFixed(5)}° N, {coords.lng.toFixed(5)}° E
              {accuracy ? ` (±${accuracy.toFixed(1)}m accuracy)` : ''}
            </span>
            {lastVerifiedAt && <span className="font-mono text-3xs text-emerald-700">Verified at {lastVerifiedAt}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
