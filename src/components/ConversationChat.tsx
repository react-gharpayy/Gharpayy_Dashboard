import { useState, useRef, useEffect } from 'react';
import {
  useConversationMessages,
  useSendMessage,
  useMessageTemplates,
} from '@/hooks/useConversationThreads';
import { useAuth }  from '@/contexts/AuthContext';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Send, Zap, Sparkles, Loader2, Copy, Phone } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast }    from 'sonner';

interface Props {
  leadId:       string | null;
  leadName:     string;
  leadPhone?:   string;
  leadBudget?:  string;
  leadLocation?: string;
  leadStatus?:  string;
}

const ConversationChat = ({
  leadId,
  leadName,
  leadPhone,
  leadBudget,
  leadLocation,
  leadStatus,
}: Props) => {
  const { agentId }    = useAuth();
  const { data: messages, isLoading } = useConversationMessages(leadId);
  const sendMessage    = useSendMessage();
  const { data: templates }           = useMessageTemplates();

  const [text,           setText]           = useState('');
  const [aiSuggestions,  setAiSuggestions]  = useState<{ label: string; message: string }[]>([]);
  const [aiLoading,      setAiLoading]      = useState(false);
  const [channel,        setChannel]        = useState<'whatsapp' | 'sms' | 'in_app'>('whatsapp');

  const bottomRef    = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !leadId) return;

    setText('');
    setAiSuggestions([]);

    try {
      await sendMessage.mutateAsync({
        lead_id:  leadId,
        message:  trimmed,
        channel,
        agent_id: agentId ?? undefined,  // always set from auth context
      });
    } catch {
      // error toast shown by useSendMessage onError
      setText(trimmed); // restore on failure
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  };

  const handleSuggestReply = async () => {
    if (!messages?.length) {
      toast.info('No messages yet to suggest a reply for');
      return;
    }
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke('ai-suggest-reply', {
        body: {
          messages:     messages.slice(-5).map(m => ({
            role:    m.direction === 'outbound' ? 'agent' : 'lead',
            content: m.message,
          })),
          leadName,
          leadBudget:   leadBudget   ?? '',
          leadLocation: leadLocation ?? '',
          leadStatus:   leadStatus   ?? 'new',
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiSuggestions(data?.suggestions ?? []);
    } catch (e: any) {
      toast.error(e.message || 'AI suggestion failed');
    } finally {
      setAiLoading(false);
    }
  };

  // ── Empty state ───────────────────────────────────────────
  if (!leadId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <div className="text-3xl">💬</div>
        <p className="text-xs">Select a conversation to start messaging</p>
      </div>
    );
  }

  // ── Main chat ─────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-sm text-foreground leading-tight">
            {leadName}
          </h3>
          {leadPhone && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Phone size={9} /> {leadPhone}
            </p>
          )}
        </div>

        {/* Channel picker */}
        <div className="flex items-center gap-1">
          {(['whatsapp', 'sms', 'in_app'] as const).map(ch => (
            <button
              key={ch}
              onClick={() => setChannel(ch)}
              className={`text-[9px] font-semibold px-2 py-1 rounded-md transition-colors ${
                channel === ch
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              {ch === 'in_app' ? 'In-App' : ch.charAt(0).toUpperCase() + ch.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 size={16} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && messages?.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            No messages yet · Start the conversation below
          </p>
        )}

        {messages?.map(m => {
          const isOutbound = m.direction === 'outbound';
          return (
            <div
              key={m.id}
              className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
                  isOutbound
                    ? 'bg-accent text-accent-foreground rounded-br-md'
                    : 'bg-secondary text-foreground rounded-bl-md'
                }`}
              >
                {/* Agent name on outbound */}
                {isOutbound && (m as any).agents?.name && (
                  <p className="text-[9px] font-semibold opacity-70 mb-0.5">
                    {(m as any).agents.name}
                  </p>
                )}
                <p className="text-xs leading-relaxed whitespace-pre-wrap">{m.message}</p>
                <div className="flex items-center gap-1.5 mt-1 justify-end">
                  <span className="text-[9px] opacity-60">
                    {format(new Date(m.created_at), 'h:mm a')}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[8px] px-1 py-0 h-3.5 border-current/20"
                  >
                    {m.channel}
                  </Badge>
                </div>
              </div>
            </div>
          );
        })}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="border-t border-border px-3 py-2 space-y-1.5 bg-background">
          <p className="text-[10px] font-medium text-accent flex items-center gap-1">
            <Sparkles size={10} /> AI Suggestions
          </p>
          {aiSuggestions.map((s, i) => (
            <button
              key={i}
              className="w-full text-left p-2 rounded-lg bg-accent/5 border border-accent/10 hover:bg-accent/10 transition-colors group"
              onClick={() => { setText(s.message); setAiSuggestions([]); textareaRef.current?.focus(); }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-semibold text-accent">{s.label}</span>
                <Copy size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100" />
              </div>
              <p className="text-[10px] text-foreground mt-0.5 line-clamp-2">{s.message}</p>
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-border p-3 bg-background">
        <div className="flex items-end gap-2">

          {/* Template picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 shrink-0 rounded-xl">
                <Zap size={14} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1 max-h-52 overflow-y-auto">
              <p className="text-[10px] font-medium text-muted-foreground px-2 py-1">
                Quick Replies
              </p>
              {!templates?.length && (
                <p className="text-[10px] text-muted-foreground px-2 py-3 text-center">
                  No templates yet
                </p>
              )}
              {templates?.map(t => (
                <button
                  key={t.id}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-secondary text-xs transition-colors"
                  onClick={() => { setText(t.body); textareaRef.current?.focus(); }}
                >
                  <p className="font-medium text-foreground">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{t.body}</p>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* AI suggest */}
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 shrink-0 rounded-xl"
            onClick={handleSuggestReply}
            disabled={aiLoading}
            title="AI reply suggestion"
          >
            {aiLoading
              ? <Loader2 size={14} className="animate-spin" />
              : <Sparkles size={14} />
            }
          </Button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message via ${channel}…`}
            rows={1}
            className="flex-1 resize-none bg-secondary rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-accent overflow-hidden"
            style={{ minHeight: 36, maxHeight: 120 }}
          />

          <Button
            size="sm"
            className="h-9 w-9 p-0 shrink-0 rounded-xl"
            onClick={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
          >
            {sendMessage.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <Send size={14} />
            }
          </Button>
        </div>

        <p className="text-[9px] text-muted-foreground mt-1.5 text-right">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default ConversationChat;
