-- 072: fill_tournament_bots RPC
-- Creates bot auth+public users and adds them to a tournament

CREATE OR REPLACE FUNCTION fill_tournament_bots(
  p_tournament_id uuid,
  p_slots         int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_bot_id   uuid;
  v_i        int;
  v_username text;
  v_email    text;
BEGIN
  FOR v_i IN 1..p_slots LOOP
    v_bot_id   := gen_random_uuid();
    v_username := 'bot_' || substr(replace(v_bot_id::text, '-', ''), 1, 8);
    v_email    := v_username || '@bot.nexotribu.internal';

    -- Create auth user row (SECURITY DEFINER with search_path=auth allows this)
    INSERT INTO auth.users (
      id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, role, aud
    )
    VALUES (
      v_bot_id, v_email, '', now(),
      now(), now(), 'authenticated', 'authenticated'
    )
    ON CONFLICT DO NOTHING;

    -- Create public user profile
    INSERT INTO public.users (id, username, display_name, is_bot, bot_type, created_at)
    VALUES (v_bot_id, v_username, 'Bot ' || v_i, true, 'tournament', now())
    ON CONFLICT DO NOTHING;

    -- Add as tournament member
    INSERT INTO public.conversation_members (conversation_id, user_id, joined_at)
    VALUES (p_tournament_id, v_bot_id, now())
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION fill_tournament_bots(uuid, int) TO authenticated;
