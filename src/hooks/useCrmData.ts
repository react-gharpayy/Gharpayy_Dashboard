import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

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
  assignedMemberId?: string;
  createdAt: string;
  lastActivityAt: string;
};

export type LeaderboardPeriod = 'this_month' | 'all_time' | 'today' | 'last_30_days' | 'custom';

export type CreatorLeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  role: 'manager' | 'admin' | 'member';
  score: number;
  leadsCreated: number;
  zones: { zone: string; count: number }[];
};

export type CreatorLeaderboardResponse = {
  period: LeaderboardPeriod;
  from: string | null;
  to: string | null;
  generatedAt: string;
  rankings: CreatorLeaderboardEntry[];
};

export type LeadsQueryFilters = {
  q?: string;
  status?: string;
  source?: string;
  zone?: string;
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
export const useAllVisibleLeads = () =>
  useQuery({
    queryKey: ['leads-all-visible'],
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
      await qc.invalidateQueries({ queryKey: ['leads'] });
      await qc.invalidateQueries({ queryKey: ['leads-paginated'] });
      await qc.invalidateQueries({ queryKey: ['leads-infinite'] });
      await qc.invalidateQueries({ queryKey: ['leads', 'status'] });
      await qc.refetchQueries({ queryKey: ['leads-paginated'], type: 'active' });
    },
  });
};

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

