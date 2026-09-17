import React from 'react';
import {
  ShieldAlert,
  AlertOctagon,
  X,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import {
  HOSPITAL_LAT,
  HOSPITAL_LNG,
  MAX_ALLOWED_RADIUS_METERS,
  HOSPITAL_NAME,
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
                <strong>{MAX_ALLOWED_RADIUS_METERS}m</strong> perimeter of the hospital center. Your live browser GPS coordinates exceed this limit.
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
              <span className="text-xs text-slate-600">Calculated Distance from Center:</span>
              <span className="font-mono text-sm font-extrabold text-rose-600">
                {result.distanceMeters > 900000 ? 'Signal Undetermined' : `${result.distanceMeters.toFixed(1)} meters`}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">Maximum Allowed Radius:</span>
              <span className="font-mono text-xs font-bold text-slate-700">
                {MAX_ALLOWED_RADIUS_METERS} meters
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">Violation Margin:</span>
              <span className="font-mono text-xs font-extrabold text-rose-700">
                {result.distanceMeters > 900000
                  ? 'Signal Undetermined'
                  : `+${(result.distanceMeters - MAX_ALLOWED_RADIUS_METERS).toFixed(1)} meters out of bounds`}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 text-2xs font-mono text-slate-600 space-y-1">
              <div className="flex items-center justify-between">
                <span>Detected Coordinates:</span>
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

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <MapPin className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Next Steps for Staff:</p>
              <p className="text-2xs text-amber-800 mt-0.5">
                Please proceed inside the hospital building (within 100 meters of the central entrance) and ensure high-accuracy device location is enabled.
              </p>
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
          {onLocationCorrected && (
            <button
              type="button"
              id="btn-retry-live-gps"
              onClick={() => {
                onClose();
                onLocationCorrected();
              }}
              className="w-full sm:w-auto px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry Real GPS Scan</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
