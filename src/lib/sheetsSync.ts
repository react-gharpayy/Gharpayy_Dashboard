import type { PGEntry } from '../data/pgMasterData';

/**
 * MY PG IQ tab (gid=254520272) — the authoritative source with ALL fields.
 * 
 * VERIFIED COLUMN MAP (0-indexed):
 * Col 0  → Gharpayy Name of PG
 * Col 1  → Area
 * Col 2  → Locality
 * Col 3  → Nearby Landmarks
 * Col 4  → Location message (📍GHARPAYY...)
 * Col 5  → Price/WA message (⚡️ Exclusive Offer...)
 * Col 6  → Manager Name
 * Col 7  → Manager Contact
 * Col 8  → Owner Name
 * Col 9  → Owner Number
 * Col 10 → Group Name
 * Col 11 → Actual Name of PG
 * Col 12 → Google Maps Link
 * Col 13 → Gender (Boys/Girls/Co-live)
 * Col 14 → Target Audience (Students/Working Professionals/Both)
 * Col 15 → Property Type (Premium/Mid/Budget)
 * Col 16 → Room Type
 * Col 17 → Furnishing Details
 * Col 18 → Walking Distance to Landmarks
 * Col 19 → Accessibility
 * Col 20 → Noise Level
 * Col 21 → Surrounding Vibe
 * Col 22 → Food Type (Veg/Non-Veg/Both/Self-Cook)
 * Col 23 → Common Area Features
 * Col 24 → Amenities
 * Col 25 → Safety Features
 * Col 26 → Meals Included
 * Col 27 → Food Timings/Details
 * Col 28 → E Bill/Utilities Included
 * Col 29 → Cleaning Frequency
 * Col 30 → USP of Property
 * Col 31 → House Rules
 * Col 32 → Lows (Don't Disclose)
 * Col 33 → Security Deposit info
 * Col 34 → Minimum Stay
 * Col 35 → Drive Folder (Brochure)
 * Col 36 → Drive Folder (Photos)
 * Col 37 → Drive Folder (Videos)
 * Col 38 → Timestamp
 */
// removed duplicate constant

function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
      cur += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      if (cur.trim()) rows.push(parseCSVRow(cur));
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) rows.push(parseCSVRow(cur));
  return rows;
}

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

  const tPatterns = [/T\s*[:\-\s]*([\d,.]+)(k)?/i, /Triple\s*[:\-\s]*([\d,.]+)(k)?/i, /3\s*sharing\s*[:\-\s]*([\d,.]+)(k)?/i];
  const dPatterns = [/D\s*[:\-\s]*([\d,.]+)(k)?/i, /Dual\s*[:\-\s]*([\d,.]+)(k)?/i, /Double\s*[:\-\s]*([\d,.]+)(k)?/i, /2\s*sharing\s*[:\-\s]*([\d,.]+)(k)?/i];
  const sPatterns = [/S\s*[:\-\s]*([\d,.]+)(k)?/i, /Single\s*[:\-\s]*([\d,.]+)(k)?/i, /Private\s*[:\-\s]*([\d,.]+)(k)?/i, /1\s*sharing\s*[:\-\s]*([\d,.]+)(k)?/i];

  const triple = extract(tPatterns, raw) || (fallbackText ? extract(tPatterns, fallbackText) : null);
  const double = extract(dPatterns, raw) || (fallbackText ? extract(dPatterns, fallbackText) : null);
  const single = extract(sPatterns, raw) || (fallbackText ? extract(sPatterns, fallbackText) : null);

  const prices = [triple, double, single].filter((p): p is number => p !== null);
  return { triple, double, single, min: prices.length > 0 ? Math.min(...prices) : null };
}

function splitList(s: string): string[] {
  return s.split(',').map(v => v.trim()).filter(Boolean);
}

function clean(s: string | undefined): string {
  return (s || '').replace(/^"+|"+$/g, '').trim();
}

const IQ_SHEET_URL = '/api/sheets/iq';
const FIND_PG_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1G3l4qX7lWedE4W_3_BoIqreRNP-mA1qH8eIxR0DBk5A/export?format=csv&gid=1461573087';

export function normalizeArea(a: string): string {
  if (!a) return 'Unknown';
  const cleaned = a.trim().toLowerCase();

  // Keyword extraction to snap messy names to canonical top-level areas
  if (cleaned.includes('bellandur')) return 'Bellandur';
  if (cleaned.includes('koramangala') || cleaned.includes('kormangala')) return 'Koramangala';
  if (cleaned.includes('hsr') || cleaned.includes('h s r')) return 'HSR Layout';
  if (cleaned.includes('btm')) return 'BTM Layout';
  if (cleaned.includes('marathahalli') || cleaned.includes('marath')) return 'Marathahalli';
  if (cleaned.includes('brookfield') || cleaned.includes('brook') || cleaned.includes('brookefield') || cleaned.includes('aces') || cleaned.includes('aecs')) return 'Brookefield';
  if (cleaned.includes('whitefield') || cleaned.includes('itpl')) return 'Whitefield';
  if (cleaned.includes('mahadevapura') || cleaned.includes('bgm')) return 'Mahadevapura';
  if (cleaned.includes('bannerghatta') || cleaned.includes('bg road')) return 'Bannerghatta';
  if (cleaned.includes('electronic city') || cleaned.includes('ecity') || cleaned.includes('e-city') || cleaned.includes('e city')) return 'Electronic City';
  if (cleaned.includes('kundalahalli')) return 'Kundalahalli';
  if (cleaned.includes('indiranagar') || cleaned.includes('indranagar') || cleaned.includes('indira nagar')) return 'Indiranagar';
  if (cleaned.includes('jayanagar')) return 'Jayanagar';
  if (cleaned.includes('jp nagar') || cleaned.includes('j p nagar')) return 'JP Nagar';
  if (cleaned.includes('hebbal')) return 'Hebbal';
  if (cleaned.includes('mathikere')) return 'Mathikere';
  if (cleaned.includes('yeshwanthpur') || cleaned.includes('yeshwanth')) return 'Yeshwanthpur';
  if (cleaned.includes('kadubeesanahalli')) return 'Kadubeesanahalli';
  if (cleaned.includes('domlur')) return 'Domlur';
  if (cleaned.includes('sarjapur')) return 'Sarjapur Road';
  if (cleaned.includes('cv raman') || cleaned.includes('c.v. raman')) return 'CV Raman Nagar';
  if (cleaned.includes('bangalore') || cleaned.includes('bengaluru')) return 'Bengaluru';

  // Fallback: title case the string
  return cleaned.split(/[\s/|-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export async function fetchLivePGData(): Promise<PGEntry[]> {
  const resIQ = await fetch(IQ_SHEET_URL, { cache: 'no-store' });
  const textIQ = resIQ.ok ? await resIQ.text() : '';

  const results: PGEntry[] = [];
  let idx = 0;

  // --- PARSE MY PG IQ TAB ---
  if (textIQ) {
    const allRows = parseCSV(textIQ);
    const dataRows = allRows.slice(2);
    for (const row of dataRows) {
      if (!row || row.length < 2) continue;
      const name = clean(row[0]);
      if (!name || name.toLowerCase() === 'gharpayy' || name.toLowerCase() === 'iq') continue;

      const priceLowsRaw = clean(row[32]);
      const waMsg = clean(row[5]);
      const locationMsg = clean(row[4]);
      const { triple, double, single, min } = parsePriceString(priceLowsRaw, waMsg);

      const amenitiesRaw = clean(row[24]);
      const safetyRaw = clean(row[25]);
      const commonAreasRaw = clean(row[23]);
      const vibe = clean(row[21]);
      const food = clean(row[22]);
      const meals = clean(row[26]);
      const foodTimings = clean(row[27]);
      const utilities = clean(row[28]);
      const houseRules = clean(row[31]);
      const usp = clean(row[30]);
      const deposit = clean(row[33]) || '1 Month Rent';
      const minStay = clean(row[34]) || '3 Months';
      const walkDist = clean(row[18]);
      const propertyType = clean(row[15]) as 'Premium' | 'Mid' | 'Budget';
      const targetAud = clean(row[14]);
      const mapsLink = clean(row[12]);
      const managerName = clean(row[6]);
      const managerContact = clean(row[7]);
      const rawArea = clean(row[1]);
      const area = normalizeArea(rawArea);
      const locality = clean(row[2]);
      const landmarks = clean(row[3]);
      const genderRaw = clean(row[13]);

      let gender = 'Co-live';
      if (genderRaw.toLowerCase().includes('girl')) gender = 'Girls';
      else if (genderRaw.toLowerCase().includes('boy')) gender = 'Boys';

      results.push({
        id: 2000 + idx,
        pid: `GP-IQ${String(idx + 1).padStart(3, '0')}`,
        name,
        area,
        locality,
        landmarks,
        mapsLink,
        triplePrice: triple,
        doublePrice: double,
        singlePrice: single,
        minPrice: min ?? 0,
        gender,
        propertyType: propertyType || 'Mid',
        meals: meals || food || '3 Meals / Day',
        food: food,
        usp,
        utilities,
        deposit,
        minStay,
        houseRules,
        vibe,
        walkDist,
        amenities: splitList(amenitiesRaw),
        safety: splitList(safetyRaw),
        commonAreas: splitList(commonAreasRaw),
        managerContact,
        managerName: managerName || 'Manager',
        targetAudience: targetAud || 'Both',
        source: 'LIVE-SHEET',
        priority: '1',
        availability: null,
        waTemplate: waMsg || locationMsg,
        subArea: rawArea || area,
        exactName: clean(row[11]),
      });
      idx++;
    }
  }
  return results;
}
