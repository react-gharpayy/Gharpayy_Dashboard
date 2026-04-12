import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const useNotifications = () => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json();
    },
  });
};

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications?id=${id}`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to mark notification as read');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
};

export const useMarkAllRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications?all=true', {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to mark all notifications as read');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
};

export const useAcceptLeadAssignment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, notificationId }: { leadId: string; notificationId: string }) => {
      const res = await fetch(`/api/leads/${leadId}/accept`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to accept lead assignment');
      }
      return res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['notifications'] });
      await qc.invalidateQueries({ queryKey: ['leads'] });
      await qc.invalidateQueries({ queryKey: ['leads-paginated'] });
      await qc.invalidateQueries({ queryKey: ['leads-infinite'] });
    },
  });
};

export const usePassOnLeadAssignment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      leadId,
      notificationId,
      targetMemberId,
    }: {
      leadId: string;
      notificationId: string;
      targetMemberId: string;
    }) => {
      const res = await fetch(`/api/leads/${leadId}/pass-on`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, targetMemberId }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to pass on lead assignment');
      }
      return res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['notifications'] });
      await qc.invalidateQueries({ queryKey: ['leads'] });
      await qc.invalidateQueries({ queryKey: ['leads-paginated'] });
      await qc.invalidateQueries({ queryKey: ['leads-infinite'] });
    },
  });
};

