-- 070: auto_start_delay_seconds for tournaments + resilient notify_support_bot trigger

-- ── Auto-start delay column ───────────────────────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS auto_start_delay_seconds int DEFAULT 0;

-- ── Fix notify_support_bot: resilient UUID parsing ────────────────────────────
CREATE OR REPLACE FUNCTION notify_support_bot()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  support_group_id uuid;
  raw_val          text;
BEGIN
  SELECT value INTO raw_val FROM public.app_config WHERE key = 'support_group_id';

  BEGIN
    support_group_id := (
      regexp_matches(raw_val, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', 'i')
    )[1]::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF support_group_id IS NOT NULL AND NEW.conversation_id = support_group_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users WHERE id = NEW.sender_id AND is_bot = true
    ) THEN
      PERFORM pg_notify('support_message', json_build_object(
        'message_id',     NEW.id,
        'conversation_id',NEW.conversation_id,
        'sender_id',      NEW.sender_id,
        'content',        NEW.content,
        'created_at',     NEW.created_at
      )::text);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Clean any malformed support_group_id value in app_config
UPDATE public.app_config
SET value = (
  regexp_matches(value, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', 'i')
)[1]
WHERE key = 'support_group_id'
  AND value ~ '[^0-9a-f\-]';
