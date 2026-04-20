'use client';
import { useState, useCallback, useEffect, type ReactNode, type ClipboardEvent } from 'react';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useCreateLead, useAgents, useOfficeZones, useUpdateLead, usePipelineStages, type LeadWithRelations } from '@/hooks/useCrmData';
import { PIPELINE_STAGES } from '@/types/crm';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { T, QUALITY, GEO_TECH_PARKS, FDISPLAY, buildKnowledgeSnapshot, tsNow, AREAS, haversine, roadDist, driveMin, nearestMetro, nearestTechParks, enrichLeadGeo, LINE_COLOR, TIER_COLOR } from '@/lib/leadGeoData';
import { parseLeadV2, splitLeads, parseMoveInV2, parseBudgetV2, parseMonth, type ParsedLeadV2, type BudgetRange } from '@/lib/leadParserV2';
import { Pill, ZonePill, TechPill, TierBadge, UrgencyBadge, SourceBadge, MapLinkChip, BudgetChips, BLRBadge, BLRToggle, QualityToggle, ZoneSelector, NotesBox, GeoIntelPanel } from '@/components/LeadUIAtoms';

type SessionLead = ParsedLeadV2 & { id: number; addedAt: string };

// ═══════════════════════════════════════════════════════════════════════
//  AI MATCHER PANEL
// ═══════════════════════════════════════════════════════════════════════
function AIMatcher({ onClose }: { onClose: () => void }) {
  const [leadText, setLeadText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function runMatch() {
    if (!leadText.trim()) { setError("Enter lead details first."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/ai/lead-matcher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadText, knowledgeSnapshot: buildKnowledgeSnapshot() }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "AI matching failed"); }
      const data = await res.json();
      const ext = data.extracted;
      const matchedAreas = (ext.matched_area_ids || []).map((id: string) => AREAS.find(a => a.id === id)).filter(Boolean).map((area: any) => {
        const metros = nearestMetro(area.lat, area.lng, 3);
        const parks = nearestTechParks(area.lat, area.lng, 3);
        let officeDist = null as any;
        if (ext.matched_office_park_id) { const op = GEO_TECH_PARKS.find(p => p.id === ext.matched_office_park_id); if (op) officeDist = { ...op, dist: haversine(area.lat, area.lng, op.lat, op.lng), road: roadDist(area.lat, area.lng, op.lat, op.lng) }; }
        return { ...area, metros, parks, officeDist };
      });
      setResult({ ...ext, matchedAreas, officePark: GEO_TECH_PARKS.find(p => p.id === ext.matched_office_park_id) || null });
    } catch (e: any) { setError(e.message || "AI matching failed."); }
    finally { setLoading(false); }
  }

  const examples = [
    { label: "IT Pro – ORR worker", text: 'Works at Cessna Business Park on Outer Ring Road. Budget 80L-1Cr for 2BHK to buy. Wants within 5km of office. Prefer HSR or Bellandur.' },
    { label: "Renter – North BLR", text: 'Relocated to Manyata campus, Goldman Sachs. Need 3BHK rental 40-55k/month. Prefer Hebbal, Nagawara or Thanisandra.' },
    { label: "First-Time Buyer", text: 'Fresher at Infosys Electronic City. Budget 45L. Need 1BHK. OK with anywhere good connectivity to Ecity.' },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,0.96)", zIndex: 1100, display: "flex", alignItems: "stretch", backdropFilter: "blur(8px)" }}>
      <div style={{ width: 380, background: T.bg1, borderRight: `1px solid ${T.line}`, padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>⌖ AI Lead Matcher</div>
            <div style={{ fontSize: 9.5, color: T.dim, marginTop: 2 }}>Powered by Claude + Bangalore geo-db</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${T.line}`, color: T.mid, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>✕ Close</button>
        </div>
        <textarea value={leadText} onChange={e => setLeadText(e.target.value)}
          placeholder={'Paste any free-form lead:\n\n"Works at Manyata, Goldman Sachs. Budget 80L. Wife needs metro. 2BHK. Prefer Hebbal or Nagawara."'}
          style={{ width: "100%", height: 180, background: T.bg0, border: `1px solid ${T.line2}`, borderRadius: 9, padding: "10px 12px", fontFamily: T.mono, fontSize: 11, color: T.text, resize: "vertical", lineHeight: 1.7, outline: "none" }} />
        <button onClick={runMatch} disabled={loading} style={{ background: loading ? T.bg2 : `linear-gradient(135deg,${T.gold},#b8893a)`, color: loading ? T.dim : "#0C0C0E", border: "none", borderRadius: 9, padding: "12px", fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "⟳ ANALYSING…" : "▶ MATCH TO AREAS"}
        </button>
        {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 7, padding: "8px 10px", fontSize: 11, color: "#f87171" }}>{error}</div>}
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 9, color: T.dim, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>Quick Examples</div>
          {examples.map(ex => (<div key={ex.label} onClick={() => setLeadText(ex.text)} style={{ background: T.bg0, border: `1px solid ${T.line}`, borderRadius: 7, padding: "8px 10px", marginBottom: 6, cursor: "pointer" }}>
            <div style={{ fontSize: 10, color: T.gold, marginBottom: 2 }}>{ex.label}</div>
            <div style={{ fontSize: 10, color: T.dim, lineHeight: 1.5 }}>{ex.text.slice(0, 90)}…</div>
          </div>))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {!result && !loading && (<div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: T.dim, textAlign: "center" }}>
          <div style={{ fontSize: 56, opacity: 0.35, marginBottom: 16 }}>⌖</div>
          <div style={{ fontSize: 12, letterSpacing: "2px", color: T.mid }}>ENTER A LEAD TO BEGIN MATCHING</div>
        </div>)}
        {loading && (<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 36, opacity: 0.5 }}>⌖</div>
          <div style={{ fontSize: 11, color: T.dim, letterSpacing: "2px" }}>RUNNING GEO-INTELLIGENCE MATCH…</div>
        </div>)}
        {result && (<div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9.5, color: T.gold, letterSpacing: "0.1em", marginBottom: 10, fontWeight: 700, textTransform: "uppercase" as const }}>EXTRACTED INTENT</div>
            <div style={{ background: T.bg1, border: `1px solid ${T.line}`, borderRadius: 8, padding: 16, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {[["Budget", result.budget_inr || "—"], ["Tier", result.budget_tier], ["Type", result.property_type], ["Office", result.office_location || "—"], ["Max Commute", result.commute_max_km ? result.commute_max_km + "km" : "—"], ["Preferred Area", result.preferred_area_raw || "—"]].map(([k, v]) => (
                <div key={k as string}><div style={{ fontSize: 8.5, color: T.dim, letterSpacing: "0.07em", textTransform: "uppercase" as const, marginBottom: 3 }}>{k}</div><div style={{ fontSize: 12.5, color: T.hi, fontWeight: 500 }}>{v}</div></div>
              ))}
              {result.officePark && (<div style={{ gridColumn: "1/-1", borderTop: `1px solid ${T.line}`, paddingTop: 10, marginTop: 4 }}>
                <div style={{ fontSize: 8.5, color: T.dim, letterSpacing: "0.07em", textTransform: "uppercase" as const, marginBottom: 4 }}>Matched Office Park</div>
                <div style={{ fontSize: 12.5, color: T.gold, fontWeight: 600 }}>{result.officePark.name} <span style={{ color: T.dim, fontWeight: 400 }}>— {result.officePark.area}</span></div>
                <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>{result.officePark.companies}</div>
              </div>)}
            </div>
            {result.notes && <div style={{ fontSize: 10.5, color: T.mid, marginTop: 8, lineHeight: 1.6, padding: "0 4px" }}>{result.notes}</div>}
          </div>
          <div style={{ fontSize: 9.5, color: T.gold, letterSpacing: "0.1em", marginBottom: 12, fontWeight: 700, textTransform: "uppercase" as const }}>MATCHED AREAS ({result.matchedAreas?.length || 0})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {(result.matchedAreas || []).map((area: any, idx: number) => (
              <div key={area.id} style={{ background: T.bg1, border: `1px solid ${idx === 0 ? "rgba(196,136,13,0.4)" : T.line}`, borderRadius: 10, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <TierBadge tier={area.tier} />
                      {idx === 0 && <span style={{ fontSize: 9, color: T.gold, letterSpacing: "0.06em", fontWeight: 700 }}>★ TOP MATCH</span>}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.hi }}>{area.name}</div>
                    <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>PIN {area.pincode} · {area.region} Bangalore</div>
                  </div>
                  {area.officeDist && (<div style={{ textAlign: "right" as const }}>
                    <div style={{ fontSize: 8.5, color: T.mid, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 2 }}>To Office</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#34d399" }}>{area.officeDist.dist} km</div>
                    <div style={{ fontSize: 9.5, color: T.dim }}>{driveMin(area.officeDist.road)}</div>
                  </div>)}
                </div>
                <div style={{ fontSize: 10.5, color: T.mid, marginBottom: 12, lineHeight: 1.5 }}>{area.desc}</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 8.5, color: T.dim, letterSpacing: "0.08em", fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 6 }}>Nearest Metro</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {area.metros.map((m: any) => (<div key={m.id} style={{ background: T.bg2, border: `1px solid ${LINE_COLOR[m.line] || "#ccc"}40`, borderRadius: 4, padding: "3px 8px", fontSize: 10, display: "flex", gap: 5, alignItems: "center" }}>
                      <span style={{ color: LINE_COLOR[m.line] || "#888", fontWeight: 700, fontSize: 8 }}>{m.line.split("/")[0]}</span>
                      <span style={{ color: T.text }}>{m.name}</span>
                      <span style={{ color: T.dim, fontFamily: T.mono }}>{m.dist.toFixed(1)}km</span>
                    </div>))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 8.5, color: T.dim, letterSpacing: "0.08em", fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 5 }}>Tech Parks Within Range</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {area.parks.map((p: any) => (<div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: T.mid }}>
                      <span style={{ color: p.id === result.officePark?.id ? "#d4a853" : T.text }}>{p.name}{p.id === result.officePark?.id ? " ★" : ""}</span>
                      <span style={{ color: T.dim, fontFamily: T.mono }}>{p.dist.toFixed(1)}km · {driveMin(roadDist(area.lat, area.lng, p.lat, p.lng))}</span>
                    </div>))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN ADD LEAD DIALOG
// ═══════════════════════════════════════════════════════════════════════
type AddLeadDialogProps = {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  editingLead?: LeadWithRelations | null;
  layout?: 'dialog' | 'page';
};

const AddLeadDialog = ({ trigger, open: controlledOpen, onOpenChange, editingLead, layout = 'dialog' }: AddLeadDialogProps) => {
  const { user } = useAuth();
  const canAddLead = user && ['super_admin', 'manager', 'admin', 'member'].includes(user.role);
  const isEditMode = Boolean(editingLead);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(value);
    onOpenChange?.(value);
  };
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const { data: members } = useAgents();
  const { data: officeZones } = useOfficeZones();
  const { data: pipelineStagesData } = usePipelineStages();
  const pipelineStages = (pipelineStagesData && pipelineStagesData.length > 0)
    ? pipelineStagesData
    : PIPELINE_STAGES.map((s, i) => ({ ...s, order: i }));

  // Single lead state
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedLeadV2 | null>(null);
  const [edited, setEdited] = useState<any>(null);
  const [sessionLeads, setSessionLeads] = useState<SessionLead[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Bulk state
  const [bulkText, setBulkText] = useState("");
  const [bulkPreview, setBulkPreview] = useState<any>(null);
  const [bulkQuality, setBulkQuality] = useState("good");
  const [bulkBusy, setBulkBusy] = useState(false);

  const [showMatcher, setShowMatcher] = useState(false);
  const [assignedMemberId, setAssignedAgentId] = useState(user?.role === 'member' ? user.id : 'unassigned');
  const [leadStage, setLeadStage] = useState('new');

  const persistPastedLeadText = useCallback(async (text: string) => {
    const rawText = String(text || '');
    if (!rawText.trim()) return;

    try {
      await fetch('/api/leads/paste-captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          source: 'add_lead_dialog_paste_form',
          page: '/leads',
        }),
      });
    } catch {
      // Best-effort logging only; intake should continue even if this fails.
    }
  }, []);

  const onRawTextPaste = useCallback((event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = event.clipboardData.getData('text');
    if (!pastedText) return;
    void persistPastedLeadText(pastedText);
  }, [persistPastedLeadText]);

  useEffect(() => {
    if (user?.role === 'member' && assignedMemberId === 'unassigned') {
      setAssignedAgentId(user.id);
    }
  }, [user]);

  useEffect(() => {
    if (!isEditMode || !editingLead || !open) return;

    const meta = (editingLead.parsedMetadata || {}) as Record<string, any>;
    const sourceFromLead = (editingLead.source || '').toLowerCase();
    const sourceFormat =
      meta.sourceFormat ||
      (sourceFromLead === 'whatsapp'
        ? 'WhatsApp'
        : sourceFromLead === 'website'
          ? 'Website'
          : sourceFromLead || 'Manual');

    const notesList = String(editingLead.notes || '')
      .split('|')
      .map((n) => n.trim())
      .filter(Boolean)
      .map((text) => ({ text }));

    setMode('single');
    setBulkText('');
    setBulkPreview(null);
    setShowMatcher(false);
    setParsed(null);
    setRawText('');
    setEdited({
      name: editingLead.name || '',
      phone: editingLead.phone || '',
      email: editingLead.email || '',
      location: editingLead.preferredLocation || '',
      areas: meta.areas || [],
      buildingName: meta.buildingName || '',
      fullAddress: meta.fullAddress || '',
      mapLinks: meta.mapLinks || [],
      budget: editingLead.budget || '',
      budgetRanges: meta.budgetRanges || [],
      budgetRaw: editingLead.budget || '',
      moveIn: editingLead.moveInDate || '',
      moveInParsed: parseMoveInV2(editingLead.moveInDate || ''),
      type: editingLead.profession || '',
      room: editingLead.roomType || '',
      need: editingLead.needPreference || '',
      specialReqs: editingLead.specialRequests || '',
      inBLR: meta.inBLR ?? null,
      zone: (editingLead as any).zone || meta.zone || '',
      zones: meta.zones || [],
      techParks: meta.techParks || [],
      source: sourceFormat,
      quality: meta.quality || 'good',
      notes: notesList,
    });
    setAssignedAgentId(editingLead.assignedMemberId || 'unassigned');
    setLeadStage(editingLead.status || 'new');
  }, [isEditMode, editingLead, open]);

  const onTextChange = (v: string) => {
    setRawText(v);
    if (v.trim().length > 3) {
      const p = parseLeadV2(v);
      setParsed(p);
      // Always show the editable form — user can fill missing fields manually
      setEdited(p ? { ...p, zone: "", zones: [], quality: p.quality || "good" } : {
        name: "", phone: "", email: "", location: "", areas: [],
        buildingName: "", fullAddress: "", mapLinks: [],
        budget: "", budgetRanges: [], budgetRaw: "",
        moveIn: "", moveInParsed: null,
        type: "", room: "", need: "", specialReqs: "",
        inBLR: null, zone: "", zones: [], techParks: [],
        source: "Manual", quality: "good", notes: [],
      });
    } else { setParsed(null); setEdited(null); }
  };

  const saveSingle = async () => {
    if (!edited) return;
    if (!edited.name || !edited.phone) { toast.error("Name and phone are required"); return; }
    if (!String(edited.zone || '').trim()) { toast.error("Please select a Zone before saving"); return; }
    if (!edited.moveIn || !String(edited.moveIn || '').trim()) { toast.error("Move in date is required"); return; }
    const zones: string[] = []; // No auto-detection
    const zone = edited.zone;
    const techParks = GEO_TECH_PARKS.filter(p => p.kw.some(k => (edited.location + " " + rawText).toLowerCase().includes(k))).map(p => p.name);
    const moveInParsed = parseMoveInV2(edited.moveIn);
    const quality = edited.quality;

    try {
      const targetAgentId = assignedMemberId === "unassigned" ? null : (assignedMemberId || (members?.[0] as any)?.id || null);
      const payload = {
        name: edited.name,
        phone: edited.phone,
        email: edited.email || null,
        zone: edited.zone,
        source: edited.source === "Manual" ? "whatsapp" : "whatsapp",
        budget: edited.budget || null,
        preferredLocation: edited.location || null,
        moveInDate: edited.moveIn || null,
        profession: edited.type?.toLowerCase() || null,
        roomType: edited.room?.toLowerCase() || null,
        needPreference: edited.need?.toLowerCase() || null,
        specialRequests: edited.specialReqs || null,
        notes: edited.notes?.map((n: any) => n.text).join(" | ") || null,
        parsedMetadata: {
          sourceFormat: edited.source,
          areas: edited.areas,
          zone,
          zones,
          techParks,
          mapLinks: edited.mapLinks || [],
          buildingName: edited.buildingName || "",
          fullAddress: edited.fullAddress || "",
          inBLR: edited.inBLR,
          moveInRaw: edited.moveIn || "",
          moveInUrgency: moveInParsed?.urgency || "",
          moveInUrgencyDays: moveInParsed?.urgencyDays ?? null,
          budgetRanges: edited.budgetRanges || [],
          quality,
        },
        assignedMemberId: targetAgentId,
      };

      if (isEditMode && editingLead) {
        await updateLead.mutateAsync({
          id: editingLead.id,
          ...payload,
          status: leadStage || editingLead.status,
        });
        toast.success("Lead updated successfully");
        setOpen(false);
        return;
      }

      await createLead.mutateAsync({ ...payload, status: leadStage || 'new' });
      const sl: SessionLead = { id: Date.now(), addedAt: tsNow(), ...edited, zone, zones, techParks, quality, moveInParsed, rawText };
      setSessionLeads(prev => [sl, ...prev]);
      setRawText(""); setParsed(null); setEdited(null); 
      setAssignedAgentId(user?.role === 'member' ? user.id : 'unassigned');
      setLeadStage('new');
      toast.success("✓ Lead saved to database!");
    } catch (err: any) { toast.error(err.message || (isEditMode ? "Failed to update lead" : "Failed to create lead")); }
  };

  const doBulkParse = () => {
    if (!bulkText.trim()) return;
    const chunks = splitLeads(bulkText);
    const all = chunks.map(c => parseLeadV2(c)).filter(Boolean);
    const seenP = new Set<string>(), seenE = new Set<string>();
    const deduped = all.filter(l => { if (l!.phone && seenP.has(l!.phone)) return false; if (l!.email && seenE.has(l!.email)) return false; if (l!.phone) seenP.add(l!.phone); if (l!.email) seenE.add(l!.email); return true; }) as ParsedLeadV2[];
    setBulkPreview({ total: chunks.length, valid: deduped.length, parsed: deduped });
  };

  const doBulkImport = async () => {
    if (!bulkPreview) return;
    setBulkBusy(true);
    try {
      const leads = bulkPreview.parsed.map((p: ParsedLeadV2) => {
        const zones: string[] = []; // No auto-detection
        const zone = p.zone;
        if (!zone) {
          throw new Error(`Lead "${p.name}" requires a zone to be assigned.`);
        }
        if (!p.moveIn || !String(p.moveIn || '').trim()) {
          throw new Error(`Lead "${p.name}" requires a move in date.`);
        }
        const techParks = GEO_TECH_PARKS.filter(tp => tp.kw.some(k => ((p.location || "")).toLowerCase().includes(k))).map(tp => tp.name);
        const mip = parseMoveInV2(p.moveIn || "");
        const autoQ = bulkQuality;
        return {
          name: p.name, phone: p.phone, email: p.email || null,
          zone: zone,
          source: "whatsapp", budget: p.budget || null,
          preferredLocation: p.location || null, moveInDate: p.moveIn || null,
          profession: p.type?.toLowerCase() || null, roomType: p.room?.toLowerCase() || null,
          needPreference: p.need?.toLowerCase() || null, specialRequests: p.specialReqs || null,
          notes: null, parsedMetadata: { sourceFormat: p.source, areas: p.areas, zone, zones, techParks, mapLinks: p.mapLinks || [], buildingName: p.buildingName || "", fullAddress: p.fullAddress || "", inBLR: p.inBLR, moveInRaw: p.moveIn || "", moveInUrgency: mip?.urgency || "", moveInUrgencyDays: mip?.urgencyDays ?? null, budgetRanges: p.budgetRanges || [], quality: autoQ },
          assignedMemberId: (members?.[0] as any)?.id || null, status: 'new',
        };
      });
      const res = await fetch('/api/leads/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leads }) });
      if (!res.ok) throw new Error('Bulk import failed');
      const data = await res.json();
      toast.success(`📦 Imported ${data.count} leads!`);
      setBulkText(""); setBulkPreview(null); setMode("single");
    } catch (err: any) { toast.error(err.message || 'Bulk import failed'); }
    finally { setBulkBusy(false); }
  };

  const resetStateOnClose = () => {
    setRawText('');
    setParsed(null);
    setEdited(null);
    setBulkText('');
    setBulkPreview(null);
    setSessionLeads([]);
    setShowMatcher(false);
  };

  const intakeContent = (
    <>
      {showMatcher && <AIMatcher onClose={() => setShowMatcher(false)} />}
      <div style={{ fontFamily: T.sans, background: T.bg0, height: '100%', color: T.text, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 60px rgba(0,0,0,0.12)', border: `1px solid ${T.line}` }}>
          <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');`}</style>

          {/* TOP BAR */}
          <div style={{ background: T.bg1, borderBottom: `1px solid ${T.line}`, padding: "0 20px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 35, height: 35, borderRadius: 9, background: `linear-gradient(135deg,${T.acc},${T.acc2})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: "#fff", boxShadow: `0 0 20px rgba(108,92,231,0.25)` }}>G</div>
              <div>
                <div style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.hi, letterSpacing: "0.04em" }}>{isEditMode ? 'MYT LEAD EDIT' : 'MYT LEAD INTAKE'}</div>
                <div style={{ fontSize: 9, color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Geo Intelligence Engine</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!isEditMode && (
                <button onClick={() => setShowMatcher(true)} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 7, background: T.goldDim, border: `1px solid rgba(196,136,13,0.25)`, color: T.gold, fontWeight: 600, cursor: "pointer" }}>⌖ AI Match</button>
              )}
              <button onClick={() => setOpen(false)} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 7, background: "transparent", border: `1px solid ${T.line}`, color: T.mid, cursor: "pointer" }}>✕ Close</button>
            </div>
          </div>

          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* MAIN PANEL */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: T.bg1, border: `1px solid ${T.line}`, borderRadius: 9, padding: 3, display: "flex", gap: 2 }}>
                {([["single", "📋 Single Lead"], ["bulk", "📦 Bulk Import"]] as const)
                  .filter(([m]) => !isEditMode || m === 'single')
                  .map(([m, lbl]) => (
                    <button key={m} onClick={() => setMode(m as any)} style={{ flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12.5, fontWeight: mode === m ? 700 : 400, background: mode === m ? `linear-gradient(135deg,${T.acc},${T.acc2})` : "transparent", color: mode === m ? T.bg0 : T.mid, border: "none", cursor: "pointer" }}>{lbl}</button>
                  ))}
              </div>

              {mode === "single" && <>
                {!isEditMode && (
                  <>
                    <div style={{ fontSize: 9.5, color: T.dim, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em" }}>Paste Form</div>
                    <textarea value={rawText} onChange={e => onTextChange(e.target.value)} onPaste={onRawTextPaste}
                      placeholder={"Paste any WhatsApp / Gharpayy lead form…\nAll formats detected automatically."}
                      style={{ width: "100%", minHeight: 160, maxHeight: 400, background: T.bg1, border: `1px solid ${rawText ? T.line2 : T.line}`, borderRadius: 9, padding: "10px 12px", fontFamily: T.mono, fontSize: 11, color: T.text, resize: "vertical" as const, lineHeight: 1.7, outline: "none" }} />
                  </>
                )}

                {edited ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 9.5, color: T.dim, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em" }}>Parsed Fields</span>
                      <span style={{ fontSize: 9, color: T.acc, background: "rgba(108,92,231,0.08)", border: "1px solid rgba(108,92,231,0.2)", borderRadius: 20, padding: "2px 9px" }}>edit before saving</span>
                    </div>
                    {FDISPLAY.map(({ key, label, icon }) => (<div key={key} style={{ background: T.bg1, border: `1px solid ${parsed?.[key as keyof ParsedLeadV2] ? T.line2 : T.line}`, borderRadius: 7, padding: "7px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, width: 16, textAlign: "center" as const, flexShrink: 0, opacity: parsed?.[key as keyof ParsedLeadV2] ? 1 : 0.4 }}>{icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 8.5, color: T.dim, lineHeight: 1, marginBottom: 2, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{label}</div>
                        <input value={edited[key] || ""} onChange={e => setEdited({ ...edited, [key]: e.target.value })} placeholder={`No ${label.toLowerCase()}`}
                          style={{ background: "transparent", border: "none", color: edited[key] ? T.hi : T.dim, fontSize: 12.5, width: "100%", fontWeight: edited[key] ? 500 : 400, outline: "none" }} />
                      </div>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, background: parsed?.[key as keyof ParsedLeadV2] ? "#34d399" : T.line2 }} />
                    </div>))}

                    {edited.areas?.length > 1 && (<div style={{ background: "rgba(108,92,231,0.06)", border: "1px solid rgba(108,92,231,0.18)", borderRadius: 7, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, color: T.acc, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 5 }}>📍 Multiple Areas Detected</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{edited.areas.map((a: string, i: number) => <span key={i} style={{ fontSize: 11, color: T.text, background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 4, padding: "2px 8px" }}>{a}</span>)}</div>
                    </div>)}
                    {edited.techParks?.length > 0 && (<div style={{ background: T.goldDim, border: `1px solid rgba(196,136,13,0.2)`, borderRadius: 7, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, color: T.gold, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 5 }}>🏢 Tech Parks Detected</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{edited.techParks.map((tp: string) => <TechPill key={tp} name={tp} />)}</div>
                    </div>)}

                    <div style={{ background: T.bg1, border: `1px solid ${T.line}`, borderRadius: 7, padding: "9px 11px" }}>
                      <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" as const, letterSpacing: "0.07em", fontWeight: 700, marginBottom: 7 }}>Currently in Bangalore?</div>
                      <BLRToggle value={edited.inBLR} onChange={v => setEdited({ ...edited, inBLR: v })} />
                    </div>
                    <div style={{ background: T.bg1, border: `1px solid ${T.line}`, borderRadius: 7, padding: "9px 11px" }}>
                      <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" as const, letterSpacing: "0.07em", fontWeight: 700, marginBottom: 7 }}>Lead Quality</div>
                      <div style={{ display: "flex", gap: 6 }}>{Object.entries(QUALITY).map(([k, q]) => (<button key={k} onClick={() => setEdited({ ...edited, quality: k })} style={{ flex: 1, fontSize: 12, padding: "8px 0", borderRadius: 7, fontWeight: edited.quality === k ? 700 : 400, background: edited.quality === k ? q.bg : "transparent", color: edited.quality === k ? q.color : T.mid, border: `1px solid ${edited.quality === k ? q.border : T.line}`, cursor: "pointer" }}>{q.label}</button>))}</div>
                    </div>
                    <div style={{ background: T.bg1, border: `1px solid ${T.line}`, borderRadius: 7, padding: "9px 11px" }}>
                      <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" as const, letterSpacing: "0.07em", fontWeight: 700, marginBottom: 7, display: "flex", alignItems: "center", gap: 7 }}>Zone <span style={{ color: "#ef4444" }}>*</span></div>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {officeZones?.map((z: any) => (
                          <button
                            key={z._id || z.id}
                            onClick={() => setEdited({ ...edited, zone: edited.zone === z.name ? "" : z.name })}
                            style={{
                              fontSize: 11,
                              padding: "4px 11px",
                              borderRadius: 5,
                              cursor: "pointer",
                              background: edited.zone === z.name ? "rgba(196,136,13,0.18)" : "transparent",
                              color: edited.zone === z.name ? "#d4a853" : T.dim,
                              border: `1px solid ${edited.zone === z.name ? "rgba(196,136,13,0.35)" : T.line}`,
                              transition: "all 0.12s"
                            }}
                          >
                            {z.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    {members && members.length > 0 && (
                      <div style={{ background: T.bg1, border: `1px solid ${T.line}`, borderRadius: 7, padding: "9px 11px" }}>
                        <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" as const, letterSpacing: "0.07em", fontWeight: 700, marginBottom: 7 }}>Assign Member</div>
                        <select value={assignedMemberId} onChange={e => setAssignedAgentId(e.target.value)}
                          style={{ width: "100%", background: T.bg0, border: `1px solid ${T.line2}`, borderRadius: 7, padding: "7px 10px", fontSize: 11, color: T.text, outline: "none" }}>
                          <option value="unassigned">Unassigned</option>
                          {members.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div style={{ background: T.bg1, border: `1px solid ${T.line}`, borderRadius: 7, padding: "9px 11px" }}>
                      <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" as const, letterSpacing: "0.07em", fontWeight: 700, marginBottom: 7 }}>Lead Stage</div>
                      <select value={leadStage} onChange={e => setLeadStage(e.target.value)}
                        style={{ width: "100%", background: T.bg0, border: `1px solid ${T.line2}`, borderRadius: 7, padding: "7px 10px", fontSize: 11, color: T.text, outline: "none" }}>
                        {pipelineStages.map((s: any) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ background: T.bg1, border: `1px solid ${T.line}`, borderRadius: 7, padding: "9px 11px" }}>
                      <NotesBox notes={edited.notes || []} onAdd={n => setEdited({ ...edited, notes: [...(edited.notes || []), n] })} onDelete={i => setEdited({ ...edited, notes: (edited.notes || []).filter((_: any, j: number) => j !== i) })} />
                    </div>
                    <button onClick={saveSingle} disabled={createLead.isPending || updateLead.isPending}
                      style={{ background: (createLead.isPending || updateLead.isPending) ? T.bg3 : `linear-gradient(135deg,${T.acc},${T.acc2})`, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 13, fontWeight: 700, letterSpacing: "0.02em", boxShadow: "0 4px 22px rgba(108,92,231,0.22)", cursor: (createLead.isPending || updateLead.isPending) ? "not-allowed" : "pointer" }}>
                      {(createLead.isPending || updateLead.isPending) ? "Saving…" : (isEditMode ? "Update Lead" : "Save Lead →")}
                    </button>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 50, gap: 10 }}>
                    <div style={{ fontSize: 44, opacity: 0.3 }}>📋</div>
                    <p style={{ fontSize: 12.5, color: T.dim, textAlign: "center", lineHeight: 1.8 }}>
                      {isEditMode
                        ? 'Lead data is loading...'
                        : <>Paste any lead form above.<br />Or use <button onClick={() => setShowMatcher(true)} style={{ background: "transparent", border: "none", color: T.gold, fontSize: 12.5, cursor: "pointer", fontWeight: 600, padding: 0 }}>⌖ AI Match</button> for intelligent area matching.</>}
                    </p>
                  </div>
                )}
              </>}

              {mode === "bulk" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 9.5, color: T.dim, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em" }}>Paste Entire Sheet / Multiple Forms</div>
                  <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={"Paste hundreds of leads here…"}
                    style={{ width: "100%", height: 190, background: T.bg1, border: `1px solid ${bulkText ? T.line2 : T.line}`, borderRadius: 9, padding: "10px 12px", fontFamily: T.mono, fontSize: 11, color: T.text, resize: "vertical" as const, lineHeight: 1.6, outline: "none" }} />
                  <button onClick={doBulkParse} disabled={!bulkText.trim()} style={{ background: T.bg2, border: `1px solid ${T.line2}`, color: T.acc, borderRadius: 9, padding: "9px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>🔍 Parse Leads</button>
                  {bulkPreview && (<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ background: T.bg1, border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
                        {[{ n: bulkPreview.total, sub: "blocks", c: T.acc }, { n: bulkPreview.valid, sub: "valid leads", c: "#34d399" }, { n: bulkPreview.parsed.filter((l: any) => l.phone).length, sub: "with phone", c: "#fb923c" }].map(({ n, sub, c }) => (<div key={sub} style={{ background: T.bg0, borderRadius: 8, padding: "10px", textAlign: "center" as const }}><div style={{ fontSize: 24, fontWeight: 800, color: c }}>{n}</div><div style={{ fontSize: 9.5, color: T.dim }}>{sub}</div></div>))}
                      </div>
                    </div>
                    <div style={{ background: T.bg1, border: `1px solid ${T.line}`, borderRadius: 8, padding: "9px 11px" }}>
                      <div style={{ fontSize: 9.5, color: T.dim, textTransform: "uppercase" as const, letterSpacing: "0.07em", fontWeight: 700, marginBottom: 7 }}>Import all as</div>
                      <div style={{ display: "flex", gap: 6 }}>{Object.entries(QUALITY).map(([k, q]) => (<button key={k} onClick={() => setBulkQuality(k)} style={{ flex: 1, fontSize: 11.5, padding: "7px 0", borderRadius: 7, fontWeight: bulkQuality === k ? 700 : 400, background: bulkQuality === k ? q.bg : "transparent", color: bulkQuality === k ? q.color : T.mid, border: `1px solid ${bulkQuality === k ? q.border : T.line}`, cursor: "pointer" }}>{q.label}</button>))}</div>
                    </div>
                    <button onClick={doBulkImport} disabled={bulkBusy}
                      style={{ background: bulkBusy ? T.bg3 : `linear-gradient(135deg,${T.acc},${T.acc2})`, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 13, fontWeight: 700, cursor: bulkBusy ? "not-allowed" : "pointer" }}>
                      {bulkBusy ? "Importing…" : `📦 Import ${bulkPreview.valid} Leads →`}
                    </button>
                  </div>)}
                </div>
              )}
            </div>

          </div>
        </div>
    </>
  );

  if (layout === 'page') {
    if (!open) return null;
    return <div className="h-full w-full">{intakeContent}</div>;
  }

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetStateOnClose(); }}>
      {!isEditMode && (
        <DialogTrigger asChild disabled={!canAddLead}>
          {trigger || (
            <Button size="sm" className="gap-1.5 text-xs" disabled={!canAddLead} title={!canAddLead ? 'Only Super Admins, managers, admins, and members can add leads' : ''}>
              <Plus size={13} /> Add Lead
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="w-[95vw] sm:max-w-[500px] h-[90vh] sm:h-[85vh] p-0 border-0 bg-transparent shadow-none [&>button]:hidden">
        <DialogTitle className="sr-only">{isEditMode ? 'Edit Lead' : 'Add Lead'}</DialogTitle>
        {intakeContent}
      </DialogContent>
    </Dialog>
  );
};

export default AddLeadDialog;
