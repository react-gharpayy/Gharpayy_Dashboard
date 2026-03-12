import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { useCreateVisit, useLeads, useProperties, useAgents } from '@/hooks/useCrmData';
import { useAuth } from '@/contexts/AuthContext';
import { toast }  from 'sonner';

interface Props {
  // Optional: pre-fill lead when opening from a lead detail page
  preselectedLeadId?: string;
  trigger?: React.ReactNode;
}

const AddVisitDialog = ({ preselectedLeadId, trigger }: Props) => {
  const { agentId } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    lead_id:          preselectedLeadId ?? '',
    property_id:      '',
    room_id:          '',        // optional — for soft_lock
    bed_id:           '',        // optional — for soft_lock
    assigned_staff_id: agentId ?? '',
    scheduled_at:     '',
    notes:            '',
  });

  const createVisit     = useCreateVisit();
  const { data: leads }      = useLeads();
  const { data: properties } = useProperties();
  const { data: agents }     = useAgents();

  const setField = (key: keyof typeof form) => (value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  const reset = () =>
    setForm({
      lead_id:           preselectedLeadId ?? '',
      property_id:       '',
      room_id:           '',
      bed_id:            '',
      assigned_staff_id: agentId ?? '',
      scheduled_at:      '',
      notes:             '',
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.lead_id || !form.property_id || !form.scheduled_at) {
      toast.error('Lead, property, and date/time are required');
      return;
    }

    const scheduledDate = new Date(form.scheduled_at);
    if (scheduledDate <= new Date()) {
      toast.error('Scheduled time must be in the future');
      return;
    }

    try {
      await createVisit.mutateAsync({
        lead_id:           form.lead_id,
        property_id:       form.property_id,
        room_id:           form.room_id   || null,
        bed_id:            form.bed_id    || null,
        assigned_staff_id: form.assigned_staff_id || agentId || null,
        scheduled_at:      scheduledDate.toISOString(),
        notes:             form.notes || null,
        confirmed:         false,
      });

      toast.success('Visit scheduled — lead moved to Visit Scheduled stage');
      setOpen(false);
      reset();
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule visit');
    }
  };

  const triggerEl = trigger ?? (
    <Button size="sm" className="gap-1.5 text-xs">
      <Plus size={13} /> Schedule Visit
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerEl}</DialogTrigger>

      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="font-display">Schedule Property Visit</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* Lead */}
          {!preselectedLeadId && (
            <div className="space-y-1.5">
              <Label className="text-xs">Lead *</Label>
              <Select value={form.lead_id} onValueChange={setField('lead_id')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select lead" />
                </SelectTrigger>
                <SelectContent>
                  {leads?.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} · {l.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Property */}
          <div className="space-y-1.5">
            <Label className="text-xs">Property *</Label>
            <Select value={form.property_id} onValueChange={setField('property_id')}>
              <SelectTrigger>
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {properties?.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.area ? `· ${p.area}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assign Staff */}
          <div className="space-y-1.5">
            <Label className="text-xs">Assigned Staff</Label>
            <Select
              value={form.assigned_staff_id}
              onValueChange={setField('assigned_staff_id')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                {agents?.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date & Time */}
          <div className="space-y-1.5">
            <Label className="text-xs">Date & Time *</Label>
            <Input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={e => setField('scheduled_at')(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={e => setField('notes')(e.target.value)}
              placeholder="Any special instructions for the visit..."
              rows={2}
              className="text-xs resize-none"
            />
          </div>

          {/* Info box — what happens on submit */}
          <div className="rounded-lg bg-accent/5 border border-accent/10 px-3 py-2.5 space-y-0.5">
            <p className="text-[10px] font-semibold text-accent">On submission:</p>
            <p className="text-[10px] text-muted-foreground">• Lead stage → Visit Scheduled</p>
            <p className="text-[10px] text-muted-foreground">• Room soft-locked for 48 hours</p>
            <p className="text-[10px] text-muted-foreground">• Activity logged automatically</p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { setOpen(false); reset(); }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createVisit.isPending}
            >
              {createVisit.isPending
                ? <><Loader2 size={13} className="animate-spin mr-1.5" /> Scheduling…</>
                : 'Schedule Visit'
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddVisitDialog;
