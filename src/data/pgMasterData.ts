// Auto-generated from Gharpayy Lead Matcher — 215 PGs across Bangalore
// Data lives in pgData.json to keep TypeScript checker fast

import rawData from './pgData.json';

export interface PGEntry {
  id: number;
  pid: string;
  name: string;
  area: string;
  locality: string;
  landmarks: string;
  mapsLink: string;
  triplePrice: number | null;
  doublePrice: number | null;
  singlePrice: number | null;
  minPrice: number | null;
  gender: string;
  propertyType: string;
  meals: string;
  food?: string;
  exactName?: string;
  usp: string;
  utilities: string;
  deposit: string;
  minStay: string;
  houseRules: string;
  vibe: string;
  walkDist: string;
  amenities: string[];
  safety: string[];
  commonAreas: string[];
  managerContact: string;
  managerName: string;
  targetAudience: string;
  source: string;
  priority: string;
  availability: number | null;
  distanceKm?: number;
  roomNumber?: string;
  waTemplate?: string;
  subArea?: string;
  locationMsg?: string;
}

export const PG_DATA: PGEntry[] = rawData as PGEntry[];
