-- 074: Fix fill_tournament_bots to never exceed max_participants
-- Also cleans up existing overflow bot entries

-- 1. Replace fill_tournament_bots with a safe version that checks current count
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
  v_bot_id        uuid;
  v_i             int;
  v_username      text;
  v_email         text;
  v_max           int;
  v_current       int;
  v_safe_slots    int;
BEGIN
  SELECT max_participants INTO v_max
  FROM public.conversations
  WHERE id = p_tournament_id;

  SELECT COUNT(*)::int INTO v_current
  FROM public.conversation_members
  WHERE conversation_id = p_tournament_id;

  v_safe_slots := LEAST(p_slots, COALESCE(v_max, p_slots) - v_current);

  IF v_safe_slots <= 0 THEN
    RETURN;
  END IF;

  FOR v_i IN 1..v_safe_slots LOOP
    v_bot_id   := gen_random_uuid();
    v_username := 'bot_' || substr(replace(v_bot_id::text, '-', ''), 1, 8);
    v_email    := v_username || '@bot.nexotribu.internal';

    INSERT INTO auth.users (
      id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, role, aud
    )
    VALUES (
      v_bot_id, v_email, '', now(),
      now(), now(), 'authenticated', 'authenticated'
    )
    ON CONFLICT DO NOTHING;

    INSERT INTO public.users (id, username, display_name, is_bot, bot_type, created_at)
    VALUES (v_bot_id, v_username, 'Bot ' || v_i, true, 'tournament', now())
    ON CONFLICT DO NOTHING;

    INSERT INTO public.conversation_members (conversation_id, user_id, joined_at)
    VALUES (p_tournament_id, v_bot_id, now())
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION fill_tournament_bots(uuid, int) TO authenticated;

-- 2. Clean up overflow bots
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.id, c.max_participants,
           COUNT(cm.user_id) AS current_count
    FROM public.conversations c
    JOIN public.conversation_members cm ON cm.conversation_id = c.id
    WHERE c.group_type IN ('tournament', 'liga')
      AND c.max_participants IS NOT NULL
    GROUP BY c.id, c.max_participants
    HAVING COUNT(cm.user_id) > c.max_participants
  LOOP
    DELETE FROM public.conversation_members
    WHERE conversation_id = r.id
      AND user_id IN (
        SELECT cm2.user_id
        FROM public.conversation_members cm2
        JOIN public.users u ON u.id = cm2.user_id
        WHERE cm2.conversation_id = r.id
          AND u.is_bot = true
        ORDER BY cm2.joined_at DESC
        LIMIT (r.current_count - r.max_participants)
      );
  END LOOP;
END;
$$;
