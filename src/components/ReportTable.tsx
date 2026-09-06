import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, Clock, ChevronRight } from 'lucide-react';
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
    return summaryData
      .filter((item) => {
        const query = searchTerm.toLowerCase();
        return (
          item.staffId.toLowerCase().includes(query) ||
          item.staffName.toLowerCase().includes(query) ||
          item.department.toLowerCase().includes(query)
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
    <div className="bg-white rounded-xl shadow-sm border border-[#CBD5E1] overflow-hidden" id="report-table-container">
      {/* Card Header matching Geometric Balance */}
      <div className="p-6 border-b border-[#CBD5E1] bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-[#1E3A8A] text-base">
            Data Summary: {monthName}
          </h3>
          <span className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-bold uppercase">
            Live View
          </span>
        </div>

        {/* Search input in card header */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            id="input-search-staff"
            placeholder="Search staff ID or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-[#CBD5E1] bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-[#1E3A8A] focus:outline-hidden focus:ring-1 focus:ring-[#1E3A8A]"
          />
        </div>
      </div>

      {/* Styled Table matching Geometric Balance theme */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" id="table-monthly-report">
          <thead>
            <tr className="bg-[#1E3A8A] text-white text-xs uppercase tracking-wider">
              <th
                scope="col"
                onClick={() => handleSort('staffId')}
                className="px-6 py-4 font-bold border-r border-blue-700/50 cursor-pointer hover:bg-blue-900 transition-colors"
                style={{ width: '14%' }}
              >
                <div className="flex items-center gap-1.5">
                  <span>Staff ID</span>
                  <ArrowUpDown className="h-3 w-3 opacity-70" />
                </div>
              </th>

              <th
                scope="col"
                onClick={() => handleSort('staffName')}
                className="px-6 py-4 font-bold border-r border-blue-700/50 cursor-pointer hover:bg-blue-900 transition-colors"
                style={{ width: '28%' }}
              >
                <div className="flex items-center gap-1.5">
                  <span>Staff Name</span>
                  <ArrowUpDown className="h-3 w-3 opacity-70" />
                </div>
              </th>

              <th
                scope="col"
                onClick={() => handleSort('daysPresent')}
                className="px-6 py-4 font-bold border-r border-blue-700/50 text-center cursor-pointer hover:bg-blue-900 transition-colors"
                style={{ width: '14%' }}
              >
                <div className="inline-flex items-center justify-center gap-1.5">
                  <span>Days Present</span>
                  <ArrowUpDown className="h-3 w-3 opacity-70" />
                </div>
              </th>

              <th
                scope="col"
                onClick={() => handleSort('totalRegHours')}
                className="px-6 py-4 font-bold border-r border-blue-700/50 text-center cursor-pointer hover:bg-blue-900 transition-colors"
                style={{ width: '14%' }}
              >
                <div className="inline-flex items-center justify-center gap-1.5">
                  <span>Reg Hrs</span>
                  <ArrowUpDown className="h-3 w-3 opacity-70" />
                </div>
              </th>

              <th
                scope="col"
                onClick={() => handleSort('totalOtHours')}
                className="px-6 py-4 font-bold border-r border-blue-700/50 text-center cursor-pointer hover:bg-blue-900 transition-colors"
                style={{ width: '14%' }}
              >
                <div className="inline-flex items-center justify-center gap-1.5">
                  <span>OT Hrs</span>
                  <ArrowUpDown className="h-3 w-3 opacity-70" />
                </div>
              </th>

              <th
                scope="col"
                onClick={() => handleSort('grandTotalHours')}
                className="px-6 py-4 font-bold text-center cursor-pointer hover:bg-blue-900 transition-colors"
                style={{ width: '16%' }}
              >
                <div className="inline-flex items-center justify-center gap-1.5">
                  <span>Total Hrs</span>
                  <ArrowUpDown className="h-3 w-3 opacity-70" />
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="text-sm text-[#475569]">
            {filteredAndSortedData.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  No staff records found for {monthName} matching your search filter.
                </td>
              </tr>
            ) : (
              filteredAndSortedData.map((row, idx) => {
                const isEven = idx % 2 === 0;
                const rowBg = isEven ? 'bg-white' : 'bg-slate-50';

                return (
                  <tr
                    key={row.userId}
                    id={`staff-row-${row.userId}`}
                    onClick={() => onSelectStaff(row.userId)}
                    className={`${rowBg} border-b border-[#E2E8F0] cursor-pointer hover:bg-blue-50/60 transition-colors duration-150`}
                  >
                    {/* Staff ID */}
                    <td className="px-6 py-3 font-mono font-semibold text-[#1E3A8A]">
                      {row.staffId}
                    </td>

                    {/* Staff Name */}
                    <td className="px-6 py-3 font-medium text-slate-900">
                      <div className="flex items-center justify-between">
                        <div>
                          <span>{row.staffName}</span>
                          <span className="ml-2 text-xs text-slate-400">({row.department})</span>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>

                    {/* Days Present */}
                    <td className="px-6 py-3 text-center font-medium text-slate-800">
                      {row.daysPresent}
                    </td>

                    {/* Total Reg Hrs */}
                    <td className="px-6 py-3 text-center">
                      {row.totalRegHours.toFixed(1)} hrs
                    </td>

                    {/* Total OT Hrs (Orange in Geometric Balance theme) */}
                    <td className="px-6 py-3 text-center text-orange-600 font-medium">
                      {row.totalOtHours > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-orange-500" />
                          {row.totalOtHours.toFixed(1)} hrs
                        </span>
                      ) : (
                        <span>0.0 hrs</span>
                      )}
                    </td>

                    {/* Grand Total Hrs */}
                    <td className="px-6 py-3 text-center font-bold text-slate-900">
                      {row.grandTotalHours.toFixed(1)} hrs
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Table Footer Totals */}
          <tfoot>
            <tr className="border-t-2 border-[#CBD5E1] bg-slate-100 font-bold text-slate-900 text-sm">
              <td className="px-6 py-3.5 font-mono text-xs uppercase tracking-wider text-[#1E3A8A]">
                TOTAL
              </td>
              <td className="px-6 py-3.5">
                Staff Count: {filteredAndSortedData.length}
              </td>
              <td className="px-6 py-3.5 text-center text-[#1E3A8A]">
                {totalDaysPresent}
              </td>
              <td className="px-6 py-3.5 text-center">
                {totalRegHrs.toFixed(1)} hrs
              </td>
              <td className="px-6 py-3.5 text-center text-orange-600">
                {totalOtHrs.toFixed(1)} hrs
              </td>
              <td className="px-6 py-3.5 text-center text-[#1E3A8A]">
                {grandTotalHrs.toFixed(1)} hrs
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Card Footer matching Geometric Balance */}
      <div className="p-6 bg-slate-50 border-t border-[#CBD5E1] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 font-medium italic">
        <span>* Overtime calculation based on 8.0 hr daily baseline</span>
        <span>Report ID: {reportId}</span>
      </div>
    </div>
  );
};
