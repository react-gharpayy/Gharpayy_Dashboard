"use client";

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Crown, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreatorLeaderboard, type CreatorLeaderboardEntry, type LeaderboardPeriod, useOfficeZones } from '@/hooks/useCrmData';
import { useAuth } from '@/contexts/AuthContext';

const PERIOD_OPTIONS: { key: LeaderboardPeriod; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_30_days', label: 'Last 30 Days' },
  { key: 'today', label: 'Today' },
  { key: 'all_time', label: 'All Time' },
  { key: 'custom', label: 'Custom Dates' },
];

const roleLabel: Record<'manager' | 'admin' | 'member', string> = {
  manager: 'Manager',
  admin: 'Admin',
  member: 'Member',
};

function rankStyle(rank: number) {
  if (rank === 1) return 'from-amber-200/50 via-amber-100/30 to-transparent border-amber-300/50';
  if (rank === 2) return 'from-slate-200/60 via-slate-100/30 to-transparent border-slate-300/50';
  if (rank === 3) return 'from-orange-200/50 via-orange-100/30 to-transparent border-orange-300/50';
  return 'from-primary/10 via-primary/5 to-transparent border-border';
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-amber-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-500" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-orange-500" />;
  return <Trophy className="h-4 w-4 text-primary" />;
}

function PodiumCard({ item, index }: { item: CreatorLeaderboardEntry; index: number }) {
  const heights = ['h-28', 'h-24', 'h-20'];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 * index, duration: 0.28 }}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-b ${rankStyle(item.rank)} p-4`}
    >
      <div className="absolute right-3 top-3">
        <RankIcon rank={item.rank} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rank {item.rank}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{item.name}</p>
      <p className="text-[11px] text-muted-foreground">{roleLabel[item.role]}</p>
      <div className={`mt-4 rounded-xl bg-background/70 px-3 py-2 ${heights[index] || 'h-20'}`}>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pipeline Score</p>
        <p className="mt-1 text-2xl font-bold text-foreground">{item.score}</p>
        <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{item.leadsCreated} leads</p>
        {item.zones.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.zones.map((z) => (
              <Badge key={`${item.userId}-${z.zone}`} variant="outline" className="text-[9px] px-1.5 py-0.5">
                {z.zone}: {z.count}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function CreatorLeaderboardPanel({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriod>('this_month');
  const [zone, setZone] = useState<string>('all');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  
  const { data: zones } = useOfficeZones();
  const { data, isLoading, isError } = useCreatorLeaderboard(period, zone, { from: customFrom, to: customTo });

  const rankings = data?.rankings || [];
  const topThree = rankings.slice(0, 3);
  const topCount = rankings[0]?.score || 0;

  const currentUserEntry = useMemo(
    () => rankings.find((r) => r.userId === user?.id) || null,
    [rankings, user?.id]
  );

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex flex-col gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Lead Legends</span>
            </div>
            <h3 className="mt-2 text-lg font-semibold text-foreground">Lead Creator Leaderboard</h3>
            <p className="text-xs text-muted-foreground">Ranking by pipeline stage progression and lead volume.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger className="h-7 text-[11px] w-auto min-w-[90px] px-2 border-border bg-card text-muted-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Zones</SelectItem>
                {zones?.map((z: any) => <SelectItem key={z.id} value={z.name}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {PERIOD_OPTIONS.map((opt) => (
              <Button
                key={opt.key}
                variant={period === opt.key ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2.5 text-[11px]"
                onClick={() => setPeriod(opt.key)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-7 text-[11px] rounded-md bg-card border border-border px-2 text-muted-foreground outline-none focus:ring-1 focus:ring-primary" />
              <span className="text-[10px] text-muted-foreground">to</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-7 text-[11px] rounded-md bg-card border border-border px-2 text-muted-foreground outline-none focus:ring-1 focus:ring-primary" />
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="rounded-2xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border bg-card p-6">
          <p className="text-sm text-destructive">Could not load leaderboard right now.</p>
        </div>
      )}

      {!isLoading && !isError && rankings.length === 0 && (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <Trophy className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold text-foreground">No lead creation activity in this period.</p>
          <p className="text-xs text-muted-foreground">Start adding leads to climb the board.</p>
        </div>
      )}

      {!isLoading && !isError && rankings.length > 0 && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {topThree.map((entry, idx) => (
              <PodiumCard key={entry.userId} item={entry} index={idx} />
            ))}
          </div>

          {currentUserEntry && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border border-primary/30 bg-primary/5 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Your Rank: #{currentUserEntry.rank}</p>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-[10px]">Score: {currentUserEntry.score}</Badge>
                  <Badge variant="outline" className="text-[10px]">{currentUserEntry.leadsCreated} leads</Badge>
                </div>
              </div>
              <div className="mt-3">
                <Progress value={topCount > 0 ? Math.min(100, (currentUserEntry.score / topCount) * 100) : 0} className="h-2" />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {topCount > 0
                    ? `${Math.max(0, topCount - currentUserEntry.score)} points to match #1`
                    : 'You are setting the pace'}
                </p>
                {currentUserEntry.zones.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {currentUserEntry.zones.map((z) => (
                      <Badge key={`me-${z.zone}`} variant="outline" className="text-[10px]">
                        {z.zone}: {z.count}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          <div className="rounded-2xl border bg-card p-3 md:p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Full Ranking</p>
              <p className="text-[11px] text-muted-foreground">Updated {new Date(data?.generatedAt || Date.now()).toLocaleString()}</p>
            </div>

            <div className="space-y-2">
              {rankings.map((entry, idx) => {
                const isMe = entry.userId === user?.id;
                return (
                  <motion.div
                    key={entry.userId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(0.04 * idx, 0.24), duration: 0.24 }}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${isMe ? 'border-primary/35 bg-primary/5' : 'border-border bg-secondary/20'}`}
                  >
                    <div className="w-8 shrink-0 text-center">
                      <p className="text-sm font-bold text-foreground">#{entry.rank}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{entry.name}</p>
                        {isMe && <Badge className="text-[10px]">You</Badge>}
                        <Badge variant="outline" className="text-[10px]">{roleLabel[entry.role]}</Badge>
                      </div>
                      {entry.zones.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {entry.zones.map((z) => (
                            <Badge key={`${entry.userId}-${z.zone}`} variant="outline" className="text-[9px] px-1.5 py-0.5">
                              {z.zone}: {z.count}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{entry.score}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{entry.leadsCreated} leads</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
