import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Lead      = Database['public']['Tables']['leads']['Row'];
type Agent     = Database['public']['Tables']['agents']['Row'];
type Visit     = Database['public']['Tables']['visits']['Row'];
type Property  = Database['public']['Tables']['properties']['Row'];
type SoftLock  = Database['public']['Tables']['soft_locks']['Row'];

export type LeadWithRelations = Lead & {
  agents:     Pick<Agent, 'id' | 'name'> | null;
  properties: Pick<Property, 'id' | 'name'> | null;
};

export type VisitWithRelations = Visit & {
  leads:      Pick<Lead, 'id' | 'name'> | null;
  properties: Pick<Property, 'id' | 'name'> | null;
  agents:     Pick<Agent, 'id' | 'name'> | null;
};

// ── LEADS ─────────────────────────────────────────────────────

// All leads — RLS enforces role scoping at DB level
// No client-side filter needed: DB returns only what the user can see
export const useLeads = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['leads'],
    enabled:  !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*, agents(id, name), properties(id, name)')
        .order('last_activity_at', { ascending: false });
      if (error) throw error;
      return data as LeadWithRelations[];
    },
  });
};

export const useLeadsPaginated = (page = 0, pageSize = 50) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['leads-paginated', page, pageSize],
    enabled:  !!user,
    queryFn: async () => {
      const from = page * pageSize;
      const to   = from + pageSize - 1;
      const { data, error, count } = await supabase
        .from('leads')
        .select('*, agents(id, name), properties(id, name)', { count: 'exact' })
        .order('last_activity_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { leads: data as LeadWithRelations[], total: count ?? 0 };
    },
  });
};

export const useLeadsByStatus = (status: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['leads', 'status', status],
    enabled:  !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*, agents(id, name), properties(id, name)')
        .eq('status', status as any)
        .order('last_activity_at', { ascending: false });
      if (error) throw error;
      return data as LeadWithRelations[];
    },
  });
};

export const useCreateLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lead: Database['public']['Tables']['leads']['Insert']) => {
      const { data, error } = await supabase
        .from('leads')
        .insert(lead)
        .select()
        .single();
      if (error) throw error;
      return data;
      // activity_log entry created automatically by DB trigger
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create lead'),
  });
};

export const useUpdateLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Database['public']['Tables']['leads']['Update']) => {
      const { data, error } = await supabase
        .from('leads')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
      // stage_changed / lead_reassigned / note_added logged by DB trigger
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['activity-log'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update lead'),
  });
};

// ── AGENTS ───────────────────────────────────────────────────

export const useAgents = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['agents'],
    enabled:  !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
};

// ── PROPERTIES ───────────────────────────────────────────────

export const useProperties = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['properties'],
    enabled:  !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
};

// ── VISITS ───────────────────────────────────────────────────

export const useVisits = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['visits'],
    enabled:  !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('*, leads(id, name), properties(id, name), agents:assigned_staff_id(id, name)')
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return data as VisitWithRelations[];
    },
  });
};

export const useCreateVisit = () => {
  const qc           = useQueryClient();
  const { agentId }  = useAuth();

  return useMutation({
    mutationFn: async (visit: Database['public']['Tables']['visits']['Insert']) => {
      // 1. Create the visit
      const { data: visitData, error: visitError } = await supabase
        .from('visits')
        .insert({
          ...visit,
          assigned_staff_id: visit.assigned_staff_id ?? agentId,
        })
        .select()
        .single();
      if (visitError) throw visitError;

      // 2. Update lead status to visit_scheduled
      const { error: leadError } = await supabase
        .from('leads')
        .update({ status: 'visit_scheduled' })
        .eq('id', visit.lead_id);
      if (leadError) throw leadError;

      // 3. Create soft_lock to reserve the room/bed during visit window
      if (visit.room_id) {
        const lockExpiry = new Date(visit.scheduled_at as string);
        lockExpiry.setHours(lockExpiry.getHours() + 48); // 48-hr visit lock

        const { error: lockError } = await supabase
          .from('soft_locks')
          .insert({
            room_id:    visit.room_id,
            bed_id:     visit.bed_id ?? null,
            lead_id:    visit.lead_id,
            locked_by:  agentId,
            lock_type:  'visit_scheduled',
            expires_at: lockExpiry.toISOString(),
            is_active:  true,
          });
        if (lockError) {
          // Non-fatal: log but don't block visit creation
          console.warn('[useCreateVisit] soft_lock failed:', lockError.message);
        }
      }

      // activity_log entry created automatically by DB trigger
      return visitData;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['soft-locks'] });
      qc.invalidateQueries({ queryKey: ['activity-log'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to schedule visit'),
  });
};

export const useUpdateVisitOutcome = () => {
  const qc          = useQueryClient();
  const { agentId } = useAuth();

  return useMutation({
    mutationFn: async ({
      visitId,
      outcome,
      leadId,
      bedId,
      roomId,
      propertyId,
      monthlyRent,
      moveInDate,
    }: {
      visitId:      string;
      outcome:      Database['public']['Enums']['visit_outcome'];
      leadId:       string;
      bedId?:       string | null;
      roomId?:      string | null;
      propertyId?:  string | null;
      monthlyRent?: number | null;
      moveInDate?:  string | null;
    }) => {
      // 1. Update visit outcome
      const { error: visitError } = await supabase
        .from('visits')
        .update({ outcome, updated_at: new Date().toISOString() })
        .eq('id', visitId);
      if (visitError) throw visitError;

      // 2. Update lead status
      const newLeadStatus =
        outcome === 'booked'         ? 'booked'           :
        outcome === 'visited'        ? 'visit_completed'  :
        outcome === 'considering'    ? 'visit_completed'  :
        outcome === 'not_interested' ? 'lost'             :
        undefined;

      if (newLeadStatus) {
        const { error: leadError } = await supabase
          .from('leads')
          .update({ status: newLeadStatus })
          .eq('id', leadId);
        if (leadError) throw leadError;
      }

      // 3. If booked: create booking + lock bed
      if (outcome === 'booked' && bedId && propertyId) {
        const { error: bookingError } = await supabase
          .from('bookings')
          .insert({
            lead_id:        leadId,
            visit_id:       visitId,
            bed_id:         bedId,
            room_id:        roomId ?? null,
            property_id:    propertyId,
            booked_by:      agentId,
            booking_status: 'confirmed',
            payment_status: 'unpaid',
            monthly_rent:   monthlyRent ?? null,
            move_in_date:   moveInDate ?? null,
          });
        if (bookingError) throw bookingError;

        // Lock bed
        const { error: bedError } = await supabase
          .from('beds')
          .update({ status: 'booked' })
          .eq('id', bedId);
        if (bedError) throw bedError;
      }

      return { visitId, outcome };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['activity-log'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update visit outcome'),
  });
};

// ── ACTIVITY LOG ─────────────────────────────────────────────

export const useActivityLog = (leadId: string | null) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['activity-log', leadId],
    enabled:  !!user && !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*, agents(id, name)')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
};

// ── DASHBOARD STATS ───────────────────────────────────────────
// RLS automatically scopes results to user's accessible leads

export const useDashboardStats = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dashboard-stats'],
    enabled:  !!user,
    queryFn: async () => {
      const [leadsRes, visitsRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, status, first_response_time_min, source, created_at'),
        supabase
          .from('visits')
          .select('id, outcome, scheduled_at'),
      ]);
      if (leadsRes.error)  throw leadsRes.error;
      if (visitsRes.error) throw visitsRes.error;

      const leads  = leadsRes.data;
      const visits = visitsRes.data;
      const today  = new Date();
      today.setHours(0, 0, 0, 0);

      const totalLeads      = leads.length;
      const newToday        = leads.filter(l => new Date(l.created_at) >= today).length;
      const responseTimes   = leads.filter(l => l.first_response_time_min !== null).map(l => l.first_response_time_min!);
      const avgResponseTime = responseTimes.length
        ? +(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1)
        : 0;
      const withinSLA       = responseTimes.filter(t => t <= 5).length;
      const slaCompliance   = responseTimes.length
        ? Math.round((withinSLA / responseTimes.length) * 100)
        : 0;
      const slaBreaches     = responseTimes.filter(t => t > 5).length;
      const bookedLeads     = leads.filter(l => l.status === 'booked').length;
      const conversionRate  = totalLeads
        ? +((bookedLeads / totalLeads) * 100).toFixed(1)
        : 0;
      const upcomingVisits  = visits.filter(v => new Date(v.scheduled_at) >= today && !v.outcome).length;
      const completedVisits = visits.filter(v => v.outcome !== null).length;

      return {
        totalLeads,
        newToday,
        avgResponseTime,
        slaCompliance,
        slaBreaches,
        conversionRate,
        visitsScheduled:  upcomingVisits,
        visitsCompleted:  completedVisits,
        bookingsClosed:   bookedLeads,
      };
    },
  });
};

// ── AGENT STATS (managers + admins only) ─────────────────────

export const useAgentStats = () => {
  const { user, canManageTeam } = useAuth();
  return useQuery({
    queryKey: ['agent-stats'],
    enabled:  !!user && canManageTeam,
    queryFn: async () => {
      const [agentsRes, leadsRes] = await Promise.all([
        supabase.from('agents').select('*').eq('is_active', true),
        supabase.from('leads').select('id, status, assigned_agent_id, first_response_time_min'),
      ]);
      if (agentsRes.error) throw agentsRes.error;
      if (leadsRes.error)  throw leadsRes.error;

      return agentsRes.data.map(agent => {
        const agentLeads    = leadsRes.data.filter(l => l.assigned_agent_id === agent.id);
        const responseTimes = agentLeads.filter(l => l.first_response_time_min !== null).map(l => l.first_response_time_min!);
        const avgResponse   = responseTimes.length
          ? +(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1)
          : 0;
        return {
          ...agent,
          totalLeads:      agentLeads.length,
          activeLeads:     agentLeads.filter(l => !['booked', 'lost'].includes(l.status)).length,
          avgResponseTime: avgResponse,
          conversions:     agentLeads.filter(l => l.status === 'booked').length,
        };
      });
    },
  });
};
