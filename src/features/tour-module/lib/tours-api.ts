"use client";

export type TourRecord = {
  id: string;
  name: string | null;
  phone: string | null;
  property: string | null;
  area: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
  source: string | null;
  tcm_name: string | null;
  show_up: boolean | null;
  outcome: string | null;
  remarks: string | null;
  score: number | null;
  intent: string | null;
  budget: number | null;
  move_in_date: string | null;
  tour_type: string | null;
  zone: string | null;
  work_college: string | null;
  work_location: string | null;
  decision_maker: string | null;
  ready_48h: boolean | null;
  exploring: boolean | null;
  comparing: boolean | null;
  needs_family: boolean | null;
  key_concern: string | null;
  slot: string | null;
  live_score: number | null;
  created_at: string | null;
};

export type NewTourRecord = Omit<TourRecord, "id" | "created_at"> & {
  id?: string;
};

export type UpdateTourRecord = Partial<Omit<TourRecord, "id" | "created_at">>;

type VisitRow = {
  id?: string;
  _id?: string;
  leadId?: any;
  propertyId?: any;
  assignedStaffId?: any;
  scheduledAt?: string;
  updatedAt?: string;
  scheduleRemarks?: string | null;
  outcome?: string | null;
  notes?: string | null;
  createdAt?: string;
  leads?: any;
  properties?: any;
  members?: any;
};

const NULL_TOKEN = "__null__";

function objectIdLike() {
  const seed = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return seed.padEnd(24, "0").slice(0, 24);
}

function encodeMetaValue(value: unknown) {
  if (value == null) return NULL_TOKEN;
  return encodeURIComponent(String(value));
}

function decodeMetaValue(value: string) {
  if (!value || value === NULL_TOKEN) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseNotes(notes: string | null | undefined): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const source = String(notes || "");
  if (!source.trim()) return out;

  source.split(";").forEach((entry) => {
    const chunk = entry.trim();
    if (!chunk) return;
    const sep = chunk.indexOf(":");
    if (sep <= 0) return;
    const key = chunk.slice(0, sep).trim();
    const raw = chunk.slice(sep + 1).trim();
    if (!key) return;
    out[key] = decodeMetaValue(raw);
  });

  return out;
}

function buildNotes(meta: Record<string, unknown>) {
  return Object.entries(meta)
    .map(([key, value]) => `${key}:${encodeMetaValue(value)}`)
    .join("; ");
}

function readString(value: unknown) {
  if (value == null) return null;
  const v = String(value).trim();
  return v ? v : null;
}

function parseBool(value: unknown): boolean | null {
  if (value == null) return null;
  const v = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(v)) return true;
  if (["false", "0", "no"].includes(v)) return false;
  return null;
}

function parseNum(value: unknown): number | null {
  if (value == null || String(value).trim() === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const parsed = readString(value);
    if (parsed) return parsed;
  }
  return null;
}

function formatDatePart(scheduledAt: string | null | undefined) {
  if (!scheduledAt) return null;
  const dt = new Date(scheduledAt);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTimePart(scheduledAt: string | null | undefined) {
  if (!scheduledAt) return null;
  const dt = new Date(scheduledAt);
  if (Number.isNaN(dt.getTime())) return null;
  const h = String(dt.getHours()).padStart(2, "0");
  const m = String(dt.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function deriveStatus(visit: VisitRow, meta: Record<string, string | null>): string | null {
  if (meta.status) return meta.status;
  const outcome = String(visit.outcome || "").toLowerCase();
  if (outcome === "completed") return "completed";
  if (outcome === "no_show") return "no-show";
  if (outcome === "cancelled") return "cancelled";
  return "scheduled";
}

function deriveShowUp(visit: VisitRow, meta: Record<string, string | null>): boolean | null {
  const fromMeta = parseBool(meta.show_up);
  if (fromMeta !== null) return fromMeta;
  const fromArrival = parseBool(meta.tcm_report_arrived);
  if (fromArrival !== null) return fromArrival;
  const outcome = String(visit.outcome || "").toLowerCase();
  if (outcome === "completed") return true;
  if (outcome === "no_show") return false;
  return null;
}

function deriveOutcome(visit: VisitRow, meta: Record<string, string | null>): string | null {
  return firstString(
    meta.post_outcome,
    meta.tcm_report_outcome,
    meta.outcome,
    visit.outcome
  );
}

function deriveRemarks(visit: VisitRow, meta: Record<string, string | null>): string | null {
  return firstString(
    visit.scheduleRemarks,
    meta.tcm_report_notes,
    meta.tour_remarks,
    meta.remarks
  );
}

function visitToTour(visit: VisitRow): TourRecord {
  const meta = parseNotes(visit.notes);
  const lead = visit.leads || visit.leadId || {};
  const prop = visit.properties || visit.propertyId || {};
  const member = visit.members || visit.assignedStaffId || {};
  const id = String(visit.id || visit._id || "");

  return {
    id,
    name: firstString((lead as any)?.name, meta.name),
    phone: firstString((lead as any)?.phone, meta.phone),
    property: firstString((prop as any)?.name, meta.property, meta.typed_property),
    area: firstString(meta.area, (prop as any)?.area, (lead as any)?.zone, meta.zone),
    date: firstString(meta.date, meta.tour_date, formatDatePart(visit.scheduledAt)),
    time: firstString(meta.time, meta.slot, formatTimePart(visit.scheduledAt)),
    status: deriveStatus(visit, meta),
    source: firstString(meta.source, (lead as any)?.source),
    tcm_name: firstString((member as any)?.name, (member as any)?.fullName, meta.assigned_to),
    show_up: deriveShowUp(visit, meta),
    outcome: deriveOutcome(visit, meta),
    remarks: deriveRemarks(visit, meta),
    score: parseNum(meta.score),
    intent: readString(meta.intent),
    budget: parseNum(meta.budget) ?? parseNum((lead as any)?.budget),
    move_in_date: firstString(meta.move_in_date, (lead as any)?.moveInDate),
    tour_type: readString(meta.tour_type),
    zone: readString(meta.zone),
    work_college: readString(meta.work_college),
    work_location: readString(meta.work_location),
    decision_maker: readString(meta.decision_maker),
    ready_48h: parseBool(meta.ready_48h),
    exploring: parseBool(meta.exploring),
    comparing: parseBool(meta.comparing),
    needs_family: parseBool(meta.needs_family),
    key_concern: readString(meta.key_concern),
    slot: firstString(meta.slot, meta.time, formatTimePart(visit.scheduledAt)),
    live_score: parseNum(meta.live_score),
    created_at: firstString(visit.updatedAt, visit.createdAt, visit.scheduledAt),
  };
}

function mapStatusToVisitOutcome(status: string | null | undefined): string | null | undefined {
  if (!status) return undefined;
  if (status === "completed") return "completed";
  if (status === "no-show") return "no_show";
  if (status === "cancelled") return "cancelled";
  if (status === "rescheduled") return "rescheduled";
  if (status === "scheduled" || status === "confirmed") return null;
  return undefined;
}

async function ensureOk(res: Response, action: string) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to ${action}: ${res.status} ${text}`);
  }
}

export async function fetchTours(signal?: AbortSignal): Promise<TourRecord[]> {
  const res = await fetch("/api/visits", {
    cache: "no-store",
    signal,
  });
  await ensureOk(res, "fetch tours");
  const rows = (await res.json()) as VisitRow[];
  return rows.map(visitToTour).sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
}

export async function fetchTourById(id: string, signal?: AbortSignal): Promise<TourRecord> {
  const res = await fetch(`/api/visits/${encodeURIComponent(id)}`, {
    cache: "no-store",
    signal,
  });
  await ensureOk(res, "fetch tour");
  const row = (await res.json()) as VisitRow;
  if (!row) {
    throw new Error("Tour not found");
  }
  return visitToTour(row);
}

export async function createTour(payload: NewTourRecord): Promise<TourRecord> {
  const scheduledAt = payload.date && payload.time ? new Date(`${payload.date}T${payload.time}:00`) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Invalid tour date/time");
  }

  const leadId = objectIdLike();
  const propertyId = objectIdLike();
  const assignedStaffId = objectIdLike();

  const notes = buildNotes({
    name: payload.name,
    phone: payload.phone,
    property: payload.property,
    typed_property: payload.property,
    area: payload.area,
    date: payload.date,
    time: payload.time,
    status: payload.status || "scheduled",
    source: payload.source,
    assigned_to: payload.tcm_name,
    show_up: payload.show_up,
    post_outcome: payload.outcome,
    remarks: payload.remarks,
    score: payload.score,
    intent: payload.intent,
    budget: payload.budget,
    move_in_date: payload.move_in_date,
    tour_type: payload.tour_type,
    zone: payload.zone,
    work_college: payload.work_college,
    work_location: payload.work_location,
    decision_maker: payload.decision_maker,
    ready_48h: payload.ready_48h,
    exploring: payload.exploring,
    comparing: payload.comparing,
    needs_family: payload.needs_family,
    key_concern: payload.key_concern,
    slot: payload.slot || payload.time,
    live_score: payload.live_score ?? payload.score,
    assigned_to_id: assignedStaffId,
  });

  const body = {
    leadId,
    propertyId,
    assignedStaffId,
    scheduledAt: scheduledAt.toISOString(),
    scheduleRemarks: payload.remarks || null,
    notes,
  };

  const res = await fetch("/api/visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await ensureOk(res, "create tour");
  const created = (await res.json()) as VisitRow;
  return visitToTour(created);
}

export async function updateTourById(id: string, payload: UpdateTourRecord): Promise<TourRecord> {
  const existing = await fetchTourById(id);
  const merged = {
    ...existing,
    ...payload,
    id: existing.id,
    created_at: existing.created_at,
  };

  const visitOutcome = mapStatusToVisitOutcome(merged.status);
  const notes = buildNotes({
    name: merged.name,
    phone: merged.phone,
    property: merged.property,
    typed_property: merged.property,
    area: merged.area,
    date: merged.date,
    time: merged.time,
    status: merged.status,
    source: merged.source,
    assigned_to: merged.tcm_name,
    show_up: merged.show_up,
    post_outcome: merged.outcome,
    remarks: merged.remarks,
    score: merged.score,
    intent: merged.intent,
    budget: merged.budget,
    move_in_date: merged.move_in_date,
    tour_type: merged.tour_type,
    zone: merged.zone,
    work_college: merged.work_college,
    work_location: merged.work_location,
    decision_maker: merged.decision_maker,
    ready_48h: merged.ready_48h,
    exploring: merged.exploring,
    comparing: merged.comparing,
    needs_family: merged.needs_family,
    key_concern: merged.key_concern,
    slot: merged.slot || merged.time,
    live_score: merged.live_score ?? merged.score,
  });

  const patchPayload: Record<string, unknown> = {
    scheduleRemarks: merged.remarks || null,
    notes,
  };
  if (visitOutcome !== undefined) {
    patchPayload.outcome = visitOutcome;
  }

  const res = await fetch(`/api/visits/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patchPayload),
  });
  await ensureOk(res, "update tour");
  const updated = (await res.json()) as VisitRow;
  if (!updated) throw new Error("Tour not found after update");
  return visitToTour(updated);
}
