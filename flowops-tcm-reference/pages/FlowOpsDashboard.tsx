import { useAppState } from '@/lib/app-context';
import { MetricCard } from '@/components/MetricCard';
import { CalendarCheck, Phone, TrendingUp, FileText } from 'lucide-react';

export default function FlowOpsDashboard() {
  const { tours } = useAppState();
  const myTours = tours.filter(t => t.scheduledBy === 'm1');
  const completed = myTours.filter(t => t.status === 'completed').length;
  const showUps = myTours.filter(t => t.showUp === true).length;
  const drafts = myTours.filter(t => t.outcome === 'draft').length;
  const pending = myTours.filter(t => t.status === 'scheduled').length;

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Flow Ops Dashboard</h1>
        <p className="text-xs text-muted-foreground">Your scheduling performance</p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <MetricCard label="My Tours" value={myTours.length} color="blue" icon={<CalendarCheck className="h-4 w-4" />} />
        <MetricCard label="Pending" value={pending} color="amber" icon={<Phone className="h-4 w-4" />} />
        <MetricCard label="Show-Ups" value={showUps} color="green" icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard label="Drafts" value={drafts} color="amber" icon={<FileText className="h-4 w-4" />} />
      </div>

      <div className="glass-card p-3 md:p-5">
        <h3 className="font-heading font-semibold text-xs md:text-sm mb-3 text-foreground">Tours I Scheduled</h3>
        <div className="space-y-2">
          {myTours.map(t => (
            <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-3 py-2.5 rounded-lg bg-surface-2/50">
              <div className="min-w-0">
                <span className="font-medium text-foreground text-sm">{t.leadName}</span>
                <span className="text-muted-foreground text-xs ml-2">{t.propertyName}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{t.tourTime}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${t.status === 'completed' ? 'bg-success/15 text-success' : t.status === 'confirmed' ? 'bg-tcm/15 text-role-tcm' : 'bg-primary/15 text-primary'}`}>
                  {t.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
