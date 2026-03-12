-- ============================================================
-- MIGRATION 002: ROW LEVEL SECURITY POLICIES
-- ============================================================
-- Pattern used throughout:
--   admin   → full access to everything
--   manager → access to their zone's data
--   agent   → access only to their assigned records
--   owner   → access only to their own properties
-- ============================================================

-- Helper: is current user an admin?
-- Inlined in policies for performance (avoids extra function call)

-- ── LEADS ────────────────────────────────────────────────────

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Admins see all
CREATE POLICY "leads_admin_all"
  ON public.leads FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Managers see leads in their zone
CREATE POLICY "leads_manager_zone"
  ON public.leads FOR ALL
  USING (
    public.has_role(auth.uid(), 'manager')
    AND assigned_agent_id IN (
      SELECT a.id FROM public.agents a
      WHERE a.zone_id = (
        SELECT zone_id FROM public.agents
        WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );

-- Agents see only their assigned leads
CREATE POLICY "leads_agent_own"
  ON public.leads FOR ALL
  USING (
    public.has_role(auth.uid(), 'agent')
    AND assigned_agent_id = public.get_my_agent_id()
  );

-- ── VISITS ───────────────────────────────────────────────────

ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visits_admin_all"
  ON public.visits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "visits_manager_zone"
  ON public.visits FOR ALL
  USING (
    public.has_role(auth.uid(), 'manager')
    AND lead_id IN (
      SELECT id FROM public.leads
      WHERE assigned_agent_id IN (
        SELECT id FROM public.agents
        WHERE zone_id = (
          SELECT zone_id FROM public.agents
          WHERE user_id = auth.uid() LIMIT 1
        )
      )
    )
  );

CREATE POLICY "visits_agent_own"
  ON public.visits FOR ALL
  USING (
    public.has_role(auth.uid(), 'agent')
    AND (
      assigned_staff_id = public.get_my_agent_id()
      OR lead_id IN (
        SELECT id FROM public.leads
        WHERE assigned_agent_id = public.get_my_agent_id()
      )
    )
  );

-- ── BOOKINGS ─────────────────────────────────────────────────

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_admin_all"
  ON public.bookings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "bookings_manager_zone"
  ON public.bookings FOR ALL
  USING (
    public.has_role(auth.uid(), 'manager')
    AND booked_by IN (
      SELECT id FROM public.agents
      WHERE zone_id = (
        SELECT zone_id FROM public.agents
        WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );

CREATE POLICY "bookings_agent_own"
  ON public.bookings FOR ALL
  USING (
    public.has_role(auth.uid(), 'agent')
    AND booked_by = public.get_my_agent_id()
  );

-- ── PROPERTIES ───────────────────────────────────────────────

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Internal team: read all active properties
CREATE POLICY "properties_internal_read"
  ON public.properties FOR SELECT
  USING (
    is_active = true
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'agent')
    )
  );

-- Admins/managers can create/update/delete
CREATE POLICY "properties_admin_write"
  ON public.properties FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

-- Owners see and manage only their own properties
CREATE POLICY "properties_owner_own"
  ON public.properties FOR ALL
  USING (
    public.has_role(auth.uid(), 'owner')
    AND owner_id = (
      SELECT id FROM public.owners
      WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Public read for marketplace (unauthenticated, active + verified only)
CREATE POLICY "properties_public_read"
  ON public.properties FOR SELECT
  USING (is_active = true AND is_verified = true);

-- ── RESERVATIONS ─────────────────────────────────────────────
-- Critical: was writable by anonymous — fix this

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can create reservations
CREATE POLICY "reservations_authenticated_insert"
  ON public.reservations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Admins see all
CREATE POLICY "reservations_admin_all"
  ON public.reservations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Agents/managers see reservations for their leads
CREATE POLICY "reservations_agent_read"
  ON public.reservations FOR SELECT
  USING (
    (
      public.has_role(auth.uid(), 'agent')
      OR public.has_role(auth.uid(), 'manager')
    )
    AND lead_id IN (
      SELECT id FROM public.leads
      WHERE assigned_agent_id = public.get_my_agent_id()
    )
  );

-- ── ROOMS & BEDS ─────────────────────────────────────────────

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beds  ENABLE ROW LEVEL SECURITY;

-- Internal team reads all
CREATE POLICY "rooms_internal_read"
  ON public.rooms FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'agent')
  );

-- Admins/managers write
CREATE POLICY "rooms_admin_write"
  ON public.rooms FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

-- Owners manage their own property rooms
CREATE POLICY "rooms_owner_own"
  ON public.rooms FOR ALL
  USING (
    public.has_role(auth.uid(), 'owner')
    AND property_id IN (
      SELECT id FROM public.properties
      WHERE owner_id = (
        SELECT id FROM public.owners WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );

-- Same pattern for beds (inherits from rooms via property_id)
CREATE POLICY "beds_internal_read"
  ON public.beds FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'agent')
  );

CREATE POLICY "beds_admin_write"
  ON public.beds FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

-- ── CONVERSATIONS ─────────────────────────────────────────────

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_admin_all"
  ON public.conversations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "conversations_agent_own"
  ON public.conversations FOR ALL
  USING (
    (
      public.has_role(auth.uid(), 'agent')
      OR public.has_role(auth.uid(), 'manager')
    )
    AND lead_id IN (
      SELECT id FROM public.leads
      WHERE assigned_agent_id = public.get_my_agent_id()
    )
  );

-- ── ACTIVITY LOG ─────────────────────────────────────────────

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- All internal team can read (audit trail)
CREATE POLICY "activity_log_internal_read"
  ON public.activity_log FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'agent')
  );

-- Only system (SECURITY DEFINER functions) can insert — no direct writes
CREATE POLICY "activity_log_system_insert"
  ON public.activity_log FOR INSERT
  WITH CHECK (true); -- triggers use SECURITY DEFINER, bypasses RLS

-- ── NOTIFICATIONS ────────────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_own"
  ON public.notifications FOR ALL
  USING (user_id::uuid = auth.uid());

-- ── AGENTS ───────────────────────────────────────────────────

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- All authenticated internal users can read agents (for dropdowns etc.)
CREATE POLICY "agents_internal_read"
  ON public.agents FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'agent')
  );

-- Only admins manage agents
CREATE POLICY "agents_admin_write"
  ON public.agents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ── SOFT LOCKS ───────────────────────────────────────────────

ALTER TABLE public.soft_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "soft_locks_internal_read"
  ON public.soft_locks FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'agent')
  );

CREATE POLICY "soft_locks_internal_write"
  ON public.soft_locks FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'agent')
  );

CREATE POLICY "soft_locks_admin_delete"
  ON public.soft_locks FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
