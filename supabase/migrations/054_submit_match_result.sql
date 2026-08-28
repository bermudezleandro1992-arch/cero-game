-- ═══════════════════════════════════════════════════════════════════════════
-- 054: submit_match_result + result_photo_url + auto-confirm via pg_cron
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Columna para foto del resultado ───────────────────────────────────────
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS result_photo_url text;

-- ── 2. Bucket de storage para evidencias ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('match-evidence', 'match-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage (DROP primero porque IF NOT EXISTS no existe para policies)
DROP POLICY IF EXISTS "match_evidence_insert" ON storage.objects;
DROP POLICY IF EXISTS "match_evidence_select" ON storage.objects;

CREATE POLICY "match_evidence_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'match-evidence');

CREATE POLICY "match_evidence_select"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'match-evidence');

-- ── 3. RPC submit_match_result ────────────────────────────────────────────────
--   Solo puede llamarlo el jugador que participó en el partido.
--   El ganador declara el marcador y su identidad; la foto es opcional.
--   Al cambiar status a 'en_juego' el trigger trg_dispute_deadline
--   fija dispute_deadline automáticamente.
CREATE OR REPLACE FUNCTION public.submit_match_result(
  p_match_id      uuid,
  p_score1        integer,
  p_score2        integer,
  p_winner_id     uuid,
  p_photo_url     text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_match    RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT id, tournament_id, player1_id, player2_id, status, winner_id
  INTO v_match
  FROM public.tournament_matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'match_not_found');
  END IF;

  -- Solo los participantes del partido pueden reportar
  IF v_uid NOT IN (v_match.player1_id, v_match.player2_id) THEN
    -- Admins/owners también pueden
    IF NOT EXISTS (
      SELECT 1 FROM public.group_roles
        WHERE conversation_id = v_match.tournament_id
          AND user_id = v_uid AND role IN ('owner','admin')
      UNION ALL
      SELECT 1 FROM public.users WHERE id = v_uid AND role IN ('ceo','admin')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_a_participant');
    END IF;
  END IF;

  IF v_match.status NOT IN ('pendiente', 'en_juego') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'match_already_finished');
  END IF;

  -- El winner_id debe ser uno de los dos jugadores
  IF p_winner_id NOT IN (v_match.player1_id, v_match.player2_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_winner');
  END IF;

  UPDATE public.tournament_matches
  SET score1           = p_score1,
      score2           = p_score2,
      winner_id        = p_winner_id,
      result_photo_url = p_photo_url,
      status           = 'en_juego',
      loser_confirmed  = NULL,  -- reset si se re-envía
      dispute_deadline = NULL   -- el trigger lo re-fija
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'ok',       true,
    'match_id', p_match_id,
    'winner_id', p_winner_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_match_result(uuid,integer,integer,uuid,text) FROM public;
GRANT  EXECUTE ON FUNCTION public.submit_match_result(uuid,integer,integer,uuid,text) TO authenticated;

-- ── 4. RPC auto_confirm_expired_matches (llamado por pg_cron) ────────────────
--   Confirma todos los partidos cuyo dispute_deadline ya pasó y el perdedor
--   no respondió (loser_confirmed IS NULL) y no hay disputa abierta.
CREATE OR REPLACE FUNCTION public.auto_confirm_expired_matches()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.tournament_matches tm
  SET status          = 'finalizado',
      loser_confirmed = true,          -- auto-confirmado
      loser_confirmed_at = now(),
      notes = COALESCE(notes || ' ', '') || '[auto-confirmado por tiempo]'
  FROM (
    SELECT tm2.id
    FROM public.tournament_matches tm2
    WHERE tm2.status = 'en_juego'
      AND tm2.dispute_deadline IS NOT NULL
      AND tm2.dispute_deadline < now()
      AND tm2.loser_confirmed IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.tournament_disputes td
        WHERE td.match_id = tm2.id AND td.status IN ('abierta','en_revision')
      )
  ) expired
  WHERE tm.id = expired.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_confirm_expired_matches() FROM public;
GRANT  EXECUTE ON FUNCTION public.auto_confirm_expired_matches() TO service_role;

-- ── 5. pg_cron: correr auto_confirm cada minuto ───────────────────────────────
--   Requiere extensión pg_cron habilitada en Supabase Dashboard → Extensions.
--   Si no está disponible, llamar al RPC manualmente o via Edge Function.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'auto-confirm-matches',
      '* * * * *',
      $cron$SELECT public.auto_confirm_expired_matches();$cron$
    );
  END IF;
END $$;
