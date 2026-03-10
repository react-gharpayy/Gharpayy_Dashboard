-- Role Management
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'agent', 'owner', 'customer');

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Function to check role
CREATE OR REPLACE FUNCTION public.has_role(required_role app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = required_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transaction Tracking
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  gateway_transaction_id text,
  payment_method text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions" ON public.payment_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_id AND r.user_id = auth.uid()
    ) OR has_role('admin') OR has_role('manager')
  );

CREATE POLICY "Users can insert own transactions" ON public.payment_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_id AND r.user_id = auth.uid()
    )
  );

-- Replace restrictive policies on critical tables
-- First, drop the old permissive policies

DO $$
BEGIN
  -- reservations
  DROP POLICY IF EXISTS "Anyone read reservations" ON public.reservations;
  DROP POLICY IF EXISTS "Anyone insert reservations" ON public.reservations;
  DROP POLICY IF EXISTS "Anyone update reservations" ON public.reservations;

  -- properties
  DROP POLICY IF EXISTS "Anyone read properties" ON public.properties;
  DROP POLICY IF EXISTS "Auth users manage properties" ON public.properties;
  DROP POLICY IF EXISTS "Auth update properties" ON public.properties;
  
  -- leads
  DROP POLICY IF EXISTS "Anyone read leads" ON public.leads;
  DROP POLICY IF EXISTS "Auth users manage leads" ON public.leads;
  DROP POLICY IF EXISTS "Auth update leads" ON public.leads;
  
  -- reservations new policies
  CREATE POLICY "Users map reservations" ON public.reservations 
    FOR SELECT USING (
      user_id = auth.uid() OR has_role('admin') OR has_role('manager') OR has_role('agent') OR has_role('owner')
    );
    
  CREATE POLICY "Users insert reservations" ON public.reservations 
    FOR INSERT WITH CHECK (user_id = auth.uid());
    
  CREATE POLICY "Users update reservations" ON public.reservations 
    FOR UPDATE USING (
      user_id = auth.uid() OR has_role('admin') OR has_role('manager')
    );

  -- properties new policies
  CREATE POLICY "Anyone read properties" ON public.properties
    FOR SELECT USING (true);
    
  CREATE POLICY "Admins/Managers create properties" ON public.properties
    FOR INSERT WITH CHECK (has_role('admin') OR has_role('manager'));
    
  CREATE POLICY "Admins/Managers/Owners update properties" ON public.properties
    FOR UPDATE USING (
      has_role('admin') OR has_role('manager') OR
      (has_role('owner') AND owner_id = auth.uid())
    );

  -- leads new policies
  CREATE POLICY "Admins/Managers/Agents read leads" ON public.leads
    FOR SELECT USING (
      has_role('admin') OR has_role('manager') OR 
      (has_role('agent') AND assigned_agent_id = auth.uid()) OR
      has_role('agent') -- Let all agents read for now
    );
    
  CREATE POLICY "Anyone insert leads" ON public.leads
    FOR INSERT WITH CHECK (true); -- Public lead capture
    
  CREATE POLICY "Admins/Managers/Agents update leads" ON public.leads
    FOR UPDATE USING (has_role('admin') OR has_role('manager') OR has_role('agent'));
END $$;

-- pg_cron setup for background jobs
-- We assume pg_cron is available in Supabase
-- If pg_cron is not enabled, enable it
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule jobs (for stale lock cleanup, score recalculations)
-- Suppose we have cleanup functions. Create a basic cleanup function if not exists
CREATE OR REPLACE FUNCTION public.cleanup_stale_locks()
RETURNS void AS $$
BEGIN
  DELETE FROM public.soft_locks WHERE created_at < now() - interval '15 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule it to run every 5 minutes
SELECT cron.schedule('cleanup-locks', '*/5 * * * *', 'SELECT public.cleanup_stale_locks();');

