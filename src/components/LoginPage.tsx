import React, { useState, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Check, X, Shield, ShieldAlert, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthLoadingScreen } from './AuthLoadingScreen';
import { registerMasterAdmin } from '../services/firestoreService';
import { getStoredUsers, saveStoredUsers } from '../data/mockHousekeepingData';
import { createPasswordHash } from '../services/vaultService';

export interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isAuthLoading, role, login } = useAuth();

  // Auth state toggle: false = Sign In, true = Company Registration
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form Fields State
  const [tenantName, setTenantName] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Password Visibility Toggle State
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // Password Strength Criteria Calculation
  const passwordCriteria = useMemo(() => {
    const hasMinLength = password.length >= 8;
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasUpperLower = /[a-z]/.test(password) && /[A-Z]/.test(password);

    // Score from 0 to 4
    let score = 0;
    if (hasMinLength) score++;
    if (hasSpecialChar) score++;
    if (hasNumber) score++;
    if (hasUpperLower) score++;

    // Enforcement: Minimum 8 characters AND at least one special character
    const isValid = hasMinLength && hasSpecialChar;

    let label = 'Weak';
    let color = 'bg-rose-500';
    let textColor = 'text-rose-400';
    let percent = 25;

    if (score === 0) {
      label = 'Too Weak';
      color = 'bg-slate-700';
      textColor = 'text-slate-500';
      percent = 10;
    } else if (score === 1) {
      label = 'Weak';
      color = 'bg-rose-500';
      textColor = 'text-rose-400';
      percent = 25;
    } else if (score === 2) {
      label = 'Fair';
      color = 'bg-amber-500';
      textColor = 'text-amber-400';
      percent = 50;
    } else if (score === 3) {
      label = 'Good';
      color = 'bg-blue-500';
      textColor = 'text-blue-400';
      percent = 75;
    } else if (score === 4) {
      label = 'Strong';
      color = 'bg-emerald-500';
      textColor = 'text-emerald-400';
      percent = 100;
    }

    return {
      hasMinLength,
      hasSpecialChar,
      hasNumber,
      hasUpperLower,
      score,
      isValid,
      label,
      color,
      textColor,
      percent,
    };
  }, [password]);

  // Status & Error feedback
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Generated Credentials Modal State
  const [generatedAdminId, setGeneratedAdminId] = useState<string | null>(null);

  // If already authenticated, redirect to destination
  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated && role) {
    const dest =
      role === 'ADMIN'
        ? '/admin/dashboard'
        : role === 'MANAGER'
        ? '/manager-dashboard'
        : role === 'SUPERVISOR'
        ? '/supervisor/dashboard'
        : '/staff/dashboard';
    return <Navigate to={dest} replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanStaffId = username.trim();
    const cleanPassword = password;

    if (!cleanStaffId || !cleanPassword) {
      setError('Please enter your Staff ID / Username and Password.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessNotice('');

    try {
      // 1. Direct check against localStorage housekeeping_users first for instant offline/mock auth
      try {
        const storedHkUsers = JSON.parse(localStorage.getItem('housekeeping_users') || '[]');
        const normId = cleanStaffId.toLowerCase().replace(/[-_\s]/g, '');
        const matchedHkUser = storedHkUsers.find((u: any) => {
          const uId = (u.id || u.staff_id || u.username || '').toString().toLowerCase().replace(/[-_\s]/g, '');
          const uName = (u.username || u.id || '').toString().toLowerCase();
          return uId === normId || uName === cleanStaffId.toLowerCase();
        });

        if (matchedHkUser && matchedHkUser.password === cleanPassword) {
          const roleUpper = (matchedHkUser.role || 'ADMIN').toUpperCase();
          const token = `JWT_LOCAL_${roleUpper}_${Date.now()}`;
          const finalStaffId = matchedHkUser.id || matchedHkUser.staff_id || matchedHkUser.username || cleanStaffId;
          const idPrefixMatch = String(finalStaffId).match(/^([A-Za-z0-9]+)-/);
          const effectiveTenantPrefix = idPrefixMatch
            ? idPrefixMatch[1].toUpperCase()
            : (matchedHkUser.company_prefix || matchedHkUser.tenantId || matchedHkUser.tenant_id || 'APEX').toUpperCase();

          localStorage.setItem('userToken', token);
          localStorage.setItem('userRole', roleUpper);
          localStorage.setItem('userId', finalStaffId);
          localStorage.setItem('user_token', token);
          localStorage.setItem('user_role', roleUpper.toLowerCase());
          localStorage.setItem('company_code', effectiveTenantPrefix);
          localStorage.setItem('tenant_id', effectiveTenantPrefix);
          localStorage.setItem('tenantId', effectiveTenantPrefix);
          if (matchedHkUser.tenantName || matchedHkUser.company_name) {
            localStorage.setItem('company_name', matchedHkUser.tenantName || matchedHkUser.company_name);
          }

          // Trigger auth restoration across the app
          window.dispatchEvent(new Event('auth-state-change'));

          const destination =
            roleUpper === 'ADMIN'
              ? '/admin/dashboard'
              : roleUpper === 'MANAGER'
              ? '/manager-dashboard'
              : roleUpper === 'SUPERVISOR'
              ? '/supervisor/dashboard'
              : '/staff/dashboard';

          if (onLoginSuccess) {
            onLoginSuccess();
          }
          navigate(destination, { replace: true });
          return;
        }
      } catch (localCheckErr) {
        console.warn('Local housekeeping_users verification check:', localCheckErr);
      }

      // 2. Delegate to AuthContext login (checks Firestore & normalized hospital records)
      const loginSuccess = await login(
        cleanStaffId,
        cleanPassword,
        navigate,
        (msg: string) => setError(msg || 'Invalid Credentials')
      );
      if (loginSuccess && onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid Credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessNotice('');

    if (!tenantName.trim() || !adminFullName.trim() || !password) {
      setError('Please fill all registration fields');
      return;
    }

    if (!passwordCriteria.hasMinLength) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!passwordCriteria.hasSpecialChar) {
      setError('Password must contain at least one special character (e.g. !@#$%^&*).');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Generate clean 3-5 character prefix (e.g. SAHO -> SAHO, ApexCare -> APEX, Basu Hospital -> BASU)
      const trimmedTenant = tenantName.trim();
      const words = trimmedTenant.toUpperCase().split(/\s+/).filter(Boolean);
      let prefix = '';

      if (words.length > 0) {
        const cleanFirst = words[0].replace(/[^A-Z0-9]/g, '');
        if (cleanFirst.length >= 3 && cleanFirst.length <= 5) {
          prefix = cleanFirst;
        }
      }

      if (!prefix && words.length >= 2) {
        const acronym = words.map((w) => w.replace(/[^A-Z0-9]/g, '')[0]).join('');
        if (acronym.length >= 3 && acronym.length <= 5) {
          prefix = acronym;
        }
      }

      if (!prefix) {
        const rawLetters = trimmedTenant.toUpperCase().replace(/[^A-Z0-9]/g, '');
        prefix = rawLetters.length >= 4 ? rawLetters.slice(0, 4) : (rawLetters + 'HOSP').slice(0, 4);
      }

      const autoGeneratedId = `${prefix}-ADM-001`;

      // 2. Persist active tenant metadata
      localStorage.setItem('company_code', prefix);
      localStorage.setItem('tenant_id', prefix);
      localStorage.setItem('tenantId', prefix);
      localStorage.setItem('company_name', trimmedTenant);

      const newUser = {
        id: autoGeneratedId,
        staff_id: autoGeneratedId,
        username: autoGeneratedId,
        password: password,
        raw_password_vault: password,
        password_hash: createPasswordHash(password),
        fullName: adminFullName.trim(),
        name: adminFullName.trim(),
        role: 'ADMIN',
        tenantName: trimmedTenant,
        company_name: trimmedTenant,
        tenant_id: prefix,
        tenantId: prefix,
        company_prefix: prefix,
        createdAt: new Date().toISOString(),
      };

      // 3. Save to LocalStorage 'housekeeping_users' for offline/mock auth
      try {
        const existingUsers = JSON.parse(localStorage.getItem('housekeeping_users') || '[]');
        const filtered = existingUsers.filter(
          (u: any) =>
            (u.id || u.username || '').toLowerCase() !== autoGeneratedId.toLowerCase()
        );
        filtered.push(newUser);
        localStorage.setItem('housekeeping_users', JSON.stringify(filtered));
      } catch (storageErr) {
        console.warn('Error saving to housekeeping_users:', storageErr);
      }

      // 4. Save to stored application users pool so dashboard reflects the newly provisioned tenant immediately
      try {
        const currentAppUsers = getStoredUsers();
        const existingIndex = currentAppUsers.findIndex(
          (u) =>
            u.username.toLowerCase() === autoGeneratedId.toLowerCase() ||
            (u.staff_id && u.staff_id.toLowerCase() === autoGeneratedId.toLowerCase())
        );
        const appUserFormatted = {
          id: currentAppUsers.length > 0 ? Math.max(...currentAppUsers.map((u) => u.id)) + 1 : 100,
          staff_id: autoGeneratedId,
          username: autoGeneratedId,
          password: password,
          raw_password_vault: password,
          password_hash: createPasswordHash(password),
          name: adminFullName.trim(),
          full_name: adminFullName.trim(),
          role: 'admin' as const,
          tenant_id: prefix,
          tenantId: prefix,
          company_prefix: prefix,
          company_name: trimmedTenant,
          status: 'ACTIVE' as const,
          is_approved: true,
          duty_type: 'FIXED' as const,
          fixed_department: 'Hospital Wide',
          is_temp_reliever: false,
          temp_department: null,
          assigned_shift: '7-3',
          assigned_area: 'Hospital Wide',
          department: 'Hospital Wide',
          weeklyOffDay: 'Sunday',
          leaveBalance: { casual: 12, sick: 7, paid: 15 },
          leaveRequests: [],
        };
        if (existingIndex >= 0) {
          currentAppUsers[existingIndex] = appUserFormatted;
        } else {
          currentAppUsers.push(appUserFormatted);
        }
        saveStoredUsers(currentAppUsers);
      } catch (appUserErr) {
        console.warn('Error syncing to application users pool:', appUserErr);
      }

      // 5. Try Firestore save with timeout protection (and registers in live collections + hk_auth_users_v2)
      try {
        const firestorePromise = registerMasterAdmin({
          companyName: trimmedTenant,
          fullName: adminFullName.trim(),
          password: password,
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firestore timeout')), 3000)
        );

        await Promise.race([firestorePromise, timeoutPromise]);
      } catch (dbErr) {
        console.warn('Firestore sync skipped or timed out, using local fallback store:', dbErr);
      }

      // 4. Show modal & pre-fill login field
      setGeneratedAdminId(autoGeneratedId);
      setUsername(autoGeneratedId);
      setSuccessNotice(
        `Company Registered Successfully! Your Master Admin ID is: ${autoGeneratedId}. Please use this ID to Sign In.`
      );
      setIsRegistering(false);
    } catch (error) {
      console.error('Registration error:', error);
      alert('Error registering tenant.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Generated Admin ID Alert Modal */}
      {generatedAdminId && (
        <div
          id="generated-admin-id-modal"
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              ✓
            </div>
            <h3 className="text-xl font-bold text-white">Company Registered!</h3>
            <p className="text-slate-400 text-sm">
              Your Master Admin account has been created. Use this generated ID to Sign In:
            </p>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-emerald-400 font-mono text-lg font-bold tracking-wider">
              {generatedAdminId}
            </div>
            <button
              type="button"
              id="proceed-to-signin-btn"
              onClick={() => {
                if (generatedAdminId) {
                  setUsername(generatedAdminId);
                }
                setIsRegistering(false);
                setGeneratedAdminId(null);
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-all cursor-pointer shadow-lg shadow-emerald-600/30"
            >
              Proceed to Sign In
            </button>
          </div>
        </div>
      )}

      {/* Main Auth Card */}
      <div
        id="auth-card"
        className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 backdrop-blur-md shadow-2xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white tracking-wide">
            {isRegistering ? 'Register New Hospital / Company' : 'ApexCare Hospital Operations'}
          </h1>
          <p className="text-xs text-blue-400 tracking-widest font-mono mt-1">
            {isRegistering ? 'TENANT & MASTER ADMIN PROVISIONING' : 'HOUSEKEEPING PORTAL 4D SECURITY'}
          </p>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div
            id="auth-error-banner"
            className="mb-5 p-3 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-medium text-center"
          >
            {error}
          </div>
        )}

        {successNotice && !generatedAdminId && (
          <div
            id="auth-success-banner"
            className="mb-5 p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs font-medium text-center"
          >
            {successNotice}
          </div>
        )}

        {/* Dynamic Form View */}
        {!isRegistering ? (
          /* SIGN IN FORM */
          <form onSubmit={handleSignIn} className="space-y-5" id="sign-in-form">
            <div>
              <label
                htmlFor="username-input"
                className="block text-xs font-mono text-slate-400 mb-2 uppercase tracking-wider"
              >
                Staff ID / Username
              </label>
              <input
                type="text"
                id="username-input"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. APEX-ADM-001"
                autoComplete="username"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
              />
            </div>

            <div>
              <label
                htmlFor="password-input"
                className="block text-xs font-mono text-slate-400 mb-2 uppercase tracking-wider"
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showSignInPassword ? 'text' : 'password'}
                  id="password-input"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-4 pr-11 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                />
                <button
                  type="button"
                  id="toggle-signin-password-btn"
                  onClick={() => setShowSignInPassword(!showSignInPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer transition-colors"
                  aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignInPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="submit-signin-btn"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? 'Authenticating...' : 'SIGN IN TO PORTAL'}
            </button>
          </form>
        ) : (
          /* COMPANY REGISTRATION FORM */
          <form onSubmit={handleRegisterCompany} className="space-y-5" id="register-company-form">
            {/* Strict Rule Notice: Tenant Provisioning Only */}
            <div className="p-3 bg-blue-950/60 border border-blue-500/40 rounded-lg text-xs text-blue-200 space-y-1">
              <span className="font-bold block text-blue-300 text-xs uppercase tracking-wider">
                Company / Hospital Provisioning Only
              </span>
              <p className="text-slate-300 leading-relaxed">
                This public registration creates a NEW Hospital/Company tenant and automatically generates its Master Admin account (e.g. <span className="font-mono text-emerald-300 font-semibold">SAHO-ADM-001</span>). Normal employees (Staff, Supervisor, Manager) cannot self-register here; they are onboarded internally by an Admin or Manager.
              </p>
            </div>

            <div>
              <label
                htmlFor="tenant-name-input"
                className="block text-xs font-mono text-slate-400 mb-2 uppercase tracking-wider"
              >
                Company / Tenant Name
              </label>
              <input
                type="text"
                id="tenant-name-input"
                value={tenantName}
                onChange={(e) => {
                  setTenantName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. ApexCare Hospital"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="admin-fullname-input"
                className="block text-xs font-mono text-slate-400 mb-2 uppercase tracking-wider"
              >
                Master Admin Full Name
              </label>
              <input
                type="text"
                id="admin-fullname-input"
                value={adminFullName}
                onChange={(e) => {
                  setAdminFullName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Avijit Basu"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="set-admin-password-input"
                  className="block text-xs font-mono text-slate-400 uppercase tracking-wider"
                >
                  Set Admin Password
                </label>
                {password && (
                  <span className={`text-2xs font-mono font-bold tracking-wider ${passwordCriteria.textColor}`}>
                    {passwordCriteria.label.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showRegisterPassword ? 'text' : 'password'}
                  id="set-admin-password-input"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Minimum 8 characters with special symbol..."
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-4 pr-11 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                />
                <button
                  type="button"
                  id="toggle-register-password-btn"
                  onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer transition-colors"
                  aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                >
                  {showRegisterPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Password Strength Meter & Requirement Checklist */}
              {password && (
                <div className="mt-2.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2.5">
                  {/* Progress Bar */}
                  <div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${passwordCriteria.color}`}
                        style={{ width: `${passwordCriteria.percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Requirements List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-2xs font-mono">
                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        passwordCriteria.hasMinLength ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {passwordCriteria.hasMinLength ? (
                        <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                      ) : (
                        <X className="h-3 w-3 shrink-0 text-slate-600" />
                      )}
                      <span>8+ characters (Required)</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        passwordCriteria.hasSpecialChar ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {passwordCriteria.hasSpecialChar ? (
                        <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                      ) : (
                        <X className="h-3 w-3 shrink-0 text-slate-600" />
                      )}
                      <span>Special character (Required)</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        passwordCriteria.hasNumber ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {passwordCriteria.hasNumber ? (
                        <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                      ) : (
                        <X className="h-3 w-3 shrink-0 text-slate-600" />
                      )}
                      <span>Numbers (0-9)</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        passwordCriteria.hasUpperLower ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {passwordCriteria.hasUpperLower ? (
                        <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                      ) : (
                        <X className="h-3 w-3 shrink-0 text-slate-600" />
                      )}
                      <span>Upper & lower case</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              id="submit-register-company-btn"
              disabled={isLoading || (password.length > 0 && !passwordCriteria.isValid)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating Tenant...' : 'CREATE TENANT & GENERATE ADMIN ID'}
            </button>
          </form>
        )}

        {/* Dynamic Auth Toggle Switcher */}
        <div className="mt-6 text-center border-t border-slate-800/80 pt-4">
          <button
            type="button"
            id="auth-toggle-btn"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
              setSuccessNotice('');
            }}
            className="text-xs text-blue-400 hover:text-blue-300 underline font-mono cursor-pointer"
          >
            {isRegistering ? 'Already registered? Sign In' : 'New Organization? Register Company'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
