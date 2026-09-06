import React from 'react';
import { X, Download, Printer, FileText } from 'lucide-react';
import type { MonthlyStaffSummary } from '../types';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  monthName: string;
  summaryData: MonthlyStaffSummary[];
  onDownloadPdf: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  onClose,
  year,
  month,
  monthName,
  summaryData,
  onDownloadPdf,
}) => {
  if (!isOpen) return null;

  const totalDaysPresent = summaryData.reduce((acc, s) => acc + s.daysPresent, 0);
  const totalRegHrs = summaryData.reduce((acc, s) => acc + s.totalRegHours, 0);
  const totalOtHrs = summaryData.reduce((acc, s) => acc + s.totalOtHours, 0);
  const grandTotalHrs = totalRegHrs + totalOtHrs;
  const generatedDate = new Date().toISOString().split('T')[0];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs print:p-0 print:bg-white"
      id="modal-pdf-preview"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl print:shadow-none print:max-h-none print:w-full">
        {/* Header (hidden in print) */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-[#1E3A8A]">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Landscape Report Document Preview
              </h2>
              <p className="text-xs text-slate-500">
                Exact replica of ReportLab PDF generation layout (Letter Landscape)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onDownloadPdf}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1E3A8A] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-900"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable / Preview Document Canvas */}
        <div className="flex-1 overflow-y-auto bg-slate-200/60 p-6 print:bg-white print:p-0">
          <div className="mx-auto max-w-[900px] rounded-lg border border-slate-300 bg-white p-8 shadow-sm print:border-none print:shadow-none print:p-4">
            {/* Title & Subtitle matching ReportLab style */}
            <div className="mb-4">
              <h1 className="text-xl font-bold text-[#1E3A8A] font-sans">
                Housekeeping Monthly Attendance & OT Report
              </h1>
              <p className="text-xs text-[#475569] mt-1 font-sans">
                Summary Period: <strong className="font-bold text-slate-800">{monthName}</strong> | Generated on: {generatedDate}
              </p>
            </div>

            {/* Document Table */}
            <div className="overflow-hidden border border-[#CBD5E1]">
              <table className="w-full border-collapse font-sans text-xs">
                <thead>
                  <tr className="bg-[#1E3A8A] text-white">
                    <th className="border border-[#CBD5E1] p-2 text-center font-bold" style={{ width: '12%' }}>
                      Staff ID
                    </th>
                    <th className="border border-[#CBD5E1] p-2 text-left font-bold" style={{ width: '28%' }}>
                      Staff Name
                    </th>
                    <th className="border border-[#CBD5E1] p-2 text-center font-bold" style={{ width: '15%' }}>
                      Days Present
                    </th>
                    <th className="border border-[#CBD5E1] p-2 text-center font-bold" style={{ width: '15%' }}>
                      Total Reg Hrs
                    </th>
                    <th className="border border-[#CBD5E1] p-2 text-center font-bold" style={{ width: '15%' }}>
                      Total OT Hrs
                    </th>
                    <th className="border border-[#CBD5E1] p-2 text-center font-bold" style={{ width: '15%' }}>
                      Grand Total Hrs
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.map((row, idx) => (
                    <tr
                      key={row.userId}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}
                    >
                      <td className="border border-[#CBD5E1] p-2 text-center font-mono font-medium">
                        {row.staffId}
                      </td>
                      <td className="border border-[#CBD5E1] p-2 text-left text-slate-800">
                        {row.staffName}
                      </td>
                      <td className="border border-[#CBD5E1] p-2 text-center">
                        {row.daysPresent}
                      </td>
                      <td className="border border-[#CBD5E1] p-2 text-center">
                        {row.totalRegHours.toFixed(1)} hrs
                      </td>
                      <td className="border border-[#CBD5E1] p-2 text-center">
                        {row.totalOtHours.toFixed(1)} hrs
                      </td>
                      <td className="border border-[#CBD5E1] p-2 text-center font-semibold text-[#1E3A8A]">
                        {row.grandTotalHours.toFixed(1)} hrs
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-[#CBD5E1]">
                    <td className="border border-[#CBD5E1] p-2 text-center">TOTAL</td>
                    <td className="border border-[#CBD5E1] p-2 text-left">{summaryData.length} Staff</td>
                    <td className="border border-[#CBD5E1] p-2 text-center text-[#1E3A8A]">{totalDaysPresent}</td>
                    <td className="border border-[#CBD5E1] p-2 text-center">{totalRegHrs.toFixed(1)} hrs</td>
                    <td className="border border-[#CBD5E1] p-2 text-center">{totalOtHrs.toFixed(1)} hrs</td>
                    <td className="border border-[#CBD5E1] p-2 text-center text-[#1E3A8A]">{grandTotalHrs.toFixed(1)} hrs</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Document Footer */}
            <div className="mt-6 flex items-center justify-between text-2xs text-slate-400 border-t border-slate-100 pt-3">
              <span>Housekeeping Dept Management System</span>
              <span>Generated via ReportLab PDF Engine • Filename: Housekeeping_Monthly_Report_{year}_{month.toString().padStart(2, '0')}.pdf</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
