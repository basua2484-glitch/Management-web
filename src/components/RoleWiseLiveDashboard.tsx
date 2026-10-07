// src/components/RoleWiseLiveDashboard.tsx
// Shift-based Role-wise Live Dashboard for Daily Punch & Duty Assignments

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Shield,
  Users,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Sun,
  Sunset,
  Moon,
  Radio,
  Building,
  LogIn,
  UserCheck,
  Edit2,
  Calendar,
} from 'lucide-react';
import {
  LiveDutyLog,
  ShiftFilterType,
  ShiftNameType,
  detectCurrentShift,
  getShiftTimingDetails,
  calculateLivePunchTimer,
  buildLiveDutyLogs,
} from '../services/dutyDashboardService';
import type { AppUser, StaffUser, AttendanceRecord } from '../types';

interface RoleWiseLiveDashboardProps {
  selectedDate: string;
  onDateChange?: (date: string) => void;
  activeTenantPrefix?: string;
  users?: AppUser[];
  staff?: StaffUser[];
  records?: AttendanceRecord[];
  dutyLogs?: LiveDutyLog[];
  onOpenPunchPortal?: (staffId?: number) => void;
  onOpenAssignModal?: (staffId?: number) => void;
  onOpenProfileModal?: (staffCode: string) => void;
  onOpenAddUser?: () => void;
  onRefresh?: () => void;
  isSupervisor?: boolean;
  canPerformAction?: boolean;
  siteFilter?: string;
}

export const RoleWiseLiveDashboard: React.FC<RoleWiseLiveDashboardProps> = ({
  selectedDate,
  onDateChange,
  activeTenantPrefix: propTenantPrefix,
  users = [],
  staff = [],
  records = [],
  dutyLogs: propDutyLogs,
  onOpenPunchPortal,
  onOpenAssignModal,
  onOpenProfileModal,
  onOpenAddUser,
  onRefresh,
  isSupervisor = false,
  canPerformAction = true,
  siteFilter,
}) => {
  // 1. Dynamic Shift & Role Filtering Logic:
  // Default selectedShift filter automatically based on current system time (Requirement 4):
  // 07:00 - 15:00 -> Morning Shift
  // 15:00 - 23:00 -> Evening Shift
  // 23:00 - 07:00 -> Night Shift
  const [selectedShift, setSelectedShift] = useState<ShiftFilterType>(() => detectCurrentShift());
  const activeTenantPrefix = useMemo(() => {
    if (propTenantPrefix && propTenantPrefix.trim()) return propTenantPrefix.trim().toUpperCase();
    if (typeof localStorage !== 'undefined') {
      const stored =
        localStorage.getItem('tenant_id') ||
        localStorage.getItem('tenantId') ||
        localStorage.getItem('company_code');
      if (stored && stored.trim()) return stored.trim().toUpperCase();
    }
    return 'APEX';
  }, [propTenantPrefix]);

  // Current system detected shift for live indicator
  const [detectedShift, setDetectedShift] = useState<ShiftNameType>(() => detectCurrentShift());

  // Auto-refresh state (Requirement 4: Automatically auto-refresh status every 30 seconds for live updates)
  const [refreshCountdown, setRefreshCountdown] = useState<number>(30);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [, setCurrentTimeTick] = useState<number>(Date.now());

  // Safely hold latest onRefresh callback in ref to prevent infinite re-renders or setState inside render
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // 1-second interval to update live punch timer and countdown safely
  useEffect(() => {
    let secondsLeft = 30;
    const timer = setInterval(() => {
      setCurrentTimeTick(Date.now());
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        secondsLeft = 30;
        setRefreshCountdown(30);
        setLastRefreshedAt(new Date());
        // Safe asynchronous call outside of state updater
        try {
          onRefreshRef.current?.();
        } catch (e) {
          console.error('Error during auto-refresh:', e);
        }
      } else {
        setRefreshCountdown(secondsLeft);
      }
      setDetectedShift(detectCurrentShift());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Construct master dutyLogs if not provided via props
  const dutyLogs: LiveDutyLog[] = useMemo(() => {
    if (propDutyLogs && propDutyLogs.length > 0) {
      return propDutyLogs;
    }
    return buildLiveDutyLogs({
      users,
      staff,
      records,
      selectedDate,
      activeTenantPrefix,
    });
  }, [propDutyLogs, users, staff, records, selectedDate, activeTenantPrefix]);

  // 1. Dynamic Shift & Role Filtering Logic:
  // Filter logs strictly by logged-in company tenant, site scope, AND selected shift:
  const filteredLogs = useMemo(() => {
    return dutyLogs.filter(
      (log) =>
        String(log.userId || log.id || '').toUpperCase().startsWith(activeTenantPrefix) &&
        (selectedShift === 'ALL' || log.assignedShift === selectedShift) &&
        (!siteFilter || siteFilter === 'ALL' || log.siteId === siteFilter)
    );
  }, [dutyLogs, activeTenantPrefix, selectedShift, siteFilter]);

  // 2. Enforce Exclusive Role Filtering (No Duplication Across Sections):
  // Categorize users STRICTLY based on their primary 'user.role' property first.

  // 1. Operations Managers
  const managers = useMemo(() => {
    return filteredLogs.filter((user) => {
      const r = (user.role || '').toUpperCase();
      return r === 'MANAGER' || r === 'MGR';
    });
  }, [filteredLogs]);

  // 2. Ward & Floor Supervisors
  const supervisors = useMemo(() => {
    return filteredLogs.filter((user) => {
      const r = (user.role || '').toUpperCase();
      return r === 'SUPERVISOR' || r === 'SUP';
    });
  }, [filteredLogs]);

  // 3. Housekeeping Staff (STRICT EXCLUSION of Supervisor/Admin/Manager)
  const housekeepingStaff = useMemo(() => {
    return filteredLogs.filter((user) => {
      const r = (user.role || '').toUpperCase();
      const idStr = String(user.id || (user as any).userId || '');
      return (
        r === 'STAFF' ||
        (r !== 'SUPERVISOR' &&
          r !== 'SUP' &&
          r !== 'ADMIN' &&
          r !== 'MANAGER' &&
          r !== 'MGR' &&
          idStr.includes('-STF-'))
      );
    });
  }, [filteredLogs]);

  // 4. Facility Administration & Oversight
  const admins = useMemo(() => {
    return filteredLogs.filter((user) => {
      const r = (user.role || '').toUpperCase();
      return r === 'ADMIN';
    });
  }, [filteredLogs]);

  // Explicit aliases for template compatibility
  const managerLogs = managers;
  const supervisorLogs = supervisors;
  const staffLogs = housekeepingStaff;
  const adminLogs = admins;

  // Status badge renderer for Requirement 3:
  // - Status "NOT_PUNCHED_IN" -> Display Badge: 🟡 OFF-DUTY / NOT PUNCHED IN
  // - Status "PUNCHED_IN" -> Display Badge: 🟢 PUNCHED IN (Active)
  // - Status "PUNCHED_OUT" -> Display Badge: 🔵 SHIFT COMPLETED
  const renderStatusBadge = (log: LiveDutyLog) => {
    // Current live timer calculated from punch-in timestamp or punch-in time string
    const liveTimer = calculateLivePunchTimer(log.punchIn, log.punchInTimestamp);

    if (log.status === 'PUNCHED_IN') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs"
          title={`Punched in at ${log.punchIn || '--:--'}. Live duration: ${liveTimer}`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-extrabold">🟢 PUNCHED IN (Active)</span>
          <span className="text-emerald-950 font-mono">
            {log.punchIn ? `• ${log.punchIn}` : ''}
          </span>
          <span className="bg-emerald-200/80 text-emerald-900 px-1.5 py-0.2 rounded text-3xs font-mono font-bold">
            Live {liveTimer}
          </span>
        </span>
      );
    }

    if (log.status === 'PUNCHED_OUT') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 shadow-2xs"
          title={`Shift completed. Total worked hours: ${log.totalWorkedHours.toFixed(1)} hrs`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span className="font-extrabold">🔵 SHIFT COMPLETED</span>
          {log.punchOut && (
            <span className="text-blue-900 font-mono">
              • {log.punchOut}
            </span>
          )}
          {log.totalWorkedHours > 0 && (
            <span className="text-blue-900 font-mono">
              ({log.totalWorkedHours.toFixed(1)}h)
            </span>
          )}
        </span>
      );
    }

    if (log.status === 'ABSENT') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs"
          title="No punch recorded for scheduled shift date"
        >
          <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
          <span className="font-extrabold">🔴 ABSENT / NOT PUNCHED IN</span>
        </span>
      );
    }

    // Default / NOT_PUNCHED_IN / PENDING (Red/Yellow Badge)
    return (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
        title="No punch record for this shift date • Off Duty / Not Punched In"
      >
        <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0"></span>
        <span className="font-extrabold">🟡 OFF-DUTY / NOT PUNCHED IN</span>
      </span>
    );
  };

  // Shift badge renderer
  const renderShiftBadge = (shift: ShiftNameType) => {
    const details = getShiftTimingDetails(shift);
    if (shift === 'Morning') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-2xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
          <Sun className="h-3 w-3 text-amber-500" />
          <span>Morning ({details.timeRange})</span>
        </span>
      );
    } else if (shift === 'Evening') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-2xs font-bold bg-orange-50 text-orange-900 border border-orange-200">
          <Sunset className="h-3 w-3 text-orange-500" />
          <span>Evening ({details.timeRange})</span>
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-2xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
          <Moon className="h-3 w-3 text-indigo-500" />
          <span>Night ({details.timeRange})</span>
        </span>
      );
    }
  };

  // Section card renderer
  const renderRoleSection = (
    roleTitle: string,
    roleLogs: LiveDutyLog[],
    icon: React.ReactNode,
    badgeColor: string,
    emptyMessage: string
  ) => {
    const punchedInCount = roleLogs.filter((l) => l.status === 'PUNCHED_IN').length;
    const punchedOutCount = roleLogs.filter((l) => l.status === 'PUNCHED_OUT').length;
    const unpunchedCount = roleLogs.filter(
      (l) => l.status === 'NOT_PUNCHED_IN' || l.status === 'PENDING' || l.status === 'ABSENT'
    ).length;

    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        {/* Section Header */}
        <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${badgeColor} text-white shadow-2xs`}>
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-slate-900">{roleTitle}</h4>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-slate-200 text-slate-800 font-mono">
                  {roleLogs.length}
                </span>
              </div>
              <p className="text-2xs text-slate-500">
                Shift: <span className="font-semibold">{selectedShift === 'ALL' ? 'All Shifts' : selectedShift}</span> • Tenant: <span className="font-mono font-semibold">{activeTenantPrefix}</span>
              </p>
            </div>
          </div>

          {/* Mini Status Breakdown */}
          <div className="flex flex-wrap items-center gap-2 text-2xs font-semibold">
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              {punchedInCount} Punched In
            </span>
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
              {punchedOutCount} Shift Completed
            </span>
            {unpunchedCount > 0 && (
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                {unpunchedCount} Off-Duty / Not Punched
              </span>
            )}
          </div>
        </div>

        {/* Section Body */}
        <div className="p-4 flex-1">
          {roleLogs.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center justify-center text-slate-400">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2 text-slate-400">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-slate-600">{emptyMessage}</p>
              <p className="text-2xs text-slate-400 mt-1 max-w-sm">
                No active duty records matching tenant <strong>{activeTenantPrefix}</strong> and shift <strong>{selectedShift}</strong>.
              </p>
              {onOpenAddUser && (
                <button
                  type="button"
                  onClick={onOpenAddUser}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#1E3A8A] hover:bg-blue-900 rounded-lg transition-colors shadow-2xs"
                >
                  <span>+ Register {roleTitle} Account</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {roleLogs.map((log) => (
                <div
                  key={log.userId}
                  id={`card-duty-log-${log.userId}`}
                  onClick={() => onOpenProfileModal?.(log.staffCode)}
                  className={`rounded-xl border p-4 transition-all duration-150 cursor-pointer hover:shadow-md flex flex-col justify-between gap-3 ${
                    log.status === 'PUNCHED_IN'
                      ? 'border-emerald-300 bg-emerald-50/20 hover:bg-emerald-50/40'
                      : log.status === 'PUNCHED_OUT'
                      ? 'border-blue-200 bg-blue-50/20 hover:bg-blue-50/40'
                      : log.status === 'ABSENT'
                      ? 'border-rose-200 bg-rose-50/20 hover:bg-rose-50/30'
                      : 'border-slate-200 bg-white hover:bg-slate-50/70'
                  }`}
                >
                  {/* Top row: Name & User ID */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0">
                        <span className="font-mono text-2xs font-bold text-[#1E3A8A] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 mr-1.5">
                          {log.userId}
                        </span>
                        <h5 className="text-sm font-bold text-slate-900 truncate hover:text-[#1E3A8A] inline">
                          {log.userName}
                        </h5>
                      </div>
                      <span className="shrink-0 text-3xs uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {log.role}
                      </span>
                    </div>

                    {/* Site Badge (Requirement 4): e.g. "BASU-MGR-001 | Apex Main Hospital" */}
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1 font-mono text-3xs font-semibold text-slate-700 bg-slate-100/90 px-2 py-0.5 rounded border border-slate-200">
                        <Building className="h-2.5 w-2.5 text-[#1E3A8A] shrink-0" />
                        <span>{log.userId} | {log.siteName || 'Apex Main Hospital'}</span>
                      </span>
                    </div>

                    {/* Duty Area & Assigned Shift */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {log.assignedArea}
                      </span>
                      {renderShiftBadge(log.assignedShift)}
                    </div>
                  </div>

                  {/* Middle row: Live Status Badge (Requirement 3) */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-3xs uppercase tracking-wider font-bold text-slate-400">
                        Live Punch Status
                      </span>
                      {log.status === 'PUNCHED_IN' && (
                        <span className="text-3xs font-bold text-emerald-700 flex items-center gap-1">
                          <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />
                          Live Floor Active
                        </span>
                      )}
                    </div>

                    <div className="flex items-center">
                      {renderStatusBadge(log)}
                    </div>

                    {/* Punch details breakdown */}
                    <div className="grid grid-cols-2 gap-2 text-2xs text-slate-600 bg-white/70 p-2 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-3xs text-slate-400 block font-semibold">PUNCH IN</span>
                        <span className="font-mono font-bold text-slate-800">
                          {log.punchIn || '--:--'}
                        </span>
                      </div>
                      <div>
                        <span className="text-3xs text-slate-400 block font-semibold">PUNCH OUT</span>
                        <span className="font-mono font-bold text-slate-800">
                          {log.punchOut || '--:--'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom row: Interactive Actions */}
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProfileModal?.(log.staffCode);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-2xs font-bold text-[#1E3A8A] hover:bg-blue-100 transition-colors"
                      title="View complete employee profile"
                    >
                      <UserCheck className="h-3 w-3" />
                      <span>Profile</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPunchPortal?.(log.numericId);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-2xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
                      title="Open Punch Portal Card"
                    >
                      <LogIn className="h-3 w-3 text-emerald-700" />
                      <span>Punch</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isSupervisor && !canPerformAction) return;
                        onOpenAssignModal?.(log.numericId);
                      }}
                      disabled={isSupervisor && !canPerformAction}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-medium transition-colors ${
                        isSupervisor && !canPerformAction
                          ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed'
                          : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-[#1E3A8A]'
                      }`}
                      title="Edit duty assignment and shift"
                    >
                      <Edit2 className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" id="shift-role-live-dashboard">
      {/* Dynamic Shift & Role Filtering Bar (Requirement 1 & 4) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Shift Selection Pills & Auto-detect indicator */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Shift:
              </span>
              <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  id="filter-shift-all"
                  onClick={() => setSelectedShift('ALL')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    selectedShift === 'ALL'
                      ? 'bg-[#1E3A8A] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  All Shifts
                </button>
                <button
                  type="button"
                  id="filter-shift-morning"
                  onClick={() => setSelectedShift('Morning')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    selectedShift === 'Morning'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                  <span>Morning</span>
                  <span className="text-3xs opacity-80">(07-15)</span>
                </button>
                <button
                  type="button"
                  id="filter-shift-evening"
                  onClick={() => setSelectedShift('Evening')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    selectedShift === 'Evening'
                      ? 'bg-orange-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Sunset className="h-3.5 w-3.5" />
                  <span>Evening</span>
                  <span className="text-3xs opacity-80">(15-23)</span>
                </button>
                <button
                  type="button"
                  id="filter-shift-night"
                  onClick={() => setSelectedShift('Night')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    selectedShift === 'Night'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                  <span>Night</span>
                  <span className="text-3xs opacity-80">(23-07)</span>
                </button>
              </div>
            </div>

            {/* Auto-detected shift badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Radio className="h-3 w-3 text-emerald-600 animate-pulse" />
              <span>Current Time: <strong>{detectedShift} Shift</strong> (Auto-Detected)</span>
              {selectedShift !== detectedShift && (
                <button
                  type="button"
                  onClick={() => setSelectedShift(detectedShift)}
                  className="ml-1 text-2xs underline font-bold text-emerald-900 hover:text-emerald-700"
                >
                  Apply
                </button>
              )}
            </div>
          </div>

          {/* Right: Tenant badge & 30s auto-refresh indicator */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-md text-xs font-medium text-slate-700">
              <Building className="h-3.5 w-3.5 text-[#1E3A8A]" />
              <span>Tenant:</span>
              <strong className="font-mono text-[#1E3A8A] font-bold">{activeTenantPrefix}</strong>
            </div>

            {onDateChange && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1 text-xs">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => onDateChange(e.target.value)}
                  className="bg-transparent text-xs font-medium text-slate-800 focus:outline-hidden"
                />
              </div>
            )}

            {/* 30-second Auto-refresh countdown indicator */}
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-md text-2xs font-bold text-[#1E3A8A]"
              title="Automatically updates live floor duty statuses every 30 seconds"
            >
              <RefreshCw className="h-3 w-3 text-[#1E3A8A] animate-spin" style={{ animationDuration: '4s' }} />
              <span>Live Auto-Sync in {refreshCountdown}s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Role-Based Sections (Requirement 3 & 6) */}
      <div className="space-y-6">
        {/* SECTION 1: MANAGERS */}
        {renderRoleSection(
          'Operations Managers',
          managers,
          <Shield className="h-4 w-4" />,
          'bg-[#1E3A8A]',
          'No Managers found for this shift'
        )}

        {/* SECTION 2: SUPERVISORS */}
        {renderRoleSection(
          'Ward & Floor Supervisors',
          supervisors,
          <Users className="h-4 w-4" />,
          'bg-indigo-600',
          'No Supervisors assigned for this shift'
        )}

        {/* SECTION 3: STAFF (Excluded Admins - badge and count only reflects actual STAFF users) */}
        {renderRoleSection(
          'Housekeeping Staff',
          housekeepingStaff,
          <Sparkles className="h-4 w-4" />,
          'bg-emerald-600',
          'No Housekeeping Staff assigned for this shift'
        )}

        {/* SECTION 4: FACILITY ADMINISTRATION & LEADERSHIP (Non-operational floor staff) */}
        {admins.length > 0 &&
          renderRoleSection(
            'Facility Administration & Oversight',
            admins,
            <Building className="h-4 w-4" />,
            'bg-slate-700',
            'No Administration records for this shift'
          )}
      </div>
    </div>
  );
};
