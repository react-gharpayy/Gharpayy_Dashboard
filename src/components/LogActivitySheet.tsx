import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatRelativeDay, getActivityTypesForStages } from '@/lib/leadsActivityAndPriority';
import { useLogLeadActivity, type LeadWithRelations } from '@/hooks/useCrmData';

type PipelineStageOption = {
  key: string;
  label: string;
};

type AuthUser = {
  id: string;
  role: string;
  fullName?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadWithRelations | null;
  pipelineStages: PipelineStageOption[];
  authUser?: AuthUser | null;
  onSaved?: (lead: LeadWithRelations) => void;
};

function canMarkLost(lead: LeadWithRelations | null, authUser?: AuthUser | null) {
  if (!lead || !authUser) return false;
  if (['super_admin', 'manager', 'admin'].includes(authUser.role)) return true;
  return String(lead.assignedMemberId || '') === String(authUser.id) || String(lead.creator?.id || '') === String(authUser.id);
}

export default function LogActivitySheet({
  open,
  onOpenChange,
  lead,
  pipelineStages,
  authUser,
  onSaved,
}: Props) {
  const logLeadActivity = useLogLeadActivity();
  const [selectedType, setSelectedType] = useState('');
  const [note, setNote] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [newStage, setNewStage] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [error, setError] = useState('');

  const stageKeys = useMemo(() => pipelineStages.map((item) => item.key), [pipelineStages]);
  const activityTypes = useMemo(() => getActivityTypesForStages(stageKeys), [stageKeys]);

  const stageMap = useMemo(() => {
    const map = new Map<string, string>();
    pipelineStages.forEach((item) => map.set(item.key, item.label));
    return map;
  }, [pipelineStages]);

  const ownerName = lead?.members?.name || lead?.creator?.name || 'Unassigned';
  const currentStageLabel = stageMap.get(String(lead?.status || '')) || lead?.status || '-';
  const userCanMarkLost = canMarkLost(lead, authUser);
  const showLostWarning = !!lead && !!authUser && String(lead.assignedMemberId || '') !== String(authUser.id);

  useEffect(() => {
    if (!open || !lead) return;

    setSelectedType('');
    setNote('');
    setVisitDate('');
    setNextAction('');
    setNextDate('');
    setNewStage('');
    setError('');
  }, [open, lead]);

  const canSubmit =
    !!selectedType &&
    !!note.trim() &&
    !!newStage &&
    !!nextAction.trim() &&
    !!nextDate;

  async function handleSubmit() {
    if (!lead) return;

    setError('');

    if (!selectedType) {
      setError('Please select what happened.');
      return;
    }

    if (!note.trim()) {
      setError('Notes are required.');
      return;
    }

    if (!newStage) {
      setError('Stage after this action is required.');
      return;
    }

    if (!nextAction.trim()) {
      setError('Next action is required.');
      return;
    }

    if (selectedType === 'visit_sched' && !visitDate) {
      setError('Visit date is required for visit scheduled activity.');
      return;
    }

    if (newStage === 'lost' && !userCanMarkLost) {
      setError('You do not have permission to mark this lead as lost.');
      return;
    }

    if (!nextDate) {
      setError('Next follow-up date is required.');
      return;
    }

    try {
      const updatedLead = await logLeadActivity.mutateAsync({
        leadId: lead.id,
        payload: {
          type: selectedType,
          note: note.trim(),
          nextAction: nextAction.trim(),
          nextDate: nextDate || undefined,
          visitDate: visitDate || undefined,
          newStage,
        },
      });

      toast.success('Activity logged and lead updated');
      onSaved?.(updatedLead);
      onOpenChange(false);
    } catch (submitError: any) {
      setError(submitError?.message || 'Failed to save activity');
    }
  }

  if (!open || !lead) return null;

  return (
    <div className="mt-2 rounded-xl border border-border bg-card px-3 pb-3 pt-3 shadow-sm sm:px-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold">{lead?.name || 'Lead'} - Log Activity</div>
          <div className="text-[11px] text-muted-foreground">
            {ownerName}&apos;s lead · {currentStageLabel} · Move-in: {formatRelativeDay(lead?.moveInDate)}
          </div>
        </div>
        <button
          type="button"
          className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
          onClick={() => onOpenChange(false)}
        >
          Close
        </button>
      </div>

      {showLostWarning && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          ⚠ {ownerName}&apos;s lead - you can log activity but cannot mark Lost.
        </div>
      )}

      <div className="space-y-3">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-foreground">What happened?</div>
          <div className="flex flex-wrap gap-2">
            {activityTypes.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedType(item.key)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                  selectedType === item.key
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-border bg-background text-foreground hover:bg-muted'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-foreground">Notes - be specific (required)</div>
          <Textarea
            rows={2}
            className="min-h-[66px] text-xs"
            placeholder="e.g. Lead answered. Budget Rs.9k confirmed. Wants AC 2-sharing in HSR. Visit agreed Saturday 4 PM."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {selectedType === 'visit_sched' && (
          <div>
            <div className="mb-1.5 text-[11px] font-semibold text-foreground">Visit date</div>
            <Input className="h-8 text-xs" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
          </div>
        )}

        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-foreground">Stage after this action</div>
          <div className="flex flex-wrap gap-2">
            {pipelineStages
              .filter((stage) => stage.key !== 'lost' || userCanMarkLost)
              .map((stage) => (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => setNewStage(stage.key)}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                    newStage === stage.key
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  {stage.label}
                </button>
              ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold text-foreground">Next action</div>
            <Input
              className="h-8 text-xs"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="e.g. Call to confirm visit"
            />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold text-foreground">Next follow-up date (required)</div>
            <Input className="h-8 text-xs" type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </div>
        </div>

        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">{error}</div>}

        <Button className="h-8 w-full text-xs" onClick={handleSubmit} disabled={logLeadActivity.isPending || !canSubmit}>
          {logLeadActivity.isPending ? 'Saving...' : 'Save & Update Lead'}
        </Button>
      </div>
    </div>
  );
}
