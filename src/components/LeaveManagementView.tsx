import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  CalendarCheck,
  CalendarDays,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  AlertTriangle,
  Plus,
  Filter,
  Search,
  Check,
  X,
  Building,
  RefreshCw,
  Shield,
  Briefcase,
  Users,
  ChevronRight,
  TrendingUp,
  Settings,
  Edit2,
  FileText,
  AlertCircle
} from 'lucide-react';
import type {
  AppUser,
  LeaveRequest,
  LeaveType,
  LeaveStatus,
  LeaveBalance,
  DayOfWeek,
  HospitalSite
} from '../types';
import {
  getStoredUsers,
  getAllLeaveRequests,
  submitLeaveRequest,
  updateLeaveRequestStatus,
  updateUserWeeklyOff,
  updateUserLeaveBalance,
  getDayOfWeekFromDate,
  isUserOnLeaveOnDate,
  isUserWeeklyOffOnDate,
  getLeaveMetricsForDate
} from '../data/mockHousekeepingData';

interface LeaveManagementViewProps {
  currentUser: AppUser | null;
  selectedDate: string;
  selectedSite: string;
  sites: HospitalSite[];
  onOpenDutyModal?: () => void;
}

const WEEK_DAYS: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const LeaveManagementView: React.FC<LeaveManagementViewProps> = ({
  currentUser,
  selectedDate,
  selectedSite,
  sites,
  onOpenDutyModal
}) => {
  const role = (currentUser?.role || 'staff').toLowerCase();
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isSupervisor = role === 'supervisor';
  const isStaff = role === 'staff';

  // Local state to trigger re-renders on updates
  const [refreshKey, setRefreshKey] = useState(0);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'requests' | 'roster' | 'balances' | 'analytics'>(
    isStaff ? 'requests' : isSupervisor ? 'roster' : 'requests'
  );

  // Leave submission modal state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [newLeaveType, setNewLeaveType] = useState<LeaveType>('Casual');
  const [newStartDate, setNewStartDate] = useState(selectedDate);
  const [newEndDate, setNewEndDate] = useState(selectedDate);
  const [newReason, setNewReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Admin / Manager Edit Weekly Off Modal
  const [editingWeeklyOffUser, setEditingWeeklyOffUser] = useState<AppUser | null>(null);
  const [selectedWeeklyOffDay, setSelectedWeeklyOffDay] = useState<DayOfWeek>('Sunday');

  // Admin Edit Balance Modal
  const [editingBalanceUser, setEditingBalanceUser] = useState<AppUser | null>(null);
  const [editBalanceCasual, setEditBalanceCasual] = useState<number>(12);
  const [editBalanceSick, setEditBalanceSick] = useState<number>(7);
  const [editBalancePaid, setEditBalancePaid] = useState<number>(15);

  // Load and normalize data
  const reloadData = () => {
    const loadedUsers = getStoredUsers();
    setUsers(loadedUsers);
    const reqs = getAllLeaveRequests();
    setLeaveRequests(reqs);
  };

  useEffect(() => {
    reloadData();
  }, [refreshKey]);

  // Listen to window leave-data-updated event
  useEffect(() => {
    const handleUpdate = () => {
      reloadData();
    };
    window.addEventListener('leave-data-updated', handleUpdate);
    return () => window.removeEventListener('leave-data-updated', handleUpdate);
  }, []);

  // Filter users by selectedSite (if applicable)
  const scopedUsers = useMemo(() => {
    if (selectedSite === 'ALL' || !selectedSite) {
      return users;
    }
    return users.filter((u) => (u.siteId || u.site_id || 'site-main') === selectedSite);
  }, [users, selectedSite]);

  // Daily status calculations for selectedDate
  const currentDayName = getDayOfWeekFromDate(selectedDate);

  const staffUsers = useMemo(() => {
    return scopedUsers.filter((u) => u.role === 'staff' && u.status === 'ACTIVE');
  }, [scopedUsers]);

  // Roster lists for today
  const onLeaveUsersToday = useMemo(() => {
    return staffUsers.filter((u) => isUserOnLeaveOnDate(u, selectedDate));
  }, [staffUsers, selectedDate]);

  const weeklyOffUsersToday = useMemo(() => {
    return staffUsers.filter((u) => isUserWeeklyOffOnDate(u, selectedDate));
  }, [staffUsers, selectedDate]);

  const onDutyUsersToday = useMemo(() => {
    return staffUsers.filter((u) => {
      const onLeave = isUserOnLeaveOnDate(u, selectedDate);
      const onOff = isUserWeeklyOffOnDate(u, selectedDate);
      return !onLeave && !onOff;
    });
  }, [staffUsers, selectedDate]);

  // Filtered requests according to role & site
  const filteredRequests = useMemo(() => {
    let list = leaveRequests;

    // Staff sees only their own
    if (isStaff && currentUser) {
      list = list.filter((r) => r.userId === currentUser.id);
    } else if (isManager && selectedSite !== 'ALL' && selectedSite) {
      // Manager sees requests from their site
      list = list.filter((r) => r.siteId === selectedSite);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          r.userName.toLowerCase().includes(q) ||
          r.requestId.toLowerCase().includes(q) ||
          r.leaveType.toLowerCase().includes(q) ||
          (r.reason && r.reason.toLowerCase().includes(q))
      );
    }

    return list;
  }, [leaveRequests, isStaff, isManager, currentUser, selectedSite, searchTerm]);

  // Current user's profile with real-time balance
  const activeUserProfile = useMemo(() => {
    if (!currentUser) return null;
    return users.find((u) => u.id === currentUser.id) || currentUser;
  }, [users, currentUser]);

  const userWeeklyOff = activeUserProfile?.weeklyOffDay || 'Sunday';
  const userBalance: LeaveBalance = activeUserProfile?.leaveBalance || { casual: 12, sick: 7, paid: 15 };

  // Handlers
  const handleOpenSubmitModal = () => {
    setNewLeaveType('Casual');
    setNewStartDate(selectedDate);
    setNewEndDate(selectedDate);
    setNewReason('');
    setFormError(null);
    setIsSubmitModalOpen(true);
  };

  const calculateDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    const diff = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleCreateLeaveRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUserProfile) return;

    setFormError(null);
    const days = calculateDays(newStartDate, newEndDate);
    if (days <= 0) {
      setFormError('End Date must be on or after Start Date.');
      return;
    }

    const balKey = newLeaveType.toLowerCase() as keyof LeaveBalance;
    const available = userBalance[balKey] ?? 0;
    if (available < days) {
      setFormError(`Insufficient balance! You have ${available} days of ${newLeaveType} leave remaining, but requested ${days} day(s).`);
      return;
    }

    const res = submitLeaveRequest({
      userId: activeUserProfile.id,
      leaveType: newLeaveType,
      startDate: newStartDate,
      endDate: newEndDate,
      reason: newReason.trim(),
    });

    if (res.success) {
      setIsSubmitModalOpen(false);
      setActionSuccessMessage(res.message);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } else {
      setFormError(res.message);
    }
  };

  const handleApprove = (requestId: string) => {
    const approverName = currentUser?.full_name || currentUser?.name || 'Authorized Supervisor';
    const res = updateLeaveRequestStatus(requestId, 'Approved', approverName);
    if (res.success) {
      setActionSuccessMessage(res.message);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    }
  };

  const handleReject = (requestId: string) => {
    const rejecterName = currentUser?.full_name || currentUser?.name || 'Authorized Supervisor';
    const res = updateLeaveRequestStatus(requestId, 'Rejected', rejecterName);
    if (res.success) {
      setActionSuccessMessage(res.message);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    }
  };

  const handleOpenEditWeeklyOff = (u: AppUser) => {
    setEditingWeeklyOffUser(u);
    setSelectedWeeklyOffDay((u.weeklyOffDay as DayOfWeek) || 'Sunday');
  };

  const handleSaveWeeklyOff = () => {
    if (!editingWeeklyOffUser) return;
    const res = updateUserWeeklyOff(editingWeeklyOffUser.id, selectedWeeklyOffDay);
    if (res.success) {
      setActionSuccessMessage(res.message);
      setEditingWeeklyOffUser(null);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    }
  };

  const handleOpenEditBalance = (u: AppUser) => {
    setEditingBalanceUser(u);
    setEditBalanceCasual(u.leaveBalance?.casual ?? 12);
    setEditBalanceSick(u.leaveBalance?.sick ?? 7);
    setEditBalancePaid(u.leaveBalance?.paid ?? 15);
  };

  const handleSaveBalance = () => {
    if (!editingBalanceUser) return;
    const res = updateUserLeaveBalance(editingBalanceUser.id, {
      casual: editBalanceCasual,
      sick: editBalanceSick,
      paid: editBalancePaid,
    });
    if (res.success) {
      setActionSuccessMessage(res.message);
      setEditingBalanceUser(null);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    }
  };

  // Pending count across visible scope
  const pendingCount = useMemo(() => {
    return filteredRequests.filter((r) => r.status === 'Pending').length;
  }, [filteredRequests]);

  return (
    <div className="space-y-6 text-slate-100 animate-fadeIn" id="leave-management-system-root">
      {/* Toast Notification */}
      {actionSuccessMessage && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-300 text-sm flex items-center justify-between shadow-lg shadow-emerald-950/40 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Role Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <CalendarCheck className="w-6 h-6 text-cyan-400" />
              Role-Based Leave &amp; Weekly Off Management
            </h2>
            <span className="px-2.5 py-0.5 text-2xs font-bold rounded-full uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              {role} Panel
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time shift coverage, leave approvals, policy enforcement &amp; weekly off rosters
            for <span className="text-cyan-400 font-semibold">{selectedDate}</span> ({currentDayName}).
          </p>
        </div>

        {/* Action Button for Staff */}
        <div className="flex items-center gap-3">
          {isStaff && (
            <button
              id="btn-apply-leave-staff"
              onClick={handleOpenSubmitModal}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-cyan-950/40 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus className="w-4 h-4" />
              Apply For Leave
            </button>
          )}

          {(isAdmin || isManager || isSupervisor) && (
            <button
              onClick={() => reloadData()}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="Refresh Roster & Requests"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* LIVE COUNTERS (DARK 4D GLASSMORPHISM STATS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="live-leave-metrics-cards">
        {/* Card 1: ON LEAVE TODAY */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#121626]/90 to-[#0d111d]/90 border border-amber-500/30 p-5 shadow-xl backdrop-blur-xl group hover:border-amber-500/60 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-widest text-amber-400/90">
              On Leave Today
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-amber-300">
              {onLeaveUsersToday.length < 10 ? `0${onLeaveUsersToday.length}` : onLeaveUsersToday.length}
            </span>
            <span className="text-xs text-slate-400 font-medium">Approved Staff</span>
          </div>
          <div className="mt-2 text-2xs text-amber-400/80 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {onLeaveUsersToday.length > 0
              ? `${onLeaveUsersToday.map((u) => u.name || u.full_name).slice(0, 2).join(', ')}${onLeaveUsersToday.length > 2 ? ' +' + (onLeaveUsersToday.length - 2) : ''}`
              : 'Zero active leaves scheduled'}
          </div>
        </div>

        {/* Card 2: WEEKLY OFF TODAY */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#121626]/90 to-[#0d111d]/90 border border-cyan-500/30 p-5 shadow-xl backdrop-blur-xl group hover:border-cyan-500/60 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-widest text-cyan-400/90">
              Weekly Off Today
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-cyan-300">
              {weeklyOffUsersToday.length < 10 ? `0${weeklyOffUsersToday.length}` : weeklyOffUsersToday.length}
            </span>
            <span className="text-xs text-slate-400 font-medium">Scheduled Off</span>
          </div>
          <div className="mt-2 text-2xs text-cyan-400/80 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            {currentDayName} Assigned Roster
          </div>
        </div>

        {/* Card 3: ON DUTY TODAY (SHIFT COVERAGE) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#121626]/90 to-[#0d111d]/90 border border-emerald-500/30 p-5 shadow-xl backdrop-blur-xl group hover:border-emerald-500/60 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-widest text-emerald-400/90">
              Active Shift Duty
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-emerald-300">
              {onDutyUsersToday.length < 10 ? `0${onDutyUsersToday.length}` : onDutyUsersToday.length}
            </span>
            <span className="text-xs text-slate-400 font-medium">Housekeepers</span>
          </div>
          <div className="mt-2 text-2xs text-emerald-400/80 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {staffUsers.length > 0
              ? `${Math.round((onDutyUsersToday.length / staffUsers.length) * 100)}% Floor Coverage`
              : '0%'}
          </div>
        </div>

        {/* Card 4: PENDING APPROVALS QUEUE */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#121626]/90 to-[#0d111d]/90 border border-purple-500/30 p-5 shadow-xl backdrop-blur-xl group hover:border-purple-500/60 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-widest text-purple-400/90">
              Pending Leaves
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-purple-300">
              {pendingCount < 10 ? `0${pendingCount}` : pendingCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">Requests</span>
          </div>
          <div className="mt-2 text-2xs text-purple-400/80 flex items-center gap-1">
            {pendingCount > 0 ? (
              <span className="text-amber-300 font-semibold animate-pulse">Action Required by Manager</span>
            ) : (
              <span>All requests resolved</span>
            )}
          </div>
        </div>
      </div>

      {/* STAFF SPECIFIC SUMMARY CARD: Assigned Off & Balances */}
      {isStaff && activeUserProfile && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="staff-personal-leave-summary">
          {/* Weekly Off Info */}
          <div className="rounded-xl bg-gradient-to-br from-cyan-950/40 to-blue-950/30 border border-cyan-500/30 p-4">
            <div className="text-xs font-medium text-cyan-400 uppercase tracking-wider">My Assigned Weekly Off</div>
            <div className="mt-2 flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-cyan-300" />
              <div className="text-2xl font-bold text-white">{userWeeklyOff}</div>
            </div>
            <div className="mt-1 text-2xs text-slate-400">
              {currentDayName === userWeeklyOff ? (
                <span className="text-cyan-400 font-bold">🎉 Today is your Weekly Off!</span>
              ) : (
                `Regular duty applies on ${currentDayName}`
              )}
            </div>
          </div>

          {/* Casual Leave Balance */}
          <div className="rounded-xl bg-slate-900/60 border border-white/10 p-4">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Casual Leave (CL)</span>
              <span className="text-cyan-400 font-bold">{userBalance.casual} / 12</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-cyan-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (userBalance.casual / 12) * 100)}%` }}
              />
            </div>
            <div className="mt-2 text-2xs text-slate-500">For urgent personal / family matters</div>
          </div>

          {/* Sick Leave Balance */}
          <div className="rounded-xl bg-slate-900/60 border border-white/10 p-4">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Sick Leave (SL)</span>
              <span className="text-amber-400 font-bold">{userBalance.sick} / 7</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (userBalance.sick / 7) * 100)}%` }}
              />
            </div>
            <div className="mt-2 text-2xs text-slate-500">For health recovery &amp; medical visits</div>
          </div>

          {/* Paid Leave Balance */}
          <div className="rounded-xl bg-slate-900/60 border border-white/10 p-4">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Earned / Paid Leave (PL)</span>
              <span className="text-emerald-400 font-bold">{userBalance.paid} / 15</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (userBalance.paid / 15) * 100)}%` }}
              />
            </div>
            <div className="mt-2 text-2xs text-slate-500">Annual leaves &amp; planned vacations</div>
          </div>
        </div>
      )}

      {/* NAVIGATION TABS & SEARCH BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            id="tab-leave-requests"
            onClick={() => setActiveTab('requests')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'requests'
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Leave Requests Queue</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-2xs bg-amber-500 text-slate-950 font-black">
                {pendingCount}
              </span>
            )}
          </button>

          {(isAdmin || isManager || isSupervisor) && (
            <button
              id="tab-team-roster"
              onClick={() => setActiveTab('roster')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'roster'
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Shift Coverage Roster</span>
            </button>
          )}

          {(isAdmin || isManager) && (
            <button
              id="tab-weekly-off-editor"
              onClick={() => setActiveTab('balances')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'balances'
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Staff Weekly Off &amp; Policy</span>
            </button>
          )}

          {isAdmin && (
            <button
              id="tab-analytics"
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'analytics'
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Global Analytics</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search staff, ID, or leave type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900/60 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* VIEW 1: LEAVE REQUESTS QUEUE */}
      {activeTab === 'requests' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              {isStaff ? 'My Leave Application History' : 'Site Leave Approval Stream'}
            </h3>
            <span className="text-xs text-slate-400">
              Showing {filteredRequests.length} request(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Site / Role</th>
                  <th className="py-3 px-4">Leave Type</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Days</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions / Approver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CheckCircle className="w-8 h-8 text-slate-600" />
                        <p>No leave requests found matching current filter.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => {
                    const isPending = req.status === 'Pending';
                    const isApproved = req.status === 'Approved';
                    const isRejected = req.status === 'Rejected';

                    return (
                      <tr key={req.requestId} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-cyan-300">
                          {req.requestId}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{req.userName}</div>
                          <div className="text-2xs text-slate-400">UID #{req.userId}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-300 capitalize">{req.role}</div>
                          <div className="text-2xs text-slate-500">{req.siteId}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-2xs font-semibold ${
                              req.leaveType === 'Sick'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : req.leaveType === 'Paid'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            }`}
                          >
                            {req.leaveType}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-slate-200">{req.startDate}</div>
                          {req.startDate !== req.endDate && (
                            <div className="text-2xs text-slate-400">to {req.endDate}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-200">
                          {req.daysCount || 1} d
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-300" title={req.reason}>
                          {req.reason || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-2xs font-bold flex items-center gap-1 w-max ${
                              isApproved
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : isRejected
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                            }`}
                          >
                            {isApproved && <Check className="w-3 h-3" />}
                            {isRejected && <X className="w-3 h-3" />}
                            {isPending && <Clock className="w-3 h-3" />}
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {/* Manager / Admin approval controls */}
                          {(isAdmin || isManager) && isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleApprove(req.requestId)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-2xs flex items-center gap-1 shadow transition-all"
                                title="Approve leave and deduct from staff balance"
                              >
                                <Check className="w-3 h-3" /> Approve
                              </button>
                              <button
                                onClick={() => handleReject(req.requestId)}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded text-2xs flex items-center gap-1 shadow transition-all"
                                title="Reject leave application"
                              >
                                <X className="w-3 h-3" /> Reject
                              </button>
                            </div>
                          ) : (
                            <div className="text-2xs text-slate-400">
                              {req.actionBy ? (
                                <span>by {req.actionBy}</span>
                              ) : (
                                <span>Awaiting review</span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: SUPERVISOR SHIFT COVERAGE ROSTER */}
      {activeTab === 'roster' && (
        <div className="space-y-4" id="supervisor-shift-roster-view">
          {/* Shift Coverage Warning Bar */}
          <div className="p-4 bg-slate-900/60 border border-cyan-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Daily Shift Coverage Protocol</h4>
                <p className="text-xs text-slate-400">
                  {onLeaveUsersToday.length} on leave and {weeklyOffUsersToday.length} on weekly off today.
                  Ensure reliever staff cover high-priority zones (ICU, Emergency, Operation Theaters).
                </p>
              </div>
            </div>

            {onOpenDutyModal && (
              <button
                onClick={onOpenDutyModal}
                className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shrink-0 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Assign Reliever Duty
              </button>
            )}
          </div>

          {/* Roster Grid */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Team Roster Status for {selectedDate} ({currentDayName})
              </h3>
              <div className="flex items-center gap-2 text-2xs">
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> On Duty ({onDutyUsersToday.length})
                </span>
                <span className="flex items-center gap-1 text-cyan-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" /> Weekly Off ({weeklyOffUsersToday.length})
                </span>
                <span className="flex items-center gap-1 text-amber-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> On Leave ({onLeaveUsersToday.length})
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Staff Code</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Fixed Area / Shift</th>
                    <th className="py-3 px-4">Assigned Off Day</th>
                    <th className="py-3 px-4">Today&apos;s Status</th>
                    <th className="py-3 px-4">Leave Balances</th>
                    <th className="py-3 px-4 text-right">Coverage Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {staffUsers.map((user) => {
                    const onLeave = isUserOnLeaveOnDate(user, selectedDate);
                    const onOff = isUserWeeklyOffOnDate(user, selectedDate);
                    const bal = user.leaveBalance || { casual: 12, sick: 7, paid: 15 };

                    return (
                      <tr key={user.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-cyan-300">
                          {user.staff_id || `HK-${user.id.toString().padStart(3, '0')}`}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          {user.full_name || user.name}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-200">{user.fixed_department || user.assigned_area || 'General Duty'}</div>
                          <div className="text-2xs text-slate-500">Shift {user.assigned_shift || '7-3'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-300">
                            {user.weeklyOffDay || 'Sunday'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {onLeave ? (
                            <span className="px-2.5 py-1 rounded-full text-2xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 w-max">
                              <Calendar className="w-3 h-3" /> On Leave Today
                            </span>
                          ) : onOff ? (
                            <span className="px-2.5 py-1 rounded-full text-2xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 w-max">
                              <CalendarDays className="w-3 h-3" /> Weekly Off Today
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-2xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 w-max">
                              <CheckCircle className="w-3 h-3" /> On Duty Active
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 text-2xs">
                            <span className="text-cyan-400">CL: {bal.casual}</span>
                            <span className="text-amber-400">SL: {bal.sick}</span>
                            <span className="text-emerald-400">PL: {bal.paid}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 text-2xs">
                          {onLeave ? (
                            <span className="text-amber-400 font-semibold">Replacement needed</span>
                          ) : onOff ? (
                            <span className="text-cyan-400">Scheduled rest</span>
                          ) : (
                            <span>Baseline 8h shift</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: MANAGER & ADMIN STAFF WEEKLY OFF SCHEDULE EDITOR */}
      {activeTab === 'balances' && (isAdmin || isManager) && (
        <div className="space-y-4" id="manager-weekly-off-editor">
          <div className="p-4 bg-slate-900/60 border border-purple-500/30 rounded-xl flex items-center justify-between backdrop-blur-md">
            <div>
              <h4 className="text-sm font-bold text-white">Site Staff Weekly Off Configuration</h4>
              <p className="text-xs text-slate-400">
                Managers can reassign weekly off days for site staff to ensure continuous 24/7 hospital shift coverage.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Staff Code</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Site</th>
                    <th className="py-3 px-4">Assigned Shift</th>
                    <th className="py-3 px-4">Current Weekly Off</th>
                    <th className="py-3 px-4">Leave Balances</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {staffUsers.map((user) => {
                    const bal = user.leaveBalance || { casual: 12, sick: 7, paid: 15 };
                    return (
                      <tr key={user.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-cyan-300">
                          {user.staff_id || `HK-${user.id.toString().padStart(3, '0')}`}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          {user.full_name || user.name}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {user.siteId || 'site-main'}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {user.assigned_shift || '7-3'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 rounded-full text-2xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            {user.weeklyOffDay || 'Sunday'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 text-2xs">
                            <span className="text-cyan-400">CL: {bal.casual}</span>
                            <span className="text-amber-400">SL: {bal.sick}</span>
                            <span className="text-emerald-400">PL: {bal.paid}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditWeeklyOff(user)}
                              className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 rounded text-2xs font-semibold flex items-center gap-1 transition-all"
                            >
                              <Edit2 className="w-3 h-3" /> Change Off Day
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleOpenEditBalance(user)}
                                className="px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 rounded text-2xs font-semibold flex items-center gap-1 transition-all"
                              >
                                <Settings className="w-3 h-3" /> Override Balances
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: ADMIN GLOBAL ANALYTICS */}
      {activeTab === 'analytics' && isAdmin && (
        <div className="space-y-4" id="admin-global-analytics-view">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Total Requests All-Time</h4>
              <div className="text-3xl font-black text-white">{leaveRequests.length}</div>
              <div className="mt-2 text-2xs text-slate-500">
                {leaveRequests.filter((r) => r.status === 'Approved').length} Approved &bull; {leaveRequests.filter((r) => r.status === 'Rejected').length} Rejected
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Leave Type Distribution</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-cyan-400">
                  <span>Casual Leaves</span>
                  <span className="font-bold">{leaveRequests.filter((r) => r.leaveType === 'Casual').length}</span>
                </div>
                <div className="flex justify-between text-amber-400">
                  <span>Sick Leaves</span>
                  <span className="font-bold">{leaveRequests.filter((r) => r.leaveType === 'Sick').length}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Paid Leaves</span>
                  <span className="font-bold">{leaveRequests.filter((r) => r.leaveType === 'Paid').length}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Hospital Policy Compliance</h4>
              <div className="text-3xl font-black text-emerald-400">100%</div>
              <div className="mt-2 text-2xs text-slate-400">All balances normalized with minimum 1 day review window.</div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: APPLY FOR LEAVE (STAFF) */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-cyan-950/40">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-cyan-400" />
                Submit Leave Application
              </h3>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLeaveRequest} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-500/20 border border-rose-500/50 rounded-lg text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Leave Type</label>
                <select
                  value={newLeaveType}
                  onChange={(e) => setNewLeaveType(e.target.value as LeaveType)}
                  className="w-full p-2 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Casual">Casual Leave (Available: {userBalance.casual} days)</option>
                  <option value="Sick">Sick Leave (Available: {userBalance.sick} days)</option>
                  <option value="Paid">Paid / Earned Leave (Available: {userBalance.paid} days)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full p-2 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">End Date</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full p-2 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
              </div>

              <div className="p-2.5 bg-white/5 rounded-lg text-slate-300 flex items-center justify-between">
                <span>Calculated Duration:</span>
                <span className="font-bold text-cyan-300">
                  {calculateDays(newStartDate, newEndDate)} Day(s)
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Reason / Notes (Optional)</label>
                <textarea
                  rows={3}
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="e.g. Medical recovery checkup, urgent family event..."
                  className="w-full p-2 bg-slate-800 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg shadow-lg shadow-cyan-950/40"
                >
                  Confirm &amp; Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT WEEKLY OFF DAY (MANAGER / ADMIN) */}
      {editingWeeklyOffUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-cyan-400" />
                Edit Weekly Off Day
              </h3>
              <button
                onClick={() => setEditingWeeklyOffUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Reassign assigned off day for{' '}
                <span className="font-bold text-white">
                  {editingWeeklyOffUser.full_name || editingWeeklyOffUser.name}
                </span>{' '}
                ({editingWeeklyOffUser.staff_id}):
              </p>
              <select
                value={selectedWeeklyOffDay}
                onChange={(e) => setSelectedWeeklyOffDay(e.target.value as DayOfWeek)}
                className="w-full mt-3 p-2.5 bg-slate-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                {WEEK_DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingWeeklyOffUser(null)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveWeeklyOff}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded text-xs shadow"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADMIN OVERRIDE LEAVE BALANCES */}
      {editingBalanceUser && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-slate-900 border border-purple-500/40 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-purple-400" />
                Override Leave Balances
              </h3>
              <button
                onClick={() => setEditingBalanceUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Admin policy override for{' '}
              <span className="font-bold text-white">
                {editingBalanceUser.full_name || editingBalanceUser.name}
              </span>:
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-cyan-400 font-semibold mb-1">Casual Leave (Days)</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={editBalanceCasual}
                  onChange={(e) => setEditBalanceCasual(parseInt(e.target.value, 10) || 0)}
                  className="w-full p-2 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-amber-400 font-semibold mb-1">Sick Leave (Days)</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={editBalanceSick}
                  onChange={(e) => setEditBalanceSick(parseInt(e.target.value, 10) || 0)}
                  className="w-full p-2 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-emerald-400 font-semibold mb-1">Paid / Earned Leave (Days)</label>
                <input
                  type="number"
                  min="0"
                  max="45"
                  value={editBalancePaid}
                  onChange={(e) => setEditBalancePaid(parseInt(e.target.value, 10) || 0)}
                  className="w-full p-2 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingBalanceUser(null)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBalance}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded text-xs shadow"
              >
                Apply Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
