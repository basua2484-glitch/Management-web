// src/components/modals/CredentialCardModal.tsx - DYNAMIC CREDENTIAL SLIP FIX

import React from 'react';

export interface CredentialCardModalProps {
  isOpen: boolean;
  staffData: {
    name: string;
    staff_id: string; // Dynamic ID
    password?: string;
  } | null;
  onClose: () => void;
}

export const CredentialCardModal: React.FC<CredentialCardModalProps> = ({
  isOpen,
  staffData,
  onClose
}) => {
  if (!isOpen || !staffData) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="modal-dynamic-credential-slip">
      <div className="bg-zinc-900 rounded-2xl max-w-sm w-full p-6 text-white border border-zinc-800 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
            🔑 STAFF CREDENTIAL SLIP
          </span>
          <button onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer">✕</button>
        </div>

        <div className="bg-white text-zinc-900 rounded-xl p-5 mb-4 text-center font-mono space-y-2">
          <div className="text-xs text-indigo-900 font-bold mb-3">HK Ops Login Credentials</div>
          
          <div className="text-sm">
            <span className="text-zinc-500">Name: </span>
            <span className="font-bold">{staffData.name}</span>
          </div>

          <div className="text-sm">
            <span className="text-zinc-500">Staff ID: </span>
            {/* 🛑 FIX: Dynamic ID rendering instead of static 'SAHO-STF-001' */}
            <span className="font-bold text-indigo-600">{staffData.staff_id}</span>
          </div>

          <div className="text-sm">
            <span className="text-zinc-500">Default Pass: </span>
            <span className="font-bold">{staffData.password || '123456'}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              try {
                navigator.clipboard.writeText(`ID: ${staffData.staff_id} Pass: ${staffData.password || '123456'}`);
              } catch (e) {
                console.warn('Clipboard write error:', e);
              }
            }}
            className="flex-1 py-2.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl cursor-pointer"
          >
            📋 COPY SLIP
          </button>
          <button
            onClick={() => {
              try {
                window.print();
              } catch (e) {
                console.warn('Print error:', e);
              }
            }}
            className="flex-1 py-2.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl cursor-pointer"
          >
            🖨️ PRINT
          </button>
        </div>
      </div>
    </div>
  );
};
