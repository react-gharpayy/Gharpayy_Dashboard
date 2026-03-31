import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PIPELINE_STAGES, SOURCE_LABELS } from '@/types/crm';
import { useUpdateLead, useAgents, usePipelineStages, type LeadWithRelations } from '@/hooks/useCrmData';
import { useConversations, useFollowUps, useCreateFollowUp } from '@/hooks/useLeadDetails';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useBookingsByLead } from '@/hooks/useBookings';
import { useAuth } from '@/contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';
import { Phone, Mail, MapPin, IndianRupee, Clock, MessageCircle, CalendarCheck, User, Star, Send, Bell, ArrowRightLeft, Eye, Activity, Sparkles, Loader2, Receipt, CalendarDays, Briefcase, Home, Users, StickyNote } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  lead: LeadWithRelations | null;
  open: boolean;
  onClose: () => void;
}

const scoreColor = (score: number) => {
  if (score >= 70) return 'text-emerald-600 bg-emerald-100';
  if (score >= 40) return 'text-amber-600 bg-amber-100';
  return 'text-red-600 bg-red-100';
};

const ACTION_ICONS: Record<string, typeof Activity> = {
  status_change: ArrowRightLeft,
  agent_reassigned: User,
  visit_scheduled: Eye,
  visit_outcome: CalendarCheck,
};

const LeadDetailDrawer = ({ lead, open, onClose }: Props) => {
  const updateLead = useUpdateLead();
  const { data: members } = useAgents();
  const { user } = useAuth();
  const canAssignLead = ['super_admin', 'manager', 'admin'].includes(user?.role || '');
  const { data: pipelineStagesData } = usePipelineStages();
  const pipelineStages = (pipelineStagesData && pipelineStagesData.length > 0)
    ? pipelineStagesData
    : PIPELINE_STAGES.map((s, i) => ({ ...s, order: i }));
  const { data: conversations } = useConversations(lead?.id);
  const { data: followUps } = useFollowUps(lead?.id);
  const { data: activityLog } = useActivityLog(lead?.id);
  const { data: bookings } = useBookingsByLead(lead?.id);
  const createFollowUp = useCreateFollowUp();
  const [note, setNote] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  useEffect(() => {
    setSelectedAgentId(lead?.assignedMemberId || '');
    setSelectedStatus(lead?.status || '');
  }, [lead?.id, lead?.assignedMemberId, lead?.status]);

  const handleAiSummary = async () => {
    if (!lead) return;
    setAiLoading(true);
    setAiSummary(null);
    try {
      const res = await fetch('/api/ai/lead-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: { ...lead, agent_name: lead.members?.name },
          conversations: conversations?.slice(0, 5),
          visits: [],
          bookings: bookings?.map((b: any) => ({ property_name: b.properties?.name, booking_status: b.bookingStatus, monthly_rent: b.monthlyRent })),
        }),
      });
      if (!res.ok) throw new Error('AI analysis failed');
      const data = await res.json();
      setAiSummary(data);
    } catch (e: any) {
      toast.error(e.message || 'AI analysis failed');
    } finally {
      setAiLoading(false);
    }
  };

  if (!lead) return null;

  const stage = pipelineStages.find((s: any) => s.key === lead.status);
  const score = lead.leadScore ?? 0;
  const parsedMetadata = ((lead as any).parsedMetadata || {}) as Record<string, any>;
  const parsedTechParks: string[] = Array.isArray(parsedMetadata.techParks) ? parsedMetadata.techParks : [];
  const parsedMapLinks: string[] = Array.isArray(parsedMetadata.mapLinks) ? parsedMetadata.mapLinks : [];
  const parsedExtraEntries = Object.entries((parsedMetadata.extraFields || {}) as Record<string, string>);

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
  };

  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
  };

  const handleSaveAgentChange = async () => {
    const updates: any = { id: lead.id };
    let hasChanges = false;

    if (selectedStatus && selectedStatus !== lead.status) {
      updates.status = selectedStatus;
      hasChanges = true;
    }

    if (canAssignLead && selectedAgentId !== lead.assignedMemberId) {
      updates.assignedMemberId = selectedAgentId || null;
      hasChanges = true;
    }

    if (!hasChanges) return;

    try {
      await updateLead.mutateAsync(updates);
      toast.success('Lead updated');
    } catch (err: any) { toast.error(err.message); }
  };

  const handleAddFollowUp = async () => {
    if (!reminderDate) { toast.error('Pick a date'); return; }
    try {
      await createFollowUp.mutateAsync({
        leadId: lead.id,
        agentId: lead.assignedMemberId,
        reminderDate: new Date(reminderDate).toISOString(),
        note: note || null,
      });
      toast.success('Follow-up scheduled');
      setNote('');
      setReminderDate('');
    } catch (err: any) { toast.error(err.message); }
  };

  const formatAction = (action: string, metadata: any) => {
    switch (action) {
      case 'status_change': return `Status changed from ${(metadata.from || '').replace(/_/g, ' ')} to ${(metadata.to || '').replace(/_/g, ' ')}`;
      case 'agent_reassigned': return 'Member reassigned';
      case 'visit_scheduled': return `Visit scheduled for ${metadata.scheduled_at ? format(new Date(metadata.scheduled_at), 'MMM d, h:mm a') : 'TBD'}`;
      case 'visit_outcome': return `Visit outcome: ${metadata.outcome || 'unknown'}`;
      default: return action.replace(/_/g, ' ');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto p-0">

        <div className="p-5 sm:p-6 border-b border-border bg-gradient-to-b from-secondary/20 to-background space-y-4">
          <SheetHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <SheetTitle className="font-display text-xl leading-tight">{lead.name}</SheetTitle>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`badge-pipeline text-[10px] text-primary-foreground ${stage?.color}`}>
                    {stage?.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${scoreColor(score)}`}>
                    <Star size={10} /> {score}/100
                  </span>
                  {lead.isDuplicate ? (
                    <span className="text-[9px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                      Duplicate Phone
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </SheetHeader>

          <div className="rounded-2xl border border-border bg-card/70 p-4">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground mb-3">LEAD PROFILE</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-xs text-foreground"><Phone size={12} className="text-muted-foreground" /> {lead.phone}</div>
              {lead.email ? <div className="flex items-center gap-2 text-xs text-foreground"><Mail size={12} className="text-muted-foreground" /> {lead.email}</div> : null}
              {lead.preferredLocation ? <div className="flex items-center gap-2 text-xs text-foreground"><MapPin size={12} className="text-muted-foreground" /> {lead.preferredLocation}</div> : null}
              {lead.budget ? <div className="flex items-center gap-2 text-xs text-foreground"><IndianRupee size={12} className="text-muted-foreground" /> {lead.budget}</div> : null}
              {lead.moveInDate ? <div className="flex items-center gap-2 text-xs text-foreground"><CalendarDays size={12} className="text-muted-foreground" /> Move-in: {lead.moveInDate}</div> : null}
              {lead.profession ? <div className="flex items-center gap-2 text-xs text-foreground"><Briefcase size={12} className="text-muted-foreground" /> {lead.profession}</div> : null}
              {lead.roomType ? <div className="flex items-center gap-2 text-xs text-foreground"><Home size={12} className="text-muted-foreground" /> Room: {lead.roomType}</div> : null}
              {lead.needPreference ? <div className="flex items-center gap-2 text-xs text-foreground"><Users size={12} className="text-muted-foreground" /> Need: {lead.needPreference}</div> : null}
              <div className="flex items-center gap-2 text-xs text-foreground"><Clock size={12} className="text-muted-foreground" /> {(lead as any).firstResponseTimeMin != null ? `${(lead as any).firstResponseTimeMin}m response` : 'No response yet'}</div>
              <div className="flex items-center gap-2 text-xs text-foreground"><User size={12} className="text-muted-foreground" /> {(lead as any).members?.name || 'Unassigned'}</div>
              {lead.status ? (
                <div className="flex items-center gap-2 text-xs text-foreground">
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'currentColor', opacity: 0.6, flexShrink: 0, display: 'inline-block' }} className="text-accent" />
                  Stage: <span className="font-semibold text-foreground">{stage?.label || lead.status}</span>
                </div>
              ) : null}
              {lead.specialRequests ? (
                <div className="sm:col-span-2 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-foreground flex items-start gap-2">
                  <StickyNote size={12} className="text-muted-foreground mt-0.5" />
                  <span><span className="font-medium">Special requests:</span> {lead.specialRequests}</span>
                </div>
              ) : null}
              {lead.notes ? (
                <div className="sm:col-span-2 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-foreground flex items-start gap-2">
                  <StickyNote size={12} className="text-muted-foreground mt-0.5" />
                  <span><span className="font-medium">Notes:</span> {lead.notes}</span>
                </div>
              ) : null}

              {((lead as any).zone || parsedTechParks.length > 0 || parsedMapLinks.length > 0 || parsedMetadata.fullAddress || parsedMetadata.buildingName || parsedMetadata.sourceFormat || parsedMetadata.moveInUrgency || parsedMetadata.quality || parsedMetadata.inBLR !== undefined || parsedExtraEntries.length > 0) ? (
                <div className="sm:col-span-2 rounded-lg bg-secondary/60 px-3 py-3 text-xs text-foreground space-y-2">
                  <div className="text-[10px] font-semibold text-muted-foreground">Parsed Insights</div>

                  <div className="flex flex-wrap gap-2">
                    {(lead as any).zone ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-primary text-primary font-semibold bg-primary/5">
                        {(lead as any).zone}
                      </span>
                    ) : null}
                    {parsedMetadata.sourceFormat ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                        Source: {parsedMetadata.sourceFormat}
                      </span>
                    ) : null}
                    {parsedMetadata.moveInUrgency ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground capitalize">
                        Urgency: {parsedMetadata.moveInUrgency}
                      </span>
                    ) : null}
                    {parsedMetadata.quality ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground capitalize">
                        Quality: {parsedMetadata.quality}
                      </span>
                    ) : null}
                    {parsedMetadata.inBLR !== undefined ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                        In BLR: {parsedMetadata.inBLR === null ? 'Unknown' : (parsedMetadata.inBLR ? 'Yes' : 'No')}
                      </span>
                    ) : null}
                  </div>



                  {parsedTechParks.length > 0 ? (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Tech Parks</p>
                      <div className="flex flex-wrap gap-1.5">
                        {parsedTechParks.map((park, idx) => (
                          <span key={`${park}-${idx}`} className="text-[10px] px-2 py-0.5 rounded border border-border text-foreground">
                            {park}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {parsedMetadata.fullAddress ? (
                    <p className="text-[11px] text-foreground"><span className="text-muted-foreground">Address:</span> {parsedMetadata.fullAddress}</p>
                  ) : null}
                  {parsedMetadata.buildingName ? (
                    <p className="text-[11px] text-foreground"><span className="text-muted-foreground">Building:</span> {parsedMetadata.buildingName}</p>
                  ) : null}

                  {parsedMapLinks.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {parsedMapLinks.slice(0, 3).map((url, idx) => (
                        <a
                          key={`${url}-${idx}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground"
                        >
                          Map Link {idx + 1}
                        </a>
                      ))}
                    </div>
                  ) : null}

                  {parsedExtraEntries.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {parsedExtraEntries.slice(0, 8).map(([k, v]) => (
                        <div key={k} className="rounded border border-border px-2 py-1.5">
                          <p className="text-[10px] text-muted-foreground capitalize">{k}</p>
                          <p className="text-[11px] text-foreground break-words">{String(v)}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <label className="text-[10px] font-medium text-muted-foreground mb-1.5 block">Change Status</label>
              <Select value={selectedStatus || lead.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {pipelineStages.map((s: any) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {canAssignLead ? (
              <div className="rounded-xl border border-border bg-card p-3">
                <label className="text-[10px] font-medium text-muted-foreground mb-1.5 block">Assign Member</label>
                <div className="flex items-center gap-2">
                  <Select value={selectedAgentId || ''} onValueChange={handleAgentChange}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {members?.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
          </div>

          <Button
            size="sm"
            className="w-full h-9 text-xs"
            onClick={handleSaveAgentChange}
            disabled={
              updateLead.isPending ||
              (
                (selectedStatus || lead.status) === lead.status &&
                (!canAssignLead || selectedAgentId === lead.assignedMemberId)
              )
            }
          >
            {updateLead.isPending ? 'Saving...' : 'Save'}
          </Button>

          <div className="space-y-3">
            {!aiSummary ? (
              <Button variant="outline" size="sm" className="w-full gap-2 text-xs rounded-xl" onClick={handleAiSummary} disabled={aiLoading}>
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {aiLoading ? 'Analyzing with AI...' : 'AI Lead Analysis'}
              </Button>
            ) : (
              <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={12} className="text-accent" />
                  <span className="text-[10px] font-semibold text-accent">AI ANALYSIS</span>
                  <Badge variant="outline" className={`text-[9px] ml-auto ${aiSummary.urgency === 'hot' ? 'border-success text-success' : aiSummary.urgency === 'warm' ? 'border-warning text-warning' : 'border-muted-foreground text-muted-foreground'}`}>
                    {aiSummary.urgency?.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-xs text-foreground">{aiSummary.intent}</p>
                <p className="text-[10px] text-muted-foreground">{aiSummary.urgency_reason}</p>
                <div className="border-t border-border pt-2 mt-2">
                  <p className="text-[10px] font-medium text-foreground">→ {aiSummary.next_action}</p>
                  <p className="text-[10px] text-destructive mt-0.5">⚠ {aiSummary.risk}</p>
                </div>
              </div>
            )}

            {bookings && bookings.length > 0 ? (
              <div className="rounded-xl border border-border bg-card/70 p-3 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1"><Receipt size={10} /> BOOKINGS</p>
                {bookings.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/50 text-xs">
                    <div>
                      <p className="font-medium text-foreground">{b.properties?.name || 'TBD'}</p>
                      <p className="text-[10px] text-muted-foreground">{b.rooms?.room_number}{b.beds?.bed_number ? ` / ${b.beds.bed_number}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-[9px]">{b.booking_status}</Badge>
                      {b.monthly_rent && <p className="text-[10px] text-foreground mt-0.5">₹{Number(b.monthly_rent).toLocaleString()}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="timeline" className="p-5 sm:p-6">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="timeline" className="text-xs">Activity</TabsTrigger>
            <TabsTrigger value="conversations" className="text-xs">Messages</TabsTrigger>
            <TabsTrigger value="followups" className="text-xs">Follow-ups</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-4 space-y-2">
            {/* Activity log from DB */}
            {activityLog?.map(entry => {
              const IconComp = ACTION_ICONS[entry.action] || Activity;
              return (
                <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                  <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <IconComp size={10} className="text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-xs">{formatAction(entry.action, entry.metadata)}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}</p>
                    {(entry as any).members?.name && (
                      <p className="text-[10px] text-muted-foreground">by {(entry as any).members.name}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Static entries */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <User size={10} className="text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground text-xs">Lead created</p>
                <p className="text-[10px] text-muted-foreground">{format(new Date(lead.createdAt), 'MMM d, yyyy h:mm a')}</p>
                <p className="text-[10px]">Source: {SOURCE_LABELS[lead.source as keyof typeof SOURCE_LABELS]}</p>
              </div>
            </div>

            {(!activityLog || activityLog.length === 0) && (
              <>
                {lead.firstResponseTimeMin != null && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock size={10} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-xs">First response</p>
                      <p className="text-[10px]">{lead.firstResponseTimeMin} minutes after creation</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {lead.notes && (
              <div className="p-3 rounded-lg bg-accent/50 border border-accent">
                <p className="text-[10px] font-medium text-accent-foreground mb-1">Notes</p>
                <p className="text-xs text-foreground">{lead.notes}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="conversations" className="mt-4">
            <div className="space-y-2">
              {conversations?.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">No conversations yet</p>
              )}
              {conversations?.map(c => (
                <div key={c.id} className={`p-3 rounded-lg text-xs ${c.direction === 'inbound' ? 'bg-secondary/50' : 'bg-primary/5 border border-primary/10'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground capitalize">{c.direction === 'inbound' ? lead.name : 'Member'}</span>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(c.createdAt), 'MMM d, h:mm a')}</span>
                  </div>
                  <p className="text-muted-foreground">{c.message}</p>
                  <Badge variant="outline" className="text-[9px] mt-1">{c.channel}</Badge>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="followups" className="mt-4 space-y-4">
            <div className="space-y-2">
              {followUps?.map(f => (
                <div key={f.id} className={`p-3 rounded-lg border text-xs ${f.isCompleted ? 'bg-secondary/30 border-border' : 'bg-warning/5 border-warning/20'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground flex items-center gap-1">
                      <Bell size={10} /> {format(new Date(f.reminderDate), 'MMM d, h:mm a')}
                    </span>
                    <Badge variant={f.isCompleted ? 'secondary' : 'default'} className="text-[9px]">
                      {f.isCompleted ? 'Done' : 'Pending'}
                    </Badge>
                  </div>
                  {f.note && <p className="text-muted-foreground mt-1">{f.note}</p>}
                </div>
              ))}
              {followUps?.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No follow-ups scheduled</p>}
            </div>

            {/* Add follow-up */}
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-medium text-foreground">Schedule Follow-up</p>
              <input type="datetime-local" value={reminderDate} onChange={e => setReminderDate(e.target.value)}
                className="w-full text-xs bg-secondary border border-border rounded-lg px-3 py-2 text-foreground" />
              <Textarea placeholder="Note (optional)..." value={note} onChange={e => setNote(e.target.value)} rows={2} className="text-xs" />
              <Button size="sm" className="w-full gap-1.5 text-xs" onClick={handleAddFollowUp} disabled={createFollowUp.isPending}>
                <CalendarCheck size={12} /> {createFollowUp.isPending ? 'Scheduling...' : 'Schedule Follow-up'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default LeadDetailDrawer;

