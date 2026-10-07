// src/components/SupervisorTerminal.tsx
// Supervisor Terminal Header with Strict Real-Time Punch-In / Punch-Out State Sync

import React, { useMemo } from 'react';
import {
  ShieldCheck,
  LogIn,
  LogOut,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import type { AppUser, AttendanceRecord } from '../types';
import { SupervisorDutyState, getTodayIso } from '../data/mockHousekeepingData';
import { LiveConnectBadge } from './LiveConnectBadge';

export interface SupervisorTerminalProps {
  currentUser?: AppUser | null;
  currentDate?: string;
  attendanceLogs?: AttendanceRecord[];
  dutyState: SupervisorDutyState;
  effectiveSupervisorId?: string;
  supervisorName?: string;
  activeShiftWard?: string;
  isLocatingDuty?: boolean;
  onToggleDutyPunch: () => void | Promise<void>;
  onSwitchStaffPortal?: () => void;
  onSwitchAdminDashboard?: () => void;
  onLogout?: () => void;
  isAdmin?: boolean;
}

export const SupervisorTerminal: React.FC<SupervisorTerminalProps> = ({
  currentUser,
  currentDate = getTodayIso(),
  attendanceLogs = [],
  dutyState,
  effectiveSupervisorId = 'SUPERVISOR',
  supervisorName = 'Supervisor',
  activeShiftWard = '3rd Floor Wards & Critical Care',
  isLocatingDuty = false,
  onToggleDutyPunch,
  onSwitchStaffPortal,
  onSwitchAdminDashboard,
  onLogout,
  isAdmin = false,
}) => {
  // 1 & 2. Enforce Strict Header Duty Check Logic:
  // Fetch the real-time active shift punch log for the logged-in supervisor for the current date.
  // Do NOT default 'isOnDuty' or 'dutyStatus' to true/active upon loading.
  const todayPunchLog = useMemo(() => {
    return attendanceLogs.find((log) => {
      const punchIn = (log as any).punchInTime || log.punchIn;
      const punchOut = (log as any).punchOutTime || log.punchOut;

      const matchesUser =
        (currentUser?.id && (log.userId === currentUser.id || String(log.userId) === String(currentUser.id))) ||
        (currentUser?.staff_id && log.staff_id && log.staff_id.toLowerCase() === currentUser.staff_id.toLowerCase()) ||
        (currentUser?.username && log.staff_id && log.staff_id.toLowerCase() === currentUser.username.toLowerCase()) ||
        (effectiveSupervisorId && log.staff_id && log.staff_id.toLowerCase() === effectiveSupervisorId.toLowerCase());

      const hasPunchIn = Boolean(punchIn && punchIn !== '--:--' && punchIn !== '--');
      const hasPunchOut = Boolean(punchOut && punchOut !== '--:--' && punchOut !== '--');

      return matchesUser && log.date === currentDate && hasPunchIn && !hasPunchOut;
    });
  }, [attendanceLogs, currentUser, effectiveSupervisorId, currentDate]);

  const isSupervisorPunchedIn = Boolean(todayPunchLog);

  const activePunchInTime = todayPunchLog
    ? (todayPunchLog as any).punchInTime || todayPunchLog.punchIn
    : null;
  const activePunchOutTime = !isSupervisorPunchedIn
    ? (dutyState?.punchOutTime ||
        attendanceLogs.find(
          (l) =>
            ((currentUser?.id && (l.userId === currentUser.id || String(l.userId) === String(currentUser.id))) ||
              (effectiveSupervisorId && l.staff_id && l.staff_id.toLowerCase() === effectiveSupervisorId.toLowerCase())) &&
            l.date === currentDate &&
            ((l as any).punchOutTime || l.punchOut)
        )?.punchOut ||
        null)
    : null;

  return (
    <div className="space-y-4" id="supervisor-terminal-header-container">
      {/* Top Header Navigation */}
      <header className="bg-[#1E3A8A] text-white shadow-md rounded-2xl overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <ShieldCheck className="h-5 w-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base tracking-tight text-white">ApexCare Health</span>
                <span className="bg-amber-500/90 text-amber-950 text-3xs font-bold px-2 py-0.5 rounded-full uppercase">
                  Supervisor Terminal
                </span>
              </div>
              <p className="text-3xs text-blue-200">
                Supervisor: <b className="text-white">{supervisorName}</b> ({effectiveSupervisorId}) &bull; Active Sector: {activeShiftWard}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onSwitchStaffPortal && (
              <button
                type="button"
                id="btn-switch-staff-portal"
                onClick={onSwitchStaffPortal}
                className="text-xs bg-white/10 hover:bg-white/20 text-white font-medium px-3 py-1.5 rounded-lg border border-white/20 transition-colors"
              >
                Staff Portal
              </button>
            )}

            <LiveConnectBadge />

            {isAdmin && onSwitchAdminDashboard && (
              <button
                type="button"
                id="btn-switch-admin-dash"
                onClick={onSwitchAdminDashboard}
                className="text-xs bg-white/10 hover:bg-white/20 text-white font-medium px-3 py-1.5 rounded-lg border border-white/20 transition-colors"
              >
                Admin Dashboard
              </button>
            )}

            {onLogout && (
              <button
                type="button"
                id="btn-supervisor-logout"
                onClick={onLogout}
                className="flex items-center gap-1 text-xs bg-rose-600/90 hover:bg-rose-600 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 3. Dynamic Header Banner & Button Rendering */}
      <section
        id="supervisor-duty-status-card"
        className={`rounded-2xl p-4 sm:p-5 border shadow-sm transition-all ${
          isSupervisorPunchedIn
            ? 'bg-gradient-to-r from-emerald-900/10 via-emerald-800/5 to-white border-emerald-500/40 text-emerald-950'
            : 'bg-gradient-to-r from-amber-900/10 via-amber-800/5 to-white border-amber-500/40 text-amber-950'
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {isSupervisorPunchedIn ? (
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
              </span>
            ) : (
              <div className="h-4 w-4 rounded-full bg-amber-500"></div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {isSupervisorPunchedIn
                    ? 'Supervisor On-Duty Check: ACTIVE (Live Controls & Approvals Enabled)'
                    : 'Supervisor On-Duty Check: OFF-DUTY (Read-Only Past History Mode)'}
                </h2>
                <span
                  className={`text-2xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                    isSupervisorPunchedIn
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {isSupervisorPunchedIn ? '🟢 LIVE OPERATIONAL / ON-DUTY' : '🟡 OFF-DUTY (Read-Only Mode)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSupervisorPunchedIn
                  ? `Punched In at ${activePunchInTime || '--:--'} • Supervising ${activeShiftWard} • Live controls and OT approvals are active`
                  : `Currently Off-Duty • ${activePunchOutTime ? `Punched Out at ${activePunchOutTime} • ` : ''}Live operational controls and OT approvals locked in Read-Only mode`}
              </p>
            </div>
          </div>

          {/* Action Button: Dynamic Switch between Green "Punch In to Start Shift" and Red "Punch Out of Shift" */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            {isSupervisorPunchedIn ? (
              /* IF isSupervisorPunchedIn is TRUE: Show RED "Punch Out of Shift (Go Off-Duty)" button */
              <button
                type="button"
                id="btn-supervisor-duty-punch"
                onClick={onToggleDutyPunch}
                disabled={isLocatingDuty}
                className="w-full md:w-auto px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isLocatingDuty ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Verifying Location & GPS...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4" />
                    <span>Punch Out of Shift (Go Off-Duty)</span>
                  </>
                )}
              </button>
            ) : (
              /* IF isSupervisorPunchedIn is FALSE: Show GREEN "Punch In to Start Shift" button (Hide Red Punch Out button) */
              <button
                type="button"
                id="btn-supervisor-duty-punch"
                onClick={onToggleDutyPunch}
                disabled={isLocatingDuty}
                className="w-full md:w-auto px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isLocatingDuty ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Verifying Location & GPS...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>Punch In to Start Shift</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 4. Sync Off-Duty Restriction Rules (Live Watch permitted, action triggers locked until Punch-In) */}
        {!isSupervisorPunchedIn && (
          <div
            id="supervisor-off-duty-banner"
            className="mt-4 p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-xl text-xs text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <b className="font-bold">🟡 Action Restricted:</b> You are currently OFF-DUTY (Read-Only Mode). Please Punch-In to make operational entries.
                <div className="text-2xs text-amber-800 mt-0.5">
                  Live operational controls, reliever allocation actions, and real-time overtime approval buttons are locked in READ-ONLY mode. Live Watch is permitted.
                </div>
              </div>
            </div>
            <button
              type="button"
              id="btn-banner-punch-in-quick"
              onClick={onToggleDutyPunch}
              disabled={isLocatingDuty}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-2xs"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Punch In to Start Shift</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default SupervisorTerminal;
