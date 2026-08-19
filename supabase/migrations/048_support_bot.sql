-- 048: Support bot infrastructure
-- Creates a bot user, support_tickets table, and the DB trigger that fires the edge function

-- ── Support tickets ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id            bigserial PRIMARY KEY,
  ticket_no     text UNIQUE NOT NULL,   -- e.g. "TKT-0042"
  user_id       uuid REFERENCES public.users(id),
  conversation_id uuid REFERENCES public.conversations(id),
  message_id    bigint,
  status        text DEFAULT 'open',    -- 'open' | 'in_progress' | 'resolved'
  assigned_to   uuid REFERENCES public.users(id),
  created_at    timestamptz DEFAULT now(),
  resolved_at   timestamptz
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Staff and CEO can see all tickets; users see their own
CREATE POLICY "staff can view tickets" ON public.support_tickets
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.users WHERE role IN ('ceo','admin','moderador')
    )
    OR auth.uid() = user_id
  );

CREATE POLICY "staff can update tickets" ON public.support_tickets
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM public.users WHERE role IN ('ceo','admin','moderador')
    )
  );

-- Sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START 1;

-- ── Bot system user flag ──────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_bot boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bot_type text;   -- 'support' | 'tournament' | null

-- ── Support group ID stored in app config ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_config (
  key   text PRIMARY KEY,
  value text
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read config; only CEO/admin can write
CREATE POLICY "anyone reads config" ON public.app_config FOR SELECT USING (true);
CREATE POLICY "admin writes config" ON public.app_config
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role IN ('ceo','admin'))
  );

-- ── Trigger: notify edge function when a message lands in support group ───────
CREATE OR REPLACE FUNCTION notify_support_bot()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  support_group_id uuid;
BEGIN
  SELECT value::uuid INTO support_group_id
  FROM public.app_config WHERE key = 'support_group_id';

  IF support_group_id IS NOT NULL AND NEW.conversation_id = support_group_id THEN
    -- Only trigger for non-bot senders
    IF NOT EXISTS (
      SELECT 1 FROM public.users WHERE id = NEW.sender_id AND is_bot = true
    ) THEN
      PERFORM pg_notify('support_message', json_build_object(
        'message_id', NEW.id,
        'conversation_id', NEW.conversation_id,
        'sender_id', NEW.sender_id,
        'content', NEW.content,
        'created_at', NEW.created_at
      )::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_bot_trigger ON public.messages;
CREATE TRIGGER support_bot_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION notify_support_bot();

-- ── RLS: bots can insert messages ─────────────────────────────────────────────
-- (existing messages policies should already cover service_role; this is a note)
-- The edge function uses the service role key, so RLS is bypassed.
