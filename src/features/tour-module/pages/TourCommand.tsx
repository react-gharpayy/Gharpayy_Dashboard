"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarClock, MapPin, Phone, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { fetchTourById, type TourRecord, updateTourById } from "@/features/tour-module/lib/tours-api";

export default function TourCommand() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [tour, setTour] = useState<TourRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("scheduled");
  const [editOutcome, setEditOutcome] = useState("none");
  const [editShowUp, setEditShowUp] = useState("none");
  const [editRemarks, setEditRemarks] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

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
        const row = await fetchTourById(id, controller.signal);
        setTour(row);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Failed to fetch tour");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    run();
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!tour) return;
    setEditStatus(tour.status || "scheduled");
    setEditOutcome(tour.outcome || "none");
    setEditShowUp(tour.show_up === true ? "yes" : tour.show_up === false ? "no" : "none");
    setEditRemarks(tour.remarks || "");
  }, [tour]);

  const savePostTourUpdate = async () => {
    if (!tour) return;
    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(null);
      const updated = await updateTourById(tour.id, {
        status: editStatus,
        outcome: editOutcome === "none" ? null : editOutcome,
        show_up: editShowUp === "none" ? null : editShowUp === "yes",
        remarks: editRemarks.trim(),
      });
      setTour(updated);
      setSaveSuccess("Post-tour update saved.");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save post-tour update");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card p-8 text-center text-sm text-muted-foreground">
        <span className="inline-block h-5 w-5 rounded-full border-2 border-primary border-r-transparent animate-spin mr-2 align-middle" />
        Loading tour...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/myt/tours" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to tours
        </Link>
        <div className="glass-card p-4 text-sm text-destructive">{error}</div>
      </div>
    );
  }

  if (!tour) {
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
    <div className="space-y-4 max-w-5xl mx-auto">
      <Link href="/myt/tours" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to tours
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="text-xl">{tour.name || "-"}</CardTitle>
              <div className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {tour.phone || "-"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {tour.tcm_name || "-"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {tour.area || "-"} · {tour.property || "-"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {tour.date || "-"} {tour.time || "-"}
                </span>
                <span>Rs {tour.budget?.toLocaleString("en-IN") || "-"}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={tour.status === "completed" ? "default" : "secondary"} className="capitalize">
                {tour.status || "scheduled"}
              </Badge>
              <div className="text-xs text-muted-foreground">Score</div>
              <div className="text-2xl font-bold tabular-nums">{tour.live_score ?? tour.score ?? 0}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Source:</span> {tour.source || "-"}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Tour Type:</span> {tour.tour_type || "-"}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Intent:</span> {tour.intent || "-"}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Outcome:</span> {tour.outcome || "-"}
            </p>
            <p className="text-muted-foreground md:col-span-2">
              <span className="font-medium text-foreground">Remarks:</span> {tour.remarks || "-"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Post-tour update</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="mt-1 w-full h-10 bg-surface-2 border border-border rounded-md px-3 text-sm text-foreground"
              >
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="no-show">No-show</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Outcome</label>
              <select
                value={editOutcome}
                onChange={(e) => setEditOutcome(e.target.value)}
                className="mt-1 w-full h-10 bg-surface-2 border border-border rounded-md px-3 text-sm text-foreground"
              >
                <option value="none">None</option>
                <option value="booked">Booked</option>
                <option value="token-paid">Token Paid</option>
                <option value="draft">Draft</option>
                <option value="follow-up">Follow-up</option>
                <option value="rejected">Rejected</option>
                <option value="not-interested">Not Interested</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Show-up</label>
              <select
                value={editShowUp}
                onChange={(e) => setEditShowUp(e.target.value)}
                className="mt-1 w-full h-10 bg-surface-2 border border-border rounded-md px-3 text-sm text-foreground"
              >
                <option value="none">Not set</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Remarks</label>
            <Textarea
              value={editRemarks}
              onChange={(e) => setEditRemarks(e.target.value)}
              rows={4}
              className="mt-1"
              placeholder="Add post-tour remarks..."
            />
          </div>
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          {saveSuccess && <p className="text-sm text-green-600">{saveSuccess}</p>}
          <div className="flex justify-end">
            <Button onClick={savePostTourUpdate} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save post-tour update"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
