import React from 'react';
import { Smartphone, X, RotateCw, AlertTriangle, Settings, ArrowRight } from 'lucide-react';
import { GPS_OFF_ALERT_MESSAGE } from '../utils/geofence';

export interface GpsHardwareAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
  punchType?: 'IN' | 'OUT';
}

export const GpsHardwareAlertModal: React.FC<GpsHardwareAlertModalProps> = ({
  isOpen,
  onClose,
  onRetry,
  punchType = 'IN',
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="gps-hardware-alert-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="gps-hardware-alert-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="gps-hardware-alert-title"
        className="bg-white rounded-2xl shadow-2xl border-2 border-amber-500 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Amber / Warning Header */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
                <Smartphone className="h-6 w-6 text-white animate-pulse" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-900/40 text-amber-100 text-2xs font-extrabold uppercase tracking-wider mb-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Hardware Sensor Alert</span>
                </div>
                <h3
                  id="gps-hardware-alert-title"
                  className="text-lg font-black text-white tracking-tight"
                >
                  Device GPS is Turned OFF
                </h3>
              </div>
            </div>
            <button
              type="button"
              id="btn-close-gps-alert-modal"
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
          {/* Main Required Alert Message */}
          <div
            role="alert"
            id="gps-alert-callout"
            className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-950 flex items-start gap-3 shadow-2xs"
          >
            <div className="h-7 w-7 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 mt-0.5 font-black text-sm">
              !
            </div>
            <div className="text-xs space-y-1">
              <p className="font-extrabold text-sm text-amber-950 leading-snug">
                {GPS_OFF_ALERT_MESSAGE}
              </p>
              <p className="text-amber-800 text-2xs leading-relaxed">
                Hospital labor regulations require biometric and mobile attendance punches to verify physical presence via active satellite GPS coordinates. Punch {punchType === 'IN' ? 'In' : 'Out'} cannot proceed until GPS is enabled.
              </p>
            </div>
          </div>

          {/* Device Instructions */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs text-slate-700">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Settings className="h-4 w-4 text-slate-600" />
              <span>How to Enable Location:</span>
            </div>

            <div className="space-y-2 text-2xs">
              <div className="p-2 rounded-lg bg-white border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">Android Phones:</span>
                <span className="text-slate-600">
                  Swipe down from the top of your screen to open Quick Settings &rarr; Tap the <strong>Location / GPS</strong> toggle to turn it <strong>ON</strong>.
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">Apple iPhones (iOS):</span>
                <span className="text-slate-600">
                  Go to <strong>Settings</strong> &rarr; <strong>Privacy &amp; Security</strong> &rarr; <strong>Location Services</strong> &rarr; Toggle <strong>ON</strong>.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            id="btn-dismiss-gps-modal"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Dismiss
          </button>
          {onRetry && (
            <button
              type="button"
              id="btn-modal-retry-gps-punch"
              onClick={() => {
                onClose();
                onRetry();
              }}
              className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>I Turned ON GPS &mdash; Retry {punchType === 'IN' ? 'Punch In' : 'Punch Out'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
