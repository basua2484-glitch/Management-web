import type { MonthlyStaffSummary, AttendanceRecord, StaffUser } from '../types';

export interface CreateSpreadsheetResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}

/**
 * Creates a formatted Housekeeping Attendance & OT Report spreadsheet in user's Google Drive.
 */
export async function exportToGoogleSheets(
  accessToken: string,
  monthName: string,
  summaryData: MonthlyStaffSummary[],
  users: StaffUser[],
  attendanceRecords: AttendanceRecord[]
): Promise<CreateSpreadsheetResult> {
  const spreadsheetTitle = `Housekeeping Monthly Attendance & OT Report - ${monthName}`;

  // 1. Create Spreadsheet with two tabs: Monthly Summary & Daily Punch Records
  const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: spreadsheetTitle,
      },
      sheets: [
        {
          properties: {
            sheetId: 0,
            title: 'Monthly Summary',
            gridProperties: {
              frozenRowCount: 3,
            },
          },
        },
        {
          properties: {
            sheetId: 1,
            title: 'Daily Attendance Logs',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!createResponse.ok) {
    const errorData = await createResponse.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to create Google Spreadsheet (HTTP ${createResponse.status})`
    );
  }

  const createdSheet = await createResponse.json();
  const spreadsheetId = createdSheet.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // 2. Prepare Monthly Summary Values matching the user's Python ReportLab structure
  const summaryValues = [
    ['Housekeeping Monthly Attendance & OT Report'],
    [`Summary Period: ${monthName}`, '', '', '', '', `Generated: ${new Date().toISOString().split('T')[0]}`],
    ['Staff ID', 'Staff Name', 'Days Present', 'Total Reg Hrs', 'Total OT Hrs', 'Grand Total Hrs'],
  ];

  let totalPresentDays = 0;
  let grandTotalReg = 0;
  let grandTotalOt = 0;
  let overallTotalHrs = 0;

  for (const s of summaryData) {
    totalPresentDays += s.daysPresent;
    grandTotalReg += s.totalRegHours;
    grandTotalOt += s.totalOtHours;
    overallTotalHrs += s.grandTotalHours;

    summaryValues.push([
      s.staffId,
      s.staffName,
      s.daysPresent.toString(),
      `${s.totalRegHours.toFixed(1)} hrs`,
      `${s.totalOtHours.toFixed(1)} hrs`,
      `${s.grandTotalHours.toFixed(1)} hrs`,
    ]);
  }

  // Summary total row
  summaryValues.push([
    'TOTAL',
    `Total Staff: ${summaryData.length}`,
    totalPresentDays.toString(),
    `${grandTotalReg.toFixed(1)} hrs`,
    `${grandTotalOt.toFixed(1)} hrs`,
    `${overallTotalHrs.toFixed(1)} hrs`,
  ]);

  // Append Summary Values
  const appendSummaryRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Monthly Summary'!A1:F${summaryValues.length}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: summaryValues,
      }),
    }
  );

  if (!appendSummaryRes.ok) {
    const err = await appendSummaryRes.json().catch(() => ({}));
    console.warn('Could not populate summary data:', err);
  }

  // 3. Prepare Daily Attendance Logs
  const userMap = new Map(users.map((u) => [u.id, u]));
  const dailyValues = [
    ['Date', 'Staff ID', 'Staff Name', 'Department', 'Shift', 'Punch In', 'Punch Out', 'Reg Hours', 'OT Hours', 'Status', 'Notes'],
  ];

  const sortedAttendance = [...attendanceRecords].sort((a, b) => a.date.localeCompare(b.date));
  for (const record of sortedAttendance) {
    const user = userMap.get(record.userId);
    dailyValues.push([
      record.date,
      user?.staffCode || `HK-${record.userId.toString().padStart(3, '0')}`,
      user?.name || `Staff #${record.userId}`,
      user?.department || 'Housekeeping',
      user?.shift || 'Morning',
      record.punchIn || '--:--',
      record.punchOut || '--:--',
      record.regularHours.toFixed(1),
      record.otHours.toFixed(1),
      record.status,
      record.notes || '',
    ]);
  }

  // Append Daily Values
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Daily Attendance Logs'!A1:K${dailyValues.length}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: dailyValues,
      }),
    }
  );

  // 4. BatchUpdate styling to replicate the ReportLab #1E3A8A visual style in Google Sheets
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          // Title formatting on row 0 (A1:F1)
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 6,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.118, green: 0.227, blue: 0.541 }, // #1E3A8A
                  horizontalAlignment: 'CENTER',
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    fontSize: 14,
                    bold: true,
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          // Merge Title row A1:F1
          {
            mergeCells: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 6,
              },
              mergeType: 'MERGE_ALL',
            },
          },
          // Table header formatting on row 2 (A3:F3) (#1E3A8A, white bold text)
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 2,
                endRowIndex: 3,
                startColumnIndex: 0,
                endColumnIndex: 6,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.118, green: 0.227, blue: 0.541 }, // #1E3A8A
                  horizontalAlignment: 'CENTER',
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    fontSize: 10,
                    bold: true,
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          // Total row formatting at the bottom of Monthly Summary
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: summaryValues.length - 1,
                endRowIndex: summaryValues.length,
                startColumnIndex: 0,
                endColumnIndex: 6,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.945, green: 0.961, blue: 0.976 }, // Slate 100
                  horizontalAlignment: 'CENTER',
                  textFormat: {
                    bold: true,
                    fontSize: 10,
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          // Daily Attendance Header row styling (#1E3A8A)
          {
            repeatCell: {
              range: {
                sheetId: 1,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 11,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.118, green: 0.227, blue: 0.541 },
                  horizontalAlignment: 'CENTER',
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    fontSize: 10,
                    bold: true,
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          // Auto-resize columns on both sheets
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 6,
              },
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 1,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 11,
              },
            },
          },
        ],
      }),
    });
  } catch (styleErr) {
    console.warn('Minor styling issue on Google Sheets formatting:', styleErr);
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
    title: spreadsheetTitle,
  };
}
