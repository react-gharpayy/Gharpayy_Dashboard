"use client";

import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import AddLeadDialog from '@/components/AddLeadDialog';
import EditLeadDialog from '@/components/EditLeadDialog';
import { useLeadsPaginated, useOfficeZones } from '@/hooks/useCrmData';
import { useBulkUpdateLeads, useDeleteLeads } from '@/hooks/useLeadDetails';
import { useUpdateLead, useAgents, type LeadWithRelations } from '@/hooks/useCrmData';
import { PIPELINE_STAGES, SOURCE_LABELS } from '@/types/crm';
import { Filter, Download, Trash2, PhoneCall, MessageCircle, MoreVertical } from 'lucide-react';
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
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { T, QUALITY, GEO_TECH_PARKS, FDISPLAY } from '@/lib/leadGeoData';
import { parseMoveInV2, parseBudgetV2 } from '@/lib/leadParserV2';
import { Pill, ZonePill, TechPill, UrgencyBadge, SourceBadge, BLRBadge, BudgetChips, GeoIntelPanel } from '@/components/LeadUIAtoms';

// ─── helpers to map DB lead → card display ────────────────────────
function mapLeadMeta(lead: LeadWithRelations) {
  const meta = lead.parsedMetadata || {} as any;
  // Show ASSIGNED zone only
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

const statusBadgeConfig: Record<string, { bg: string; color: string; border: string }> = {
  new: { bg: 'rgba(96,165,250,0.1)', color: '#3b82f6', border: 'rgba(96,165,250,0.3)' },
  contacted: { bg: 'rgba(251,191,36,0.1)', color: '#d97706', border: 'rgba(251,191,36,0.3)' },
  qualified: { bg: 'rgba(52,211,153,0.1)', color: '#059669', border: 'rgba(52,211,153,0.3)' },
  visit_scheduled: { bg: 'rgba(139,92,246,0.1)', color: '#7c3aed', border: 'rgba(139,92,246,0.3)' },
  visit_completed: { bg: 'rgba(168,85,247,0.1)', color: '#9333ea', border: 'rgba(168,85,247,0.3)' },
  negotiation: { bg: 'rgba(251,146,60,0.1)', color: '#ea580c', border: 'rgba(251,146,60,0.3)' },
  booked: { bg: 'rgba(34,197,94,0.1)', color: '#16a34a', border: 'rgba(34,197,94,0.3)' },
  lost: { bg: 'rgba(100,116,139,0.08)', color: '#64748b', border: 'rgba(100,116,139,0.25)' },
};

const Leads = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDuplicate, setFilterDuplicate] = useState<string>('all');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedLeadForEdit, setSelectedLeadForEdit] = useState<LeadWithRelations | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const PAGE_SIZE = 50;
  const { data: paginatedData, isLoading } = useLeadsPaginated(page, PAGE_SIZE);
  const leads = paginatedData?.leads;
  const totalLeads = paginatedData?.total ?? 0;
  const totalPages = Math.ceil(totalLeads / PAGE_SIZE);
  const { data: members } = useAgents();
  const { data: officeZones } = useOfficeZones();
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
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'score_high': return (b.leadScore ?? 0) - (a.leadScore ?? 0);
        case 'score_low': return (a.leadScore ?? 0) - (b.leadScore ?? 0);
        case 'response': return (a.firstResponseTimeMin ?? 999) - (b.firstResponseTimeMin ?? 999);
        default: return 0;
      }
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

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Delete this lead? This cannot be undone.')) return;
    try {
      await deleteLeads.mutateAsync([leadId]);
      toast.success('Lead deleted');
    } catch (err: any) { toast.error(err.message); }
  };

  const handleInlineStatus = async (leadId: string, newStatus: string) => {
    try {
      await updateLead.mutateAsync({ id: leadId, status: newStatus as any });
      toast.success('Status updated');
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
            {(!showFiltersMobile && (filterSource !== 'all' || filterStatus !== 'all' || sortBy !== 'newest' || filterDuplicate !== 'all' || filterZone !== 'all')) && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
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
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="shrink-0 text-2xs bg-card border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring/30">
              <option value="all">All Sources</option>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="shrink-0 text-2xs bg-card border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring/30">
              <option value="all">All Stages</option>
              {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select value={filterDuplicate} onChange={e => setFilterDuplicate(e.target.value)} className="shrink-0 text-2xs bg-card border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring/30">
              <option value="all">All Records</option>
              <option value="unique">Unique Only</option>
              <option value="duplicate">Duplicates Only</option>
            </select>
            <select value={filterZone} onChange={e => setFilterZone(e.target.value)} className="shrink-0 text-2xs bg-card border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring/30">
              <option value="all">All Zones</option>
              {officeZones?.map(z => <option key={z._id} value={z.name}>{z.name}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="shrink-0 text-2xs bg-card border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring/30">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
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
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="w-full text-xs bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none">
              <option value="all">All Sources</option>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full text-xs bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none">
              <option value="all">All Stages</option>
              {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select value={filterDuplicate} onChange={e => setFilterDuplicate(e.target.value)} className="w-full text-xs bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none">
              <option value="all">All Records</option>
              <option value="unique">Unique Only</option>
              <option value="duplicate">Duplicates Only</option>
            </select>
            <select value={filterZone} onChange={e => setFilterZone(e.target.value)} className="w-full text-xs bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none">
              <option value="all">All Zones</option>
              {officeZones?.map(z => <option key={z._id} value={z.name}>{z.name}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-full text-xs bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
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
            <SelectContent>{PIPELINE_STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="destructive" size="sm" className="h-7 text-2xs gap-1 rounded-lg" onClick={handleBulkDelete}>
            <Trash2 size={10} /> Delete
          </Button>
          <button onClick={() => setSelectedIds(new Set())} className="text-2xs text-muted-foreground hover:text-foreground ml-auto transition-colors">
            Clear
          </button>
        </motion.div>
      )}

      {/* Lead Cards */}
      <style>{`
        @media (max-width: 640px) {
          .lead-avatar { display: none !important; }
          .lead-card { padding: 8px 8px 8px 10px !important; border-radius: 9px !important; }
          .lead-card-inner { gap: 5px !important; padding-left: 3px !important; }
          .lead-right { min-width: auto !important; gap: 3px !important; }
          .lead-expand-grid { grid-template-columns: 1fr 1fr !important; }
          .lead-card span, .lead-card div { font-size: inherit; }
          .lead-card .lead-name { font-size: 12px !important; }
          .lead-card .lead-phone { font-size: 9.5px !important; }
          .lead-card .lead-row { gap: 4px !important; margin-top: 3px !important; }
          .lead-card .lead-badge { font-size: 8.5px !important; padding: 1px 5px !important; }
          .lead-card .lead-info { font-size: 10px !important; }
          .lead-card .lead-pill { font-size: 9px !important; padding: 1px 5px !important; }
          .lead-card .lead-date { font-size: 8px !important; }
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map(lead => {
          const m = mapLeadMeta(lead);
          const exp = expandedId === lead.id;
          const sBadge = statusBadgeConfig[lead.status] || statusBadgeConfig.new;
          const createdDate = new Date(lead.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          const createdTime = new Date(lead.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
          const hue = lead.name ? lead.name.charCodeAt(0) * 7 % 360 : 200;

          return (
            <div key={lead.id}
              onClick={() => setExpandedId(exp ? null : lead.id)}
              className="lead-card"
              style={{
                background: T.bg1, border: `1px solid ${exp ? T.line2 : T.line}`,
                borderRadius: 12, padding: '13px 15px', cursor: 'pointer',
                position: 'relative', overflow: 'hidden', transition: 'all 0.15s',
              }}
            >
              {/* Left stripe */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: sBadge.color, borderRadius: '12px 0 0 12px', opacity: 0.7 }} />

              <div className="lead-card-inner" style={{ display: 'flex', alignItems: 'flex-start', gap: 11, paddingLeft: 8 }}>
                {/* Checkbox */}
                {canManageLeadAssignments && (
                  <div onClick={e => e.stopPropagation()} style={{ paddingTop: 5, flexShrink: 0 }}>
                    <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                  </div>
                )}

                {/* Avatar */}
                <div className="lead-avatar" style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: `hsl(${hue},28%,92%)`, border: `2px solid hsl(${hue},32%,82%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, color: `hsl(${hue},40%,42%)`,
                  fontFamily: T.sans,
                }}>
                  {(lead.name || '?')[0]?.toUpperCase()}
                </div>

                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Row 1: Name + phone + key badges */}
                  <div className="lead-row" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className="lead-name" style={{ fontSize: 14, fontWeight: 700, color: T.hi, fontFamily: T.sans }}>{lead.name}</span>
                    {lead.phone && <span className="lead-phone" style={{ fontFamily: T.mono, fontSize: 11, color: T.acc, fontWeight: 500 }}>{lead.phone}</span>}
                    {lead.isDuplicate && <span className="lead-badge" style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(251,146,60,0.1)', color: '#ea580c', border: '1px solid rgba(251,146,60,0.3)', fontWeight: 600 }}>Duplicate</span>}

                    {m.zones.map((z: string) => <ZonePill key={z} zoneName={z} xs />)}
                    <SourceBadge source={m.source} />
                    {m.moveInParsed && <UrgencyBadge urgency={m.moveInParsed.urgency} label={m.moveInParsed.label} />}
                    {/* Status + Member at the end */}
                    <span className="lead-badge" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, background: sBadge.bg, color: sBadge.color, border: `1px solid ${sBadge.border}`, fontWeight: 600 }}>
                      {PIPELINE_STAGES.find(s => s.key === lead.status)?.label || lead.status}
                    </span>
                    {lead.members?.name && (
                      <div className="lead-badge" style={{ height: 'max-content', display: 'flex', alignItems: 'center', gap: 4, background: T.bg2, border: `1px solid ${T.line}`, padding: '1px 3px 1px 6px', borderRadius: 5 }}>
                        <span style={{ fontSize: 11, color: T.hi, fontWeight: 600 }}>👤 {lead.members.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Location + budget chips */}
                  <div className="lead-row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 5, alignItems: 'center' }}>
                    {lead.preferredLocation && <span className="lead-info" style={{ fontSize: 11.5, color: T.mid }}>📍 {lead.preferredLocation.substring(0, 60)}</span>}
                    {m.budgetRanges?.length > 0 ? (
                      <BudgetChips ranges={m.budgetRanges} raw={lead.budget} />
                    ) : (
                      lead.budget && <span className="lead-info" style={{ fontSize: 11.5, color: T.mid }}>💰 {lead.budget}</span>
                    )}
                    {lead.moveInDate && <span className="lead-info" style={{ fontSize: 11.5, color: T.mid }}>📅 {lead.moveInDate}</span>}
                  </div>

                  {/* Row 3: Tech parks */}
                  {m.techParks.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                      {m.techParks.map((tp: string) => <TechPill key={tp} name={tp} />)}
                    </div>
                  )}

                  {/* Row 4: Profession, room, need pills */}
                  <div className="lead-row" style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {m.type && m.type !== 'U' && <Pill text={m.type} />}
                    {m.room && m.room !== 'U' && <Pill text={m.room} />}
                    {m.need && m.need.split(/\s*\/\s*/).filter(Boolean).map((n: string) => <Pill key={n} text={n.trim()} />)}
                    {m.inBLR !== undefined && <span style={{ fontSize: 9.5, padding: '2px 8px', borderRadius: 5, background: m.inBLR === null ? 'rgba(107,114,128,0.1)' : m.inBLR ? 'rgba(99,102,241,0.1)' : 'rgba(245,158,11,0.1)', color: m.inBLR === null ? '#9ca3af' : m.inBLR ? '#818cf8' : '#fbbf24', border: m.inBLR === null ? '1px solid rgba(107,114,128,0.2)' : m.inBLR ? '1px solid rgba(99,102,241,0.2)' : '1px solid rgba(245,158,11,0.2)', fontWeight: 600 }}>{m.inBLR === null ? '❓ Unknown' : (m.inBLR ? '🏙 In BLR' : '✈️ Out BLR')}</span>}
                    {m.quality && <span style={{ fontSize: 9.5, padding: '2px 8px', borderRadius: 5, background: 'rgba(234,179,8,0.1)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.2)', fontWeight: 600, textTransform: 'capitalize' }}>{m.quality}</span>}
                  </div>


                </div>

                {/* Right side: date + actions */}
                <div className="lead-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: T.dim, fontFamily: T.mono, opacity: 0.8 }}>L-{lead.id.slice(-6).toUpperCase()}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    <span className="lead-date" style={{ fontSize: 9.5, color: T.dim, fontFamily: T.mono }}>{createdDate}</span>
                    <span style={{ fontSize: 8.5, color: T.dim, fontFamily: T.mono, opacity: 0.8 }}>{createdTime}</span>
                  </div>
                  {lead.creator?.name && <span style={{ fontSize: 8.5, color: T.dim, fontStyle: 'italic', letterSpacing: '0.04em', marginTop: -2, marginBottom: 2 }}>(Added by {lead.creator.name})</span>}
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4 }}>
                    <a href={`tel:${lead.phone}`} style={{ padding: 5, borderRadius: 6, background: T.bg2, border: `1px solid ${T.line}`, display: 'flex' }} title="Call">
                      <PhoneCall size={12} color={T.mid} />
                    </a>
                    <a href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                      style={{ padding: 5, borderRadius: 6, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex' }} title="WhatsApp">
                      <MessageCircle size={12} color="#22c55e" />
                    </a>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button style={{ padding: 5, borderRadius: 6, background: T.bg2, border: `1px solid ${T.line}`, display: 'flex', cursor: 'pointer' }} title="More options">
                          <MoreVertical size={12} color={T.mid} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setSelectedLeadForEdit(lead); setEditDialogOpen(true); }}>
                          Edit Lead
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteLead(lead.id)} 
                          className="text-destructive focus:text-destructive"
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = 'white'; }}
                          onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#ef4444'; }}
                        >
                          Delete Lead
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              {/* ─── EXPANDED DETAIL ─── */}
              {exp && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.line}`, paddingLeft: 8 }}>
                  {/* Info grid */}
                  <div className="lead-expand-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 7, marginBottom: 12 }}>
                    {[
                      { label: 'Name', icon: '👤', value: lead.name },
                      { label: 'Phone', icon: '📱', value: lead.phone },
                      { label: 'Email', icon: '✉️', value: lead.email },
                      { label: 'Location', icon: '📍', value: lead.preferredLocation },
                      { label: 'Full Address', icon: '🏠', value: m.fullAddress },
                      { label: 'Budget', icon: '💰', value: lead.budget },
                      { label: 'Move-in', icon: '📅', value: lead.moveInDate },
                      { label: 'Type', icon: '💼', value: m.type !== 'U' ? m.type : '' },
                      { label: 'Room', icon: '🛏', value: m.room !== 'U' ? m.room : '' },
                      { label: 'Need', icon: '👥', value: m.need },
                      { label: 'Special Reqs', icon: '⭐', value: lead.specialRequests },
                      { label: 'Member', icon: '🧑‍💼', value: lead.members?.name },
                      { label: 'Score', icon: '⭐', value: lead.leadScore ? String(lead.leadScore) : '' },
                      { label: 'Quality', icon: '🎯', value: m.quality },
                      { label: 'In BLR?', icon: '🌆', value: m.inBLR !== undefined ? (m.inBLR === null ? 'Unknown' : (m.inBLR ? 'Yes' : 'No')) : '' },
                      { label: 'Notes', icon: '📝', value: lead.notes },
                    ].filter(f => f.value).map(f => (
                      <div key={f.label} style={{ background: T.bg2, borderRadius: 8, padding: '8px 10px', border: `1px solid ${T.line}` }}>
                        <div style={{ fontSize: 8.5, color: T.dim, marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{f.icon} {f.label}</div>
                        <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.5, wordBreak: 'break-word' as const }}>{f.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Budget chips */}
                  {m.budgetRanges?.length > 0 && (
                    <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 8, padding: '9px 11px', marginBottom: 10 }}>
                      <div style={{ fontSize: 8.5, color: T.dim, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>💰 Budget Ranges</div>
                      <BudgetChips ranges={m.budgetRanges} raw={lead.budget} />
                    </div>
                  )}

                  {/* Multiple Areas */}
                  {m.areas.length > 1 && (
                    <div style={{ background: 'rgba(108,92,231,0.05)', border: '1px solid rgba(108,92,231,0.15)', borderRadius: 8, padding: '9px 11px', marginBottom: 10 }}>
                      <div style={{ fontSize: 8.5, color: T.acc, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 5 }}>📍 Areas Detected</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {m.areas.map((a: string, i: number) => <span key={i} style={{ fontSize: 11, color: T.text, background: T.bg1, border: `1px solid ${T.line2}`, borderRadius: 5, padding: '2px 8px' }}>{a}</span>)}
                      </div>
                    </div>
                  )}

                  {/* Status changer */}
                  <div onClick={e => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 8, padding: '9px 11px', marginBottom: 10 }}>
                    <div style={{ fontSize: 8.5, color: T.dim, textTransform: 'uppercase' as const, letterSpacing: '0.07em', fontWeight: 700, marginBottom: 7 }}>Status</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {PIPELINE_STAGES.map(s => {
                        const sc = statusBadgeConfig[s.key] || statusBadgeConfig.new;
                        return (
                          <button key={s.key}
                            onClick={() => handleInlineStatus(lead.id, s.key)}
                            style={{ fontSize: 10.5, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: lead.status === s.key ? 700 : 400, background: lead.status === s.key ? sc.bg : 'transparent', color: lead.status === s.key ? sc.color : T.dim, border: `1px solid ${lead.status === s.key ? sc.border : T.line}`, transition: 'all 0.12s' }}>
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Member reassignment */}
                  {members && members.length > 0 && (
                    <div onClick={e => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 8, padding: '9px 11px', marginBottom: 10 }}>
                      <div style={{ fontSize: 8.5, color: T.dim, textTransform: 'uppercase' as const, letterSpacing: '0.07em', fontWeight: 700, marginBottom: 7 }}>Assigned Member</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button
                          onClick={async () => { try { await updateLead.mutateAsync({ id: lead.id, assignedMemberId: null as any }); toast.success('Member unassigned'); } catch (err: any) { toast.error(err.message); } }}
                          style={{ fontSize: 10.5, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: !lead.assignedMemberId ? 700 : 400, background: !lead.assignedMemberId ? 'rgba(100,116,139,0.1)' : 'transparent', color: !lead.assignedMemberId ? '#64748b' : T.dim, border: `1px solid ${!lead.assignedMemberId ? 'rgba(100,116,139,0.3)' : T.line}`, transition: 'all 0.12s' }}>
                          Unassigned
                        </button>
                        {members.map((a: any) => {
                          const isActive = String(lead.assignedMemberId) === String(a.id);
                          return (
                            <button key={a.id}
                              onClick={async () => { try { await updateLead.mutateAsync({ id: lead.id, assignedMemberId: a.id }); toast.success(`Assigned to ${a.name}`); } catch (err: any) { toast.error(err.message); } }}
                              style={{ fontSize: 10.5, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: isActive ? 700 : 400, background: isActive ? 'rgba(108,92,231,0.1)' : 'transparent', color: isActive ? T.acc : T.dim, border: `1px solid ${isActive ? 'rgba(108,92,231,0.3)' : T.line}`, transition: 'all 0.12s' }}>
                              {a.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Geo Intelligence */}
                  <GeoIntelPanel lead={{ location: lead.preferredLocation, rawText: '', areas: m.areas }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: T.dim }}>
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
