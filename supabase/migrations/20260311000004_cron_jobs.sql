-- ============================================================
-- MIGRATION 004: CRON JOBS (pg_cron)
-- ============================================================
-- Run this in Supabase SQL Editor.
-- Requires pg_cron extension (enabled by default on Supabase).
-- ============================================================

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- ── Job 1: Automation jobs edge function (every 30 min) ───────
-- Calls the automation-jobs edge function
SELECT cron.schedule(
  'automation-jobs-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://szlsbeuewzkiblalvnpz.supabase.co/functions/v1/automation-jobs',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer gharpayy-cron-2026'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ── Job 2: Lead score refresh (every hour) ────────────────────
SELECT cron.schedule(
  'recalculate-lead-scores-hourly',
  '0 * * * *',
  $$ SELECT public.recalculate_all_lead_scores(); $$
);

-- ── Job 3: Lock stale rooms (every 6 hours) ───────────────────
SELECT cron.schedule(
  'auto-lock-stale-rooms-6h',
  '0 */6 * * *',
  $$ SELECT public.auto_lock_stale_rooms(); $$
);

-- ── Job 4: Overdue notifications (every day at 9am IST) ───────
-- 9:00 IST = 3:30 UTC
SELECT cron.schedule(
  'overdue-notifications-daily',
  '30 3 * * *',
  $$ SELECT public.create_overdue_notifications(); $$
);

-- ── Verify jobs are scheduled ─────────────────────────────────
SELECT jobid, schedule, command, nodename, active
FROM cron.job
ORDER BY jobid;

-- ── To remove a job (if needed) ───────────────────────────────
-- SELECT cron.unschedule('automation-jobs-30min');
-- SELECT cron.unschedule('recalculate-lead-scores-hourly');
-- SELECT cron.unschedule('auto-lock-stale-rooms-6h');
-- SELECT cron.unschedule('overdue-notifications-daily');

-- ============================================================
-- ENVIRONMENT VARIABLES TO SET IN SUPABASE DASHBOARD
-- Settings → Edge Functions → Secrets
-- ============================================================
--
-- CRON_SECRET          = <generate with: openssl rand -hex 32>
-- RAZORPAY_KEY_ID      = rzp_live_xxxxxxxxxxxx
-- RAZORPAY_KEY_SECRET  = <from Razorpay dashboard>
--
-- In Supabase SQL Editor, set app config for cron calls:
-- ALTER DATABASE postgres SET app.supabase_url = 'https://zkmnxqenyyuglbgmtpkk.supabase.co';
-- ALTER DATABASE postgres SET app.cron_secret = 'gharpayy-cron-secret-mtpkk';
