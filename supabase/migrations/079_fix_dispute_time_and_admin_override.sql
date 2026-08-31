-- 079: Fix missing dispute_time_min column + admin override match result RPC

-- 1. Add columns that may be missing from migration 047
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS dispute_time_min     int  DEFAULT 10,
  ADD COLUMN IF NOT EXISTS result_mode          text DEFAULT 'bilateral',
  ADD COLUMN IF NOT EXISTS auto_start_on_full   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_start_delay_seconds int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sorteo_starts_at     timestamptz,
  ADD COLUMN IF NOT EXISTS registration_close   timestamptz,
  ADD COLUMN IF NOT EXISTS rules                text,
  ADD COLUMN IF NOT EXISTS inscription_fee      text,
  ADD COLUMN IF NOT EXISTS platform             text,
  ADD COLUMN IF NOT EXISTS country_restriction  text,
  ADD COLUMN IF NOT EXISTS banner_url           text,
  ADD COLUMN IF NOT EXISTS liga_tipo            text,
  ADD COLUMN IF NOT EXISTS temporada            text,
  ADD COLUMN IF NOT EXISTS division             text,
  ADD COLUMN IF NOT EXISTS clasifica_copa       boolean DEFAULT false;

-- Add dispute_reason to tournament_matches if missing
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS admin_override_reason text,
  ADD COLUMN IF NOT EXISTS admin_override_by     uuid REFERENCES public.users(id);

-- 2. RPC: admin_override_match — CEO/Organizador fuerza resultado con motivo
CREATE OR REPLACE FUNCTION public.admin_override_match(
  p_match_id   uuid,
  p_winner_id  uuid,
  p_score1     int,
  p_score2     int,
  p_reason     text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_match      record;
  v_tournament record;
  v_is_admin   boolean := false;
  v_next_round int;
  v_next_match int;
  v_next_slot  text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_match FROM public.tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'match_not_found');
  END IF;

  -- Check caller is admin/owner of the tournament
  SELECT created_by, community_id INTO v_tournament
  FROM public.conversations WHERE id = v_match.tournament_id;

  IF v_tournament.created_by = v_uid THEN
    v_is_admin := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.group_roles
      WHERE conversation_id = v_match.tournament_id
        AND user_id = v_uid
        AND role IN ('owner', 'admin', 'moderator')
    ) INTO v_is_admin;
  END IF;

  -- Also allow community staff
  IF NOT v_is_admin AND v_tournament.community_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.group_roles
      WHERE conversation_id = v_tournament.community_id
        AND user_id = v_uid
        AND role IN ('owner', 'admin', 'moderator')
    ) INTO v_is_admin;
  END IF;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_admin');
  END IF;

  -- Validate winner is a participant
  IF p_winner_id <> v_match.player1_id AND p_winner_id <> v_match.player2_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_winner');
  END IF;

  -- Override the match
  UPDATE public.tournament_matches SET
    score1               = p_score1,
    score2               = p_score2,
    winner_id            = p_winner_id,
    status               = 'finalizado',
    loser_confirmed      = true,
    admin_override_reason = p_reason,
    admin_override_by    = v_uid,
    updated_at           = now()
  WHERE id = p_match_id;

  -- Delete any pending match_results for this match
  DELETE FROM public.match_results WHERE match_id = p_match_id;

  -- Advance winner to next round in bracket (same logic as submit_match_result)
  v_next_round := v_match.round_number + 1;
  v_next_match := CEIL(v_match.match_number::float / 2);
  v_next_slot  := CASE WHEN v_match.match_number % 2 = 1 THEN 'player1_id' ELSE 'player2_id' END;

  IF v_next_slot = 'player1_id' THEN
    UPDATE public.tournament_matches SET player1_id = p_winner_id
    WHERE tournament_id = v_match.tournament_id
      AND round_number = v_next_round
      AND match_number = v_next_match;
  ELSE
    UPDATE public.tournament_matches SET player2_id = p_winner_id
    WHERE tournament_id = v_match.tournament_id
      AND round_number = v_next_round
      AND match_number = v_next_match;
  END IF;

  RETURN jsonb_build_object('ok', true, 'winner_id', p_winner_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_override_match(uuid, uuid, int, int, text) TO authenticated;
