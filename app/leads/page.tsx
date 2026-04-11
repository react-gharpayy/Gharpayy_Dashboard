"use client";

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import EditLeadDialog from '@/components/EditLeadDialog';
import { useLeadsPaginated, useOfficeZones, usePipelineStages, useCreateVisit, useProperties, type LeadsQueryFilters } from '@/hooks/useCrmData';
import { useBulkUpdateLeads } from '@/hooks/useLeadDetails';
import { useUpdateLead, useAgents, type LeadWithRelations } from '@/hooks/useCrmData';
import { PIPELINE_STAGES, SOURCE_LABELS } from '@/types/crm';
import { Filter, Download, PhoneCall, MessageCircle, MoreVertical, MapPin, ChevronDown, ChevronUp, Check, Loader2, CalendarDays, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { T, QUALITY, GEO_TECH_PARKS, FDISPLAY } from '@/lib/leadGeoData';
import { parseMoveInV2, parseBudgetV2 } from '@/lib/leadParserV2';
import { ZonePill, BudgetChips, GeoIntelPanel } from '@/components/LeadUIAtoms';

// ─── helpers to map DB lead → card display ────────────────────────
function mapLeadMeta(lead: LeadWithRelations) {
  const meta = lead.parsedMetadata || {} as any;
  const zone = (lead as any).zone || meta.zone || '';
  const zones = zone ? [zone] : [];
  const techParks: string[] = meta.techParks || [];
  const moveInParsed = meta.moveInUrgency ? { urgency: meta.moveInUrgency, label: lead.moveInDate || meta.moveInRaw || '', urgencyDays: meta.moveInUrgencyDays ?? 999 } : (lead.moveInDate ? parseMoveInV2(lead.moveInDate) : null);
  const budgetRanges = meta.budgetRanges || (lead.budget ? parseBudgetV2(lead.budget).ranges : []);
  const areas: string[] = meta.areas || (lead.preferredLocation ? lead.preferredLocation.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
  const inBLR = meta.inBLR ?? null;
  const source = meta.sourceFormat || lead.source || '';
  const professionRaw = lead.profession || '';
  const type = professionRaw.includes('/') ? 'Student/Working' : professionRaw.charAt(0).toUpperCase() + professionRaw.slice(1);
  const room = (lead.roomType || '').charAt(0).toUpperCase() + (lead.roomType || '').slice(1);
  const need = (lead.needPreference || '').split(/\s*\/\s*/).map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' / ');
  const buildingName = meta.buildingName || '';
  const fullAddress = meta.fullAddress || '';

  return { zones, zone, techParks, moveInParsed, budgetRanges, areas, inBLR, source, type, room, need, buildingName, fullAddress, quality: meta.quality };
}

// ─── Quality badge colors ────────────────────────
const getQualityBadgeColor = (quality: string) => {
  switch (quality?.toLowerCase()) {
    case 'hot': return { bg: '#d4a574', color: '#1a1a1a' };
    case 'good':
    case 'warm': return { bg: '#8b7d6b', color: '#ffffff' };
    case 'bad':
    case 'cold': return { bg: '#a97c7c', color: '#ffffff' };
    default: return { bg: '#6b7280', color: '#ffffff' };
  }
};

// ─── Progress bar color ────────────────────────
const getProgressColor = (progress: number) => {
  if (progress >= 70) return '#22c55e';
  if (progress >= 50) return '#f97316';
  return '#ef4444';
};

// ─── Status badge config ────────────────────────
const statusBadgeConfig: Record<string, { bg: string; color: string; border: string }> = {
  new: { bg: 'rgba(96,165,250,0.1)', color: '#3b82f6', border: 'rgba(96,165,250,0.3)' },
  contacted: { bg: 'rgba(251,191,36,0.1)', color: '#d97706', border: 'rgba(251,191,36,0.3)' },
  qualified: { bg: 'rgba(52,211,153,0.1)', color: '#059669', border: 'rgba(52,211,153,0.3)' },
  requirement_collected: { bg: 'rgba(52,211,153,0.1)', color: '#059669', border: 'rgba(52,211,153,0.3)' },
  property_suggested: { bg: 'rgba(168,85,247,0.1)', color: '#9333ea', border: 'rgba(168,85,247,0.3)' },
  visit_scheduled: { bg: 'rgba(139,92,246,0.1)', color: '#7c3aed', border: 'rgba(139,92,246,0.3)' },
  visit_completed: { bg: 'rgba(168,85,247,0.1)', color: '#9333ea', border: 'rgba(168,85,247,0.3)' },
  negotiation: { bg: 'rgba(251,146,60,0.1)', color: '#ea580c', border: 'rgba(251,146,60,0.3)' },
  booked: { bg: 'rgba(34,197,94,0.1)', color: '#16a34a', border: 'rgba(34,197,94,0.3)' },
  lost: { bg: 'rgba(100,116,139,0.08)', color: '#64748b', border: 'rgba(100,116,139,0.25)' },
};

// ─── Compute a simple progress from lead fields ────────────────────────
function computeLeadProgress(lead: LeadWithRelations) {
  const fields = [lead.name, lead.phone, lead.email, lead.preferredLocation, lead.budget, lead.moveInDate, lead.profession, lead.roomType, lead.needPreference, lead.specialRequests];
  const totalFields = fields.length;
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / totalFields) * 100);
}

function computeFieldsMissing(lead: LeadWithRelations) {
  const fields = [lead.name, lead.phone, lead.email, lead.preferredLocation, lead.budget, lead.moveInDate, lead.profession, lead.roomType, lead.needPreference, lead.specialRequests];
  return fields.filter(f => !f).length;
}

function objectIdLike() {
  const seed = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return seed.padEnd(24, '0').slice(0, 24);
}

const Leads = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDuplicate, setFilterDuplicate] = useState<string>('all');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedLeadForEdit, setSelectedLeadForEdit] = useState<LeadWithRelations | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  const [filterDateMode, setFilterDateMode] = useState<'newest' | 'oldest' | 'alphabetical' | 'date' | 'month' | 'today' | 'date_range'>('newest');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [updatingStageLeadId, setUpdatingStageLeadId] = useState<string | null>(null);
  const [updatingStageTarget, setUpdatingStageTarget] = useState<{ leadId: string; stageKey: string } | null>(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleLeadId, setScheduleLeadId] = useState('');
  const [scheduleLeadName, setScheduleLeadName] = useState('');
  const [schedulePhone, setSchedulePhone] = useState('');
  const [schedulePropertyName, setSchedulePropertyName] = useState('');
  const [scheduleZoneId, setScheduleZoneId] = useState('');
  const [schedulePendingZoneName, setSchedulePendingZoneName] = useState('');
  const [scheduleTourDate, setScheduleTourDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduleTourTime, setScheduleTourTime] = useState('11:00');
  const [scheduleTourMode, setScheduleTourMode] = useState<'physical' | 'virtual'>('physical');
  const [scheduleAssignedTo, setScheduleAssignedTo] = useState('');
  const [scheduleAssignedSearch, setScheduleAssignedSearch] = useState('');
  const [showAssignedOptions, setShowAssignedOptions] = useState(false);
  const [scheduleBudget, setScheduleBudget] = useState('12000');
  const [isExporting, setIsExporting] = useState(false);

  const hasValidCustomRange = (() => {
    if (!fromDate || !toDate) return false;
    return new Date(fromDate) <= new Date(toDate);
  })();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchQuery(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const monthRange = (() => {
    if (!filterMonth) return null;
    const [yearStr, monthStr] = filterMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month) return null;
    const from = `${yearStr}-${monthStr}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const to = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
    return { from, to };
  })();

  const periodForDateFilter: 'all' | 'today' | 'custom' =
    filterDateMode === 'today'
      ? 'today'
      : (
          (filterDateMode === 'date' && !!filterDate) ||
          (filterDateMode === 'month' && !!monthRange) ||
          (filterDateMode === 'date_range' && hasValidCustomRange)
        )
          ? 'custom'
          : 'all';

  const fromForDateFilter =
    filterDateMode === 'date'
      ? (filterDate || undefined)
      : filterDateMode === 'month'
        ? (monthRange?.from || undefined)
        : filterDateMode === 'date_range' && hasValidCustomRange
          ? fromDate
          : undefined;

  const toForDateFilter =
    filterDateMode === 'date'
      ? (filterDate || undefined)
      : filterDateMode === 'month'
        ? (monthRange?.to || undefined)
        : filterDateMode === 'date_range' && hasValidCustomRange
          ? toDate
          : undefined;

  const serverFilters: LeadsQueryFilters = {
    q: debouncedSearchQuery.trim() || undefined,
    status: filterStatus,
    source: filterSource,
    zone: filterZone,
    duplicate: filterDuplicate as LeadsQueryFilters['duplicate'],
    sort: filterDateMode === 'oldest' ? 'oldest' : filterDateMode === 'alphabetical' ? 'alphabetical' : 'newest',
    period: periodForDateFilter,
    from: fromForDateFilter,
    to: toForDateFilter,
  };

  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, filterSource, filterStatus, filterDuplicate, filterZone, filterDateMode, filterDate, filterMonth, fromDate, toDate, hasValidCustomRange]);
  
  const PAGE_SIZE = 50;
  const { data: paginatedData, isLoading } = useLeadsPaginated(page, PAGE_SIZE, serverFilters);
  const leads = paginatedData?.leads;
  const totalLeads = paginatedData?.total ?? 0;
  const totalPages = Math.ceil(totalLeads / PAGE_SIZE);
  const subtitleCount = `${totalLeads} leads found`;
  const { data: members } = useAgents();
  const { data: officeZones } = useOfficeZones();
  const { data: properties } = useProperties();
  const { data: pipelineStagesData } = usePipelineStages();
  const pipelineStages = (pipelineStagesData && pipelineStagesData.length > 0)
    ? pipelineStagesData
    : PIPELINE_STAGES.map((s, i) => ({ ...s, order: i }));
  const bulkUpdate = useBulkUpdateLeads();
  const updateLead = useUpdateLead();
  const createVisit = useCreateVisit();
  const { user } = useAuth();
  const canManageLeadAssignments = ['super_admin', 'manager', 'admin', 'member'].includes(user?.role || '');
  const canAddLead = ['super_admin', 'manager', 'admin', 'member'].includes(user?.role || '');

  useEffect(() => {
    if (!scheduleAssignedTo) return;
    const selected = (members || []).find((m: any) => String(m.id || m._id || '') === scheduleAssignedTo) as any;
    if (selected) {
      setScheduleAssignedSearch(String(selected.name || selected.fullName || ''));
    }
  }, [scheduleAssignedTo, members]);

  useEffect(() => {
    if (!schedulePendingZoneName || !officeZones || officeZones.length === 0) return;
    const zone = officeZones.find((z: any) => String(z.name || '').toLowerCase() === schedulePendingZoneName.toLowerCase());
    if (zone) {
      setScheduleZoneId(String(zone._id || zone.id || ''));
      setSchedulePendingZoneName('');
    }
  }, [schedulePendingZoneName, officeZones]);

  const filtered = (leads || [])
    .filter(l => {
      if (debouncedSearchQuery) {
        const q = debouncedSearchQuery.toLowerCase();
        const shortId = `l-${l.id.slice(-6).toLowerCase()}`;
        if (
          !l.name.toLowerCase().includes(q) &&
          (!l.phone || !l.phone.includes(q)) &&
          !shortId.includes(q)
        ) {
          return false;
        }
      }
      if (filterSource !== 'all' && l.source !== filterSource) return false;
      if (filterStatus !== 'all' && l.status !== filterStatus) return false;
      if (filterDuplicate === 'duplicate' && !l.isDuplicate) return false;
      if (filterDuplicate === 'unique' && l.isDuplicate) return false;
      if (filterZone !== 'all' && (l as any).zone !== filterZone) return false;
      
      return true;
    });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const handleBulkAssign = async (agentId: string) => {
    if (selectedIds.size === 0) return;
    try {
      await bulkUpdate.mutateAsync({ ids: Array.from(selectedIds), updates: { assigned_member_id: agentId } });
      toast.success(`${selectedIds.size} leads reassigned`);
      setSelectedIds(new Set());
    } catch (err: any) { toast.error(err.message); }
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedIds.size === 0) return;
    try {
      await bulkUpdate.mutateAsync({ ids: Array.from(selectedIds), updates: { status: status as any } });
      toast.success(`${selectedIds.size} leads updated`);
      setSelectedIds(new Set());
    } catch (err: any) { toast.error(err.message); }
  };

  const handleInlineStageChange = async (lead: LeadWithRelations, stageKey: string, stageLabel: string) => {
    if (updatingStageLeadId || lead.status === stageKey) return;
    try {
      setUpdatingStageLeadId(lead.id);
      setUpdatingStageTarget({ leadId: lead.id, stageKey });
      await updateLead.mutateAsync({ id: lead.id, status: stageKey as any });
      toast.success(`Lead moved to ${stageLabel}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update lead stage');
    } finally {
      setUpdatingStageLeadId(null);
      setUpdatingStageTarget(null);
    }
  };

  const buildLeadExportParams = (skip: number, limit: number) => {
    const params = new URLSearchParams();
    params.set('skip', String(skip));
    params.set('limit', String(limit));

    if (serverFilters.q) params.set('q', serverFilters.q);
    if (serverFilters.status && serverFilters.status !== 'all') params.set('status', serverFilters.status);
    if (serverFilters.source && serverFilters.source !== 'all') params.set('source', serverFilters.source);
    if (serverFilters.zone && serverFilters.zone !== 'all') params.set('zone', serverFilters.zone);
    if (serverFilters.duplicate && serverFilters.duplicate !== 'all') params.set('duplicate', serverFilters.duplicate);
    if (serverFilters.sort) params.set('sort', serverFilters.sort);
    if (serverFilters.period && serverFilters.period !== 'all') params.set('period', serverFilters.period);
    if (serverFilters.from) params.set('from', serverFilters.from);
    if (serverFilters.to) params.set('to', serverFilters.to);

    return params;
  };

  const escapeCsvCell = (value: unknown) => {
    const raw = value == null ? '' : String(value);
    const escaped = raw.replace(/"/g, '""');
    return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
  };

  const fetchAllLeadsForExport = async () => {
    const pageSize = 100;
    let skip = 0;
    let total = Number.POSITIVE_INFINITY;
    const allLeads: LeadWithRelations[] = [];

    while (skip < total) {
      const params = buildLeadExportParams(skip, pageSize);
      const res = await fetch(`/api/leads?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch all leads for export');

      const data = await res.json() as { leads?: LeadWithRelations[]; total?: number };
      const batch = data.leads || [];
      allLeads.push(...batch);

      if (typeof data.total === 'number') total = data.total;
      if (batch.length === 0 || batch.length < pageSize) break;
      skip += batch.length;
    }

    return allLeads;
  };

  const handleExport = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);

      const allLeads = await fetchAllLeadsForExport();
      if (allLeads.length === 0) {
        toast.info('No leads found to export');
        return;
      }

      const csv = [
        ['Name', 'Phone', 'Email', 'Source', 'Status', 'Member', 'Location', 'Budget', 'Score'].join(','),
        ...allLeads.map((l) => [
          l.name,
          l.phone,
          l.email || '',
          l.source,
          l.status,
          l.members?.name || '',
          l.preferredLocation || '',
          l.budget || '',
          l.leadScore ?? 0,
        ].map(escapeCsvCell).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${allLeads.length} leads`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export leads');
    } finally {
      setIsExporting(false);
    }
  };

  const openScheduleFromLead = (lead: LeadWithRelations, zoneName: string) => {
    setScheduleLeadId(lead.id);
    setScheduleLeadName(lead.name || '');
    setSchedulePhone(lead.phone || '');
    setSchedulePropertyName('');
    setScheduleTourDate(new Date().toISOString().split('T')[0]);
    setScheduleTourTime('11:00');
    setScheduleTourMode('physical');
    setScheduleAssignedTo('');
    setScheduleAssignedSearch('');
    setShowAssignedOptions(false);
    setScheduleBudget('12000');

    const matchedZone = (officeZones || []).find((z: any) => String(z.name || '').toLowerCase() === String(zoneName || '').toLowerCase());
    if (matchedZone) {
      setScheduleZoneId(String(matchedZone._id || matchedZone.id || ''));
      setSchedulePendingZoneName('');
    } else {
      setScheduleZoneId(String((officeZones || [])[0]?._id || (officeZones || [])[0]?.id || ''));
      setSchedulePendingZoneName(String(zoneName || ''));
    }

    setScheduleOpen(true);
  };

  const handleScheduleTourFromLead = async () => {
    if (!scheduleLeadId || !schedulePropertyName.trim() || !scheduleZoneId || !scheduleTourDate || !scheduleTourTime || !scheduleAssignedTo) {
      toast.error('Please fill all required fields');
      return;
    }

    const assignedMember = (members || []).find((m: any) => String(m.id || m._id || '') === scheduleAssignedTo) as any;
    const zone = (officeZones || []).find((z: any) => String(z._id || z.id || '') === scheduleZoneId) as any;
    if (!assignedMember || !zone) {
      toast.error('Invalid zone or assigned TCM member');
      return;
    }

    const selectedLeadAny = (leads || []).find((l: any) => String(l.id || l._id) === scheduleLeadId) as any;
    const fallbackPropertyId =
      String((properties || [])[0]?.id || (properties || [])[0]?._id || '') ||
      String(selectedLeadAny?.properties?.id || selectedLeadAny?.properties?._id || '') ||
      String(selectedLeadAny?.propertyId || '') ||
      objectIdLike();

    try {
      const scheduledAt = new Date(`${scheduleTourDate}T${scheduleTourTime}:00`);
      await createVisit.mutateAsync({
        leadId: scheduleLeadId,
        propertyId: fallbackPropertyId,
        assignedStaffId: String(assignedMember.id || assignedMember._id || ''),
        scheduledAt: scheduledAt.toISOString(),
        lead_id: scheduleLeadId,
        property_id: fallbackPropertyId,
        assigned_staff_id: String(assignedMember.id || assignedMember._id || ''),
        scheduled_at: scheduledAt.toISOString(),
        notes: `tour_mode:${scheduleTourMode}; zone:${zone.name}; budget:${Number(scheduleBudget) || 0}; scheduled_by:${user?.fullName || user?.username || 'system'}; scheduled_by_id:${String(user?.id || '')}; assigned_to:${assignedMember.name || assignedMember.fullName || ''}; assigned_to_id:${String(assignedMember.id || assignedMember._id || '')}; typed_property:${schedulePropertyName.trim()}`,
        phone: schedulePhone,
      });

      toast.success('Tour scheduled successfully');
      setScheduleOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to schedule tour');
    }
  };

  const memberOptions = (members || [])
    .map((member: any) => ({
      id: String(member.id || member._id || ''),
      name: String(member.name || member.fullName || '').trim(),
    }))
    .filter((member: { id: string; name: string }) => member.id && member.name);

  const filteredMemberOptions = (() => {
    const q = scheduleAssignedSearch.trim().toLowerCase();
    if (!q) return memberOptions.slice(0, 12);
    return memberOptions.filter((member) => member.name.toLowerCase().includes(q)).slice(0, 20);
  })();

  const handleAssignedSearchChange = (nextValue: string) => {
    setScheduleAssignedSearch(nextValue);
    const matched = memberOptions.find((member) => member.name.toLowerCase() === nextValue.trim().toLowerCase());
    setScheduleAssignedTo(matched?.id || '');
    setShowAssignedOptions(true);
  };

  const handleAssignedSelect = (member: { id: string; name: string }) => {
    setScheduleAssignedTo(member.id);
    setScheduleAssignedSearch(member.name);
    setShowAssignedOptions(false);
  };

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const openLeadIntakeInNewTab = () => {
    window.open('/leads/intake', '_blank', 'noopener,noreferrer');
  };

  if (isLoading) {
    return (
      <AppLayout title="All Leads" subtitle="Loading...">
        <Skeleton className="h-[500px] rounded-2xl" />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="All Leads"
      subtitle={subtitleCount}
      showQuickAddLead={false}
      actions={(
        <Button
          size="sm"
          className="gap-1.5 text-xs"
          disabled={!canAddLead}
          title={!canAddLead ? 'Only Super Admins, managers, admins, and members can add leads' : 'Open Lead Intake in a new tab'}
          onClick={openLeadIntakeInNewTab}
        >
          <Plus size={13} /> Add Lead
        </Button>
      )}
    >
      {/* Filters Area */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setShowFiltersMobile(!showFiltersMobile)} className="ml-1.5 md:ml-0 gap-1.5 h-7 text-[11px] rounded-xl md:hidden">
            <Filter size={14} /> Filters
            {(!showFiltersMobile && (filterSource !== 'all' || filterStatus !== 'all' || filterDuplicate !== 'all' || filterZone !== 'all' || filterDateMode !== 'newest' || fromDate || toDate)) && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
          </Button>

          {/* Desktop Filters */}
          <div className="hidden md:flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <Input 
              placeholder="Search Name, Phone, ID..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-7 text-[10px] rounded-xl w-40 bg-card border-border"
            />
            <Filter size={12} className="text-muted-foreground shrink-0" />
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="shrink-0 h-7 text-[10px] rounded-xl w-auto min-w-[96px] bg-card border-border px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Sources</SelectItem>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="shrink-0 h-7 text-[10px] rounded-xl w-auto min-w-[96px] bg-card border-border px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Stages</SelectItem>
                {pipelineStages.map((s: any) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDuplicate} onValueChange={setFilterDuplicate}>
              <SelectTrigger className="shrink-0 h-7 text-[10px] rounded-xl w-auto min-w-[96px] bg-card border-border px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="unique">Unique Only</SelectItem>
                <SelectItem value="duplicate">Duplicates Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterZone} onValueChange={setFilterZone}>
              <SelectTrigger className="shrink-0 h-7 text-[10px] rounded-xl w-auto min-w-[88px] bg-card border-border px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Zones</SelectItem>
                {officeZones?.map(z => <SelectItem key={z._id} value={z.name}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterDateMode} onValueChange={(v) => { setFilterDateMode(v as any); setFilterDate(''); setFilterMonth(''); setFromDate(''); setToDate(''); }}>
              <SelectTrigger className="shrink-0 h-7 text-[10px] rounded-xl w-auto min-w-[96px] bg-card border-border px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="alphabetical">Alphabetical (A-Z)</SelectItem>
                <SelectItem value="date">By Date</SelectItem>
                <SelectItem value="month">By Month</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="date_range">Date Range</SelectItem>
              </SelectContent>
            </Select>

            {filterDateMode === 'date_range' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={(fromDate && toDate) ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-[10px] rounded-xl gap-1"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span className="max-w-[105px] truncate">
                      {fromDate && toDate ? `${fromDate} to ${toDate}` : 'Date Range'}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[245px] p-3">
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">From</p>
                      <Input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="h-8 text-[11px]"
                        aria-label="From date"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">To</p>
                      <Input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="h-8 text-[11px]"
                        aria-label="To date"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            
            {filterDateMode === 'date' && (
              <input 
                type="date" 
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="shrink-0 text-[10px] bg-card border border-border rounded-xl px-2 py-1.5 text-foreground outline-none focus:ring-2 focus:ring-ring/30"
              />
            )}
            
            {filterDateMode === 'month' && (
              <input 
                type="month" 
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="shrink-0 text-[10px] bg-card border border-border rounded-xl px-2 py-1.5 text-foreground outline-none focus:ring-2 focus:ring-ring/30"
              />
            )}
          </div>

          <Button variant="outline" size="sm" className="mr-1.5 md:mr-0 h-7 md:h-7 gap-1 text-[11px] md:text-[10px] rounded-lg md:rounded-xl px-2 ml-auto shrink-0" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 size={13} className="md:w-3 md:h-3 animate-spin" /> : <Download size={13} className="md:w-3 md:h-3" />} <span className="hidden sm:inline">Export</span>
          </Button>
        </div>

        {/* Mobile Filters Expanded */}
        {showFiltersMobile && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="flex md:hidden flex-col gap-2 p-3 bg-secondary/30 rounded-xl border border-border">
            <Input 
              placeholder="Search Name, Phone, ID..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-7 text-[10px] rounded-lg w-full bg-card border-border"
            />
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-full h-8 text-[10px] rounded-lg bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Sources</SelectItem>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full h-8 text-[10px] rounded-lg bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Stages</SelectItem>
                {pipelineStages.map((s: any) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDuplicate} onValueChange={setFilterDuplicate}>
              <SelectTrigger className="w-full h-8 text-[10px] rounded-lg bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="unique">Unique Only</SelectItem>
                <SelectItem value="duplicate">Duplicates Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterZone} onValueChange={setFilterZone}>
              <SelectTrigger className="w-full h-8 text-[10px] rounded-lg bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Zones</SelectItem>
                {officeZones?.map(z => <SelectItem key={z._id} value={z.name}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDateMode} onValueChange={(v) => { setFilterDateMode(v as any); setFilterDate(''); setFilterMonth(''); setFromDate(''); setToDate(''); }}>
              <SelectTrigger className="w-full h-8 text-[10px] rounded-lg bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="alphabetical">Alphabetical (A-Z)</SelectItem>
                <SelectItem value="date">By Date</SelectItem>
                <SelectItem value="month">By Month</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="date_range">Date Range</SelectItem>
              </SelectContent>
            </Select>
            {filterDateMode === 'date_range' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={(fromDate && toDate) ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-[10px] rounded-lg justify-start gap-1.5"
                  >
                    <CalendarDays className="h-4 w-4" />
                    <span className="truncate">{fromDate && toDate ? `${fromDate} to ${toDate}` : 'Date Range'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[260px] p-3">
                  <div className="space-y-2">
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="h-8 text-[10px]"
                      aria-label="From date"
                    />
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="h-8 text-[10px]"
                      aria-label="To date"
                    />
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {filterDateMode === 'date_range' && fromDate && toDate && !hasValidCustomRange && (
              <p className="text-[10px] text-muted-foreground">Invalid range: From date should be before To date</p>
            )}
            {filterDateMode === 'date' && (
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                className="w-full text-[10px] bg-card border border-border rounded-lg px-2.5 py-1.5 text-foreground outline-none" />
            )}
            {filterDateMode === 'month' && (
              <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                className="w-full text-[10px] bg-card border border-border rounded-lg px-2.5 py-1.5 text-foreground outline-none" />
            )}
          </motion.div>
        )}
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && canManageLeadAssignments && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-4 p-4 bg-accent/5 border border-accent/15 rounded-2xl flex-wrap"
        >
          <span className="text-2xs font-medium text-foreground">{selectedIds.size} selected</span>
          <Select onValueChange={handleBulkAssign}>
            <SelectTrigger className="h-7 w-[140px] text-2xs rounded-lg"><SelectValue placeholder="Assign to..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {members?.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select onValueChange={handleBulkStatus}>
            <SelectTrigger className="h-7 w-[140px] text-2xs rounded-lg"><SelectValue placeholder="Change status..." /></SelectTrigger>
            <SelectContent>{pipelineStages.map((s: any) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <button onClick={() => setSelectedIds(new Set())} className="text-2xs text-muted-foreground hover:text-foreground ml-auto transition-colors">
            Clear
          </button>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  LEAD CARDS — NEW UI                                       */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <style>{`
        :root {
          --lc-bg0: #ffffff; --lc-bg1: #f8f9fc; --lc-bg2: #f1f3f8; --lc-bg3: #e8ebf2;
          --lc-line: #e2e5ee; --lc-line2: #d4d8e3;
          --lc-dim: #8c92a8; --lc-mid: #636b83; --lc-text: #2d3248; --lc-hi: #1a1e30;
          --lc-acc: #6c5ce7; --lc-acc2: #4a90e2;
          --lc-bgrow: rgba(0,0,0,0.015); --lc-bglabel: rgba(0,0,0,0.03);
          --lc-accent-bg: rgba(108,92,231,0.05);
          --lc-mono: 'DM Mono','IBM Plex Mono',monospace;
          --lc-sans: 'DM Sans',sans-serif;
        }
        .dark {
          --lc-bg0: #141419; --lc-bg1: #1c1c24; --lc-bg2: #24242e; --lc-bg3: #2e2e3a;
          --lc-line: #2e2e3a; --lc-line2: #3a3a48;
          --lc-dim: #6b6b80; --lc-mid: #9090a8; --lc-text: #c8c8d8; --lc-hi: #e8e8f0;
          --lc-acc: #8b7cf8; --lc-acc2: #6aa0f2;
          --lc-bgrow: rgba(255,255,255,0.02); --lc-bglabel: rgba(255,255,255,0.03);
          --lc-accent-bg: rgba(139,124,248,0.08);
        }
        @media (max-width: 640px) {
          .lc-avatar { display: none !important; }
          .lc-card { padding: 8px 10px !important; }
          .lc-expand-grid { grid-template-columns: 1fr 1fr !important; }
          .lc-card .lc-name { font-size: 11px !important; }
          .lc-card .lc-phone { font-size: 9px !important; }
          .lc-card .lc-meta { font-size: 8.5px !important; }
          .lc-card .lc-chip { font-size: 8px !important; padding: 1px 5px !important; }
          .lc-card .lc-stage { font-size: 8px !important; padding: 1px 6px !important; }
          .lc-card .lc-progress-pct { font-size: 8px !important; min-width: 16px !important; }
          .lc-card .lc-actions-row { gap: 3px !important; }
          .lc-card .lc-actions-row button,
          .lc-card .lc-actions-row a { padding: 4px !important; }
          .lc-card .lc-timestamp { font-size: 8px !important; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(lead => {
          const m = mapLeadMeta(lead);
          const isExpanded = expandedId === lead.id;
          const isDuplicateLead = !!lead.isDuplicate;
          const sBadge = statusBadgeConfig[lead.status] || statusBadgeConfig.new;
          const stageLabel = pipelineStages.find((s: any) => s.key === lead.status)?.label || lead.status;
          const hue = lead.name ? lead.name.charCodeAt(0) * 7 % 360 : 200;
          const progress = computeLeadProgress(lead);
          const fieldsMissing = computeFieldsMissing(lead);
          const progressColor = getProgressColor(progress);
          const qualityBadge = getQualityBadgeColor(m.quality || '');
          const createdAtStamp = new Date(lead.createdAt).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });

          // Budget display for collapsed card
          const budgetDisplay = m.budgetRanges?.length > 0
            ? m.budgetRanges.map((r: any) => r.display).join(', ')
            : lead.budget || '';

          if (!isExpanded) {
            // ─── COLLAPSED CARD ───
            return (
              <div
                key={lead.id}
                className="lc-card"
                onClick={() => setExpandedId(lead.id)}
                style={{
                  background: isDuplicateLead ? 'rgba(251,113,133,0.045)' : 'var(--lc-bg1)',
                  border: isDuplicateLead ? '1px solid rgba(251,113,133,0.28)' : '1px solid var(--lc-line)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = isDuplicateLead ? 'rgba(251,113,133,0.45)' : 'var(--lc-line2)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = isDuplicateLead ? 'rgba(251,113,133,0.28)' : 'var(--lc-line)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {/* Checkbox */}
                  {canManageLeadAssignments && (
                    <div onClick={e => e.stopPropagation()} style={{ paddingTop: 6, flexShrink: 0 }}>
                      <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                    </div>
                  )}

                  {/* Avatar */}
                  <div className="lc-avatar" style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: `hsl(${hue},30%,92%)`,
                    border: `2px solid hsl(${hue},34%,84%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: `hsl(${hue},38%,42%)`,
                    fontFamily: 'var(--lc-sans)',
                  }}>
                    {(lead.name || '?')[0]?.toUpperCase()}
                  </div>

                  {/* Lead Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Row 1: Name + Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px 8px', flexWrap: 'wrap', paddingBottom: 4 }}>
                      <h3 className="lc-name" style={{ fontSize: 13, fontWeight: 700, color: 'var(--lc-hi)', margin: 0, fontFamily: 'var(--lc-sans)', paddingRight: 2 }}>{lead.name}</h3>
                      
                      {m.need && (
                        <>
                          <span style={{ color: 'var(--lc-line2)' }}>|</span>
                          <span className="lc-meta" style={{ fontSize: 10.5, color: 'var(--lc-mid)', fontWeight: 600 }}>{m.need}</span>
                        </>
                      )}

                      {m.quality && (
                        <>
                          <span style={{ color: 'var(--lc-line2)' }}>|</span>
                          <span className="lc-chip" style={{
                            padding: '1px 8px', borderRadius: 10, fontSize: 9.5, fontWeight: 600,
                            background: qualityBadge.bg, color: qualityBadge.color,
                          }}>
                            {m.quality.charAt(0).toUpperCase() + m.quality.slice(1)}
                          </span>
                        </>
                      )}
                      
                      {m.zones.length > 0 && <span style={{ color: 'var(--lc-line2)' }}>|</span>}
                      {m.zones.map((z: string) => <ZonePill key={z} zoneName={z} xs />)}

                      <span style={{ color: 'var(--lc-line2)' }}>|</span>
                      <span className="lc-stage" style={{
                        padding: '1px 8px', borderRadius: 10, fontSize: 9.5, fontWeight: 600,
                        background: sBadge.bg, color: sBadge.color, border: `1px solid ${sBadge.border}`,
                      }}>
                        {stageLabel}
                      </span>
                    </div>

                    {/* Row 2: Phone + Budget + Extended Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px 8px', flexWrap: 'wrap' }}>
                      <span className="lc-phone" style={{ fontSize: 11, color: 'var(--lc-mid)', fontFamily: 'var(--lc-mono)', fontWeight: 600 }}>{lead.phone}</span>

                      {budgetDisplay && (
                        <>
                          <span style={{ color: 'var(--lc-line2)' }}>|</span>
                          <span className="lc-chip" style={{
                            fontSize: 10, padding: '1px 7px',
                            background: 'var(--lc-bg2)', borderRadius: 4, color: 'var(--lc-mid)',
                            fontFamily: 'var(--lc-mono)', fontWeight: 500,
                          }}>
                            {budgetDisplay}
                          </span>
                        </>
                      )}

                      {m.inBLR !== null && (
                        <>
                          <span style={{ color: 'var(--lc-line2)' }}>|</span>
                          <span className="lc-meta" style={{ fontSize: 10, color: m.inBLR ? 'var(--lc-mid)' : 'var(--lc-dim)', fontWeight: 500 }}>
                            {m.inBLR ? 'IN BLR' : 'NOT IN BLR'}
                          </span>
                        </>
                      )}

                      {lead.moveInDate && (
                        <>
                          <span style={{ color: 'var(--lc-line2)' }}>|</span>
                          <span className="lc-meta" style={{ fontSize: 10, color: 'var(--lc-mid)', fontWeight: 500 }}>
                            {lead.moveInDate}
                          </span>
                        </>
                      )}

                      {lead.preferredLocation && (
                        <>
                          <span style={{ color: 'var(--lc-line2)' }}>|</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MapPin size={9} color="var(--lc-dim)" />
                            <span className="lc-meta" style={{ fontSize: 10, color: 'var(--lc-dim)', fontWeight: 500 }}>{lead.preferredLocation}</span>
                          </div>
                        </>
                      )}

                      {fieldsMissing > 0 && (
                        <>
                          <span style={{ color: 'var(--lc-line2)' }}>|</span>
                          <div style={{
                            display: 'inline-block',
                            padding: '1px 6px', borderRadius: 4,
                            background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                            fontSize: 9.5, fontWeight: 600,
                          }}>
                            {fieldsMissing} missing
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quick actions on collapsed */}
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, paddingTop: 2, alignItems: 'flex-end' }}>

                    {/* Keep progress bar on the top row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, width: '100%', flexWrap: 'wrap' }}>
                      <div style={{ width: 40, height: 4, background: 'var(--lc-bg3)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: progressColor, borderRadius: 2, transition: 'width 0.3s ease' }} />
                      </div>
                      <span className="lc-progress-pct" style={{ fontSize: 8.5, fontWeight: 700, color: progressColor, fontFamily: 'var(--lc-mono)', textAlign: 'right', minWidth: 18 }}>{progress}%</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openScheduleFromLead(lead, m.zone || ''); }}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--lc-line)] bg-[var(--lc-bg2)] px-1.5 py-0.5 text-[8.5px] font-semibold text-[var(--lc-mid)] hover:bg-[var(--lc-bg3)]"
                        title="Tour"
                      >
                        <CalendarDays size={9} />
                        Tour
                      </button>
                      <a href={`tel:${lead.phone}`} style={{ padding: 4, borderRadius: 5, background: 'var(--lc-bg2)', border: '1px solid var(--lc-line)', display: 'flex' }} title="Call">
                        <PhoneCall size={10} color="var(--lc-mid)" />
                      </a>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setExpandedId(lead.id); }} 
                        style={{ padding: 4, borderRadius: 5, background: 'var(--lc-bg2)', border: '1px solid var(--lc-line)', display: 'flex', cursor: 'pointer' }} 
                        title="Expand"
                      >
                        <ChevronDown size={10} color="var(--lc-mid)" />
                      </button>
                    </div>

                    {/* Lower row: WhatsApp, more options, and timestamp */}
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
                      <span className="lc-timestamp" style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--lc-dim)', fontFamily: 'var(--lc-mono)', whiteSpace: 'nowrap' }}>
                        {createdAtStamp}
                      </span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`); toast.success('WhatsApp link copied!'); }}
                        style={{ padding: 4, borderRadius: 5, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', cursor: 'pointer' }} 
                        title="Copy WhatsApp API"
                      >
                        <MessageCircle size={10} color="#22c55e" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button style={{ padding: 4, borderRadius: 5, background: 'var(--lc-bg2)', border: '1px solid var(--lc-line)', display: 'flex', cursor: 'pointer' }} title="More options">
                            <MoreVertical size={10} color="var(--lc-mid)" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedLeadForEdit(lead); setEditDialogOpen(true); }}>
                            Edit Lead
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="font-mono text-[10px] text-muted-foreground cursor-pointer"
                            onSelect={() => {
                              navigator.clipboard.writeText(`L-${lead.id.slice(-6).toUpperCase()}`);
                              toast.success('Lead ID copied!');
                            }}
                          >
                            L-{lead.id.slice(-6).toUpperCase()}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // ─── EXPANDED CARD ───
          const currentStageIndex = pipelineStages.findIndex((s: any) => s.key === lead.status);
          const stageIdx = currentStageIndex !== -1 ? currentStageIndex : 0;

          // Theme object using CSS vars (respects dark mode)
          const D = {
            bg1: 'var(--lc-bg1)',
            bg2: 'var(--lc-bg2)',
            bgRow: 'var(--lc-bgrow)',
            bgLabel: 'var(--lc-bglabel)',
            line: 'var(--lc-line)',
            line2: 'var(--lc-line2)',
            hi: 'var(--lc-hi)',
            text: 'var(--lc-text)',
            mid: 'var(--lc-mid)',
            dim: 'var(--lc-dim)',
            acc: 'var(--lc-acc)',
            accentBg: 'var(--lc-accent-bg)',
          };

          return (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0.9 }}
              animate={{ opacity: 1 }}
              style={{
                background: isDuplicateLead ? 'rgba(251,113,133,0.055)' : 'var(--lc-bg1)',
                borderRadius: 14,
                border: isDuplicateLead ? '2px solid rgba(251,113,133,0.4)' : `2px solid var(--lc-acc)`,
                overflow: 'hidden',
              }}
            >
              {/* ─── Expanded Header ─── */}
              <div style={{ padding: '14px 16px 10px', cursor: 'pointer' }} onClick={() => setExpandedId(null)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                    {/* Checkbox */}
                    {canManageLeadAssignments && (
                      <div onClick={e => e.stopPropagation()} style={{ paddingTop: 6, flexShrink: 0 }}>
                        <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                      </div>
                    )}

                    {/* Avatar */}
                    <div className="lc-avatar" style={{
                      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                      background: `hsl(${hue},30%,92%)`,
                      border: `2px solid hsl(${hue},34%,84%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, color: `hsl(${hue},38%,42%)`,
                      fontFamily: 'var(--lc-sans)',
                    }}>
                      {(lead.name || '?')[0]?.toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Row 1: Name + Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px 8px', flexWrap: 'wrap', paddingBottom: 4 }}>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--lc-hi)', margin: 0, fontFamily: 'var(--lc-sans)', paddingRight: 2 }}>{lead.name}</h3>
                        
                        {m.need && (
                          <>
                            <span style={{ color: 'var(--lc-line2)' }}>|</span>
                            <span style={{ fontSize: 10.5, color: 'var(--lc-mid)', fontWeight: 600 }}>{m.need}</span>
                          </>
                        )}

                        {m.quality && (
                          <>
                            <span style={{ color: 'var(--lc-line2)' }}>|</span>
                            <span style={{
                              padding: '1px 8px', borderRadius: 10, fontSize: 9.5, fontWeight: 600,
                              background: qualityBadge.bg, color: qualityBadge.color,
                            }}>
                              {m.quality.charAt(0).toUpperCase() + m.quality.slice(1)}
                            </span>
                          </>
                        )}
                        
                        {m.zones.length > 0 && <span style={{ color: 'var(--lc-line2)' }}>|</span>}
                        {m.zones.map((z: string) => <ZonePill key={z} zoneName={z} xs />)}

                        <span style={{ color: 'var(--lc-line2)' }}>|</span>
                        <span style={{
                          padding: '1px 8px', borderRadius: 10, fontSize: 9.5, fontWeight: 600,
                          background: sBadge.bg, color: sBadge.color, border: `1px solid ${sBadge.border}`,
                        }}>
                          {stageLabel}
                        </span>
                      </div>

                      {/* Row 2: Phone + Budget + Extended Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px 8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'var(--lc-mid)', fontFamily: 'var(--lc-mono)', fontWeight: 600 }}>{lead.phone}</span>

                        {budgetDisplay && (
                          <>
                            <span style={{ color: 'var(--lc-line2)' }}>|</span>
                            <span style={{
                              fontSize: 10, padding: '1px 7px',
                              background: 'var(--lc-bg2)', borderRadius: 4, color: 'var(--lc-mid)',
                              fontFamily: 'var(--lc-mono)', fontWeight: 500,
                            }}>
                              {budgetDisplay}
                            </span>
                          </>
                        )}

                        {m.inBLR !== null && (
                          <>
                            <span style={{ color: 'var(--lc-line2)' }}>|</span>
                            <span style={{ fontSize: 10, color: m.inBLR ? 'var(--lc-mid)' : 'var(--lc-dim)', fontWeight: 500 }}>
                              {m.inBLR ? 'IN BLR' : 'NOT IN BLR'}
                            </span>
                          </>
                        )}

                        {lead.moveInDate && (
                          <>
                            <span style={{ color: 'var(--lc-line2)' }}>|</span>
                            <span style={{ fontSize: 10, color: 'var(--lc-mid)', fontWeight: 500 }}>
                              {lead.moveInDate}
                            </span>
                          </>
                        )}

                        {lead.preferredLocation && (
                          <>
                            <span style={{ color: 'var(--lc-line2)' }}>|</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <MapPin size={9} color="var(--lc-dim)" />
                              <span style={{ fontSize: 10, color: 'var(--lc-dim)', fontWeight: 500 }}>{lead.preferredLocation}</span>
                            </div>
                          </>
                        )}

                        {fieldsMissing > 0 && (
                          <>
                            <span style={{ color: 'var(--lc-line2)' }}>|</span>
                            <div style={{
                              display: 'inline-block',
                              padding: '1px 6px', borderRadius: 4,
                              background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                              fontSize: 9.5, fontWeight: 600,
                            }}>
                              {fieldsMissing} missing
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side — same compact layout as collapsed */}
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, paddingTop: 2, alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, width: '100%', flexWrap: 'wrap' }}>
                      <div style={{ width: 40, height: 4, background: 'var(--lc-bg3)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: progressColor, borderRadius: 2, transition: 'width 0.3s ease' }} />
                      </div>
                      <span className="lc-progress-pct" style={{ fontSize: 8.5, fontWeight: 700, color: progressColor, fontFamily: 'var(--lc-mono)', textAlign: 'right', minWidth: 18 }}>{progress}%</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openScheduleFromLead(lead, m.zone || ''); }}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--lc-line)] bg-[var(--lc-bg2)] px-1.5 py-0.5 text-[8.5px] font-semibold text-[var(--lc-mid)] hover:bg-[var(--lc-bg3)]"
                        title="Tour"
                      >
                        <CalendarDays size={9} />
                        Tour
                      </button>
                      <a href={`tel:${lead.phone}`} style={{ padding: 4, borderRadius: 5, background: 'var(--lc-bg2)', border: '1px solid var(--lc-line)', display: 'flex' }} title="Call">
                        <PhoneCall size={10} color="var(--lc-mid)" />
                      </a>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setExpandedId(''); }} 
                        style={{ padding: 4, borderRadius: 5, background: 'var(--lc-bg2)', border: '1px solid var(--lc-line)', display: 'flex', cursor: 'pointer' }} 
                        title="Collapse"
                      >
                        <ChevronUp size={10} color="var(--lc-mid)" />
                      </button>
                    </div>

                    <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
                      <span className="lc-timestamp" style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--lc-dim)', fontFamily: 'var(--lc-mono)', whiteSpace: 'nowrap' }}>
                        {createdAtStamp}
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`);
                          toast.success('WhatsApp link copied!');
                        }}
                        style={{ padding: 4, borderRadius: 5, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', cursor: 'pointer' }} 
                        title="Copy WhatsApp API"
                      >
                        <MessageCircle size={10} color="#22c55e" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button style={{ padding: 4, borderRadius: 5, background: 'var(--lc-bg2)', border: '1px solid var(--lc-line)', display: 'flex', cursor: 'pointer' }} title="More options">
                            <MoreVertical size={10} color="var(--lc-mid)" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedLeadForEdit(lead); setEditDialogOpen(true); }}>
                            Edit Lead
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="font-mono text-[10px] text-muted-foreground cursor-pointer"
                            onSelect={() => {
                              navigator.clipboard.writeText(`L-${lead.id.slice(-6).toUpperCase()}`);
                              toast.success('Lead ID copied!');
                            }}
                          >
                            L-{lead.id.slice(-6).toUpperCase()}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {/* ─── Pipeline Stages Stepper ─── */}
                <div style={{ marginTop: 14, paddingBottom: 4 }}>
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', padding: '0 4px' }} onClick={(e) => e.stopPropagation()}>
                    {pipelineStages.map((stage: any, i: number) => {
                      const isCompleted = i < stageIdx;
                      const isCurrent = i === stageIdx;
                      const showLine = i < pipelineStages.length - 1;
                      const lineCompleted = i < stageIdx;
                      const isStageUpdating = updatingStageLeadId === lead.id;
                      const isTargetStageUpdating = updatingStageTarget?.leadId === lead.id && updatingStageTarget.stageKey === stage.key;

                      return (
                        <button
                          key={stage.key}
                          type="button"
                          onClick={() => handleInlineStageChange(lead, stage.key, stage.label)}
                          disabled={isStageUpdating || isCurrent}
                          title={isCurrent ? 'Current stage' : `Move to ${stage.label}`}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            position: 'relative',
                            flex: 1,
                            minWidth: 0,
                            border: 'none',
                            background: 'transparent',
                            padding: 0,
                            cursor: isStageUpdating || isCurrent ? 'not-allowed' : 'pointer',
                            opacity: isStageUpdating && !isCurrent ? 0.55 : 1,
                          }}
                        >
                          {/* Connecting Line */}
                          {showLine && (
                            <div style={{ position: 'absolute', top: 11, left: '50%', right: '-50%', height: 2, background: lineCompleted ? D.acc : D.line2, zIndex: 0 }} />
                          )}
                          {/* Node Circle */}
                          <div style={{
                            width: 24, height: 24, borderRadius: 12, zIndex: 1, position: 'relative',
                            background: isCompleted ? D.acc : isCurrent ? '#fff' : D.bg2,
                            border: `2px solid ${isCompleted || isCurrent ? D.acc : D.line2}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: isCurrent ? `0 0 0 4px rgba(108,92,231,0.12)` : 'none',
                            color: isCompleted ? '#fff' : isCurrent ? D.acc : D.mid,
                            transition: 'all 0.2s ease'
                          }}>
                            {isTargetStageUpdating ? (
                              <Loader2 size={11} strokeWidth={2.5} className="animate-spin" />
                            ) : isCompleted ? (
                              <Check size={12} strokeWidth={3} />
                            ) : isCurrent ? (
                              <div style={{ width: 8, height: 8, borderRadius: 4, background: D.acc }} />
                            ) : null}
                          </div>
                          {/* Node Label */}
                          <div style={{
                            marginTop: 8, fontSize: 9, fontWeight: isCurrent ? 800 : 600,
                            color: isCurrent ? D.hi : isCompleted ? D.mid : D.dim,
                            textAlign: 'center', lineHeight: 1.25, width: '100%', padding: '0 2px',
                            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                          }}>
                            {stage.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ─── Details Grid (Dynamic Dense) ─── */}
              <div className="lc-expand-grid" style={{
                display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 1, background: D.line, margin: '6px 16px 0', borderRadius: 10, overflow: 'hidden',
                border: `1px solid ${D.line}`
              }}>
                <div style={{ background: D.bg1, padding: '8px 10px' }}>
                  <div style={{ fontSize: 8.5, color: D.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>LOCATION</div>
                  <p style={{ fontSize: 11, color: D.hi, fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.preferredLocation || '-'}>{lead.preferredLocation || '-'}</p>
                </div>
                <div style={{ background: D.bg1, padding: '8px 10px' }}>
                  <div style={{ fontSize: 8.5, color: D.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>MOVE-IN D.</div>
                  <p style={{ fontSize: 11, color: D.hi, fontWeight: 500, margin: 0 }}>{lead.moveInDate || '-'}</p>
                </div>
                <div style={{ background: D.bg1, padding: '8px 10px' }}>
                  <div style={{ fontSize: 8.5, color: D.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>NEED</div>
                  <p style={{ fontSize: 11, color: D.hi, fontWeight: 500, margin: 0 }}>{m.need || '-'}</p>
                </div>
                <div style={{ background: D.bg1, padding: '8px 10px' }}>
                  <div style={{ fontSize: 8.5, color: D.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>ROOM</div>
                  <p style={{ fontSize: 11, color: D.hi, fontWeight: 500, margin: 0 }}>{m.room || '-'}</p>
                </div>
                <div style={{ background: D.bg1, padding: '8px 10px' }}>
                  <div style={{ fontSize: 8.5, color: D.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>IN BLR?</div>
                  <p style={{ fontSize: 11, color: m.inBLR === null ? D.dim : D.hi, fontWeight: 500, margin: 0, fontStyle: m.inBLR === null ? 'italic' : 'normal' }}>
                    {m.inBLR === null ? 'Unknown' : (m.inBLR ? 'Yes' : 'No')}
                  </p>
                </div>
                <div style={{ background: D.bg1, padding: '8px 10px' }}>
                  <div style={{ fontSize: 8.5, color: D.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>EMAIL</div>
                  <p style={{ fontSize: 11, color: D.hi, fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.email}>{lead.email || '-'}</p>
                </div>
                <div style={{ background: D.bg1, padding: '8px 10px' }}>
                  <div style={{ fontSize: 8.5, color: D.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>QUALITY</div>
                  {m.quality ? (
                    <span style={{
                      display: 'inline-block', padding: '1px 8px', borderRadius: 10,
                      fontSize: 9.5, fontWeight: 600,
                      background: qualityBadge.bg, color: qualityBadge.color,
                    }}>
                      {m.quality.charAt(0).toUpperCase() + m.quality.slice(1)}
                    </span>
                  ) : <p style={{ fontSize: 11, color: D.dim, margin: 0 }}>-</p>}
                </div>
                <div style={{ background: D.bg1, padding: '8px 10px' }}>
                  <div style={{ fontSize: 8.5, color: D.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>BUDGET</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {m.budgetRanges?.length > 0 ? (
                      m.budgetRanges.map((r: any, i: number) => (
                        <span key={i} style={{
                          padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                          background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)', fontFamily: 'var(--lc-mono)',
                        }}>{r.display}</span>
                      ))
                    ) : (
                      <p style={{ fontSize: 11, color: D.hi, fontWeight: 500, margin: 0 }}>{lead.budget || '-'}</p>
                    )}
                  </div>
                </div>
                <div style={{ background: D.bg1, padding: '8px 10px' }}>
                  <div style={{ fontSize: 8.5, color: D.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>TYPE</div>
                  <p style={{ fontSize: 11, color: D.hi, fontWeight: 500, margin: 0 }}>{m.type || '-'}</p>
                </div>
                <div style={{ background: D.bg1, padding: '8px 10px' }}>
                  <div style={{ fontSize: 8.5, color: D.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>SCORE</div>
                  <p style={{ fontSize: 11, color: D.hi, fontWeight: 500, margin: 0 }}>{lead.leadScore || '-'}</p>
                </div>
                <div style={{ background: D.bg1, padding: '8px 10px' }}>
                  <div style={{ fontSize: 8.5, color: D.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>ASSIGNED</div>
                  <p style={{ fontSize: 11, color: D.hi, fontWeight: 500, margin: 0 }}>{lead.members?.name || '-'}</p>
                </div>
                <div style={{ background: D.bg1, padding: '8px 10px' }}>
                  <div style={{ fontSize: 8.5, color: D.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>CREATED</div>
                  <p style={{ fontSize: 11, color: D.hi, fontWeight: 500, margin: 0 }}>{lead.creator?.name || '-'}</p>
                </div>
                <div style={{ background: D.bg1, padding: '8px 10px' }}>
                  <div style={{ fontSize: 8.5, color: D.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>SPECIAL REQS</div>
                  <p style={{ fontSize: 11, color: D.hi, fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.specialRequests || '-'}>{lead.specialRequests || '-'}</p>
                </div>
                <div style={{ background: D.bg1, padding: '8px 10px' }}>
                  <div style={{ fontSize: 8.5, color: D.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>CREATED ON</div>
                  <p style={{ fontSize: 11, color: D.hi, fontWeight: 500, margin: 0 }}>
                    {new Date(lead.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* ─── Notes & Actions Section ─── */}
              <div style={{ padding: '12px 16px', background: D.bgRow, borderTop: `1px solid ${D.line}` }}>
                {/* Notes row */}
                {lead.notes && (
                  <div style={{ marginBottom: 10, padding: '8px 10px', background: D.bg1, borderRadius: 8, border: `1px solid ${D.line}` }}>
                    <div style={{ fontSize: 9, color: D.dim, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>NOTES</div>
                    <p style={{ fontSize: 12, color: D.text, margin: 0, lineHeight: 1.5 }}>{lead.notes}</p>
                  </div>
                )}

                {/* Multiple Areas */}
                {m.areas.length > 1 && (
                  <div style={{ background: D.accentBg, border: `1px solid ${D.line}`, borderRadius: 8, padding: '9px 11px', marginBottom: 10 }}>
                    <div style={{ fontSize: 8.5, color: D.acc, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 5 }}>📍 Areas Detected</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {m.areas.map((a: string, i: number) => <span key={i} style={{ fontSize: 11, color: D.text, background: D.bg1, border: `1px solid ${D.line2}`, borderRadius: 5, padding: '2px 8px' }}>{a}</span>)}
                    </div>
                  </div>
                )}

                {/* Geo Intelligence */}
                <GeoIntelPanel lead={{ location: lead.preferredLocation, rawText: '', areas: m.areas }} />


              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--lc-dim)' }}>
          <div style={{ fontSize: 48, opacity: 0.35, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14 }}>No leads match the current filters</div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 mb-10 md:mb-8">
          <p className="text-2xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalLeads)} of {totalLeads}
          </p>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-2xs rounded-lg" disabled={page === 0} onClick={() => changePage(page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-2xs rounded-lg" disabled={page >= totalPages - 1} onClick={() => changePage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label="Add lead"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-accent text-accent-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:cursor-not-allowed disabled:opacity-60"
        onClick={openLeadIntakeInNewTab}
        disabled={!canAddLead}
        title={!canAddLead ? 'Only Super Admins, managers, admins, and members can add leads' : 'Open Lead Intake in a new tab'}
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {/* Edit Lead Dialog */}
      <EditLeadDialog
        lead={selectedLeadForEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      {/* Schedule Tour Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Schedule Tour</DialogTitle>
            <DialogDescription>Create a tour assignment without leaving Leads.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Lead</Label>
              <Input value={scheduleLeadName} readOnly className="h-8 text-xs bg-muted/40" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone Number</Label>
              <Input
                value={schedulePhone}
                onChange={(e) => setSchedulePhone(e.target.value)}
                placeholder="Enter phone number"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Property</Label>
              <Input
                value={schedulePropertyName}
                onChange={(e) => setSchedulePropertyName(e.target.value)}
                placeholder="Type property name"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Zone</Label>
              <select
                value={scheduleZoneId}
                onChange={(e) => setScheduleZoneId(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                {(officeZones || []).map((zone: any) => (
                  <option key={String(zone._id || zone.id)} value={String(zone._id || zone.id)}>{String(zone.name || '')}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Assign To (TCM)</Label>
              <div className="relative">
                <Input
                  value={scheduleAssignedSearch}
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
              <Input type="date" value={scheduleTourDate} onChange={(e) => setScheduleTourDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tour Time</Label>
              <Input type="time" value={scheduleTourTime} onChange={(e) => setScheduleTourTime(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tour Mode</Label>
              <select value={scheduleTourMode} onChange={(e) => setScheduleTourMode(e.target.value as 'physical' | 'virtual')} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                <option value="physical">Physical</option>
                <option value="virtual">Virtual</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Budget</Label>
              <Input type="number" value={scheduleBudget} onChange={(e) => setScheduleBudget(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button onClick={handleScheduleTourFromLead} disabled={createVisit.isPending}>
              {createVisit.isPending ? 'Scheduling...' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Leads;
