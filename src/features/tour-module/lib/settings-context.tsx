import React, { createContext, useContext, useEffect, useState } from "react";

// ---------- Types ----------
export type CustomFieldType = "text" | "number" | "select" | "boolean";
export interface CustomField {
  id: string;
  label: string;
  type: CustomFieldType;
  appliesTo: "tour" | "property" | "lead";
  options?: string[]; // for select
}

export interface MessageTemplate {
  id: string; // stable key, e.g. 'confirmation'
  label: string;
  scenario: string; // when to send
  body: string; // with {{variables}}
}

export interface ScoreWeights {
  confirmation: number;
  showUp: number;
  engagement: number;
  propertyFit: number;
  tcmReportQuality: number;
  conversionLikelihood: number;
}

export interface ReminderOffsets {
  beforeTourMinutes: number[]; // e.g. [240, 120, 30]
  postBookingFollowupMinutes: number[]; // e.g. [5, 15, 60] for no-reply
}

export interface CustomTarget {
  id: string;
  label: string;
  metric: "tours" | "showups" | "bookings" | "score";
  scope: "tcm" | "zone" | "property" | "global";
  scopeId?: string;
  value: number;
  period: "day" | "week" | "month";
}

export interface SettingsState {
  customFields: CustomField[];
  templates: MessageTemplate[];
  weights: ScoreWeights;
  reminders: ReminderOffsets;
  targets: CustomTarget[];
  // user-extensible lists
  customAreas: string[];
  customProperties: { id: string; name: string; area: string; basePrice: number }[];
  customTcms: { id: string; name: string; phone: string; zoneId: string }[];
  customOutcomes: string[];
  customObjections: string[];
  // wording
  siteName: string;
  signatureLine: string;
}

// ---------- Defaults ----------
const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: "confirmation",
    label: "Booking Confirmation",
    scenario: "Send the moment a tour is booked",
    body:
      "Hi {{leadName}}, your {{siteName}} tour is *locked in* 🔒\n" +
      "📍 {{area}} | 🏠 {{propertyName}}\n" +
      "🕒 {{when}}\n" +
      "👤 Coordinator: {{tcmName}} ({{tcmPhone}})\n\n" +
      "This slot is reserved exclusively for you.\n" +
      "Reply *YES* to confirm or *RESCHEDULE*.\n" +
      "{{signature}}",
  },
  {
    id: "social_proof",
    label: "Social Proof Boost",
    scenario: "Send within 5 mins of confirmation if no YES reply",
    body:
      "Just so you know — *12 people* booked tours at {{propertyName}} this week. " +
      "Your slot at {{when}} is reserved. Reply *YES* to lock it. {{signature}}",
  },
  {
    id: "followup_5m",
    label: "Follow-up T+5min (no reply)",
    scenario: "Auto-follow if customer hasn't confirmed in 5 mins",
    body:
      "Hi {{leadName}}, just checking — did you get your tour confirmation for {{propertyName}} at {{when}}? " +
      "Reply *YES* so we hold your slot. {{signature}}",
  },
  {
    id: "followup_15m",
    label: "Follow-up T+15min",
    scenario: "Second nudge",
    body:
      "Hi {{leadName}}, your slot at {{propertyName}} ({{when}}) will be released soon if not confirmed. " +
      "Reply *YES* now to keep it. {{signature}}",
  },
  {
    id: "reminder_4h",
    label: "T-4h Context Reminder",
    scenario: "4 hours before the tour — remind WHY this is relevant",
    body:
      "Hi {{leadName}}, your {{siteName}} tour is in *4 hours*.\n" +
      "Based on your budget *₹{{budget}}* and your work area *{{workLocation}}*, " +
      "{{propertyName}} is one of your strongest matches.\n" +
      "🕒 {{when}} 📍 {{area}}\n{{signature}}",
  },
  {
    id: "reminder_2h",
    label: "T-2h Logistics",
    scenario: "2 hours before — directions + coordinator contact",
    body:
      "Hi {{leadName}}, your {{siteName}} tour is in *2 hours*.\n" +
      "📍 {{propertyName}}, {{area}}\n" +
      "👤 {{tcmName}} — call: {{tcmPhone}}\n" +
      "Tap for directions: {{mapsLink}}\n{{signature}}",
  },
  {
    id: "reminder_30m",
    label: "T-30m Action Trigger",
    scenario: "30 minutes before — leave now",
    body:
      "Hi {{leadName}}, *time to leave* 🚗\n" +
      "Your tour at {{propertyName}} starts in 30 mins.\n" +
      "👤 {{tcmName}} ({{tcmPhone}}) is on the way.\n{{signature}}",
  },
  {
    id: "tcm_eta",
    label: "TCM On The Way (ETA)",
    scenario: "TCM taps 'On the way' — auto-share with customer",
    body:
      "Hi {{leadName}}, your coordinator {{tcmName}} is *on the way* to {{propertyName}}. " +
      "ETA: {{etaMinutes}} mins. Call: {{tcmPhone}}. {{signature}}",
  },
  {
    id: "customer_running_late",
    label: "Customer Running Late (TCM-side ack)",
    scenario: "Acknowledge a 'running late' message",
    body:
      "No worries {{leadName}}, take your time. {{tcmName}} will wait at {{propertyName}}. " +
      "Just reply with your new ETA. {{signature}}",
  },
  {
    id: "tour_start_otp",
    label: "Tour Start OTP",
    scenario: "Customer arrives — share OTP for verified start",
    body:
      "Hi {{leadName}}, share this OTP with {{tcmName}} to start your tour: *{{otp}}* — " +
      "valid for 10 mins. {{signature}}",
  },
  {
    id: "tour_started",
    label: "Tour Started",
    scenario: "After OTP/geo verified — confirm to customer",
    body:
      "Your {{siteName}} tour at {{propertyName}} has *officially started*. " +
      "We're walking you through options tailored to your needs. {{signature}}",
  },
  {
    id: "tour_ended",
    label: "Tour Ended + Feedback",
    scenario: "Right after tour ends",
    body:
      "Your tour at {{propertyName}} is *complete* ✅\n" +
      "How was it?\n• Loved it 🔥\n• Good but unsure 🙂\n• Not a fit ❌\n• Need better options 🔄\n" +
      "Reply with one. {{signature}}",
  },
  {
    id: "post_tour_predictive",
    label: "Post-Tour Predictive Nudge",
    scenario: "1-3 hrs after tour — push conversion",
    body:
      "Hi {{leadName}}, *people with similar preferences booked {{propertyName}} within 24 hrs* " +
      "of their tour. Want us to block your room before someone else does? Reply *BLOCK*. {{signature}}",
  },
  {
    id: "no_show_recovery",
    label: "No-show Recovery",
    scenario: "When tour is marked as no-show",
    body:
      "Hi {{leadName}}, we missed you at {{propertyName}} today. " +
      "Want to reschedule? Reply with a day & time and {{tcmName}} will lock it in. {{signature}}",
  },
];

const DEFAULT_WEIGHTS: ScoreWeights = {
  confirmation: 20,
  showUp: 25,
  engagement: 15,
  propertyFit: 15,
  tcmReportQuality: 10,
  conversionLikelihood: 15,
};

const DEFAULT_REMINDERS: ReminderOffsets = {
  beforeTourMinutes: [240, 120, 30],
  postBookingFollowupMinutes: [5, 15, 60],
};

const DEFAULT_SETTINGS: SettingsState = {
  customFields: [],
  templates: DEFAULT_TEMPLATES,
  weights: DEFAULT_WEIGHTS,
  reminders: DEFAULT_REMINDERS,
  targets: [],
  customAreas: [],
  customProperties: [],
  customTcms: [],
  customOutcomes: [],
  customObjections: [
    "Too expensive",
    "Rooms too small",
    "Location far",
    "Food concerns",
    "Comparing other PG",
    "Needs family approval",
  ],
  siteName: "Gharpayy",
  signatureLine: "— Team Gharpayy",
};

// ---------- Storage ----------
const KEY = "gharpayy.settings.v1";

function load(): SettingsState {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    // merge templates: keep user edits + add any new defaults missing
    const userTpls = parsed.templates ?? [];
    const userIds = new Set(userTpls.map((t) => t.id));
    const merged = [...userTpls, ...DEFAULT_TEMPLATES.filter((t) => !userIds.has(t.id))];
    return { ...DEFAULT_SETTINGS, ...parsed, templates: merged };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function save(s: SettingsState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

// ---------- Context ----------
interface SettingsCtx {
  settings: SettingsState;
  update: <K extends keyof SettingsState>(k: K, v: SettingsState[K]) => void;
  reset: () => void;
  upsertTemplate: (t: MessageTemplate) => void;
  removeTemplate: (id: string) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(() => load());

  useEffect(() => {
    save(settings);
  }, [settings]);

  function update<K extends keyof SettingsState>(k: K, v: SettingsState[K]) {
    setSettings((s) => ({ ...s, [k]: v }));
  }
  function reset() {
    setSettings(DEFAULT_SETTINGS);
  }
  function upsertTemplate(t: MessageTemplate) {
    setSettings((s) => {
      const exists = s.templates.some((x) => x.id === t.id);
      const templates = exists
        ? s.templates.map((x) => (x.id === t.id ? t : x))
        : [...s.templates, t];
      return { ...s, templates };
    });
  }
  function removeTemplate(id: string) {
    setSettings((s) => ({ ...s, templates: s.templates.filter((x) => x.id !== id) }));
  }

  return (
    <Ctx.Provider value={{ settings, update, reset, upsertTemplate, removeTemplate }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

// ---------- Template engine ----------
export interface TemplateVars {
  leadName?: string;
  propertyName?: string;
  area?: string;
  when?: string;
  tcmName?: string;
  tcmPhone?: string;
  budget?: string | number;
  workLocation?: string;
  mapsLink?: string;
  etaMinutes?: string | number;
  otp?: string;
  siteName?: string;
  signature?: string;
  [k: string]: string | number | undefined;
}

export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? `{{${k}}}` : String(v);
  });
}
