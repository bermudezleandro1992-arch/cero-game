-- 044: DB trigger to send push notifications on new messages via pg_net
-- This fires the send-notification edge function automatically on every INSERT to messages.
-- Requires pg_net extension (enabled by default in Supabase hosted projects).

-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function called by the trigger
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://gxberqtxbnrnudawwyzd.supabase.co/functions/v1/send-notification';
  v_service_key text := current_setting('app.service_role_key', true);
BEGIN
  -- Fire and forget — don't block the INSERT if this fails
  BEGIN
    PERFORM extensions.http_post(
      url      := v_url,
      body     := row_to_json(NEW)::text,
      headers  := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Silently ignore errors so the message INSERT always succeeds
    NULL;
  END;
  RETURN NEW;
END;
$$;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trg_notify_on_new_message ON public.messages;

-- Create trigger — fires AFTER each INSERT, async (via http_post which is non-blocking)
CREATE TRIGGER trg_notify_on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_message();

-- ─────────────────────────────────────────────────────────────────────────────
-- IMPORTANT: Set the service role key as a DB setting so the trigger can use it.
-- Run this in Supabase SQL Editor (replace with your actual service role key):
--
--   ALTER DATABASE postgres SET app.service_role_key = 'eyJ...your_service_role_key...';
--
-- You can find it in Supabase Dashboard → Settings → API → service_role key.
-- ─────────────────────────────────────────────────────────────────────────────
