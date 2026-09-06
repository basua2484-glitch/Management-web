import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { MonthlyStaffSummary } from '../types';

export interface PDFExportOptions {
  year: number;
  month: number;
  monthName: string;
  summaryData: MonthlyStaffSummary[];
  generatedDate?: string;
}

/**
 * Generates the Housekeeping Monthly Attendance & OT Report PDF
 * mirroring the exact ReportLab Python specifications provided.
 */
export function generateMonthlyReportPdf(options: PDFExportOptions): jsPDF {
  const { year, month, monthName, summaryData, generatedDate = new Date().toISOString().split('T')[0] } = options;

  // Letter landscape: 11 x 8.5 inches = 792 x 612 pt
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'letter',
  });

  const leftMargin = 30;
  const topMargin = 38;

  // 1. Title: Helvetica-Bold, 18pt, #1E3A8A
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 58, 138); // #1E3A8A
  doc.text('Housekeeping Monthly Attendance & OT Report', leftMargin, topMargin);

  // 2. Subtitle: Helvetica, 11pt, #475569
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105); // #475569
  doc.text(`Summary Period: ${monthName}   |   Generated on: ${generatedDate}`, leftMargin, topMargin + 18);

  // 3. Prepare Table Data
  const headers = [['Staff ID', 'Staff Name', 'Days Present', 'Total Reg Hrs', 'Total OT Hrs', 'Grand Total Hrs']];

  let totalDaysPresent = 0;
  let totalRegHrs = 0;
  let totalOtHrs = 0;
  let grandTotalHrs = 0;

  const body = summaryData.map((s) => {
    totalDaysPresent += s.daysPresent;
    totalRegHrs += s.totalRegHours;
    totalOtHrs += s.totalOtHours;
    grandTotalHrs += s.grandTotalHours;

    return [
      s.staffId,
      s.staffName,
      s.daysPresent.toString(),
      `${s.totalRegHours.toFixed(1)} hrs`,
      `${s.totalOtHours.toFixed(1)} hrs`,
      `${s.grandTotalHours.toFixed(1)} hrs`,
    ];
  });

  // Footer / Total Row
  const foot = [
    [
      'TOTAL',
      `${summaryData.length} Staff Member${summaryData.length === 1 ? '' : 's'}`,
      totalDaysPresent.toString(),
      `${totalRegHrs.toFixed(1)} hrs`,
      `${totalOtHrs.toFixed(1)} hrs`,
      `${grandTotalHrs.toFixed(1)} hrs`,
    ],
  ];

  // Table Layout & Styling matching ReportLab TableStyle:
  // colWidths: [80, 180, 100, 110, 110, 120] -> sum = 700 pt
  // Letter landscape width is 792 pt, margins 30 on each side = 732 pt printable
  autoTable(doc, {
    startY: topMargin + 32,
    margin: { left: 30, right: 30, bottom: 30 },
    head: headers,
    body: body,
    foot: foot,
    theme: 'plain',
    headStyles: {
      fillColor: [30, 58, 138], // #1E3A8A
      textColor: [255, 255, 255],
      font: 'helvetica',
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
      valign: 'middle',
      cellPadding: 7,
    },
    bodyStyles: {
      font: 'helvetica',
      fontStyle: 'normal',
      fontSize: 9.5,
      textColor: [30, 41, 59], // Slate 800
      halign: 'center',
      valign: 'middle',
      cellPadding: 6,
      lineColor: [203, 213, 225], // #CBD5E1
      lineWidth: 0.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // #F8FAFC
    },
    footStyles: {
      fillColor: [241, 245, 249], // #F1F5F9
      textColor: [30, 58, 138],
      font: 'helvetica',
      fontStyle: 'bold',
      fontSize: 9.5,
      halign: 'center',
      valign: 'middle',
      cellPadding: 7,
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold' }, // Staff ID
      1: { cellWidth: 180, halign: 'left' }, // Staff Name (left align for readability)
      2: { cellWidth: 100 }, // Days Present
      3: { cellWidth: 110 }, // Total Reg Hrs
      4: { cellWidth: 110 }, // Total OT Hrs
      5: { cellWidth: 120, fontStyle: 'bold' }, // Grand Total Hrs
    },
    didDrawPage: (data) => {
      // Footer page numbering
      const pageCount = doc.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(
        `Housekeeping Dept • Page ${data.pageNumber} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 16,
        { align: 'center' }
      );
    },
  });

  return doc;
}

/**
 * Generates and triggers browser download of the PDF
 */
export function downloadMonthlyReportPdf(options: PDFExportOptions): void {
  const doc = generateMonthlyReportPdf(options);
  const monthStr = options.month.toString().padStart(2, '0');
  const filename = `Housekeeping_Monthly_Report_${options.year}_${monthStr}.pdf`;
  doc.save(filename);
}

/**
 * Returns a Blob URL for instant iframe or in-page preview
 */
export function getMonthlyReportPdfBlobUrl(options: PDFExportOptions): string {
  const doc = generateMonthlyReportPdf(options);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}
