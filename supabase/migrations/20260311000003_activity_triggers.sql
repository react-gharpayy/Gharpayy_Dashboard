-- ============================================================
-- MIGRATION 003: ACTIVITY LOG TRIGGERS
-- ============================================================
-- All activity logging happens at DB level via triggers.
-- This guarantees no action is ever silently missed,
-- regardless of which client (frontend, edge function, direct SQL)
-- makes the change.
-- ============================================================

-- ── LEADS TRIGGER ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_log_lead_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log (lead_id, action, agent_id, metadata)
    VALUES (
      NEW.id,
      'lead_created',
      NEW.assigned_agent_id,
      jsonb_build_object(
        'name',   NEW.name,
        'phone',  NEW.phone,
        'source', NEW.source
      )
    );

  ELSIF TG_OP = 'UPDATE' THEN

    -- Stage change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.activity_log (lead_id, action, agent_id, metadata)
      VALUES (
        NEW.id,
        'stage_changed',
        NEW.assigned_agent_id,
        jsonb_build_object('from', OLD.status, 'to', NEW.status)
      );
    END IF;

    -- Reassignment
    IF OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id THEN
      INSERT INTO public.activity_log (lead_id, action, agent_id, metadata)
      VALUES (
        NEW.id,
        'lead_reassigned',
        NEW.assigned_agent_id,
        jsonb_build_object(
          'from_agent_id', OLD.assigned_agent_id,
          'to_agent_id',   NEW.assigned_agent_id
        )
      );
    END IF;

    -- Notes updated
    IF OLD.notes IS DISTINCT FROM NEW.notes AND NEW.notes IS NOT NULL THEN
      INSERT INTO public.activity_log (lead_id, action, agent_id, metadata)
      VALUES (
        NEW.id,
        'note_added',
        NEW.assigned_agent_id,
        jsonb_build_object('note_preview', left(NEW.notes, 120))
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_activity
AFTER INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.trg_log_lead_activity();

-- ── VISITS TRIGGER ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_log_visit_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log (lead_id, action, agent_id, metadata)
    VALUES (
      NEW.lead_id,
      'visit_scheduled',
      NEW.assigned_staff_id,
      jsonb_build_object(
        'visit_id',    NEW.id,
        'property_id', NEW.property_id,
        'scheduled_at', NEW.scheduled_at
      )
    );

  ELSIF TG_OP = 'UPDATE' AND OLD.outcome IS DISTINCT FROM NEW.outcome AND NEW.outcome IS NOT NULL THEN
    INSERT INTO public.activity_log (lead_id, action, agent_id, metadata)
    VALUES (
      NEW.lead_id,
      'visit_outcome_set',
      NEW.assigned_staff_id,
      jsonb_build_object(
        'visit_id',    NEW.id,
        'outcome',     NEW.outcome,
        'property_id', NEW.property_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_visit_activity
AFTER INSERT OR UPDATE ON public.visits
FOR EACH ROW EXECUTE FUNCTION public.trg_log_visit_activity();

-- ── BOOKINGS TRIGGER ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_log_booking_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log (lead_id, action, agent_id, metadata)
    VALUES (
      NEW.lead_id,
      'booking_created',
      NEW.booked_by,
      jsonb_build_object(
        'booking_id',  NEW.id,
        'property_id', NEW.property_id,
        'bed_id',      NEW.bed_id,
        'monthly_rent', NEW.monthly_rent,
        'move_in_date', NEW.move_in_date
      )
    );

  ELSIF TG_OP = 'UPDATE'
    AND OLD.booking_status IS DISTINCT FROM NEW.booking_status THEN
    INSERT INTO public.activity_log (lead_id, action, agent_id, metadata)
    VALUES (
      NEW.lead_id,
      'booking_status_changed',
      NEW.booked_by,
      jsonb_build_object(
        'booking_id', NEW.id,
        'from',       OLD.booking_status,
        'to',         NEW.booking_status
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_booking_activity
AFTER INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.trg_log_booking_activity();

-- ── CONVERSATIONS TRIGGER ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_log_conversation_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.direction = 'outbound' THEN
    INSERT INTO public.activity_log (lead_id, action, agent_id, metadata)
    VALUES (
      NEW.lead_id,
      'message_sent',
      NEW.agent_id,
      jsonb_build_object(
        'channel',  NEW.channel,
        'preview',  left(NEW.message, 100)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_conversation_activity
AFTER INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.trg_log_conversation_activity();

-- ── AUTO-UPDATE last_activity_at on leads ────────────────────
-- Keeps the lead decay score fresh without extra frontend calls

CREATE OR REPLACE FUNCTION public.trg_touch_lead_on_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.leads
  SET last_activity_at = now()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_touch_on_activity
AFTER INSERT ON public.activity_log
FOR EACH ROW EXECUTE FUNCTION public.trg_touch_lead_on_activity();
