-- ═══════════════════════════════════════════════════════════
-- Semana 3: Sistema Anti-Spam
-- ═══════════════════════════════════════════════════════════

-- ── Admins ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id    uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_read_admins"
  ON public.admin_users FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admins_can_manage_admins"
  ON public.admin_users FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── Sanciones ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sanctions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  admin_id           uuid REFERENCES public.users(id),  -- null = automática
  reason             text NOT NULL,
  offense_count      integer DEFAULT 1,
  sanction_type      text DEFAULT 'mute',  -- 'mute' | 'ban' | 'permanent_ban'
  duration_hours     integer,              -- null = permanente
  expires_at         timestamptz,          -- null = permanente
  is_active          boolean DEFAULT true,
  ip_address         text,
  device_fingerprint text,
  context            jsonb,               -- mensaje detectado, conversación, etc.
  created_at         timestamptz DEFAULT now()
);

ALTER TABLE public.sanctions ENABLE ROW LEVEL SECURITY;

-- Admins ven todo; usuarios solo ven sus propias sanciones
CREATE POLICY "admins_read_sanctions"
  ON public.sanctions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "admins_write_sanctions"
  ON public.sanctions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- Función para insertar sanción automática (SECURITY DEFINER para bypass RLS)
CREATE OR REPLACE FUNCTION auto_apply_sanction(
  target_user_id  uuid,
  p_reason        text,
  p_ip            text DEFAULT NULL,
  p_fingerprint   text DEFAULT NULL,
  p_context       jsonb DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  offense_num    integer;
  hours          integer;
  expires        timestamptz;
  s_type         text;
  result         jsonb;
BEGIN
  -- Contar sanciones previas (todas, no solo activas)
  SELECT COUNT(*) INTO offense_num
  FROM public.sanctions
  WHERE user_id = target_user_id;

  offense_num := offense_num + 1;

  -- Escala progresiva
  CASE offense_num
    WHEN 1 THEN hours := 1;    s_type := 'mute';
    WHEN 2 THEN hours := 6;    s_type := 'mute';
    WHEN 3 THEN hours := 24;   s_type := 'mute';
    WHEN 4 THEN hours := 168;  s_type := 'ban';   -- 7 días
    ELSE         hours := NULL; s_type := 'permanent_ban';
  END CASE;

  expires := CASE WHEN hours IS NOT NULL
    THEN now() + (hours || ' hours')::interval
    ELSE NULL
  END;

  -- Desactivar sanción activa anterior
  UPDATE public.sanctions
  SET is_active = false
  WHERE user_id = target_user_id AND is_active = true;

  -- Insertar nueva sanción
  INSERT INTO public.sanctions
    (user_id, reason, offense_count, sanction_type, duration_hours, expires_at, ip_address, device_fingerprint, context)
  VALUES
    (target_user_id, p_reason, offense_num, s_type, hours, expires, p_ip, p_fingerprint, p_context);

  result := jsonb_build_object(
    'offense_count',   offense_num,
    'sanction_type',   s_type,
    'duration_hours',  hours,
    'expires_at',      expires
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si un usuario está sancionado
CREATE OR REPLACE FUNCTION check_user_sanctioned(target_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  sanction public.sanctions%ROWTYPE;
BEGIN
  SELECT * INTO sanction
  FROM public.sanctions
  WHERE user_id = target_user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- Limpiar sanciones vencidas
    UPDATE public.sanctions
    SET is_active = false
    WHERE user_id = target_user_id AND is_active = true AND expires_at <= now();

    RETURN jsonb_build_object('sanctioned', false);
  END IF;

  RETURN jsonb_build_object(
    'sanctioned',      true,
    'sanction_type',   sanction.sanction_type,
    'reason',          sanction.reason,
    'expires_at',      sanction.expires_at,
    'offense_count',   sanction.offense_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Reportes de spam ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.spam_reports (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_user_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message_id         uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  conversation_id    uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  reason             text NOT NULL,  -- 'spam_link' | 'spam_flood' | 'harassment' | 'other'
  content_snapshot   text,           -- copia del mensaje reportado
  status             text DEFAULT 'pending',  -- 'pending' | 'actioned' | 'dismissed'
  reviewed_by        uuid REFERENCES public.users(id),
  created_at         timestamptz DEFAULT now()
);

ALTER TABLE public.spam_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_report"
  ON public.spam_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "users_see_own_reports"
  ON public.spam_reports FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "admins_manage_reports"
  ON public.spam_reports FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── Índices ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sanctions_user_active
  ON public.sanctions(user_id, is_active, expires_at);

CREATE INDEX IF NOT EXISTS idx_spam_reports_status
  ON public.spam_reports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_spam_reports_reported
  ON public.spam_reports(reported_user_id, created_at DESC);
