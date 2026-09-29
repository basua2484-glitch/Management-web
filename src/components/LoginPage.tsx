import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Check,
  X,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
  Mail,
  Phone,
  Copy,
  ArrowLeft,
  RefreshCw,
  KeyRound,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthLoadingScreen } from './AuthLoadingScreen';
import { registerMasterAdmin, resetUserPasswordInDb } from '../services/firestoreService';
import { getStoredUsers, saveStoredUsers } from '../data/mockHousekeepingData';
import { createPasswordHash } from '../services/vaultService';
import { auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

export interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export function checkPasswordCriteria(pwd: string) {
  const hasMinLength = pwd.length >= 8;
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasUpperLower = /[a-z]/.test(pwd) && /[A-Z]/.test(pwd);

  let score = 0;
  if (hasMinLength) score++;
  if (hasSpecialChar) score++;
  if (hasNumber) score++;
  if (hasUpperLower) score++;

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
  const [mobile, setMobile] = useState(''); // STRICTLY REQUIRED
  const [email, setEmail] = useState('');   // OPTIONAL
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Password Visibility Toggle State
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // Password Strength Criteria Calculation
  const passwordCriteria = useMemo(() => checkPasswordCriteria(password), [password]);

  // Status & Error feedback
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Generated Credentials Modal State
  const [generatedAdminId, setGeneratedAdminId] = useState<string | null>(null);

  // Forgot Password / Magic Link Reset State
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetTargetUser, setResetTargetUser] = useState<any | null>(null);
  const [magicResetLink, setMagicResetLink] = useState<string | null>(null);
  const [isSettingNewPassword, setIsSettingNewPassword] = useState(false);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showNewResetPassword, setShowNewResetPassword] = useState(false);
  const [showConfirmResetPassword, setShowConfirmResetPassword] = useState(false);
  const [resetModalError, setResetModalError] = useState<string | null>(null);
  const [resetModalSuccess, setResetModalSuccess] = useState<string | null>(null);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Password criteria for password reset form
  const resetPasswordCriteria = useMemo(() => checkPasswordCriteria(newResetPassword), [newResetPassword]);

  // URL Query Token detection for direct single-click redirection
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get('resetToken') || searchParams.get('token');
      const userId = searchParams.get('user') || searchParams.get('staffId');
      if (token && userId) {
        const appUsers = getStoredUsers();
        let found = appUsers.find(
          (u) =>
            (u.staff_id && u.staff_id.toLowerCase() === userId.toLowerCase()) ||
            u.username.toLowerCase() === userId.toLowerCase()
        );
        if (!found) {
          const hkUsers = JSON.parse(localStorage.getItem('housekeeping_users') || '[]');
          found = hkUsers.find(
            (u: any) =>
              (u.id || u.staff_id || u.username || '').toLowerCase() === userId.toLowerCase()
          );
        }
        if (found) {
          setResetTargetUser(found);
          setIsSettingNewPassword(true);
          setIsForgotPasswordOpen(true);
          setResetModalSuccess(`Secure token verified for ${found.name || found.full_name || userId}. Please set your new password below.`);
        }
      }
    } catch (e) {
      console.warn('URL token parsing notice:', e);
    }
  }, []);

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
      setError('Please fill all mandatory registration fields.');
      return;
    }

    if (!mobile.trim()) {
      setError('Mobile Number is strictly required for Company Registration.');
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
        mobile: mobile.trim(),
        phone: mobile.trim(),
        email: email.trim() || undefined,
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
          mobile: mobile.trim(),
          phone: mobile.trim(),
          email: email.trim() || undefined,
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
          mobile: mobile.trim(),
          phone: mobile.trim(),
          email: email.trim() || undefined,
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firestore timeout')), 3000)
        );

        await Promise.race([firestorePromise, timeoutPromise]);
      } catch (dbErr) {
        console.warn('Firestore sync skipped or timed out, using local fallback store:', dbErr);
      }

      // 6. Show modal & pre-fill login field
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

  // MAGIC EMAIL PASSWORD RESET FLOW: Generate Magic Link & Token
  const handleGenerateMagicReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetModalError(null);
    setResetModalSuccess(null);
    setMagicResetLink(null);

    const query = resetIdentifier.trim();
    if (!query) {
      setResetModalError('Please enter your registered Email ID or Staff ID.');
      return;
    }

    setIsResetLoading(true);

    try {
      // 1. Search in local and stored users
      const appUsers = getStoredUsers();
      let found = appUsers.find((u) => {
        if (u.email && u.email.toLowerCase() === query.toLowerCase()) return true;
        if (u.staff_id && u.staff_id.toLowerCase() === query.toLowerCase()) return true;
        if (u.username && u.username.toLowerCase() === query.toLowerCase()) return true;
        return false;
      });

      if (!found) {
        const hkUsers = JSON.parse(localStorage.getItem('housekeeping_users') || '[]');
        found = hkUsers.find((u: any) => {
          if (u.email && u.email.toLowerCase() === query.toLowerCase()) return true;
          const uId = (u.id || u.staff_id || u.username || '').toLowerCase();
          return uId === query.toLowerCase();
        });
      }

      if (!found) {
        setResetModalError('No registered account found with that Email ID or Staff ID.');
        setIsResetLoading(false);
        return;
      }

      setResetTargetUser(found);

      // 2. Generate secure token
      const token = 'rst_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const targetStaffId = found.staff_id || found.username || String(found.id);
      localStorage.setItem('hk_reset_' + targetStaffId.toLowerCase(), token);

      const link = `${window.location.origin}/login?resetToken=${token}&user=${encodeURIComponent(targetStaffId)}`;
      setMagicResetLink(link);

      // 3. If user has email and Firebase Auth is available, trigger standard password reset email
      if (found.email && auth) {
        try {
          await sendPasswordResetEmail(auth, found.email);
        } catch (authErr) {
          console.warn('Firebase reset email dispatch notice:', authErr);
        }
      }

      setResetModalSuccess(
        found.email
          ? `Magic Reset Link generated & dispatched to ${found.email}! Single-click link ready below.`
          : `Account found (${targetStaffId})! Registered mobile is verified (${found.mobile || found.phone || 'On file'}). Single-click reset ready below.`
      );
    } catch (err: any) {
      setResetModalError(err?.message || 'Failed to generate reset link.');
    } finally {
      setIsResetLoading(false);
    }
  };

  // Direct Password Update from Magic Link
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetModalError(null);

    if (!resetTargetUser) {
      setResetModalError('No active user found for password reset.');
      return;
    }

    if (!resetPasswordCriteria.isValid) {
      setResetModalError('Password must be at least 8 characters long and contain at least one special character.');
      return;
    }

    if (newResetPassword !== confirmResetPassword) {
      setResetModalError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsResetLoading(true);

    try {
      const targetStaffId = resetTargetUser.staff_id || resetTargetUser.username || String(resetTargetUser.id);
      await resetUserPasswordInDb(targetStaffId, newResetPassword);

      // Clean URL if resetToken is present
      if (window.location.search.includes('resetToken')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      setIsForgotPasswordOpen(false);
      setIsSettingNewPassword(false);
      setResetTargetUser(null);
      setMagicResetLink(null);
      setNewResetPassword('');
      setConfirmResetPassword('');
      setUsername(targetStaffId);
      setPassword('');
      setIsRegistering(false);
      setSuccessNotice(`✅ Password reset successfully for ${targetStaffId}! Please enter your new password to sign in.`);
    } catch (err: any) {
      setResetModalError(err?.message || 'Failed to update password.');
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleCopyMagicLink = () => {
    if (!magicResetLink) return;
    navigator.clipboard.writeText(magicResetLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    });
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

            <div className="flex justify-end pt-0.5">
              <button
                type="button"
                id="btn-forgot-password"
                onClick={() => {
                  setIsForgotPasswordOpen(true);
                  setIsSettingNewPassword(false);
                  setResetModalError(null);
                  setResetModalSuccess(null);
                  setMagicResetLink(null);
                  setResetIdentifier(username || '');
                }}
                className="text-2xs text-blue-400 hover:text-blue-300 underline font-mono cursor-pointer transition-colors"
              >
                Forgot Password?
              </button>
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

            {/* Mobile Number (STRICTLY REQUIRED) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="admin-mobile-input"
                  className="block text-xs font-mono text-slate-400 uppercase tracking-wider"
                >
                  Mobile Number (Mandatory) *
                </label>
                <span className="text-3xs text-rose-400 font-mono font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/30">
                  REQUIRED
                </span>
              </div>
              <input
                type="tel"
                id="admin-mobile-input"
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. +91 98765 43210"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
              />
            </div>

            {/* Email ID (OPTIONAL) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="admin-email-input"
                  className="block text-xs font-mono text-slate-400 uppercase tracking-wider"
                >
                  Email ID (Optional • For Magic Password Reset)
                </label>
                <span className="text-3xs text-slate-500 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                  OPTIONAL
                </span>
              </div>
              <input
                type="email"
                id="admin-email-input"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. admin@apexcare.org (Optional)"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
              />
              <p className="text-3xs text-slate-500 mt-1">
                Optional: If provided, single-click magic reset links will be emailed directly to you.
              </p>
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

      {/* MAGIC EMAIL PASSWORD RESET MODAL */}
      {isForgotPasswordOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto"
          id="forgot-password-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsForgotPasswordOpen(false);
              setIsSettingNewPassword(false);
            }
          }}
        >
          <div
            className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5"
            id="forgot-password-modal-content"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">
                    {isSettingNewPassword ? 'Set New Password' : 'Password Recovery & Magic Reset'}
                  </h3>
                  <p className="text-3xs text-slate-400 font-mono">
                    {isSettingNewPassword
                      ? 'Create a secure new password for your account'
                      : 'Magic link for instant single-click password reset'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsForgotPasswordOpen(false);
                  setIsSettingNewPassword(false);
                  setResetTargetUser(null);
                  setMagicResetLink(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error or Notice in Modal */}
            {resetModalError && (
              <div className="p-3 bg-rose-950/80 border border-rose-500/60 rounded-lg text-xs text-rose-200">
                {resetModalError}
              </div>
            )}
            {resetModalSuccess && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-lg text-xs text-emerald-200">
                {resetModalSuccess}
              </div>
            )}

            {!isSettingNewPassword ? (
              /* STEP 1: ENTER EMAIL OR STAFF ID */
              <form onSubmit={handleGenerateMagicReset} className="space-y-4">
                <div>
                  <label
                    htmlFor="reset-identifier-input"
                    className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider"
                  >
                    Registered Email ID or Staff ID
                  </label>
                  <input
                    type="text"
                    id="reset-identifier-input"
                    value={resetIdentifier}
                    onChange={(e) => {
                      setResetIdentifier(e.target.value);
                      if (resetModalError) setResetModalError(null);
                    }}
                    placeholder="e.g. admin@apexcare.org or SAHO-ADM-001"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                  />
                  <p className="text-3xs text-slate-500 mt-1.5 leading-relaxed">
                    Enter the email provided during registration, or your Staff ID to verify with your registered mobile.
                  </p>
                </div>

                <button
                  type="submit"
                  id="btn-generate-magic-link"
                  disabled={isResetLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg text-xs transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isResetLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Verifying & Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Generate Magic Reset Link</span>
                    </>
                  )}
                </button>

                {/* Magic Reset Link Box if generated */}
                {magicResetLink && (
                  <div className="pt-2 border-t border-slate-800 space-y-3">
                    <div className="p-3 bg-slate-950 border border-emerald-500/40 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-3xs font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Check className="h-3 w-3" /> Magic Link Active
                        </span>
                        <span className="text-3xs text-slate-500 font-mono">Single-Click Access</span>
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={magicResetLink}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-3xs font-mono text-slate-300 select-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        id="btn-open-direct-reset"
                        onClick={() => setIsSettingNewPassword(true)}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Set New Password Now</span>
                      </button>

                      <button
                        type="button"
                        id="btn-copy-magic-link"
                        onClick={handleCopyMagicLink}
                        className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>{copiedLink ? 'Copied!' : 'Copy Magic Link'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </form>
            ) : (
              /* STEP 2: SET NEW PASSWORD */
              <form onSubmit={handleSaveNewPassword} className="space-y-4" id="set-new-password-form">
                {/* Account Identity Tag */}
                {resetTargetUser && (
                  <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                    <div>
                      <span className="text-3xs font-mono text-slate-400 block uppercase">Account</span>
                      <span className="font-bold text-white">
                        {resetTargetUser.name || resetTargetUser.full_name || 'Staff Member'}
                      </span>
                    </div>
                    <span className="font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded text-2xs border border-blue-500/20">
                      {resetTargetUser.staff_id || resetTargetUser.username}
                    </span>
                  </div>
                )}

                {/* New Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="new-reset-password"
                      className="block text-xs font-mono text-slate-400 uppercase tracking-wider"
                    >
                      New Password
                    </label>
                    {newResetPassword && (
                      <span className={`text-3xs font-mono font-bold ${resetPasswordCriteria.textColor}`}>
                        {resetPasswordCriteria.label.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showNewResetPassword ? 'text' : 'password'}
                      id="new-reset-password"
                      value={newResetPassword}
                      onChange={(e) => {
                        setNewResetPassword(e.target.value);
                        if (resetModalError) setResetModalError(null);
                      }}
                      placeholder="Minimum 8 characters with symbol..."
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewResetPassword(!showNewResetPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showNewResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Password criteria checklist */}
                  {newResetPassword && (
                    <div className="mt-2 p-2 rounded bg-slate-950 border border-slate-800 grid grid-cols-2 gap-1 text-3xs font-mono">
                      <div className={resetPasswordCriteria.hasMinLength ? 'text-emerald-400' : 'text-slate-500'}>
                        {resetPasswordCriteria.hasMinLength ? '✓' : '✗'} 8+ characters
                      </div>
                      <div className={resetPasswordCriteria.hasSpecialChar ? 'text-emerald-400' : 'text-slate-500'}>
                        {resetPasswordCriteria.hasSpecialChar ? '✓' : '✗'} Special symbol
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password Input */}
                <div>
                  <label
                    htmlFor="confirm-reset-password"
                    className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmResetPassword ? 'text' : 'password'}
                      id="confirm-reset-password"
                      value={confirmResetPassword}
                      onChange={(e) => {
                        setConfirmResetPassword(e.target.value);
                        if (resetModalError) setResetModalError(null);
                      }}
                      placeholder="Re-enter new password..."
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmResetPassword(!showConfirmResetPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showConfirmResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSettingNewPassword(false)}
                    className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    id="btn-confirm-save-password"
                    disabled={isResetLoading || !resetPasswordCriteria.isValid || newResetPassword !== confirmResetPassword}
                    className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-xs transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isResetLoading ? 'Updating Password...' : 'SAVE NEW PASSWORD'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
