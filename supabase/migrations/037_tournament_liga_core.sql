-- ═══════════════════════════════════════════════════════════════════════════
-- 037: Tournament & Liga — infraestructura completa
-- ═══════════════════════════════════════════════════════════════════════════
-- Fixes:
--   • group_type correcto para ligas ('liga' en DB)
--   • Columnas propias en conversations (game, format, max_participants, etc.)
--   • Estadísticas reales en users (rankings dejan de estar vacíos)
--   • tournament_matches: partidos persistidos con FK a torneo y ronda
--   • tournament_standings: tabla de posiciones persistida
--   • match_results: FK a torneo + UPDATE policy para admin
--   • RPCs: join_tournament, start_tournament, submit_match_result,
--           approve_match_result, update_tournament_status

-- ── 1. Columnas en conversations ──────────────────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS max_participants      integer,
  ADD COLUMN IF NOT EXISTS game                  text,
  ADD COLUMN IF NOT EXISTS format                text,
  ADD COLUMN IF NOT EXISTS community_id          uuid REFERENCES public.conversations(id),
  ADD COLUMN IF NOT EXISTS registration_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS start_date            timestamptz;

-- is_public ya existe; aseguramos índice para filtrado en Explorar
CREATE INDEX IF NOT EXISTS idx_conversations_public_type
  ON public.conversations(is_public, group_type)
  WHERE is_public = true;

-- ── 2. Estadísticas en users (fix rankings) ───────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stats_matches   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stats_wins      integer NOT NULL DEFAULT 0,  -- puntos ranking (3 victoria, 1 empate)
  ADD COLUMN IF NOT EXISTS stats_victories integer NOT NULL DEFAULT 0,  -- número de victorias
  ADD COLUMN IF NOT EXISTS stats_draws     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stats_losses    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stats_goals     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stats_goals_against integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stats_tournaments integer NOT NULL DEFAULT 0;

-- ── 3. Tabla tournament_matches ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  round_number    integer     NOT NULL DEFAULT 1,
  match_number    integer     NOT NULL DEFAULT 1,
  jornada_number  integer,                          -- solo para ligas
  player1_id      uuid        REFERENCES public.users(id),
  player2_id      uuid        REFERENCES public.users(id),
  score1          integer,
  score2          integer,
  winner_id       uuid        REFERENCES public.users(id),
  status          text        NOT NULL DEFAULT 'pendiente'
                  CHECK (status IN ('pendiente','en_juego','finalizado','cancelado')),
  submitted_by    uuid        REFERENCES public.users(id),
  approved_by     uuid        REFERENCES public.users(id),
  photo_url       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  played_at       timestamptz,
  UNIQUE (tournament_id, round_number, match_number)
);

CREATE INDEX IF NOT EXISTS idx_tm_tournament ON public.tournament_matches(tournament_id, round_number, match_number);
CREATE INDEX IF NOT EXISTS idx_tm_player1    ON public.tournament_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_tm_player2    ON public.tournament_matches(player2_id);

ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tm_select"
  ON public.tournament_matches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = tournament_matches.tournament_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = tournament_matches.tournament_id AND c.is_public = true
    )
  );

-- ── 4. Tabla tournament_standings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_standings (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pj            integer     NOT NULL DEFAULT 0,
  pg            integer     NOT NULL DEFAULT 0,
  pe            integer     NOT NULL DEFAULT 0,
  pp            integer     NOT NULL DEFAULT 0,
  gf            integer     NOT NULL DEFAULT 0,
  gc            integer     NOT NULL DEFAULT 0,
  puntos        integer     NOT NULL DEFAULT 0,
  posicion      integer,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ts_tournament ON public.tournament_standings(tournament_id, puntos DESC);

ALTER TABLE public.tournament_standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ts_select"
  ON public.tournament_standings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = tournament_standings.tournament_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = tournament_standings.tournament_id AND c.is_public = true
    )
  );

-- ── 5. match_results: FK a torneo + UPDATE policy ─────────────────────────────
ALTER TABLE public.match_results
  ADD COLUMN IF NOT EXISTS tournament_id uuid REFERENCES public.conversations(id);

DROP POLICY IF EXISTS "results_update" ON public.match_results;
CREATE POLICY "results_update"
  ON public.match_results FOR UPDATE TO authenticated
  USING (
    (submitted_by = auth.uid() AND status = 'pendiente')
    OR (tournament_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.group_roles gr
      WHERE gr.conversation_id = match_results.tournament_id
        AND gr.user_id = auth.uid()
        AND gr.role IN ('owner','admin','moderador')
    ))
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ceo','admin'))
  );

-- ── 6. Fix delete_tournaments: también borra ligas ────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_tournaments(tournament_ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.conversations
  WHERE id = ANY(tournament_ids)
    AND group_type IN ('tournament', 'liga', 'clan', 'bracket')
    AND created_by = auth.uid();
END;
$$;

-- ── 7. RPC: join_tournament ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_tournament(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_status text;
  v_max    integer;
  v_count  integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT status, max_participants INTO v_status, v_max
  FROM public.conversations
  WHERE id = p_tournament_id AND group_type IN ('tournament','liga','clan','bracket');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_status != 'inscripcion' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'inscripciones_cerradas');
  END IF;

  -- Already joined
  IF EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_tournament_id AND user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_joined', true);
  END IF;

  -- Validate max_participants
  IF v_max IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.conversation_members
    WHERE conversation_id = p_tournament_id;

    IF v_count >= v_max THEN
      RETURN jsonb_build_object('ok', false, 'error', 'torneo_lleno', 'max', v_max);
    END IF;
  END IF;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (p_tournament_id, v_uid);

  -- Increment stats_tournaments on first join
  UPDATE public.users SET stats_tournaments = stats_tournaments + 1 WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'joined', true);
END;
$$;

REVOKE ALL ON FUNCTION public.join_tournament(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.join_tournament(uuid) TO authenticated;

-- ── 8. RPC: update_tournament_status ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_tournament_status(
  p_tournament_id uuid,
  p_status        text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_status NOT IN ('inscripcion','en_curso','finalizado','cancelado') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
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

  UPDATE public.conversations SET status = p_status WHERE id = p_tournament_id;

  RETURN jsonb_build_object('ok', true, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.update_tournament_status(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_tournament_status(uuid, text) TO authenticated;

-- ── 9. RPC: start_tournament (genera partidos) ────────────────────────────────
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

  SELECT format, status, group_type
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

  -- ── LIGA: round-robin ────────────────────────────────────────────────────────
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

    -- Initialize standings
    FOR v_i IN 1..v_n LOOP
      INSERT INTO public.tournament_standings (tournament_id, user_id)
      VALUES (p_tournament_id, v_participants[v_i])
      ON CONFLICT (tournament_id, user_id) DO NOTHING;
    END LOOP;

  -- ── TORNEO: single elimination ───────────────────────────────────────────────
  ELSE
    -- Pad to next power of 2
    v_round_size := 1;
    WHILE v_round_size < v_n LOOP
      v_round_size := v_round_size * 2;
    END LOOP;

    -- Round 1: real players + auto-advance BYEs
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

    -- Remaining rounds (empty placeholders)
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

    -- Advance BYE winners to round 2
    FOR v_i IN 1..(v_match_num / 2) LOOP
      -- Odd match of round 1 → player1 of round 2
      SELECT winner_id INTO v_winner
      FROM public.tournament_matches
      WHERE tournament_id = p_tournament_id AND round_number = 1 AND match_number = v_i * 2 - 1;

      IF v_winner IS NOT NULL THEN
        UPDATE public.tournament_matches
        SET player1_id = v_winner
        WHERE tournament_id = p_tournament_id AND round_number = 2 AND match_number = v_i;
      END IF;

      -- Even match of round 1 → player2 of round 2
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

  -- Change status to en_curso
  UPDATE public.conversations SET status = 'en_curso' WHERE id = p_tournament_id;

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

-- ── 10. RPC: submit_match_result ──────────────────────────────────────────────
-- Cualquier jugador del partido puede enviar el resultado (con foto opcional)
CREATE OR REPLACE FUNCTION public.submit_match_result(
  p_match_id  uuid,
  p_score1    integer,
  p_score2    integer,
  p_photo_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_tournament  uuid;
  v_p1          uuid;
  v_p2          uuid;
  v_status      text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT tournament_id, player1_id, player2_id, status
  INTO v_tournament, v_p1, v_p2, v_status
  FROM public.tournament_matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_status NOT IN ('pendiente', 'en_juego') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'match_not_open');
  END IF;

  -- Only participants of this match OR organizer can submit
  IF v_uid NOT IN (v_p1, v_p2) AND NOT EXISTS (
    SELECT 1 FROM public.group_roles
    WHERE conversation_id = v_tournament AND user_id = v_uid AND role IN ('owner','admin','moderador')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.conversations WHERE id = v_tournament AND created_by = v_uid
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  UPDATE public.tournament_matches
  SET status       = 'en_juego',
      score1       = p_score1,
      score2       = p_score2,
      photo_url    = COALESCE(p_photo_url, photo_url),
      submitted_by = v_uid,
      played_at    = now()
  WHERE id = p_match_id;

  RETURN jsonb_build_object('ok', true, 'pending_approval', true);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_match_result(uuid, integer, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_match_result(uuid, integer, integer, text) TO authenticated;

-- ── 11. RPC: approve_match_result ────────────────────────────────────────────
-- Organizador aprueba el resultado → actualiza standings, stats y avanza bracket
CREATE OR REPLACE FUNCTION public.approve_match_result(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_tournament uuid;
  v_p1         uuid;
  v_p2         uuid;
  v_s1         integer;
  v_s2         integer;
  v_status     text;
  v_round      integer;
  v_match_num  integer;
  v_group_type text;
  v_winner     uuid;
  v_loser      uuid;
  v_wp         integer;  -- winner points
  v_lp         integer;  -- loser points
  v_next_match integer;
  v_is_odd     boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT tm.tournament_id, tm.player1_id, tm.player2_id,
         tm.score1, tm.score2, tm.status,
         tm.round_number, tm.match_number, c.group_type
  INTO v_tournament, v_p1, v_p2, v_s1, v_s2, v_status, v_round, v_match_num, v_group_type
  FROM public.tournament_matches tm
  JOIN public.conversations c ON c.id = tm.tournament_id
  WHERE tm.id = p_match_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_status != 'en_juego' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending_approval', 'status', v_status);
  END IF;

  -- Check organizer permission
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations WHERE id = v_tournament AND created_by = v_uid
    UNION ALL
    SELECT 1 FROM public.group_roles
      WHERE conversation_id = v_tournament AND user_id = v_uid AND role IN ('owner','admin','moderador')
    UNION ALL
    SELECT 1 FROM public.users WHERE id = v_uid AND role IN ('ceo','admin')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF v_s1 IS NULL OR v_s2 IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_scores');
  END IF;

  -- Determine winner
  IF v_s1 > v_s2 THEN
    v_winner := v_p1; v_loser := v_p2; v_wp := 3; v_lp := 0;
  ELSIF v_s2 > v_s1 THEN
    v_winner := v_p2; v_loser := v_p1; v_wp := 3; v_lp := 0;
  ELSE
    v_winner := NULL; v_wp := 1; v_lp := 1;
  END IF;

  -- Update match
  UPDATE public.tournament_matches
  SET status      = 'finalizado',
      winner_id   = v_winner,
      approved_by = v_uid
  WHERE id = p_match_id;

  -- ── Update standings for liga ──────────────────────────────────────────────
  IF v_group_type = 'liga' OR EXISTS (
    SELECT 1 FROM public.tournament_standings WHERE tournament_id = v_tournament LIMIT 1
  ) THEN
    IF v_winner IS NULL THEN
      -- Draw
      INSERT INTO public.tournament_standings (tournament_id, user_id, pj, pg, pe, pp, gf, gc, puntos)
      VALUES (v_tournament, v_p1, 1, 0, 1, 0, v_s1, v_s2, 1)
      ON CONFLICT (tournament_id, user_id) DO UPDATE SET
        pj     = tournament_standings.pj + 1,
        pe     = tournament_standings.pe + 1,
        gf     = tournament_standings.gf + v_s1,
        gc     = tournament_standings.gc + v_s2,
        puntos = tournament_standings.puntos + 1,
        updated_at = now();

      INSERT INTO public.tournament_standings (tournament_id, user_id, pj, pg, pe, pp, gf, gc, puntos)
      VALUES (v_tournament, v_p2, 1, 0, 1, 0, v_s2, v_s1, 1)
      ON CONFLICT (tournament_id, user_id) DO UPDATE SET
        pj     = tournament_standings.pj + 1,
        pe     = tournament_standings.pe + 1,
        gf     = tournament_standings.gf + v_s2,
        gc     = tournament_standings.gc + v_s1,
        puntos = tournament_standings.puntos + 1,
        updated_at = now();
    ELSE
      -- Win/Loss
      INSERT INTO public.tournament_standings (tournament_id, user_id, pj, pg, pe, pp, gf, gc, puntos)
      VALUES (v_tournament, v_winner, 1, 1, 0, 0,
              CASE WHEN v_winner = v_p1 THEN v_s1 ELSE v_s2 END,
              CASE WHEN v_winner = v_p1 THEN v_s2 ELSE v_s1 END, 3)
      ON CONFLICT (tournament_id, user_id) DO UPDATE SET
        pj     = tournament_standings.pj + 1,
        pg     = tournament_standings.pg + 1,
        gf     = tournament_standings.gf + CASE WHEN excluded.user_id = v_p1 THEN v_s1 ELSE v_s2 END,
        gc     = tournament_standings.gc + CASE WHEN excluded.user_id = v_p1 THEN v_s2 ELSE v_s1 END,
        puntos = tournament_standings.puntos + 3,
        updated_at = now();

      INSERT INTO public.tournament_standings (tournament_id, user_id, pj, pg, pe, pp, gf, gc, puntos)
      VALUES (v_tournament, v_loser, 1, 0, 0, 1,
              CASE WHEN v_loser = v_p1 THEN v_s1 ELSE v_s2 END,
              CASE WHEN v_loser = v_p1 THEN v_s2 ELSE v_s1 END, 0)
      ON CONFLICT (tournament_id, user_id) DO UPDATE SET
        pj     = tournament_standings.pj + 1,
        pp     = tournament_standings.pp + 1,
        gf     = tournament_standings.gf + CASE WHEN excluded.user_id = v_p1 THEN v_s1 ELSE v_s2 END,
        gc     = tournament_standings.gc + CASE WHEN excluded.user_id = v_p1 THEN v_s2 ELSE v_s1 END,
        updated_at = now();
    END IF;

    -- Recalculate positions
    WITH ranked AS (
      SELECT user_id,
             ROW_NUMBER() OVER (
               ORDER BY puntos DESC, (gf - gc) DESC, gf DESC
             ) AS pos
      FROM public.tournament_standings
      WHERE tournament_id = v_tournament
    )
    UPDATE public.tournament_standings ts
    SET posicion = r.pos
    FROM ranked r
    WHERE ts.tournament_id = v_tournament AND ts.user_id = r.user_id;
  END IF;

  -- ── Advance winner in bracket ──────────────────────────────────────────────
  IF v_group_type != 'liga' AND v_winner IS NOT NULL THEN
    v_next_match := (v_match_num + 1) / 2;
    v_is_odd     := (v_match_num % 2 = 1);
    IF v_is_odd THEN
      UPDATE public.tournament_matches
      SET player1_id = v_winner
      WHERE tournament_id = v_tournament
        AND round_number = v_round + 1
        AND match_number = v_next_match;
    ELSE
      UPDATE public.tournament_matches
      SET player2_id = v_winner
      WHERE tournament_id = v_tournament
        AND round_number = v_round + 1
        AND match_number = v_next_match;
    END IF;
  END IF;

  -- ── Update global user stats ───────────────────────────────────────────────
  IF v_winner IS NULL THEN
    -- Draw
    UPDATE public.users SET
      stats_matches = stats_matches + 1,
      stats_draws   = stats_draws + 1,
      stats_wins    = stats_wins + 1,
      stats_goals   = stats_goals + v_s1,
      stats_goals_against = stats_goals_against + v_s2
    WHERE id = v_p1;

    UPDATE public.users SET
      stats_matches = stats_matches + 1,
      stats_draws   = stats_draws + 1,
      stats_wins    = stats_wins + 1,
      stats_goals   = stats_goals + v_s2,
      stats_goals_against = stats_goals_against + v_s1
    WHERE id = v_p2;
  ELSE
    UPDATE public.users SET
      stats_matches   = stats_matches + 1,
      stats_victories = stats_victories + 1,
      stats_wins      = stats_wins + 3,
      stats_goals     = stats_goals + CASE WHEN id = v_p1 THEN v_s1 ELSE v_s2 END,
      stats_goals_against = stats_goals_against + CASE WHEN id = v_p1 THEN v_s2 ELSE v_s1 END
    WHERE id = v_winner;

    UPDATE public.users SET
      stats_matches = stats_matches + 1,
      stats_losses  = stats_losses + 1,
      stats_goals   = stats_goals + CASE WHEN id = v_p1 THEN v_s1 ELSE v_s2 END,
      stats_goals_against = stats_goals_against + CASE WHEN id = v_p1 THEN v_s2 ELSE v_s1 END
    WHERE id = v_loser;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'winner_id', v_winner,
    'score', jsonb_build_object('p1', v_s1, 'p2', v_s2)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_match_result(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_match_result(uuid) TO authenticated;
