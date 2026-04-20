"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { StatusBadge, OutcomeBadge } from "@/features/tour-module/components/StatusBadge";
import { fetchTours, type TourRecord } from "@/features/tour-module/lib/tours-api";

export default function AllTours() {
  const [tours, setTours] = useState<TourRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const rows = await fetchTours(controller.signal);
        setTours(rows);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Failed to load tours");
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

  const filtered = useMemo(
    () =>
      tours.filter((t) => {
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (outcomeFilter !== "all" && (t.outcome ?? "none") !== outcomeFilter) return false;
        return true;
      }),
    [tours, statusFilter, outcomeFilter]
  );

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up">
      <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">All Tours</h1>

      <div className="flex gap-2 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-surface-2 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground"
        >
          <option value="all">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="no-show">No Show</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="bg-surface-2 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground"
        >
          <option value="all">All Outcomes</option>
          <option value="booked">Booked</option>
          <option value="token-paid">Token Paid</option>
          <option value="draft">Draft</option>
          <option value="follow-up">Follow-up</option>
          <option value="rejected">Rejected</option>
          <option value="not-interested">Not Interested</option>
          <option value="none">None</option>
        </select>
      </div>

      {isLoading && (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          <span className="inline-block h-5 w-5 rounded-full border-2 border-primary border-r-transparent animate-spin mr-2 align-middle" />
          Loading tours...
        </div>
      )}

      {!isLoading && error && (
        <div className="glass-card p-4 text-sm text-destructive">Failed to load tours: {error}</div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">No tours found.</div>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <>
          <div className="md:hidden space-y-2">
            {filtered.slice(0, 30).map((t) => (
              <Link
                href={`/myt/tour/${t.id}`}
                key={t.id}
                className="block glass-card p-3 space-y-1.5 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground text-sm">{t.name || "-"}</span>
                  <span className="text-xs text-muted-foreground">{t.time || "-"}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.property || "-"} · {t.area || "-"}
                </p>
                <p className="text-[10px] text-muted-foreground">TCM: {t.tcm_name || "-"}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={(t.status as any) ?? "scheduled"} />
                  {t.show_up !== null && <span className="text-xs">{t.show_up ? "Yes" : "No"}</span>}
                  <OutcomeBadge outcome={(t.outcome as any) ?? null} />
                  <span className="text-[10px] text-muted-foreground capitalize">{t.source || "-"}</span>
                  <span className="ml-auto text-[10px] text-primary inline-flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> Open
                  </span>
                </div>
                {t.remarks && <p className="text-[10px] text-muted-foreground italic">"{t.remarks}"</p>}
              </Link>
            ))}
          </div>

          <div className="hidden md:block glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground bg-surface-2/50">
                    <th className="text-left py-3 px-4 font-medium">Time</th>
                    <th className="text-left py-3 px-2 font-medium">Lead</th>
                    <th className="text-left py-3 px-2 font-medium">Property</th>
                    <th className="text-left py-3 px-2 font-medium">Area</th>
                    <th className="text-left py-3 px-2 font-medium">TCM</th>
                    <th className="text-left py-3 px-2 font-medium">Source</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                    <th className="text-left py-3 px-2 font-medium">Show</th>
                    <th className="text-left py-3 px-2 font-medium">Outcome</th>
                    <th className="text-left py-3 px-2 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-accent/30">
                      <td className="py-2 px-4 text-muted-foreground">{t.time || "-"}</td>
                      <td className="py-2 px-2 font-medium text-foreground">
                        <Link href={`/myt/tour/${t.id}`} className="hover:text-primary inline-flex items-center gap-1">
                          {t.name || "-"} <MessageSquare className="h-3 w-3 opacity-60" />
                        </Link>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{t.property || "-"}</td>
                      <td className="py-2 px-2 text-muted-foreground">{t.area || "-"}</td>
                      <td className="py-2 px-2 text-muted-foreground">{t.tcm_name || "-"}</td>
                      <td className="py-2 px-2 text-muted-foreground capitalize">{t.source || "-"}</td>
                      <td className="py-2 px-2">
                        <StatusBadge status={(t.status as any) ?? "scheduled"} />
                      </td>
                      <td className="py-2 px-2">{t.show_up === true ? "Yes" : t.show_up === false ? "No" : "-"}</td>
                      <td className="py-2 px-2">
                        <OutcomeBadge outcome={(t.outcome as any) ?? null} />
                      </td>
                      <td className="py-2 px-2 text-muted-foreground text-xs max-w-[120px] truncate">{t.remarks || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
