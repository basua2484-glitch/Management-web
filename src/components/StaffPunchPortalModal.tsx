import React from 'react';
import { X } from 'lucide-react';
import type { StaffUser, AttendanceRecord, AppUser } from '../types';
import { StaffPunchPortal } from './StaffPunchPortal';

interface StaffPunchPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffUser[];
  records: AttendanceRecord[];
  selectedDate?: string;
  initialStaffId?: number;
  currentUser?: AppUser | null;
  onSaveRecord: (record: AttendanceRecord) => void;
  onFlash?: (message: string, type: 'success' | 'danger' | 'warning' | 'info') => void;
}

export const StaffPunchPortalModal: React.FC<StaffPunchPortalModalProps> = ({
  isOpen,
  onClose,
  staff,
  records,
  selectedDate = '2026-09-06',
  initialStaffId = 1,
  currentUser,
  onSaveRecord,
  onFlash,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      id="staff-punch-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-[460px] bg-slate-50 rounded-3xl p-3 sm:p-4 shadow-2xl border border-slate-200"
        id="staff-punch-modal-card"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/90 hover:bg-white text-slate-500 hover:text-slate-800 shadow-xs border border-slate-200 transition-colors"
          aria-label="Close Punch Portal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Embedded Portal Component */}
        <StaffPunchPortal
          staff={staff}
          records={records}
          selectedDate={selectedDate}
          initialStaffId={initialStaffId}
          currentUser={currentUser}
          onSaveRecord={onSaveRecord}
          onFlash={onFlash}
          isModal={true}
        />
      </div>
    </div>
  );
};

