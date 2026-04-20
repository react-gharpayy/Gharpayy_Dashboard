"use client";

import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { fetchTours, type TourRecord } from "@/features/tour-module/lib/tours-api";

function getTodayIstYmd() {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalizeYmd(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const dmy = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}

export default function ToursLivePage() {
  const [rows, setRows] = useState<TourRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const fetchRows = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchTours();
      setRows(data || []);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch tours");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const today = getTodayIstYmd();
  const todaysTours = useMemo(
    () => rows.filter((r) => normalizeYmd(r.date) === today),
    [rows, today]
  );

  const latestDateMeta = useMemo(() => {
    const dated = rows
      .map((r) => ({ row: r, ymd: normalizeYmd(r.date) }))
      .filter((x): x is { row: TourRecord; ymd: string } => !!x.ymd);

    if (!dated.length) return { latestDate: null as string | null, rows: [] as TourRecord[] };

    const latestDate = dated.reduce((max, cur) => (cur.ymd > max ? cur.ymd : max), dated[0].ymd);
    return {
      latestDate,
      rows: dated.filter((x) => x.ymd === latestDate).map((x) => x.row),
    };
  }, [rows]);

  const tcmToursToShow = todaysTours.length ? todaysTours : latestDateMeta.rows;

  return (
    <AppLayout
      title="Tours Live"
      subtitle="Live shared MongoDB tour feed (HR + Flow Ops + TCM)"
      actions={
        <Button size="sm" variant="outline" onClick={fetchRows} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin mr-1" : "mr-1"} />
          Refresh
        </Button>
      }
      showQuickAddLead={false}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="secondary">Total: {rows.length}</Badge>
          <Badge variant="secondary">Today (IST): {todaysTours.length}</Badge>
          {todaysTours.length === 0 && latestDateMeta.latestDate && (
            <Badge variant="secondary">Showing latest date: {latestDateMeta.latestDate}</Badge>
          )}
          {error && <Badge variant="destructive">Error: {error}</Badge>}
        </div>
        {!loading && !error && rows.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No synced rows yet. Create or update a tour in the tour system, then click Refresh.
          </p>
        )}

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Tours (HR)</TabsTrigger>
            <TabsTrigger value="schedule">Schedule Data (Flow Ops)</TabsTrigger>
            <TabsTrigger value="tcm">Today's Tours (TCM)</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <div className="kpi-card p-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-3 py-2 text-left">Lead</th>
                    <th className="px-3 py-2 text-left">Property</th>
                    <th className="px-3 py-2 text-left">Area</th>
                    <th className="px-3 py-2 text-left">TCM</th>
                    <th className="px-3 py-2 text-left">Source</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Show</th>
                    <th className="px-3 py-2 text-left">Outcome</th>
                    <th className="px-3 py-2 text-left">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/60">
                      <td className="px-3 py-2">{r.time || "-"}</td>
                      <td className="px-3 py-2">{r.name || "-"}</td>
                      <td className="px-3 py-2">{r.property || "-"}</td>
                      <td className="px-3 py-2">{r.area || "-"}</td>
                      <td className="px-3 py-2">{r.tcm_name || "-"}</td>
                      <td className="px-3 py-2">{r.source || "-"}</td>
                      <td className="px-3 py-2">{r.status || "-"}</td>
                      <td className="px-3 py-2">{r.show_up === null ? "-" : r.show_up ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">{r.outcome || "-"}</td>
                      <td className="px-3 py-2">{r.remarks || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="schedule">
            <div className="kpi-card p-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Phone</th>
                    <th className="px-3 py-2 text-left">Source</th>
                    <th className="px-3 py-2 text-left">Move-In</th>
                    <th className="px-3 py-2 text-left">Budget</th>
                    <th className="px-3 py-2 text-left">Work/College</th>
                    <th className="px-3 py-2 text-left">Work Location</th>
                    <th className="px-3 py-2 text-left">Decision Maker</th>
                    <th className="px-3 py-2 text-left">Ready 48h</th>
                    <th className="px-3 py-2 text-left">Exploring</th>
                    <th className="px-3 py-2 text-left">Comparing</th>
                    <th className="px-3 py-2 text-left">Needs Family</th>
                    <th className="px-3 py-2 text-left">Concern</th>
                    <th className="px-3 py-2 text-left">Tour Type</th>
                    <th className="px-3 py-2 text-left">Zone</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Slot</th>
                    <th className="px-3 py-2 text-left">Assigned TCM</th>
                    <th className="px-3 py-2 text-left">Live Score</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/60">
                      <td className="px-3 py-2">{r.name || "-"}</td>
                      <td className="px-3 py-2">{r.phone || "-"}</td>
                      <td className="px-3 py-2">{r.source || "-"}</td>
                      <td className="px-3 py-2">{r.move_in_date || "-"}</td>
                      <td className="px-3 py-2">{r.budget ? `Rs${Number(r.budget).toLocaleString()}` : "-"}</td>
                      <td className="px-3 py-2">{r.work_college || "-"}</td>
                      <td className="px-3 py-2">{r.work_location || "-"}</td>
                      <td className="px-3 py-2">{r.decision_maker || "-"}</td>
                      <td className="px-3 py-2">{r.ready_48h ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">{r.exploring ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">{r.comparing ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">{r.needs_family ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">{r.key_concern || "-"}</td>
                      <td className="px-3 py-2">{r.tour_type || "-"}</td>
                      <td className="px-3 py-2">{r.zone || "-"}</td>
                      <td className="px-3 py-2">{r.date || "-"}</td>
                      <td className="px-3 py-2">{r.slot || r.time || "-"}</td>
                      <td className="px-3 py-2">{r.tcm_name || "-"}</td>
                      <td className="px-3 py-2">{r.live_score ?? r.score ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="tcm">
            <div className="kpi-card p-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Lead</th>
                    <th className="px-3 py-2 text-left">Phone</th>
                    <th className="px-3 py-2 text-left">Intent</th>
                    <th className="px-3 py-2 text-left">Score</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Tour Type</th>
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-3 py-2 text-left">Property</th>
                    <th className="px-3 py-2 text-left">Area</th>
                    <th className="px-3 py-2 text-left">Budget</th>
                    <th className="px-3 py-2 text-left">Outcome</th>
                    <th className="px-3 py-2 text-left">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {tcmToursToShow.map((r) => (
                    <tr key={r.id} className="border-t border-border/60">
                      <td className="px-3 py-2">{r.name || "-"}</td>
                      <td className="px-3 py-2">{r.phone || "-"}</td>
                      <td className="px-3 py-2 uppercase">{r.intent || "-"}</td>
                      <td className="px-3 py-2">{r.score ?? "-"}</td>
                      <td className="px-3 py-2">{r.status || "-"}</td>
                      <td className="px-3 py-2">{r.tour_type || "-"}</td>
                      <td className="px-3 py-2">{r.time || "-"}</td>
                      <td className="px-3 py-2">{r.property || "-"}</td>
                      <td className="px-3 py-2">{r.area || "-"}</td>
                      <td className="px-3 py-2">{r.budget ? `Rs${Number(r.budget).toLocaleString()}` : "-"}</td>
                      <td className="px-3 py-2">{r.outcome || "-"}</td>
                      <td className="px-3 py-2">{r.remarks || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
