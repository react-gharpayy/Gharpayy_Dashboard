"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/myt/components/CopyButton";
import { cn } from "@/lib/utils";
import { fmtWhen, genOtp, mapsLink, whatsappLink } from "@/myt/lib/messaging-utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  KeyRound,
  MapPin,
  MessageSquare,
  Phone,
  PlayCircle,
  Send,
  StopCircle,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import {
  buildNotes,
  fetchVisitById,
  getLeadName,
  getPropertyName,
  parseNotes,
  patchVisitById,
  readString,
  toMetaInput,
  type VisitRecord,
} from "@/features/tour-module/lib/visit-page-api";

type TourEventKind =
  | "booked"
  | "confirmation_sent"
  | "confirmed_by_customer"
  | "reschedule_requested"
  | "reminder_sent"
  | "tcm_on_the_way"
  | "customer_running_late"
  | "tour_started"
  | "tour_ended"
  | "no_show"
  | "cancelled"
  | "feedback_received"
  | "tcm_report_filed"
  | "custom_message_sent";

type TourEvent = {
  id: string;
  tourId: string;
  kind: TourEventKind;
  notes?: string;
  templateId?: string;
  at: string;
};

type MessageTemplate = {
  id: string;
  label: string;
  scenario: string;
  body: string;
};

const EVENT_LABEL: Record<TourEventKind, string> = {
  booked: "Booked",
  confirmation_sent: "Confirmation sent",
  confirmed_by_customer: "Customer confirmed",
  reschedule_requested: "Reschedule requested",
  reminder_sent: "Reminder sent",
  tcm_on_the_way: "TCM on the way",
  customer_running_late: "Customer running late",
  tour_started: "Tour started",
  tour_ended: "Tour ended",
  no_show: "No-show",
  cancelled: "Cancelled",
  feedback_received: "Customer feedback",
  tcm_report_filed: "TCM report filed",
  custom_message_sent: "Custom message",
};

const TEMPLATES: MessageTemplate[] = [
  {
    id: "confirmation",
    label: "Booking Confirmation",
    scenario: "Send the moment a tour is booked",
    body:
      "Hi {{leadName}}, your {{siteName}} tour is locked.\\n" +
      "{{area}} | {{propertyName}}\\n" +
      "{{when}}\\n" +
      "Coordinator: {{tcmName}} ({{tcmPhone}})\\n\\n" +
      "Reply YES to confirm or RESCHEDULE.\\n{{signature}}",
  },
  {
    id: "reminder_2h",
    label: "T-2h Logistics",
    scenario: "2 hours before",
    body:
      "Hi {{leadName}}, your tour is in 2 hours.\\n" +
      "{{propertyName}}, {{area}}\\n" +
      "{{tcmName}} - {{tcmPhone}}\\n" +
      "Directions: {{mapsLink}}\\n{{signature}}",
  },
  {
    id: "tcm_eta",
    label: "TCM On The Way",
    scenario: "TCM taps on-the-way",
    body:
      "Hi {{leadName}}, {{tcmName}} is on the way to {{propertyName}}. ETA: {{etaMinutes}} mins. {{signature}}",
  },
  {
    id: "tour_start_otp",
    label: "Tour Start OTP",
    scenario: "Customer arrival",
    body:
      "Hi {{leadName}}, share OTP {{otp}} with {{tcmName}} to start your tour. {{signature}}",
  },
  {
    id: "no_show_recovery",
    label: "No-show Recovery",
    scenario: "Tour marked no-show",
    body:
      "Hi {{leadName}}, we missed you today. Want to reschedule? Reply with your preferred day/time. {{signature}}",
  },
];

function renderTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/{{(.*?)}}/g, (_, token) => vars[token.trim()] ?? "");
}

function parseEvents(meta: Record<string, string | null>): TourEvent[] {
  const raw = meta.tour_events;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TourEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e?.kind && e?.at)
      .map((e) => ({ ...e, id: String(e.id || `${e.kind}-${e.at}`) }));
  } catch {
    return [];
  }
}

function dedupeEvents(events: TourEvent[]) {
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = `${e.kind}|${e.at}|${e.notes || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function TourCommand() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";

  const [visit, setVisit] = useState<VisitRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [activeTplId, setActiveTplId] = useState<string>(TEMPLATES[0]?.id ?? "");
  const [customBody, setCustomBody] = useState("");
  const [otp, setOtp] = useState("");
  const [etaMinutes, setEtaMinutes] = useState("15");

  useEffect(() => {
    if (!id) {
      setError("Missing tour id");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const row = await fetchVisitById(id, controller.signal);
        setVisit(row);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Failed to fetch tour");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [id]);

  const meta = useMemo(() => parseNotes(visit?.notes), [visit?.notes]);
  const leadName = useMemo(() => getLeadName(visit || {}, meta), [visit, meta]);
  const propertyName = useMemo(() => getPropertyName(visit || {}, meta), [visit, meta]);
  const area = readString(meta.area) ?? readString(meta.zone) ?? "-";
  const phone = readString((visit?.leads || visit?.leadId || {})?.phone) ?? readString(meta.phone) ?? "-";
  const tcmName = readString((visit as any)?.members?.name) ?? readString(meta.assigned_to) ?? "-";
  const tourDate = readString(meta.date) ?? "";
  const tourTime = readString(meta.time) ?? "";
  const status = (readString(meta.status) ?? "scheduled") as string;
  const budget = readString(meta.budget) ?? "-";
  const rawEvents = useMemo(() => parseEvents(meta), [meta]);
  const events = useMemo(
    () => dedupeEvents([...rawEvents].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())),
    [rawEvents]
  );

  const vars = useMemo(
    () => ({
      leadName,
      propertyName,
      area,
      when: tourDate ? fmtWhen(tourDate, tourTime || "10:00") : "-",
      tcmName,
      tcmPhone: "-",
      budget,
      workLocation: readString(meta.work_location) ?? "-",
      mapsLink: mapsLink(area, propertyName),
      etaMinutes,
      otp: otp || "______",
      siteName: "Gharpayy",
      signature: "Gharpayy Team",
    }),
    [leadName, propertyName, area, tourDate, tourTime, tcmName, budget, meta.work_location, etaMinutes, otp]
  );

  const activeTpl = useMemo(() => TEMPLATES.find((t) => t.id === activeTplId), [activeTplId]);
  const renderedActive = useMemo(() => (activeTpl ? renderTemplate(activeTpl.body, vars) : ""), [activeTpl, vars]);
  const renderedCustom = useMemo(() => renderTemplate(customBody, vars), [customBody, vars]);

  // TODO connect score/signal breakdown from backend-calculated intelligence.
  const scoreParts = useMemo(() => {
    const has = (k: TourEventKind) => events.some((e) => e.kind === k);
    const reportFiled = Boolean(meta.tcm_report_filed_at);
    const feedbackSubmitted = Boolean(meta.feedback_submitted_at);
    return {
      confirmation: { earned: has("confirmed_by_customer") ? 20 : has("confirmation_sent") ? 8 : 0, max: 20 },
      showUp: { earned: status === "completed" || has("tour_started") ? 25 : status === "no-show" ? 0 : 8, max: 25 },
      engagement: { earned: feedbackSubmitted ? 15 : 5, max: 15 },
      propertyFit: { earned: meta.tcm_report_budget_alignment === "exact" ? 15 : meta.tcm_report_budget_alignment === "stretch" ? 8 : 3, max: 15 },
      tcmReportQuality: { earned: reportFiled ? 10 : 0, max: 10 },
      conversionLikelihood: { earned: meta.tcm_report_outcome === "booked" ? 15 : meta.tcm_report_outcome === "hot" ? 10 : 5, max: 15 },
    };
  }, [events, meta, status]);

  const totalScore = useMemo(
    () =>
      Object.values(scoreParts).reduce((sum, p) => sum + p.earned, 0),
    [scoreParts]
  );

  async function saveMeta(nextMeta: Record<string, string | null>) {
    if (!id || !visit) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await patchVisitById(id, { notes: buildNotes(toMetaInput(nextMeta)) });
      setVisit(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update tour");
      throw e;
    } finally {
      setIsSaving(false);
    }
  }

  async function logEvent(kind: TourEventKind, notes?: string, templateId?: string, patch?: Record<string, string | null>) {
    const next: TourEvent = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      tourId: id,
      kind,
      notes,
      templateId,
      at: new Date().toISOString(),
    };
    const nextEvents = dedupeEvents([...events, next]);
    const nextMeta: Record<string, string | null> = {
      ...meta,
      ...(patch || {}),
      tour_events: JSON.stringify(nextEvents),
    };
    await saveMeta(nextMeta);
  }

  async function handleCustomerConfirmed() {
    await logEvent("confirmed_by_customer", "Customer replied YES", undefined, { status: "confirmed" });
    toast.success("Marked as confirmed by customer");
  }

  async function handleStartTour() {
    if (!otp) {
      const fresh = genOtp();
      setOtp(fresh);
      await logEvent("custom_message_sent", `OTP generated: ${fresh}`);
      toast.message(`OTP ${fresh} generated. Share with customer or use Tour Start OTP template.`);
      return;
    }
    await logEvent("tour_started", `OTP: ${otp}`, undefined, { status: "confirmed", show_up: "true" });
    toast.success("Tour started");
  }

  async function handleEndTour() {
    await logEvent("tour_ended", undefined, undefined, { status: "completed" });
    toast.success("Tour ended � please file TCM report");
  }

  async function handleNoShow() {
    await logEvent("no_show", "Marked no-show", undefined, { status: "no-show", show_up: "false" });
    toast.warning("Marked as no-show");
  }

  async function handleTcmOnWay() {
    await logEvent("tcm_on_the_way", `ETA ${etaMinutes} min`);
    toast.success("TCM on-the-way logged");
  }

  async function handleCustomerLate() {
    await logEvent("customer_running_late");
    toast.success("Customer-late update logged");
  }

  if (isLoading) {
    return (
      <div className="glass-card p-8 text-center text-sm text-muted-foreground">
        <span className="inline-block h-5 w-5 rounded-full border-2 border-primary border-r-transparent animate-spin mr-2 align-middle" />
        Loading tour...
      </div>
    );
  }

  if (error && !visit) {
    return (
      <div className="space-y-4">
        <Link href="/myt/tours" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to tours
        </Link>
        <div className="glass-card p-4 text-sm text-destructive">{error}</div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="space-y-4">
        <Link href="/myt/tours" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to tours
        </Link>
        <div className="glass-card p-4 text-sm text-muted-foreground">Tour not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <Link href="/myt/tours" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to tours
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="text-xl">{leadName}</CardTitle>
              <div className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{phone}</span>
                <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{tcmName}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{area} � {propertyName}</span>
                <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />{tourDate ? fmtWhen(tourDate, tourTime || "10:00") : "-"}</span>
                <span>Rs {budget}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={status === "completed" ? "default" : "secondary"} className="capitalize">{status}</Badge>
              <div className="text-xs text-muted-foreground">Score</div>
              <div className="text-2xl font-bold tabular-nums">{totalScore}<span className="text-xs text-muted-foreground">/100</span></div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleCustomerConfirmed} disabled={isSaving}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Customer replied YES
            </Button>
            <Button size="sm" variant="outline" onClick={handleTcmOnWay} disabled={isSaving}>
              <Truck className="h-4 w-4 mr-1" /> TCM on the way
            </Button>
            <Button size="sm" variant="outline" onClick={handleCustomerLate} disabled={isSaving}>
              <CircleDot className="h-4 w-4 mr-1" /> Customer running late
            </Button>
            <Button size="sm" onClick={handleStartTour} disabled={isSaving}>
              <PlayCircle className="h-4 w-4 mr-1" /> {otp ? "Confirm tour started" : "Generate OTP & start"}
            </Button>
            <Button size="sm" variant="default" onClick={handleEndTour} disabled={isSaving}>
              <StopCircle className="h-4 w-4 mr-1" /> End tour
            </Button>
            <Button size="sm" variant="destructive" onClick={handleNoShow} disabled={isSaving}>
              <XCircle className="h-4 w-4 mr-1" /> No-show
            </Button>
            <Link href={`/myt/tour/${id}/report`}>
              <Button size="sm" variant="secondary"><Send className="h-4 w-4 mr-1" /> File TCM report</Button>
            </Link>
            <Link href={`/myt/feedback/${id}`}>
              <Button size="sm" variant="secondary"><MessageSquare className="h-4 w-4 mr-1" /> Customer feedback</Button>
            </Link>
          </div>
          {error ? <p className="text-xs text-destructive mt-3">{error}</p> : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="messages" className="w-full">
        <TabsList>
          <TabsTrigger value="messages">Copy-paste messages</TabsTrigger>
          <TabsTrigger value="timeline">Timeline ({events.length})</TabsTrigger>
          <TabsTrigger value="score">Score</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pick a scenario to copy and paste in WhatsApp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTplId(t.id)}
                    className={cn(
                      "text-left rounded border p-2 hover:border-primary transition-colors",
                      activeTplId === t.id && "border-primary bg-primary/5"
                    )}
                  >
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-2">{t.scenario}</div>
                  </button>
                ))}
              </div>

              {activeTpl ? (
                <div className="rounded border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="text-sm font-semibold">{activeTpl.label}</div>
                      <div className="text-xs text-muted-foreground">{activeTpl.scenario}</div>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                      {activeTpl.id === "tour_start_otp" ? (
                        <div className="flex items-center gap-1">
                          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="OTP"
                            className="h-7 w-24 text-xs"
                          />
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOtp(genOtp())}>
                            Gen
                          </Button>
                        </div>
                      ) : null}
                      {activeTpl.id === "tcm_eta" ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">ETA</span>
                          <Input
                            value={etaMinutes}
                            onChange={(e) => setEtaMinutes(e.target.value)}
                            className="h-7 w-16 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">min</span>
                        </div>
                      ) : null}
                      <CopyButton
                        text={renderedActive}
                        variant="default"
                        label="Copy message"
                        onCopied={async () => {
                          await logEvent("custom_message_sent", `Copied: ${activeTpl.label}`, activeTpl.id);
                        }}
                      />
                      <a
                        href={whatsappLink(phone, renderedActive)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={async () => {
                          await logEvent("custom_message_sent", `WA opened: ${activeTpl.label}`, activeTpl.id);
                        }}
                      >
                        <Button size="sm" variant="secondary"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Open WhatsApp</Button>
                      </a>
                    </div>
                  </div>
                  <Textarea value={renderedActive} readOnly rows={Math.min(12, renderedActive.split("\n").length + 1)} className="font-mono text-xs" />
                </div>
              ) : null}

              <div className="rounded border p-3 space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Custom message (variables work: {"{{leadName}}, {{propertyName}}, {{when}}..."})</Label>
                <Textarea value={customBody} onChange={(e) => setCustomBody(e.target.value)} rows={3} placeholder="Type a custom message..." />
                {customBody ? (
                  <>
                    <div className="text-xs text-muted-foreground">Preview</div>
                    <Textarea value={renderedCustom} readOnly rows={Math.min(8, renderedCustom.split("\n").length + 1)} className="font-mono text-xs" />
                    <div className="flex gap-2">
                      <CopyButton text={renderedCustom} variant="default" />
                      <a href={whatsappLink(phone, renderedCustom)} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="secondary"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Open WhatsApp</Button>
                      </a>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="text-xs text-muted-foreground">
                Edit any template wording in <span className="text-primary underline">Settings to Message Templates</span>.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardContent className="pt-6">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet. Use the action buttons above to log lifecycle moments.</p>
              ) : (
                <ol className="relative border-l pl-4 space-y-3">
                  {events.map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                      <div className="text-sm font-medium">{EVENT_LABEL[e.kind] ?? e.kind}</div>
                      <div className="text-[11px] text-muted-foreground">{new Date(e.at).toLocaleString("en-IN")}</div>
                      {e.notes ? <div className="text-xs mt-0.5">{e.notes}</div> : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="score">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="text-3xl font-bold tabular-nums">{totalScore}<span className="text-base text-muted-foreground">/100</span></div>
              <div className="space-y-2">
                {Object.entries(scoreParts).map(([k, p]) => {
                  const pct = p.max ? (p.earned / p.max) * 100 : 0;
                  return (
                    <div key={k}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                        <span className="tabular-nums">{p.earned}/{p.max}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-muted-foreground">Adjust weights in <span className="underline">Settings to Score Weights</span>.</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
