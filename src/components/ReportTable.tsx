import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, ChevronRight } from 'lucide-react';
import type { MonthlyStaffSummary } from '../types';

interface ReportTableProps {
  summaryData: MonthlyStaffSummary[];
  monthName: string;
  year: number;
  month: number;
  onSelectStaff: (staffId: number) => void;
}

type SortField = 'staffId' | 'staffName' | 'daysPresent' | 'totalRegHours' | 'totalOtHours' | 'grandTotalHours';
type SortOrder = 'asc' | 'desc';

export const ReportTable: React.FC<ReportTableProps> = ({
  summaryData,
  monthName,
  year,
  month,
  onSelectStaff,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('staffId');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Filter and sort
  const filteredAndSortedData = useMemo(() => {
    const query = (searchTerm || '').toLowerCase();
    return summaryData
      .filter((item) => {
        return (
          (item.staffId || '').toLowerCase().includes(query) ||
          (item.staffName || '').toLowerCase().includes(query) ||
          (item.department || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }

        return 0;
      });
  }, [summaryData, searchTerm, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'staffId' || field === 'staffName' ? 'asc' : 'desc');
    }
  };

  const totalDaysPresent = filteredAndSortedData.reduce((acc, s) => acc + s.daysPresent, 0);
  const totalRegHrs = filteredAndSortedData.reduce((acc, s) => acc + s.totalRegHours, 0);
  const totalOtHrs = filteredAndSortedData.reduce((acc, s) => acc + s.totalOtHours, 0);
  const grandTotalHrs = totalRegHrs + totalOtHrs;

  const reportId = `GEN-${year}${month.toString().padStart(2, '0')}-HB-102`;

  return (
    <div
      className="rounded-xl shadow-xs bg-white border border-slate-200 p-5 sm:p-6 font-sans text-slate-800"
      id="report-table-container"
    >
      {/* Search Header Container */}
      <div className="relative mb-5">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-blue-600" />
          <input
            type="text"
            id="input-search-staff"
            placeholder="Search staff by ID, full name, or assigned ward..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg py-2.5 pl-10 pr-4 text-xs sm:text-sm transition-all bg-slate-50 border border-slate-200 font-sans text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 text-xs font-semibold text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              [Clear]
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-1 text-2xs uppercase tracking-wider mt-2 px-1 text-slate-500 font-sans">
          <span className="font-semibold">
            Report Period: {monthName} {year}
          </span>
          <span className="font-semibold">
            Showing {filteredAndSortedData.length} Staff Member{filteredAndSortedData.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Styled Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans text-xs" id="table-monthly-report">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <th
                scope="col"
                onClick={() => handleSort('staffId')}
                className="px-3 py-2.5 cursor-pointer font-bold uppercase tracking-wider text-2xs whitespace-nowrap min-w-[80px] text-slate-600 hover:text-blue-700"
              >
                <div className="flex items-center gap-1">
                  <span>Staff ID</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>

              <th
                scope="col"
                onClick={() => handleSort('staffName')}
                className="px-3 py-2.5 cursor-pointer font-bold uppercase tracking-wider text-2xs whitespace-nowrap min-w-[140px] text-slate-600 hover:text-blue-700"
              >
                <div className="flex items-center gap-1">
                  <span>Staff Name &amp; Area</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>

              <th
                scope="col"
                onClick={() => handleSort('daysPresent')}
                className="px-3 py-2.5 text-center cursor-pointer font-bold uppercase tracking-wider text-2xs whitespace-nowrap min-w-[50px] text-slate-600 hover:text-blue-700"
              >
                <div className="inline-flex items-center justify-center gap-1">
                  <span>Present</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>

              <th
                scope="col"
                onClick={() => handleSort('totalRegHours')}
                className="px-3 py-2.5 text-center cursor-pointer font-bold uppercase tracking-wider text-2xs whitespace-nowrap min-w-[60px] text-slate-600 hover:text-blue-700"
              >
                <div className="inline-flex items-center justify-center gap-1">
                  <span>Reg Hrs</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>

              <th
                scope="col"
                onClick={() => handleSort('totalOtHours')}
                className="px-3 py-2.5 text-center cursor-pointer font-bold uppercase tracking-wider text-2xs whitespace-nowrap min-w-[60px] text-amber-700 hover:text-amber-800"
              >
                <div className="inline-flex items-center justify-center gap-1">
                  <span>OT Hrs (8h+)</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>

              <th
                scope="col"
                onClick={() => handleSort('grandTotalHours')}
                className="px-3 py-2.5 text-center cursor-pointer font-bold uppercase tracking-wider text-2xs whitespace-nowrap min-w-[60px] text-blue-900 hover:text-blue-950"
              >
                <div className="inline-flex items-center justify-center gap-1">
                  <span>Total Hrs</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="text-xs text-slate-800 divide-y divide-slate-100">
            {filteredAndSortedData.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center bg-slate-50 text-slate-400">
                  No staff records matching filter for {monthName}.
                </td>
              </tr>
            ) : (
              filteredAndSortedData.map((row) => (
                <tr
                  key={row.userId}
                  onClick={() => onSelectStaff(row.userId)}
                  className="group cursor-pointer transition-colors hover:bg-blue-50/70"
                  title="Click to view daily punch ledger"
                >
                  {/* STAFF_ID */}
                  <td className="px-3 py-2.5 font-mono font-bold whitespace-nowrap text-[#1a3a8a]">
                    {row.staffId}
                  </td>

                  {/* NAME_REF */}
                  <td className="px-3 py-2.5 text-slate-900 font-medium">
                    <div className="flex items-center justify-between gap-1">
                      <div className="min-w-0">
                        <span className="font-semibold whitespace-nowrap">{row.staffName}</span>
                        <span className="text-3xs uppercase tracking-wider block sm:inline sm:ml-2 truncate max-w-[150px] sm:max-w-none text-slate-500 font-normal">
                          • {row.department}
                        </span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block text-blue-600" />
                    </div>
                  </td>

                  {/* DAYS */}
                  <td className="px-3 py-2.5 text-center font-bold whitespace-nowrap text-slate-800">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs">
                      {row.daysPresent}
                    </span>
                  </td>

                  {/* REG_H */}
                  <td className="px-3 py-2.5 text-center font-mono whitespace-nowrap text-slate-600">
                    {row.totalRegHours.toFixed(1)}h
                  </td>

                  {/* OT_H */}
                  <td className="px-3 py-2.5 text-center font-mono font-bold whitespace-nowrap text-amber-700">
                    {row.totalOtHours > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100/80 text-amber-800 text-xs font-bold">
                        +{row.totalOtHours.toFixed(1)}h
                      </span>
                    ) : (
                      `${row.totalOtHours.toFixed(1)}h`
                    )}
                  </td>

                  {/* TOTAL */}
                  <td className="px-3 py-2.5 text-center font-mono font-extrabold whitespace-nowrap text-[#1a3a8a]">
                    {row.grandTotalHours.toFixed(1)}h
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* Table Footer Totals */}
          {filteredAndSortedData.length > 0 && (
            <tfoot>
              <tr className="font-bold text-xs uppercase tracking-wider border-t-2 border-slate-200 bg-slate-50 text-slate-800">
                <td className="px-3 py-2.5 whitespace-nowrap font-bold">
                  TOTAL
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                  {filteredAndSortedData.length} Staff Records
                </td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap font-extrabold">
                  {totalDaysPresent}
                </td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap text-slate-700">
                  {totalRegHrs.toFixed(1)}h
                </td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap text-amber-700 font-extrabold">
                  +{totalOtHrs.toFixed(1)}h
                </td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap text-blue-900 font-black">
                  {grandTotalHrs.toFixed(1)}h
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Card Footer */}
      <div className="mt-4 pt-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-2xs border-slate-200 text-slate-500 font-sans">
        <span>Baseline shift standard: 8.0 hrs/day • Overtime trigger: &gt; 8.0 hrs</span>
        <span className="font-mono">Report ID: {reportId}</span>
      </div>
    </div>
  );
};
