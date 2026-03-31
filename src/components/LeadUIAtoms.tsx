'use client';
import React, { useState } from 'react';
import { T, ZONES, QUALITY, BMAP, TIER_COLOR, LINE_COLOR, GEO_TECH_PARKS, haversine, roadDist, driveMin, nearestMetro, nearestTechParks, enrichLeadGeo, FDISPLAY, type ZoneEntry } from '@/lib/leadGeoData';
import { type MoveInParsed, type BudgetRange } from '@/lib/leadParserV2';

export function Pill({ text, xs }: { text: string; xs?: boolean }) {
  if (!text) return null;
  const key = Object.keys(BMAP).find(k => text.includes(k));
  const s = key ? BMAP[key] : { bg: "rgba(90,96,128,0.15)", color: "#8891b4", border: "rgba(90,96,128,0.28)" };
  return <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 5, fontSize: xs ? 9.5 : 11, padding: xs ? "1px 6px" : "2px 9px", fontWeight: 600, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{text}</span>;
}

export function ZonePill({ zoneName, xs, extra }: { zoneName: string; xs?: boolean; extra?: string }) {
  if (!zoneName) return null;
  // Simple zone display - no color coding
  return <span style={{ background: "rgba(100,116,139,0.1)", color: "#64748b", border: "1px solid rgba(100,116,139,0.25)", borderRadius: 5, fontSize: xs ? 9.5 : 11, padding: xs ? "2px 8px" : "3px 10px", fontWeight: 600, letterSpacing: "0.02em", display: "inline-flex", alignItems: "center", gap: 3 }}>{zoneName}{extra && <span style={{ opacity: 0.6, fontWeight: 400, fontSize: 9 }}>{extra}</span>}</span>;
}

export function TechPill({ name }: { name: string }) {
  return <span style={{ background: "rgba(212,168,83,0.12)", color: "#d4a853", border: "1px solid rgba(212,168,83,0.3)", borderRadius: 5, fontSize: 10, padding: "2px 7px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>🏢 {name}</span>;
}

export function TierBadge({ tier }: { tier: string }) {
  const c = TIER_COLOR[tier] || "#888";
  return <span style={{ background: `${c}20`, color: c, border: `1px solid ${c}50`, borderRadius: 4, fontSize: 9, padding: "1px 6px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>{tier}</span>;
}

export function UrgencyBadge({ urgency, label }: { urgency?: string; label?: string }) {
  if (!urgency) return null;
  const cfg: Record<string, any> = {
    immediate: { c: "#f87171", bg: "rgba(248,113,113,0.15)", b: "rgba(248,113,113,0.45)", icon: "🔥", text: "Immediate" },
    hot: { c: "#fb923c", bg: "rgba(251,146,60,0.14)", b: "rgba(251,146,60,0.4)", icon: "⚡", text: "Hot" },
    warm: { c: "#fbbf24", bg: "rgba(251,191,36,0.12)", b: "rgba(251,191,36,0.35)", icon: "📅", text: "Warm" },
    cold: { c: "#60a5fa", bg: "rgba(96,165,250,0.1)", b: "rgba(96,165,250,0.3)", icon: "🕐", text: "Planned" },
  };
  const v = cfg[urgency] || { c: "#64748b", bg: "transparent", b: "#334155", icon: "", text: "" };
  return <span style={{ background: v.bg, color: v.c, border: `1px solid ${v.b}`, borderRadius: 5, fontSize: 10, padding: "2px 8px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>{v.icon} {label || v.text}</span>;
}

export function SourceBadge({ source }: { source?: string }) {
  if (!source || source === "Manual") return null;
  const colors: Record<string, string> = { L1: "#a78bfa", L2: "#34d399", L3: "#60a5fa", L4: "#fbbf24", L5: "#f472b6", L6: "#fb923c" };
  const c = colors[source] || "#64748b";
  return <span style={{ background: `${c}15`, color: c, border: `1px solid ${c}40`, borderRadius: 4, fontSize: 9, padding: "1px 7px", fontWeight: 700, letterSpacing: "0.06em", fontFamily: T.mono }}>{source}</span>;
}

export function MapLinkChip({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: T.gold, background: T.goldDim, border: `1px solid rgba(212,168,83,0.3)`, borderRadius: 5, padding: "2px 8px", textDecoration: "none", fontWeight: 600 }}>
      📍 Map Link
    </a>
  );
}

export function BudgetChips({ ranges, raw }: { ranges?: BudgetRange[]; raw?: string }) {
  if (!ranges || !ranges.length) return <span style={{ fontSize: 12, color: T.text }}>{raw}</span>;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
      {ranges.map((r, i) => (
        <span key={i} style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 5, fontSize: 11, padding: "2px 8px", fontWeight: 600, fontFamily: T.mono }}>{r.display}</span>
      ))}
    </div>
  );
}

export function BLRBadge({ value }: { value?: boolean | null }) {
  if (value === true) return <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, background: "rgba(99,102,241,0.14)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)", fontWeight: 600 }}>🏙 In BLR</span>;
  if (value === false) return <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)", fontWeight: 600 }}>✈️ Out BLR</span>;
  if (value === null) return <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, background: "rgba(107,114,128,0.12)", color: "#9ca3af", border: "1px solid rgba(107,114,128,0.3)", fontWeight: 600 }}>❓ Unknown</span>;
  return null;
}

export function BLRToggle({ value, onChange }: { value?: boolean | null; onChange: (v: boolean | null) => void }) {
  const opts = [
    { v: true as boolean | null, label: "🏙 In", ac: "#818cf8", ab: "rgba(99,102,241,0.18)", abr: "rgba(99,102,241,0.38)" },
    { v: false as boolean | null, label: "✈️ Out", ac: "#fbbf24", ab: "rgba(245,158,11,0.14)", abr: "rgba(245,158,11,0.3)" },
    { v: null as boolean | null, label: "❓ Unknown", ac: "#9ca3af", ab: "rgba(107,114,128,0.14)", abr: "rgba(107,114,128,0.3)" },
  ];
  return <div style={{ display: "flex", gap: 3 }}>{opts.map(({ v, label, ac, ab, abr }) => (
    <button key={String(v)} onClick={e => { e.stopPropagation(); onChange(v); }}
      style={{ fontSize: 10.5, padding: "3px 8px", borderRadius: 5, cursor: "pointer", background: value === v ? ab : "transparent", color: value === v ? ac : T.dim, border: `1px solid ${value === v ? abr : T.line}`, transition: "all 0.12s" }}>{label}</button>
  ))}</div>;
}

export function QualityToggle({ quality, onChange }: { quality: string; onChange: (q: string) => void }) {
  return <div style={{ display: "flex", gap: 3 }}>{Object.entries(QUALITY).map(([k, q]) => (
    <button key={k} onClick={e => { e.stopPropagation(); onChange(k); }}
      style={{ fontSize: 10.5, padding: "3px 8px", borderRadius: 5, cursor: "pointer", fontWeight: quality === k ? 700 : 400, background: quality === k ? q.bg : "transparent", color: quality === k ? q.color : T.dim, border: `1px solid ${quality === k ? q.border : T.line}`, transition: "all 0.12s" }}>{q.label}</button>
  ))}</div>;
}

export function ZoneSelector({ value, onSelect }: { value: string; onSelect: (z: string) => void }) {
  return <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{ZONES.map(z => (
    <button key={z.zone} onClick={() => onSelect(value === z.zone ? "" : z.zone)}
      style={{ fontSize: 11, padding: "4px 11px", borderRadius: 5, cursor: "pointer", background: value === z.zone ? z.bg : "transparent", color: value === z.zone ? z.color : T.dim, border: `1px solid ${value === z.zone ? z.border : T.line}`, transition: "all 0.12s" }}>{z.zone}</button>
  ))}</div>;
}

export function NotesBox({ notes = [], onAdd, onDelete, compact }: { notes: any[]; onAdd: (n: any) => void; onDelete: (i: number) => void; compact?: boolean }) {
  const [draft, setDraft] = useState("");
  if (compact) {
    return notes.length > 0 ? <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 5, background: "rgba(124,111,255,0.13)", color: "#a78bfa", border: "1px solid rgba(124,111,255,0.27)", fontWeight: 600 }}>📝 {notes.length} note{notes.length > 1 ? "s" : ""}</span> : null;
  }
  const tsNow = () => new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div onClick={e => e.stopPropagation()}>
      <div style={{ fontSize: 9.5, color: T.mid, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 7, display: "flex", alignItems: "center", gap: 7 }}>
        📝 Notes {notes.length > 0 && <span style={{ fontWeight: 400, textTransform: "none" as const, fontSize: 9, color: T.dim }}>{notes.length} entr{notes.length > 1 ? "ies" : "y"}</span>}
      </div>
      {notes.length > 0 && (<div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
        {notes.map((n, i) => (<div key={i} style={{ background: "rgba(124,111,255,0.07)", border: "1px solid rgba(124,111,255,0.2)", borderRadius: 7, padding: "7px 10px" }}>
          <div style={{ fontSize: 9, color: "#7c6fff", fontFamily: T.mono, marginBottom: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}><span>🕐 {n.ts}</span><button onClick={() => onDelete(i)} style={{ background: "none", border: "none", color: T.dim, fontSize: 11, cursor: "pointer" }}>✕</button></div>
          <div style={{ fontSize: 12, color: T.text, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{n.text}</div>
        </div>))}
      </div>)}
      <div style={{ background: T.bg1, border: `1px solid ${T.line2}`, borderRadius: 7, overflow: "hidden" }}>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { const t = draft.trim(); if (t) { onAdd({ text: t, ts: tsNow() }); setDraft(""); } } }}
          placeholder="Add note, preference, follow-up… (Ctrl+Enter to save)"
          style={{ width: "100%", background: "transparent", border: "none", color: T.text, fontSize: 12, lineHeight: 1.65, resize: "vertical" as const, minHeight: 52, fontFamily: T.sans, padding: "8px 10px", outline: "none" }} />
        {draft.trim() && (<div style={{ padding: "5px 8px", borderTop: `1px solid ${T.line}`, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => { const t = draft.trim(); if (t) { onAdd({ text: t, ts: tsNow() }); setDraft(""); } }}
            style={{ fontSize: 11, padding: "4px 12px", borderRadius: 5, background: "rgba(124,111,255,0.18)", color: "#a78bfa", border: "1px solid rgba(124,111,255,0.35)", cursor: "pointer", fontWeight: 600 }}>+ Save Note</button>
        </div>)}
      </div>
    </div>
  );
}

export function GeoIntelPanel({ lead }: { lead: any }) {
  const { areaIntel, matchedPark } = enrichLeadGeo(lead);
  if (!areaIntel.length && !matchedPark) return null;
  
  const D = {
    gold: '#c4880d',
    goldDim: 'rgba(196,136,13,0.10)',
    bg1: '#f8f9fc',
    bg2: '#f1f3f8',
    hi: '#1a1e30',
    text: '#2d3248',
    mid: '#636b83',
    dim: '#8c92a8',
    acc: '#6c5ce7',
    line: '#e2e5ee',
    line2: '#d4d8e3',
    mono: "'DM Mono','IBM Plex Mono',monospace",
    sans: "'DM Sans',sans-serif"
  };

  return (
    <div style={{ marginTop: 10, background: "rgba(196,136,13,0.05)", border: "1px solid rgba(196,136,13,0.18)", borderRadius: 9, padding: "11px 13px" }}>
      <div style={{ fontSize: 9.5, color: D.gold, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        ⌖ Geo Intelligence
        <span style={{ fontSize: 9, color: D.dim, fontWeight: 400, textTransform: "none" as const }}>coordinate-precise proximity data</span>
      </div>
      {matchedPark && (
        <div style={{ background: "rgba(196,136,13,0.06)", border: "1px solid rgba(196,136,13,0.2)", borderRadius: 7, padding: "8px 10px", marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: D.gold, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>🏢 Office / Tech Park Detected</div>
          <div style={{ fontSize: 12.5, color: D.hi, fontWeight: 600 }}>{matchedPark.name}</div>
          <div style={{ fontSize: 10.5, color: D.mid, marginTop: 2 }}>{matchedPark.area}</div>
          <div style={{ fontSize: 10, color: D.dim, marginTop: 2 }}>{matchedPark.companies}</div>
        </div>
      )}
      {areaIntel.map((area, idx) => {
        const officeDistances = matchedPark ? [{ ...matchedPark, dist: haversine(area.lat, area.lng, matchedPark.lat, matchedPark.lng), road: roadDist(area.lat, area.lng, matchedPark.lat, matchedPark.lng) }] : [];
        return (
          <div key={area.id} style={{ marginBottom: idx < areaIntel.length - 1 ? 12 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <TierBadge tier={area.tier} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: D.hi }}>{area.name}</span>
              <span style={{ fontSize: 10, color: D.dim }}>PIN {area.pincode}</span>
              {officeDistances[0] && (
                <div style={{ marginLeft: "auto", textAlign: "right" as const }}>
                  <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>{officeDistances[0].dist} km</span>
                  <span style={{ fontSize: 9.5, color: D.dim, marginLeft: 5 }}>≈ {driveMin(officeDistances[0].road)} to office</span>
                </div>
              )}
            </div>
            <div style={{ fontSize: 10.5, color: D.mid, marginBottom: 8, lineHeight: 1.5 }}>{area.desc}</div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 8.5, color: D.dim, letterSpacing: "0.08em", fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 5 }}>Nearest Metro Stations</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {area.metros.map(m => (
                  <div key={m.id} style={{ background: D.bg1, border: `1px solid ${LINE_COLOR[m.line] || "#444"}40`, borderRadius: 5, padding: "3px 8px", fontSize: 10, display: "flex", gap: 5, alignItems: "center" }}>
                    <span style={{ color: LINE_COLOR[m.line] || "#999", fontWeight: 700, fontSize: 8.5 }}>{m.line.split("/")[0]}</span>
                    <span style={{ color: D.text }}>{m.name}</span>
                    <span style={{ color: D.dim }}>{m.dist.toFixed(1)}km</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 8.5, color: D.dim, letterSpacing: "0.08em", fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 5 }}>Nearest Tech Parks</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {area.techParks.map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: D.mid }}>
                    <span style={{ color: p.id === matchedPark?.id ? "#d4a853" : D.text }}>{p.name} {p.id === matchedPark?.id && "★"}</span>
                    <span style={{ color: D.dim, fontFamily: D.mono }}>{p.dist.toFixed(1)} km · {driveMin(roadDist(area.lat, area.lng, p.lat, p.lng))}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
