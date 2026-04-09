import { cn } from '@/lib/utils';

type ToursMetricCardProps = {
  label: string;
  value: string | number;
  subtext?: string;
  tone?: 'blue' | 'green' | 'amber' | 'red';
  icon?: React.ReactNode;
};

const toneClass: Record<NonNullable<ToursMetricCardProps['tone']>, string> = {
  blue: 'text-info',
  green: 'text-success',
  amber: 'text-warning',
  red: 'text-destructive',
};

export function ToursMetricCard({ label, value, subtext, tone = 'blue', icon }: ToursMetricCardProps) {
  return (
    <div className="kpi-card p-3 md:p-4">
      <div className="mb-1 md:mb-2 flex items-center justify-between">
        <span className="text-[10px] md:text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {icon && <span className={cn('hidden sm:block opacity-70', toneClass[tone])}>{icon}</span>}
      </div>
      <div className={cn('text-xl md:text-2xl font-semibold', toneClass[tone])}>{value}</div>
      {subtext ? <p className="mt-1 text-[10px] md:text-xs text-muted-foreground">{subtext}</p> : null}
    </div>
  );
}
