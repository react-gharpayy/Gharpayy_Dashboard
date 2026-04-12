import { NextResponse } from 'next/server';

const IQ_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1G3l4qX7lWedE4W_3_BoIqreRNP-mA1qH8eIxR0DBk5A/export?format=csv&gid=254520272';

export async function GET() {
  try {
    const res = await fetch(IQ_SHEET_URL, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch IQ sheet' }, { status: 502 });
    }
    const text = await res.text();
    return new Response(text, {
      headers: { 'Content-Type': 'text/csv' },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}