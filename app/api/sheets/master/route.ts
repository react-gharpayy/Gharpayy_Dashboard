import { NextResponse } from 'next/server';
import type { PGEntry } from '@/data/pgMasterData';

const SHEET_ID = '1G3l4qX7lWedE4W_3_BoIqreRNP-mA1qH8eIxR0DBk5A';
const MASTER_GID = '1461573087';
const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;

function parsePriceString(raw: string, fallbackText?: string) {
  const cleanNum = (s: string) => parseFloat(s.replace(/,/g, ''));
  const extract = (patterns: RegExp[], text: string) => {
    for (const re of patterns) {
      const m = text.match(re);
      if (m) {
        let val = cleanNum(m[1]);
        if (m[2]?.toLowerCase() === 'k') val *= 1000;
        else if (val < 100) val *= 1000;
        return val;
      }
    }
    return null;
  };
  const tPatterns = [/T\s*[:\-\s]*([\d,.]+)(k)?/i, /Triple\s*[:\-\s]*([\d,.]+)(k)?/i];
  const dPatterns = [/D\s*[:\-\s]*([\d,.]+)(k)?/i, /Double\s*[:\-\s]*([\d,.]+)(k)?/i];
  const sPatterns = [/S\s*[:\-\s]*([\d,.]+)(k)?/i, /Single\s*[:\-\s]*([\d,.]+)(k)?/i];
  const triple = extract(tPatterns, raw) || (fallbackText ? extract(tPatterns, fallbackText) : null);
  const double = extract(dPatterns, raw) || (fallbackText ? extract(dPatterns, fallbackText) : null);
  const single = extract(sPatterns, raw) || (fallbackText ? extract(sPatterns, fallbackText) : null);
  const prices = [triple, double, single].filter((p): p is number => p !== null);
  return { triple, double, single, min: prices.length > 0 ? Math.min(...prices) : null };
}

function clean(s: string | undefined): string {
  return (s || '').replace(/^"+|"+$/g, '').trim();
}

function normalizeArea(a: string): string {
  if (!a) return 'Unknown';
  const c = a.trim().toLowerCase();
  if (c.includes('bellandur')) return 'Bellandur';
  if (c.includes('koramangala')) return 'Koramangala';
  if (c.includes('hsr')) return 'HSR Layout';
  if (c.includes('btm')) return 'BTM Layout';
  if (c.includes('marathahalli')) return 'Marathahalli';
  if (c.includes('brookfield') || c.includes('aecs') || c.includes('aces')) return 'Brookefield';
  if (c.includes('whitefield') || c.includes('itpl')) return 'Whitefield';
  if (c.includes('electronic city') || c.includes('ecity')) return 'Electronic City';
  if (c.includes('indiranagar') || c.includes('indira nagar')) return 'Indiranagar';
  if (c.includes('sarjapur')) return 'Sarjapur Road';
  if (c.includes('mahadevapura')) return 'Mahadevapura';
  if (c.includes('hebbal')) return 'Hebbal';
  if (c.includes('jp nagar')) return 'JP Nagar';
  if (c.includes('jayanagar')) return 'Jayanagar';
  return c.split(/[\s/|-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function isRedCell(color?: { red?: number; green?: number; blue?: number }): boolean {
  if (!color) return false;
  const r = color.red ?? 0;
  const g = color.green ?? 0;
  const b = color.blue ?? 0;
  return r > 0.5 && g < 0.3 && b < 0.3;
}

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json({ error: 'Missing GOOGLE_SHEETS_API_KEY' }, { status: 500 });
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?includeGridData=true&ranges=${encodeURIComponent(`'MASTER'`)}&key=${API_KEY}`;

  let sheetData: any;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: 'Sheets API error', detail: errText }, { status: 502 });
    }
    sheetData = await res.json();
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch sheet', detail: String(e) }, { status: 502 });
  }

  const rows: any[] = sheetData?.sheets?.[0]?.data?.[0]?.rowData ?? [];
  const results: PGEntry[] = [];
  const inactiveNames: string[] = [];
  let idx = 0;

  // Skip header rows (first 2)
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const cells = row?.values ?? [];

    const getVal = (colIdx: number): string => clean(cells[colIdx]?.formattedValue);
    const getColor = (colIdx: number) => cells[colIdx]?.effectiveFormat?.textFormat?.foregroundColor;

    const name = getVal(1); // Col B — NAMES
    if (!name) continue;

    // Filter out inactive PGs — red text on the name cell
    if (isRedCell(getColor(1))) {
      inactiveNames.push(name.toLowerCase()); // collect it
      continue;
    }

    const rawArea = getVal(2);  // Col C — AREA
    const area = normalizeArea(rawArea);
    const locality = getVal(3);  // Col D — LOCALITY
    const usp = getVal(6);  // Col G — USP
    const vacant = getVal(8);  // Col I — V (vacant count)
    const priceLows = getVal(9);  // Col J — LOWS (T 11 / D 15 / S 22)
    const waMsg = getVal(11); // Col L — PRICE (WA blob fallback)
    const food = getVal(14); // Col O — FOOD
    const mapsLink = getVal(17); // Col R — exact location ✅
    const locationMsg = getVal(13);
    const exactName = getVal(16); // Col Q — exact name
    const managerContact = getVal(20); // Col T — manager number
    const managerName = getVal(21); // Col U — mng name

    const genderRaw = name + ' ' + locality;
    let gender = 'Co-live';
    if (/\bgirls?\b/i.test(genderRaw)) gender = 'Girls';
    else if (/\bboys?\b/i.test(genderRaw)) gender = 'Boys';

    const { triple, double, single, min } = parsePriceString(
      priceLows || waMsg,
      priceLows ? waMsg : undefined
    );

    results.push({
      id: 3000 + idx,
      pid: `GP-MST${String(idx + 1).padStart(3, '0')}`,
      name,
      area,
      locality,
      landmarks: '',
      mapsLink,
      triplePrice: triple,
      doublePrice: double,
      singlePrice: single,
      minPrice: min ?? 0,
      gender,
      propertyType: 'Mid',
      meals: food || '3 Meals / Day',
      food,
      usp,
      utilities: '',
      deposit: '1 Month Rent',
      minStay: '3 Months',
      houseRules: '',
      vibe: '',
      walkDist: '',
      amenities: [],
      safety: [],
      commonAreas: [],
      managerContact,
      managerName: managerName || 'Manager',
      targetAudience: 'Both',
      source: 'LIVE-SHEET',
      priority: '1',
      availability: vacant ? parseInt(vacant) : null,
      locationMsg: locationMsg,
      waTemplate: waMsg,
      subArea: rawArea || area,
      exactName,
    });
    idx++;
  }

  return NextResponse.json({
    active: results,
    inactiveNames: inactiveNames,
  });
}