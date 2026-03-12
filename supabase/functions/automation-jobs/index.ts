// supabase/functions/automation-jobs/index.ts
// ─────────────────────────────────────────────────────────────
// Scheduled via Supabase pg_cron. Runs every 30 minutes.
// Handles:
//   1. Expire stale soft_locks
//   2. Recalculate lead scores
//   3. Cleanup expired reservations
//   4. Create overdue follow-up notifications
// ─────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!   // service role — bypasses RLS
);

// ── Structured logger ─────────────────────────────────────────
const log = {
  info:  (job: string, msg: string, data?: object) =>
    console.log(JSON.stringify({ level: 'info',  job, msg, ...data, ts: new Date().toISOString() })),
  error: (job: string, msg: string, err?: unknown) =>
    console.error(JSON.stringify({ level: 'error', job, msg, error: String(err), ts: new Date().toISOString() })),
  warn:  (job: string, msg: string, data?: object) =>
    console.warn(JSON.stringify({ level: 'warn',  job, msg, ...data, ts: new Date().toISOString() })),
};

// ── Job 1: Expire stale soft_locks ───────────────────────────
async function expireSoftLocks(): Promise<{ expired: number }> {
  const { error, count } = await supabase
    .from('soft_locks')
    .update({ is_active: false })
    .eq('is_active', true)
    .lt('expires_at', new Date().toISOString());

  if (error) throw error;

  const expired = count ?? 0;
  if (expired > 0) {
    log.info('expire_soft_locks', `Expired ${expired} soft lock(s)`);
  }
  return { expired };
}

// ── Job 2: Recalculate lead scores ───────────────────────────
async function recalculateLeadScores(): Promise<{ updated: number }> {
  // Call existing DB function
  const { error } = await supabase.rpc('recalculate_all_lead_scores');
  if (error) throw error;

  log.info('recalculate_scores', 'Lead scores recalculated');
  return { updated: -1 }; // count not returned by the function
}

// ── Job 3: Cleanup expired reservations ──────────────────────
async function cleanupStaleReservations(): Promise<{ cleaned: number }> {
  // Find expired pending reservations
  const { data: expired, error: fetchError } = await supabase
    .from('reservations')
    .select('id, bed_id, room_id')
    .eq('reservation_status', 'pending')
    .lt('expires_at', new Date().toISOString());

  if (fetchError) throw fetchError;
  if (!expired?.length) return { cleaned: 0 };

  const ids    = expired.map(r => r.id);
  const bedIds = expired.map(r => r.bed_id).filter(Boolean) as string[];

  // Mark reservations as expired
  const { error: updateError } = await supabase
    .from('reservations')
    .update({ reservation_status: 'expired' })
    .in('id', ids);
  if (updateError) throw updateError;

  // Release beds back to 'vacant'
  if (bedIds.length) {
    const { error: bedError } = await supabase
      .from('beds')
      .update({ status: 'vacant' })
      .in('id', bedIds)
      .eq('status', 'reserved');   // only release reserved, not booked
    if (bedError) throw bedError;
  }

  log.info('cleanup_reservations', `Cleaned ${expired.length} expired reservation(s)`, {
    ids,
    bedsReleased: bedIds.length,
  });

  return { cleaned: expired.length };
}

// ── Job 4: Create overdue notifications ──────────────────────
async function createOverdueNotifications(): Promise<{ created: number }> {
  // Call existing DB function
  const { error } = await supabase.rpc('create_overdue_notifications');
  if (error) throw error;

  log.info('overdue_notifications', 'Overdue notifications processed');
  return { created: -1 };
}

// ── Job 5: Auto-reassign stale leads ─────────────────────────
async function autoReassignStaleLeads(): Promise<{ reassigned: number }> {
  const STALE_HOURS = 24;
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

  // Find stale active leads
  const { data: staleLeads, error: fetchError } = await supabase
    .from('leads')
    .select('id, assigned_agent_id, name')
    .not('status', 'in', '("booked","lost")')
    .lt('last_activity_at', cutoff)
    .not('assigned_agent_id', 'is', null);

  if (fetchError) throw fetchError;
  if (!staleLeads?.length) return { reassigned: 0 };

  // Route each stale lead to next available agent via zone routing
  let reassigned = 0;
  for (const lead of staleLeads) {
    try {
      const { data: route } = await supabase
        .rpc('route_lead_to_zone', { p_location: '' });

      if (route?.[0]?.assigned_agent_id &&
          route[0].assigned_agent_id !== lead.assigned_agent_id) {
        await supabase
          .from('leads')
          .update({ assigned_agent_id: route[0].assigned_agent_id })
          .eq('id', lead.id);

        reassigned++;
        log.info('auto_reassign', `Lead ${lead.id} reassigned`, {
          from: lead.assigned_agent_id,
          to:   route[0].assigned_agent_id,
        });
      }
    } catch (err) {
      log.warn('auto_reassign', `Failed for lead ${lead.id}`, { err: String(err) });
    }
  }

  return { reassigned };
}

// ── Main handler ──────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Validate cron secret — prevents unauthorized trigger
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const results: Record<string, unknown> = {};
  const errors:  Record<string, string>  = {};
  const startedAt = Date.now();

  log.info('automation-jobs', 'Starting scheduled run');

  const jobs: [string, () => Promise<unknown>][] = [
    ['expire_soft_locks',           expireSoftLocks],
    ['recalculate_lead_scores',     recalculateLeadScores],
    ['cleanup_stale_reservations',  cleanupStaleReservations],
    ['create_overdue_notifications', createOverdueNotifications],
    ['auto_reassign_stale_leads',   autoReassignStaleLeads],
  ];

  for (const [name, fn] of jobs) {
    try {
      results[name] = await fn();
    } catch (err) {
      errors[name] = String(err);
      log.error(name, 'Job failed', err);
    }
  }

  const duration = Date.now() - startedAt;
  log.info('automation-jobs', `Completed in ${duration}ms`, { results, errors });

  return new Response(
    JSON.stringify({
      ok:       Object.keys(errors).length === 0,
      duration: `${duration}ms`,
      results,
      errors,
      ran_at:   new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
