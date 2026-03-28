// ═══════════════════════════════════════════════════════════════════════
//  DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════
export const T = {
  bg0: "#ffffff", bg1: "#f8f9fc", bg2: "#f1f3f8", bg3: "#e8ebf2",
  line: "#e2e5ee", line2: "#d4d8e3",
  dim: "#8c92a8", mid: "#636b83", text: "#2d3248", hi: "#1a1e30",
  acc: "#6c5ce7", acc2: "#4a90e2",
  gold: "#c4880d", goldDim: "rgba(196,136,13,0.10)",
  mono: "'DM Mono','IBM Plex Mono',monospace",
  sans: "'DM Sans',sans-serif",
};

// ═══════════════════════════════════════════════════════════════════════
//  GEO ENGINE — Haversine + road correction
// ═══════════════════════════════════════════════════════════════════════
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, dL = (lat2 - lat1) * Math.PI / 180, dG = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dL / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dG / 2) ** 2;
  return +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2);
}
export const roadDist = (la1: number, lo1: number, la2: number, lo2: number) => +(haversine(la1, lo1, la2, lo2) * 1.35).toFixed(1);
export const driveMin = (km: number) => `${(km / 30 * 60).toFixed(0)}–${(km / 20 * 60).toFixed(0)} min`;

export type AreaEntry = {
  id: string; name: string; pincode: string; lat: number; lng: number;
  tier: string; region: string; desc: string;
};

export type TechParkEntry = {
  id: string; name: string; lat: number; lng: number; area: string;
  companies: string; kw: string[];
};

export type MetroStationEntry = {
  id: string; name: string; lat: number; lng: number; line: string;
};

// ═══════════════════════════════════════════════════════════════════════
//  BANGALORE AREAS DATABASE
// ═══════════════════════════════════════════════════════════════════════
export const AREAS: AreaEntry[] = [
  { id: "mg_road", name: "MG Road", pincode: "560001", lat: 12.9757, lng: 77.6077, tier: "luxury", region: "Central", desc: "CBD, Purple metro, Brigade Road adjacent" },
  { id: "richmond_town", name: "Richmond Town", pincode: "560025", lat: 12.9605, lng: 77.5983, tier: "luxury", region: "Central", desc: "Upscale old-money neighbourhood" },
  { id: "frazer_town", name: "Frazer Town", pincode: "560005", lat: 12.9880, lng: 77.6224, tier: "luxury", region: "Central", desc: "Leafy, cosmopolitan, older bungalows" },
  { id: "sadashivanagar", name: "Sadashivanagar", pincode: "560080", lat: 13.0062, lng: 77.5828, tier: "luxury", region: "Central", desc: "Most expensive zip in Bangalore" },
  { id: "basavanagudi", name: "Basavanagudi", pincode: "560004", lat: 12.9434, lng: 77.5750, tier: "premium", region: "Central", desc: "Old Bangalore, Bull Temple Rd" },
  { id: "korm_1", name: "Koramangala 1st Block", pincode: "560034", lat: 12.9318, lng: 77.6152, tier: "premium", region: "South", desc: "Quiet, near Christ University" },
  { id: "korm_3", name: "Koramangala 3rd Block", pincode: "560034", lat: 12.9340, lng: 77.6220, tier: "premium", region: "South", desc: "Restaurants, co-working, residential" },
  { id: "korm_4", name: "Koramangala 4th Block", pincode: "560034", lat: 12.9352, lng: 77.6245, tier: "premium", region: "South", desc: "Central Koramangala, IIMB area" },
  { id: "korm_5", name: "Koramangala 5th Block", pincode: "560095", lat: 12.9363, lng: 77.6270, tier: "premium", region: "South", desc: "Forum Mall, startups, dining" },
  { id: "korm_6", name: "Koramangala 6th Block", pincode: "560095", lat: 12.9373, lng: 77.6290, tier: "premium", region: "South", desc: "Hipster cafes, startup culture" },
  { id: "korm_8", name: "Koramangala 8th Block", pincode: "560095", lat: 12.9320, lng: 77.6310, tier: "premium", region: "South", desc: "Quieter, SGPalya end" },
  { id: "sg_palya", name: "SGPalya", pincode: "560029", lat: 12.9285, lng: 77.6330, tier: "mid", region: "South", desc: "Adjoins Koramangala 8th, affordable" },
  { id: "btm_1", name: "BTM Layout Sector 1", pincode: "560029", lat: 12.9180, lng: 77.6080, tier: "mid", region: "South", desc: "Western BTM, near Jayanagar" },
  { id: "btm_2", name: "BTM Layout Sector 2", pincode: "560076", lat: 12.9165, lng: 77.6101, tier: "mid", region: "South", desc: "Main commercial BTM, dense" },
  { id: "hsr_1", name: "HSR Layout Sector 1", pincode: "560102", lat: 12.9180, lng: 77.6389, tier: "premium", region: "South", desc: "North HSR, near Koramangala" },
  { id: "hsr_3", name: "HSR Layout Sector 3", pincode: "560102", lat: 12.9116, lng: 77.6389, tier: "premium", region: "South", desc: "Central HSR, startup hubs" },
  { id: "hsr_6", name: "HSR Layout Sector 6", pincode: "560102", lat: 12.9030, lng: 77.6389, tier: "premium", region: "South", desc: "South HSR near Silk Board" },
  { id: "jaya_4t", name: "Jayanagar 4th T Block", pincode: "560041", lat: 12.9265, lng: 77.5970, tier: "premium", region: "South", desc: "Shopping hub, Jayanagar metro" },
  { id: "jaya_9", name: "Jayanagar 9th Block", pincode: "560041", lat: 12.9185, lng: 77.5938, tier: "mid", region: "South", desc: "Southernmost Jayanagar block" },
  { id: "jpn_1", name: "JP Nagar Phase 1", pincode: "560078", lat: 12.9200, lng: 77.5850, tier: "premium", region: "South", desc: "Adjacent Jayanagar, premium" },
  { id: "jpn_3", name: "JP Nagar Phase 3", pincode: "560078", lat: 12.9100, lng: 77.5844, tier: "mid", region: "South", desc: "Good connectivity" },
  { id: "jpn_7", name: "JP Nagar Phase 7", pincode: "560062", lat: 12.8900, lng: 77.5844, tier: "mid", region: "South", desc: "Near Puttenahalli Lake" },
  { id: "banashankari", name: "Banashankari", pincode: "560050", lat: 12.9232, lng: 77.5476, tier: "mid", region: "South", desc: "Metro terminus, temple area" },
  { id: "bannerhatta", name: "Bannerghatta Road", pincode: "560076", lat: 12.8900, lng: 77.5976, tier: "mid", region: "South", desc: "Extended residential, Arekere" },
  { id: "elec_city_1", name: "Electronic City Phase 1", pincode: "560100", lat: 12.8491, lng: 77.6741, tier: "affordable", region: "South", desc: "Infosys, HCL, Wipro campuses" },
  { id: "elec_city_2", name: "Electronic City Phase 2", pincode: "560100", lat: 12.8399, lng: 77.6770, tier: "affordable", region: "South", desc: "Extended IT zone" },
  { id: "sarjapur_road", name: "Sarjapur Road", pincode: "560034", lat: 12.9102, lng: 77.6805, tier: "mid", region: "South-East", desc: "ORR to Sarjapur, high-rise" },
  { id: "bellandur", name: "Bellandur", pincode: "560103", lat: 12.9256, lng: 77.6720, tier: "mid", region: "South-East", desc: "Ecospace, Pritech, lake area" },
  { id: "carmelaram", name: "Carmelaram", pincode: "560035", lat: 12.8989, lng: 77.7072, tier: "affordable", region: "South-East", desc: "Near Sarjapur, growing suburb" },
  { id: "indiranagar", name: "Indiranagar", pincode: "560038", lat: 12.9784, lng: 77.6408, tier: "luxury", region: "East", desc: "100 Feet Road, metro, premium" },
  { id: "domlur", name: "Domlur", pincode: "560071", lat: 12.9609, lng: 77.6387, tier: "premium", region: "East", desc: "HAL/ISRO vicinity, IT offices" },
  { id: "ejipura", name: "Ejipura / Viveknagar", pincode: "560047", lat: 12.9530, lng: 77.6350, tier: "mid", region: "East", desc: "Between Koramangala & Indiranagar" },
  { id: "old_airport", name: "Old Airport Road", pincode: "560017", lat: 12.9607, lng: 77.6491, tier: "premium", region: "East", desc: "HAL, Manipal Hospital, Ulsoor" },
  { id: "cv_raman", name: "CV Raman Nagar", pincode: "560093", lat: 12.9869, lng: 77.6634, tier: "mid", region: "East", desc: "Bagmane Tech Park nearby" },
  { id: "marathahalli", name: "Marathahalli", pincode: "560037", lat: 12.9545, lng: 77.7011, tier: "mid", region: "East", desc: "ORR junction, IT hub" },
  { id: "whitefield", name: "Whitefield", pincode: "560066", lat: 12.9698, lng: 77.7499, tier: "mid", region: "East", desc: "Largest IT hub, ITPL, Phoenix Mall" },
  { id: "hoodi", name: "Hoodi", pincode: "560048", lat: 12.9879, lng: 77.7084, tier: "mid", region: "East", desc: "Between KR Puram & Whitefield" },
  { id: "varthur", name: "Varthur", pincode: "560087", lat: 12.9395, lng: 77.7350, tier: "affordable", region: "East", desc: "Growing suburb near Whitefield" },
  { id: "kr_puram", name: "KR Puram", pincode: "560036", lat: 13.0074, lng: 77.6946, tier: "affordable", region: "East", desc: "Railway station, growing area" },
  { id: "banaswadi", name: "Banaswadi", pincode: "560043", lat: 13.0105, lng: 77.6528, tier: "mid", region: "East", desc: "Between HBR & Indiranagar" },
  { id: "hebbal", name: "Hebbal", pincode: "560024", lat: 13.0358, lng: 77.5970, tier: "premium", region: "North", desc: "Manyata Tech Park, flyover, lake" },
  { id: "nagawara", name: "Nagawara", pincode: "560045", lat: 13.0428, lng: 77.6246, tier: "mid", region: "North", desc: "Manyata feeder zone" },
  { id: "thanisandra", name: "Thanisandra", pincode: "560077", lat: 13.0574, lng: 77.6216, tier: "mid", region: "North", desc: "Growing residential" },
  { id: "hennur", name: "Hennur Road", pincode: "560043", lat: 13.0480, lng: 77.6358, tier: "affordable", region: "North", desc: "Budget apartments, upcoming" },
  { id: "rt_nagar", name: "RT Nagar", pincode: "560032", lat: 13.0205, lng: 77.5914, tier: "mid", region: "North", desc: "North Bangalore, established" },
  { id: "yelahanka", name: "Yelahanka", pincode: "560064", lat: 13.1007, lng: 77.5963, tier: "mid", region: "North", desc: "Airport corridor, growing fast" },
  { id: "jakkur", name: "Jakkur", pincode: "560064", lat: 13.0661, lng: 77.5864, tier: "mid", region: "North", desc: "Airport road, Jakkur Lake" },
  { id: "devanahalli", name: "Devanahalli", pincode: "562110", lat: 13.2479, lng: 77.7167, tier: "affordable", region: "North", desc: "Near KIAL, logistics, growing" },
  { id: "rajajinagar", name: "Rajajinagar", pincode: "560010", lat: 12.9988, lng: 77.5562, tier: "premium", region: "West", desc: "Metro connected, old BLR premium" },
  { id: "malleswaram", name: "Malleswaram", pincode: "560003", lat: 13.0032, lng: 77.5700, tier: "premium", region: "West", desc: "Heritage, premium residential" },
  { id: "yeshwanthpur", name: "Yeshwanthpur", pincode: "560022", lat: 13.0227, lng: 77.5450, tier: "mid", region: "West", desc: "Railway junction, metro" },
  { id: "vijayanagar", name: "Vijayanagar", pincode: "560040", lat: 12.9793, lng: 77.5364, tier: "mid", region: "West", desc: "Metro (Purple), dense residential" },
  { id: "nagarbhavi", name: "Nagarbhavi", pincode: "560072", lat: 12.9730, lng: 77.5101, tier: "mid", region: "West", desc: "RGU campus nearby, large layouts" },
  { id: "rr_nagar", name: "RR Nagar", pincode: "560098", lat: 12.9179, lng: 77.5175, tier: "mid", region: "West", desc: "Large residential, PES University" },
  { id: "kengeri", name: "Kengeri", pincode: "560060", lat: 12.9140, lng: 77.4829, tier: "affordable", region: "West", desc: "Purple metro terminus, affordable" },
];

export const TIER_COLOR: Record<string, string> = { luxury: "#D4A853", premium: "#7EB8A4", mid: "#6B9BD2", affordable: "#A0A0A0" };

// ═══════════════════════════════════════════════════════════════════════
//  TECH PARKS
// ═══════════════════════════════════════════════════════════════════════
export const GEO_TECH_PARKS: TechParkEntry[] = [
  { id: "manyata", name: "Manyata Tech Park", lat: 13.0461, lng: 77.6214, area: "Hebbal/Nagawara", companies: "Goldman Sachs, SAP, Mphasis, L&T", kw: ["manyata tech", "manyata", "manyatha"] },
  { id: "embassy_tv", name: "Embassy Tech Village", lat: 12.9287, lng: 77.6889, area: "Devarabeesanahalli/ORR", companies: "IBM, Accenture, Cisco, Dell", kw: ["embassy tech village", "etv"] },
  { id: "bagmane", name: "Bagmane Tech Park", lat: 12.9869, lng: 77.6634, area: "CV Raman Nagar", companies: "Cognizant, Nokia, Citibank", kw: ["bagmane tech", "bagmane"] },
  { id: "prestige_tp", name: "Prestige Tech Park", lat: 12.9213, lng: 77.6871, area: "ORR/Marathahalli", companies: "Accenture, Qualcomm, Akamai", kw: ["prestige tech park", "prestige techpark"] },
  { id: "ecity_hub", name: "Electronic City (Infosys)", lat: 12.8491, lng: 77.6741, area: "Electronic City Ph1", companies: "Infosys, Wipro, HCL, TCS, Siemens", kw: ["electronic city", "infosys campus", "ecity"] },
  { id: "itpl", name: "ITPL / International Tech Park", lat: 12.9845, lng: 77.7268, area: "Whitefield", companies: "Multiple MNCs, Infosys BPO", kw: ["itpl", "international tech park", "international technology park"] },
  { id: "global_tv", name: "Embassy Global Tech Village", lat: 12.9204, lng: 77.6780, area: "Bellandur/ORR", companies: "Flipkart, Target India", kw: ["embassy golf links", "global tech village", "global technology park"] },
  { id: "cessna", name: "Cessna Business Park", lat: 12.9342, lng: 77.6910, area: "Kadubeesanahalli/ORR", companies: "Capgemini, Ernst & Young", kw: ["cessna business", "cessna"] },
  { id: "rmz_infinity", name: "RMZ Infinity", lat: 12.9885, lng: 77.7034, area: "Old Madras Road", companies: "Amazon, JP Morgan", kw: ["rmz infinity"] },
  { id: "ecospace", name: "EcoSpace Business Park", lat: 12.9345, lng: 77.6898, area: "Bellandur/ORR", companies: "SAP Labs, Tech Mahindra, KPMG", kw: ["ecospace"] },
  { id: "rmz_ecoworld", name: "RMZ Ecoworld", lat: 12.9145, lng: 77.6929, area: "Bellandur", companies: "J.P. Morgan, ANZ, ThoughtWorks", kw: ["rmz ecoworld", "rmz eco world", "rmz eco"] },
  { id: "pritech", name: "Pritech Park SEZ", lat: 12.9350, lng: 77.6850, area: "Bellandur", companies: "SAP, Mindtree", kw: ["pritech", "prestige shantiniketan"] },
  { id: "kirloskar_tp", name: "Kirloskar Tech Park", lat: 13.0440, lng: 77.5870, area: "Hebbal", companies: "ABB, Ericsson", kw: ["kirloskar tech"] },
  { id: "bosch", name: "Bosch Campus", lat: 12.9200, lng: 77.6100, area: "Hosur Road", companies: "Robert Bosch", kw: ["bosch"] },
  { id: "ibc", name: "IBC Knowledge Park", lat: 12.9450, lng: 77.6100, area: "Hosur Road", companies: "Multiple IT", kw: ["ibc knowledge park", "ibc knowledge"] },
  { id: "divyasree", name: "Divyasree Tech Park", lat: 12.9400, lng: 77.6900, area: "ORR/Marathahalli", companies: "Multiple IT", kw: ["divyasree"] },
  { id: "salarpuria", name: "Salarpuria Techzone", lat: 12.9400, lng: 77.6897, area: "ORR/Marathahalli", companies: "Multiple IT", kw: ["salarpuria techzone", "salarpuria"] },
  { id: "ub_city", name: "UB City", lat: 12.9715, lng: 77.5959, area: "CBD/Central", companies: "Corporate offices", kw: ["ub city"] },
];

// ═══════════════════════════════════════════════════════════════════════
//  METRO STATIONS
// ═══════════════════════════════════════════════════════════════════════
export const METRO_STATIONS: MetroStationEntry[] = [
  { id: "m_kengeri", name: "Kengeri", lat: 12.9140, lng: 77.4829, line: "Purple" },
  { id: "m_vijay", name: "Vijayanagar", lat: 12.9680, lng: 77.5480, line: "Purple" },
  { id: "m_majestic", name: "Kempegowda (Majestic)", lat: 12.9766, lng: 77.5713, line: "Purple/Green" },
  { id: "m_cubbon", name: "Cubbon Park", lat: 12.9762, lng: 77.5933, line: "Purple" },
  { id: "m_mg_road", name: "MG Road", lat: 12.9757, lng: 77.6077, line: "Purple" },
  { id: "m_trinity", name: "Trinity", lat: 12.9730, lng: 77.6168, line: "Purple" },
  { id: "m_halasuru", name: "Halasuru", lat: 12.9729, lng: 77.6265, line: "Purple" },
  { id: "m_indiranagar", name: "Indiranagar", lat: 12.9776, lng: 77.6384, line: "Purple" },
  { id: "m_baiyappa", name: "Baiyappanahalli", lat: 12.9873, lng: 77.6612, line: "Purple" },
  { id: "m_nagasandra", name: "Nagasandra", lat: 13.0536, lng: 77.5137, line: "Green" },
  { id: "m_peenya", name: "Peenya", lat: 13.0235, lng: 77.5198, line: "Green" },
  { id: "m_yeshwantp", name: "Yeshwanthpur", lat: 13.0215, lng: 77.5399, line: "Green" },
  { id: "m_rajajin", name: "Rajajinagar", lat: 12.9988, lng: 77.5562, line: "Green" },
  { id: "m_mantri_sq", name: "Mantri Square", lat: 12.9797, lng: 77.5680, line: "Green" },
  { id: "m_kr_market", name: "KR Market", lat: 12.9590, lng: 77.5742, line: "Green" },
  { id: "m_lalbagh", name: "Lalbagh", lat: 12.9445, lng: 77.5845, line: "Green" },
  { id: "m_south_end", name: "South End Circle", lat: 12.9399, lng: 77.5887, line: "Green" },
  { id: "m_jayanagar", name: "Jayanagar", lat: 12.9250, lng: 77.5938, line: "Green" },
  { id: "m_rv_road", name: "RV Road", lat: 12.9189, lng: 77.5875, line: "Green" },
  { id: "m_banashankari", name: "Banashankari", lat: 12.9232, lng: 77.5476, line: "Green" },
  { id: "m_jp_nagar", name: "Jayaprakash Nagar", lat: 12.9105, lng: 77.5624, line: "Green" },
  { id: "m_yelachenahalli", name: "Yelachenahalli", lat: 12.8980, lng: 77.5710, line: "Green" },
  { id: "m_silk_board", name: "Silk Board", lat: 12.9174, lng: 77.6228, line: "Yellow" },
  { id: "m_hsr_m", name: "HSR Layout", lat: 12.9116, lng: 77.6389, line: "Yellow" },
  { id: "m_agara", name: "Agara", lat: 12.9090, lng: 77.6266, line: "Yellow" },
  { id: "m_bellandur_m", name: "Bellandur Road", lat: 12.9210, lng: 77.6717, line: "Yellow" },
  { id: "m_marathahalli_m", name: "Marathahalli Bridge", lat: 12.9545, lng: 77.7011, line: "Yellow" },
  { id: "m_nagawara_p", name: "Nagawara", lat: 13.0428, lng: 77.6246, line: "Pink" },
  { id: "m_thanisandra_p", name: "Thanisandra", lat: 13.0574, lng: 77.6216, line: "Pink" },
];

export const LINE_COLOR: Record<string, string> = {
  "Purple": "#9B59B6", "Green": "#27AE60", "Purple/Green": "#E67E22",
  "Yellow": "#F1C40F", "Pink": "#E91E8C",
};

// ═══════════════════════════════════════════════════════════════════════
//  ZONES
// ═══════════════════════════════════════════════════════════════════════
export type ZoneEntry = {
  zone: string; priority: number; color: string; bg: string; border: string; keywords: string[];
};

export const ZONES: ZoneEntry[] = [
  { zone: "South", priority: 1, color: "#fb923c", bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.35)", keywords: ["koramangala", "kormangala", "korma", "btm layout", "btm", "jayanagar", "jp nagar", "jpnagar", "hsr layout", "hsr", "banashankari", "basavanagudi", "lalbagh", "south end", "southend", "electronic city", "electronic cit", "neeladri", "begur", "bommanahalli", "hulimavu", "sg palya", "sgpalya", "silk board", "silkboard", "agara", "madiwala", "tavarekere", "christ university", "ibc knowledge", "bannerghatta", "kanakapura", "hosur road", "nexus mall", "forum mall", "nimhans", "btm 2nd stage", "btm stage 2", "koramangala 3rd", "koramangala 4th", "koramangala 5th", "koramangala 6th", "sarjapura road", "sarjapur road", "hosa road"] },
  { zone: "East", priority: 2, color: "#34d399", bg: "rgba(52,211,153,0.11)", border: "rgba(52,211,153,0.35)", keywords: ["whitefield", "white field", "hopefarm", "itpl", "kundanahalli", "kundalahalli", "kadugodi", "pattandur", "brookfield", "hoodi", "hoodi circle", "garudacharpalya", "varthur", "nallurhalli", "kr puram", "seetharampalya", "bellandur", "sarjapur", "ecospace", "rmz ecoworld", "embassy tech village", "prestige tech park", "global technology park", "yemalur", "indiranagar", "indranagar", "indira nagar", "domlur", "ejipura", "cv raman nagar", "old airport road", "airport road", "hal", "marathahalli", "marathalli", "mahadevapura", "mahadevpura", "bagmane", "kadubeesanahalli", "divyasree", "kundanhalli", "deloitte bellandur", "embassy golf links", "phoenix market city", "rmz infinity", "rmz millenia", "prestige shantiniketan", "thubarahalli", "serenity road"] },
  { zone: "North", priority: 3, color: "#60a5fa", bg: "rgba(96,165,250,0.11)", border: "rgba(96,165,250,0.32)", keywords: ["yelahanka", "hebbal", "manyata tech", "manyata", "manyatha", "nagawara", "thanisandra", "jakkur", "banaswadi", "kalyan nagar", "rt nagar", "sahakara nagar", "devanahalli", "vidyaranyapura", "jalahalli", "bhartiya", "embassy boulevard", "govindapura", "nagasandra", "hennur", "hebbala", "peenya", "kempegowda airport", "yelahanka new town", "rachenahalli", "kogilu", "kalkere", "bagalur"] },
  { zone: "West", priority: 4, color: "#c084fc", bg: "rgba(192,132,252,0.11)", border: "rgba(192,132,252,0.32)", keywords: ["rajajinagar", "vijaynagar", "vijaya nagar", "yeshwanthpur", "yeswanthpur", "nagarbhavi", "chord road", "mahalakshmi layout", "malleshwaram", "tumkur road", "sanjayanagara", "near peenya", "chandra layout", "dasarahalli", "herohalli", "kengeri", "rajarajeshwari nagar", "rr nagar", "mysore road", "magadi road"] },
  { zone: "Central", priority: 5, color: "#f87171", bg: "rgba(248,113,113,0.11)", border: "rgba(248,113,113,0.32)", keywords: ["mg road", "brigade road", "richmond road", "richmond circle", "shanthinagar", "shanthala nagar", "ashok nagar", "vittal mallya", "jayamahal", "majestic", "gandhi nagar", "frazer town", "cubbon park", "ub city", "vasanth nagar", "trinity circle", "halasuru", "church street", "lavelle road", "residency road", "museum road", "adugodi", "wilson garden", "basavangudi", "st mark", "cunningham", "langford town", "richmond town", "cox town", "brunton road"] },
];

// ═══════════════════════════════════════════════════════════════════════
//  QUALITY CONFIG
// ═══════════════════════════════════════════════════════════════════════
export const QUALITY: Record<string, { label: string; color: string; bg: string; border: string; stripe: string }> = {
  hot: { label: "🔥 Hot", color: "#f87171", bg: "rgba(248,113,113,0.13)", border: "rgba(248,113,113,0.4)", stripe: "#f87171" },
  good: { label: "✅ Good", color: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.4)", stripe: "#34d399" },
  bad: { label: "❌ Bad", color: "#64748b", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.3)", stripe: "#334155" },
};

export const BMAP: Record<string, { bg: string; color: string; border: string }> = {
  Working: { bg: "rgba(52,211,153,0.12)", color: "#34d399", border: "rgba(52,211,153,0.3)" },
  Student: { bg: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "rgba(96,165,250,0.3)" },
  Intern: { bg: "rgba(45,212,191,0.12)", color: "#2dd4bf", border: "rgba(45,212,191,0.3)" },
  "Student/Working": { bg: "rgba(192,132,252,0.12)", color: "#c084fc", border: "rgba(192,132,252,0.3)" },
  Private: { bg: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "rgba(251,191,36,0.3)" },
  Shared: { bg: "rgba(251,146,60,0.12)", color: "#fb923c", border: "rgba(251,146,60,0.3)" },
  Both: { bg: "rgba(244,114,182,0.12)", color: "#f472b6", border: "rgba(244,114,182,0.3)" },
  Girls: { bg: "rgba(251,113,133,0.12)", color: "#fb7185", border: "rgba(251,113,133,0.3)" },
  Boys: { bg: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "rgba(96,165,250,0.3)" },
  Coed: { bg: "rgba(45,212,191,0.12)", color: "#2dd4bf", border: "rgba(45,212,191,0.3)" },
};

// ═══════════════════════════════════════════════════════════════════════
//  GEO QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════
export function nearestMetro(lat: number, lng: number, n = 3) {
  return METRO_STATIONS.map(m => ({ ...m, dist: haversine(lat, lng, m.lat, m.lng) })).sort((a, b) => a.dist - b.dist).slice(0, n);
}
export function nearestTechParks(lat: number, lng: number, n = 3) {
  return GEO_TECH_PARKS.map(p => ({ ...p, dist: haversine(lat, lng, p.lat, p.lng) })).sort((a, b) => a.dist - b.dist).slice(0, n);
}

export function detectAllZones(raw: string): string[] {
  if (!raw) return [];
  const t = raw.toLowerCase();
  const found: string[] = [];
  for (const z of [...ZONES].sort((a, b) => a.priority - b.priority))
    if (z.keywords.some(kw => t.includes(kw))) found.push(z.zone);
  return found;
}

export function tsNow(): string {
  return new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function buildKnowledgeSnapshot(): string {
  const areaList = AREAS.map(a => `${a.name}(id:${a.id},PIN:${a.pincode},tier:${a.tier},region:${a.region})`).join("|");
  const parkList = GEO_TECH_PARKS.map(p => `${p.name}[id:${p.id},area:${p.area}]`).join(",");
  const metroList = METRO_STATIONS.map(m => `${m.name}(${m.line})`).join(",");
  return `AREAS:${areaList}\nTECH_PARKS:${parkList}\nMETRO:${metroList}`;
}

export function fmtAmt(n: number): string {
  if (n >= 10000000) return (n / 10000000).toFixed(1).replace(/\.0$/, "") + "Cr";
  if (n >= 100000) return (n / 100000).toFixed(1).replace(/\.0$/, "") + "L";
  if (n >= 1000) return (n / 1000).toFixed(0) + "k";
  return String(n);
}

export function matchAreaToDb(text: string): AreaEntry | null {
  if (!text) return null;
  const t = text.toLowerCase();
  let best: AreaEntry | null = null, bestScore = 0;
  for (const a of AREAS) {
    const nameLower = a.name.toLowerCase();
    let score = 0;
    if (t.includes(nameLower)) score += 10;
    const first = nameLower.split(" ")[0];
    if (first.length > 3 && t.includes(first)) score += 5;
    if (t.includes(a.id.replace(/_/g, " "))) score += 8;
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return bestScore > 0 ? best : null;
}

export type EnrichedAreaIntel = AreaEntry & {
  metros: (MetroStationEntry & { dist: number })[];
  techParks: (TechParkEntry & { dist: number })[];
};

export function enrichLeadGeo(lead: { location?: string; rawText?: string; areas?: string[] }) {
  const searchText = [lead.location, lead.rawText, ...(lead.areas || [])].filter(Boolean).join(" ");
  const t = searchText.toLowerCase();
  const matchedAreas: AreaEntry[] = [];
  const seen = new Set<string>();
  for (const areaStr of (lead.areas || [lead.location]).filter(Boolean) as string[]) {
    const match = matchAreaToDb(areaStr);
    if (match && !seen.has(match.id)) { seen.add(match.id); matchedAreas.push(match); }
  }
  if (!matchedAreas.length && lead.location) {
    const m = matchAreaToDb(lead.location);
    if (m) matchedAreas.push(m);
  }
  const areaIntel: EnrichedAreaIntel[] = matchedAreas.map(area => ({
    ...area,
    metros: nearestMetro(area.lat, area.lng, 3),
    techParks: nearestTechParks(area.lat, area.lng, 3),
  }));
  const matchedPark = GEO_TECH_PARKS.find(p => p.kw.some(k => t.includes(k))) || null;
  return { areaIntel, matchedPark };
}

// ═══════════════════════════════════════════════════════════════════════
//  FIELD DISPLAY CONFIG
// ═══════════════════════════════════════════════════════════════════════
export const FDISPLAY = [
  { key: "name", label: "Name", icon: "👤" },
  { key: "phone", label: "Phone", icon: "📱" },
  { key: "email", label: "Email", icon: "✉️" },
  { key: "location", label: "Areas", icon: "📍" },
  { key: "fullAddress", label: "Full Address", icon: "🏠" },
  { key: "budget", label: "Budget", icon: "💰" },
  { key: "moveIn", label: "Move in date", icon: "📅" },
  { key: "type", label: "Type", icon: "💼" },
  { key: "room", label: "Room", icon: "🛏" },
  { key: "need", label: "Need", icon: "👥" },
  { key: "specialReqs", label: "Special Reqs", icon: "⭐" },
];
