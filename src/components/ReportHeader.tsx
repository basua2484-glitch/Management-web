import React from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  PlusCircle,
  Users,
  Eye,
  Clock,
  Briefcase
} from 'lucide-react';
import type { MonthlyStaffSummary } from '../types';

interface ReportHeaderProps {
  year: number;
  month: number;
  monthName: string;
  onMonthChange: (year: number, month: number) => void;
  summaryData: MonthlyStaffSummary[];
  onDownloadPdf: () => void;
  onPreviewPdf: () => void;
  onOpenSheetsModal: () => void;
  onOpenPunchModal: () => void;
  onOpenStaffModal: () => void;
  googleUserEmail?: string | null;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({
  year,
  month,
  monthName,
  onMonthChange,
  summaryData,
  onDownloadPdf,
  onPreviewPdf,
  onOpenSheetsModal,
  onOpenPunchModal,
  onOpenStaffModal,
  googleUserEmail,
}) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    if (month === 1) {
      onMonthChange(year - 1, 12);
    } else {
      onMonthChange(year, month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      onMonthChange(year + 1, 1);
    } else {
      onMonthChange(year, month + 1);
    }
  };

  // Aggregated totals
  const totalStaffCount = summaryData.length;
  const totalPresentDays = summaryData.reduce((acc, s) => acc + s.daysPresent, 0);
  const totalRegHrs = summaryData.reduce((acc, s) => acc + s.totalRegHours, 0);
  const totalOtHrs = summaryData.reduce((acc, s) => acc + s.totalOtHours, 0);
  const grandTotalHrs = totalRegHrs + totalOtHrs;

  return (
    <header className="border-b border-slate-200 bg-white" id="report-header">
      {/* Top Bar: Title & Primary Actions */}
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E3A8A] text-white shadow-xs">
                <Briefcase className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-[#1E3A8A] tracking-tight sm:text-2xl">
                  Housekeeping Monthly Attendance & OT Report
                </h1>
                <p className="text-sm text-slate-500">
                  Summary Period: <span className="font-semibold text-slate-700">{monthName}</span> • Generated on: {new Date().toISOString().split('T')[0]}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              id="btn-log-attendance"
              onClick={onOpenPunchModal}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A]"
            >
              <PlusCircle className="h-4 w-4 text-slate-500" />
              <span>Log Punch / OT</span>
            </button>

            <button
              type="button"
              id="btn-manage-staff"
              onClick={onOpenStaffModal}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A]"
            >
              <Users className="h-4 w-4 text-slate-500" />
              <span>Staff Roster</span>
            </button>

            <button
              type="button"
              id="btn-preview-pdf"
              onClick={onPreviewPdf}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A]"
            >
              <Eye className="h-4 w-4 text-slate-500" />
              <span>PDF Preview</span>
            </button>

            <button
              type="button"
              id="btn-download-pdf"
              onClick={onDownloadPdf}
              className="inline-flex items-center gap-2 rounded-md bg-[#1E3A8A] px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-900 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] focus:ring-offset-2"
            >
              <Download className="h-4 w-4" />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              id="btn-export-google-sheets"
              onClick={onOpenSheetsModal}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export to Google Sheets</span>
            </button>
          </div>
        </div>

        {/* Date Controls & Aggregate Stats */}
        <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Period Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 p-1 shadow-2xs">
              <button
                type="button"
                id="btn-prev-month"
                onClick={handlePrevMonth}
                aria-label="Previous Month"
                className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 focus:outline-hidden"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 px-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                <select
                  id="select-month"
                  value={month}
                  onChange={(e) => onMonthChange(year, parseInt(e.target.value, 10))}
                  aria-label="Select month"
                  className="rounded border-0 bg-transparent text-sm font-semibold text-slate-800 focus:ring-0"
                >
                  {months.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  id="select-year"
                  value={year}
                  onChange={(e) => onMonthChange(parseInt(e.target.value, 10), month)}
                  aria-label="Select year"
                  className="rounded border-0 bg-transparent text-sm font-semibold text-slate-800 focus:ring-0"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                id="btn-next-month"
                onClick={handleNextMonth}
                aria-label="Next Month"
                className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 focus:outline-hidden"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {googleUserEmail && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-[#1E3A8A]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected: {googleUserEmail}
              </span>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-5">
            <div className="rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2">
              <span className="text-xs font-medium text-slate-500">Staff Count</span>
              <p className="text-base font-bold text-slate-800">{totalStaffCount}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2">
              <span className="text-xs font-medium text-slate-500">Days Present</span>
              <p className="text-base font-bold text-[#1E3A8A]">{totalPresentDays}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2">
              <span className="text-xs font-medium text-slate-500">Total Regular</span>
              <p className="text-base font-bold text-slate-800">{totalRegHrs.toFixed(1)} hrs</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-amber-50/60 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-800">Total OT</span>
                <Clock className="h-3 w-3 text-amber-600" />
              </div>
              <p className="text-base font-bold text-amber-700">{totalOtHrs.toFixed(1)} hrs</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
