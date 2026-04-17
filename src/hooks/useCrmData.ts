import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { broadcastLeadsUpdated } from '@/lib/leadSync';

// Type for lead with joined member and property
export type LeadWithRelations = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
  source: string;
  firstResponseTimeMin?: number;
  members: { id: string, name: string, phone?: string } | null;
  creator?: { id: string, name: string, phone?: string } | null;
  properties: { id: string, name: string } | null;
  preferredLocation?: string;
  budget?: string;
  moveInDate?: string;
  gender?: string;
  profession?: string;
  roomType?: string;
  needPreference?: string;
  specialRequests?: string;
  parsedMetadata?: Record<string, any>;
  leadScore: number;
  isDuplicate?: boolean;
  duplicateCount?: number;
  notes?: string;
  activity?: LeadActivityEntry[];
  lastOn?: string;
  stageOn?: string;
  nextOn?: string;
  visitOn?: string;
  visitDoneOn?: string;
  bookingOn?: string;
  touches?: number;
  nextAction?: string;
  assignedMemberId?: string;
  assignmentStatus?: 'pending' | 'accepted';
  assignmentRequestedById?: string;
  assignmentRequestedAt?: string;
  assignmentAcceptedAt?: string;
  createdAt: string;
  lastActivityAt: string;
};

export type LeadActivityEntry = {
  id: string;
  on: string;
  by: string;
  type: string;
  note: string;
};

export type LogLeadActivityPayload = {
  type: string;
  note: string;
  nextAction?: string;
  nextDate?: string;
  visitDate?: string;
  newStage?: string;
  lostReason?: string;
};

export type ActivityFeedRow = LeadActivityEntry & {
  leadId: string;
  leadName: string;
  leadPhone?: string;
  leadStage?: string;
};

export type LeaderboardPeriod = 'this_month' | 'all_time' | 'today' | 'last_30_days' | 'custom';

export type AnalyticsPeriod = 'all' | 'today' | 'last_7_days' | 'last_30_days' | 'custom';

export type CreatorLeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  role: 'manager' | 'admin' | 'member';
  toursCount: number;
  zones: { zone: string; count: number }[];
};

export type CreatorLeaderboardResponse = {
  period: LeaderboardPeriod;
  from: string | null;
  to: string | null;
  generatedAt: string;
  rankings: CreatorLeaderboardEntry[];
};

export type LeadsDailyProgressMember = {
  id: string;
  name: string;
  zones: string[];
  leadsAdded: number;
  toursScheduled: number;
  leadsDone: boolean;
  toursDone: boolean;
  allDone: boolean;
};

export type LeadsDailyProgressResponse = {
  date: string;
  members: LeadsDailyProgressMember[];
  goals: {
    leadsAdded: number;
    toursScheduled: number;
  };
  thresholds?: {
    leadsAdded: number;
    toursScheduled: number;
  };
};

export type ZoneAnalyticsMetrics = {
  totalMembers: number;
  totalLeadsTillDate: number;
  totalLeadsInRange: number;
  duplicateLeadsTillDate: number;
  duplicateLeadsInRange: number;
  stageAnalytics: Array<{ key: string; label: string; count: number }>;
  conversionRate: number;
  sla: { under5: number; between5And30: number; over30: number; unknown: number };
  stageAging: Array<{ key: string; label: string; avgDays: number; leads: number }>;
  sourceMix: Array<{ source: string; leads: number; booked: number; conversionRate: number }>;
  trend: Array<{ date: string; leads: number; booked: number }>;
  activeMembers: number;
  followUpPending: number;
  topPerformer: { memberId: string; memberName: string; leads: number; booked: number; score: number } | null;
  topPerformers: Array<{ memberId: string; memberName: string; leads: number; booked: number; score: number }>;
};

export type ZoneAnalyticsResponse = {
  filters: {
    zone: string | null;
    compareZone?: string | null;
    period: AnalyticsPeriod;
    from: string | Date | null;
    to: string | Date | null;
  };
  stages: Array<{ key: string; label: string }>;
  metrics: ZoneAnalyticsMetrics;
  compare: { zone: string; metrics: ZoneAnalyticsMetrics } | null;
};

export type MemberAnalyticsMetrics = {
  memberId: string;
  memberName: string;
  totalLeadsAddedTillDate: number;
  totalLeadsAddedInRange: number;
  stageAnalytics: Array<{ key: string; label: string; count: number }>;
  duplicateLeads: number;
  duplicateRatio: number;
  conversionRate: number;
  avgFirstResponseMin: number;
  avgStageMovementHours: number;
  avgLeadScore: number;
  sourcePerformance: Array<{ source: string; leads: number; booked: number; conversionRate: number }>;
  visitOutcomes: { completed: number; noShow: number; rescheduled: number; cancelled: number };
  staleLeads: number;
  assignmentStats: { accepted: number; passedOn: number; pendingNow: number };
};

export type MemberAnalyticsResponse = {
  filters: {
    memberId: string;
    compareMemberId?: string | null;
    zone: string | null;
    period: AnalyticsPeriod;
    from: string | Date | null;
    to: string | Date | null;
  };
  stages: Array<{ key: string; label: string }>;
  metrics: MemberAnalyticsMetrics;
  compare: MemberAnalyticsMetrics | null;
};

export type AnalyticsOptionsResponse = {
  role: string;
  members: Array<{ id: string; name: string; zones: string[] }>;
  zones: Array<{ name: string }>;
  canViewZoneAnalytics: boolean;
};

export type LeadsQueryFilters = {
  q?: string;
  status?: string;
  source?: string;
  zone?: string;
  assignedMemberId?: string;
  duplicate?: 'all' | 'duplicate' | 'unique';
  sort?: 'newest' | 'oldest' | 'alphabetical';
  period?: 'all' | 'today' | 'custom';
  from?: string;
  to?: string;
};


// Leads (all) - handles new { leads, total } format
export const useLeads = () =>
  useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const res = await fetch('/api/leads');
      if (!res.ok) throw new Error('Failed to fetch leads');
      const data = await res.json();
      // New format returns { leads, total }, extract leads array
      return (data.leads || data) as Promise<LeadWithRelations[]>;
    },
    staleTime: 30000, // 30s cache
  });

// Leads (paginated) - server-side pagination
export const useLeadsPaginated = (page = 0, pageSize = 50, filters?: LeadsQueryFilters) =>
  useQuery({
    queryKey: ['leads-paginated', page, pageSize, filters || {}],
    queryFn: async () => {
      const skip = page * pageSize;
      const params = new URLSearchParams();
      params.set('skip', String(skip));
      params.set('limit', String(pageSize));

      if (filters?.q) params.set('q', filters.q);
      if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters?.source && filters.source !== 'all') params.set('source', filters.source);
      if (filters?.zone && filters.zone !== 'all') params.set('zone', filters.zone);
      if (filters?.assignedMemberId && filters.assignedMemberId !== 'all') {
        params.set('assignedMemberId', filters.assignedMemberId);
      }
      if (filters?.duplicate && filters.duplicate !== 'all') params.set('duplicate', filters.duplicate);
      if (filters?.sort) params.set('sort', filters.sort);
      if (filters?.period && filters.period !== 'all') params.set('period', filters.period);
      if (filters?.from) params.set('from', filters.from);
      if (filters?.to) params.set('to', filters.to);

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch leads');
      return res.json() as Promise<{ leads: LeadWithRelations[]; total: number }>;
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30000, // 30s cache before refetch
  });

// Leads (all visible for current user) - walks paginated API to collect full dataset.
export const useAllVisibleLeads = (filters?: LeadsQueryFilters) =>
  useQuery({
    queryKey: ['leads-all-visible', filters || {}],
    queryFn: async () => {
      const pageSize = 100;
      let skip = 0;
      let total = Number.POSITIVE_INFINITY;
      const all: LeadWithRelations[] = [];

      while (skip < total) {
        const params = new URLSearchParams();
        params.set('skip', String(skip));
        params.set('limit', String(pageSize));
        params.set('sort', 'newest');

        if (filters?.q) params.set('q', filters.q);
        if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
        if (filters?.source && filters.source !== 'all') params.set('source', filters.source);
        if (filters?.zone && filters.zone !== 'all') params.set('zone', filters.zone);
        if (filters?.assignedMemberId && filters.assignedMemberId !== 'all') {
          params.set('assignedMemberId', filters.assignedMemberId);
        }
        if (filters?.duplicate && filters.duplicate !== 'all') params.set('duplicate', filters.duplicate);
        if (filters?.period && filters.period !== 'all') params.set('period', filters.period);
        if (filters?.from) params.set('from', filters.from);
        if (filters?.to) params.set('to', filters.to);

        const res = await fetch(`/api/leads?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch complete leads list');

        const data = await res.json() as { leads?: LeadWithRelations[]; total?: number };
        const batch = data?.leads || [];
        const serverTotal = typeof data?.total === 'number' ? data.total : skip + batch.length;
        total = serverTotal;

        all.push(...batch);

        if (batch.length === 0 || batch.length < pageSize) break;
        skip += batch.length;
      }

      const deduped = Array.from(new Map(all.map((lead) => [lead.id, lead])).values());
      return deduped;
    },
    staleTime: 30000,
  });

// Leads (infinite) - progressive pagination for long lists
export const useLeadsInfinite = (pageSize = 100) =>
  useInfiniteQuery({
    queryKey: ['leads-infinite', pageSize],
    initialPageParam: 0,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const skip = pageParam * pageSize;
      const params = new URLSearchParams();
      params.set('skip', String(skip));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch leads');
      const data = await res.json();
      const pageLeads = (data.leads || data) as LeadWithRelations[];
      const total = typeof data.total === 'number' ? data.total : undefined;
      return { leads: pageLeads, total };
    },
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((sum, page) => sum + page.leads.length, 0);

      if (typeof lastPage.total === 'number') {
        return loadedCount < lastPage.total ? allPages.length : undefined;
      }

      return lastPage.leads.length >= pageSize ? allPages.length : undefined;
    },
    staleTime: 30000,
  });

export const useLeadsInfiniteByStatus = (status: string, pageSize = 10) =>
  useInfiniteQuery({
    queryKey: ['leads-infinite', status, pageSize],
    initialPageParam: 0,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const skip = pageParam * pageSize;
      const params = new URLSearchParams();
      params.set('skip', String(skip));
      params.set('limit', String(pageSize));
      params.set('status', status);

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch leads');
      const data = await res.json();
      const pageLeads = (data.leads || data) as LeadWithRelations[];
      const total = typeof data.total === 'number' ? data.total : undefined;
      return { leads: pageLeads, total };
    },
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((sum, page) => sum + page.leads.length, 0);

      if (typeof lastPage.total === 'number') {
        return loadedCount < lastPage.total ? allPages.length : undefined;
      }

      return lastPage.leads.length >= pageSize ? allPages.length : undefined;
    },
    staleTime: 30000,
  });

export const useLeadsByStatus = (status: string, page = 0, pageSize = 50) =>
  useQuery({
    queryKey: ['leads-by-status', status, page, pageSize],
    queryFn: async () => {
      const skip = page * pageSize;
      const res = await fetch(`/api/leads?status=${status}&skip=${skip}&limit=${pageSize}`);
      if (!res.ok) throw new Error('Failed to fetch leads by status');
      return res.json() as Promise<{ leads: LeadWithRelations[]; total: number }>;
    },
    staleTime: 30000, // 30s cache before refetch
  });

export const useCreateLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lead: any) => {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      });
      if (!res.ok) throw new Error('Failed to create lead');
      return res.json();
    },
    onSuccess: async () => {
      broadcastLeadsUpdated();
      await qc.invalidateQueries({ queryKey: ['leads'] });
      await qc.invalidateQueries({ queryKey: ['leads-paginated'] });
      await qc.invalidateQueries({ queryKey: ['leads-infinite'] });
      await qc.invalidateQueries({ queryKey: ['leads', 'status'] });
      await qc.refetchQueries({ queryKey: ['leads-paginated'], type: 'active' });
      toast.success('Lead created');
    },
  });
};

export const useUpdateLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update lead');
      return res.json();
    },
    onSuccess: async () => {
      broadcastLeadsUpdated();
      await qc.invalidateQueries({ queryKey: ['leads'] });
      await qc.invalidateQueries({ queryKey: ['leads-paginated'] });
      await qc.invalidateQueries({ queryKey: ['leads-infinite'] });
      await qc.invalidateQueries({ queryKey: ['leads', 'status'] });
      await qc.refetchQueries({ queryKey: ['leads-paginated'], type: 'active' });
    },
  });
};

export const useLeadActivity = (leadId?: string) =>
  useQuery({
    queryKey: ['lead-activity', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}/activity`);
      if (!res.ok) throw new Error('Failed to fetch lead activity');
      return res.json() as Promise<LeadActivityEntry[]>;
    },
  });

export const useLogLeadActivity = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, payload }: { leadId: string; payload: LogLeadActivityPayload }) => {
      const res = await fetch(`/api/leads/${leadId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = 'Failed to log activity';
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // Ignore JSON parse errors and use fallback message.
        }
        throw new Error(message);
      }

      return res.json() as Promise<LeadWithRelations>;
    },
    onSuccess: async (_, vars) => {
      broadcastLeadsUpdated();
      await qc.invalidateQueries({ queryKey: ['lead-activity', vars.leadId] });
      await qc.invalidateQueries({ queryKey: ['activity-log', vars.leadId] });
      await qc.invalidateQueries({ queryKey: ['leads'] });
      await qc.invalidateQueries({ queryKey: ['leads-paginated'] });
      await qc.invalidateQueries({ queryKey: ['leads-infinite'] });
      await qc.refetchQueries({ queryKey: ['leads-paginated'], type: 'active' });
    },
  });
};

export const useAllActivityFeed = (params?: {
  page?: number;
  limit?: number;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  type?: string;
}) =>
  useQuery({
    queryKey: ['activity-all', params || {}],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.userId) query.set('userId', params.userId);
      if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
      if (params?.dateTo) query.set('dateTo', params.dateTo);
      if (params?.type) query.set('type', params.type);

      const res = await fetch(`/api/activity/all?${query.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch activity feed');
      return res.json() as Promise<{
        rows: ActivityFeedRow[];
        total: number;
        page: number;
        limit: number;
        hasMore: boolean;
      }>;
    },
  });

export const useAgents = () =>
  useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const res = await fetch('/api/members');
      if (!res.ok) throw new Error('Failed to fetch members');
      return res.json();
    },
  });

export const useCreateAgent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (member: any) => {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member),
      });
      if (!res.ok) throw new Error('Failed to create member');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  });
};

export const useUpdateAgent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const res = await fetch(`/api/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update member');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  });
};

export const useDeleteAgent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete member');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  });
};

export const useProperties = () =>
  useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const res = await fetch('/api/properties');
      if (!res.ok) throw new Error('Failed to fetch properties');
      return res.json();
    },
  });

export const useCreateProperty = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (property: any) => {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(property),
      });
      if (!res.ok) throw new Error('Failed to create property');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
};

export const useDeleteProperty = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/properties/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete property');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
};

// Visits
export const useVisits = () =>
  useQuery({
    queryKey: ['visits'],
    queryFn: async () => {
      const res = await fetch('/api/visits');
      if (!res.ok) throw new Error('Failed to fetch visits');
      return res.json();
    },
  });

export const useCreateVisit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (visit: any) => {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visit),
      });
      if (!res.ok) throw new Error('Failed to create visit');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visits'] });
      toast.success('Visit scheduled');
    },
  });
};

// Member Stats (for dashboard)
export const useAgentStats = () =>
  useQuery({
    queryKey: ['member-stats'],
    queryFn: async () => {
      const res = await fetch('/api/members/stats');
      if (!res.ok) throw new Error('Failed to fetch member stats');
      return res.json();
    },
  });

// Dashboard stats
export const useDashboardStats = () =>
  useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) throw new Error('Failed to fetch dashboard stats');
      return res.json();
    },
  });

export const useCreatorLeaderboard = (
  period: LeaderboardPeriod = 'this_month',
  zone?: string,
  customRange?: { from: string; to: string }
) =>
  useQuery({
    queryKey: ['creator-leaderboard', period, zone, customRange],
    queryFn: async () => {
      let url = `/api/leads/stats/by-creator?period=${period}`;
      if (zone && zone !== 'all') url += `&zone=${encodeURIComponent(zone)}`;
      if (period === 'custom' && customRange?.from && customRange?.to) {
        url += `&from=${customRange.from}&to=${customRange.to}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      return res.json() as Promise<CreatorLeaderboardResponse>;
    },
  });

export const useLeadsDailyProgress = (date: string) =>
  useQuery({
    queryKey: ['leads-daily-progress', date],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      const res = await fetch(`/api/leads/daily-progress?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch daily progress');
      return res.json() as Promise<LeadsDailyProgressResponse>;
    },
    staleTime: 30000,
  });

export const useOfficeZones = () =>
  useQuery({
    queryKey: ['office-zones'],
    queryFn: async () => {
      const res = await fetch('/api/zones');
      if (!res.ok) throw new Error('Failed to fetch office zones');
      return res.json();
    },
  });

export type PipelineStageConfig = {
  id?: string;
  key: string;
  label: string;
  color: string;
  order: number;
};

export const usePipelineStages = () =>
  useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: async () => {
      const res = await fetch('/api/pipeline-stages');
      if (!res.ok) throw new Error('Failed to fetch pipeline stages');
      return res.json() as Promise<PipelineStageConfig[]>;
    },
  });

export const useSavePipelineStages = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stages: PipelineStageConfig[]) => {
      const res = await fetch('/api/pipeline-stages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save pipeline stages');
      }
      return res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['pipeline-stages'] });
      await qc.invalidateQueries({ queryKey: ['leads'] });
      await qc.invalidateQueries({ queryKey: ['leads-paginated'] });
      await qc.invalidateQueries({ queryKey: ['leads', 'status'] });
      toast.success('Pipeline stages updated');
    },
  });
};

export const useZoneAnalytics = (params: {
  zone?: string;
  compareZone?: string;
  period?: AnalyticsPeriod;
  from?: string;
  to?: string;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: ['analytics-zone', params],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (params.zone && params.zone !== 'all') query.set('zone', params.zone);
      if (params.compareZone && params.compareZone !== 'all') query.set('compareZone', params.compareZone);
      if (params.period && params.period !== 'all') query.set('period', params.period);
      if (params.from) query.set('from', params.from);
      if (params.to) query.set('to', params.to);

      const suffix = query.toString();
      const res = await fetch(`/api/analytics/zones${suffix ? `?${suffix}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch zone analytics');
      return res.json() as Promise<ZoneAnalyticsResponse>;
    },
    enabled: params.enabled ?? true,
    staleTime: 30000,
  });

export const useMemberAnalytics = (params: {
  memberId?: string;
  compareMemberId?: string;
  zone?: string;
  period?: AnalyticsPeriod;
  from?: string;
  to?: string;
}) =>
  useQuery({
    queryKey: ['analytics-member', params],
    queryFn: async () => {
      if (!params.memberId) throw new Error('Member is required');

      const query = new URLSearchParams();
      query.set('memberId', params.memberId);
      if (params.compareMemberId && params.compareMemberId !== params.memberId) {
        query.set('compareMemberId', params.compareMemberId);
      }
      if (params.zone && params.zone !== 'all') query.set('zone', params.zone);
      if (params.period && params.period !== 'all') query.set('period', params.period);
      if (params.from) query.set('from', params.from);
      if (params.to) query.set('to', params.to);

      const res = await fetch(`/api/analytics/members?${query.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch member analytics');
      return res.json() as Promise<MemberAnalyticsResponse>;
    },
    enabled: Boolean(params.memberId),
    staleTime: 30000,
  });

export const useAnalyticsOptions = () =>
  useQuery({
    queryKey: ['analytics-options'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/options');
      if (!res.ok) throw new Error('Failed to fetch analytics options');
      return res.json() as Promise<AnalyticsOptionsResponse>;
    },
    staleTime: 30000,
  });

