import { useQuery } from '@tanstack/react-query';

export const useActivityLog = (leadId: string | undefined) =>
  useQuery({
    queryKey: ['lead-activity', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}/activity`);
      if (!res.ok) throw new Error('Failed to fetch activity log');
      return res.json();
    },
  });

