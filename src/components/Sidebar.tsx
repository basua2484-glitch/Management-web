// src/components/Sidebar.tsx
// Responsive Overlay Sidebar Drawer for Desktop & Mobile views

import React, { useEffect } from 'react';
import {
  Activity,
  Users,
  UserCheck,
  CalendarCheck,
  Clock,
  FileSpreadsheet,
  MapPin,
  KeyRound,
  UserPlus,
  Compass,
  History,
  FileText,
  LogOut,
  Lock,
  X,
} from 'lucide-react';
import type { AppUser } from '../types';

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onNavigateTab: (tab: string) => void;
  isAdminOrManager: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  tenantUsersCount?: number;
  staffList?: any[];
  totalPendingCount?: number;
  pendingLeavesCount?: number;
  staffCount?: number;
  currentUser?: AppUser | null;
  userInitial?: string;
  userName?: string;
  onLogout: () => void;
  onOpenAdminVaultModal?: () => void;
  onOpenStaffRequestModal?: () => void;
  onOpenDutyModal?: () => void;
  onOpenStaffModal?: () => void;
  onOpenSheetsModal?: () => void;
  onOpenPdfPreview?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeTab,
  onNavigateTab,
  isAdminOrManager,
  isAdmin,
  isManager,
  isStaff,
  tenantUsersCount = 0,
  staffList,
  totalPendingCount = 0,
  pendingLeavesCount = 0,
  staffCount = 0,
  currentUser,
  userInitial = 'A',
  userName = 'User',
  onLogout,
  onOpenAdminVaultModal,
  onOpenStaffRequestModal,
  onOpenDutyModal,
  onOpenStaffModal,
  onOpenSheetsModal,
  onOpenPdfPreview,
}) => {
  // Close sidebar on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when drawer is open on small viewports
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => document.body.classList.remove('overflow-hidden');
  }, [isOpen]);

  const handleLinkClick = (tab: string) => {
    onNavigateTab(tab);
    onClose(); // Automatically collapse on any menu link click
  };

  return (
    <>
      {/* 1. Backdrop Overlay for BOTH Mobile & Desktop */}
      {isOpen && (
        <div
          id="sidebar-overlay-backdrop"
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-1040 transition-opacity duration-300 cursor-pointer"
          onClick={onClose}
          aria-label="Close sidebar backdrop"
        />
      )}

      {/* 2. Slide-out Drawer Container */}
      <aside
        id="sidebarDrawer"
        className={`sidebar-drawer text-white p-3 d-flex flex-column justify-content-between shrink-0 select-none overflow-y-auto ${
          isOpen ? 'show' : ''
        }`}
        style={{
          width: '260px',
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 1050,
          backgroundColor: '#1a3a8a',
          transition: 'transform 0.3s ease-in-out',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          boxShadow: isOpen ? '4px 0 24px rgba(0, 0, 0, 0.35)' : 'none',
        }}
        aria-hidden={!isOpen}
      >
        <div>
          {/* Header with Title and Close Button */}
          <div className="d-flex justify-content-between align-items-center mb-4 border-bottom border-white-50 pb-2">
            <div>
              <small className="text-info fw-bold text-uppercase" style={{ fontSize: '0.65rem', color: '#93c5fd' }}>
                Admin Console
              </small>
              <h6 className="fw-bold mb-0 text-white">Housekeeping Ops</h6>
            </div>
            <button
              type="button"
              id="closeSidebarBtn"
              onClick={onClose}
              title="Close Sidebar"
              className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors border-0 bg-transparent cursor-pointer inline-flex items-center justify-center"
              aria-label="Close Sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="nav flex-column gap-1">
            {/* Live Attendance */}
            {isAdminOrManager ? (
              <button
                type="button"
                id="link-live-attendance"
                onClick={() => handleLinkClick('live')}
                className={`nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full ${
                  activeTab === 'live' ? 'bg-white/15' : ''
                }`}
              >
                <Activity className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                <span>Live Attendance</span>
              </button>
            ) : (
              <div
                className="nav-link text-white-50 disabled-link py-2 px-2.5 rounded d-flex align-items-center justify-content-between"
                style={{ pointerEvents: 'none', opacity: 0.5 }}
              >
                <span className="d-flex align-items-center">
                  <Activity className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Live Attendance</span>
                </span>
                <Lock className="text-warning ms-auto shrink-0" style={{ width: '0.85rem', height: '0.85rem', color: '#f59e0b' }} />
              </div>
            )}

            {/* Admin Staff Table & Vault */}
            {isAdminOrManager ? (
              <button
                type="button"
                id="link-admin-staff-mgmt"
                onClick={() => handleLinkClick('admin-staff')}
                className={`nav-link text-white py-2 px-2.5 rounded d-flex align-items-center justify-content-between cursor-pointer border-0 bg-transparent text-start w-full ${
                  activeTab === 'admin-staff' ? 'bg-white/15' : ''
                }`}
              >
                <span className="d-flex align-items-center">
                  <Users className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Staff &amp; Vault</span>
                </span>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: '0.65rem' }}>
                  {staffList ? staffList.length : tenantUsersCount}
                </span>
              </button>
            ) : (
              <div
                className="nav-link text-white-50 disabled-link py-2 px-2.5 rounded d-flex align-items-center justify-content-between"
                style={{ pointerEvents: 'none', opacity: 0.5 }}
              >
                <span className="d-flex align-items-center">
                  <Users className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Staff &amp; Vault</span>
                </span>
                <Lock className="text-warning ms-auto shrink-0" style={{ width: '0.85rem', height: '0.85rem', color: '#f59e0b' }} />
              </div>
            )}

            {/* Pending Approvals Queue */}
            {isAdminOrManager ? (
              <button
                type="button"
                id="link-pending-approvals-queue"
                onClick={() => handleLinkClick('pending-approvals')}
                className={`nav-link text-white py-2 px-2.5 rounded d-flex align-items-center justify-content-between cursor-pointer border-0 bg-transparent text-start w-full ${
                  activeTab === 'pending-approvals' ? 'bg-white/15' : ''
                }`}
              >
                <span className="d-flex align-items-center">
                  <UserCheck className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Approvals Queue</span>
                </span>
                {totalPendingCount > 0 ? (
                  <span className="badge bg-warning text-dark font-bold animate-pulse" style={{ fontSize: '0.65rem' }}>
                    {totalPendingCount} PENDING
                  </span>
                ) : (
                  <span className="badge bg-secondary-subtle text-white-50" style={{ fontSize: '0.6rem' }}>
                    0
                  </span>
                )}
              </button>
            ) : (
              <div
                className="nav-link text-white-50 disabled-link py-2 px-2.5 rounded d-flex align-items-center justify-content-between"
                style={{ pointerEvents: 'none', opacity: 0.5 }}
              >
                <span className="d-flex align-items-center">
                  <UserCheck className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Approvals Queue</span>
                </span>
                <Lock className="text-warning ms-auto shrink-0" style={{ width: '0.85rem', height: '0.85rem', color: '#f59e0b' }} />
              </div>
            )}

            {/* Leaves & Weekly Off Management Tab */}
            <button
              type="button"
              id="link-leave-management"
              onClick={() => handleLinkClick('leaves')}
              className={`nav-link text-white rounded py-2 px-2.5 d-flex align-items-center justify-content-between cursor-pointer border-0 bg-transparent text-start w-full ${
                activeTab === 'leaves' ? 'bg-white/15 border-l-2 border-cyan-400' : ''
              }`}
            >
              <span className="d-flex align-items-center">
                <CalendarCheck className="me-2 shrink-0 text-cyan-400" style={{ width: '1rem', height: '1rem' }} />
                <span>Leaves &amp; Weekly Off</span>
              </span>
              {pendingLeavesCount > 0 ? (
                <span className="badge bg-warning text-dark font-bold animate-pulse" style={{ fontSize: '0.65rem' }}>
                  {pendingLeavesCount} NEW
                </span>
              ) : (
                <span className="badge bg-info-subtle text-info border border-info-subtle" style={{ fontSize: '0.6rem' }}>
                  LIVE
                </span>
              )}
            </button>

            {/* Punching Kiosk */}
            <button
              type="button"
              id="link-staff-portal"
              onClick={() => handleLinkClick('portal')}
              className={`nav-link text-white rounded py-2 px-2.5 d-flex align-items-center justify-content-between cursor-pointer border-0 bg-transparent text-start w-full ${
                activeTab === 'portal' ? 'active-kiosk' : ''
              }`}
            >
              <span className="d-flex align-items-center">
                <Clock className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                <span>Punching Kiosk</span>
              </span>
              <span className="badge bg-success" style={{ fontSize: '0.6rem' }}>
                ACTIVE
              </span>
            </button>

            {/* Monthly OT */}
            {isAdminOrManager ? (
              <button
                type="button"
                id="link-monthly-report"
                onClick={() => handleLinkClick('monthly')}
                className={`nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full ${
                  activeTab === 'monthly' ? 'bg-white/15' : ''
                }`}
              >
                <FileSpreadsheet className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                <span>Monthly OT</span>
              </button>
            ) : (
              <div
                className="nav-link text-white-50 disabled-link py-2 px-2.5 rounded d-flex align-items-center justify-content-between"
                style={{ pointerEvents: 'none', opacity: 0.5 }}
              >
                <span className="d-flex align-items-center">
                  <FileSpreadsheet className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Monthly OT</span>
                </span>
                <Lock className="text-warning ms-auto shrink-0" style={{ width: '0.85rem', height: '0.85rem', color: '#f59e0b' }} />
              </div>
            )}

            {/* Geofence & GPS Settings */}
            {isAdminOrManager ? (
              <button
                type="button"
                id="link-geofence-settings"
                onClick={() => handleLinkClick('geofence')}
                className={`nav-link text-white py-2 px-2.5 rounded d-flex align-items-center justify-content-between cursor-pointer border-0 bg-transparent text-start w-full ${
                  activeTab === 'geofence' ? 'bg-white/15 border-l-2 border-amber-400 font-bold' : ''
                }`}
              >
                <span className="d-flex align-items-center">
                  <MapPin className="me-2 shrink-0 text-amber-400" style={{ width: '1rem', height: '1rem' }} />
                  <span>Geofence &amp; GPS</span>
                </span>
                <span className="badge bg-amber-500/20 text-amber-300 border border-amber-500/40" style={{ fontSize: '0.62rem' }}>
                  PERIMETER
                </span>
              </button>
            ) : (
              <div
                className="nav-link text-white-50 disabled-link py-2 px-2.5 rounded d-flex align-items-center justify-content-between"
                style={{ pointerEvents: 'none', opacity: 0.5 }}
              >
                <span className="d-flex align-items-center">
                  <MapPin className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Geofence &amp; GPS</span>
                </span>
                <Lock className="text-warning ms-auto shrink-0" style={{ width: '0.85rem', height: '0.85rem', color: '#f59e0b' }} />
              </div>
            )}

            {/* Admin Password Vault Modal Button */}
            {isAdmin && onOpenAdminVaultModal && (
              <button
                type="button"
                id="link-admin-vault-modal"
                onClick={() => {
                  onOpenAdminVaultModal();
                  onClose();
                }}
                className="nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full hover:bg-white/10"
              >
                <KeyRound className="me-2 shrink-0 text-amber-400" style={{ width: '1rem', height: '1rem' }} />
                <span>Password Vault</span>
              </button>
            )}

            {/* + Request New Staff Modal Button */}
            {isAdminOrManager && onOpenStaffRequestModal && (
              <button
                type="button"
                id="link-new-staff-modal"
                onClick={() => {
                  onOpenStaffRequestModal();
                  onClose();
                }}
                className="nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full hover:bg-white/10"
              >
                <UserPlus className="me-2 shrink-0 text-emerald-400" style={{ width: '1rem', height: '1rem' }} />
                <span>+ Request Staff</span>
              </button>
            )}

            {/* Duty & Shift Assignment */}
            {isAdminOrManager && onOpenDutyModal ? (
              <button
                type="button"
                id="link-shifts"
                onClick={() => {
                  onOpenDutyModal();
                  onClose();
                }}
                className="nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full hover:bg-white/10"
              >
                <Compass className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                <span>Duty &amp; Shift Assignment</span>
              </button>
            ) : !isAdminOrManager ? (
              <div
                className="nav-link text-white-50 disabled-link py-2 px-2.5 rounded d-flex align-items-center justify-content-between"
                style={{ pointerEvents: 'none', opacity: 0.5 }}
              >
                <span className="d-flex align-items-center">
                  <Compass className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Duty &amp; Shift Assignment</span>
                </span>
                <Lock className="text-warning ms-auto shrink-0" style={{ width: '0.85rem', height: '0.85rem', color: '#f59e0b' }} />
              </div>
            ) : null}

            {/* Staff Roster */}
            {isAdminOrManager && onOpenStaffModal ? (
              <button
                type="button"
                id="link-roster"
                onClick={() => {
                  onOpenStaffModal();
                  onClose();
                }}
                className="nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full hover:bg-white/10"
              >
                <Users className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                <span>Staff Roster ({staffCount})</span>
              </button>
            ) : !isAdminOrManager ? (
              <div
                className="nav-link text-white-50 disabled-link py-2 px-2.5 rounded d-flex align-items-center justify-content-between"
                style={{ pointerEvents: 'none', opacity: 0.5 }}
              >
                <span className="d-flex align-items-center">
                  <Users className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                  <span>Staff Roster</span>
                </span>
                <Lock className="text-warning ms-auto shrink-0" style={{ width: '0.85rem', height: '0.85rem', color: '#f59e0b' }} />
              </div>
            ) : null}

            {/* Punch Log History */}
            <button
              type="button"
              id="link-punch-log-history"
              onClick={() => {
                if (isAdminOrManager && onOpenDutyModal) {
                  onOpenDutyModal();
                } else {
                  handleLinkClick('portal');
                }
                onClose();
              }}
              className="nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full hover:bg-white/10"
            >
              <History className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
              <span>Punch Log History</span>
            </button>

            {/* Google Sheets Sync */}
            {isAdminOrManager && onOpenSheetsModal && (
              <button
                type="button"
                id="link-sync-sheets"
                onClick={() => {
                  onOpenSheetsModal();
                  onClose();
                }}
                className="nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full hover:bg-white/10"
              >
                <FileSpreadsheet className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                <span>Google Sheets Sync</span>
              </button>
            )}

            {/* PDF Document Preview */}
            {isAdminOrManager && onOpenPdfPreview && (
              <button
                type="button"
                id="link-pdf-preview"
                onClick={() => {
                  onOpenPdfPreview();
                  onClose();
                }}
                className="nav-link text-white py-2 px-2.5 rounded d-flex align-items-center cursor-pointer border-0 bg-transparent text-start w-full hover:bg-white/10"
              >
                <FileText className="me-2 shrink-0" style={{ width: '1rem', height: '1rem' }} />
                <span>PDF Document Preview</span>
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar Bottom Profile Badge */}
        <div className="border-top border-light-subtle pt-3 d-flex align-items-center justify-content-between gap-2 mt-4">
          <div className="d-flex align-items-center gap-2 overflow-hidden">
            <div
              className="bg-primary rounded-circle text-center fw-bold text-white shrink-0"
              style={{ width: '34px', height: '34px', lineHeight: '34px', fontSize: '0.875rem' }}
            >
              {userInitial}
            </div>
            <div className="lh-1 overflow-hidden">
              <div className="fw-bold small text-white truncate">{userName}</div>
              <small className="text-white-50 text-uppercase truncate block font-mono" style={{ fontSize: '0.65rem' }}>
                {currentUser?.staff_id ? `${currentUser.staff_id} • ` : ''}
                {isAdmin
                  ? 'ADMIN_OPERATIONS'
                  : isManager
                  ? 'OPERATIONS_MGR'
                  : 'STAFF_USER'}
              </small>
            </div>
          </div>
          <button
            type="button"
            id="btn-sidebar-logout"
            onClick={onLogout}
            title="Kill Session / Logout"
            className="text-white-50 hover:text-rose-400 p-1.5 rounded transition-colors bg-transparent border-0 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </>
  );
};
