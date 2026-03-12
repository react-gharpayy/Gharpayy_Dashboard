-- ============================================================
-- MIGRATION 001: ROLE-BASED ACCESS CONTROL
-- ============================================================

-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'agent', 'owner');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        public.app_role NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 3. Enable RLS immediately
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role only
CREATE POLICY "user_roles_select_own"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Only admins can insert/update/delete roles
-- (Bootstrap: first admin must be set directly in DB by Supabase dashboard)
CREATE POLICY "user_roles_admin_all"
  ON public.user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- 4. has_role() — used in RLS policies throughout
CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
      AND role = p_role
  );
$$;

-- 5. get_my_role() — returns highest-privilege role for current user
-- Used by AuthContext on login
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'admin'   THEN 1
    WHEN 'manager' THEN 2
    WHEN 'agent'   THEN 3
    WHEN 'owner'   THEN 4
    ELSE 5
  END
  LIMIT 1;
$$;

-- 6. get_my_agent_id() — resolves auth.uid() → agents.id
-- Used by RLS policies and frontend hooks
CREATE OR REPLACE FUNCTION public.get_my_agent_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.agents
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- 7. Migrate agents.role (text) → app_role enum safely
-- Set any unrecognised values to 'agent' before casting
UPDATE public.agents
SET role = 'agent'
WHERE role NOT IN ('admin', 'manager', 'agent', 'owner');

ALTER TABLE public.agents
  ALTER COLUMN role DROP DEFAULT;

ALTER TABLE public.agents
  ALTER COLUMN role TYPE public.app_role
  USING role::public.app_role;

ALTER TABLE public.agents
  ALTER COLUMN role SET DEFAULT 'agent'::public.app_role;

-- 8. Add 'visited' to visit_outcome enum (was missing)
ALTER TYPE public.visit_outcome ADD VALUE IF NOT EXISTS 'visited';

-- 9. Sync: auto-insert into user_roles when agent record has a user_id
-- Backfill existing agents
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, role::public.app_role
FROM public.agents
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Trigger to keep user_roles in sync when agent is created/updated
CREATE OR REPLACE FUNCTION public.sync_agent_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, NEW.role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Remove old role if role changed
    IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role AND OLD.user_id IS NOT NULL THEN
      DELETE FROM public.user_roles
      WHERE user_id = OLD.user_id AND role = OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_agent_role
AFTER INSERT OR UPDATE OF role, user_id ON public.agents
FOR EACH ROW EXECUTE FUNCTION public.sync_agent_role();
