"use client";

import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import AddLeadDialog from '@/components/AddLeadDialog';
import EditLeadDialog from '@/components/EditLeadDialog';
import { useLeadsPaginated, useOfficeZones, usePipelineStages } from '@/hooks/useCrmData';
import { useBulkUpdateLeads, useDeleteLeads } from '@/hooks/useLeadDetails';
import { useUpdateLead, useAgents, type LeadWithRelations } from '@/hooks/useCrmData';
import { PIPELINE_STAGES, SOURCE_LABELS } from '@/types/crm';
import { Filter, Download, Trash2, PhoneCall, MessageCircle, MoreVertical, MapPin, ChevronDown, ChevronUp, Check } from 'lucide-react';
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
  
  const [filterDateMode, setFilterDateMode] = useState<'newest' | 'oldest' | 'date' | 'month'>('newest');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('');
  
  const PAGE_SIZE = 50;
  const { data: paginatedData, isLoading } = useLeadsPaginated(page, PAGE_SIZE);
  const leads = paginatedData?.leads;
  const totalLeads = paginatedData?.total ?? 0;
  const totalPages = Math.ceil(totalLeads / PAGE_SIZE);
  const { data: members } = useAgents();
  const { data: officeZones } = useOfficeZones();
  const { data: pipelineStagesData } = usePipelineStages();
  const pipelineStages = (pipelineStagesData && pipelineStagesData.length > 0)
    ? pipelineStagesData
    : PIPELINE_STAGES.map((s, i) => ({ ...s, order: i }));
  const bulkUpdate = useBulkUpdateLeads();
  const deleteLeads = useDeleteLeads();
  const updateLead = useUpdateLead();
  const { user } = useAuth();
  const canManageLeadAssignments = ['super_admin', 'manager', 'admin', 'member'].includes(user?.role || '');

  const filtered = (leads || [])
    .filter(l => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
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
      
      if (filterDateMode === 'date' || filterDateMode === 'month') {
        if (!l.moveInDate) return false;
        const parsed = parseMoveInV2(l.moveInDate);
        if (!parsed || !parsed.resolved) return false;
        const leadDate = parsed.resolved;
        if (filterDateMode === 'date' && filterDate) {
          const filterDateObj = new Date(filterDate);
          if (leadDate.getFullYear() !== filterDateObj.getFullYear() || leadDate.getMonth() !== filterDateObj.getMonth() || leadDate.getDate() !== filterDateObj.getDate()) return false;
        } else if (filterDateMode === 'month' && filterMonth) {
          const [year, month] = filterMonth.split('-').map(Number);
          if (leadDate.getFullYear() !== year || leadDate.getMonth() + 1 !== month) return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (filterDateMode === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} leads? This cannot be undone.`)) return;
    try {
      await deleteLeads.mutateAsync(Array.from(selectedIds));
      toast.success(`${selectedIds.size} leads deleted`);
      setSelectedIds(new Set());
    } catch (err: any) { toast.error(err.message); }
  };

  const handleExport = () => {
    const csv = [
      ['Name', 'Phone', 'Email', 'Source', 'Status', 'Member', 'Location', 'Budget', 'Score'].join(','),
      ...filtered.map(l => [l.name, l.phone, l.email || '', l.source, l.status, l.members?.name || '', l.preferredLocation || '', l.budget || '', l.leadScore ?? 0].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads-export.csv';
    a.click();
  };

  if (isLoading) {
    return (
      <AppLayout title="All Leads" subtitle="Loading...">
        <Skeleton className="h-[500px] rounded-2xl" />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="All Leads" subtitle={`${filtered.length} leads found`} actions={<AddLeadDialog />}>
      {/* Filters Area */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setShowFiltersMobile(!showFiltersMobile)} className="ml-1.5 md:ml-0 gap-2 h-8 text-xs rounded-xl md:hidden">
            <Filter size={14} /> Filters
            {(!showFiltersMobile && (filterSource !== 'all' || filterStatus !== 'all' || filterDuplicate !== 'all' || filterZone !== 'all' || filterDateMode !== 'newest')) && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
          </Button>

          {/* Desktop Filters */}
          <div className="hidden md:flex items-center gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <Input 
              placeholder="Search Name, Phone, ID..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 text-2xs rounded-xl w-48 bg-card border-border"
            />
            <Filter size={13} className="text-muted-foreground shrink-0" />
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="shrink-0 h-8 text-2xs rounded-xl w-auto min-w-[110px] bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Sources</SelectItem>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="shrink-0 h-8 text-2xs rounded-xl w-auto min-w-[110px] bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Stages</SelectItem>
                {pipelineStages.map((s: any) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDuplicate} onValueChange={setFilterDuplicate}>
              <SelectTrigger className="shrink-0 h-8 text-2xs rounded-xl w-auto min-w-[110px] bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="unique">Unique Only</SelectItem>
                <SelectItem value="duplicate">Duplicates Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterZone} onValueChange={setFilterZone}>
              <SelectTrigger className="shrink-0 h-8 text-2xs rounded-xl w-auto min-w-[100px] bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Zones</SelectItem>
                {officeZones?.map(z => <SelectItem key={z._id} value={z.name}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterDateMode} onValueChange={(v) => { setFilterDateMode(v as any); setFilterDate(''); setFilterMonth(''); }}>
              <SelectTrigger className="shrink-0 h-8 text-2xs rounded-xl w-auto min-w-[110px] bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="date">By Date</SelectItem>
                <SelectItem value="month">By Month</SelectItem>
              </SelectContent>
            </Select>
            
            {filterDateMode === 'date' && (
              <input 
                type="date" 
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="shrink-0 text-2xs bg-card border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring/30"
              />
            )}
            
            {filterDateMode === 'month' && (
              <input 
                type="month" 
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="shrink-0 text-2xs bg-card border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring/30"
              />
            )}
          </div>

          <Button variant="outline" size="sm" className="mr-1.5 md:mr-0 h-[30px] md:h-8 gap-1.5 text-xs md:text-2xs rounded-lg md:rounded-xl px-3 ml-auto shrink-0" onClick={handleExport}>
            <Download size={13} className="md:w-3 md:h-3" /> <span className="hidden sm:inline">Export</span>
          </Button>
        </div>

        {/* Mobile Filters Expanded */}
        {showFiltersMobile && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="flex md:hidden flex-col gap-2 p-3 bg-secondary/30 rounded-xl border border-border">
            <Input 
              placeholder="Search Name, Phone, ID..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 text-xs rounded-lg w-full bg-card border-border"
            />
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-full h-9 text-xs rounded-lg bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Sources</SelectItem>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full h-9 text-xs rounded-lg bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Stages</SelectItem>
                {pipelineStages.map((s: any) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDuplicate} onValueChange={setFilterDuplicate}>
              <SelectTrigger className="w-full h-9 text-xs rounded-lg bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="unique">Unique Only</SelectItem>
                <SelectItem value="duplicate">Duplicates Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterZone} onValueChange={setFilterZone}>
              <SelectTrigger className="w-full h-9 text-xs rounded-lg bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="all">All Zones</SelectItem>
                {officeZones?.map(z => <SelectItem key={z._id} value={z.name}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDateMode} onValueChange={(v) => { setFilterDateMode(v as any); setFilterDate(''); setFilterMonth(''); }}>
              <SelectTrigger className="w-full h-9 text-xs rounded-lg bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" align="start">
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="date">By Date</SelectItem>
                <SelectItem value="month">By Month</SelectItem>
              </SelectContent>
            </Select>
            {filterDateMode === 'date' && (
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                className="w-full text-xs bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none" />
            )}
            {filterDateMode === 'month' && (
              <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                className="w-full text-xs bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none" />
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
          <Button variant="destructive" size="sm" className="h-7 text-2xs gap-1 rounded-lg" onClick={handleBulkDelete}>
            <Trash2 size={10} /> Delete
          </Button>
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
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(lead => {
          const m = mapLeadMeta(lead);
          const isExpanded = expandedId === lead.id;
          const sBadge = statusBadgeConfig[lead.status] || statusBadgeConfig.new;
          const stageLabel = pipelineStages.find((s: any) => s.key === lead.status)?.label || lead.status;
          const hue = lead.name ? lead.name.charCodeAt(0) * 7 % 360 : 200;
          const progress = computeLeadProgress(lead);
          const fieldsMissing = computeFieldsMissing(lead);
          const progressColor = getProgressColor(progress);
          const qualityBadge = getQualityBadgeColor(m.quality || '');
          const createdDate = new Date(lead.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

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
                  background: 'var(--lc-bg1)',
                  border: '1px solid var(--lc-line)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--lc-line2)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--lc-line)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
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

                  {/* Lead Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Row 1: Name + Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px 8px', flexWrap: 'wrap', paddingBottom: 4 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--lc-hi)', margin: 0, fontFamily: 'var(--lc-sans)', paddingRight: 2 }}>{lead.name}</h3>
                      
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
                      <span style={{ fontSize: 11.5, color: 'var(--lc-mid)', fontFamily: 'var(--lc-mono)', fontWeight: 600 }}>{lead.phone}</span>

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

                  {/* Quick actions on collapsed */}
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, paddingTop: 2 }}>
                    
                    {/* Small Progress Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, width: '100%' }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--lc-bg3)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: progressColor, borderRadius: 2, transition: 'width 0.3s ease' }} />
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: progressColor, fontFamily: 'var(--lc-mono)', textAlign: 'right', minWidth: 20 }}>{progress}%</span>
                    </div>

                    {/* Action icons row */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setExpandedId(lead.id); }} 
                        style={{ padding: 5, borderRadius: 6, background: 'var(--lc-bg2)', border: '1px solid var(--lc-line)', display: 'flex', cursor: 'pointer' }} 
                        title="Expand"
                      >
                        <ChevronDown size={12} color="var(--lc-mid)" />
                      </button>
                      <a href={`tel:${lead.phone}`} style={{ padding: 5, borderRadius: 6, background: 'var(--lc-bg2)', border: '1px solid var(--lc-line)', display: 'flex' }} title="Call">
                        <PhoneCall size={12} color="var(--lc-mid)" />
                      </a>
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`); toast.success('WhatsApp link copied!'); }}
                        style={{ padding: 5, borderRadius: 6, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', cursor: 'pointer' }} 
                        title="Copy WhatsApp API"
                      >
                        <MessageCircle size={12} color="#22c55e" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button style={{ padding: 5, borderRadius: 6, background: 'var(--lc-bg2)', border: '1px solid var(--lc-line)', display: 'flex', cursor: 'pointer' }} title="More options">
                            <MoreVertical size={12} color="var(--lc-mid)" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedLeadForEdit(lead); setEditDialogOpen(true); }}>
                            Edit Lead
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
                background: 'var(--lc-bg1)',
                borderRadius: 14,
                border: `2px solid var(--lc-acc)`,
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
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--lc-hi)', margin: 0, fontFamily: 'var(--lc-sans)', paddingRight: 2 }}>{lead.name}</h3>
                        
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
                        <span style={{ fontSize: 11.5, color: 'var(--lc-mid)', fontFamily: 'var(--lc-mono)', fontWeight: 600 }}>{lead.phone}</span>

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

                  {/* Right side — ID + action icons */}
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0, paddingTop: 2 }}>
                    <span style={{ fontSize: 9, color: 'var(--lc-dim)', fontFamily: 'var(--lc-mono)' }}>L-{lead.id.slice(-6).toUpperCase()}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setExpandedId(''); }} 
                        style={{ padding: 5, borderRadius: 6, background: 'var(--lc-bg2)', border: '1px solid var(--lc-line)', display: 'flex', cursor: 'pointer' }} 
                        title="Collapse"
                      >
                        <ChevronUp size={12} color="var(--lc-mid)" />
                      </button>
                      <a href={`tel:${lead.phone}`} style={{ padding: 5, borderRadius: 6, background: 'var(--lc-bg2)', border: '1px solid var(--lc-line)', display: 'flex' }} title="Call">
                        <PhoneCall size={12} color="var(--lc-mid)" />
                      </a>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`);
                          toast.success('WhatsApp link copied!');
                        }}
                        style={{ padding: 5, borderRadius: 6, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', cursor: 'pointer' }} 
                        title="Copy WhatsApp API"
                      >
                        <MessageCircle size={12} color="#22c55e" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button style={{ padding: 5, borderRadius: 6, background: 'var(--lc-bg2)', border: '1px solid var(--lc-line)', display: 'flex', cursor: 'pointer' }} title="More options">
                            <MoreVertical size={12} color="var(--lc-mid)" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedLeadForEdit(lead); setEditDialogOpen(true); }}>
                            Edit Lead
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {/* ─── Pipeline Stages Stepper ─── */}
                <div style={{ marginTop: 14, paddingBottom: 4 }}>
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', padding: '0 4px' }}>
                    {pipelineStages.map((stage: any, i: number) => {
                      const isCompleted = i < stageIdx;
                      const isCurrent = i === stageIdx;
                      const showLine = i < pipelineStages.length - 1;
                      const lineCompleted = i < stageIdx;

                      return (
                        <div key={stage.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', flex: 1, minWidth: 0 }}>
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
                            {isCompleted ? (
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
                        </div>
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
        <div className="flex items-center justify-between mt-4">
          <p className="text-2xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalLeads)} of {totalLeads}
          </p>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-2xs rounded-lg" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-2xs rounded-lg" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Edit Lead Dialog */}
      <EditLeadDialog
        lead={selectedLeadForEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </AppLayout>
  );
};

export default Leads;
