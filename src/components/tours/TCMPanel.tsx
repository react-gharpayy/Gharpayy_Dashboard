"use client";

import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Clock, FileText, Phone, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToursState } from '@/contexts/ToursContext';
import { ToursMetricCard } from '@/components/tours/ToursMetricCard';
import { ToursOutcomeBadge, ToursStatusBadge } from '@/components/tours/ToursStatusBadge';
import type { Tour, TourOutcome } from '@/features/tours/types';
import { useVisits } from '@/hooks/useCrmData';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

function parseHour(value: string) {
  const hour = Number((value || '0').split(':')[0]);
  return Number.isNaN(hour) ? 0 : hour;
}

function getId(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const fromProps = String(value.id || value._id || '');
  if (fromProps) return fromProps;
  // Handles raw ObjectId-like values.
  try {
    const raw = String(value);
    return raw === '[object Object]' ? '' : raw;
  } catch {
    return '';
  }
}

function extractMeta(notes: string, key: string) {
  const re = new RegExp(`${key}:([^;]+)`, 'i');
  const match = notes.match(re);
  return match?.[1]?.trim() || '';
}

type TcmTourItem = {
  id: string;
  leadName: string;
  propertyName: string;
  tourTime: string;
  status: Tour['status'];
  showUp: Tour['showUp'];
  outcome: Tour['outcome'];
  remarks?: string;
  createdAt: string;
  isLocal: boolean;
};

function OutcomeRow({ tour, onUpdate }: { tour: TcmTourItem; onUpdate: (id: string, updates: Partial<Tour>) => void }) {
  const [remarks, setRemarks] = useState('');

  const setOutcome = (outcome: TourOutcome) => {
    onUpdate(tour.id, { outcome, remarks });
    toast.success(`Outcome set to ${outcome}`);
  };

  return (
    <div className="space-y-2 rounded-lg bg-secondary/35 px-3 py-3">
      <div>
        <span className="text-sm font-medium text-foreground">{tour.leadName}</span>
        <span className="ml-2 text-xs text-muted-foreground">{tour.propertyName}</span>
      </div>
      <Textarea
        placeholder="Remarks - objections, feedback..."
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        className="h-14 resize-none bg-background text-xs"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setOutcome('draft')} className="h-8 bg-warning/20 text-warning hover:bg-warning/30">Draft</Button>
        <Button size="sm" variant="outline" onClick={() => setOutcome('follow-up')} className="h-8">Follow-up</Button>
        <Button size="sm" variant="outline" onClick={() => setOutcome('rejected')} className="h-8 text-destructive">Rejected</Button>
      </div>
    </div>
  );
}

export function TCMPanel() {
  const { tours, updateTour } = useToursState();
  const { data: visits, isLoading: isVisitsLoading } = useVisits();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((v) => v + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const currentUserId = String(user?.id || '');

  const visitTours = useMemo(() => {
    const list = (visits || []) as any[];
    const currentUserName = String(user?.fullName || user?.username || '').trim().toLowerCase();
    const scoped = currentUserId
      ? list.filter((visit) => {
          const assignedId = getId(visit.members || visit.assignedStaffId);
          const notes = String(visit?.notes || '');
          const assignedMetaId = extractMeta(notes, 'assigned_to_id');
          const assignedMetaName = extractMeta(notes, 'assigned_to');

          if (assignedId && assignedId === currentUserId) return true;
          if (assignedMetaId && assignedMetaId === currentUserId) return true;
          if (!assignedId && !assignedMetaId && currentUserName && assignedMetaName) {
            return assignedMetaName.toLowerCase() === currentUserName;
          }

          return false;
        })
      : list;

    return scoped.map((visit) => {
      const outcome = String(visit?.outcome || '');
      const status: Tour['status'] = outcome === 'completed'
        ? 'completed'
        : outcome === 'no_show'
          ? 'no-show'
          : outcome === 'cancelled'
            ? 'cancelled'
            : (visit?.confirmed ? 'confirmed' : 'scheduled');

      const createdAt = String(visit?.createdAt || visit?.scheduledAt || new Date().toISOString());
      const item: TcmTourItem = {
        id: String(visit.id || visit._id || ''),
        leadName: String(visit?.leads?.name || 'Unknown Lead'),
        propertyName: String(visit?.properties?.name || 'Unknown Property'),
        tourTime: visit?.scheduledAt
          ? new Date(visit.scheduledAt).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })
          : '-',
        status,
        showUp: outcome === 'completed' ? true : outcome === 'no_show' ? false : null,
        outcome: null,
        remarks: String(visit?.notes || ''),
        createdAt,
        isLocal: false,
      };
      return item;
    });
  }, [visits, currentUserId, user?.fullName, user?.username]);

  const localAssignedTours = useMemo(() => {
    const scoped = currentUserId
      ? tours.filter((tour) => String(tour.assignedTo || '') === currentUserId)
      : tours;

    return scoped.map((tour) => ({
      id: String(tour.id),
      leadName: String(tour.leadName || 'Unknown Lead'),
      propertyName: String(tour.propertyName || 'Unknown Property'),
      tourTime: `${tour.tourDate || ''} ${tour.tourTime || ''}`.trim() || '-',
      status: tour.status,
      showUp: tour.showUp,
      outcome: tour.outcome,
      remarks: tour.remarks,
      createdAt: String(tour.createdAt || new Date().toISOString()),
      isLocal: true,
    } as TcmTourItem));
  }, [tours, currentUserId]);

  const myTours = useMemo(() => {
    const merged = new Map<string, TcmTourItem>();
    [...visitTours, ...localAssignedTours].forEach((tour) => merged.set(tour.id, tour));
    return Array.from(merged.values());
  }, [visitTours, localAssignedTours]);

  const todayTours = useMemo(
    () => [...myTours].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [myTours]
  );

  const completed = myTours.filter((tour) => tour.status === 'completed').length;
  const showUps = myTours.filter((tour) => tour.showUp === true).length;
  const drafts = myTours.filter((tour) => tour.outcome === 'draft').length;

  const currentHour = new Date().getHours();
  const upcoming = myTours.filter((tour) => {
    const hour = parseHour(tour.tourTime);
    return hour >= currentHour && hour <= currentHour + 2 && tour.status !== 'completed' && tour.status !== 'cancelled';
  });

  const needsOutcome = myTours.filter((tour) => tour.status === 'completed' && !tour.outcome);

  const handleUpdateTour = async (tourId: string, updates: Partial<Tour>) => {
    const local = myTours.find((tour) => tour.id === tourId)?.isLocal;
    if (local) {
      updateTour(tourId, updates);
      return;
    }

    const payload: Record<string, any> = {};
    if (updates.status) {
      if (updates.status === 'confirmed') payload.confirmed = true;
      if (updates.status === 'completed') payload.outcome = 'completed';
      if (updates.status === 'no-show') payload.outcome = 'no_show';
      if (updates.status === 'cancelled') payload.outcome = 'cancelled';
    }
    if (typeof updates.remarks === 'string') payload.notes = updates.remarks;
    if (updates.outcome === 'draft') payload.notes = updates.remarks || 'draft';
    if (updates.outcome === 'follow-up') payload.notes = updates.remarks || 'follow-up';
    if (updates.outcome === 'rejected') payload.notes = updates.remarks || 'rejected';

    try {
      const res = await fetch(`/api/visits/${tourId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update visit');
      await qc.invalidateQueries({ queryKey: ['visits'] });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update tour');
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-lg md:text-xl font-semibold text-foreground">TCM Dashboard</h2>
        <p className="text-xs text-muted-foreground">Execution panel for confirmations and outcomes</p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <ToursMetricCard label="My Tours" value={myTours.length} tone="green" icon={<CalendarCheck className="h-4 w-4" />} />
        <ToursMetricCard label="Completed" value={completed} tone="green" icon={<TrendingUp className="h-4 w-4" />} />
        <ToursMetricCard label="Show-Up %" value={myTours.length ? `${Math.round((showUps / myTours.length) * 100)}%` : '0%'} tone={myTours.length && showUps / myTours.length >= 0.7 ? 'green' : 'red'} />
        <ToursMetricCard label="Drafts" value={drafts} tone="amber" icon={<FileText className="h-4 w-4" />} />
      </div>

      {upcoming.length > 0 && (
        <div className="kpi-card border-info/35 p-3 md:p-5">
          <div className="mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-info" />
            <h3 className="text-xs md:text-sm font-semibold text-info">Confirm Now</h3>
          </div>
          <div className="space-y-2">
            {upcoming.map((tour) => (
              <div key={tour.id} className="flex flex-col gap-2 rounded-lg bg-info/5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground">{tour.leadName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{tour.propertyName} - {tour.tourTime}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" className="h-8 text-xs" onClick={() => handleUpdateTour(tour.id, { status: 'confirmed' })}>Confirm</Button>
                  <button className="rounded-md bg-info/10 p-2 text-info" aria-label="Call lead">
                    <Phone className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {needsOutcome.length > 0 && (
        <div className="kpi-card border-warning/35 p-3 md:p-5">
          <div className="mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-warning" />
            <h3 className="text-xs md:text-sm font-semibold text-warning">Update Outcome</h3>
          </div>
          <div className="space-y-3">
            {needsOutcome.map((tour) => (
              <OutcomeRow key={tour.id} tour={tour} onUpdate={handleUpdateTour} />
            ))}
          </div>
        </div>
      )}

      <div className="kpi-card p-3 md:p-5">
        <h3 className="mb-3 text-xs md:text-sm font-semibold text-foreground">Full Schedule</h3>

        <div className="space-y-2 md:hidden">
          {todayTours.map((tour) => (
            <div key={tour.id} className="rounded-lg bg-secondary/35 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{tour.leadName}</span>
                <span className="text-xs text-muted-foreground">{tour.tourTime}</span>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">{tour.propertyName}</p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <ToursStatusBadge status={tour.status} />
                  {tour.showUp !== null ? <span>{tour.showUp ? 'YES' : 'NO'}</span> : null}
                  <ToursOutcomeBadge outcome={tour.outcome} />
                </div>
                <div className="flex gap-1">
                  {tour.status === 'scheduled' ? (
                    <Button size="sm" variant="ghost" onClick={() => handleUpdateTour(tour.id, { status: 'confirmed' })} className="h-7 px-2 text-[10px]">Confirm</Button>
                  ) : null}
                  {tour.status === 'confirmed' ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => handleUpdateTour(tour.id, { status: 'completed', showUp: true })} className="h-7 px-2 text-[10px] text-success">Show</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleUpdateTour(tour.id, { status: 'no-show', showUp: false })} className="h-7 px-2 text-[10px] text-destructive">No Show</Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {!isVisitsLoading && todayTours.length === 0 && (
            <p className="rounded-lg bg-secondary/20 p-3 text-center text-xs text-muted-foreground">No tours assigned to you yet.</p>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 text-left font-medium">Time</th>
                <th className="py-2 text-left font-medium">Lead</th>
                <th className="py-2 text-left font-medium">Property</th>
                <th className="py-2 text-left font-medium">Status</th>
                <th className="py-2 text-left font-medium">Show-Up</th>
                <th className="py-2 text-left font-medium">Outcome</th>
                <th className="py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {todayTours.map((tour) => (
                <tr key={tour.id} className="border-b border-border/60 hover:bg-secondary/20">
                  <td className="py-2 text-muted-foreground">{tour.tourTime}</td>
                  <td className="py-2 font-medium text-foreground">{tour.leadName}</td>
                  <td className="py-2 text-muted-foreground">{tour.propertyName}</td>
                  <td className="py-2"><ToursStatusBadge status={tour.status} /></td>
                  <td className="py-2">{tour.showUp === true ? 'YES' : tour.showUp === false ? 'NO' : '-'}</td>
                  <td className="py-2"><ToursOutcomeBadge outcome={tour.outcome} /></td>
                  <td className="py-2">
                    <div className="flex gap-1">
                      {tour.status === 'scheduled' ? (
                        <Button size="sm" variant="ghost" onClick={() => handleUpdateTour(tour.id, { status: 'confirmed' })} className="h-7 text-xs">Confirm</Button>
                      ) : null}
                      {tour.status === 'confirmed' ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => handleUpdateTour(tour.id, { status: 'completed', showUp: true })} className="h-7 text-xs text-success">Show</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleUpdateTour(tour.id, { status: 'no-show', showUp: false })} className="h-7 text-xs text-destructive">No Show</Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!isVisitsLoading && todayTours.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-muted-foreground">No tours assigned to you yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
