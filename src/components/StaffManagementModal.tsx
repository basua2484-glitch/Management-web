import React, { useState } from 'react';
import { X, Plus, Users, Check, Phone, Building, KeyRound, Ticket } from 'lucide-react';
import type { StaffUser, AppUser, UserRole } from '../types';
import type { CredentialCardData } from './CredentialCardModal';

interface StaffManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffUser[];
  users?: AppUser[];
  currentUserRole?: UserRole;
  onAddStaff: (newStaff: Omit<StaffUser, 'id' | 'staffCode'>) => void;
  onToggleActive: (staffId: number) => void;
  onViewCredentialSlip?: (slip: CredentialCardData) => void;
}

export const StaffManagementModal: React.FC<StaffManagementModalProps> = ({
  isOpen,
  onClose,
  staff,
  users = [],
  currentUserRole = 'admin',
  onAddStaff,
  onToggleActive,
  onViewCredentialSlip,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Floors & Rooms');
  const [shift, setShift] = useState<'Morning' | 'Evening' | 'Night'>('Morning');
  const [role, setRole] = useState<'staff' | 'supervisor' | 'lead'>('staff');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const nextStaffCode = `HK-${(staff.length + 1).toString().padStart(3, '0')}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!name.trim()) return;

    // Strict Guard Check: if current_user.role != 'admin': 403
    if (currentUserRole !== 'admin') {
      setErrorMessage('Unauthorized Access: Admin Privileges Required');
      return;
    }

    onAddStaff({
      name: name.trim(),
      department,
      shift,
      role,
      phone: phone.trim() || undefined,
      active: true,
    });

    setName('');
    setPhone('');
    setIsAdding(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      id="modal-staff-management"
    >
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-[#1E3A8A]">
              <Users className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-900">Housekeeping Staff Roster</h2>
          </div>

          <div className="flex items-center gap-2">
            {!isAdding && (
              <button
                type="button"
                id="btn-add-staff-member"
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#1E3A8A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-900"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Staff</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Add Staff Form */}
          {isAdding && (
            <form
              onSubmit={handleSubmit}
              className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3"
            >
              {errorMessage && (
                <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                  {errorMessage}
                </div>
              )}
              <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E3A8A]">
                  New Staff Member (ID: {nextStaffCode})
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Deepak Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Department / Area
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  >
                    <option value="Floors & Rooms">Floors & Rooms</option>
                    <option value="Lobby & Common Areas">Lobby & Common Areas</option>
                    <option value="Laundry & Linen">Laundry & Linen</option>
                    <option value="Kitchen & Dining Sanitation">Kitchen & Dining Sanitation</option>
                    <option value="Deep Cleaning & Waste Mgmt">Deep Cleaning & Waste Mgmt</option>
                    <option value="Guest Suites">Guest Suites</option>
                    <option value="Executive Floor">Executive Floor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Default Shift
                  </label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value as any)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  >
                    <option value="Morning">Morning (08:00 - 16:30)</option>
                    <option value="Evening">Evening (14:00 - 22:30)</option>
                    <option value="Night">Night (22:00 - 06:30)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 00000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#1E3A8A] px-3.5 py-1 text-xs font-semibold text-white hover:bg-blue-900"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Staff Member</span>
                </button>
              </div>
            </form>
          )}

          {/* Roster List */}
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                <tr>
                  <th className="border border-slate-200 px-3 py-2.5 text-center">Staff ID</th>
                  <th className="border border-slate-200 px-4 py-2.5">Name</th>
                  <th className="border border-slate-200 px-3 py-2.5">Department</th>
                  <th className="border border-slate-200 px-3 py-2.5 text-center">Shift</th>
                  <th className="border border-slate-200 px-3 py-2.5">Contact</th>
                  <th className="border border-slate-200 px-3 py-2.5 text-center">Status</th>
                  <th className="border border-slate-200 px-3 py-2.5 text-center">Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {staff.map((s) => {
                  const matchingUser = users.find(
                    (u) =>
                      (u.staffId && u.staffId === s.id) ||
                      u.name.toLowerCase() === s.name.toLowerCase() ||
                      u.username.toLowerCase() === s.staffCode.toLowerCase() ||
                      u.username.toLowerCase() === `hk${s.id.toString().padStart(3, '0')}` ||
                      u.username.toLowerCase() === `hk${s.id}`
                  );
                  const staffIdStr = matchingUser
                    ? matchingUser.username
                    : `hk${s.id.toString().padStart(3, '0')}`;
                  const passStr = matchingUser?.password || '123456';

                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-3 py-2.5 text-center font-mono font-bold text-[#1E3A8A]">
                        {s.staffCode}
                      </td>
                      <td className="border border-slate-200 px-4 py-2.5 font-medium text-slate-900">
                        {s.name}
                      </td>
                      <td className="border border-slate-200 px-3 py-2.5 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Building className="h-3 w-3 text-slate-400" />
                          <span>{s.department}</span>
                        </div>
                      </td>
                      <td className="border border-slate-200 px-3 py-2.5 text-center">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-700">
                          {s.shift}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-3 py-2.5 text-slate-600">
                        {s.phone ? (
                          <div className="flex items-center gap-1 font-mono text-2xs">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{s.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="border border-slate-200 px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => onToggleActive(s.id)}
                          className={`inline-flex rounded-full px-2 py-0.5 text-2xs font-semibold cursor-pointer ${
                            s.active
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {s.active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="border border-slate-200 px-2.5 py-2.5 text-center">
                        {onViewCredentialSlip && (
                          <button
                            type="button"
                            onClick={() =>
                              onViewCredentialSlip({
                                name: s.name,
                                staffId: staffIdStr,
                                defaultPass: passStr,
                                url: 'hk-app.hospital.com',
                                department: s.department,
                                role: s.role,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] font-semibold text-2xs transition-colors border border-blue-200 cursor-pointer"
                            title={`View & Print Credential Slip for ${s.name}`}
                          >
                            <KeyRound className="h-3 w-3" />
                            <span>Slip</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 rounded-b-xl">
          <span className="text-xs text-slate-500">
            Total Staff: <strong>{staff.length}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
