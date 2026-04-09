"use client";

import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, FileText, Phone, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useToursState } from '@/contexts/ToursContext';
import { ToursMetricCard } from '@/components/tours/ToursMetricCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Tour, TourMode } from '@/features/tours/types';
import { useAgents, useAllVisibleLeads, useCreateVisit, useOfficeZones, useProperties, useVisits } from '@/hooks/useCrmData';
import { useAuth } from '@/contexts/AuthContext';

function objectIdLike() {
  // 24-char hex string for Mongo ObjectId compatibility.
  const seed = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return seed.padEnd(24, '0').slice(0, 24);
}

function extractTypedProperty(notes: string) {
  const match = notes.match(/typed_property:([^;]+)/i);
  return match?.[1]?.trim() || '';
}

function extractMeta(notes: string, key: string) {
  const re = new RegExp(`${key}:([^;]+)`, 'i');
  const match = notes.match(re);
  return match?.[1]?.trim() || '';
}

export function FlowOpsPanel() {
  const { tours } = useToursState();
  const { data: officeZones } = useOfficeZones();
  const { data: members } = useAgents();
  const { data: leads } = useAllVisibleLeads();
  const { data: properties } = useProperties();
  const { data: visits, isLoading: isVisitsLoading } = useVisits();
  const createVisit = useCreateVisit();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [showLeadOptions, setShowLeadOptions] = useState(false);
  const [phone, setPhone] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [tourDate, setTourDate] = useState(new Date().toISOString().split('T')[0]);
  const [tourTime, setTourTime] = useState('11:00');
  const [tourMode, setTourMode] = useState<TourMode>('physical');
  const [assignedTo, setAssignedTo] = useState('');
  const [assignedSearch, setAssignedSearch] = useState('');
  const [showAssignedOptions, setShowAssignedOptions] = useState(false);
  const [budget, setBudget] = useState('12000');

  const myVisits = useMemo(() => {
    const list = (visits || []) as any[];
    const currentUserId = String(user?.id || '');
    if (!currentUserId) return [];

    return list.filter((visit) => {
      const notes = String(visit?.notes || '');
      const scheduledById = extractMeta(notes, 'scheduled_by_id');
      return scheduledById === currentUserId;
    });
  }, [visits, user?.id]);

  const visitTours = useMemo(() => {
    return myVisits
      .map((visit) => {
        const outcome = String(visit?.outcome || '');
        const notes = String(visit?.notes || '');
        const typedProperty = extractTypedProperty(notes);
        const status = outcome === 'completed'
          ? 'completed'
          : outcome === 'no_show'
            ? 'no-show'
            : outcome === 'cancelled'
              ? 'cancelled'
              : outcome === 'rescheduled'
                ? 'rescheduled'
                : (visit?.confirmed ? 'confirmed' : 'scheduled');

        return {
          id: String(visit.id || visit._id || ''),
          leadName: String(visit?.leads?.name || 'Unknown Lead'),
          propertyName: String(visit?.properties?.name || typedProperty || 'Property Pending'),
          createdAt: visit?.createdAt || visit?.scheduledAt || new Date().toISOString(),
          tourTime: visit?.scheduledAt ? new Date(visit.scheduledAt).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }) : '-',
          status,
          showUp: outcome === 'completed' ? true : outcome === 'no_show' ? false : null,
          outcome: null,
        };
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [myVisits]);

  const localScheduledTours = useMemo(() => {
    const currentUserId = String(user?.id || '');
    return tours
      .filter((tour) => {
        // Keep only tours created from schedule modal in this module.
        const isLocallyCreated = String(tour.id || '').startsWith('t-');
        const sameScheduler = currentUserId
          ? String(tour.scheduledBy || '') === currentUserId
          : String(tour.scheduledBy || '') === 'system';
        return isLocallyCreated && sameScheduler;
      })
      .map((tour) => ({
        id: String(tour.id),
        leadName: String(tour.leadName || 'Unknown Lead'),
        propertyName: String(tour.propertyName || 'Unknown Property'),
        createdAt: tour.createdAt || new Date().toISOString(),
        tourTime: `${tour.tourDate || ''} ${tour.tourTime || ''}`.trim() || '-',
        status: String(tour.status || 'scheduled'),
        showUp: tour.showUp,
        outcome: tour.outcome,
      }));
  }, [tours, user?.id]);

  const myTours = useMemo(() => {
    const byId = new Map<string, any>();
    [...visitTours, ...localScheduledTours].forEach((tour) => {
      byId.set(String(tour.id), tour);
    });
    return Array.from(byId.values()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [visitTours, localScheduledTours]);

  const showUps = myTours.filter((tour) => tour.showUp === true).length;
  const drafts = myTours.filter((tour) => tour.status === 'rescheduled' || tour.outcome === 'draft').length;
  const pending = myTours.filter((tour) => tour.status === 'scheduled').length;
  const memberOptions = useMemo(
    () => (members || [])
      .map((member: any) => ({
        id: String(member?.id || member?._id || ''),
        name: String(member?.name || member?.fullName || '').trim(),
      }))
      .filter((member: { id: string; name: string }) => member.id && member.name),
    [members]
  );
  const zoneOptions = useMemo(
    () => (officeZones || [])
      .map((zone: any) => ({ id: String(zone?._id || zone?.id || ''), name: String(zone?.name || '').trim() }))
      .filter((zone: { id: string; name: string }) => zone.id && zone.name),
    [officeZones]
  );

  useEffect(() => {
    if (!zoneId && zoneOptions.length > 0) {
      setZoneId(zoneOptions[0].id);
    }
  }, [zoneId, zoneOptions]);

  useEffect(() => {
    if (!assignedTo) return;
    const selected = memberOptions.find((member) => member.id === assignedTo);
    if (selected) {
      setAssignedSearch(selected.name);
    }
  }, [assignedTo, memberOptions]);

  const filteredMemberOptions = useMemo(() => {
    const q = assignedSearch.trim().toLowerCase();
    if (!q) return memberOptions.slice(0, 8);
    return memberOptions.filter((member) => member.name.toLowerCase().includes(q)).slice(0, 12);
  }, [assignedSearch, memberOptions]);

  const leadOptions = useMemo(
    () => (leads || []).map((lead: any) => ({
      id: String(lead.id || lead._id),
      name: String(lead.name || ''),
      phone: String(lead.phone || ''),
    })),
    [leads]
  );

  const filteredLeadOptions = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    if (!q) return leadOptions.slice(0, 12);
    return leadOptions
      .filter((lead) =>
        lead.name.toLowerCase().includes(q) ||
        lead.phone.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [leadSearch, leadOptions]);

  const handleLeadSearchChange = (nextValue: string) => {
    setLeadSearch(nextValue);
    // Do not auto-select while typing; selection should happen only on option click.
    setLeadId('');
    setShowLeadOptions(true);
  };

  const handleLeadSelect = (lead: { id: string; name: string; phone: string }) => {
    setLeadId(lead.id);
    setLeadSearch(`${lead.name}${lead.phone ? ` - ${lead.phone}` : ''}`);
    setPhone(String(lead.phone || ''));
    setShowLeadOptions(false);
  };

  const handleAssignedSearchChange = (nextValue: string) => {
    setAssignedSearch(nextValue);
    const matched = memberOptions.find((member) => member.name.toLowerCase() === nextValue.trim().toLowerCase());
    setAssignedTo(matched?.id || '');
    setShowAssignedOptions(true);
  };

  useEffect(() => {
    if (!leadId) return;
    const selectedLead = leadOptions.find((lead) => lead.id === leadId);
    if (!selectedLead) return;
    setLeadSearch(`${selectedLead.name}${selectedLead.phone ? ` - ${selectedLead.phone}` : ''}`);
    if (selectedLead.phone) {
      setPhone(String(selectedLead.phone));
    }
  }, [leadId, leadOptions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const shouldOpen = params.get('openSchedule') === '1';
    if (!shouldOpen) return;

    const qsLeadId = String(params.get('leadId') || '').trim();
    const qsLeadName = String(params.get('leadName') || '').trim();
    const qsPhone = String(params.get('phone') || '').trim();
    const qsZone = String(params.get('zone') || '').trim();

    if (qsLeadId) setLeadId(qsLeadId);
    if (qsLeadName || qsPhone) {
      setLeadSearch(`${qsLeadName}${qsPhone ? ` - ${qsPhone}` : ''}`.trim());
    }
    if (qsPhone) setPhone(qsPhone);
    if (qsZone) {
      const zoneMatch = zoneOptions.find((z) => z.name.toLowerCase() === qsZone.toLowerCase());
      if (zoneMatch) setZoneId(zoneMatch.id);
    }
    setOpen(true);
  }, [zoneOptions]);

  const handleAssignedSelect = (member: { id: string; name: string }) => {
    setAssignedTo(member.id);
    setAssignedSearch(member.name);
    setShowAssignedOptions(false);
  };

  const resetForm = () => {
    setLeadId('');
    setLeadSearch('');
    setShowLeadOptions(false);
    setPhone('');
    setPropertyName('');
    setZoneId(zoneOptions[0]?.id || '');
    setTourDate(new Date().toISOString().split('T')[0]);
    setTourTime('11:00');
    setTourMode('physical');
    setAssignedTo(memberOptions[0]?.id || '');
    setAssignedSearch(memberOptions[0]?.name || '');
    setBudget('12000');
  };

  const handleScheduleTour = async () => {
    if (!leadId || !propertyName.trim() || !zoneId || !tourDate || !tourTime || !assignedTo) {
      toast.error('Please fill all required fields');
      return;
    }

    const assignedMember = memberOptions.find((m) => m.id === assignedTo);
    const zone = zoneOptions.find((z) => z.id === zoneId);
    if (!assignedMember || !zone) {
      toast.error('Invalid zone or assigned TCM member');
      return;
    }

    // Intentionally do not match typed property text to records for now.
    const selectedLeadAny = (leads || []).find((lead: any) => String(lead.id || lead._id) === leadId) as any;
    const fallbackPropertyId =
      String((properties || [])[0]?.id || (properties || [])[0]?._id || '') ||
      String(selectedLeadAny?.properties?.id || selectedLeadAny?.properties?._id || '') ||
      String(selectedLeadAny?.propertyId || '') ||
      objectIdLike();

    try {
      const scheduledAt = new Date(`${tourDate}T${tourTime}:00`);
      await createVisit.mutateAsync({
        leadId,
        propertyId: fallbackPropertyId,
        assignedStaffId: assignedMember.id,
        scheduledAt: scheduledAt.toISOString(),
        // Backward-compatible aliases for any legacy mapping.
        lead_id: leadId,
        property_id: fallbackPropertyId,
        assigned_staff_id: assignedMember.id,
        scheduled_at: scheduledAt.toISOString(),
        notes: `tour_mode:${tourMode}; zone:${zone.name}; budget:${Number(budget) || 0}; scheduled_by:${user?.fullName || user?.username || 'system'}; scheduled_by_id:${String(user?.id || '')}; assigned_to:${assignedMember.name}; assigned_to_id:${assignedMember.id}; typed_property:${propertyName.trim()}`,
        phone,
      });
      toast.success('Tour scheduled successfully');
      setOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to schedule tour');
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-foreground">Flow Ops Dashboard</h2>
          <p className="text-xs text-muted-foreground">Scheduling performance and tours booked by flow ops</p>
        </div>
        <Button size="sm" className="h-8 text-xs" onClick={() => setOpen(true)}>
          Schedule Tour
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <ToursMetricCard label="My Tours" value={myTours.length} tone="blue" icon={<CalendarCheck className="h-4 w-4" />} />
        <ToursMetricCard label="Pending" value={pending} tone="amber" icon={<Phone className="h-4 w-4" />} />
        <ToursMetricCard label="Show-Ups" value={showUps} tone="green" icon={<TrendingUp className="h-4 w-4" />} />
        <ToursMetricCard label="Drafts" value={drafts} tone="amber" icon={<FileText className="h-4 w-4" />} />
      </div>

      <div className="kpi-card p-3 md:p-5">
        <h3 className="mb-3 text-xs md:text-sm font-semibold text-foreground">Tours I Scheduled</h3>
        <div className="space-y-2">
          {isVisitsLoading && (
            <p className="py-4 text-center text-xs text-muted-foreground">Loading tours...</p>
          )}
          {myTours.map((tour) => (
            <div key={tour.id} className="flex flex-col gap-1.5 rounded-lg bg-secondary/35 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground">{tour.leadName}</span>
                <span className="ml-2 text-xs text-muted-foreground">{tour.propertyName}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{tour.tourTime}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] capitalize ${tour.status === 'completed' ? 'bg-success/15 text-success' : tour.status === 'confirmed' ? 'bg-info/15 text-info' : tour.status === 'no-show' || tour.status === 'cancelled' ? 'bg-destructive/15 text-destructive' : 'bg-warning/15 text-warning'}`}>
                  {tour.status}
                </span>
              </div>
            </div>
          ))}
          {!isVisitsLoading && myTours.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">No tours assigned to this flow ops member.</p>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Schedule Tour</DialogTitle>
            <DialogDescription>Create a new tour assignment for a TCM member.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Lead</Label>
              <div className="relative">
                <Input
                  value={leadSearch}
                  onChange={(e) => handleLeadSearchChange(e.target.value)}
                  onFocus={() => setShowLeadOptions(true)}
                  onBlur={() => setTimeout(() => setShowLeadOptions(false), 120)}
                  placeholder="Type lead name or phone..."
                  className="h-8 text-xs"
                />
                {showLeadOptions && filteredLeadOptions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-44 overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
                    {filteredLeadOptions.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        className="w-full rounded-sm px-2 py-1.5 text-left text-xs text-popover-foreground hover:bg-accent/20"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleLeadSelect(lead)}
                      >
                        {lead.name}{lead.phone ? ` - ${lead.phone}` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone Number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Property</Label>
              <Input
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                placeholder="Type property name"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Zone</Label>
              <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                {zoneOptions.map((zone) => (
                  <option key={zone.id} value={zone.id}>{zone.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Assign To (TCM)</Label>
              <div className="relative">
                <Input
                  value={assignedSearch}
                  onChange={(e) => handleAssignedSearchChange(e.target.value)}
                  onFocus={() => setShowAssignedOptions(true)}
                  onBlur={() => setTimeout(() => setShowAssignedOptions(false), 120)}
                  placeholder="Type member name..."
                  className="h-8 text-xs"
                />
                {showAssignedOptions && filteredMemberOptions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-44 overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
                    {filteredMemberOptions.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        className="w-full rounded-sm px-2 py-1.5 text-left text-xs text-popover-foreground hover:bg-accent/20"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleAssignedSelect(member)}
                      >
                        {member.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tour Date</Label>
              <Input type="date" value={tourDate} onChange={(e) => setTourDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tour Time</Label>
              <Input type="time" value={tourTime} onChange={(e) => setTourTime(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tour Mode</Label>
              <select value={tourMode} onChange={(e) => setTourMode(e.target.value as TourMode)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                <option value="physical">Physical</option>
                <option value="virtual">Virtual</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Budget</Label>
              <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleScheduleTour} disabled={createVisit.isPending}>
              {createVisit.isPending ? 'Scheduling...' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
