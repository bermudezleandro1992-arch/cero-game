-- ═══════════════════════════════════════════════════════════════════════════
-- 052: RPC generate_brackets
--      Genera los registros en tournament_brackets a partir de los partidos
--      existentes en tournament_matches, calculando posiciones visuales.
--
--      Lógica:
--      • Detecta el número máximo de rondas (ceil(log2(participantes)))
--      • Calcula slot_y para centrar cada ronda correctamente
--      • Conecta parent_slot y side para trazar las líneas del árbol
--      • Soporta tanto torneos de eliminación directa como brackets post-grupos
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_brackets(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_match       RECORD;
  v_max_round   integer;
  v_matches_r1  integer;
  v_total_slots integer;
  v_slot_y      numeric(5,2);
  v_slot_x      numeric(5,2);
  v_step_y      numeric(5,2);
  v_offset_y    numeric(5,2);
  v_phase_label text;
  v_inserted    integer := 0;
BEGIN
  -- Verificar permisos
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

  -- Limpiar brackets anteriores
  DELETE FROM public.tournament_brackets WHERE tournament_id = p_tournament_id;

  -- Obtener el número máximo de rondas de los partidos existentes
  SELECT MAX(round_number) INTO v_max_round
  FROM public.tournament_matches
  WHERE tournament_id = p_tournament_id
    AND (phase IS NULL OR phase NOT IN ('groups'));

  IF v_max_round IS NULL OR v_max_round = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_bracket_matches');
  END IF;

  -- Nro de partidos en la primera ronda = 2^(max_round - 1)
  v_matches_r1  := POWER(2, v_max_round - 1)::integer;
  -- Total de slots verticales (usamos 100 como espacio total, %
  v_total_slots := v_matches_r1 * 2;   -- espacio con separadores

  -- Iterar sobre los partidos y calcular su posición visual
  FOR v_match IN
    SELECT id, round_number, match_number, phase
    FROM public.tournament_matches
    WHERE tournament_id = p_tournament_id
      AND (phase IS NULL OR phase NOT IN ('groups'))
    ORDER BY round_number, match_number
  LOOP
    -- Paso vertical entre partidos de esta ronda
    -- En ronda 1: step = 100 / matches_r1
    -- En ronda N: step se duplica
    v_step_y := (100.0 / v_matches_r1) * POWER(2, v_match.round_number - 1);

    -- Offset para centrar los partidos dentro de su step
    v_offset_y := v_step_y / 2.0;

    -- Posición Y del partido: (match_number - 1) * step + offset
    v_slot_y := ((v_match.match_number - 1) * v_step_y) + v_offset_y;

    -- Posición X basada en la ronda (0% = ronda 1, 100% = final)
    v_slot_x := CASE
      WHEN v_max_round = 1 THEN 50.0
      ELSE ((v_match.round_number - 1)::numeric / (v_max_round - 1)) * 90.0 + 5.0
    END;

    -- Etiqueta de fase según ronda
    v_phase_label := CASE
      WHEN v_match.phase IS NOT NULL AND v_match.phase NOT IN ('bracket','groups') THEN v_match.phase
      WHEN v_match.round_number = v_max_round THEN 'final'
      WHEN v_match.round_number = v_max_round - 1 THEN 'sf'
      WHEN v_match.round_number = v_max_round - 2 THEN 'qf'
      WHEN v_match.round_number = v_max_round - 3 THEN 'r16'
      ELSE 'bracket'
    END;

    -- Insertar el slot del bracket
    INSERT INTO public.tournament_brackets (
      tournament_id,
      match_id,
      phase,
      round_number,
      match_number,
      slot_x,
      slot_y,
      -- parent_slot: el ganador va al match ceil(match_number/2) de la siguiente ronda
      parent_slot,
      -- side: impar → top (player1), par → bottom (player2)
      side
    ) VALUES (
      p_tournament_id,
      v_match.id,
      v_phase_label,
      v_match.round_number,
      v_match.match_number,
      v_slot_x,
      v_slot_y,
      CASE WHEN v_match.round_number < v_max_round
           THEN CEIL(v_match.match_number::numeric / 2)::integer
           ELSE NULL
      END,
      CASE WHEN v_match.match_number % 2 = 1 THEN 'top' ELSE 'bottom' END
    )
    ON CONFLICT (tournament_id, round_number, match_number) DO UPDATE
      SET match_id     = EXCLUDED.match_id,
          phase        = EXCLUDED.phase,
          slot_x       = EXCLUDED.slot_x,
          slot_y       = EXCLUDED.slot_y,
          parent_slot  = EXCLUDED.parent_slot,
          side         = EXCLUDED.side;

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok',        true,
    'inserted',  v_inserted,
    'rounds',    v_max_round,
    'first_round_matches', v_matches_r1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_brackets(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.generate_brackets(uuid) TO authenticated;
