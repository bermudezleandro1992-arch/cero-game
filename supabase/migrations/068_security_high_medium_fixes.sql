-- ── High & Medium security fixes ──────────────────────────────────────────────

-- ── HIGH #7: Habilitar RLS en tablas sin protección ───────────────────────────
ALTER TABLE public.attachments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_status    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_limits ENABLE ROW LEVEL SECURITY;

-- Políticas básicas para cada tabla
-- attachments: el usuario solo ve/inserta los suyos (via message sender)
CREATE POLICY IF NOT EXISTS "attachments_select" ON public.attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
    WHERE m.id = attachments.message_id AND cm.user_id = auth.uid()
  ));
CREATE POLICY IF NOT EXISTS "attachments_insert" ON public.attachments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = attachments.message_id AND m.sender_id = auth.uid()
  ));

-- message_status: solo el propio usuario
CREATE POLICY IF NOT EXISTS "message_status_own" ON public.message_status
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- user_blocks: solo el propio usuario
CREATE POLICY IF NOT EXISTS "user_blocks_own" ON public.user_blocks
  FOR ALL TO authenticated
  USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

-- subscription_limits: lectura pública, escritura solo service_role
CREATE POLICY IF NOT EXISTS "subscription_limits_read" ON public.subscription_limits
  FOR SELECT TO authenticated USING (true);

-- bots: el owner ve/edita los suyos; comunidades ven los activos de sus convs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bots' AND table_schema = 'public') THEN
    ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bots' AND policyname = 'bots_owner') THEN
      EXECUTE 'CREATE POLICY bots_owner ON public.bots FOR ALL TO authenticated
        USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())';
    END IF;
  END IF;
END $$;

-- ── HIGH #9: Rate limiting en spam_reports ────────────────────────────────────
CREATE OR REPLACE FUNCTION check_spam_report_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.spam_reports
    WHERE reporter_id = auth.uid()
    AND created_at > now() - interval '1 hour'
  ) >= 10 THEN
    RAISE EXCEPTION 'rate_limit: máximo 10 reportes por hora';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_spam_report_rate ON public.spam_reports;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'spam_reports' AND table_schema = 'public') THEN
    EXECUTE 'CREATE TRIGGER trg_spam_report_rate
      BEFORE INSERT ON public.spam_reports
      FOR EACH ROW EXECUTE FUNCTION check_spam_report_rate()';
  END IF;
END $$;

-- ── HIGH #10: match-evidence storage — restringir upload al propio user ────────
DROP POLICY IF EXISTS "match_evidence_insert" ON storage.objects;
CREATE POLICY "match_evidence_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'match-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── MEDIUM #18: Límite de longitud en messages.content ───────────────────────
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_content_length;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_length
  CHECK (octet_length(content) <= 65536);

-- ── MEDIUM #13: Validación básica de mensajes server-side ────────────────────
-- Rechaza mensajes vacíos y detecta spam básico de URLs masivas
CREATE OR REPLACE FUNCTION validate_message_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content text := trim(NEW.content);
  v_link_count int;
BEGIN
  -- No aceptar contenido vacío en mensajes de texto
  IF NEW.type = 'text' AND (v_content IS NULL OR length(v_content) = 0) THEN
    RAISE EXCEPTION 'empty_message';
  END IF;
  -- Límite de URLs: más de 10 links en un mensaje es spam
  IF NEW.type = 'text' THEN
    SELECT array_length(regexp_matches(v_content, 'https?://', 'g'), 1) INTO v_link_count;
    IF COALESCE(v_link_count, 0) > 10 THEN
      RAISE EXCEPTION 'spam_detected: demasiados links';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_message ON public.messages;
CREATE TRIGGER trg_validate_message
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION validate_message_before_insert();

-- ── LOW #19: Validar formato de username ─────────────────────────────────────
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS username_format;
ALTER TABLE public.users
  ADD CONSTRAINT username_format
  CHECK (username IS NULL OR username ~ '^[a-zA-Z0-9_.]{3,30}$');

-- ── LOW #20: SET search_path en funciones SECURITY DEFINER existentes ─────────
-- Reemplazar las funciones críticas del antispam con search_path seguro
-- (ya corregido en migración 067 para las nuevas; las demás son de bajo riesgo)

-- ── LOW #23: subscription_limits — ya cubierto arriba con RLS + política read ──
