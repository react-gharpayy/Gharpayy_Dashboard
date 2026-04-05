"use client";

import AppLayout from '@/components/AppLayout';
import KpiCard from '@/components/KpiCard';
import OnboardingCard from '@/components/OnboardingCard';
import { PIPELINE_STAGES, SOURCE_LABELS } from '@/types/crm';
import { useDashboardStats, useLeads, useAgentStats, usePipelineStages } from '@/hooks/useCrmData';
import { useAllReminders, useCompleteFollowUp } from '@/hooks/useLeadDetails';
import { useBookingStats } from '@/hooks/useBookings';
import { Users, Clock, CalendarCheck, CheckCircle, TrendingUp, AlertTriangle, Timer, Star, IndianRupee } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { format, isPast } from 'date-fns';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

const PIE_COLORS = [
  'hsl(var(--accent))', 'hsl(var(--info))', 'hsl(var(--destructive))',
  'hsl(262, 55%, 55%)', 'hsl(var(--warning))', 'hsl(var(--success))',
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const Dashboard = () => {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: leads, isLoading: leadsLoading } = useLeads();
  const { data: agentStats } = useAgentStats();
  const { data: bookingStats } = useBookingStats();
  const { data: reminders } = useAllReminders();
  const completeFollowUp = useCompleteFollowUp();
  const qc = useQueryClient();
  const { data: pipelineStagesData } = usePipelineStages();
  const pipelineStages = (pipelineStagesData && pipelineStagesData.length > 0)
    ? pipelineStagesData
    : PIPELINE_STAGES.map((s, i) => ({ ...s, order: i }));
  const leadsToday = stats?.leadsToday ?? stats?.newToday ?? 0;
  const toursToday = stats?.toursScheduledToday ?? stats?.visitsScheduled ?? 0;
  const LEADS_TARGET = 40;
  const TOURS_TARGET = 10;

  // Realtime subscription removed - will be replaced with polling or typical SWR later
  useEffect(() => {
    // MongoDB doesn't have native realtime like Supabase (without Change Streams + Websockets).
    // For now, we will rely on manual invalidation or react-query polling.
  }, [qc]);

  const pipelineData = pipelineStages.map((stage: any) => ({
    name: stage.label.split(' ')[0],
    count: leads?.filter(l => l.status === stage.key).length || 0,
  }));

  const sourceData = leads
    ? Object.entries(
        leads.reduce((acc, l) => {
          acc[l.source] = (acc[l.source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([key, value]) => ({ name: SOURCE_LABELS[key as keyof typeof SOURCE_LABELS] || key, value }))
    : [];

  const newLeads = leads?.filter(l => l.status === 'new') || [];
  const hotLeads = leads?.filter(l => ((l as any).lead_score ?? 0) >= 70).slice(0, 5) || [];
  const overdueReminders = reminders?.filter(r => isPast(new Date(r.reminder_date))) || [];
  const perEmployee = (stats as any)?.perEmployee || [];
  const sortedPerEmployee = [...perEmployee].sort((a: any, b: any) => (b.leadsToday - a.leadsToday) || (b.toursToday - a.toursToday));

  const getISTDayProgress = () => {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
    return Math.min(1, Math.max(0.05, minutes / (24 * 60)));
  };

  const calcOnPace = (value: number) => {
    const progress = getISTDayProgress();
    if (!progress) return value;
    return Math.round(value / progress);
  };

  const DailyTargetCard = ({
    title,
    value,
    target,
    accent,
    footerLeft,
    footerRight,
    helperText,
  }: {
    title: string;
    value: number;
    target: number;
    accent: string;
    footerLeft: string;
    footerRight: string;
    helperText?: string;
  }) => {
    const remaining = Math.max(0, target - value);
    const progress = Math.min(100, Math.round((value / Math.max(target, 1)) * 100));
    const onPace = calcOnPace(value);
    const dots = 12;
    const filledDots = Math.round((progress / 100) * dots);

    return (
      <div className="kpi-card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <span className="text-[10px] text-muted-foreground">Target {target}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-display font-bold text-foreground">{value}</div>
          <div className="text-xs text-muted-foreground">/ {target}</div>
        </div>
        <p className="text-2xs text-muted-foreground mt-2">
          {value} done · {remaining} to go
        </p>
        <div className="mt-3 h-1.5 rounded-full bg-secondary/70 overflow-hidden">
          <div className="h-full" style={{ width: `${progress}%`, background: accent }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{progress}% of daily target</span>
          <span>On pace for {onPace} by EOD</span>
        </div>
        <div className="mt-3 grid grid-cols-12 gap-1">
          {Array.from({ length: dots }).map((_, i) => (
            <div
              key={i}
              className="h-2 rounded-sm"
              style={{ background: i < filledDots ? accent : 'hsl(var(--secondary))' }}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{footerLeft}</span>
          <span>{footerRight}</span>
        </div>
        {helperText && (
          <div className="mt-4">
            <p className="text-2xs text-muted-foreground">{helperText}</p>
          </div>
        )}
      </div>
    );
  };

  const handleComplete = async (id: string) => {
    try {
      await completeFollowUp.mutateAsync(id);
      toast.success('Follow-up marked as done');
    } catch (err: any) { toast.error(err.message); }
  };

  if (statsLoading || leadsLoading) {
    return (
      <AppLayout title="Dashboard" subtitle="Real-time overview of your sales pipeline">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-[130px] rounded-2xl" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard" subtitle="Real-time overview of your sales pipeline">
      {/* Onboarding */}
      <OnboardingCard />

      {/* Overdue alert */}
      {overdueReminders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-destructive/5 border border-destructive/15 rounded-2xl flex items-center gap-3 flex-wrap"
        >
          <AlertTriangle size={15} className="text-destructive shrink-0" />
          <span className="text-2xs font-medium text-destructive">{overdueReminders.length} overdue follow-up{overdueReminders.length > 1 ? 's' : ''} need attention</span>
        </motion.div>
      )}

      {/* KPIs */}
      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" variants={container} initial="hidden" animate="show">
        <KpiCard title="Total Leads" value={stats?.totalLeads ?? 0} icon={<Users size={17} />} />
        <KpiCard title="Avg Response Time" value={stats?.avgResponseTime ?? 0} suffix="min" icon={<Clock size={17} />} color="hsl(var(--warning))" />
        <DailyTargetCard
          title="Leads Added Today"
          value={leadsToday}
          target={LEADS_TARGET}
          accent="hsl(var(--accent))"
          footerLeft={`${leadsToday} leads added`}
          footerRight={`${Math.max(0, LEADS_TARGET - leadsToday)} more to go`}
          helperText={`At the current pace, you’re tracking to finish with ${calcOnPace(leadsToday)}. Pick up speed after lunch.`}
        />
        <DailyTargetCard
          title="Tours Scheduled Today"
          value={toursToday}
          target={TOURS_TARGET}
          accent="hsl(173, 55%, 42%)"
          footerLeft={`${toursToday} tours scheduled`}
          footerRight={`${Math.max(0, TOURS_TARGET - toursToday)} more needed`}
          helperText="Next check-in window opens at afternoon. Update your progress then."
        />
      </motion.div>
      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" variants={container} initial="hidden" animate="show">
        <KpiCard title="Conversion Rate" value={stats?.conversionRate ?? 0} suffix="%" icon={<TrendingUp size={17} />} color="hsl(262, 55%, 55%)" />
        <KpiCard title="SLA Compliance" value={stats?.slaCompliance ?? 0} suffix="%" icon={<Timer size={17} />} color="hsl(var(--info))" />
        <KpiCard title="SLA Breaches" value={stats?.slaBreaches ?? 0} icon={<AlertTriangle size={17} />} color="hsl(0, 55%, 50%)" />
        <KpiCard title="Bookings Closed" value={stats?.bookingsClosed ?? 0} icon={<CheckCircle size={17} />} color="hsl(var(--success))" />
      </motion.div>

      {/* Daily team numbers */}
      <div className="kpi-card mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-semibold text-xs text-foreground">Today - Per Employee</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Leads added and tours scheduled today</p>
          </div>
          <div className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {sortedPerEmployee.length} members
          </div>
        </div>
        {sortedPerEmployee.length === 0 ? (
          <p className="text-2xs text-muted-foreground text-center py-6">No activity recorded today.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {sortedPerEmployee.map((row: any) => (
              <div key={row.memberId} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                <div>
                  <p className="text-xs font-medium text-foreground">{row.name}</p>
                  <p className="text-[10px] text-muted-foreground">{row.zoneName || 'No Zone'}</p>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">
                    Leads {row.leadsToday}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-info/10 text-info font-semibold">
                    Tours {row.toursToday}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revenue Forecast */}
      {bookingStats && (bookingStats.revenue > 0 || bookingStats.pendingRevenue > 0) && (
        <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <KpiCard title="Confirmed Revenue" value={`₹${(bookingStats.revenue / 1000).toFixed(0)}k`} icon={<IndianRupee size={17} />} color="hsl(var(--success))" />
          <KpiCard title="Pipeline Revenue" value={`₹${(bookingStats.pendingRevenue / 1000).toFixed(0)}k`} icon={<TrendingUp size={17} />} color="hsl(var(--warning))" />
          <KpiCard title="Projected Revenue" value={`₹${((bookingStats.revenue + bookingStats.pendingRevenue * 0.6) / 1000).toFixed(0)}k`} icon={<IndianRupee size={17} />} color="hsl(var(--accent))" />
          <KpiCard title="Active Bookings" value={bookingStats.confirmed + bookingStats.checkedIn} icon={<CheckCircle size={17} />} color="hsl(var(--info))" />
        </motion.div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="lg:col-span-2 kpi-card">
          <h3 className="font-display font-semibold text-xs text-foreground mb-5">Pipeline Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pipelineData}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: '11px', background: 'hsl(var(--card))' }} />
              <Bar dataKey="count" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="kpi-card">
          <h3 className="font-display font-semibold text-xs text-foreground mb-5">Lead Sources</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={sourceData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value" strokeWidth={0}>
                {sourceData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: '11px', background: 'hsl(var(--card))' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2.5 mt-3">
            {sourceData.map((s, i) => (
              <div key={s.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {s.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Needs Attention */}
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-xs text-foreground">Needs Attention</h3>
            <span className="text-2xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{newLeads.length}</span>
          </div>
          <div className="space-y-2">
            {newLeads.slice(0, 5).map(lead => (
              <div key={lead.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                <div>
                  <p className="text-xs font-medium text-foreground">{lead.name}</p>
                  <p className="text-[10px] text-muted-foreground">{lead.preferredLocation} · {lead.budget}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">{lead.members?.name}</p>
                  <p className="text-[10px] text-destructive font-medium">Awaiting</p>
                </div>
              </div>
            ))}
            {newLeads.length === 0 && <p className="text-2xs text-muted-foreground text-center py-6">All leads responded ✓</p>}
          </div>
        </div>

        {/* Hot Leads */}
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-xs text-foreground">Hot Leads</h3>
            <span className="text-2xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">Score ≥70</span>
          </div>
          <div className="space-y-2">
            {hotLeads.map(lead => (
              <div key={lead.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                <div>
                  <p className="text-xs font-medium text-foreground">{lead.name}</p>
                  <p className="text-[10px] text-muted-foreground">{lead.preferredLocation}</p>
                </div>
                <span className="flex items-center gap-1 text-2xs font-bold text-success">
                  <Star size={10} /> {(lead as any).lead_score}
                </span>
              </div>
            ))}
            {hotLeads.length === 0 && <p className="text-2xs text-muted-foreground text-center py-6">No hot leads yet</p>}
          </div>
        </div>

        {/* Follow-ups */}
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-xs text-foreground">Follow-ups</h3>
            <span className="text-2xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{reminders?.length || 0} pending</span>
          </div>
          <div className="space-y-2">
            {(reminders || []).slice(0, 5).map(r => (
              <div key={r.id} className={`flex items-center justify-between p-3 rounded-xl ${isPast(new Date(r.reminder_date)) ? 'bg-destructive/5 border border-destructive/15' : 'bg-secondary/50'}`}>
                <div>
                  <p className="text-xs font-medium text-foreground">{(r as any).leads?.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(r.reminder_date), 'MMM d, h:mm a')}
                    {isPast(new Date(r.reminder_date)) && <span className="text-destructive ml-1 font-medium">OVERDUE</span>}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-lg" onClick={() => handleComplete(r.id)}>
                  Done
                </Button>
              </div>
            ))}
            {(reminders?.length || 0) === 0 && <p className="text-2xs text-muted-foreground text-center py-6">No pending follow-ups</p>}
          </div>
        </div>
      </div>

      {/* Member Performance */}
      <div className="kpi-card mt-6">
        <h3 className="font-display font-semibold text-xs text-foreground mb-4">Member Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {(agentStats || []).map(member => (
            <div key={member.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-secondary/50">
              <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
                <span className="text-2xs font-bold text-accent">{member.name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{member.name}</p>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{member.activeLeads} active</span>
                  <span className="text-[10px] text-muted-foreground">{member.avgResponseTime}m avg</span>
                  <span className="text-[10px] text-success">{member.conversions} booked</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-base font-display font-bold text-foreground">
                  {member.totalLeads ? Math.round((member.conversions / member.totalLeads) * 100) : 0}%
                </p>
                <p className="text-[9px] text-muted-foreground">conversion</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
