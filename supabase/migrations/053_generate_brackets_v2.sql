-- ═══════════════════════════════════════════════════════════════════════════
-- 053: generate_brackets v2
--      Reemplaza la v1 (052). Ahora TAMBIÉN crea los tournament_matches
--      a partir de los participantes, calcula byes y luego genera la
--      vista visual en tournament_brackets.
--
--      Lógica de seeding:
--        • rounds   = CEIL(LOG2(N))
--        • slots    = 2^rounds   (potencia de 2 ≥ N)
--        • byes     = slots - N
--        • Ronda 1 — slots/2 entradas totales:
--            slots 1..byes   → "ghost" match (BYE), status=finalizado, winner prefijado
--            slots byes+1..  → parejas seed j vs seed N-j+1
--        • Rondas 2..rounds → shells vacíos; byes pre-rellenados como player1
--        • Luego calcula posiciones visuales (slot_x/slot_y) igual que v1
-- ═══════════════════════════════════════════════════════════════════════════

-- Eliminar la versión anterior (firma distinta: 1 arg vs 2)
DROP FUNCTION IF EXISTS public.generate_brackets(uuid);

CREATE OR REPLACE FUNCTION public.generate_brackets(
  p_tournament_id uuid,
  p_phase         text DEFAULT 'bracket'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_participants uuid[];
  v_n            integer;
  v_rounds       integer;
  v_slots        integer;
  v_byes         integer;
  v_r1_total     integer;   -- slots/2  (incluye ghost byes)
  v_match_count  integer := 0;
  v_round        integer;
  v_match        integer;
  v_p1           uuid;
  v_p2           uuid;
  v_wid          uuid;
  v_st           text;
  j              integer;
  -- Layout visual
  v_rec          RECORD;
  v_max_round    integer;
  v_matches_r1   integer;
  v_step_y       numeric(5,2);
  v_offset_y     numeric(5,2);
  v_slot_x       numeric(5,2);
  v_slot_y       numeric(5,2);
  v_phase_label  text;
BEGIN
  -- ── Auth ─────────────────────────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
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

  -- ── Participantes: primero miembros de grupo (seeded), luego miembros del torneo ──
  SELECT ARRAY(
    SELECT user_id FROM public.tournament_group_members
    WHERE tournament_id = p_tournament_id
    ORDER BY seed NULLS LAST, user_id
  ) INTO v_participants;

  v_n := COALESCE(array_length(v_participants, 1), 0);

  IF v_n < 2 THEN
    SELECT ARRAY(
      SELECT user_id FROM public.conversation_members
      WHERE conversation_id = p_tournament_id
      ORDER BY joined_at
    ) INTO v_participants;
    v_n := COALESCE(array_length(v_participants, 1), 0);
  END IF;

  IF v_n < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_enough_participants');
  END IF;

  -- ── Cálculo del tamaño del bracket ───────────────────────────────────────────
  v_rounds   := GREATEST(1, CEIL(LOG(2, v_n::numeric))::integer);
  v_slots    := POWER(2, v_rounds)::integer;
  v_byes     := v_slots - v_n;
  v_r1_total := v_slots / 2;  -- total de entradas en ronda 1 (incl. byes)

  -- ── Limpiar matches y brackets previos (no-grupos) ───────────────────────────
  DELETE FROM public.tournament_brackets WHERE tournament_id = p_tournament_id;
  DELETE FROM public.tournament_matches
  WHERE tournament_id = p_tournament_id
    AND (phase IS NULL OR phase NOT IN ('groups'));

  -- ── Ronda 1 ──────────────────────────────────────────────────────────────────
  FOR v_match IN 1..v_r1_total LOOP
    IF v_match <= v_byes THEN
      -- Ghost match: bye para el seed v_match
      v_p1  := v_participants[v_match];
      v_p2  := NULL;
      v_wid := v_participants[v_match];
      v_st  := 'finalizado';
    ELSE
      -- Partido real: seed j vs seed N-j+1 (j = v_match - v_byes)
      j    := v_match - v_byes;
      v_p1 := v_participants[v_byes + j];
      v_p2 := v_participants[v_n - j + 1];
      v_wid := NULL;
      v_st  := 'pendiente';
    END IF;

    INSERT INTO public.tournament_matches (
      tournament_id, round_number, match_number, phase,
      player1_id, player2_id, winner_id, status
    ) VALUES (
      p_tournament_id, 1, v_match, p_phase,
      v_p1, v_p2, v_wid, v_st
    );
    v_match_count := v_match_count + 1;
  END LOOP;

  -- ── Rondas 2..v_rounds ───────────────────────────────────────────────────────
  FOR v_round IN 2..v_rounds LOOP
    FOR v_match IN 1..POWER(2, v_rounds - v_round)::integer LOOP
      v_p1 := NULL;
      v_p2 := NULL;

      -- En ronda 2, pre-rellenar bye players como player1
      IF v_round = 2 AND v_match <= v_byes THEN
        v_p1 := v_participants[v_match];
      END IF;

      INSERT INTO public.tournament_matches (
        tournament_id, round_number, match_number, phase,
        player1_id, player2_id, status
      ) VALUES (
        p_tournament_id, v_round, v_match, p_phase,
        v_p1, v_p2, 'pendiente'
      );
      v_match_count := v_match_count + 1;
    END LOOP;
  END LOOP;

  -- ── Posiciones visuales (tournament_brackets) ────────────────────────────────
  v_max_round  := v_rounds;
  v_matches_r1 := v_r1_total;  -- base para el espaciado vertical

  FOR v_rec IN
    SELECT id, round_number, match_number, phase AS match_phase
    FROM public.tournament_matches
    WHERE tournament_id = p_tournament_id
      AND (phase IS NULL OR phase NOT IN ('groups'))
    ORDER BY round_number, match_number
  LOOP
    v_step_y   := (100.0 / v_matches_r1) * POWER(2, v_rec.round_number - 1);
    v_offset_y := v_step_y / 2.0;
    v_slot_y   := ((v_rec.match_number - 1) * v_step_y) + v_offset_y;
    v_slot_x   := CASE
      WHEN v_max_round = 1 THEN 50.0
      ELSE ((v_rec.round_number - 1)::numeric / (v_max_round - 1)) * 90.0 + 5.0
    END;
    v_phase_label := CASE
      WHEN v_rec.match_phase IS NOT NULL AND v_rec.match_phase NOT IN ('bracket','groups') THEN v_rec.match_phase
      WHEN v_rec.round_number = v_max_round     THEN 'final'
      WHEN v_rec.round_number = v_max_round - 1 THEN 'sf'
      WHEN v_rec.round_number = v_max_round - 2 THEN 'qf'
      WHEN v_rec.round_number = v_max_round - 3 THEN 'r16'
      ELSE 'bracket'
    END;

    INSERT INTO public.tournament_brackets (
      tournament_id, match_id, phase, round_number, match_number,
      slot_x, slot_y, parent_slot, side
    ) VALUES (
      p_tournament_id, v_rec.id, v_phase_label,
      v_rec.round_number, v_rec.match_number,
      v_slot_x, v_slot_y,
      CASE WHEN v_rec.round_number < v_max_round
           THEN CEIL(v_rec.match_number::numeric / 2)::integer
           ELSE NULL
      END,
      CASE WHEN v_rec.match_number % 2 = 1 THEN 'top' ELSE 'bottom' END
    )
    ON CONFLICT (tournament_id, round_number, match_number) DO UPDATE
      SET match_id    = EXCLUDED.match_id,
          phase       = EXCLUDED.phase,
          slot_x      = EXCLUDED.slot_x,
          slot_y      = EXCLUDED.slot_y,
          parent_slot = EXCLUDED.parent_slot,
          side        = EXCLUDED.side;
  END LOOP;

  RETURN jsonb_build_object(
    'ok',           true,
    'participants', v_n,
    'rounds',       v_rounds,
    'byes',         v_byes,
    'matches',      v_match_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_brackets(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.generate_brackets(uuid, text) TO authenticated;
