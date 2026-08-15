-- ═══════════════════════════════════════════════════════════
-- Sistema de Suscripciones y Pagos
-- ═══════════════════════════════════════════════════════════

-- ── Tabla de suscripciones activas ─────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan            text NOT NULL CHECK (plan IN ('free','vip','comunidad')),
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','expired','cancelled','pending')),
  payment_method  text,              -- 'mercadopago' | 'binance' | 'astropay' | 'manual'
  external_id     text,              -- ID del pago externo (MP preference_id, TX hash, etc.)
  amount_usd      numeric(8,2),
  started_at      timestamptz DEFAULT now(),
  expires_at      timestamptz,       -- null = no expira (gratis)
  auto_renew      boolean DEFAULT false,
  granted_by      uuid REFERENCES public.users(id),  -- null = pago, uuid = admin lo asignó
  notes           text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "admins_manage_subscriptions"
  ON public.subscriptions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- Service role puede insertar (desde edge functions/webhooks)
CREATE POLICY "service_insert_subscriptions"
  ON public.subscriptions FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "service_update_subscriptions"
  ON public.subscriptions FOR UPDATE TO service_role USING (true);

-- ── Tabla de pagos / transacciones ─────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id),
  plan            text NOT NULL,
  method          text NOT NULL,     -- 'mercadopago' | 'binance' | 'astropay'
  amount_usd      numeric(8,2) NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','refunded')),
  external_id     text,              -- preference_id de MP, TX hash de crypto
  tx_hash         text,              -- para crypto
  raw_data        jsonb,             -- respuesta completa del proveedor
  reviewed_by     uuid REFERENCES public.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_payments"
  ON public.payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "users_insert_own_payments"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins_manage_payments"
  ON public.payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "service_manage_payments"
  ON public.payments FOR ALL TO service_role USING (true);

-- ── Función para activar suscripción ───────────────────────
CREATE OR REPLACE FUNCTION activate_subscription(
  p_user_id       uuid,
  p_plan          text,
  p_payment_id    uuid DEFAULT NULL,
  p_method        text DEFAULT 'manual',
  p_granted_by    uuid DEFAULT NULL,
  p_months        integer DEFAULT 1
) RETURNS uuid AS $$
DECLARE
  sub_id uuid;
BEGIN
  -- Desactivar suscripción anterior si existe
  UPDATE public.subscriptions
  SET status = 'expired'
  WHERE user_id = p_user_id AND status = 'active' AND plan != 'free';

  -- Insertar nueva suscripción
  INSERT INTO public.subscriptions
    (user_id, plan, status, payment_method, started_at, expires_at, granted_by)
  VALUES
    (p_user_id, p_plan, 'active', p_method, now(), now() + (p_months || ' months')::interval, p_granted_by)
  RETURNING id INTO sub_id;

  -- Actualizar plan en users table
  UPDATE public.users SET plan = p_plan WHERE id = p_user_id;

  -- Asignar rol en user_roles
  INSERT INTO public.user_roles (user_id, role, granted_by)
  VALUES (p_user_id, p_plan, p_granted_by)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Vincular el pago si se pasó
  IF p_payment_id IS NOT NULL THEN
    UPDATE public.payments SET subscription_id = sub_id WHERE id = p_payment_id;
  END IF;

  RETURN sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Vista: suscripción activa por usuario ──────────────────
CREATE OR REPLACE VIEW public.active_subscriptions AS
SELECT DISTINCT ON (user_id)
  id, user_id, plan, status, payment_method, expires_at, created_at
FROM public.subscriptions
WHERE status = 'active'
ORDER BY user_id, created_at DESC;

-- ── Índices ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_user   ON public.subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expire ON public.subscriptions(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_payments_user        ON public.payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_external    ON public.payments(external_id) WHERE external_id IS NOT NULL;
