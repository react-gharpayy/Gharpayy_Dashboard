"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  buildNotes,
  fetchVisitById,
  getLeadName,
  parseNotes,
  patchVisitById,
  toMetaInput,
  type VisitRecord,
} from "@/features/tour-module/lib/visit-page-api";

type TCMReport = {
  tourId: string;
  arrived: "yes" | "no" | "proxy";
  punctuality: "early" | "on_time" | "late" | "no_show";
  budgetAlignment: "exact" | "stretch" | "mismatch";
  propertyReaction: "positive" | "neutral" | "negative";
  interestLevel: "high" | "medium" | "low";
  firstObjection?: string;
  priceReactionWords?: string;
  decisionAuthority: "self" | "parent" | "group" | "other";
  comparisonReference?: string;
  emotionalTone: "excited" | "confused" | "defensive" | "neutral";
  outcome: "booked" | "hot" | "warm" | "cold" | "dropped";
  nextStep: string;
  notes?: string;
  filedAt: string;
};

type Field<T extends string> = { value: T; label: string };

function Pills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | undefined;
  onChange: (v: T) => void;
  options: Field<T>[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-2.5 py-1 rounded text-xs border",
            value === o.value
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border hover:border-primary/50"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const OBJECTIONS = [
  "Too expensive",
  "Rooms too small",
  "Location far",
  "Food concerns",
  "Comparing other PG",
  "Needs family approval",
];

function getExistingReport(tourId: string, meta: Record<string, string | null>): Partial<TCMReport> {
  const filedAt = meta.tcm_report_filed_at;
  if (!filedAt) {
    return {
      tourId,
      arrived: undefined,
      punctuality: undefined,
      budgetAlignment: undefined,
      propertyReaction: undefined,
      interestLevel: undefined,
      decisionAuthority: undefined,
      emotionalTone: undefined,
      outcome: undefined,
      nextStep: "",
    };
  }

  return {
    tourId,
    arrived: (meta.tcm_report_arrived as TCMReport["arrived"]) || undefined,
    punctuality: (meta.tcm_report_punctuality as TCMReport["punctuality"]) || undefined,
    budgetAlignment: (meta.tcm_report_budget_alignment as TCMReport["budgetAlignment"]) || undefined,
    propertyReaction: (meta.tcm_report_property_reaction as TCMReport["propertyReaction"]) || undefined,
    interestLevel: (meta.tcm_report_interest_level as TCMReport["interestLevel"]) || undefined,
    firstObjection: meta.tcm_report_first_objection || undefined,
    priceReactionWords: meta.tcm_report_price_reaction_words || undefined,
    decisionAuthority: (meta.tcm_report_decision_authority as TCMReport["decisionAuthority"]) || undefined,
    comparisonReference: meta.tcm_report_comparison_reference || undefined,
    emotionalTone: (meta.tcm_report_emotional_tone as TCMReport["emotionalTone"]) || undefined,
    outcome: (meta.tcm_report_outcome as TCMReport["outcome"]) || undefined,
    nextStep: meta.tcm_report_next_step || "",
    notes: meta.tcm_report_notes || undefined,
    filedAt,
  };
}

function mapReportOutcomeToPostOutcome(
  outcome: TCMReport["outcome"]
): "booked" | "token-paid" | "draft" | "follow-up" | "rejected" | "not-interested" {
  switch (outcome) {
    case "booked":
      return "booked";
    case "hot":
      return "follow-up";
    case "warm":
      return "draft";
    case "cold":
      return "rejected";
    case "dropped":
      return "not-interested";
    default:
      return "draft";
  }
}

export default function TCMReportRoutePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";
  const router = useRouter();

  const [visit, setVisit] = useState<VisitRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const meta = useMemo(() => parseNotes(visit?.notes), [visit?.notes]);
  const leadName = useMemo(() => getLeadName(visit || {}, meta), [visit, meta]);

  const [r, setR] = useState<Partial<TCMReport>>({
    tourId: "",
    arrived: undefined,
    punctuality: undefined,
    budgetAlignment: undefined,
    propertyReaction: undefined,
    interestLevel: undefined,
    decisionAuthority: undefined,
    emotionalTone: undefined,
    outcome: undefined,
    nextStep: "",
  });

  useEffect(() => {
    if (!id) {
      setError("Missing tour id");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchVisitById(id, controller.signal);
        setVisit(data);
        setR(getExistingReport(id, parseNotes(data?.notes)));
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Failed to load report");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    run();
    return () => controller.abort();
  }, [id]);

  function field<K extends keyof TCMReport>(k: K, v: TCMReport[K]) {
    setR((p) => ({ ...p, [k]: v }));
  }

  function canSubmit() {
    return (
      r.arrived &&
      r.punctuality &&
      r.budgetAlignment &&
      r.propertyReaction &&
      r.interestLevel &&
      r.decisionAuthority &&
      r.emotionalTone &&
      r.outcome &&
      r.nextStep &&
      r.nextStep.trim().length > 0
    );
  }

  async function submit() {
    if (!canSubmit() || !id) return;
    setSaving(true);
    setError(null);
    try {
      const report: TCMReport = {
        tourId: id,
        arrived: r.arrived!,
        punctuality: r.punctuality!,
        budgetAlignment: r.budgetAlignment!,
        propertyReaction: r.propertyReaction!,
        interestLevel: r.interestLevel!,
        firstObjection: r.firstObjection,
        priceReactionWords: r.priceReactionWords,
        decisionAuthority: r.decisionAuthority!,
        comparisonReference: r.comparisonReference,
        emotionalTone: r.emotionalTone!,
        outcome: r.outcome!,
        nextStep: r.nextStep!,
        notes: r.notes,
        filedAt: new Date().toISOString(),
      };

      const mappedOutcome = mapReportOutcomeToPostOutcome(report.outcome);
      const nextMeta = {
        ...meta,
        post_outcome: mappedOutcome,
        remarks: report.notes || null,
        tcm_report_arrived: report.arrived,
        tcm_report_punctuality: report.punctuality,
        tcm_report_budget_alignment: report.budgetAlignment,
        tcm_report_property_reaction: report.propertyReaction,
        tcm_report_interest_level: report.interestLevel,
        tcm_report_first_objection: report.firstObjection || null,
        tcm_report_price_reaction_words: report.priceReactionWords || null,
        tcm_report_decision_authority: report.decisionAuthority,
        tcm_report_comparison_reference: report.comparisonReference || null,
        tcm_report_emotional_tone: report.emotionalTone,
        tcm_report_outcome: report.outcome,
        tcm_report_next_step: report.nextStep,
        tcm_report_notes: report.notes || null,
        tcm_report_filed_at: report.filedAt,
      };

      const updated = await patchVisitById(id, {
        scheduleRemarks: report.notes || null,
        notes: buildNotes(toMetaInput(nextMeta)),
      });
      setVisit(updated);
      router.push(`/myt/tour/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit report");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="glass-card p-6 text-sm text-muted-foreground">Loading report...</div>;
  }

  if (error && !visit) {
    return <div className="glass-card p-6 text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Link href={`/myt/tour/${id}`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to tour
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>TCM Intelligence Form — {leadName}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Forced closure: you can't move on until every required field is filled. Your input is matched against the customer feedback to detect mismatches.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Arrived?</Label>
            <Pills
              value={r.arrived}
              onChange={(v) => field("arrived", v)}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "proxy", label: "Proxy visited" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>Punctuality</Label>
            <Pills
              value={r.punctuality}
              onChange={(v) => field("punctuality", v)}
              options={[
                { value: "early", label: "Early" },
                { value: "on_time", label: "On time" },
                { value: "late", label: "Late" },
                { value: "no_show", label: "No-show" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>Budget alignment</Label>
            <Pills
              value={r.budgetAlignment}
              onChange={(v) => field("budgetAlignment", v)}
              options={[
                { value: "exact", label: "Exact" },
                { value: "stretch", label: "Stretch" },
                { value: "mismatch", label: "Mismatch" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>Property reaction</Label>
            <Pills
              value={r.propertyReaction}
              onChange={(v) => field("propertyReaction", v)}
              options={[
                { value: "positive", label: "Positive" },
                { value: "neutral", label: "Neutral" },
                { value: "negative", label: "Negative" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>Interest level</Label>
            <Pills
              value={r.interestLevel}
              onChange={(v) => field("interestLevel", v)}
              options={[
                { value: "high", label: "🔥 High" },
                { value: "medium", label: "🙂 Medium" },
                { value: "low", label: "❄️ Low" },
              ]}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>First objection raised</Label>
              <select
                value={r.firstObjection ?? ""}
                onChange={(e) => field("firstObjection", e.target.value)}
                className="w-full h-10 mt-1 bg-background border border-border rounded-md px-3 text-sm"
              >
                <option value="">Select...</option>
                {OBJECTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Price reaction (exact words)</Label>
              <Input
                className="mt-1"
                value={r.priceReactionWords ?? ""}
                onChange={(e) => field("priceReactionWords", e.target.value)}
                placeholder="e.g. 'Bahut zyada hai bhai'"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Decision authority</Label>
            <Pills
              value={r.decisionAuthority}
              onChange={(v) => field("decisionAuthority", v)}
              options={[
                { value: "self", label: "Self" },
                { value: "parent", label: "Parent" },
                { value: "group", label: "Group" },
                { value: "other", label: "Other" },
              ]}
            />
          </div>

          <div>
            <Label>Comparison reference</Label>
            <Input
              className="mt-1"
              value={r.comparisonReference ?? ""}
              onChange={(e) => field("comparisonReference", e.target.value)}
              placeholder="e.g. 'They mentioned Stanza Living near campus'"
            />
          </div>

          <div className="space-y-2">
            <Label>Emotional tone</Label>
            <Pills
              value={r.emotionalTone}
              onChange={(v) => field("emotionalTone", v)}
              options={[
                { value: "excited", label: "Excited" },
                { value: "confused", label: "Confused" },
                { value: "defensive", label: "Defensive" },
                { value: "neutral", label: "Neutral" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>Outcome (funnel position)</Label>
            <Pills
              value={r.outcome}
              onChange={(v) => field("outcome", v)}
              options={[
                { value: "booked", label: "Booked (token / blocked)" },
                { value: "hot", label: "Hot (24-48 hrs)" },
                { value: "warm", label: "Warm (exploring)" },
                { value: "cold", label: "Cold" },
                { value: "dropped", label: "Dropped" },
              ]}
            />
          </div>

          <div>
            <Label>Next step (mandatory)</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={r.nextStep ?? ""}
              onChange={(e) => field("nextStep", e.target.value)}
              placeholder="e.g. Follow-up call tomorrow 11am · suggest property X · drop"
            />
          </div>

          <div>
            <Label>Free notes</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={r.notes ?? ""}
              onChange={(e) => field("notes", e.target.value)}
              placeholder="Anything else worth capturing"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={submit} disabled={!canSubmit() || saving} className="w-full">
            <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "File report & unlock next task"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
