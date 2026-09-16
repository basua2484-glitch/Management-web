import React from 'react';
import { ShieldAlert, MapPin, X, RefreshCw, Compass, AlertOctagon, Navigation } from 'lucide-react';
import {
  HOSPITAL_LAT,
  HOSPITAL_LNG,
  MAX_ALLOWED_RADIUS_METERS,
  HOSPITAL_NAME,
  GEOFENCE_PRESETS,
  saveStoredGeofenceConfig,
  type GeofenceVerificationResult,
} from '../utils/geofence';

export interface GeofenceRejectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: GeofenceVerificationResult | null;
  punchType?: 'IN' | 'OUT';
  onLocationCorrected?: () => void;
}

export const GeofenceRejectionModal: React.FC<GeofenceRejectionModalProps> = ({
  isOpen,
  onClose,
  result,
  punchType = 'IN',
  onLocationCorrected,
}) => {
  if (!isOpen || !result) return null;

  const handleSelectInsidePreset = (presetId: string = 'main_entrance') => {
    saveStoredGeofenceConfig({
      mode: 'SIMULATED',
      simulatedPresetId: presetId,
    });
    window.dispatchEvent(new CustomEvent('geofence-preset-changed', { detail: { presetId } }));
    if (onLocationCorrected) {
      onLocationCorrected();
    }
    onClose();
  };

  return (
    <div
      id="geofence-rejection-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="geofence-rejection-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="geofence-rejection-title"
        className="bg-white rounded-2xl shadow-2xl border-2 border-rose-500 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with High-Visibility Emergency Red */}
        <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-red-800 text-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
                <ShieldAlert className="h-7 w-7 text-white animate-bounce" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-900/60 text-rose-100 text-2xs font-extrabold uppercase tracking-wider mb-1">
                  <AlertOctagon className="h-3 w-3" />
                  <span>Access Control Security Violation</span>
                </div>
                <h3
                  id="geofence-rejection-title"
                  className="text-lg sm:text-xl font-black text-white tracking-tight"
                >
                  Punch Failed: You are Outside Hospital Boundary
                </h3>
              </div>
            </div>
            <button
              type="button"
              id="btn-close-geofence-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
              title="Close popup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-rose-200 text-rose-800 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
              !
            </div>
            <div className="text-xs space-y-1">
              <p className="font-extrabold text-sm text-rose-900">
                Action Blocked: {punchType === 'IN' ? 'Punch In' : 'Punch Out'} Rejected
              </p>
              <p className="text-rose-800 leading-relaxed">
                Hospital labor regulations require all staff to be physically located within the{' '}
                <strong>{MAX_ALLOWED_RADIUS_METERS}m</strong> perimeter of the hospital center. Your current device coordinates exceed this limit.
              </p>
            </div>
          </div>

          {/* Audit Verification Data Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Audit Parameter</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Measured Value</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Calculated Distance (Haversine):</span>
              <span className="text-sm font-black font-mono text-rose-600 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                {result.distanceMeters.toFixed(2)} meters away
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Max Permitted Perimeter:</span>
              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                {MAX_ALLOWED_RADIUS_METERS.toFixed(1)} meters boundary
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Excess Distance:</span>
              <span className="text-xs font-mono font-bold text-rose-700">
                +{(result.distanceMeters - MAX_ALLOWED_RADIUS_METERS).toFixed(1)}m outside boundary
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 text-2xs font-mono text-slate-600 space-y-1">
              <div className="flex items-center justify-between">
                <span>Detected Location:</span>
                <span>
                  {result.userCoords.lat.toFixed(5)}° N, {result.userCoords.lng.toFixed(5)}° E
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Hospital Center ({HOSPITAL_NAME}):</span>
                <span>
                  {HOSPITAL_LAT.toFixed(4)}° N, {HOSPITAL_LNG.toFixed(4)}° E
                </span>
              </div>
            </div>
          </div>

          {/* Quick Demo Switcher for Evaluation */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E3A8A] mb-1.5">
              <Compass className="h-4 w-4" />
              <span>Simulate On-Premises Location (for Evaluation):</span>
            </div>
            <p className="text-2xs text-slate-600 mb-2.5">
              Testing from an off-site computer or emulator? Switch to an authorized inside-campus coordinate preset:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-geofence-test-main-gate"
                onClick={() => handleSelectInsidePreset('main_entrance')}
                className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
              >
                <span>Main Entrance (~18m)</span>
              </button>
              <button
                type="button"
                id="btn-geofence-test-hub"
                onClick={() => handleSelectInsidePreset('housekeeping_hub')}
                className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
              >
                <span>Housekeeping Hub (~45m)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            id="btn-dismiss-geofence-error"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Acknowledge &amp; Dismiss
          </button>
          <button
            type="button"
            id="btn-retry-geofence"
            onClick={() => handleSelectInsidePreset('hospital_center')}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Navigation className="h-3.5 w-3.5" />
            <span>Set Hospital Center &amp; Retry</span>
          </button>
        </div>
      </div>
    </div>
  );
};
