"use client";

import React, { useState } from "react";
import { MapPin, Calendar, Check, ChevronDown, ChevronUp, DollarSign, FileText } from "lucide-react";
import { toast } from "sonner";
import type { PGEntry } from "@/data/pgMasterData";

const T = {
  bg2: "#FFF6F4",
  bg3: "#FFFFFF",
  line: "#FEE2E2",
  t0: "#111827",
  t1: "#4B5563",
  t2: "#9CA3AF",
  t3: "#E5E7EB",
  white: "#FFFFFF",
  gold: "#F97316",
  goldD: "rgba(249,115,22,0.08)",
  green: "#16A34A",
  greenD: "rgba(22,163,74,0.09)",
  amber: "#D97706",
  amberD: "rgba(217,119,6,0.09)",
  red: "#DC2626",
  redD: "rgba(220,38,38,0.09)",
  blue: "#2563EB",
  blueD: "rgba(37,99,235,0.09)",
  blueB: "rgba(37,99,235,0.28)",
  violet: "#7C3AED",
  violetD: "rgba(124,58,237,0.09)",
  sans: "'DM Sans', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
};

function formatPrice(price: number | null | undefined) {
  if (!price || price <= 0) return "₹—";
  return `from ₹${(price / 1000).toFixed(1)}k/mo`;
}

function getMinPrice(pg: PGEntry) {
  if (pg.minPrice && pg.minPrice > 5000) return pg.minPrice;
  const prices = [pg.triplePrice, pg.doublePrice, pg.singlePrice].filter(
    (v): v is number => typeof v === "number" && v > 5000
  );
  if (prices.length > 0) return Math.min(...prices);
  return 0;
}

export interface PGCardProps {
  pg: PGEntry & { score?: number };
  viewMode?: "grid" | "list";
  isAdmin?: boolean;
  /**
   * Optional: used only in inventory; in leads we keep UI but disable actual scheduling.
   */
  onScheduleVisit?: () => void;
}

const PGCard: React.FC<PGCardProps> = ({ pg, viewMode = "grid", isAdmin = false, onScheduleVisit }) => {
  const [expanded, setExpanded] = useState(false);
  const [copiedWA, setCopiedWA] = useState(false);
  const [copiedMap, setCopiedMap] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const minPrice = getMinPrice(pg);
  const isActive = pg.isActive !== false; // treat undefined (sheet data) as true
  const isList = viewMode === "list";

  const genderConfig =
    pg.gender?.toLowerCase().includes("girl") || pg.gender?.toLowerCase().includes("female")
      ? { color: "#EC4899", bg: "rgba(236,72,153,0.08)", border: "rgba(236,72,153,0.22)", label: "Girls" }
      : pg.gender?.toLowerCase().includes("boy") || pg.gender?.toLowerCase().includes("male")
      ? { color: T.blue, bg: T.blueD, border: T.blueB, label: "Boys" }
      : { color: T.t1, bg: T.bg3, border: T.line, label: "coed" };

  const copyWA = (e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = pg.waTemplate || `📍 ${pg.name.toUpperCase()}`;
    navigator.clipboard.writeText(msg);
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 2000);
    toast.success("Exclusive Offer Message Copied! ⚡️");
  };

  const copyMap = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Use the raw location message if present, else fall back to minimal string
    const msg = pg.locationMsg || `📍 ${pg.name.toUpperCase()} — ${pg.locality || pg.area || "Bangalore"}`;
    navigator.clipboard.writeText(msg);
    setCopiedMap(true);
    setTimeout(() => setCopiedMap(false), 2000);
    toast.success("Location Message copied! 📍");
  };

  // In leads we keep the UI but disable backend status toggling
  const handleToggleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast.info("Status toggle is only available in Inventory OS");
  };

  return (
    <div
      className={`gp-card ${isList ? "inventory-list-card" : ""}`}
      style={{
        background: T.bg2,
        border: `1px solid ${!isActive ? T.t3 : T.line}`,
        borderRadius: 12,
        overflow: "hidden",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        height: "fit-content",
        transition: "all 0.2s",
        display: isList ? "flex" : "block",
        alignItems: isList ? "stretch" : undefined,
        opacity: !isActive ? 0.5 : 1,
        filter: !isActive ? "grayscale(0.4)" : "none",
      }}
    >
      {/* Header */}
      <div style={{ padding: "14px 16px", flex: isList ? 1 : "none", minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Primary PG name */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <h3
                style={{
                  fontFamily: T.sans,
                  fontWeight: 800,
                  fontSize: 14,
                  color: "#111827",
                  margin: 0,
                  letterSpacing: "-0.01em",
                  minWidth: 0,
                  wordBreak: "break-word",
                }}
              >
                {pg.name.toUpperCase()}
              </h3>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 8,
                  color: T.gold,
                  fontWeight: 800,
                  background: T.goldD,
                  padding: "2px 4px",
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                {pg.pid}
              </span>
            </div>

            {/* Exact Name line as requested */}
            {pg.exactName && (
              <div style={{ marginTop: 2, fontFamily: T.mono, fontSize: 9, color: T.t1 }}>
                <span style={{ fontWeight: 700 }}>Name: </span>
                <span>{pg.exactName}</span>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, minWidth: 0 }}>
              <MapPin size={10} style={{ color: T.t2, flexShrink: 0 }} />
              <span style={{ fontFamily: T.mono, fontSize: 9, color: T.t2, fontWeight: 600 }}>{pg.area}</span>
              {pg.landmarks && (
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 8,
                    color: T.t2,
                    marginLeft: 6,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  • {pg.landmarks}
                </span>
              )}
            </div>
          </div>

          {!isList && (
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ color: T.gold, fontWeight: 900, fontSize: 13, textTransform: "uppercase" }}>
                {formatPrice(minPrice)}
              </div>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 8,
                  color: T.t2,
                  fontWeight: 700,
                  marginTop: 2,
                }}
              >
                {[
                  pg.triplePrice && pg.triplePrice > 0 ? `T:₹${Math.round(pg.triplePrice / 1000)}k` : null,
                  pg.doublePrice && pg.doublePrice > 0 ? `D:₹${Math.round(pg.doublePrice / 1000)}k` : null,
                  pg.singlePrice && pg.singlePrice > 0 ? `S:₹${Math.round(pg.singlePrice / 1000)}k` : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </div>
            </div>
          )}
        </div>

        {/* Essential Badges */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
          <span
            style={{
              background: genderConfig.bg,
              color: genderConfig.color,
              border: `1px solid ${genderConfig.border}`,
              borderRadius: 6,
              fontFamily: T.mono,
              fontSize: 8,
              fontWeight: 800,
              padding: "2px 8px",
            }}
          >
            {genderConfig.label.toUpperCase()}
          </span>
          {pg.propertyType && (
            <span
              style={{
                background: "#FEF3C7",
                color: "#92400E",
                border: "1px solid #FDE68A",
                borderRadius: 6,
                fontFamily: T.mono,
                fontSize: 8,
                fontWeight: 800,
                padding: "2px 8px",
              }}
            >
              {pg.propertyType.toUpperCase()}
            </span>
          )}
          {pg.managerContact && (
            <span
              style={{
                background: "#F3F4F6",
                color: "#374151",
                border: "1px solid #D1D5DB",
                borderRadius: 6,
                fontFamily: T.mono,
                fontSize: 8,
                fontWeight: 800,
                padding: "2px 8px",
              }}
            >
              MGR: {pg.managerContact}
            </span>
          )}
        </div>
      </div>

      {isList && (
        <div
          className="list-price-panel"
          style={{
            width: 150,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            borderLeft: `1px solid ${T.line}`,
            padding: "0 12px",
            background: "#fff",
            flexShrink: 0,
          }}
        >
          <div style={{ color: T.gold, fontWeight: 900, fontSize: 13 }}>{formatPrice(minPrice)}</div>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 8,
              color: T.t2,
              fontWeight: 700,
              marginTop: 2,
            }}
          >
            {[
              pg.triplePrice && pg.triplePrice > 0 ? `T:₹${Math.round(pg.triplePrice / 1000)}k` : null,
              pg.doublePrice && pg.doublePrice > 0 ? `D:₹${Math.round(pg.doublePrice / 1000)}k` : null,
              pg.singlePrice && pg.singlePrice > 0 ? `S:₹${Math.round(pg.singlePrice / 1000)}k` : null,
            ]
              .filter(Boolean)
              .join(" ")}
          </div>
        </div>
      )}

      {/* Actions (rooms + status removed; UI kept simple for leads) */}
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          borderTop: isList ? "none" : `1px solid ${T.line}`,
          borderLeft: isList ? `1px solid ${T.line}` : "none",
          width: isList ? "auto" : "100%",
          maxWidth: "100%",
          flexShrink: isList ? 0 : undefined,
          alignItems: "center",
          background: "#fff",
          boxSizing: "border-box",
        }}
      >
        <button
          onClick={!isActive ? undefined : onScheduleVisit}
          style={{
            flex: isList ? "none" : 2,
            background: "#fff",
            border: `1.5px solid #000`,
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 11,
            color: "#000",
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: !isActive || !onScheduleVisit ? "not-allowed" : "pointer",
            boxShadow: "1px 1px 0 #000",
            opacity: !isActive || !onScheduleVisit ? 0.4 : 1,
          }}
        >
          <Calendar size={13} strokeWidth={3} /> TOUR
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={!isActive ? undefined : () => {
              // in leads we most likely don't have brochures; keep button but no-op
              toast.info("Brochure is available only in Inventory OS");
            }}
            title="Download Brochure"
            style={{
              background: "#fff",
              border: `1.5px solid #000`,
              borderRadius: 8,
              padding: "10px",
              display: "flex",
              alignItems: "center",
              color: "#000",
              cursor: !isActive ? "not-allowed" : "pointer",
              boxShadow: "1px 1px 0 #000",
              opacity: !isActive ? 0.4 : 1,
            }}
          >
            <FileText size={14} strokeWidth={3} />
          </button>
          <button
            onClick={!isActive ? undefined : copyWA}
            title="Copy WhatsApp Offer"
            style={{
              background: "#fff",
              border: `1.5px solid #000`,
              borderRadius: 8,
              padding: "10px",
              display: "flex",
              alignItems: "center",
              color: copiedWA ? "#16A34A" : "#000",
              cursor: !isActive ? "not-allowed" : "pointer",
              boxShadow: "1px 1px 0 #000",
              opacity: !isActive ? 0.4 : 1,
            }}
          >
            {copiedWA ? <Check size={14} strokeWidth={3} /> : <DollarSign size={14} strokeWidth={3} />}
          </button>
          <button
            onClick={!isActive ? undefined : copyMap}
            title="Copy Map Location"
            style={{
              background: "#fff",
              border: `1.5px solid #000`,
              borderRadius: 8,
              padding: "10px",
              display: "flex",
              alignItems: "center",
              color: copiedMap ? "#16A34A" : "#000",
              cursor: !isActive ? "not-allowed" : "pointer",
              boxShadow: "1px 1px 0 #000",
              opacity: !isActive ? 0.4 : 1,
            }}
          >
            {copiedMap ? <Check size={14} strokeWidth={3} /> : <MapPin size={14} strokeWidth={3} />}
          </button>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            flex: isList ? "none" : 1,
            background: "none",
            border: "none",
            padding: "8px",
            fontSize: 11,
            color: T.t2,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {expanded ? "Hide" : "Details"}
        </button>

        {isAdmin && (
          <button
            onClick={handleToggleStatus}
            disabled={togglingStatus}
            title={isActive ? "Disable this PG" : "Enable this PG"}
            style={{
              background: isActive ? T.redD : T.greenD,
              border: `1.5px solid ${isActive ? T.red : T.green}`,
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 10,
              fontWeight: 900,
              color: isActive ? T.red : T.green,
              cursor: togglingStatus ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              flexShrink: 0,
              opacity: togglingStatus ? 0.6 : 1,
              transition: "all 0.15s",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: isActive ? T.red : T.green,
                display: "inline-block",
              }}
            />
            {togglingStatus ? "..." : isActive ? "DISABLE" : "ENABLE"}
          </button>
        )}
      </div>

      {/* Details Drawer */}
      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${T.line}`,
            padding: "16px 14px",
            background: T.bg3,
            animation: "fadeIn 0.2s",
            width: isList ? "100%" : "auto",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 8,
                  color: "#111827",
                  fontWeight: 900,
                  marginBottom: 2,
                }}
              >
                DEPOSIT
              </div>
              <div style={{ fontSize: 10, color: T.t1 }}>{pg.deposit || "—"}</div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 8,
                  color: "#111827",
                  fontWeight: 900,
                  marginBottom: 2,
                }}
              >
                MIN STAY
              </div>
              <div style={{ fontSize: 10, color: T.t1 }}>{pg.minStay || "—"}</div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 8,
                  color: "#111827",
                  fontWeight: 900,
                  marginBottom: 2,
                }}
              >
                MEALS
              </div>
              <div style={{ fontSize: 10, color: T.t1 }}>{pg.meals || "—"}</div>
            </div>
          </div>
          {pg.vibe && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 8,
                  color: "#111827",
                  fontWeight: 900,
                  marginBottom: 4,
                }}
              >
                BRAND VIBE
              </div>
              <div style={{ fontSize: 11, color: T.t1, lineHeight: 1.5 }}>{pg.vibe}</div>
            </div>
          )}
          {pg.houseRules && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 8,
                  color: "#111827",
                  fontWeight: 900,
                  marginBottom: 4,
                }}
              >
                HOUSE RULES
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: T.t1,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                {pg.houseRules}
              </div>
            </div>
          )}
          {pg.amenities && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {pg.amenities.slice(0, 12).map((a) => (
                <span
                  key={a}
                  style={{
                    background: "#fff",
                    border: `1.5px solid #000`,
                    color: "#000",
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: 6,
                    fontSize: 9,
                  }}
                >
                  {a}
                </span>
              ))}
              {(pg.commonAreas || []).map((a) => (
                <span
                  key={a}
                  style={{
                    background: T.amberD,
                    border: `1.5px solid ${T.amber}`,
                    color: T.amber,
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: 6,
                    fontSize: 9,
                  }}
                >
                  🏠 {a}
                </span>
              ))}
            </div>
          )}
          {pg.safety && pg.safety.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {pg.safety.map((s) => (
                <span
                  key={s}
                  style={{
                    background: T.redD,
                    border: `1.5px solid ${T.red}`,
                    color: T.red,
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: 6,
                    fontSize: 9,
                  }}
                >
                  🛡️ {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PGCard;