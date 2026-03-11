import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ConversationThread {
  leadId:       string;
  leadName:     string;
  leadPhone:    string;
  leadBudget?:  string;
  leadLocation?: string;
  leadStatus?:  string;
  lastMessage:  string;
  lastMessageAt: string;
  channel:      string;
  messageCount: number;
  unreadCount:  number;
}

// ── THREADS ───────────────────────────────────────────────────
// RLS on conversations table scopes results to user's leads

export const useConversationThreads = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Realtime: invalidate threads when any new message arrives
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('conversations-threads-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        () => {
          qc.invalidateQueries({ queryKey: ['conversation-threads'] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  return useQuery({
    queryKey: ['conversation-threads'],
    enabled:  !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, leads(id, name, phone, budget, preferred_location, status)')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Group by lead_id — server already scoped by RLS
      const grouped: Record<string, ConversationThread> = {};
      for (const c of data ?? []) {
        const lid = c.lead_id;
        if (!grouped[lid]) {
          grouped[lid] = {
            leadId:       lid,
            leadName:     (c as any).leads?.name ?? 'Unknown',
            leadPhone:    (c as any).leads?.phone ?? '',
            leadBudget:   (c as any).leads?.budget ?? '',
            leadLocation: (c as any).leads?.preferred_location ?? '',
            leadStatus:   (c as any).leads?.status ?? 'new',
            lastMessage:  c.message,
            lastMessageAt: c.created_at,
            channel:      c.channel,
            messageCount: 0,
            unreadCount:  0,
          };
        }
        grouped[lid].messageCount++;
        if (c.direction === 'inbound') grouped[lid].unreadCount++;
        // Keep lastMessage as the most recent (already ordered desc)
      }

      return Object.values(grouped).sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
    },
  });
};

// ── MESSAGES (single lead) ────────────────────────────────────

export const useConversationMessages = (leadId: string | null) => {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Realtime: push new messages live into the query cache
  useEffect(() => {
    if (!user || !leadId) return;

    const channel = supabase
      .channel(`conversation-messages-${leadId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'conversations',
          filter: `lead_id=eq.${leadId}`,
        },
        (payload) => {
          qc.setQueryData(
            ['conversation-messages', leadId],
            (old: any[] | undefined) => [...(old ?? []), payload.new]
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, leadId, qc]);

  return useQuery({
    queryKey: ['conversation-messages', leadId],
    enabled:  !!user && !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, agents(id, name)')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
};

// ── SEND MESSAGE ─────────────────────────────────────────────

export const useSendMessage = () => {
  const qc          = useQueryClient();
  const { agentId } = useAuth();   // ← always inject current agent

  return useMutation({
    mutationFn: async (msg: {
      lead_id:   string;
      message:   string;
      channel?:  string;
      agent_id?: string;  // optional override; falls back to auth agent
    }) => {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          lead_id:  msg.lead_id,
          message:  msg.message,
          direction: 'outbound',
          channel:  msg.channel ?? 'whatsapp',
          agent_id: msg.agent_id ?? agentId,   // ← never null
        })
        .select()
        .single();
      if (error) throw error;
      // activity_log entry created by DB trigger
      return data;
    },
    onSuccess: (_data, vars) => {
      // Threads invalidated via realtime subscription
      // Optimistic update already in cache via realtime INSERT event
      qc.invalidateQueries({ queryKey: ['conversation-threads'] });
      qc.invalidateQueries({ queryKey: ['conversation-messages', vars.lead_id] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to send message'),
  });
};

// ── MESSAGE TEMPLATES ────────────────────────────────────────

export const useMessageTemplates = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['message-templates'],
    enabled:  !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
};
