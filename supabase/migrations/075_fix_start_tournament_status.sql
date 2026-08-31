-- 075: Fix start_tournament — update tournament_status not status (wrong column)

CREATE OR REPLACE FUNCTION public.start_tournament(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_format       text;
  v_status       text;
  v_group_type   text;
  v_participants uuid[];
  v_n            integer;
  v_i            integer;
  v_j            integer;
  v_match_num    integer;
  v_round_size   integer;
  v_round        integer;
  v_matches_half integer;
  v_jornada      integer;
  v_p1           uuid;
  v_p2           uuid;
  v_winner       uuid;
  v_st           text;
  v_r2_match     integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT format, tournament_status, group_type
  INTO v_format, v_status, v_group_type
  FROM public.conversations
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_status != 'inscripcion' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wrong_status', 'current', v_status);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversations WHERE id = p_tournament_id AND created_by = v_uid
    UNION ALL
    SELECT 1 FROM public.group_roles
      WHERE conversation_id = p_tournament_id AND user_id = v_uid AND role IN ('owner','admin')
    UNION ALL
    SELECT 1 FROM public.users WHERE id = v_uid AND role IN ('ceo','admin')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  -- Get shuffled participants
  SELECT ARRAY(
    SELECT user_id FROM public.conversation_members
    WHERE conversation_id = p_tournament_id
    ORDER BY random()
  ) INTO v_participants;

  v_n := COALESCE(array_length(v_participants, 1), 0);

  IF v_n < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_enough_participants', 'count', v_n);
  END IF;

  -- Clear existing matches and standings
  DELETE FROM public.tournament_matches  WHERE tournament_id = p_tournament_id;
  DELETE FROM public.tournament_standings WHERE tournament_id = p_tournament_id;

  v_match_num := 0;

  -- ── LIGA: round-robin ─────────────────────────────────────────────────────────
  IF v_group_type = 'liga'
    OR v_format ILIKE '%liga%'
    OR v_format ILIKE '%todos%'
    OR v_format ILIKE '%grupos%'
  THEN
    v_matches_half := GREATEST(v_n / 2, 1);
    FOR v_i IN 1..v_n LOOP
      FOR v_j IN (v_i + 1)..v_n LOOP
        v_match_num := v_match_num + 1;
        v_jornada   := (v_match_num - 1) / v_matches_half + 1;
        INSERT INTO public.tournament_matches (
          tournament_id, round_number, match_number, jornada_number,
          player1_id, player2_id, status
        ) VALUES (
          p_tournament_id, 1, v_match_num, v_jornada,
          v_participants[v_i], v_participants[v_j], 'pendiente'
        );
      END LOOP;
    END LOOP;

    FOR v_i IN 1..v_n LOOP
      INSERT INTO public.tournament_standings (tournament_id, user_id)
      VALUES (p_tournament_id, v_participants[v_i])
      ON CONFLICT (tournament_id, user_id) DO NOTHING;
    END LOOP;

  -- ── TORNEO: single elimination ────────────────────────────────────────────────
  ELSE
    v_round_size := 1;
    WHILE v_round_size < v_n LOOP
      v_round_size := v_round_size * 2;
    END LOOP;

    v_match_num := 0;
    v_i := 1;
    WHILE v_i <= v_round_size LOOP
      v_match_num := v_match_num + 1;
      v_p1     := CASE WHEN v_i     <= v_n THEN v_participants[v_i]     ELSE NULL END;
      v_p2     := CASE WHEN v_i + 1 <= v_n THEN v_participants[v_i + 1] ELSE NULL END;
      v_winner := CASE WHEN v_i + 1 > v_n AND v_i <= v_n THEN v_participants[v_i] ELSE NULL END;
      v_st     := CASE WHEN v_winner IS NOT NULL THEN 'finalizado' ELSE 'pendiente' END;

      INSERT INTO public.tournament_matches (
        tournament_id, round_number, match_number,
        player1_id, player2_id, winner_id, status
      ) VALUES (
        p_tournament_id, 1, v_match_num,
        v_p1, v_p2, v_winner, v_st
      );
      v_i := v_i + 2;
    END LOOP;

    v_round      := 2;
    v_round_size := v_round_size / 2;
    WHILE v_round_size >= 1 LOOP
      FOR v_i IN 1..v_round_size LOOP
        INSERT INTO public.tournament_matches (
          tournament_id, round_number, match_number, status
        ) VALUES (p_tournament_id, v_round, v_i, 'pendiente');
      END LOOP;
      v_round      := v_round + 1;
      v_round_size := v_round_size / 2;
    END LOOP;

    FOR v_i IN 1..(v_match_num / 2) LOOP
      SELECT winner_id INTO v_winner
      FROM public.tournament_matches
      WHERE tournament_id = p_tournament_id AND round_number = 1 AND match_number = v_i * 2 - 1;
      IF v_winner IS NOT NULL THEN
        UPDATE public.tournament_matches
        SET player1_id = v_winner
        WHERE tournament_id = p_tournament_id AND round_number = 2 AND match_number = v_i;
      END IF;

      SELECT winner_id INTO v_winner
      FROM public.tournament_matches
      WHERE tournament_id = p_tournament_id AND round_number = 1 AND match_number = v_i * 2;
      IF v_winner IS NOT NULL THEN
        UPDATE public.tournament_matches
        SET player2_id = v_winner
        WHERE tournament_id = p_tournament_id AND round_number = 2 AND match_number = v_i;
      END IF;
    END LOOP;
  END IF;

  -- Fix: update tournament_status (not the non-existent 'status' column)
  UPDATE public.conversations
  SET tournament_status = 'en_curso'
  WHERE id = p_tournament_id;

  RETURN jsonb_build_object(
    'ok', true,
    'matches_created', v_match_num,
    'participants', v_n,
    'format', CASE WHEN v_group_type = 'liga' THEN 'liga' ELSE 'eliminacion' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_tournament(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.start_tournament(uuid) TO authenticated;
