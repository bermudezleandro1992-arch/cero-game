-- ═══════════════════════════════════════════════════════════════════════════
-- 058: Additional subscription RPCs (check_user_limit, get_user_communities)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── RPC: check_user_limit ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_user_limit(
  p_user_id    UUID,
  p_limit_type TEXT,
  p_value      INTEGER DEFAULT 1
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan    TEXT;
  v_limit   INTEGER;
  v_current INTEGER;
BEGIN
  v_plan := get_user_plan(p_user_id);

  CASE p_limit_type
    WHEN 'max_comunidades' THEN
      SELECT max_comunidades INTO v_limit FROM subscription_limits WHERE plan = v_plan;
      SELECT COUNT(*) INTO v_current FROM conversations
        WHERE created_by = p_user_id AND group_type = 'community';

    WHEN 'max_miembros_comunidad' THEN
      SELECT max_miembros_comunidad INTO v_limit FROM subscription_limits WHERE plan = v_plan;
      SELECT COUNT(*) INTO v_current FROM conversation_members
        WHERE conversation_id = p_value::UUID;

    WHEN 'max_torneos_simultaneos' THEN
      SELECT max_torneos_simultaneos INTO v_limit FROM subscription_limits WHERE plan = v_plan;
      SELECT COUNT(*) INTO v_current FROM conversations
        WHERE created_by = p_user_id
          AND group_type IN ('tournament','liga')
          AND tournament_status IN ('waiting','draw','en_curso');

    WHEN 'max_jugadores_torneo' THEN
      SELECT max_jugadores_torneo INTO v_limit FROM subscription_limits WHERE plan = v_plan;
      v_current := p_value;

    WHEN 'max_torneos_dia' THEN
      SELECT max_torneos_dia INTO v_limit FROM subscription_limits WHERE plan = v_plan;
      SELECT COUNT(*) INTO v_current FROM conversations
        WHERE created_by = p_user_id
          AND group_type IN ('tournament','liga')
          AND created_at > date_trunc('day', now());

    ELSE
      RETURN true;
  END CASE;

  RETURN COALESCE(v_current, 0) < COALESCE(v_limit, 999);
END; $$;

GRANT EXECUTE ON FUNCTION public.check_user_limit(UUID, TEXT, INTEGER) TO authenticated;

-- ── RPC: get_user_communities ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_communities(p_user_id UUID)
RETURNS TABLE(
  community_id   UUID,
  community_name TEXT,
  member_count   BIGINT,
  is_owner       BOOLEAN,
  role           TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    COUNT(cm2.user_id) AS member_count,
    (c.created_by = p_user_id) AS is_owner,
    cm.role
  FROM conversations c
  JOIN conversation_members cm  ON c.id = cm.conversation_id AND cm.user_id = p_user_id
  LEFT JOIN conversation_members cm2 ON c.id = cm2.conversation_id
  WHERE c.group_type = 'community'
  GROUP BY c.id, c.name, c.created_by, cm.role;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_user_communities(UUID) TO authenticated;
