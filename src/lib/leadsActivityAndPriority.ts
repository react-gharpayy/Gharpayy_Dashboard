export type ActivityTypeConfig = {
  key: string;
  label: string;
  stageEffect: string | null;
};

export const LOST_REASONS = [
  'Budget too low',
  'Found another PG',
  'Plans changed',
  'No response after 5+ attempts',
  'Wrong location',
  'Move date pushed 3+ months',
  'Duplicate lead',
  'Wrong number',
] as const;

export const ACTIVITY_TYPES: ActivityTypeConfig[] = [
  { key: 'called_answer', label: '📞 Called - Answered', stageEffect: 'contacted' },
  { key: 'called_noans', label: '📵 Called - No Answer', stageEffect: null },
  { key: 'called_busy', label: '📵 Called - Busy', stageEffect: null },
  { key: 'whatsapp_sent', label: '💬 WhatsApp Sent', stageEffect: null },
  { key: 'whatsapp_reply', label: '💬 WhatsApp - Replied', stageEffect: 'contacted' },
  { key: 'visit_sched', label: '📍 Visit Scheduled', stageEffect: 'visit_scheduled' },
  { key: 'visit_done', label: '✅ Visit Completed', stageEffect: 'visit_completed' },
  { key: 'visit_cancel', label: '❌ Visit Cancelled', stageEffect: 'requirement_collected' },
  { key: 'price_discuss', label: '💰 Price Discussed', stageEffect: 'property_suggested' },
  { key: 'offer_sent', label: '📋 Offer Sent', stageEffect: 'property_suggested' },
  { key: 'booking_done', label: '🎉 Booking Confirmed', stageEffect: 'booked' },
  { key: 'checkin_done', label: '🏠 Check-In Completed', stageEffect: 'booked' },
  { key: 'lead_cold', label: '🧊 Lead Went Cold', stageEffect: null },
  { key: 'system', label: '⚙ System', stageEffect: null },
];

export const ACTIVITY_TYPE_KEYS = new Set(ACTIVITY_TYPES.map((item) => item.key));

export function getActivityTypesForStages(stageKeys: string[]): ActivityTypeConfig[] {
  const hasNegotiation = stageKeys.includes('negotiation');
  const hasCheckIn = stageKeys.includes('check_in');

  return ACTIVITY_TYPES.map((item) => {
    if (item.key === 'price_discuss' || item.key === 'offer_sent') {
      return { ...item, stageEffect: hasNegotiation ? 'negotiation' : 'property_suggested' };
    }

    if (item.key === 'checkin_done') {
      return { ...item, stageEffect: hasCheckIn ? 'check_in' : 'booked' };
    }

    return item;
  });
}

export function actIcon(type: string) {
  const map: Record<string, string> = {
    called_answer: '📞',
    called_noans: '📵',
    called_busy: '📵',
    whatsapp_sent: '💬',
    whatsapp_reply: '💬',
    visit_sched: '📍',
    visit_done: '✅',
    visit_cancel: '❌',
    price_discuss: '💰',
    offer_sent: '📋',
    booking_done: '🎉',
    checkin_done: '🏠',
    lead_cold: '🧊',
    system: '⚙',
  };

  return map[type] || '•';
}

export function actColor(type: string) {
  if (['called_answer', 'whatsapp_reply', 'visit_done', 'booking_done', 'checkin_done'].includes(type)) return '#34d399';
  if (['called_noans', 'called_busy', 'lead_cold'].includes(type)) return '#f87171';
  if (['visit_sched', 'price_discuss', 'offer_sent'].includes(type)) return '#f59e0b';
  if (type === 'system') return '#475569';
  return '#60a5fa';
}

export function formatActivityDate(dateLike: string | number | Date) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '-';
  const datePart = date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
  const timePart = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart} ${timePart}`;
}

export type StageTimerConfig = {
  label: string;
  maxDays: number | null;
  rule: string | null;
};

export type StageTimer = {
  pct: number;
  over: boolean;
  daysIn: number;
  daysLeft: number;
  rule: string;
  label: string;
} | null;

export const STAGE_TIMER_DEFAULTS: Record<string, StageTimerConfig> = {
  new: { label: 'New', maxDays: 1, rule: 'First call within 1 day' },
  contacted: { label: 'Contacted', maxDays: 2, rule: 'Follow-up within 2 days' },
  requirement_collected: { label: 'Requirement Collected', maxDays: 5, rule: 'Schedule visit within 5 days' },
  property_suggested: { label: 'Property Suggested', maxDays: 5, rule: 'Move toward visit completion' },
  visit_scheduled: { label: 'Visit Scheduled', maxDays: 2, rule: 'Confirm visit completion within 2 days' },
  visit_completed: { label: 'Visit Completed', maxDays: 2, rule: 'Negotiation call within 2 days' },
  negotiation: { label: 'Negotiation', maxDays: 5, rule: 'Push decision within 5 days' },
  booked: { label: 'Booked', maxDays: null, rule: null },
  check_in: { label: 'Check-In', maxDays: null, rule: null },
  lost: { label: 'Lost', maxDays: null, rule: null },
};

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (!Number.isNaN(date.getTime())) return date;
  return null;
}

export function daysSince(value: unknown): number | null {
  const date = toDate(value);
  if (!date) return null;
  const diff = Date.now() - date.getTime();
  return Math.floor(diff / 86400000);
}

export function daysUntil(value: unknown): number | null {
  const date = toDate(value);
  if (!date) return null;
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - startToday.getTime()) / 86400000);
}

export type PriorityLeadLike = {
  status?: string;
  moveInDate?: string;
  stageOn?: string | Date;
  lastOn?: string | Date;
  nextOn?: string | Date;
  visitOn?: string | Date;
  visitDoneOn?: string | Date;
  touches?: number;
  createdAt?: string | Date;
  parsedMetadata?: Record<string, any>;
  assignedMemberId?: string;
  phone?: string;
  budget?: string;
};

export function getStageTimer(lead: PriorityLeadLike, stageMap?: Record<string, StageTimerConfig>): StageTimer {
  const stageKey = String(lead.status || 'new');
  const stage = (stageMap && stageMap[stageKey]) || STAGE_TIMER_DEFAULTS[stageKey];
  if (!stage || !stage.maxDays) return null;

  const daysInStage = daysSince(lead.stageOn) || 0;
  const percentage = Math.min(100, Math.round((daysInStage / stage.maxDays) * 100));

  return {
    pct: percentage,
    over: daysInStage > stage.maxDays,
    daysIn: daysInStage,
    daysLeft: Math.max(0, stage.maxDays - daysInStage),
    rule: stage.rule || '',
    label: stage.label,
  };
}

export type LeadBand = 'fire' | 'stuck' | 'dormant' | 'future' | 'active' | 'closed';

export function getBand(lead: PriorityLeadLike, stageMap?: Record<string, StageTimerConfig>): LeadBand {
  const moveInDays = daysUntil(lead.moveInDate);
  const stageTimer = getStageTimer(lead, stageMap);
  const lastContactDays = daysSince(lead.lastOn);
  const scn = String(lead.parsedMetadata?.scn || lead.parsedMetadata?.scenario || '').toLowerCase();

  if (['booked', 'check_in', 'lost'].includes(String(lead.status || ''))) return 'closed';

  if (scn === 'revival') return 'fire';
  if ((lead.touches || 0) === 0 && ['immediate', 'lease_ending'].includes(scn)) return 'fire';
  if (moveInDays !== null && moveInDays >= 0 && moveInDays <= 7) return 'fire';

  if (stageTimer?.over) return 'stuck';
  if (lead.nextOn && (daysUntil(lead.nextOn) || 0) < 0) return 'stuck';
  if (lead.status === 'visit_completed' && (daysSince(lead.visitDoneOn) || 0) > 2) return 'stuck';
  if ((lead.touches || 0) === 0 && (daysSince(lead.createdAt) || 0) > 7) return 'stuck';

  if (lastContactDays !== null && lastContactDays > 30) return 'dormant';
  if (moveInDays !== null && moveInDays > 45) return 'future';

  return 'active';
}

export type MandatoryQueueItem = {
  leadId: string;
  priority: number;
  reason: string;
  cta: string;
};

export type MandatoryLeadLike = PriorityLeadLike & {
  id: string;
  assignedMemberId?: string;
};

export function getMandatoryQueue(leads: MandatoryLeadLike[], currentUserId: string, stageMap?: Record<string, StageTimerConfig>) {
  const queue: MandatoryQueueItem[] = [];

  leads.forEach((lead) => {
    if (!lead.assignedMemberId || String(lead.assignedMemberId) !== String(currentUserId)) return;
    if (['booked', 'check_in', 'lost'].includes(String(lead.status || ''))) return;

    const timer = getStageTimer(lead, stageMap);
    const moveInDays = daysUntil(lead.moveInDate);
    const followUpDays = daysUntil(lead.nextOn);
    const scn = String(lead.parsedMetadata?.scn || lead.parsedMetadata?.scenario || '').toLowerCase();

    if ((lead.touches || 0) === 0) {
      queue.push({ leadId: lead.id, priority: 1, reason: `Never called - added ${daysSince(lead.createdAt) || 0}d ago`, cta: 'Call Now' });
      return;
    }

    if (scn === 'revival') {
      queue.push({ leadId: lead.id, priority: 1, reason: 'REVIVAL - re-enquired today. Call now.', cta: 'Call Now' });
      return;
    }

    if (moveInDays !== null && moveInDays >= 0 && moveInDays <= 3) {
      queue.push({ leadId: lead.id, priority: 1, reason: moveInDays === 0 ? 'Move-in TODAY - close this now' : `Move-in in ${moveInDays}d - close this now`, cta: 'Close Now' });
      return;
    }

    if (lead.status === 'visit_scheduled' && lead.visitOn) {
      const visitInDays = daysUntil(lead.visitOn);
      if (visitInDays !== null && visitInDays >= 0 && visitInDays <= 1) {
        queue.push({
          leadId: lead.id,
          priority: 1,
          reason: visitInDays === 0 ? 'Visit TODAY - confirm with lead' : 'Visit TOMORROW - confirm with lead',
          cta: 'Confirm',
        });
        return;
      }
    }

    if (lead.status === 'visit_completed' && (daysSince(lead.visitDoneOn) || 0) > 2) {
      queue.push({ leadId: lead.id, priority: 2, reason: `Visit done ${daysSince(lead.visitDoneOn) || 0}d ago - no follow-up made`, cta: 'Call Now' });
      return;
    }

    if (timer?.over) {
      queue.push({ leadId: lead.id, priority: 2, reason: `${timer.daysIn}d in '${timer.label}': ${timer.rule}`, cta: 'Act Now' });
      return;
    }

    if (followUpDays !== null && followUpDays < 0) {
      queue.push({ leadId: lead.id, priority: 3, reason: `Follow-up ${Math.abs(followUpDays)}d overdue`, cta: 'Follow Up' });
    }
  });

  return queue.sort((a, b) => a.priority - b.priority);
}

export type AutoTag = {
  label: string;
  color: string;
  urgent: boolean;
};

export function getAutoTags(lead: PriorityLeadLike): AutoTag[] {
  const tags: AutoTag[] = [];
  const moveInDays = daysUntil(lead.moveInDate);
  const lastContactDays = daysSince(lead.lastOn);
  const daysInStage = daysSince(lead.stageOn) || 0;
  const stage = STAGE_TIMER_DEFAULTS[String(lead.status || '')];
  const scn = String(lead.parsedMetadata?.scn || lead.parsedMetadata?.scenario || '').toLowerCase();
  const budgetNumber = Number.parseInt(String(lead.budget || '').replace(/[^\d]/g, ''), 10);

  if ((lead.touches || 0) === 0) tags.push({ label: 'Never Called', color: '#fca5a5', urgent: true });
  if (moveInDays !== null && moveInDays >= 0 && moveInDays <= 3) tags.push({ label: moveInDays === 0 ? 'Move-in TODAY' : `Move-in in ${moveInDays}d`, color: '#ef4444', urgent: true });
  if (scn === 'revival') tags.push({ label: 'Revival', color: '#d97706', urgent: true });
  if (stage?.maxDays && daysInStage > stage.maxDays) tags.push({ label: `Stuck ${daysInStage}d`, color: '#f59e0b', urgent: true });
  if (lead.status === 'visit_completed' && (daysSince(lead.visitDoneOn) || 0) > 2) tags.push({ label: 'Post-Visit Ghost', color: '#f87171', urgent: true });

  if (moveInDays !== null && moveInDays > 3 && moveInDays <= 7) tags.push({ label: `Move-in in ${moveInDays}d`, color: '#f97316', urgent: false });
  if (lead.status === 'visit_scheduled' && lead.visitOn && daysUntil(lead.visitOn) === 0) tags.push({ label: 'Visit TODAY', color: '#34d399', urgent: false });
  if (lead.status === 'visit_scheduled' && lead.visitOn && daysUntil(lead.visitOn) === 1) tags.push({ label: 'Visit Tomorrow', color: '#4ade80', urgent: false });
  if (lastContactDays !== null && lastContactDays > 30) tags.push({ label: `Dormant ${lastContactDays}d`, color: '#6b7280', urgent: false });
  if (Number.isFinite(budgetNumber) && budgetNumber >= 12000) tags.push({ label: 'High Value', color: '#a78bfa', urgent: false });
  if ((lead.touches || 0) >= 5) tags.push({ label: 'Highly Engaged', color: '#34d399', urgent: false });
  if (lead.status === 'booked') tags.push({ label: 'Booked', color: '#34d399', urgent: false });

  return tags;
}

export function formatRelativeDay(value: unknown): string {
  const diff = daysUntil(value);
  if (diff === null) return '-';
  if (diff === 0) return 'TODAY';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  return `in ${diff}d`;
}
