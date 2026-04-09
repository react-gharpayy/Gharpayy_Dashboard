import type { TourOutcome, TourStatus } from '@/features/tours/types';
import { cn } from '@/lib/utils';

const statusClass: Record<TourStatus, string> = {
  scheduled: 'bg-info/15 text-info',
  confirmed: 'bg-success/15 text-success',
  completed: 'bg-success/20 text-success',
  'no-show': 'bg-destructive/15 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

const outcomeClass: Record<Exclude<TourOutcome, null>, string> = {
  draft: 'bg-warning/15 text-warning',
  'follow-up': 'bg-info/15 text-info',
  rejected: 'bg-destructive/15 text-destructive',
};

export function ToursStatusBadge({ status }: { status: TourStatus }) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] md:text-xs font-medium capitalize', statusClass[status])}>
      {status.replace('-', ' ')}
    </span>
  );
}

export function ToursOutcomeBadge({ outcome }: { outcome: TourOutcome }) {
  if (!outcome) return <span className="text-[10px] md:text-xs text-muted-foreground">-</span>;
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] md:text-xs font-medium capitalize', outcomeClass[outcome])}>
      {outcome.replace('-', ' ')}
    </span>
  );
}
