import { useState } from 'react';
import { useAppState } from '@/lib/app-context';
import { zones, teamMembers } from '@/lib/mock-data';
import { Tour, BookingSource, LeadType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ScheduleTour() {
  const { setTours } = useAppState();
  const [form, setForm] = useState({
    leadName: '', phone: '', propertyName: '', area: '',
    zoneId: zones[0].id, tourDate: new Date().toISOString().split('T')[0],
    tourTime: '10:00', bookingSource: 'call' as BookingSource,
    leadType: 'urgent' as LeadType, budget: '10000',
    assignedTo: '',
  });

  const tcms = teamMembers.filter(m => m.role === 'tcm' && m.zoneId === form.zoneId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const assignee = teamMembers.find(m => m.id === form.assignedTo);
    if (!assignee) { toast.error('Select a TCM'); return; }

    const newTour: Tour = {
      id: `t${Date.now()}`,
      ...form,
      budget: parseInt(form.budget),
      assignedToName: assignee.name,
      scheduledBy: 'm1',
      scheduledByName: 'Rahul Sharma',
      status: 'scheduled',
      showUp: null,
      outcome: null,
      remarks: '',
      createdAt: new Date().toISOString(),
    };
    setTours(prev => [newTour, ...prev]);
    toast.success('Tour scheduled');
    setForm(f => ({ ...f, leadName: '', phone: '', propertyName: '' }));
  };

  const selectClass = "w-full h-10 bg-surface-2 border border-border rounded-md px-3 text-sm text-foreground";

  return (
    <div className="space-y-4 animate-slide-up">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Schedule Tour</h1>
        <p className="text-xs text-muted-foreground">Add a qualified, confirmed tour</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-4 md:p-6 space-y-3 md:space-y-4 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-muted-foreground text-xs">Lead Name</Label>
            <Input value={form.leadName} onChange={e => setForm(f => ({ ...f, leadName: e.target.value }))} required className="bg-surface-2 border-border" />
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Phone</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required className="bg-surface-2 border-border" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-muted-foreground text-xs">Property</Label>
            <Input value={form.propertyName} onChange={e => setForm(f => ({ ...f, propertyName: e.target.value }))} required className="bg-surface-2 border-border" />
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Zone</Label>
            <select value={form.zoneId} onChange={e => setForm(f => ({ ...f, zoneId: e.target.value, area: zones.find(z => z.id === e.target.value)?.area || '', assignedTo: '' }))} className={selectClass}>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-muted-foreground text-xs">Date</Label>
            <Input type="date" value={form.tourDate} onChange={e => setForm(f => ({ ...f, tourDate: e.target.value }))} className="bg-surface-2 border-border" />
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Time</Label>
            <Input type="time" value={form.tourTime} onChange={e => setForm(f => ({ ...f, tourTime: e.target.value }))} className="bg-surface-2 border-border" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-muted-foreground text-xs">Budget (₹)</Label>
            <Input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} className="bg-surface-2 border-border" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-muted-foreground text-xs">Source</Label>
            <select value={form.bookingSource} onChange={e => setForm(f => ({ ...f, bookingSource: e.target.value as BookingSource }))} className={selectClass}>
              <option value="call">Call</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="referral">Referral</option>
              <option value="walk-in">Walk-in</option>
            </select>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Lead Type</Label>
            <select value={form.leadType} onChange={e => setForm(f => ({ ...f, leadType: e.target.value as LeadType }))} className={selectClass}>
              <option value="urgent">Urgent</option>
              <option value="future">Future</option>
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-muted-foreground text-xs">Assign TCM</Label>
            <select value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} className={selectClass}>
              <option value="">Select TCM</option>
              {tcms.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        <Button type="submit" className="w-full">Schedule Tour</Button>
      </form>
    </div>
  );
}
