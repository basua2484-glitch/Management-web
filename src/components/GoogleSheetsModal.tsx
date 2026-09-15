import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  Copy,
  Check,
} from 'lucide-react';
import type { MonthlyStaffSummary, StaffUser, AttendanceRecord } from '../types';
import { googleSignIn, getAccessToken } from '../services/firebase';
import {
  exportToGoogleSheets,
  syncToExistingGoogleSheet,
  extractSpreadsheetId,
  type CreateSpreadsheetResult,
} from '../services/googleSheets';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthName: string;
  summaryData: MonthlyStaffSummary[];
  users: StaffUser[];
  attendanceRecords: AttendanceRecord[];
  currentUserEmail?: string | null;
  onLoginSuccess: (email: string) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  monthName,
  summaryData,
  users,
  attendanceRecords,
  currentUserEmail,
  onLoginSuccess,
}) => {
  const [syncMode, setSyncMode] = useState<'create' | 'existing'>('create');
  const [existingSheetInput, setExistingSheetInput] = useState('');
  const [showConfirmOverwrite, setShowConfirmOverwrite] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<CreateSpreadsheetResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      const res = await googleSignIn();
      if (res?.user?.email) {
        onLoginSuccess(res.user.email);
      }
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      setErrorMessage(err.message || 'Google sign-in was cancelled or failed.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleStartExport = async () => {
    if (syncMode === 'existing') {
      const sheetId = extractSpreadsheetId(existingSheetInput);
      if (!sheetId) {
        setErrorMessage('Please enter a valid Google Spreadsheet URL or ID.');
        return;
      }
      // Mandatory explicit confirmation dialog for modifying existing sheet data
      setShowConfirmOverwrite(true);
      return;
    }

    await executeSync(false);
  };

  const executeSync = async (isExisting: boolean) => {
    setIsExporting(true);
    setErrorMessage(null);
    setExportResult(null);

    try {
      let token = await getAccessToken();
      if (!token) {
        // Prompt sign in
        const authRes = await googleSignIn();
        token = authRes.accessToken;
        if (authRes.user?.email) {
          onLoginSuccess(authRes.user.email);
        }
      }

      if (!token) {
        throw new Error('Authentication is required to sync with Google Sheets.');
      }

      let result: CreateSpreadsheetResult;
      if (isExisting) {
        result = await syncToExistingGoogleSheet(
          token,
          existingSheetInput,
          monthName,
          summaryData,
          users,
          attendanceRecords
        );
      } else {
        result = await exportToGoogleSheets(
          token,
          monthName,
          summaryData,
          users,
          attendanceRecords
        );
      }

      setExportResult(result);
      setShowConfirmOverwrite(false);
    } catch (err: any) {
      console.error('Export/Sync error:', err);
      setErrorMessage(
        err.message || 'An error occurred while communicating with the Google Sheets API.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyLink = () => {
    if (exportResult?.spreadsheetUrl) {
      navigator.clipboard.writeText(exportResult.spreadsheetUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleClose = () => {
    if (isExporting) return;
    setErrorMessage(null);
    setExportResult(null);
    setShowConfirmOverwrite(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      id="modal-google-sheets"
    >
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Google Sheets Attendance Sync</h2>
              <p className="text-2xs text-slate-500 font-medium">Period: {monthName}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isExporting}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {exportResult ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-5 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-emerald-900">
                {exportResult.isNew ? 'Spreadsheet Created Successfully!' : 'Spreadsheet Synced Successfully!'}
              </h3>
              <p className="text-xs text-emerald-700 max-w-sm mx-auto">
                Attendance summary for <strong>{summaryData.length} staff members</strong> and{' '}
                <strong>{attendanceRecords.length} punch records</strong> have been synced to Google Sheets.
              </p>

              <div className="pt-2 flex flex-wrap justify-center gap-2.5">
                <a
                  href={exportResult.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition-colors"
                >
                  <span>Open in Google Sheets</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied Link</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-500" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : showConfirmOverwrite ? (
            /* Explicit Confirmation for Modifying Existing User Spreadsheet Data */
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-900">Confirm Spreadsheet Overwrite</h4>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    You are about to sync current attendance records into spreadsheet ID:{' '}
                    <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-2xs font-semibold">
                      {extractSpreadsheetId(existingSheetInput)}
                    </code>.
                  </p>
                  <p className="text-xs text-amber-800 mt-1.5 leading-relaxed">
                    This will update and replace the contents of the <strong>&lsquo;Monthly Summary&rsquo;</strong> and{' '}
                    <strong>&lsquo;Daily Attendance Logs&rsquo;</strong> tabs with the latest {monthName} data.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-amber-200">
                <button
                  type="button"
                  onClick={() => setShowConfirmOverwrite(false)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => executeSync(true)}
                  disabled={isExporting}
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 shadow-xs cursor-pointer"
                >
                  {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>Confirm &amp; Sync</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Sync Mode Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setSyncMode('create');
                    setErrorMessage(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md transition-all cursor-pointer ${
                    syncMode === 'create'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <PlusCircle className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Create New Sheet</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSyncMode('existing');
                    setErrorMessage(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md transition-all cursor-pointer ${
                    syncMode === 'existing'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
                  <span>Sync Existing Sheet</span>
                </button>
              </div>

              {/* Mode 1: Create New Sheet Overview */}
              {syncMode === 'create' ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">
                    A new Google Sheet will be created in your Google Drive:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600 text-2xs">
                    <li>
                      <strong>Title:</strong> Housekeeping Monthly Attendance &amp; OT Report - {monthName}
                    </li>
                    <li>
                      <strong>Tab 1 (Monthly Summary):</strong> {summaryData.length} staff records (ID, Name, Days Present, Reg Hrs, OT Hrs, Grand Total) with standard #1E3A8A header formatting.
                    </li>
                    <li>
                      <strong>Tab 2 (Daily Attendance Logs):</strong> {attendanceRecords.length} daily punch-in/out records with shift and status notes.
                    </li>
                  </ul>
                </div>
              ) : (
                /* Mode 2: Sync to Existing Sheet Input */
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs text-slate-700">
                  <label htmlFor="input-existing-sheet" className="font-semibold text-slate-900 block">
                    Google Spreadsheet URL or Sheet ID:
                  </label>
                  <input
                    type="text"
                    id="input-existing-sheet"
                    placeholder="https://docs.google.com/spreadsheets/d/... or ID"
                    value={existingSheetInput}
                    onChange={(e) => setExistingSheetInput(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                  />
                  <p className="text-2xs text-slate-500">
                    The app will update or create the &lsquo;Monthly Summary&rsquo; and &lsquo;Daily Attendance Logs&rsquo; tabs in this workbook.
                  </p>
                </div>
              )}

              {/* Authentication Status / GSI Button */}
              {!currentUserEmail ? (
                <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-[#1E3A8A] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Google Account Connection</h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Connect your Google account with permission to sync attendance spreadsheets.
                      </p>
                    </div>
                  </div>

                  <div className="pt-1 flex justify-center">
                    <button
                      type="button"
                      id="btn-google-signin-modal"
                      onClick={handleGoogleLogin}
                      disabled={isAuthenticating}
                      className="inline-flex items-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] disabled:opacity-50 cursor-pointer"
                    >
                      <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        className="h-4 w-4"
                      >
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                        <path fill="none" d="M0 0h48v48H0z" />
                      </svg>
                      <span>{isAuthenticating ? 'Connecting...' : 'Sign in with Google'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 truncate">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">
                      Connected: <strong>{currentUserEmail}</strong>
                    </span>
                  </div>
                  <span className="text-emerald-700 font-medium text-2xs shrink-0 ml-2">
                    Permission Active
                  </span>
                </div>
              )}

              {/* Error Display */}
              {errorMessage && (
                <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <button
            type="button"
            onClick={handleClose}
            disabled={isExporting}
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            {exportResult ? 'Close' : 'Cancel'}
          </button>

          {!exportResult && !showConfirmOverwrite && (
            <button
              type="button"
              id="btn-confirm-sheets-export"
              onClick={handleStartExport}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{syncMode === 'existing' ? 'Syncing Spreadsheet...' : 'Creating Spreadsheet...'}</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>{syncMode === 'existing' ? 'Review & Sync to Sheet' : 'Export to Google Sheet'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
