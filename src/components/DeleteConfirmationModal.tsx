import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, Loader2, X, ShieldAlert } from 'lucide-react';

export interface DeleteConfirmationModalProps {
  isOpen: boolean;
  title?: string;
  message?: React.ReactNode;
  itemName?: string;
  itemType?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  loading?: boolean; // alias
  variant?: 'danger' | 'warning';
  dangerDetails?: string;
  id?: string;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  title = 'Confirm Permanent Deletion',
  message,
  itemName,
  itemType,
  confirmText = 'Accept & Delete',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
  loading = false,
  variant = 'danger',
  dangerDetails,
  id = 'delete-confirmation-modal',
}) => {
  const activeLoading = isLoading || loading;

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !activeLoading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, activeLoading]);

  if (!isOpen) return null;

  const isWarning = variant === 'warning';

  return (
    <div
      id={id}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !activeLoading) {
          onCancel();
        }
      }}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-md w-full overflow-hidden text-left transition-all scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon / Status Banner */}
        <div className={`h-1.5 w-full ${isWarning ? 'bg-amber-500' : 'bg-rose-600'}`} />

        <div className="p-6">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center ${
                isWarning ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-600'
              }`}
            >
              {isWarning ? <AlertTriangle className="h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
            </div>

            <div className="flex-1 min-w-0 pr-6">
              <h3 id={`${id}-title`} className="text-base font-bold text-slate-900 leading-snug">
                {title}
              </h3>
              {itemType && (
                <span className="inline-block mt-0.5 text-2xs font-semibold uppercase tracking-wider text-slate-500">
                  Target: {itemType}
                </span>
              )}
            </div>

            {/* Close Cross */}
            <button
              type="button"
              onClick={onCancel}
              disabled={activeLoading}
              aria-label="Close dialog"
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Item Highlight Badge (if provided) */}
          {itemName && (
            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5">
              <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-2xs text-slate-500 block">Item to remove:</span>
                <p className="text-xs font-bold text-slate-900 truncate font-mono">{itemName}</p>
              </div>
            </div>
          )}

          {/* Message Body */}
          <div className="mt-3.5 text-xs text-slate-600 leading-relaxed">
            {message ? (
              message
            ) : (
              <p>
                Are you sure you want to permanently delete this record? This action cannot be undone
                and will be permanently removed from all operational rosters and cloud storage.
              </p>
            )}
          </div>

          {/* Danger Details Footnote */}
          {dangerDetails && (
            <div className="mt-3 text-2xs text-amber-700 bg-amber-50/80 p-2.5 rounded-lg border border-amber-200/60 leading-normal">
              {dangerDetails}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 pt-3.5 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              id={`${id}-cancel-btn`}
              onClick={onCancel}
              disabled={activeLoading}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {cancelText}
            </button>

            <button
              type="button"
              id={`${id}-confirm-btn`}
              onClick={onConfirm}
              disabled={activeLoading}
              className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer ${
                isWarning
                  ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                  : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {activeLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{confirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
