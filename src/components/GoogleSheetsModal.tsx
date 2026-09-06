import React, { useState } from 'react';
import { X, FileSpreadsheet, ExternalLink, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import type { MonthlyStaffSummary, StaffUser, AttendanceRecord } from '../types';
import { googleSignIn, getAccessToken } from '../services/firebase';
import { exportToGoogleSheets, type CreateSpreadsheetResult } from '../services/googleSheets';

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
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<CreateSpreadsheetResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleExport = async () => {
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
        throw new Error('Authentication is required to export to Google Sheets.');
      }

      const result = await exportToGoogleSheets(
        token,
        monthName,
        summaryData,
        users,
        attendanceRecords
      );

      setExportResult(result);
    } catch (err: any) {
      console.error('Export error:', err);
      setErrorMessage(
        err.message || 'An error occurred while creating the spreadsheet in Google Sheets.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    if (isExporting) return;
    setErrorMessage(null);
    setExportResult(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      id="modal-google-sheets"
    >
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-900">Export to Google Sheets</h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isExporting}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {exportResult ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-5 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-emerald-900">
                Spreadsheet Created Successfully!
              </h3>
              <p className="text-xs text-emerald-700 max-w-sm mx-auto">
                Your monthly report with <strong>{summaryData.length} staff summaries</strong> and{' '}
                <strong>{attendanceRecords.length} daily logs</strong> has been formatted and saved to your Google Sheets.
              </p>

              <div className="pt-2">
                <a
                  href={exportResult.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800"
                >
                  <span>Open in Google Sheets</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* Operation details */}
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  You are about to export this monthly report to Google Sheets:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
                  <li>
                    <strong>Spreadsheet Title:</strong> Housekeeping Monthly Attendance & OT Report - {monthName}
                  </li>
                  <li>
                    <strong>Tab 1 (Monthly Summary):</strong> {summaryData.length} staff records (ID, Name, Days Present, Reg Hrs, OT Hrs, Grand Total) with #1E3A8A header formatting.
                  </li>
                  <li>
                    <strong>Tab 2 (Daily Attendance Logs):</strong> Full punch-in/out timestamps and overtime notes for audit.
                  </li>
                </ul>
              </div>

              {/* Authentication Status / GSI Button */}
              {!currentUserEmail ? (
                <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-[#1E3A8A] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Google Account Required</h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Sign in to grant permission to create this spreadsheet in your Google Sheets account.
                      </p>
                    </div>
                  </div>

                  {/* Standard GSI Material Button from workspace skill */}
                  <div className="pt-1 flex justify-center">
                    <button
                      type="button"
                      id="btn-google-signin-modal"
                      onClick={handleGoogleLogin}
                      disabled={isAuthenticating}
                      className="inline-flex items-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] disabled:opacity-50"
                    >
                      <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        className="h-5 w-5"
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
                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Signed in as: <strong>{currentUserEmail}</strong></span>
                  </div>
                  <span className="text-slate-500 text-2xs">Sheets permission granted</span>
                </div>
              )}

              {/* Error state */}
              {errorMessage && (
                <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4 rounded-b-xl">
          <button
            type="button"
            onClick={handleClose}
            disabled={isExporting}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50"
          >
            {exportResult ? 'Close' : 'Cancel'}
          </button>

          {!exportResult && (
            <button
              type="button"
              id="btn-confirm-sheets-export"
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-60"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating Spreadsheet...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Confirm & Export to Sheets</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
