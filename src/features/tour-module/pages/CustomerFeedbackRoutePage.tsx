"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  buildNotes,
  fetchVisitById,
  getLeadName,
  getPropertyName,
  parseNotes,
  patchVisitById,
  toMetaInput,
  type VisitRecord,
} from "@/features/tour-module/lib/visit-page-api";

type CustomerSentiment = "loved" | "good_unsure" | "not_fit" | "need_better";

const OPTS: { v: CustomerSentiment; label: string; emoji: string }[] = [
  { v: "loved", label: "Loved it", emoji: "🔥" },
  { v: "good_unsure", label: "Good but unsure", emoji: "🙂" },
  { v: "not_fit", label: "Not a fit", emoji: "❌" },
  { v: "need_better", label: "Need better options", emoji: "🔄" },
];

export default function CustomerFeedbackRoutePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";

  const [visit, setVisit] = useState<VisitRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const meta = useMemo(() => parseNotes(visit?.notes), [visit?.notes]);
  const leadName = useMemo(() => getLeadName(visit || {}, meta), [visit, meta]);
  const propertyName = useMemo(() => getPropertyName(visit || {}, meta), [visit, meta]);

  const [sentiment, setSentiment] = useState<CustomerSentiment | undefined>();
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

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
        const parsed = parseNotes(data?.notes);
        setVisit(data);
        setSentiment((parsed.feedback_sentiment as CustomerSentiment) || undefined);
        setComment(parsed.feedback_comment || "");
        setSubmitted(Boolean(parsed.feedback_submitted_at));
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Failed to load feedback");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [id]);

  async function submit() {
    if (!sentiment || !id) return;
    setSaving(true);
    setError(null);
    try {
      const nextMeta = {
        ...meta,
        feedback_sentiment: sentiment,
        feedback_comment: comment || null,
        feedback_submitted_at: new Date().toISOString(),
      };
      const updated = await patchVisitById(id, { notes: buildNotes(toMetaInput(nextMeta)) });
      setVisit(updated);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit feedback");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="glass-card p-6 text-sm text-muted-foreground">Loading feedback...</div>;
  }

  if (error && !visit) {
    return <div className="glass-card p-6 text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link href={`/myt/tour/${id}`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to tour
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>How was your tour at {propertyName}?</CardTitle>
          <p className="text-sm text-muted-foreground">
            Hi {leadName} — your feedback helps us refine your options.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {OPTS.map((o) => (
              <button
                key={o.v}
                onClick={() => setSentiment(o.v)}
                className={cn(
                  "rounded-lg border p-3 text-left hover:border-primary transition-colors",
                  sentiment === o.v && "border-primary bg-primary/5"
                )}
              >
                <div className="text-2xl">{o.emoji}</div>
                <div className="text-sm font-medium mt-1">{o.label}</div>
              </button>
            ))}
          </div>

          <div>
            <Label htmlFor="c">Tell us more (optional)</Label>
            <Textarea
              id="c"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Liked / disliked anything? Price, rooms, location?"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={submit} disabled={!sentiment || saving} className="w-full">
            {submitted ? "Update feedback" : "Submit feedback"}
          </Button>

          {submitted && (
            <div className="text-xs text-muted-foreground border rounded p-2 bg-muted/30">
              ✅ Recorded. The team will reach out with refined options shortly.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
