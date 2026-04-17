"use client";

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Gauge, Loader2, Sparkles, TrendingUp, Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLeadsDailyProgress } from '@/hooks/useCrmData';

function getTodayIstDate() {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(Date.now() + istOffsetMs).toISOString().slice(0, 10);
}

function ProgressLine({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const done = value >= max;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs font-semibold ${done ? 'text-emerald-600' : 'text-foreground'}`}>
          {value}/{max}{done ? ' ✓' : ''}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  max,
  accent,
}: {
  label: string;
  value: number;
  max: number;
  accent: 'violet' | 'emerald';
}) {
  const done = value >= max;
  const isViolet = accent === 'violet';

  return (
    <div className={`rounded-xl border p-3 ${done ? 'border-emerald-500/30 bg-emerald-500/5' : 'bg-card'}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-xl font-bold text-foreground">{value}<span className="text-sm text-muted-foreground">/{max}</span></p>
        {done && <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">Done</Badge>}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${done ? 'bg-emerald-500' : isViolet ? 'bg-violet-500' : 'bg-primary'}`}
          style={{ width: `${Math.min(100, max > 0 ? (value / max) * 100 : 0)}%` }}
        />
      </div>
    </div>
  );
}

type LeadsProgressPanelButtonProps = {
  showTrigger?: boolean;
  autoOpenMode?: 'manual' | 'always' | 'first-or-reload';
};

export default function LeadsProgressPanelButton({
  showTrigger = true,
  autoOpenMode = 'manual',
}: LeadsProgressPanelButtonProps) {
  const { user } = useAuth();
  const allowedRoles = ['super_admin', 'manager', 'admin', 'member'];
  const role = String(user?.role || '');
  const hasAccess = allowedRoles.includes(role);

  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayIstDate());

  useEffect(() => {
    if (role !== 'member') return;
    if (autoOpenMode === 'manual') return;
    setOpen(true);
  }, [role, autoOpenMode]);

  const { data, isLoading, isError } = useLeadsDailyProgress(selectedDate);

  const goals = data?.goals || { leadsAdded: 40, toursScheduled: 10 };
  const members = data?.members || [];
  const isMemberView = role === 'member';

  const memberRow = useMemo(() => {
    if (!isMemberView) return null;
    return members.find((member) => member.id === user?.id) || members[0] || null;
  }, [isMemberView, members, user?.id]);

  const fullyDoneCount = useMemo(
    () => members.filter((member) => member.allDone).length,
    [members]
  );

  if (!hasAccess) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <style>{`
        @keyframes progressShimmerSweep {
          0% { transform: translateX(-160%) skewX(-18deg); }
          100% { transform: translateX(260%) skewX(-18deg); }
        }
      `}</style>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="relative h-7 rounded-xl px-2 text-[11px] border border-orange-500/45 bg-background hover:bg-background overflow-hidden"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-xl bg-orange-500/[0.05]"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-[45%] w-[38%]"
              style={{
                background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(251,146,60,0.88) 50%, rgba(255,255,255,0) 100%)',
                animation: 'progressShimmerSweep 1.9s linear infinite',
                willChange: 'transform',
              }}
            />
            <span className="relative z-10 inline-flex items-center gap-1.5 text-foreground">
              <Gauge size={13} />
              <span className="hidden sm:inline">Progress</span>
            </span>
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-[820px] p-0 overflow-hidden border-primary/20">
        <DialogHeader className="px-5 pt-5 pb-4 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-background">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 mb-2">
                <Sparkles size={12} className="text-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Performance</span>
              </div>
              <DialogTitle className="text-base font-semibold">Daily Progress</DialogTitle>
              <DialogDescription className="text-xs">
                Leads added and tours scheduled for the selected date.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 rounded-xl border bg-background/90 px-2.5 py-1.5">
              <CalendarDays size={14} className="text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="h-7 text-xs w-[150px] border-none bg-transparent shadow-none focus-visible:ring-0"
                aria-label="Select progress date"
              />
            </div>
          </div>
        </DialogHeader>

        <div className="px-5 py-4 max-h-[70vh] overflow-auto bg-gradient-to-b from-background to-secondary/10">
          {isLoading && (
            <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              Loading progress...
            </div>
          )}

          {isError && (
            <div className="py-8 text-center text-sm text-destructive">
              Could not load progress for this date.
            </div>
          )}

          {!isLoading && !isError && isMemberView && memberRow && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/15 bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/70">
                  <div>
                    <p className="text-sm font-semibold">{memberRow.name}</p>
                    <p className="text-[10px] text-muted-foreground">Selected Date: {selectedDate}</p>
                  </div>
                  {memberRow.allDone && (
                    <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
                      <CheckCircle2 size={11} className="mr-1" /> Complete
                    </Badge>
                  )}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <MetricTile label="Leads Added" value={memberRow.leadsAdded} max={goals.leadsAdded} accent="violet" />
                  <MetricTile label="Tours Scheduled" value={memberRow.toursScheduled} max={goals.toursScheduled} accent="emerald" />
                </div>
                <div className="mt-3 rounded-xl border border-dashed border-border/80 bg-secondary/20 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">
                    Daily target: <span className="font-medium text-foreground">{goals.leadsAdded}</span> leads and <span className="font-medium text-foreground">{goals.toursScheduled}</span> tours.
                  </p>
                </div>
              </div>

              <div className={`rounded-xl border p-3 ${memberRow.allDone ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-secondary/20'}`}>
                <p className={`text-xs ${memberRow.allDone ? 'text-emerald-700 dark:text-emerald-300 font-medium' : 'text-muted-foreground'}`}>
                  {memberRow.allDone
                    ? 'Great work! You completed both goals for this day.'
                    : 'Keep going. You are making progress.'}
                </p>
              </div>
            </div>
          )}

          {!isLoading && !isError && !isMemberView && (
            <div className="space-y-3">
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded-xl border bg-card p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Members</p>
                  <p className="text-lg font-bold mt-1 flex items-center gap-1"><Users size={14} /> {members.length}</p>
                </div>
                <div className="rounded-xl border bg-emerald-500/5 border-emerald-500/20 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fully Complete</p>
                  <p className="text-lg font-bold mt-1 flex items-center gap-1 text-emerald-700 dark:text-emerald-300"><Trophy size={14} /> {fullyDoneCount}</p>
                </div>
                <div className="rounded-xl border bg-card p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Goals</p>
                  <p className="text-xs mt-1 font-medium text-foreground">{goals.leadsAdded} leads · {goals.toursScheduled} tours</p>
                </div>
              </div>

              {members.length === 0 && (
                <div className="rounded-xl border p-4 text-sm text-muted-foreground">
                  No member progress data found for this date.
                </div>
              )}

              {members.length > 0 && (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.id} className={`rounded-xl border p-3 transition-colors ${member.allDone ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-card hover:bg-secondary/30'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${member.allDone ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-primary/10 text-primary'}`}>
                            {String(member.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{member.name}</p>
                          {member.zones.length > 0 && (
                            <p className="text-[10px] text-muted-foreground truncate">{member.zones.join(', ')}</p>
                          )}
                          </div>
                        </div>
                        {member.allDone && (
                          <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">Done</Badge>
                        )}
                      </div>

                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="rounded-lg bg-secondary/20 p-2.5">
                          <ProgressLine label="Leads Added" value={member.leadsAdded} max={goals.leadsAdded} />
                        </div>
                        <div className="rounded-lg bg-secondary/20 p-2.5">
                          <ProgressLine label="Tours Scheduled" value={member.toursScheduled} max={goals.toursScheduled} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-2.5 border-t bg-card/70">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <TrendingUp size={12} /> Values are based on selected date activity.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
