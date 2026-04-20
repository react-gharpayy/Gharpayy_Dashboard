"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Video, Briefcase, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfidenceBar } from "@/features/tour-module/components/ConfidenceBar";
import { SlotPicker, getTakenSlotsForDate } from "@/features/tour-module/components/SlotPicker";
import { scoreTour, inferConfirmationStrength, intentBg } from "@/features/tour-module/lib/confidence";
import { zones, teamMembers } from "@/features/tour-module/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  createTour,
  fetchTours,
  type NewTourRecord,
  type TourRecord,
} from "@/features/tour-module/lib/tours-api";
import type { BookingSource, DecisionMaker, TourQualification, TourType, WillBookToday } from "@/features/tour-module/lib/types";

const todayStr = () => new Date().toISOString().split("T")[0];
const in7days = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
};

const roomTypes = ["Single", "Double Sharing", "Triple Sharing", "Studio"];

export default function ScheduleTour() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [existingTours, setExistingTours] = useState<TourRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    leadName: "",
    phone: "",
    bookingSource: "whatsapp" as BookingSource,
    moveInDate: todayStr(),
    budget: "12000",
    workLocation: "",
    occupation: "",
    roomType: "Single",
    decisionMaker: "self" as DecisionMaker,
    readyIn48h: false,
    exploring: false,
    comparing: false,
    needsFamily: false,
    willBookToday: "maybe" as WillBookToday,
    keyConcern: "",
    tourType: "physical" as TourType,
    zoneId: zones[0]?.id ?? "",
    propertyName: "",
    tourDate: todayStr(),
    tourTime: "",
    assignedTo: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const rows = await fetchTours(controller.signal);
        setExistingTours(rows);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Failed to fetch tours");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };
    run();
    return () => controller.abort();
  }, []);

  const qualification: TourQualification = useMemo(
    () => ({
      moveInDate: form.moveInDate,
      decisionMaker: form.decisionMaker,
      roomType: form.roomType,
      occupation: form.occupation,
      workLocation: form.workLocation,
      willBookToday: form.willBookToday,
      readyIn48h: form.readyIn48h,
      exploring: form.exploring,
      comparing: form.comparing,
      needsFamily: form.needsFamily,
      keyConcern: form.keyConcern,
    }),
    [form]
  );

  const { score, intent, reason } = useMemo(
    () => scoreTour(qualification, Number.parseInt(form.budget, 10) || 0),
    [qualification, form.budget]
  );
  const confirmationStrength = useMemo(() => inferConfirmationStrength(qualification), [qualification]);

  const tcmsInZone = teamMembers.filter((m) => m.role === "tcm" && m.zoneId === form.zoneId);
  const effectiveTcm = form.assignedTo ? teamMembers.find((m) => m.id === form.assignedTo) : tcmsInZone[0];

  const takenSlots = useMemo(() => {
    if (!effectiveTcm) return new Set<string>();
    const normalized = existingTours.map((t) => ({
      assignedTo: t.tcm_name ?? "",
      tourDate: t.date ?? "",
      tourTime: t.time ?? "",
      status: t.status ?? "",
    }));
    return getTakenSlotsForDate(normalized as any, effectiveTcm.name, form.tourDate);
  }, [existingTours, effectiveTcm, form.tourDate]);

  const canSubmit = !!(form.leadName && form.phone && form.propertyName && form.tourTime && effectiveTcm && !isSubmitting);

  const handleSubmit = async () => {
    if (!canSubmit || !effectiveTcm) return;
    const zone = zones.find((z) => z.id === form.zoneId);
    const payload: NewTourRecord = {
      name: form.leadName,
      phone: form.phone,
      property: form.propertyName,
      area: zone?.area ?? "",
      date: form.tourDate,
      time: form.tourTime,
      status: "scheduled",
      source: form.bookingSource,
      tcm_name: effectiveTcm.name,
      show_up: null,
      outcome: null,
      remarks: "",
      score,
      intent,
      budget: Number.parseInt(form.budget, 10) || 0,
      move_in_date: form.moveInDate,
      tour_type: form.tourType,
      zone: form.zoneId,
      work_college: form.occupation,
      work_location: form.workLocation,
      decision_maker: form.decisionMaker,
      ready_48h: form.readyIn48h,
      exploring: form.exploring,
      comparing: form.comparing,
      needs_family: form.needsFamily,
      key_concern: form.keyConcern || null,
      slot: form.tourTime,
      live_score: score,
    };

    try {
      setIsSubmitting(true);
      setError(null);
      await createTour(payload);
      router.push("/myt/tours");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule tour");
    } finally {
      setIsSubmitting(false);
    }
  };

  const select = "w-full h-10 bg-surface-2 border border-border rounded-md px-3 text-sm text-foreground";
  const labelCls = "text-muted-foreground text-[11px] uppercase tracking-wide";

  return (
    <div className="space-y-4 animate-slide-up max-w-3xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Schedule Tour</h1>
          <p className="text-xs text-muted-foreground">Smart form - every tour scored before send</p>
        </div>
        <div className={cn("rounded-xl border p-3 min-w-[200px]", intentBg[intent])}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="h-3 w-3" />
            <span className="text-[10px] uppercase tracking-wide font-semibold">Live Score</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {score}
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
          <ConfidenceBar score={score} intent={intent} showLabel={false} className="mt-1.5" />
          {reason.length > 0 && <p className="text-[10px] mt-1.5 leading-snug opacity-80">{reason.join(" · ")}</p>}
          <p className="text-[10px] mt-1">Confirmation: {confirmationStrength}</p>
        </div>
      </div>

      <div className="flex gap-1.5">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            onClick={() => setStep(n as 1 | 2 | 3)}
            className={cn("flex-1 h-1.5 rounded-full transition-colors", step >= n ? "bg-primary" : "bg-surface-2")}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="glass-card p-4 md:p-5 space-y-4">
          <h3 className="font-heading font-semibold text-sm text-foreground">1. Customer & Qualification</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className={labelCls}>Lead Name</Label>
              <Input value={form.leadName} onChange={(e) => setForm((f) => ({ ...f, leadName: e.target.value }))} className="bg-surface-2 border-border" />
            </div>
            <div>
              <Label className={labelCls}>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="bg-surface-2 border-border" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={labelCls}>Source</Label>
              <select value={form.bookingSource} onChange={(e) => setForm((f) => ({ ...f, bookingSource: e.target.value as BookingSource }))} className={select}>
                <option value="ad">Ad</option>
                <option value="referral">Referral</option>
                <option value="organic">Organic</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="call">Call</option>
                <option value="walk-in">Walk-in</option>
              </select>
            </div>
            <div>
              <Label className={labelCls}>Decision Maker</Label>
              <select value={form.decisionMaker} onChange={(e) => setForm((f) => ({ ...f, decisionMaker: e.target.value as DecisionMaker }))} className={select}>
                <option value="self">Self</option>
                <option value="parent">Parent</option>
                <option value="group">Group</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={labelCls}>Move-in Date</Label>
              <Input type="date" min={todayStr()} value={form.moveInDate} onChange={(e) => setForm((f) => ({ ...f, moveInDate: e.target.value }))} className="bg-surface-2 border-border" />
            </div>
            <div>
              <Label className={labelCls}>Budget (Rs/mo)</Label>
              <Input type="number" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} className="bg-surface-2 border-border" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={labelCls}>Work / College</Label>
              <Input value={form.occupation} onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))} className="bg-surface-2 border-border" />
            </div>
            <div>
              <Label className={labelCls}>Work Location</Label>
              <Input value={form.workLocation} onChange={(e) => setForm((f) => ({ ...f, workLocation: e.target.value }))} className="bg-surface-2 border-border" />
            </div>
          </div>

          <div>
            <Label className={labelCls}>Room Type</Label>
            <select value={form.roomType} onChange={(e) => setForm((f) => ({ ...f, roomType: e.target.value }))} className={select}>
              {roomTypes.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={() => setStep(2)} disabled={!form.leadName || !form.phone} className="w-full">
            Next: Intent →
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="glass-card p-4 md:p-5 space-y-4">
          <h3 className="font-heading font-semibold text-sm text-foreground">2. Intent Signals</h3>

          <div className="space-y-2">
            {[
              ["readyIn48h", "Ready to finalize within 48 hours", "positive"],
              ["exploring", "Only exploring", "negative"],
              ["comparing", "Comparing options", "negative"],
              ["needsFamily", "Needs family approval", "negative"],
            ].map(([key, label, kind]) => (
              <label
                key={key}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border bg-surface-2/40 cursor-pointer hover:bg-surface-2 transition-colors",
                  form[key as keyof typeof form] &&
                    (kind === "positive" ? "border-role-tcm/40 bg-role-tcm/5" : "border-amber/40 bg-amber/5")
                )}
              >
                <Checkbox checked={form[key as keyof typeof form] as boolean} onCheckedChange={(v) => setForm((f) => ({ ...f, [key]: v === true }))} />
                <span className="text-sm text-foreground flex-1">{label as string}</span>
                <span className={cn("text-[10px] font-medium", kind === "positive" ? "text-role-tcm" : "text-amber-foreground")}>{kind === "positive" ? "+" : "-"}</span>
              </label>
            ))}
          </div>

          <div className="pt-2 border-t border-border">
            <Label className="text-foreground text-sm font-semibold">If everything matches, will you book today?</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {(["yes", "maybe", "no"] as WillBookToday[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, willBookToday: opt }))}
                  className={cn(
                    "h-11 rounded-lg border-2 text-sm font-medium uppercase tracking-wide transition-all",
                    form.willBookToday === opt
                      ? opt === "yes"
                        ? "border-role-tcm bg-role-tcm/15 text-role-tcm"
                        : opt === "no"
                        ? "border-danger bg-danger/15 text-danger"
                        : "border-role-hr bg-role-hr/15 text-role-hr"
                      : "border-border bg-surface-2 text-muted-foreground hover:bg-surface-3"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className={labelCls}>Key Concern (optional)</Label>
            <Input value={form.keyConcern} onChange={(e) => setForm((f) => ({ ...f, keyConcern: e.target.value }))} className="bg-surface-2 border-border" />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
              ← Back
            </Button>
            <Button onClick={() => setStep(3)} className="flex-1">
              Next: Slot →
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="glass-card p-4 md:p-5 space-y-4">
          <h3 className="font-heading font-semibold text-sm text-foreground">3. Tour Type & Slot</h3>

          <div>
            <Label className={labelCls}>Tour Type</Label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {([
                ["physical", <Building2 key="p" className="h-4 w-4" />, "Physical"],
                ["virtual", <Video key="v" className="h-4 w-4" />, "Virtual"],
                ["pre-book-pitch", <Briefcase key="b" className="h-4 w-4" />, "Pre-book"],
              ] as const).map(([val, icon, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tourType: val as TourType }))}
                  className={cn(
                    "h-14 rounded-lg border-2 text-xs font-medium flex flex-col items-center justify-center gap-1 transition-all",
                    form.tourType === val ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface-2 text-muted-foreground"
                  )}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={labelCls}>Zone</Label>
              <select value={form.zoneId} onChange={(e) => setForm((f) => ({ ...f, zoneId: e.target.value, assignedTo: "" }))} className={select}>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className={labelCls}>Property</Label>
              <Input value={form.propertyName} onChange={(e) => setForm((f) => ({ ...f, propertyName: e.target.value }))} className="bg-surface-2 border-border" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={labelCls}>Date</Label>
              <Input type="date" min={todayStr()} max={in7days()} value={form.tourDate} onChange={(e) => setForm((f) => ({ ...f, tourDate: e.target.value, tourTime: "" }))} className="bg-surface-2 border-border" />
            </div>
            <div>
              <Label className={labelCls}>Assign TCM</Label>
              <select value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value, tourTime: "" }))} className={select}>
                <option value="">Auto-assign ({effectiveTcm?.name ?? "-"})</option>
                {tcmsInZone.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label className={labelCls}>Pick Slot {effectiveTcm && <span className="ml-2 normal-case text-foreground/60">({effectiveTcm.name})</span>}</Label>
            <div className="mt-1.5">
              <SlotPicker
                date={form.tourDate}
                selected={form.tourTime}
                onSelect={(t) => setForm((f) => ({ ...f, tourTime: t }))}
                takenSlots={takenSlots}
                recommendEarly={intent === "hard"}
              />
            </div>
          </div>

          {isLoading && <p className="text-xs text-muted-foreground">Loading existing tours...</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
              ← Back
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit} className="flex-[2]">
              {isSubmitting ? "Scheduling..." : `Schedule ${intent.toUpperCase()} Tour`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
