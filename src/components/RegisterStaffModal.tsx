import React, { useState } from 'react';
import { X, UserPlus, Check, AlertTriangle } from 'lucide-react';
import type { UserRole } from '../types';

interface RegisterStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (data: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
    department: string;
    shift: 'Morning' | 'Evening' | 'Night';
  }) => { success: boolean; message: string };
}

export const RegisterStaffModal: React.FC<RegisterStaffModalProps> = ({
  isOpen,
  onClose,
  onRegister,
}) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [department, setDepartment] = useState('3rd Floor Wards');
  const [shift, setShift] = useState<'Morning' | 'Evening' | 'Night'>('Morning');
  const [errorWarning, setErrorWarning] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorWarning(null);

    const result = onRegister({
      username: username.trim(),
      password,
      name: name.trim(),
      role,
      department: department.trim() || 'General Wards',
      shift,
    });

    if (!result.success) {
      setErrorWarning(result.message);
    } else {
      // Clear form & close
      setName('');
      setUsername('');
      setPassword('');
      setRole('staff');
      setDepartment('3rd Floor Wards');
      setShift('Morning');
      onClose();
    }
  };

  return (
    /* Modal Fade Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      id="addUserModal"
      tabIndex={-1}
      aria-labelledby="addUserModalLabel"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* modal-dialog modal-dialog-centered */}
      <div className="w-full max-w-[480px] my-auto">
        {/* modal-content border-0 shadow-lg rounded-4 */}
        <div className="modal-content bg-white border-0 shadow-2xl rounded-2xl overflow-hidden text-left transition-all">
          
          {/* Modal Header: bg-dark text-white rounded-top-4 */}
          <div className="modal-header bg-[#212529] text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-700">
            <h5
              className="modal-title font-bold text-base sm:text-lg flex items-center tracking-tight text-white m-0"
              id="addUserModalLabel"
            >
              <UserPlus className="h-5 w-5 mr-2 text-teal-400 inline-block shrink-0" />
              <span>Naya User / Staff Register Karein</span>
            </h5>
            <button
              type="button"
              className="btn-close text-slate-300 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body (Form): <form action="/admin/add_user" method="POST"> */}
          <form action="/admin/add_user" method="POST" onSubmit={handleSubmit}>
            <div className="modal-body p-5 sm:p-6 space-y-4">
              
              {/* Flask Flash Warning if Username exists */}
              {errorWarning && (
                <div
                  className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900 shadow-xs"
                  role="alert"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>{errorWarning}</span>
                </div>
              )}

              {/* Full Name Field */}
              <div className="mb-3">
                <label
                  htmlFor="add-user-name"
                  className="block font-bold text-xs text-[#6c757d] mb-1.5 uppercase tracking-wide"
                >
                  Full Name (Pura Naam)
                </label>
                <input
                  type="text"
                  id="add-user-name"
                  name="name"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-lg border border-[#dee2e6] bg-white px-3.5 py-2.5 text-sm text-[#212529] placeholder:text-[#adb5bd] focus:border-[#86b7fe] focus:outline-hidden focus:ring-3 focus:ring-[#0d6efd]/20 transition-all"
                />
              </div>

              {/* Username / Employee ID Field */}
              <div className="mb-3">
                <label
                  htmlFor="add-user-username"
                  className="block font-bold text-xs text-[#6c757d] mb-1.5 uppercase tracking-wide"
                >
                  Username / Staff ID
                </label>
                <input
                  type="text"
                  id="add-user-username"
                  name="username"
                  required
                  placeholder="e.g. hk105"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorWarning) setErrorWarning(null);
                  }}
                  autoComplete="off"
                  className="block w-full rounded-lg border border-[#dee2e6] bg-white px-3.5 py-2.5 text-sm text-[#212529] placeholder:text-[#adb5bd] focus:border-[#86b7fe] focus:outline-hidden focus:ring-3 focus:ring-[#0d6efd]/20 transition-all"
                />
              </div>

              {/* Password Field */}
              <div className="mb-3">
                <label
                  htmlFor="add-user-password"
                  className="block font-bold text-xs text-[#6c757d] mb-1.5 uppercase tracking-wide"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="add-user-password"
                  name="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="block w-full rounded-lg border border-[#dee2e6] bg-white px-3.5 py-2.5 text-sm text-[#212529] placeholder:text-[#adb5bd] focus:border-[#86b7fe] focus:outline-hidden focus:ring-3 focus:ring-[#0d6efd]/20 transition-all"
                />
              </div>

              {/* System Role Select */}
              <div className="mb-3">
                <label
                  htmlFor="add-user-role"
                  className="block font-bold text-xs text-[#6c757d] mb-1.5 uppercase tracking-wide"
                >
                  System Access Role
                </label>
                <select
                  id="add-user-role"
                  name="role"
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="block w-full rounded-lg border border-[#dee2e6] bg-white px-3.5 py-2.5 text-sm text-[#212529] focus:border-[#86b7fe] focus:outline-hidden focus:ring-3 focus:ring-[#0d6efd]/20 transition-all font-medium"
                >
                  <option value="staff">Housekeeping Staff (Punch Only Access)</option>
                  <option value="manager">Manager / Supervisor (Report &amp; Assign Access)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              {/* Assigned Location / Department (Contextual for Staff & Manager) */}
              <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="add-user-department"
                    className="block font-bold text-[11px] text-[#6c757d] mb-1 uppercase tracking-wide"
                  >
                    Ward / Department
                  </label>
                  <input
                    type="text"
                    id="add-user-department"
                    name="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. 3rd Floor Wards"
                    className="block w-full rounded-lg border border-[#dee2e6] bg-slate-50/50 px-3 py-2 text-xs text-[#212529] placeholder:text-[#adb5bd] focus:border-[#86b7fe] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0d6efd]/20 transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor="add-user-shift"
                    className="block font-bold text-[11px] text-[#6c757d] mb-1 uppercase tracking-wide"
                  >
                    Assigned Shift
                  </label>
                  <select
                    id="add-user-shift"
                    name="shift"
                    value={shift}
                    onChange={(e) => setShift(e.target.value as any)}
                    className="block w-full rounded-lg border border-[#dee2e6] bg-slate-50/50 px-3 py-2 text-xs text-[#212529] focus:border-[#86b7fe] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0d6efd]/20 transition-all"
                  >
                    <option value="Morning">Morning (07:00 - 15:30)</option>
                    <option value="Evening">Evening (15:00 - 23:30)</option>
                    <option value="Night">Night (23:00 - 07:30)</option>
                  </select>
                </div>
              </div>

            </div>

            {/* Modal Footer Buttons: bg-light rounded-bottom-4 */}
            <div className="modal-footer bg-[#f8f9fa] border-t border-[#dee2e6] px-5 py-3.5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                className="btn btn-secondary text-xs font-semibold px-4 py-2 rounded-lg bg-[#6c757d] hover:bg-[#5c636a] active:bg-[#565e64] text-white shadow-xs transition-colors"
                data-bs-dismiss="modal"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn-save-user-submit"
                className="btn btn-primary text-xs font-bold px-4 py-2 rounded-lg bg-[#0d6efd] hover:bg-[#0b5ed7] active:bg-[#0a58ca] text-white shadow-xs transition-colors inline-flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>Save User</span>
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};

