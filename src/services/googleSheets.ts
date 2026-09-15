import type { MonthlyStaffSummary, AttendanceRecord, StaffUser } from '../types';

export interface CreateSpreadsheetResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  updatedSheets?: string[];
  isNew?: boolean;
}

/**
 * Extracts a Google Spreadsheet ID from either a full URL or a raw ID string.
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  // Matches https://docs.google.com/spreadsheets/d/{id}/...
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Builds rows for the Monthly Summary tab
 */
function buildSummaryRows(monthName: string, summaryData: MonthlyStaffSummary[]): string[][] {
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

  return summaryValues;
}

/**
 * Builds rows for the Daily Attendance Logs tab
 */
function buildDailyRows(users: StaffUser[], attendanceRecords: AttendanceRecord[]): string[][] {
  const userMap = new Map(users.map((u) => [u.id, u]));
  const dailyValues: string[][] = [
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

  return dailyValues;
}

/**
 * Applies styling to Monthly Summary and Daily Attendance tabs
 */
async function applyReportStyles(
  accessToken: string,
  spreadsheetId: string,
  summarySheetId: number,
  dailySheetId: number,
  summaryRowCount: number
) {
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          // Title formatting on row 0 (A1:F1) (#1E3A8A)
          {
            repeatCell: {
              range: {
                sheetId: summarySheetId,
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
                sheetId: summarySheetId,
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
                sheetId: summarySheetId,
                startRowIndex: 2,
                endRowIndex: 3,
                startColumnIndex: 0,
                endColumnIndex: 6,
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
          // Total row formatting at the bottom of Monthly Summary
          {
            repeatCell: {
              range: {
                sheetId: summarySheetId,
                startRowIndex: summaryRowCount - 1,
                endRowIndex: summaryRowCount,
                startColumnIndex: 0,
                endColumnIndex: 6,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.945, green: 0.961, blue: 0.976 },
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
                sheetId: dailySheetId,
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
                sheetId: summarySheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 6,
              },
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: dailySheetId,
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
}

/**
 * Creates a new formatted Housekeeping Attendance & OT Report spreadsheet in user's Google Drive.
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

  // 2. Prepare Data
  const summaryValues = buildSummaryRows(monthName, summaryData);
  const dailyValues = buildDailyRows(users, attendanceRecords);

  // 3. Write Summary Values
  const summaryRange = encodeURIComponent(`'Monthly Summary'!A1:F${summaryValues.length}`);
  const appendSummaryRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${summaryRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: summaryValues }),
    }
  );

  if (!appendSummaryRes.ok) {
    const err = await appendSummaryRes.json().catch(() => ({}));
    console.warn('Could not populate summary data:', err);
  }

  // 4. Write Daily Values
  const dailyRange = encodeURIComponent(`'Daily Attendance Logs'!A1:K${dailyValues.length}`);
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${dailyRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: dailyValues }),
    }
  );

  // 5. Apply Styling
  await applyReportStyles(accessToken, spreadsheetId, 0, 1, summaryValues.length);

  return {
    spreadsheetId,
    spreadsheetUrl,
    title: spreadsheetTitle,
    updatedSheets: ['Monthly Summary', 'Daily Attendance Logs'],
    isNew: true,
  };
}

/**
 * Syncs/updates current month's attendance records into an EXISTING Google Spreadsheet.
 */
export async function syncToExistingGoogleSheet(
  accessToken: string,
  spreadsheetIdOrUrl: string,
  monthName: string,
  summaryData: MonthlyStaffSummary[],
  users: StaffUser[],
  attendanceRecords: AttendanceRecord[]
): Promise<CreateSpreadsheetResult> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
  if (!spreadsheetId) {
    throw new Error('Please provide a valid Google Spreadsheet ID or URL.');
  }

  // 1. Fetch metadata to verify spreadsheet existence and identify sheet tabs
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) {
    const errData = await metaRes.json().catch(() => ({}));
    if (metaRes.status === 404) {
      throw new Error(`Spreadsheet not found (ID: ${spreadsheetId}). Please check the URL/ID and verify permissions.`);
    }
    if (metaRes.status === 403) {
      throw new Error(`Permission denied for spreadsheet (ID: ${spreadsheetId}). Ensure your connected Google account has edit access.`);
    }
    throw new Error(errData.error?.message || `Unable to access Google Spreadsheet (HTTP ${metaRes.status})`);
  }

  const meta = await metaRes.json();
  const existingSheets: Array<{ properties: { sheetId: number; title: string } }> = meta.sheets || [];

  let summarySheet = existingSheets.find((s) => s.properties.title === 'Monthly Summary');
  let dailySheet = existingSheets.find((s) => s.properties.title === 'Daily Attendance Logs');

  const sheetsToCreate: any[] = [];
  if (!summarySheet) {
    sheetsToCreate.push({
      addSheet: {
        properties: {
          title: 'Monthly Summary',
          gridProperties: { frozenRowCount: 3 },
        },
      },
    });
  }
  if (!dailySheet) {
    sheetsToCreate.push({
      addSheet: {
        properties: {
          title: 'Daily Attendance Logs',
          gridProperties: { frozenRowCount: 1 },
        },
      },
    });
  }

  // 2. Create missing sheets if needed
  if (sheetsToCreate.length > 0) {
    const addSheetsRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests: sheetsToCreate }),
      }
    );

    if (addSheetsRes.ok) {
      const addSheetsData = await addSheetsRes.json();
      for (const reply of addSheetsData.replies || []) {
        if (reply.addSheet?.properties?.title === 'Monthly Summary') {
          summarySheet = reply.addSheet;
        } else if (reply.addSheet?.properties?.title === 'Daily Attendance Logs') {
          dailySheet = reply.addSheet;
        }
      }
    }
  }

  const summarySheetId = summarySheet?.properties?.sheetId ?? 0;
  const dailySheetId = dailySheet?.properties?.sheetId ?? 1;

  // 3. Clear existing values in target sheets before writing to avoid trailing rows
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Monthly Summary'!A1:Z500:clear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Daily Attendance Logs'!A1:Z2000:clear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (clearErr) {
    console.warn('Notice: Clear existing range warning:', clearErr);
  }

  // 4. Write data
  const summaryValues = buildSummaryRows(monthName, summaryData);
  const dailyValues = buildDailyRows(users, attendanceRecords);

  const summaryRange = encodeURIComponent(`'Monthly Summary'!A1:F${summaryValues.length}`);
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${summaryRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: summaryValues }),
    }
  );

  const dailyRange = encodeURIComponent(`'Daily Attendance Logs'!A1:K${dailyValues.length}`);
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${dailyRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: dailyValues }),
    }
  );

  // 5. Apply report formatting
  await applyReportStyles(accessToken, spreadsheetId, summarySheetId, dailySheetId, summaryValues.length);

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    title: meta.properties?.title || 'Housekeeping Attendance Sheet',
    updatedSheets: ['Monthly Summary', 'Daily Attendance Logs'],
    isNew: false,
  };
}

