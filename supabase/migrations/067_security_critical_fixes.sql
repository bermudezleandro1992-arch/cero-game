-- ── Critical security fixes ────────────────────────────────────────────────────

-- ── Fix #2: auto_apply_sanction — solo admins pueden llamarla ──────────────────
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
  -- Solo el sistema (service_role) o admins/moderadores pueden aplicar sanciones
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('ceo', 'admin', 'moderador', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: solo administradores pueden aplicar sanciones';
  END IF;

  SELECT COUNT(*) INTO offense_num FROM public.sanctions WHERE user_id = target_user_id;
  offense_num := offense_num + 1;

  IF offense_num = 1 THEN
    v_type := 'warning'; v_duration := NULL;
  ELSIF offense_num = 2 THEN
    v_type := 'mute'; v_duration := interval '1 hour';
  ELSIF offense_num = 3 THEN
    v_type := 'mute'; v_duration := interval '24 hours';
  ELSIF offense_num = 4 THEN
    v_type := 'ban'; v_duration := interval '7 days';
  ELSE
    v_type := 'ban'; v_duration := NULL;
  END IF;

  INSERT INTO public.sanctions (user_id, type, reason, expires_at, conversation_id, message_id)
  VALUES (
    target_user_id, v_type, p_reason,
    CASE WHEN v_duration IS NOT NULL THEN now() + v_duration ELSE NULL END,
    p_conversation_id, p_message_id
  );
END;
$$;

-- ── Fix #3: approve_identity_verification — solo admins ───────────────────────
CREATE OR REPLACE FUNCTION approve_identity_verification(
  p_verification_id uuid,
  p_reviewer_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('ceo', 'admin', 'moderador', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
  -- Forzar que el reviewer sea el caller real
  UPDATE public.identity_verifications
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), is_verified = true
  WHERE id = p_verification_id;
  -- Marcar usuario como verificado
  UPDATE public.users u
  SET is_verified = true
  FROM public.identity_verifications iv
  WHERE iv.id = p_verification_id AND u.id = iv.user_id;
END;
$$;

CREATE OR REPLACE FUNCTION reject_identity_verification(
  p_verification_id uuid,
  p_reviewer_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('ceo', 'admin', 'moderador', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
  UPDATE public.identity_verifications
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = p_reason
  WHERE id = p_verification_id;
END;
$$;

-- ── Fix #5: referral_stats — solo service_role ────────────────────────────────
-- Revocar acceso de usuarios autenticados a la vista
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'referral_stats' AND schemaname = 'public') THEN
    REVOKE SELECT ON public.referral_stats FROM authenticated;
    GRANT SELECT ON public.referral_stats TO service_role;
  END IF;
END $$;

-- ── Fix #15: guardian_verifications — política "service role" con TO correcto ──
DROP POLICY IF EXISTS "service role all" ON public.guardian_verifications;
CREATE POLICY "service role all" ON public.guardian_verifications
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Fix #16: verify_referral — solo service_role ──────────────────────────────
CREATE OR REPLACE FUNCTION verify_referral(p_referral_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('ceo', 'admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
  UPDATE public.referrals SET status = 'verified', verified_at = now()
  WHERE id = p_referral_id AND status = 'pending';
END;
$$;

-- ── Fix #22: admin_passkeys — solo admins pueden registrar ────────────────────
DROP POLICY IF EXISTS "user inserts own passkeys" ON public.admin_passkeys;
CREATE POLICY "user inserts own passkeys" ON public.admin_passkeys
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('ceo', 'admin', 'superadmin')
    )
  );

-- ── Fix #17: updateProfile — columnas sensibles protegidas contra escritura ────
-- Trigger que rechaza intentos de escribir role/plan/is_verified/elo desde el cliente
CREATE OR REPLACE FUNCTION protect_sensitive_user_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo service_role puede cambiar estos campos
  IF auth.uid() IS NOT NULL THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'No permitido: no podés cambiar tu propio rol';
    END IF;
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      RAISE EXCEPTION 'No permitido: no podés cambiar tu propio plan';
    END IF;
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
      RAISE EXCEPTION 'No permitido: no podés cambiar tu estado de verificación';
    END IF;
    IF NEW.elo IS DISTINCT FROM OLD.elo THEN
      RAISE EXCEPTION 'No permitido: no podés cambiar tu ELO directamente';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_fields ON public.users;
CREATE TRIGGER trg_protect_user_fields
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION protect_sensitive_user_fields();
