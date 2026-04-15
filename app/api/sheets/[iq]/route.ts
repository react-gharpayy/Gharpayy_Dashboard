import { NextResponse } from 'next/server';

const SHEET_ID = '1G3l4qX7lWedE4W_3_BoIqreRNP-mA1qH8eIxR0DBk5A';
const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json({ error: 'Missing GOOGLE_SHEETS_API_KEY' }, { status: 500 });
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?includeGridData=true&ranges=${encodeURIComponent("'MY PG IQ'")}&key=${API_KEY}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: 'Sheets API error', detail: errText }, { status: 502 });
    }

    const sheetData = await res.json();
    const rows: any[] = sheetData?.sheets?.[0]?.data?.[0]?.rowData ?? [];

    // Use effectiveValue.stringValue to preserve newlines inside cells
    const result = rows.map((row: any) => {
      const cells = row?.values ?? [];
      return cells.map((cell: any) =>
        cell?.effectiveValue?.stringValue ??
        String(cell?.effectiveValue?.numberValue ?? cell?.effectiveValue?.boolValue ?? '')
      );
    });

    return NextResponse.json({ rows: result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}