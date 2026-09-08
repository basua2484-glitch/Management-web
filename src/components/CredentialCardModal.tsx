import React, { useState } from 'react';
import { X, Copy, Check, Printer, KeyRound, ExternalLink, ShieldCheck } from 'lucide-react';

export interface CredentialCardData {
  name: string;
  staffId: string; // e.g. 'hk005'
  defaultPass: string; // e.g. '123456'
  url?: string; // e.g. 'hk-app.hospital.com'
  department?: string;
  role?: string;
}

interface CredentialCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CredentialCardData | null;
  onQuickLogin?: (staffId: string, pass: string) => void;
}

export const CredentialCardModal: React.FC<CredentialCardModalProps> = ({
  isOpen,
  onClose,
  data,
  onQuickLogin,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !data) return null;

  const urlText = data.url || 'hk-app.hospital.com';

  const handleCopy = () => {
    const text = `HK Ops Login Credentials\nName: ${data.name}\nStaff ID: ${data.staffId}\nDefault Pass: ${data.defaultPass}\nURL: ${urlText}`;
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
    } catch (e) {
      console.warn('Clipboard write warning:', e);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.warn('Print not supported or blocked in iframe sandbox:', e);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150 font-mono text-white"
      id="modal-credential-card"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[380px] my-auto">
        <div className="bg-[#151517] border border-white/20 shadow-2xl rounded-xl overflow-hidden">
          
          {/* Header Bar */}
          <div className="bg-[#1A1A1E] px-4 py-3 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#00FF9C]" />
              <span className="text-2xs uppercase tracking-widest text-[#00FF9C] font-bold">
                Staff Credential Slip
              </span>
            </div>
            <button
              type="button"
              className="text-white/40 hover:text-white p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-6 flex flex-col items-center justify-center bg-[#0D0D0E]/60">
            {/* The exact requested credential card representation */}
            <div
              className="bg-white text-slate-800 rounded-lg shadow-xl p-4 border border-slate-300 text-center select-all transition-transform hover:scale-[1.01]"
              style={{ width: '250px' }}
              id="printable-credential-card"
            >
              <h6 className="font-bold text-[#1E3A8A] text-sm tracking-tight mb-1">
                HK Ops Login Credentials
              </h6>
              <hr className="my-2 border-slate-200" />
              <div className="text-xs space-y-1.5 text-left px-1">
                <p className="m-0 text-slate-600">
                  Name: <b className="text-slate-900 font-bold">{data.name}</b>
                </p>
                <p className="m-0 text-slate-600">
                  Staff ID: <b className="text-slate-900 font-mono font-bold text-[#1E3A8A]">{data.staffId}</b>
                </p>
                <p className="m-0 text-slate-600">
                  Default Pass: <b className="text-slate-900 font-mono font-bold">{data.defaultPass}</b>
                </p>
              </div>
              <hr className="my-2 border-slate-200" />
              <div className="text-slate-400 text-3xs font-mono">
                URL: {urlText}
              </div>
            </div>

            <p className="text-3xs text-white/40 mt-3 text-center">
              Give this physical or digital slip to the staff member for first-time login.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="bg-[#1A1A1E] border-t border-white/10 px-4 py-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 px-3 py-1.5 rounded border border-white/10 hover:bg-white/5 text-2xs uppercase tracking-wider text-white font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#00FF9C]" />
                  <span className="text-[#00FF9C]">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-white/70" />
                  <span>Copy Slip</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded border border-white/10 hover:bg-white/5 text-2xs uppercase tracking-wider text-white/80 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Print Credential Badge"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>

            {onQuickLogin && (
              <button
                type="button"
                onClick={() => {
                  onQuickLogin(data.staffId, data.defaultPass);
                  onClose();
                }}
                className="px-3 py-1.5 rounded bg-[#00FF9C] hover:bg-[#00e58c] text-[#0D0D0E] font-bold text-2xs uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>Login</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
