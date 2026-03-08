import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, ChevronDown, ChevronUp, Loader2, AlertTriangle } from 'lucide-react';
import { useCreateLead, useAgents } from '@/hooks/useCrmData';
import { SOURCE_LABELS } from '@/types/crm';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

const QuickAddLead = () => {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', source: 'whatsapp' as string,
    budget: '', preferred_location: '', notes: '', assigned_agent_id: '',
  });
  const [duplicate, setDuplicate] = useState<{ id: string; name: string; status: string } | null>(null);

  const createLead = useCreateLead();
  const { data: agents } = useAgents();

  const reset = () => {
    setForm({ name: '', phone: '', email: '', source: 'whatsapp', budget: '', preferred_location: '', notes: '', assigned_agent_id: '' });
    setDuplicate(null);
    setExpanded(false);
  };

  const checkDuplicate = async (phone: string) => {
    if (!phone || phone.length < 5) { setDuplicate(null); return; }
    const { data } = await supabase.from('leads').select('id, name, status').eq('phone', phone).limit(1);
    if (data && data.length > 0) setDuplicate(data[0]);
    else setDuplicate(null);
  };

  // Smart auto-assign: agent with fewest active leads
  const getAutoAgent = () => {
    if (!agents || agents.length === 0) return null;
    // If agent is manually selected, use that
    if (form.assigned_agent_id) return form.assigned_agent_id;
    return agents[0]?.id || null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Name and phone are required');
      return;
    }
    try {
      await createLead.mutateAsync({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        source: form.source as any,
        budget: form.budget.trim() || null,
        preferred_location: form.preferred_location.trim() || null,
        notes: form.notes.trim() || null,
        assigned_agent_id: getAutoAgent(),
        status: 'new',
      });
      toast.success('Lead created!');
      setOpen(false);
      reset();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create lead');
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-accent text-accent-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.5 }}
      >
        <Plus size={24} strokeWidth={2.5} />
      </motion.button>

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden rounded-2xl">
          <div className="p-6 pb-0">
            <DialogHeader>
              <DialogTitle className="font-display text-lg">Quick Add Lead</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Just name & phone. Everything else is optional.</p>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-3">
            {/* Core fields — always visible */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input
                  autoFocus
                  placeholder="Full name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone *</Label>
                <Input
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  onBlur={() => checkDuplicate(form.phone)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            {/* Duplicate warning */}
            {duplicate && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20">
                <AlertTriangle size={13} className="text-warning shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium text-foreground">Duplicate: {duplicate.name}</p>
                  <p className="text-muted-foreground text-[10px]">Status: {duplicate.status.replace(/_/g, ' ')}</p>
                </div>
              </div>
            )}

            {/* Expand toggle */}
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors font-medium"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expanded ? 'Less details' : 'More details'}
            </button>

            {/* Expanded fields */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="h-10 rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Source</Label>
                      <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                        <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Budget</Label>
                      <Input placeholder="₹ Range" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} className="h-10 rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Location</Label>
                      <Input placeholder="Area" value={form.preferred_location} onChange={e => setForm(f => ({ ...f, preferred_location: e.target.value }))} className="h-10 rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Agent</Label>
                    <Select value={form.assigned_agent_id} onValueChange={v => setForm(f => ({ ...f, assigned_agent_id: v }))}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Auto-assign" /></SelectTrigger>
                      <SelectContent>
                        {agents?.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Textarea placeholder="Quick notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="rounded-xl" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => { setOpen(false); reset(); }}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 h-11 rounded-xl font-semibold" disabled={createLead.isPending}>
                {createLead.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Create Lead'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuickAddLead;
