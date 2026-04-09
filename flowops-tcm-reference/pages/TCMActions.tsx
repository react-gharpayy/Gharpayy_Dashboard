import { useAppState } from '@/lib/app-context';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TCMActions() {
  const { tours, setTours } = useAppState();
  const myTours = tours.filter(t => t.assignedTo === 'm5' || t.assignedTo === 'm6');

  const toConfirm = myTours.filter(t => t.status === 'scheduled');
  const missed = myTours.filter(t => t.status === 'no-show');
  const needsOutcome = myTours.filter(t => t.status === 'completed' && !t.outcome);
  const draftPush = myTours.filter(t => t.outcome === 'draft');

  const updateTour = (id: string, updates: Partial<typeof tours[0]>) => {
    setTours(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up">
      <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Action Queue</h1>

      <Section title="📞 Confirm Attendance" count={toConfirm.length} color="text-primary">
        {toConfirm.map(t => (
          <ActionCard key={t.id} tour={t}>
            <Button size="sm" onClick={() => updateTour(t.id, { status: 'confirmed' })} className="h-8 text-xs">Confirm</Button>
          </ActionCard>
        ))}
      </Section>

      <Section title="❌ Missed — Follow Up" count={missed.length} color="text-danger">
        {missed.map(t => (
          <ActionCard key={t.id} tour={t}>
            <button className="p-2 rounded-md bg-danger/10 text-danger"><Phone className="h-3.5 w-3.5" /></button>
          </ActionCard>
        ))}
      </Section>

      <Section title="📝 Update Outcome" count={needsOutcome.length} color="text-role-hr">
        {needsOutcome.map(t => (
          <ActionCard key={t.id} tour={t}>
            <div className="flex gap-1 flex-wrap">
              <Button size="sm" variant="ghost" onClick={() => updateTour(t.id, { outcome: 'draft' })} className="h-7 text-[10px] px-2">Draft</Button>
              <Button size="sm" variant="ghost" onClick={() => updateTour(t.id, { outcome: 'follow-up' })} className="h-7 text-[10px] px-2">Follow-up</Button>
              <Button size="sm" variant="ghost" onClick={() => updateTour(t.id, { outcome: 'rejected' })} className="h-7 text-[10px] px-2">Reject</Button>
            </div>
          </ActionCard>
        ))}
      </Section>

      <Section title="📄 Push Draft Agreement" count={draftPush.length} color="text-role-hr">
        {draftPush.map(t => (
          <ActionCard key={t.id} tour={t}>
            <Button size="sm" variant="outline" className="h-8 text-xs">Send</Button>
          </ActionCard>
        ))}
      </Section>

      {toConfirm.length === 0 && missed.length === 0 && needsOutcome.length === 0 && draftPush.length === 0 && (
        <div className="glass-card p-8 text-center text-muted-foreground">All caught up! 🎉</div>
      )}
    </div>
  );
}

function Section({ title, count, color, children }: { title: string; count: number; color: string; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="glass-card p-3 md:p-5">
      <div className="flex items-center gap-2 mb-2">
        <h3 className={`font-heading font-semibold text-xs md:text-sm ${color}`}>{title}</h3>
        <span className="text-[10px] text-muted-foreground">({count})</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ActionCard({ tour, children }: { tour: any; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-surface-2/50">
      <div className="min-w-0">
        <span className="font-medium text-foreground text-sm">{tour.leadName}</span>
        <span className="text-muted-foreground text-xs ml-2">{tour.propertyName} · {tour.tourTime}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
