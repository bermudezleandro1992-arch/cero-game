-- Migration 038: Enforce plan limits on tournament creation
-- Adds backend RPC that validates daily tournament limits and participant caps per role

-- Daily limits per role (matches src/lib/roles.js ROLE_LIMITS)
CREATE OR REPLACE FUNCTION get_role_daily_limit(p_role text)
RETURNS int
LANGUAGE sql
IMMUTABLE AS $$
  SELECT CASE p_role
    WHEN 'ceo'         THEN 999
    WHEN 'admin'       THEN 99
    WHEN 'comunidad'   THEN 20
    WHEN 'vip'         THEN 10
    WHEN 'moderador'   THEN 5
    WHEN 'organizador' THEN 3
    ELSE 1  -- member / default
  END;
$$;

CREATE OR REPLACE FUNCTION get_role_max_participants(p_role text)
RETURNS int
LANGUAGE sql
IMMUTABLE AS $$
  SELECT CASE p_role
    WHEN 'ceo'         THEN 9999
    WHEN 'admin'       THEN 9999
    WHEN 'comunidad'   THEN 9999
    WHEN 'vip'         THEN 128
    WHEN 'moderador'   THEN 64
    WHEN 'organizador' THEN 32
    ELSE 8   -- member / default (sin plan)
  END;
$$;

-- RPC: validate_tournament_creation
-- Returns { ok: bool, error: text, daily_remaining: int, max_participants: int }
CREATE OR REPLACE FUNCTION validate_tournament_creation(
  p_max_participants int DEFAULT 8
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
  v_role    text;
  v_max_p   int;
  v_daily   int;
  v_today   int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT COALESCE(role, 'member') INTO v_role
  FROM users WHERE id = v_user_id;

  v_max_p := get_role_max_participants(v_role);
  v_daily := get_role_daily_limit(v_role);

  -- Check participant cap
  IF p_max_participants > v_max_p THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'participant_limit_exceeded',
      'max_participants', v_max_p,
      'daily_remaining', v_daily
    );
  END IF;

  -- Count tournaments created today
  SELECT COUNT(*) INTO v_today
  FROM conversations
  WHERE created_by = v_user_id
    AND group_type IN ('tournament', 'liga')
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');

  IF v_today >= v_daily THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'daily_limit_reached',
      'daily_limit', v_daily,
      'daily_remaining', 0,
      'max_participants', v_max_p
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'daily_remaining', v_daily - v_today,
    'max_participants', v_max_p
  );
END;
$$;

GRANT EXECUTE ON FUNCTION validate_tournament_creation(int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_role_daily_limit(text)        TO authenticated;
GRANT EXECUTE ON FUNCTION get_role_max_participants(text)   TO authenticated;
