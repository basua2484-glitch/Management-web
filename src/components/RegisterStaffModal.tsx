import React, { useState } from 'react';
import { X, UserPlus, Check, AlertTriangle, Shield, KeyRound, Building2, User } from 'lucide-react';
import type { UserRole } from '../types';
import type { CredentialCardData } from './CredentialCardModal';

interface RegisterStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: UserRole;
  onStaffAccountCreated?: (slip: CredentialCardData) => void;
  onRegister: (data: {
    staff_id?: string;
    username: string;
    password: string;
    name: string;
    role: UserRole;
    assigned_area: string;
    assigned_shift?: string;
    duty_type?: 'FIXED' | 'PERMANENT_RELIEVER' | 'TEMP_RELIEVER';
    fixed_department?: string;
    is_temp_reliever?: boolean;
    temp_department?: string | null;
  }) => { success: boolean; message: string };
}

export const RegisterStaffModal: React.FC<RegisterStaffModalProps> = ({
  isOpen,
  onClose,
  currentUserRole = 'admin',
  onStaffAccountCreated,
  onRegister,
}) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123456');
  const [role, setRole] = useState<UserRole>('staff');
  const [assignedArea, setAssignedArea] = useState('General Ward');
  const [assignedShift, setAssignedShift] = useState<'7-3' | '3-11' | '11-7'>('7-3');
  const [dutyType, setDutyType] = useState<'FIXED' | 'PERMANENT_RELIEVER' | 'TEMP_RELIEVER'>('FIXED');
  const [isTempReliever, setIsTempReliever] = useState(false);
  const [tempDepartment, setTempDepartment] = useState('');
  const [errorWarning, setErrorWarning] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorWarning(null);

    // Strict Guard Check matching:
    // if current_user.role != 'admin':
    //     return jsonify({"error": "Unauthorized Access: Admin Privileges Required"}), 403
    if (currentUserRole !== 'admin') {
      setErrorWarning('Unauthorized Access: Admin Privileges Required');
      return;
    }

    const regUsername = username.trim();
    const regPassword = password.trim();
    const regName = name.trim();
    const regArea = assignedArea.trim() || 'General Ward';

    const result = onRegister({
      staff_id: regUsername,
      username: regUsername,
      password: regPassword,
      name: regName,
      role,
      assigned_area: regArea,
      assigned_shift: assignedShift,
      duty_type: dutyType,
      fixed_department: regArea,
      is_temp_reliever: isTempReliever,
      temp_department: isTempReliever && tempDepartment.trim() ? tempDepartment.trim() : null,
    });

    if (!result.success) {
      setErrorWarning(result.message);
    } else {
      onStaffAccountCreated?.({
        name: regName,
        staffId: regUsername,
        defaultPass: regPassword,
        url: 'hk-app.hospital.com',
        department: regArea,
        role,
      });

      // Clear form & close
      setName('');
      setUsername('');
      setPassword('123456');
      setRole('staff');
      setAssignedArea('General Ward');
      setAssignedShift('7-3');
      setErrorWarning(null);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150 font-mono"
      id="modal-create-staff-account"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[500px] my-auto">
        <div className="bg-[#151517] border border-white/20 shadow-2xl rounded-xl overflow-hidden text-left text-white">
          
          {/* Header */}
          <div className="bg-[#1A1A1E] px-5 py-4 flex items-center justify-between border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#00FF9C]" />
                <span className="text-2xs uppercase tracking-widest text-[#00FF9C] font-bold">
                  // ADMIN ONLY • POST /admin/create_staff_account
                </span>
              </div>
              <h4 className="text-base font-bold text-white tracking-tight mt-1 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-white/80" />
                <span>New Staff Account Creator</span>
              </h4>
            </div>
            <button
              type="button"
              className="text-white/40 hover:text-white p-1.5 rounded hover:bg-white/5 transition-colors cursor-pointer"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form matching @app.route('/admin/create_staff_account', methods=['POST']) */}
          <form action="/admin/create_staff_account" method="POST" onSubmit={handleSubmit}>
            <div className="p-5 space-y-4 text-xs">
              
              {/* Flash Warning Banner */}
              {errorWarning && (
                <div
                  className="flex items-center gap-2 rounded border border-amber-500/50 bg-amber-950/60 p-3 text-xs font-semibold text-amber-200"
                  role="alert"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>{errorWarning}</span>
                </div>
              )}

              {/* Staff ID / Username */}
              <div>
                <label
                  htmlFor="create-staff-username"
                  className="block font-bold text-2xs uppercase tracking-wider text-white/70 mb-1"
                >
                  Staff ID (staff_id - Unique) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="create-staff-username"
                    name="username"
                    required
                    placeholder="e.g. HK-001"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (errorWarning) setErrorWarning(null);
                    }}
                    autoComplete="off"
                    className="w-full rounded border border-white/10 bg-[#0D0D0E] px-3 py-2 text-xs text-white placeholder:text-white/20 focus:border-[#00FF9C] focus:outline-hidden focus:ring-1 focus:ring-[#00FF9C]"
                  />
                </div>
                <p className="text-3xs text-white/40 mt-1">
                  Unique staff_id in User model (e.g. HK-001, used for login &amp; punch portal).
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label
                  htmlFor="create-staff-name"
                  className="block font-bold text-2xs uppercase tracking-wider text-white/70 mb-1"
                >
                  Full Name (Naam) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="create-staff-name"
                    name="name"
                    required
                    placeholder="e.g. Pooja Verma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded border border-white/10 bg-[#0D0D0E] px-3 py-2 text-xs text-white placeholder:text-white/20 focus:border-[#00FF9C] focus:outline-hidden focus:ring-1 focus:ring-[#00FF9C]"
                  />
                </div>
              </div>

              {/* Temp Password */}
              <div>
                <label
                  htmlFor="create-staff-password"
                  className="block font-bold text-2xs uppercase tracking-wider text-white/70 mb-1"
                >
                  Temporary Password *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="create-staff-password"
                    name="password"
                    required
                    placeholder="e.g. 123456"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded border border-white/10 bg-[#0D0D0E] px-3 py-2 text-xs text-white placeholder:text-white/20 focus:border-[#00FF9C] focus:outline-hidden focus:ring-1 focus:ring-[#00FF9C]"
                  />
                </div>
                <p className="text-3xs text-white/40 mt-1">
                  Default temp password: <span className="text-[#00FF9C]">123456</span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-white/10">
                {/* Role */}
                <div>
                  <label
                    htmlFor="create-staff-role"
                    className="block font-bold text-2xs uppercase tracking-wider text-white/70 mb-1"
                  >
                    Role
                  </label>
                  <select
                    id="create-staff-role"
                    name="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full rounded border border-white/10 bg-[#0D0D0E] px-3 py-2 text-xs text-white focus:border-[#00FF9C] focus:outline-hidden focus:ring-1 focus:ring-[#00FF9C]"
                  >
                    <option value="staff">Staff (Punch Only)</option>
                    <option value="supervisor">Supervisor (Floor Lead)</option>
                    <option value="manager">Manager (Reports &amp; Assign)</option>
                    <option value="admin">Admin (Full Control)</option>
                  </select>
                </div>

                {/* Assigned Area / Ward */}
                <div>
                  <label
                    htmlFor="create-staff-area"
                    className="block font-bold text-2xs uppercase tracking-wider text-white/70 mb-1"
                  >
                    Assigned Area
                  </label>
                  <input
                    type="text"
                    id="create-staff-area"
                    name="assigned_area"
                    value={assignedArea}
                    onChange={(e) => setAssignedArea(e.target.value)}
                    placeholder="Default: General Ward"
                    className="w-full rounded border border-white/10 bg-[#0D0D0E] px-3 py-2 text-xs text-white placeholder:text-white/20 focus:border-[#00FF9C] focus:outline-hidden focus:ring-1 focus:ring-[#00FF9C]"
                  />
                </div>
              </div>

              {/* Duty Allocation Settings */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <label className="block font-bold text-2xs uppercase tracking-wider text-white/70">
                  Duty Type (duty_type)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'FIXED' as const, label: 'FIXED' },
                    { key: 'PERMANENT_RELIEVER' as const, label: 'PERM RELIEVER' },
                    { key: 'TEMP_RELIEVER' as const, label: 'TEMP RELIEVER' },
                  ].map((dt) => (
                    <button
                      key={dt.key}
                      type="button"
                      onClick={() => {
                        setDutyType(dt.key);
                        if (dt.key === 'TEMP_RELIEVER') setIsTempReliever(true);
                      }}
                      className={`py-1.5 px-2 rounded text-2xs font-semibold border transition-all text-center ${
                        dutyType === dt.key
                          ? 'border-[#00FF9C] bg-[#00FF9C]/10 text-[#00FF9C]'
                          : 'border-white/10 text-white/60 hover:bg-white/5'
                      }`}
                    >
                      {dt.label}
                    </button>
                  ))}
                </div>

                {/* Temp Reliever Toggle */}
                <div className="pt-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-2xs text-white/80">
                    <input
                      type="checkbox"
                      checked={isTempReliever}
                      onChange={(e) => setIsTempReliever(e.target.checked)}
                      className="rounded border-white/20 bg-[#0D0D0E] text-[#00FF9C] focus:ring-[#00FF9C]"
                    />
                    <span>Temporary Reliever Override (is_temp_reliever)</span>
                  </label>
                  {isTempReliever && (
                    <input
                      type="text"
                      placeholder="Temp Department (e.g. ICU, Emergency)"
                      value={tempDepartment}
                      onChange={(e) => setTempDepartment(e.target.value)}
                      className="mt-2 w-full rounded border border-white/10 bg-[#0D0D0E] px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:border-[#00FF9C] focus:outline-hidden focus:ring-1 focus:ring-[#00FF9C]"
                    />
                  )}
                </div>
              </div>

              {/* Assigned Shift */}
              <div className="pt-2">
                <label className="block font-bold text-2xs uppercase tracking-wider text-white/70 mb-1">
                  Assigned Shift (assigned_shift)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: '7-3', label: '7-3 (Morning)' },
                    { key: '3-11', label: '3-11 (Evening)' },
                    { key: '11-7', label: '11-7 (Night)' },
                  ].map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setAssignedShift(s.key as any)}
                      className={`py-1.5 px-2 rounded text-2xs font-semibold border transition-all text-center ${
                        assignedShift === s.key
                          ? 'border-[#00FF9C] bg-[#00FF9C]/10 text-[#00FF9C]'
                          : 'border-white/10 text-white/60 hover:bg-white/5'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="bg-[#1A1A1E] border-t border-white/10 px-5 py-3.5 flex items-center justify-between">
              <span className="text-3xs text-white/40">
                No public signup enabled
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-create-staff-submit"
                  className="px-4 py-1.5 rounded bg-[#00FF9C] hover:bg-[#00e58c] active:bg-[#00cc7d] text-[#0D0D0E] font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Create Account</span>
                </button>
              </div>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};
