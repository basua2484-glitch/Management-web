import React from 'react';
import { X, FolderLock } from 'lucide-react';
import { EmployeeDocumentVault, type EmployeeDocumentVaultProps } from './EmployeeDocumentVault';

export interface DocumentVaultModalProps extends EmployeeDocumentVaultProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

/**
 * Centered responsive Document Vault Modal:
 * Wraps EmployeeDocumentVault in a fixed backdrop:
 * `fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4`
 * with max-width:
 * `max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl`
 */
export const DocumentVaultModal: React.FC<DocumentVaultModalProps> = ({
  isOpen,
  onClose,
  title = 'Employee Document Vault',
  ...vaultProps
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="document-vault-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        id="document-vault-modal-dialog"
        className="max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 sticky top-0 z-20 backdrop-blur-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E3A8A] text-white">
              <FolderLock className="h-5 w-5 text-emerald-300" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {title}
              </h2>
              <p className="text-2xs text-slate-500 font-medium">
                Verified Onboarding Dossiers & Mandatory Compliance Credentials
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            aria-label="Close Document Vault"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6">
          <EmployeeDocumentVault {...vaultProps} />
        </div>
      </div>
    </div>
  );
};

export default DocumentVaultModal;
