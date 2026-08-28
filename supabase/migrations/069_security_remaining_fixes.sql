-- ── Remaining security fixes: High #12, Medium #14, Low #20, Low #21 ──────────

-- ── HIGH #12: Race condition en auto_apply_sanction ───────────────────────────
-- Reemplazar la función con advisory lock para evitar sanciones duplicadas en paralelo
CREATE OR REPLACE FUNCTION auto_apply_sanction(
  target_user_id uuid,
  p_conversation_id uuid,
  p_message_id uuid,
  p_reason text,
  p_fingerprint text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  offense_num int;
  v_duration interval;
  v_type text;
BEGIN
  -- Solo admins o service_role
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('ceo', 'admin', 'moderador', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Advisory lock por usuario: evita que dos llamadas simultáneas dupliquen sanciones
  PERFORM pg_advisory_xact_lock(hashtext(target_user_id::text));

  SELECT COUNT(*) INTO offense_num FROM public.sanctions WHERE user_id = target_user_id;
  offense_num := offense_num + 1;

  IF    offense_num = 1 THEN v_type := 'warning'; v_duration := NULL;
  ELSIF offense_num = 2 THEN v_type := 'mute';    v_duration := interval '1 hour';
  ELSIF offense_num = 3 THEN v_type := 'mute';    v_duration := interval '24 hours';
  ELSIF offense_num = 4 THEN v_type := 'ban';     v_duration := interval '7 days';
  ELSE                        v_type := 'ban';     v_duration := NULL;
  END IF;

  INSERT INTO public.sanctions (user_id, type, reason, expires_at, conversation_id, message_id)
  VALUES (
    target_user_id, v_type, p_reason,
    CASE WHEN v_duration IS NOT NULL THEN now() + v_duration ELSE NULL END,
    p_conversation_id, p_message_id
  );
END;
$$;

-- ── MEDIUM #14: Rate limit de mensajes server-side ───────────────────────────
-- Reemplaza el fingerprint de localStorage (evasible) con un límite real en DB.
-- Máximo 30 mensajes por minuto por usuario — holgado para uso normal.
CREATE OR REPLACE FUNCTION check_message_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.messages
  WHERE sender_id = NEW.sender_id
    AND created_at > now() - interval '1 minute';

  IF v_count >= 30 THEN
    RAISE EXCEPTION 'rate_limit: demasiados mensajes en poco tiempo';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_rate_limit ON public.messages;
CREATE TRIGGER trg_message_rate_limit
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION check_message_rate_limit();

-- ── LOW #20: SET search_path en funciones SECURITY DEFINER existentes ─────────
-- Funciones del sistema de roles y antispam de migraciones anteriores

-- handle_new_user (migration 001)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, username)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substring(new.id::text, 1, 8))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- check_sanction (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_sanction') THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION check_sanction(p_user_id uuid)
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $inner$
      DECLARE v_sanction record;
      BEGIN
        SELECT * INTO v_sanction
        FROM public.sanctions
        WHERE user_id = p_user_id
          AND (expires_at IS NULL OR expires_at > now())
          AND type IN ('mute','ban')
        ORDER BY created_at DESC
        LIMIT 1;
        IF FOUND THEN
          RETURN jsonb_build_object('sanctioned', true, 'type', v_sanction.type, 'expires_at', v_sanction.expires_at, 'reason', v_sanction.reason);
        END IF;
        RETURN jsonb_build_object('sanctioned', false);
      END;
      $inner$
    $func$;
  END IF;
END $$;

-- ── LOW #21: verificar .env en historial de git ───────────────────────────────
-- No es SQL, pero dejamos documentado el comando a correr en terminal:
-- git log --all -- .env
-- Si devuelve commits → rotar TODAS las claves de Supabase y ejecutar:
-- git filter-repo --path .env --invert-paths
-- Luego force-push y revocar/regenerar las API keys en Supabase Dashboard.

-- ── Verificación final: funciones críticas aseguradas ─────────────────────────
-- Confirmar que ninguna función SECURITY DEFINER tiene search_path vacío
-- Consulta de diagnóstico (ejecutar para verificar, no modifica nada):
-- SELECT proname, prosecdef, proconfig
-- FROM pg_proc
-- WHERE prosecdef = true
--   AND proconfig IS NULL
--   AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
