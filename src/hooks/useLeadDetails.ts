import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { broadcastLeadsUpdated } from '@/lib/leadSync';

export const useConversations = (leadId?: string) =>
  useQuery({
    queryKey: ['conversations', leadId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations?leadId=${leadId}`);
      if (!res.ok) throw new Error('Failed to fetch conversations');
      return res.json();
    },
    enabled: !!leadId,
  });

export const useFollowUps = (leadId?: string) =>
  useQuery({
    queryKey: ['follow-ups', leadId],
    queryFn: async () => {
      const res = await fetch(`/api/reminders?leadId=${leadId}`);
      if (!res.ok) throw new Error('Failed to fetch follow-ups');
      return res.json();
    },
    enabled: !!leadId,
  });

export const useCreateFollowUp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create follow-up');
      return res.json();
    },
    onSuccess: (_, vars: any) => {
      qc.invalidateQueries({ queryKey: ['follow-ups', vars.leadId] });
      qc.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
};

export const useAllReminders = () =>
  useQuery({
    queryKey: ['reminders'],
    queryFn: async () => {
      const res = await fetch('/api/reminders');
      if (!res.ok) throw new Error('Failed to fetch reminders');
      return res.json();
    },
  });

export const useCompleteFollowUp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: true }),
      });
      if (!res.ok) throw new Error('Failed to complete follow-up');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
};

export const useBulkUpdateLeads = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: any }) => {
      const res = await fetch('/api/leads/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, updates }),
      });
      if (!res.ok) throw new Error('Failed to bulk update leads');
      return res.json();
    },
    onSuccess: () => {
      broadcastLeadsUpdated();
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['leads-paginated'] });
    },
  });
};
