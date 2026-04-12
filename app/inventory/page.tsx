'use client';

/**
 * GHARPAYY INVENTORY OS (PLATFORM-CENTRIC v3.1 - COMPACT)
 * ────────────────────────────────────────────────────────
 * Optimized layout: Small by default.
 * Room Inventory and Details both hidden initially to save space.
 * Mobile-responsive: single column, area drawer, no sidebar crush.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import {
  Search, MapPin, Check, ChevronDown, ChevronUp,
  Calendar, X, LayoutGrid, List, DollarSign, FileText
} from 'lucide-react';
import brochureMap from '@/data/brochureMap.json';
import { PG_DATA, type PGEntry } from '@/data/pgMasterData';
import { fetchLivePGData } from '@/lib/sheetsSync';
import { ROOM_MASTER, getRoomsForPG, type Room } from '@/data/roomMasterData';
import { ZONES, SUBZONE_MAPPING, getZoneByArea } from '@/lib/zones';
import { AREAS_LIST, getSubAreasForArea, matchPropertyToGeo, GEO_MASTER } from '@/lib/geoMaster';
import SearchableSelect from '@/components/SearchableSelect';
import { toast } from 'sonner';
import { useRoomStore, type VisitData, type RoomState } from '@/hooks/useInventoryStore';

const T = {
  bg0: '#F8F9FA', bg1: '#FFFFFF', bg2: '#FFF6F4', bg3: '#FFFFFF', bg4: '#FEF3C7',
  line: '#FEE2E2', lineH: '#FECACA', lineA: '#FCA5A5',
  t0: '#111827', t1: '#4B5563', t2: '#9CA3AF', t3: '#E5E7EB',
  white: '#FFFFFF',
  gold: '#F97316', goldD: 'rgba(249,115,22,0.08)', goldB: 'rgba(249,115,22,0.28)',
  green: '#16A34A', greenD: 'rgba(22,163,74,0.09)', greenB: 'rgba(22,163,74,0.28)',
  amber: '#D97706', amberD: 'rgba(217,119,6,0.09)', amberB: 'rgba(217,119,6,0.28)',
  red: '#DC2626', redD: 'rgba(220,38,38,0.09)', redB: 'rgba(220,38,38,0.28)',
  blue: '#2563EB', blueD: 'rgba(37,99,235,0.09)', blueB: 'rgba(37,99,235,0.28)',
  violet: '#7C3AED', violetD: 'rgba(124,58,237,0.09)', violetB: 'rgba(124,58,237,0.28)',
  sans: "'DM Sans', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  LOCKED:      { label: 'Live',       color: '#22C55E', bg: 'rgba(34,197,94,0.1)',    dot: '#22C55E' },
  AVAILABLE:   { label: 'Live',       color: '#22C55E', bg: 'rgba(34,197,94,0.1)',    dot: '#22C55E' },
  APPROVED:    { label: 'Live',       color: '#22C55E', bg: 'rgba(34,197,94,0.1)',    dot: '#22C55E' },
  SOFT_LOCKED: { label: 'Tour Hold',  color: '#60A5FA', bg: 'rgba(96,165,250,0.1)',   dot: '#60A5FA' },
  HARD_LOCKED: { label: 'Pre-Booked', color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', dot: '#A78BFA' },
  OCCUPIED:    { label: 'Occupied',   color: '#EF4444', bg: 'rgba(239,68,68,0.1)',    dot: '#EF4444' },
};

// ─── MOBILE HOOK ──────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

const getMinPrice = (p: PGEntry) => {
  if (p.minPrice && p.minPrice > 5000) return p.minPrice;
  const prices = [p.triplePrice, p.doublePrice, p.singlePrice]
    .filter(v => typeof v === 'number' && v > 5000) as number[];
  if (prices.length > 0) return Math.min(...prices);
  const masterMatch = PG_DATA.find(pg => pg.name.toLowerCase() === p.name.toLowerCase());
  if (masterMatch) {
    const mp = [masterMatch.triplePrice, masterMatch.doublePrice, masterMatch.singlePrice]
      .filter(v => typeof v === 'number' && v > 5000) as number[];
    if (mp.length > 0) return Math.min(...mp);
  }
  return 0;
};

const formatPrice = (price: number) => {
  if (!price || price <= 0) return '₹—';
  return `from ₹${(price / 1000).toFixed(1)}k/mo`;
};

const AREAS   = ['All', ...Array.from(new Set(PG_DATA.map(p => p.area).filter(Boolean))).sort()];
const GENDERS = ['All', 'Boys', 'Girls', 'coed'];

// ─── VISIT SCHEDULING MODAL ──────────────────────────
const TourModal = ({ pg, onClose, onSchedule }: {
  pg: PGEntry;
  onClose: () => void;
  onSchedule: (roomId: string, v: VisitData) => void;
}) => {
  const { getRoom } = useRoomStore();
  const rooms = useMemo(() => getRoomsForPG(pg.id).filter(r => getRoom(r).status !== 'OCCUPIED'), [pg.id, getRoom]);
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id || '');
  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [tourType, setTourType]   = useState<'Physical' | 'Virtual'>('Physical');
  const [date, setDate]           = useState('');
  const [time, setTime]           = useState('');
  const [notes, setNotes]         = useState('');
  const canSubmit = !!name && !!date && !!time && !!selectedRoomId;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.bg2, border: `1px solid ${T.lineH}`, borderRadius: 14, padding: '22px 20px', width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.blue, letterSpacing: '0.1em', marginBottom: 3 }}>SCHEDULE TOUR</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: T.t0 }}>{pg.name}</div>
          </div>
          <button onClick={onClose} style={{ background: T.bg3, border: `1px solid ${T.line}`, borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={14} style={{ color: T.t1 }} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: 8, color: T.t2, letterSpacing: '0.08em', marginBottom: 6 }}>SELECT ROOM *</div>
            <select value={selectedRoomId} onChange={e => setSelectedRoomId(e.target.value)}
              style={{ width: '100%', background: T.bg3, border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: T.t0, fontFamily: T.mono }}>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>Room {r.num} · {r.type} · ₹{r.basePrice.toLocaleString()}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <button onClick={() => setTourType('Physical')} style={{ flex: 1, padding: '8px', fontSize: 11, fontWeight: 700, borderRadius: 8, border: `1px solid ${tourType === 'Physical' ? T.blue : T.line}`, background: tourType === 'Physical' ? T.blueD : T.bg3, color: tourType === 'Physical' ? T.blue : T.t1, cursor: 'pointer' }}>Physical Tour</button>
            <button onClick={() => setTourType('Virtual')} style={{ flex: 1, padding: '8px', fontSize: 11, fontWeight: 700, borderRadius: 8, border: `1px solid ${tourType === 'Virtual' ? T.blue : T.line}`, background: tourType === 'Virtual' ? T.blueD : T.bg3, color: tourType === 'Virtual' ? T.blue : T.t1, cursor: 'pointer' }}>Online Tour</button>
          </div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Customer Name *" style={{ width: '100%', background: T.bg3, border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: T.t0 }} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone Number" style={{ width: '100%', background: T.bg3, border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: T.t0 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ flex: 1, background: T.bg3, border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: T.t0, colorScheme: 'dark' }} />
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ flex: 1, background: T.bg3, border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: T.t0, colorScheme: 'dark' }} />
          </div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." rows={2} style={{ width: '100%', background: T.bg3, border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: T.t0, resize: 'none' }} />
          <button onClick={() => canSubmit && onSchedule(selectedRoomId, {
            customerName: name, phone, visitType: tourType, date, time, notes, scheduledAt: new Date().toISOString()
          })} disabled={!canSubmit}
            style={{ width: '100%', background: canSubmit ? T.blue : T.bg4, color: canSubmit ? '#fff' : T.t2, border: 'none', borderRadius: 8, padding: '12px', fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
            Schedule Tour
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ROOM ROW ─────────────────────────────────────────
const RoomRow = ({ room, state }: { room: Room; state: RoomState }) => {
  const cfg = STATUS_CFG[state.status] || STATUS_CFG.LOCKED;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, marginBottom: 4 }}>
      <div style={{ width: 28, height: 28, borderRadius: 5, background: T.bg3, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.line}`, fontFamily: T.mono, fontSize: 10, color: T.t0, fontWeight: 700 }}>{room.num}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: T.sans, fontSize: 11, color: T.t0, fontWeight: 600 }}>{room.type}</div>
      </div>
      <div style={{ background: cfg.bg, borderRadius: 3, padding: '1px 4px', border: `1px solid ${cfg.color}20` }}>
        <span style={{ fontFamily: T.mono, fontSize: 7, color: cfg.color, fontWeight: 700 }}>{cfg.label.toUpperCase()}</span>
      </div>
      <div style={{ textAlign: 'right', minWidth: 60 }}>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.t1, fontWeight: 700 }}>₹{(state.retailPrice || state.expectedRent || room.basePrice).toLocaleString()}</div>
      </div>
    </div>
  );
};

const StatusBtn = ({ label, color, bg, border, active, onClick }: any) => (
  <button onClick={onClick} style={{
    background: bg, color, padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 800,
    border: `1px solid ${active ? color : border}`, cursor: 'pointer', transition: 'all 0.1s ease',
    opacity: active ? 1 : 0.6, transform: active ? 'scale(1.05)' : 'scale(1)',
    display: 'flex', alignItems: 'center', whiteSpace: 'nowrap'
  }}>
    {label}
  </button>
);

function getBrochureUrl(name: string): string | null {
  if (!name) return null;
  const map = brochureMap as Record<string, string>;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = normalize(name.replace(/^gharpayy\s+/i, '').replace(/^gg\s+/i, ''));
  if (map[key]) return `/brochures/${map[key]}`;
  const first = name.trim().split(/\s+/)[0]?.toLowerCase();
  if (map[first]) return `/brochures/${map[first]}`;
  const all = Object.keys(map);
  const substr = all.find(k => key.includes(k) || k.includes(key));
  if (substr) return `/brochures/${map[substr]}`;
  return null;
}

// ─── MAIN PROPERTY CARD ───────────────────────────────
const PropertyCard = ({
  pg, idx, pgRooms, onScheduleVisit, viewMode = 'grid'
}: {
  pg: PGEntry;
  idx: number;
  pgRooms: (Room & { state: RoomState })[];
  onScheduleVisit: () => void;
  viewMode?: 'grid' | 'list';
}) => {
  const [expanded, setExpanded]           = useState(false);
  const [roomsExpanded, setRoomsExpanded] = useState(false);
  const [copiedWA, setCopiedWA]           = useState(false);
  const [copiedMap, setCopiedMap]         = useState(false);
  const minPrice = getMinPrice(pg);

  const genderConfig = pg.gender?.toLowerCase().includes('girl') || pg.gender?.toLowerCase().includes('female')
    ? { color: '#EC4899', bg: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.22)', label: 'Girls' }
    : pg.gender?.toLowerCase().includes('boy') || pg.gender?.toLowerCase().includes('male')
      ? { color: T.blue, bg: T.blueD, border: T.blueB, label: 'Boys' }
      : { color: T.t1, bg: T.bg3, border: T.line, label: 'coed' };

  const copyWA = (e: React.MouseEvent) => {
    e.stopPropagation();
    const t_was = pg.triplePrice ? Math.round((pg.triplePrice + 2000) / 1000) : 15;
    const t_now = pg.triplePrice ? Math.round(pg.triplePrice / 1000) : 13;
    const d_was = pg.doublePrice ? Math.round((pg.doublePrice + 2000) / 1000) : 18;
    const d_now = pg.doublePrice ? Math.round(pg.doublePrice / 1000) : 16;
    const s_was = pg.singlePrice ? Math.round((pg.singlePrice + 2000) / 1000) : 27;
    const s_now = pg.singlePrice ? Math.round(pg.singlePrice / 1000) : 23;
    const msg =
      `⚡️ Welcome to Gharpayy ${pg.name.toUpperCase()} - ${(pg.gender || 'COED').toUpperCase()}! ⚡️ ❤️ We're thrilled you loved our rooms.🚀 *Exclusive Offer Alert:* **2K OFF MONTHLY** \n\n` +
      `🧡Triple Sharing. - ~Was ${t_was}K~, **now only ${t_now}k!*\n` +
      `💛Dual Sharing. - ~Originally ${d_was}K~, **now just ${d_now}K!*\n` +
      `❤️Private rooms - ~Formerly ${s_was}k~, **now specially priced at ${s_now}K!*\n\n` +
      `💥 Act Fast: Lock in your reservation NOW and save 2000+ RS every month on a 12-month stay! *Offer expires in 4 hours. *Prebook* now for just 20k!*🔥   enjoy complimentary good food.`;
    navigator.clipboard.writeText(msg);
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 2000);
    toast.success('Exclusive Offer Message Copied! ⚡️');
  };

  const copyMap = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Copy the raw location message from col N (locationMsg), fall back to a minimal string
    const msg = pg.locationMsg || `📍 ${pg.name.toUpperCase()} — ${pg.locality || pg.area || 'Bangalore'}`;
    navigator.clipboard.writeText(msg);
    setCopiedMap(true);
    setTimeout(() => setCopiedMap(false), 2000);
    toast.success('Location Message copied! 📍');
  };

  const isList = viewMode === 'list';

  return (
    <div className={`gp-card ${isList ? 'inventory-list-card' : ''}`} style={{
      background: T.bg2,
      border: `1px solid ${T.line}`,
      borderRadius: 12,
      overflow: 'hidden',
      width: '100%',
      height: 'fit-content',
      transition: 'all 0.2s',
      display: isList ? 'flex' : 'block',
      alignItems: isList ? 'stretch' : undefined,
    }}>

      {/* Header */}
      <div style={{ padding: '14px 16px', flex: isList ? 1 : 'none', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h3 style={{ fontFamily: T.sans, fontWeight: 800, fontSize: 14, color: '#111827', margin: 0, letterSpacing: '-0.01em', minWidth: 0, wordBreak: 'break-word' }}>{pg.name.toUpperCase()}</h3>
              <span style={{ fontFamily: T.mono, fontSize: 8, color: T.gold, fontWeight: 800, background: T.goldD, padding: '2px 4px', borderRadius: 4, flexShrink: 0 }}>{pg.pid}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, minWidth: 0 }}>
              <MapPin size={10} style={{ color: T.t2, flexShrink: 0 }} />
              <span style={{ fontFamily: T.mono, fontSize: 9, color: T.t2, fontWeight: 600 }}>{pg.area}</span>
              {pg.landmarks && <span style={{ fontFamily: T.mono, fontSize: 8, color: T.t2, marginLeft: 6, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>• {pg.landmarks}</span>}
            </div>
          </div>
          {!isList && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ color: T.gold, fontWeight: 900, fontSize: 13, textTransform: 'uppercase' }}>{formatPrice(minPrice)}</div>
              <div style={{ fontFamily: T.mono, fontSize: 8, color: T.t2, fontWeight: 700, marginTop: 2 }}>
                {[
                  pg.triplePrice && pg.triplePrice > 0 ? `T:₹${Math.round(pg.triplePrice / 1000)}k` : null,
                  pg.doublePrice && pg.doublePrice > 0 ? `D:₹${Math.round(pg.doublePrice / 1000)}k` : null,
                  pg.singlePrice && pg.singlePrice > 0 ? `S:₹${Math.round(pg.singlePrice / 1000)}k` : null,
                ].filter(Boolean).join(' ')}
              </div>
            </div>
          )}
        </div>

        {/* Essential Badges */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
          <span style={{ background: genderConfig.bg, color: genderConfig.color, border: `1px solid ${genderConfig.border}`, borderRadius: 6, fontFamily: T.mono, fontSize: 8, fontWeight: 800, padding: '2px 8px' }}>
            {genderConfig.label.toUpperCase()}
          </span>
          {pg.propertyType && <span style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 6, fontFamily: T.mono, fontSize: 8, fontWeight: 800, padding: '2px 8px' }}>{pg.propertyType.toUpperCase()}</span>}
          {pgRooms.some(r => r.state.status === 'APPROVED') && <span style={{ background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 6, fontFamily: T.mono, fontSize: 8, fontWeight: 800, padding: '2px 8px' }}>LIVE</span>}
          {pgRooms.some(r => r.state.status === 'SOFT_LOCKED') && <span style={{ background: '#DBEAFE', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 6, fontFamily: T.mono, fontSize: 8, fontWeight: 800, padding: '2px 8px' }}>BOOKED</span>}
          {pg.managerContact && <span style={{ background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 6, fontFamily: T.mono, fontSize: 8, fontWeight: 800, padding: '2px 8px' }}>MGR: {pg.managerContact}</span>}
        </div>
      </div>

      {isList && (
        <div className="list-price-panel" style={{ width: 150, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: `1px solid ${T.line}`, padding: '0 12px', background: '#fff', flexShrink: 0 }}>
          <div style={{ color: T.gold, fontWeight: 900, fontSize: 13 }}>{formatPrice(minPrice)}</div>
          <div style={{ fontFamily: T.mono, fontSize: 8, color: T.t2, fontWeight: 700, marginTop: 2 }}>
            {[
              pg.triplePrice && pg.triplePrice > 0 ? `T:₹${Math.round(pg.triplePrice / 1000)}k` : null,
              pg.doublePrice && pg.doublePrice > 0 ? `D:₹${Math.round(pg.doublePrice / 1000)}k` : null,
              pg.singlePrice && pg.singlePrice > 0 ? `S:₹${Math.round(pg.singlePrice / 1000)}k` : null,
            ].filter(Boolean).join(' ')}
          </div>
        </div>
      )}

      {/* Rooms Drawer */}
      {!isList && (
        <div style={{ borderTop: `1px solid ${T.line}` }}>
          <button onClick={() => setRoomsExpanded(!roomsExpanded)}
            style={{ width: '100%', background: roomsExpanded ? 'rgba(255,255,255,0.03)' : 'transparent', border: 'none', borderBottom: roomsExpanded ? `1px solid ${T.line}` : 'none', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: '#111827', fontFamily: T.mono, fontSize: 9 }}>
            <span style={{ fontWeight: 900 }}>ROOM INVENTORY ({pgRooms.filter(r => r.state.status !== 'LOCKED').length})</span>
            {roomsExpanded ? <ChevronUp size={12} strokeWidth={3} /> : <ChevronDown size={12} strokeWidth={3} />}
          </button>
          {roomsExpanded && (
            <div style={{ padding: '8px 12px' }}>
              {pgRooms.map(r => <RoomRow key={r.id} room={r} state={r.state} />)}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        gap: 8,
        borderTop: isList ? 'none' : `1px solid ${T.line}`,
        borderLeft: isList ? `1px solid ${T.line}` : 'none',
        width: isList ? 300 : '100%',
        flexShrink: isList ? 0 : undefined,
        alignItems: 'center',
        background: '#fff',
        boxSizing: 'border-box',
      }}>
        <button onClick={onScheduleVisit}
          style={{ flex: isList ? 'none' : 2, background: '#fff', border: `1.5px solid #000`, borderRadius: 8, padding: '10px 14px', fontSize: 11, color: '#000', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', boxShadow: '1px 1px 0 #000' }}>
          <Calendar size={13} strokeWidth={3} /> TOUR
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { const url = getBrochureUrl(pg.name); if (url) window.open(url, '_blank'); }} title="Download Brochure"
            style={{ background: '#fff', border: `1.5px solid #000`, borderRadius: 8, padding: '10px', display: 'flex', alignItems: 'center', color: '#000', cursor: 'pointer', boxShadow: '1px 1px 0 #000' }}>
            <FileText size={14} strokeWidth={3} />
          </button>
          <button onClick={copyWA} title="Copy WhatsApp Offer"
            style={{ background: '#fff', border: `1.5px solid #000`, borderRadius: 8, padding: '10px', display: 'flex', alignItems: 'center', color: copiedWA ? '#16A34A' : '#000', cursor: 'pointer', boxShadow: '1px 1px 0 #000' }}>
            {copiedWA ? <Check size={14} strokeWidth={3} /> : <DollarSign size={14} strokeWidth={3} />}
          </button>
          <button onClick={copyMap} title="Copy Map Location"
            style={{ background: '#fff', border: `1.5px solid #000`, borderRadius: 8, padding: '10px', display: 'flex', alignItems: 'center', color: copiedMap ? '#16A34A' : '#000', cursor: 'pointer', boxShadow: '1px 1px 0 #000' }}>
            {copiedMap ? <Check size={14} strokeWidth={3} /> : <MapPin size={14} strokeWidth={3} />}
          </button>
        </div>
        <button onClick={() => setExpanded(!expanded)}
          style={{ flex: isList ? 'none' : 1, background: 'none', border: 'none', padding: '8px', fontSize: 11, color: T.t2, fontWeight: 600, cursor: 'pointer' }}>
          {expanded ? 'Hide' : 'Details'}
        </button>
      </div>

      {/* Details Drawer */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${T.line}`, padding: '16px 14px', background: T.bg3, animation: 'fadeIn 0.2s', width: isList ? '100%' : 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
            <div><div style={{ fontFamily: T.mono, fontSize: 8, color: '#111827', fontWeight: 900, marginBottom: 2 }}>DEPOSIT</div><div style={{ fontSize: 10, color: T.t1 }}>{pg.deposit || '—'}</div></div>
            <div><div style={{ fontFamily: T.mono, fontSize: 8, color: '#111827', fontWeight: 900, marginBottom: 2 }}>MIN STAY</div><div style={{ fontSize: 10, color: T.t1 }}>{pg.minStay || '—'}</div></div>
            <div><div style={{ fontFamily: T.mono, fontSize: 8, color: '#111827', fontWeight: 900, marginBottom: 2 }}>MEALS</div><div style={{ fontSize: 10, color: T.t1 }}>{pg.meals || '—'}</div></div>
          </div>
          {pg.vibe && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: T.mono, fontSize: 8, color: '#111827', fontWeight: 900, marginBottom: 4 }}>BRAND VIBE</div>
              <div style={{ fontSize: 11, color: T.t1, lineHeight: 1.5 }}>{pg.vibe}</div>
            </div>
          )}
          {pg.houseRules && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: T.mono, fontSize: 8, color: '#111827', fontWeight: 900, marginBottom: 4 }}>HOUSE RULES</div>
              <div style={{ fontSize: 11, color: T.t1, fontWeight: 700, textTransform: 'uppercase' }}>{pg.houseRules}</div>
            </div>
          )}
          {pg.amenities && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {pg.amenities.slice(0, 12).map(a => <span key={a} style={{ background: '#fff', border: `1.5px solid #000`, color: '#000', fontWeight: 800, padding: '3px 8px', borderRadius: 6, fontSize: 9 }}>{a}</span>)}
              {(pg.commonAreas || []).map(a => <span key={a} style={{ background: T.amberD, border: `1.5px solid ${T.amber}`, color: T.amber, fontWeight: 800, padding: '3px 8px', borderRadius: 6, fontSize: 9 }}>🏠 {a}</span>)}
            </div>
          )}
          {pg.safety && pg.safety.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {pg.safety.map(s => <span key={s} style={{ background: T.redD, border: `1.5px solid ${T.red}`, color: T.red, fontWeight: 800, padding: '3px 8px', borderRadius: 6, fontSize: 9 }}>🛡️ {s}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────
export default function InventoryPage() {
  const [pgDataLive, setPgDataLive]           = useState<PGEntry[]>(PG_DATA);
  const [isSyncing, setIsSyncing]             = useState(false);
  const [search, setSearch]                   = useState('');
  const [areaFilter, setAreaFilter]           = useState('All');
  const [cityZoneFilter, setCityZoneFilter]   = useState('All');
  const [subAreaFilter, setSubAreaFilter]     = useState('All');
  const [genderFilter, setGenderFilter]       = useState('All');
  const [statusFilter, setStatusFilter]       = useState<string>('All');
  const [areaSidebarSearch, setAreaSidebarSearch] = useState('');
  const [areaDrawerOpen, setAreaDrawerOpen]   = useState(false);

  const { snapshot, getRoom, scheduleVisit, getPGStats, getGlobalStats } = useRoomStore();
  const [visitTarget, setVisitTarget] = useState<PGEntry | null>(null);
  const [viewMode, setViewMode]       = useState<'grid' | 'list'>('grid');
  const isMobile = useIsMobile();

  useEffect(() => {
    const sync = async () => {
      setIsSyncing(true);
      setPgDataLive([]);
      try {
        const [iqData, masterRes] = await Promise.all([
          fetchLivePGData(),
          fetch('/api/sheets/master')
        ]);

        let masterData: PGEntry[]       = [];
        let inactiveNames: Set<string>  = new Set();

        if (masterRes.ok) {
          const masterJson = await masterRes.json();
          masterData    = masterJson.active ?? [];
          inactiveNames = new Set((masterJson.inactiveNames ?? []).map((n: string) => n.toLowerCase()));
        } else {
          const errText = await masterRes.text();
          console.error('Master route failed:', masterRes.status, errText);
          toast.error(`Master sheet error: ${masterRes.status}`);
        }

        const filteredIQ   = iqData.filter(p => !inactiveNames.has(p.name.toLowerCase()));
        const iqNames      = new Set(filteredIQ.map(p => p.name.toLowerCase()));
        const uniqueMaster = masterData.filter(p => !iqNames.has(p.name.toLowerCase()));
        const combined     = [...filteredIQ, ...uniqueMaster];

        if (combined.length > 0) {
          setPgDataLive(combined);
          toast.success(`Synced ${combined.length} PGs from Sheet ✅`);
        } else {
          setPgDataLive(PG_DATA);
          toast.error('Sheet returned 0 PGs — showing cached data');
        }
      } catch (e) {
        console.error('Sync failed', e);
        toast.error(`Sync failed: ${String(e)}`);
        setPgDataLive(PG_DATA);
      }
      setIsSyncing(false);
    };
    sync();
  }, []);

  const filtered = useMemo(() => {
    return pgDataLive.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q || (p.name || '').toLowerCase().includes(q) || (p.area || '').toLowerCase().includes(q);
      const normalize = (s: string) => (s || '').toLowerCase().replace(/[\s-]/g, '');

      let matchCityZone = true;
      if (cityZoneFilter !== 'All') {
        const pz = getZoneByArea(p.locality || p.area || '').zone;
        matchCityZone = pz === cityZoneFilter;
      }

      let matchArea = true;
      if (areaFilter !== 'All') {
        const qz    = normalize(areaFilter);
        const pzArea = normalize(p.area || p.locality || '');
        matchArea = pzArea.includes(qz);
      }

      let matchSubArea = true;
      if (subAreaFilter !== 'All') {
        const qs = normalize(subAreaFilter);
        const ps = normalize(`${p.locality} ${p.area} ${p.name} ${p.subArea}`);
        matchSubArea = ps.includes(qs);
      }

      const matchGender = genderFilter === 'All'
        || p.gender?.toLowerCase().includes(genderFilter.toLowerCase().slice(0, 3))
        || (genderFilter === 'coed' && p.gender?.toLowerCase().includes('co'));

      let matchStatus = true;
      if (statusFilter !== 'All') {
        const pgRooms = getRoomsForPG(p.id);
        const states  = pgRooms.map(r => getRoom(r));
        if (statusFilter === 'LIVE')     matchStatus = states.some(s => s.status === 'APPROVED');
        else if (statusFilter === 'SCHED')    matchStatus = states.some(s => s.status === 'SOFT_LOCKED');
        else if (statusFilter === 'OCCUPIED') matchStatus = states.some(s => s.status === 'OCCUPIED');
      }

      return matchSearch && matchCityZone && matchArea && matchSubArea && matchGender && matchStatus;
    });
  }, [search, cityZoneFilter, areaFilter, subAreaFilter, genderFilter, statusFilter, getRoom, pgDataLive]);

  const stats = useMemo(() => getGlobalStats(ROOM_MASTER), [getGlobalStats, snapshot]);

  const areasWithPGs = useMemo(() =>
    Array.from(new Set(pgDataLive.map(p => (p.area || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [pgDataLive]
  );

  const sidebarAreas = useMemo(() => {
    let list = areasWithPGs;
    if (cityZoneFilter !== 'All') list = list.filter(a => getZoneByArea(a).zone === cityZoneFilter);
    if (areaSidebarSearch.trim()) {
      const q = areaSidebarSearch.toLowerCase();
      list = list.filter(a => a.toLowerCase().includes(q));
    }
    return list;
  }, [areasWithPGs, cityZoneFilter, areaSidebarSearch]);

  const handleScheduleAction = (pg: PGEntry, roomId: string, v: VisitData) => {
    const room = ROOM_MASTER.find(r => r.id === roomId);
    if (room) scheduleVisit(room, v);
    setVisitTarget(null);
    toast.success('Tour scheduled');
  };

  // ─── SHARED AREA LIST (used in both sidebar and mobile drawer) ────────────
  const AreaList = ({ onSelect }: { onSelect?: () => void }) => (
    <>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Search size={10} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: T.t2 }} />
        <input
          value={areaSidebarSearch}
          onChange={e => setAreaSidebarSearch(e.target.value)}
          placeholder="Search area..."
          style={{ width: '100%', background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 6, padding: '7px 8px 7px 26px', fontSize: 11, color: T.t0, boxSizing: 'border-box' }}
        />
      </div>
      <button
        onClick={() => { setAreaFilter('All'); onSelect?.(); }}
        style={{ width: '100%', textAlign: 'left', padding: '7px 8px', borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: 'pointer', marginBottom: 3, border: areaFilter === 'All' ? '1.5px solid #000' : '1px solid transparent', background: areaFilter === 'All' ? '#111827' : 'transparent', color: areaFilter === 'All' ? '#fff' : T.t1, transition: 'all 0.12s' }}>
        All Areas
      </button>
      {sidebarAreas.map(area => {
        const count    = pgDataLive.filter(p => (p.area || '').toLowerCase() === area.toLowerCase()).length;
        const isActive = areaFilter === area;
        return (
          <button key={area} onClick={() => { setAreaFilter(isActive ? 'All' : area); onSelect?.(); }}
            style={{ width: '100%', textAlign: 'left', padding: '7px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: isActive ? '1.5px solid #000' : '1px solid transparent', background: isActive ? '#111827' : 'transparent', color: isActive ? '#fff' : T.t1, transition: 'all 0.12s' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{area}</span>
            <span style={{ fontSize: 9, fontWeight: 900, background: isActive ? 'rgba(255,255,255,0.2)' : T.goldD, color: isActive ? '#fff' : T.gold, padding: '1px 5px', borderRadius: 10, flexShrink: 0 }}>{count}</span>
          </button>
        );
      })}
    </>
  );

  return (
    <AppLayout title="Inventory OS" subtitle="Platform Truth">
      <div style={{ minHeight: '100vh', background: T.bg0, color: T.t0, fontFamily: T.sans, paddingBottom: 80 }}>

        {/* ── Sticky Filter Bar ── */}
        <div style={{ background: T.bg1, borderBottom: `1px solid ${T.line}`, position: 'sticky', top: 0, zIndex: 100, padding: '8px 12px' }}>
          <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 6 }}>

            {/* Row 1: Title + status btns + view toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 15, fontWeight: 800, margin: 0, whiteSpace: 'nowrap' }}>Inventory OS</h1>
              {isSyncing && (
                <div style={{ fontSize: 9, color: T.gold, background: T.goldD, padding: '2px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 8, height: 8, border: `2px solid ${T.gold}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Syncing...
                </div>
              )}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                <StatusBtn label="ALL" color={T.t1} bg={T.bg3} border={T.line} active={statusFilter === 'All'} onClick={() => setStatusFilter('All')} />
                <StatusBtn label={`${stats.live} LIVE`} color={T.green} bg={T.greenD} border={T.greenB} active={statusFilter === 'LIVE'} onClick={() => setStatusFilter('LIVE')} />
                <StatusBtn label={`${stats.scheduled} SCHED`} color={T.blue} bg={T.blueD} border={T.blueB} active={statusFilter === 'SCHED'} onClick={() => setStatusFilter('SCHED')} />
                <StatusBtn label={`${stats.occupied} OCC`} color="#EF4444" bg="rgba(239,68,68,0.1)" border="rgba(239,68,68,0.3)" active={statusFilter === 'OCCUPIED'} onClick={() => setStatusFilter('OCCUPIED')} />
              </div>
              {/* View toggle + mobile areas button */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {isMobile && (
                  <button onClick={() => setAreaDrawerOpen(true)}
                    style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 7, padding: '5px 10px', fontSize: 10, fontWeight: 800, color: T.t1, cursor: 'pointer' }}>
                    📍 Areas
                  </button>
                )}
                <div style={{ display: 'flex', background: T.bg2, borderRadius: 7, padding: 2, border: `1px solid ${T.line}` }}>
                  <button onClick={() => setViewMode('grid')} style={{ padding: '5px 8px', borderRadius: 5, background: viewMode === 'grid' ? T.bg4 : 'transparent', border: 'none', color: viewMode === 'grid' ? T.t0 : T.t2, cursor: 'pointer' }}>
                    <LayoutGrid size={13} />
                  </button>
                  <button onClick={() => setViewMode('list')} style={{ padding: '5px 8px', borderRadius: 5, background: viewMode === 'list' ? T.bg4 : 'transparent', border: 'none', color: viewMode === 'list' ? T.t0 : T.t2, cursor: 'pointer' }}>
                    <List size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Zone pills */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, paddingTop: 4, scrollbarWidth: 'none' }}>
              {[{ key: 'All', label: 'All Zones' }, ...Object.keys(ZONES).map(k => ({ key: k, label: k }))].map(z => (
                <button key={z.key} onClick={() => { setCityZoneFilter(z.key); setAreaFilter('All'); setSubAreaFilter('All'); }}
                  style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
                    border: cityZoneFilter === z.key ? '1.5px solid #000' : `1px solid ${T.line}`,
                    background: cityZoneFilter === z.key ? '#111827' : T.bg2,
                    color: cityZoneFilter === z.key ? '#fff' : T.t1,
                    boxShadow: cityZoneFilter === z.key ? '1px 1px 0 #000' : 'none',
                    transition: 'all 0.15s',
                  }}>{z.label}</button>
              ))}
            </div>

            {/* Row 3: Search + Gender */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%', paddingTop: 2 }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: T.t2 }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search PG..."
                  style={{ width: '100%', background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 6, padding: '7px 8px 7px 24px', color: T.t0, fontSize: 11, boxSizing: 'border-box' }} />
              </div>
              <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)}
                style={{ background: T.bg2, border: `1px solid ${genderFilter !== 'All' ? T.goldB : T.line}`, borderRadius: 6, color: T.t0, padding: '7px 8px', fontSize: 11, flexShrink: 0 }}>
                <option value="All">All Genders</option>
                <option value="Boys">Boys</option>
                <option value="Girls">Girls</option>
                <option value="coed">Co-live</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Mobile Area Drawer ── */}
        {isMobile && areaDrawerOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setAreaDrawerOpen(false)} />
            <div style={{ position: 'relative', background: T.bg1, borderRadius: '16px 16px 0 0', padding: '16px 14px 40px', maxHeight: '72vh', overflowY: 'auto', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: T.t2, letterSpacing: '0.08em', fontFamily: T.mono }}>AREAS WITH PGs</div>
                <button onClick={() => setAreaDrawerOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: T.t1, lineHeight: 1 }}>✕</button>
              </div>
              <AreaList onSelect={() => setAreaDrawerOpen(false)} />
            </div>
          </div>
        )}

        {/* ── Main layout ── */}
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '16px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>

          {/* Property Cards */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className={viewMode === 'grid' ? 'inventory-grid' : ''}
              style={{
                display: viewMode === 'grid' ? 'grid' : 'flex',
                // single column on mobile, two on desktop
                gridTemplateColumns: viewMode === 'grid'
                  ? (isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))')
                  : undefined,
                flexDirection: viewMode === 'list' ? 'column' : undefined,
                alignItems: 'stretch',
                gap: 12,
              }}
            >
              {filtered.map((pg, idx) => {
                const pgRooms = getRoomsForPG(pg.id).map(r => ({ ...r, state: getRoom(r) }));
                return (
                  <PropertyCard key={pg.id} pg={pg} idx={idx}
                    pgRooms={pgRooms}
                    viewMode={viewMode}
                    onScheduleVisit={() => setVisitTarget(pg)} />
                );
              })}
              {filtered.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: T.t2, fontSize: 13 }}>No PGs match your filters.</div>
              )}
            </div>
          </div>

          {/* Area Sidebar — desktop only */}
          {!isMobile && (
            <div style={{
              width: 200, flexShrink: 0, background: T.bg1, border: `1px solid ${T.line}`,
              borderRadius: 12, padding: '12px 10px', position: 'sticky', top: 180,
              maxHeight: 'calc(100vh - 210px)', overflowY: 'auto', zIndex: 10,
            }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: T.t2, letterSpacing: '0.08em', marginBottom: 8, fontFamily: T.mono }}>AREAS WITH PGs</div>
              <AreaList />
            </div>
          )}
        </div>
      </div>

      {visitTarget && (
        <TourModal pg={visitTarget} onClose={() => setVisitTarget(null)} onSchedule={(roomId, v) => handleScheduleAction(visitTarget, roomId, v)} />
      )}
    </AppLayout>
  );
}