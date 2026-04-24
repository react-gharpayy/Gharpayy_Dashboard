"use client";

export type VisitRecord = {
  id?: string;
  _id?: string;
  notes?: string | null;
  leadId?: any;
  propertyId?: any;
  leads?: any;
  properties?: any;
};

const NULL_TOKEN = "__null__";

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

export function parseNotes(notes: string | null | undefined): Record<string, string | null> {
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

export function buildNotes(meta: Record<string, unknown>) {
  return Object.entries(meta)
    .map(([key, value]) => `${key}:${encodeMetaValue(value)}`)
    .join("; ");
}

export function toMetaInput(meta: Record<string, string | null>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(meta));
}

export function readString(value: unknown) {
  if (value == null) return null;
  const v = String(value).trim();
  return v ? v : null;
}

export async function fetchVisitById(id: string, signal?: AbortSignal): Promise<VisitRecord> {
  const res = await fetch(`/api/visits/${encodeURIComponent(id)}`, { cache: "no-store", signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch visit: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function patchVisitById(id: string, body: Record<string, unknown>): Promise<VisitRecord> {
  const res = await fetch(`/api/visits/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Failed to update visit: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export function getLeadName(visit: VisitRecord, meta: Record<string, string | null>) {
  return (
    readString((visit.leads || visit.leadId || {})?.name) ??
    readString(meta.name) ??
    "-"
  );
}

export function getPropertyName(visit: VisitRecord, meta: Record<string, string | null>) {
  return (
    readString((visit.properties || visit.propertyId || {})?.name) ??
    readString(meta.property) ??
    readString(meta.typed_property) ??
    "-"
  );
}
