-- ═══════════════════════════════════════════════════════════════════════════
-- 051: Sistema avanzado de torneos
--      - Grupos (fase de grupos estilo Champions)
--      - Brackets visuales
--      - Confirmación del perdedor
--      - Sistema de disputas
--      - Sorteos en vivo (historial)
--      - Ascenso/descenso en ligas
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. tournament_groups — grupos dentro de un torneo (Grupo A, B, C…) ────────
CREATE TABLE IF NOT EXISTS public.tournament_groups (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  name          text        NOT NULL,          -- 'A', 'B', 'C' | 'Grupo A', etc.
  color         text,                          -- color hex para UI (ej: '#22c55e')
  position      integer     NOT NULL DEFAULT 0,
  classifies    integer     NOT NULL DEFAULT 2, -- cuántos clasifican a siguiente fase
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tg_tournament ON public.tournament_groups(tournament_id, position);

ALTER TABLE public.tournament_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tg_select" ON public.tournament_groups FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = tournament_groups.tournament_id AND is_public = true)
    OR EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = tournament_groups.tournament_id AND user_id = auth.uid())
  );

CREATE POLICY "tg_insert" ON public.tournament_groups FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = tournament_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_roles WHERE conversation_id = tournament_id AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

CREATE POLICY "tg_update" ON public.tournament_groups FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = tournament_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_roles WHERE conversation_id = tournament_id AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

CREATE POLICY "tg_delete" ON public.tournament_groups FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = tournament_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_roles WHERE conversation_id = tournament_id AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

-- ── 2. tournament_group_members — quién está en qué grupo ────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_group_members (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      uuid        NOT NULL REFERENCES public.tournament_groups(id) ON DELETE CASCADE,
  tournament_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seed          integer,                        -- número de cabeza de serie (1 = favorito)
  drawn_at      timestamptz DEFAULT now(),      -- momento del sorteo
  UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tgm_group      ON public.tournament_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_tgm_tournament ON public.tournament_group_members(tournament_id);

ALTER TABLE public.tournament_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tgm_select" ON public.tournament_group_members FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = tournament_group_members.tournament_id AND is_public = true)
    OR EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = tournament_group_members.tournament_id AND user_id = auth.uid())
  );

CREATE POLICY "tgm_insert" ON public.tournament_group_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = tournament_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_roles WHERE conversation_id = tournament_id AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

CREATE POLICY "tgm_delete" ON public.tournament_group_members FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = tournament_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_roles WHERE conversation_id = tournament_id AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

-- ── 3. tournament_brackets — posición visual en el árbol ──────────────────────
--    Una fila por slot del bracket (incluye byes vacíos)
CREATE TABLE IF NOT EXISTS public.tournament_brackets (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  match_id      uuid        REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
  group_id      uuid        REFERENCES public.tournament_groups(id) ON DELETE SET NULL,
  phase         text        NOT NULL DEFAULT 'bracket',  -- 'groups' | 'r16' | 'qf' | 'sf' | 'final' | 'bracket'
  round_number  integer     NOT NULL,
  match_number  integer     NOT NULL,
  -- visual coords on canvas (0-100 percentage based)
  slot_x        numeric(5,2) DEFAULT 0,
  slot_y        numeric(5,2) DEFAULT 0,
  -- edges: connects to parent match
  parent_slot   integer,     -- match_number of the parent (feeds winner here)
  side          text CHECK (side IN ('top','bottom')),  -- 'top'=player1 slot, 'bottom'=player2 slot
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, round_number, match_number)
);

CREATE INDEX IF NOT EXISTS idx_tb_tournament ON public.tournament_brackets(tournament_id, round_number);

ALTER TABLE public.tournament_brackets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tb_select" ON public.tournament_brackets FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = tournament_brackets.tournament_id AND is_public = true)
    OR EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = tournament_brackets.tournament_id AND user_id = auth.uid())
  );

CREATE POLICY "tb_insert" ON public.tournament_brackets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = tournament_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_roles WHERE conversation_id = tournament_id AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

CREATE POLICY "tb_update" ON public.tournament_brackets FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = tournament_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_roles WHERE conversation_id = tournament_id AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

-- ── 4. Columnas adicionales en tournament_matches ─────────────────────────────
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS group_id            uuid REFERENCES public.tournament_groups(id),
  ADD COLUMN IF NOT EXISTS phase               text DEFAULT 'bracket',  -- 'groups'|'r16'|'qf'|'sf'|'final'|'bracket'
  ADD COLUMN IF NOT EXISTS loser_confirmed     boolean DEFAULT NULL,    -- NULL=sin confirmar, true=confirmó, false=disputó
  ADD COLUMN IF NOT EXISTS loser_confirmed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS loser_confirmed_by  uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS dispute_deadline    timestamptz,             -- hasta cuándo puede disputar el perdedor
  ADD COLUMN IF NOT EXISTS notes               text;                    -- observaciones del organizador

-- Índice para consultas de partidos de un grupo
CREATE INDEX IF NOT EXISTS idx_tm_group ON public.tournament_matches(group_id) WHERE group_id IS NOT NULL;

-- ── 5. tournament_disputes — sistema de disputas de resultados ────────────────
CREATE TABLE IF NOT EXISTS public.tournament_disputes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        uuid        NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  tournament_id   uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  raised_by       uuid        NOT NULL REFERENCES public.users(id),    -- quien disputa (el perdedor)
  reason          text        NOT NULL,                                  -- motivo escrito
  evidence_urls   text[]      DEFAULT '{}',                             -- fotos/videos de evidencia
  status          text        NOT NULL DEFAULT 'abierta'
                  CHECK (status IN ('abierta','en_revision','resuelta','rechazada')),
  resolution      text,                                                  -- explicación del admin
  resolved_by     uuid        REFERENCES public.users(id),
  resolved_at     timestamptz,
  -- resultado final tras resolución
  final_score1    integer,
  final_score2    integer,
  final_winner_id uuid        REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_td_match      ON public.tournament_disputes(match_id);
CREATE INDEX IF NOT EXISTS idx_td_tournament ON public.tournament_disputes(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_td_raised_by  ON public.tournament_disputes(raised_by);

ALTER TABLE public.tournament_disputes ENABLE ROW LEVEL SECURITY;

-- Todos los miembros del torneo pueden ver disputas
CREATE POLICY "td_select" ON public.tournament_disputes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = tournament_disputes.tournament_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.conversations WHERE id = tournament_disputes.tournament_id AND is_public = true)
  );

-- Solo el perdedor (o los jugadores del partido) pueden abrir una disputa
CREATE POLICY "td_insert" ON public.tournament_disputes FOR INSERT TO authenticated
  WITH CHECK (
    raised_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tournament_matches
      WHERE id = match_id AND (player1_id = auth.uid() OR player2_id = auth.uid())
    )
  );

-- Solo admins del torneo o el que la abrió pueden actualizar
CREATE POLICY "td_update" ON public.tournament_disputes FOR UPDATE TO authenticated
  USING (
    raised_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.conversations WHERE id = tournament_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_roles WHERE conversation_id = tournament_id AND user_id = auth.uid() AND role IN ('owner','admin'))
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ceo','admin'))
  );

-- ── 6. tournament_draw_events — sorteos en vivo (historial animable) ──────────
CREATE TABLE IF NOT EXISTS public.tournament_draw_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  draw_session  uuid        NOT NULL DEFAULT gen_random_uuid(),  -- agrupa todos los eventos de un sorteo
  event_type    text        NOT NULL CHECK (event_type IN (
                              'draw_started',     -- inició el sorteo
                              'pot_revealed',     -- se reveló un bombo
                              'ball_drawn',       -- se sacó una bola
                              'team_assigned',    -- equipo asignado a grupo/zona
                              'draw_completed'    -- sorteo terminado
                            )),
  sequence      integer     NOT NULL,            -- orden del evento en el sorteo
  payload       jsonb       NOT NULL DEFAULT '{}',  -- datos del evento (user_id, group_id, pot_number, etc.)
  drawn_by      uuid        REFERENCES public.users(id),  -- admin que realizó el sorteo
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tde_tournament ON public.tournament_draw_events(tournament_id, draw_session, sequence);

ALTER TABLE public.tournament_draw_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tde_select" ON public.tournament_draw_events FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = tournament_draw_events.tournament_id AND is_public = true)
    OR EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = tournament_draw_events.tournament_id AND user_id = auth.uid())
  );

CREATE POLICY "tde_insert" ON public.tournament_draw_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = tournament_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_roles WHERE conversation_id = tournament_id AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

-- ── 7. league_seasons — historial de temporadas con ascenso/descenso ──────────
CREATE TABLE IF NOT EXISTS public.league_seasons (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  season_number   integer     NOT NULL,
  phase           text,                          -- 'apertura' | 'clausura' | 'copa' | null
  division        text        NOT NULL DEFAULT 'A',
  status          text        NOT NULL DEFAULT 'en_curso'
                  CHECK (status IN ('en_curso','finalizado','cancelado')),
  started_at      timestamptz DEFAULT now(),
  ended_at        timestamptz,
  -- positions at end of season
  champion_id     uuid        REFERENCES public.users(id),
  promoted_ids    uuid[]      DEFAULT '{}',   -- ascendieron a división superior
  relegated_ids   uuid[]      DEFAULT '{}',   -- descendieron a división inferior
  copa_ids        uuid[]      DEFAULT '{}',   -- clasificaron a copa
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, season_number, division)
);

CREATE INDEX IF NOT EXISTS idx_ls_league ON public.league_seasons(league_id, season_number DESC);

ALTER TABLE public.league_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ls_select" ON public.league_seasons FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = league_seasons.league_id AND is_public = true)
    OR EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = league_seasons.league_id AND user_id = auth.uid())
  );

CREATE POLICY "ls_insert" ON public.league_seasons FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = league_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_roles WHERE conversation_id = league_id AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

CREATE POLICY "ls_update" ON public.league_seasons FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = league_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_roles WHERE conversation_id = league_id AND user_id = auth.uid() AND role IN ('owner','admin'))
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ceo','admin'))
  );

-- ── 8. league_season_positions — posición final de cada jugador en la temporada ─
CREATE TABLE IF NOT EXISTS public.league_season_positions (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id     uuid    NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  league_id     uuid    NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id       uuid    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  posicion_final integer NOT NULL,
  pj            integer NOT NULL DEFAULT 0,
  pg            integer NOT NULL DEFAULT 0,
  pe            integer NOT NULL DEFAULT 0,
  pp            integer NOT NULL DEFAULT 0,
  gf            integer NOT NULL DEFAULT 0,
  gc            integer NOT NULL DEFAULT 0,
  puntos        integer NOT NULL DEFAULT 0,
  promotion     text    CHECK (promotion IN ('ascenso','descenso','copa','ninguno')) DEFAULT 'ninguno',
  UNIQUE (season_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lsp_season ON public.league_season_positions(season_id, posicion_final);
CREATE INDEX IF NOT EXISTS idx_lsp_user   ON public.league_season_positions(user_id);

ALTER TABLE public.league_season_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lsp_select" ON public.league_season_positions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = league_season_positions.league_id AND is_public = true)
    OR EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = league_season_positions.league_id AND user_id = auth.uid())
  );

CREATE POLICY "lsp_insert" ON public.league_season_positions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = league_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_roles WHERE conversation_id = league_id AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

-- ── 9. RPC: confirm_match_result (perdedor confirma o disputa) ────────────────
CREATE OR REPLACE FUNCTION public.confirm_match_result(
  p_match_id uuid,
  p_confirm  boolean,       -- true=confirma, false=disputa
  p_reason   text DEFAULT NULL,  -- obligatorio si p_confirm = false
  p_evidence_urls text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_tournament uuid;
  v_p1         uuid;
  v_p2         uuid;
  v_winner     uuid;
  v_loser      uuid;
  v_status     text;
  v_s1         integer;
  v_s2         integer;
  v_dispute_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT tournament_id, player1_id, player2_id, winner_id, score1, score2, status
  INTO v_tournament, v_p1, v_p2, v_winner, v_s1, v_s2, v_status
  FROM public.tournament_matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_status != 'en_juego' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'match_not_pending_confirmation');
  END IF;

  -- Only the loser can confirm/dispute
  v_loser := CASE WHEN v_winner = v_p1 THEN v_p2 ELSE v_p1 END;
  IF v_uid != v_loser AND v_uid != v_p1 AND v_uid != v_p2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_confirm THEN
    -- Perdedor acepta el resultado
    UPDATE public.tournament_matches
    SET loser_confirmed    = true,
        loser_confirmed_at = now(),
        loser_confirmed_by = v_uid
    WHERE id = p_match_id;

    RETURN jsonb_build_object('ok', true, 'action', 'confirmed', 'match_id', p_match_id);
  ELSE
    -- Perdedor disputa el resultado
    IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'reason_required', 'min_length', 10);
    END IF;

    -- Marcar match como en disputa
    UPDATE public.tournament_matches
    SET loser_confirmed    = false,
        loser_confirmed_at = now(),
        loser_confirmed_by = v_uid
    WHERE id = p_match_id;

    -- Crear la disputa
    INSERT INTO public.tournament_disputes (
      match_id, tournament_id, raised_by, reason, evidence_urls, status
    ) VALUES (
      p_match_id, v_tournament, v_uid,
      trim(p_reason),
      COALESCE(p_evidence_urls, '{}'),
      'abierta'
    ) RETURNING id INTO v_dispute_id;

    RETURN jsonb_build_object('ok', true, 'action', 'disputed', 'dispute_id', v_dispute_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_match_result(uuid, boolean, text, text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.confirm_match_result(uuid, boolean, text, text[]) TO authenticated;

-- ── 10. RPC: resolve_dispute (admin resuelve una disputa) ────────────────────
CREATE OR REPLACE FUNCTION public.resolve_dispute(
  p_dispute_id  uuid,
  p_resolution  text,
  p_status      text,    -- 'resuelta' | 'rechazada'
  p_final_score1 integer DEFAULT NULL,
  p_final_score2 integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_match_id   uuid;
  v_tournament uuid;
  v_p1         uuid;
  v_p2         uuid;
  v_winner     uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_status NOT IN ('resuelta','rechazada') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  SELECT match_id, tournament_id INTO v_match_id, v_tournament
  FROM public.tournament_disputes
  WHERE id = p_dispute_id AND status = 'abierta';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'dispute_not_found_or_closed');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversations WHERE id = v_tournament AND created_by = v_uid
    UNION ALL
    SELECT 1 FROM public.group_roles WHERE conversation_id = v_tournament AND user_id = v_uid AND role IN ('owner','admin')
    UNION ALL
    SELECT 1 FROM public.users WHERE id = v_uid AND role IN ('ceo','admin')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  -- Determine winner if new scores provided
  IF p_final_score1 IS NOT NULL AND p_final_score2 IS NOT NULL THEN
    SELECT player1_id, player2_id INTO v_p1, v_p2
    FROM public.tournament_matches WHERE id = v_match_id;

    v_winner := CASE
      WHEN p_final_score1 > p_final_score2 THEN v_p1
      WHEN p_final_score2 > p_final_score1 THEN v_p2
      ELSE NULL
    END;

    -- Update the match with new scores
    UPDATE public.tournament_matches
    SET score1    = p_final_score1,
        score2    = p_final_score2,
        winner_id = v_winner,
        status    = 'finalizado'
    WHERE id = v_match_id;
  ELSE
    -- Close dispute without changing scores, mark match final
    UPDATE public.tournament_matches SET status = 'finalizado' WHERE id = v_match_id;
    v_winner := NULL;
  END IF;

  -- Resolve the dispute
  UPDATE public.tournament_disputes
  SET status          = p_status,
      resolution      = trim(p_resolution),
      resolved_by     = v_uid,
      resolved_at     = now(),
      final_score1    = p_final_score1,
      final_score2    = p_final_score2,
      final_winner_id = v_winner,
      updated_at      = now()
  WHERE id = p_dispute_id;

  RETURN jsonb_build_object(
    'ok', true,
    'dispute_id', p_dispute_id,
    'status', p_status,
    'winner_id', v_winner
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_dispute(uuid, text, text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_dispute(uuid, text, text, integer, integer) TO authenticated;

-- ── 11. RPC: run_draw (sorteo en vivo — asigna participantes a grupos) ────────
CREATE OR REPLACE FUNCTION public.run_draw(
  p_tournament_id uuid,
  p_num_groups    integer DEFAULT 4,
  p_group_names   text[]  DEFAULT ARRAY['A','B','C','D','E','F','G','H'],
  p_classifies    integer DEFAULT 2
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_participants uuid[];
  v_n            integer;
  v_session      uuid := gen_random_uuid();
  v_group_ids    uuid[];
  v_group_id     uuid;
  v_group_name   text;
  v_user_id      uuid;
  v_seq          integer := 0;
  v_i            integer;
  v_pot          integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversations WHERE id = p_tournament_id AND created_by = v_uid
    UNION ALL
    SELECT 1 FROM public.group_roles WHERE conversation_id = p_tournament_id AND user_id = v_uid AND role IN ('owner','admin')
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

  IF v_n < p_num_groups THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_enough_participants', 'count', v_n, 'needed', p_num_groups);
  END IF;

  -- Clear previous draw for this tournament
  DELETE FROM public.tournament_groups WHERE tournament_id = p_tournament_id;
  DELETE FROM public.tournament_draw_events WHERE tournament_id = p_tournament_id;

  -- Log draw_started
  v_seq := v_seq + 1;
  INSERT INTO public.tournament_draw_events (tournament_id, draw_session, event_type, sequence, payload, drawn_by)
  VALUES (p_tournament_id, v_session, 'draw_started', v_seq,
    jsonb_build_object('participants', v_n, 'groups', p_num_groups), v_uid);

  -- Create groups
  v_group_ids := ARRAY[]::uuid[];
  FOR v_i IN 1..p_num_groups LOOP
    v_group_name := COALESCE(p_group_names[v_i], 'Grupo ' || v_i::text);

    INSERT INTO public.tournament_groups (tournament_id, name, position, classifies)
    VALUES (p_tournament_id, v_group_name, v_i, p_classifies)
    RETURNING id INTO v_group_id;

    v_group_ids := array_append(v_group_ids, v_group_id);

    v_seq := v_seq + 1;
    INSERT INTO public.tournament_draw_events (tournament_id, draw_session, event_type, sequence, payload, drawn_by)
    VALUES (p_tournament_id, v_session, 'pot_revealed', v_seq,
      jsonb_build_object('group_name', v_group_name, 'group_id', v_group_id), v_uid);
  END LOOP;

  -- Assign participants round-robin across groups (simulates drawing from pots)
  FOR v_i IN 1..v_n LOOP
    v_user_id  := v_participants[v_i];
    v_group_id := v_group_ids[((v_i - 1) % p_num_groups) + 1];
    v_pot      := CEIL(v_i::float / p_num_groups);

    INSERT INTO public.tournament_group_members (group_id, tournament_id, user_id, seed)
    VALUES (v_group_id, p_tournament_id, v_user_id, v_pot)
    ON CONFLICT (tournament_id, user_id) DO NOTHING;

    v_seq := v_seq + 1;
    INSERT INTO public.tournament_draw_events (tournament_id, draw_session, event_type, sequence, payload, drawn_by)
    VALUES (p_tournament_id, v_session, 'ball_drawn', v_seq,
      jsonb_build_object('user_id', v_user_id, 'group_id', v_group_id, 'pot', v_pot), v_uid);
  END LOOP;

  -- Log draw_completed
  v_seq := v_seq + 1;
  INSERT INTO public.tournament_draw_events (tournament_id, draw_session, event_type, sequence, payload, drawn_by)
  VALUES (p_tournament_id, v_session, 'draw_completed', v_seq,
    jsonb_build_object('total_events', v_seq, 'participants_assigned', v_n), v_uid);

  RETURN jsonb_build_object(
    'ok', true,
    'draw_session', v_session,
    'groups_created', p_num_groups,
    'participants_assigned', v_n,
    'total_events', v_seq
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_draw(uuid, integer, text[], integer) FROM public;
GRANT EXECUTE ON FUNCTION public.run_draw(uuid, integer, text[], integer) TO authenticated;

-- ── 12. RPC: close_league_season (cierra temporada y registra ascensos/descensos) ──
CREATE OR REPLACE FUNCTION public.close_league_season(
  p_league_id    uuid,
  p_promoted_n   integer DEFAULT 2,    -- cuántos ascienden
  p_relegated_n  integer DEFAULT 2,    -- cuántos descienden
  p_copa_n       integer DEFAULT 4     -- cuántos van a copa
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_season_num    integer;
  v_division      text;
  v_phase         text;
  v_champion      uuid;
  v_promoted      uuid[];
  v_relegated     uuid[];
  v_copa          uuid[];
  v_season_id     uuid;
  r               RECORD;
  v_i             integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversations WHERE id = p_league_id AND created_by = v_uid
    UNION ALL
    SELECT 1 FROM public.group_roles WHERE conversation_id = p_league_id AND user_id = v_uid AND role IN ('owner','admin')
    UNION ALL
    SELECT 1 FROM public.users WHERE id = v_uid AND role IN ('ceo','admin')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT temporada, division, liga_fase
  INTO v_season_num, v_division, v_phase
  FROM public.conversations WHERE id = p_league_id;

  -- Standings ordered
  v_promoted  := ARRAY[]::uuid[];
  v_relegated := ARRAY[]::uuid[];
  v_copa      := ARRAY[]::uuid[];

  FOR r IN
    SELECT user_id, puntos, posicion, gf, gc, pj, pg, pe, pp
    FROM public.tournament_standings
    WHERE tournament_id = p_league_id
    ORDER BY posicion ASC NULLS LAST
  LOOP
    v_i := v_i + 1;
    IF v_i = 1 THEN v_champion := r.user_id; END IF;
    IF v_i <= p_promoted_n THEN v_promoted := array_append(v_promoted, r.user_id); END IF;
    IF v_i <= p_copa_n THEN v_copa := array_append(v_copa, r.user_id); END IF;
  END LOOP;

  -- Bottom relegated_n
  FOR r IN
    SELECT user_id FROM public.tournament_standings
    WHERE tournament_id = p_league_id
    ORDER BY posicion DESC NULLS FIRST
    LIMIT p_relegated_n
  LOOP
    v_relegated := array_append(v_relegated, r.user_id);
  END LOOP;

  -- Create season record
  INSERT INTO public.league_seasons (
    league_id, season_number, phase, division, status,
    ended_at, champion_id, promoted_ids, relegated_ids, copa_ids
  ) VALUES (
    p_league_id, v_season_num, v_phase, v_division, 'finalizado',
    now(), v_champion, v_promoted, v_relegated, v_copa
  ) RETURNING id INTO v_season_id;

  -- Save final positions
  INSERT INTO public.league_season_positions (
    season_id, league_id, user_id, posicion_final, pj, pg, pe, pp, gf, gc, puntos, promotion
  )
  SELECT
    v_season_id, p_league_id, ts.user_id,
    COALESCE(ts.posicion, 999),
    ts.pj, ts.pg, ts.pe, ts.pp, ts.gf, ts.gc, ts.puntos,
    CASE
      WHEN ts.user_id = ANY(v_promoted)  THEN 'ascenso'
      WHEN ts.user_id = ANY(v_relegated) THEN 'descenso'
      WHEN ts.user_id = ANY(v_copa)      THEN 'copa'
      ELSE 'ninguno'
    END
  FROM public.tournament_standings ts
  WHERE ts.tournament_id = p_league_id;

  -- Update league status and increment season
  UPDATE public.conversations
  SET status   = 'finalizado',
      temporada = v_season_num + 1
  WHERE id = p_league_id;

  RETURN jsonb_build_object(
    'ok', true,
    'season_id', v_season_id,
    'season', v_season_num,
    'champion_id', v_champion,
    'promoted', v_promoted,
    'relegated', v_relegated,
    'copa', v_copa
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_league_season(uuid, integer, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.close_league_season(uuid, integer, integer, integer) TO authenticated;

-- ── 13. Trigger: auto-set dispute_deadline cuando se envía un resultado ────────
CREATE OR REPLACE FUNCTION public._set_dispute_deadline()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_minutes integer;
BEGIN
  -- Get dispute_time_min from tournament config (default 10 min)
  SELECT COALESCE(dispute_time_min, 10) INTO v_minutes
  FROM public.conversations WHERE id = NEW.tournament_id;

  NEW.dispute_deadline := now() + (v_minutes || ' minutes')::interval;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispute_deadline ON public.tournament_matches;
CREATE TRIGGER trg_dispute_deadline
  BEFORE UPDATE OF status ON public.tournament_matches
  FOR EACH ROW
  WHEN (NEW.status = 'en_juego' AND OLD.status = 'pendiente' AND NEW.dispute_deadline IS NULL)
  EXECUTE FUNCTION public._set_dispute_deadline();
