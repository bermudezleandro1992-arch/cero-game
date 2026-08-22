-- ═══════════════════════════════════════════════════════════════════════════
-- 056: Subscriptions + Community v2 (category, rules, join_mode, permissions)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. subscriptions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan                       TEXT NOT NULL CHECK (plan IN ('free', 'vip', 'pro')),
  status                     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired', 'trial')),
  start_date                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date                   TIMESTAMPTZ,
  stripe_subscription_id     TEXT,
  stripe_customer_id         TEXT,
  mercadopago_subscription_id TEXT,
  created_at                 TIMESTAMPTZ DEFAULT now(),
  updated_at                 TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subs_own" ON public.subscriptions;
CREATE POLICY "subs_own" ON public.subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- ── 2. subscription_limits ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_limits (
  plan                        TEXT PRIMARY KEY CHECK (plan IN ('free', 'vip', 'pro')),
  max_comunidades             INTEGER DEFAULT 1,
  max_miembros_comunidad      INTEGER DEFAULT 50,
  max_torneos_simultaneos     INTEGER DEFAULT 1,
  max_jugadores_torneo        INTEGER DEFAULT 8,
  max_torneos_dia             INTEGER DEFAULT 1,
  tiene_estadisticas_avanzadas BOOLEAN DEFAULT false,
  tiene_ranking_global        BOOLEAN DEFAULT false,
  tiene_panel_ceo             BOOLEAN DEFAULT false,
  tiene_sorteos_vivo          BOOLEAN DEFAULT false,
  tiene_api_bots              BOOLEAN DEFAULT false,
  tiene_llamadas_grupales     BOOLEAN DEFAULT false
);

INSERT INTO public.subscription_limits VALUES
  ('free', 1,   50,  1,   8,   1,   false, false, false, false, false, false),
  ('vip',  3,   200, 3,   16,  999, true,  true,  false, false, false, false),
  ('pro',  999, 999, 999, 999, 999, true,  true,  true,  true,  true,  true)
ON CONFLICT (plan) DO UPDATE SET
  max_comunidades             = EXCLUDED.max_comunidades,
  max_miembros_comunidad      = EXCLUDED.max_miembros_comunidad,
  max_torneos_simultaneos     = EXCLUDED.max_torneos_simultaneos,
  max_jugadores_torneo        = EXCLUDED.max_jugadores_torneo,
  max_torneos_dia             = EXCLUDED.max_torneos_dia,
  tiene_estadisticas_avanzadas = EXCLUDED.tiene_estadisticas_avanzadas,
  tiene_ranking_global        = EXCLUDED.tiene_ranking_global,
  tiene_panel_ceo             = EXCLUDED.tiene_panel_ceo,
  tiene_sorteos_vivo          = EXCLUDED.tiene_sorteos_vivo,
  tiene_api_bots              = EXCLUDED.tiene_api_bots,
  tiene_llamadas_grupales     = EXCLUDED.tiene_llamadas_grupales;

-- ── 3. payment_history ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_history (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount                  DECIMAL(10,2) NOT NULL,
  currency                TEXT DEFAULT 'USD',
  plan                    TEXT NOT NULL,
  status                  TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  stripe_payment_id       TEXT,
  mercadopago_payment_id  TEXT,
  created_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_own" ON public.payment_history;
CREATE POLICY "payments_own" ON public.payment_history
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── 4. community_invites ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  token        TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 12),
  created_by   UUID NOT NULL REFERENCES public.profiles(id),
  uses         INTEGER DEFAULT 0,
  max_uses     INTEGER DEFAULT 100,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_invites_token ON public.community_invites(token);
CREATE INDEX IF NOT EXISTS idx_community_invites_community ON public.community_invites(community_id);

ALTER TABLE public.community_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invites_read" ON public.community_invites;
DROP POLICY IF EXISTS "invites_manage" ON public.community_invites;
CREATE POLICY "invites_read" ON public.community_invites FOR SELECT TO authenticated USING (true);
CREATE POLICY "invites_manage" ON public.community_invites FOR ALL TO authenticated USING (created_by = auth.uid());

-- ── 5. Community v2 fields on conversations ───────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS category      TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS rules         TEXT,
  ADD COLUMN IF NOT EXISTS join_mode     TEXT DEFAULT 'public'
    CHECK (join_mode IN ('public', 'approval', 'invite_only')),
  ADD COLUMN IF NOT EXISTS permissions   JSONB DEFAULT '{
    "who_can_send": "everyone",
    "who_can_create_tournaments": "admins",
    "who_can_invite": "admins",
    "who_can_kick": "admins"
  }'::jsonb;

-- ── 6. RPC: get_user_plan ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan TEXT;
BEGIN
  SELECT plan INTO v_plan FROM public.subscriptions
  WHERE user_id = p_user_id AND status IN ('active', 'trial')
    AND (end_date IS NULL OR end_date > now())
  ORDER BY created_at DESC LIMIT 1;
  RETURN COALESCE(v_plan, 'free');
END; $$;

GRANT EXECUTE ON FUNCTION public.get_user_plan(UUID) TO authenticated;

-- ── 7. RPC: has_premium_feature ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_premium_feature(p_user_id UUID, p_feature TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan TEXT; v_has BOOLEAN;
BEGIN
  v_plan := get_user_plan(p_user_id);
  EXECUTE format('SELECT tiene_%s FROM subscription_limits WHERE plan = $1', p_feature)
  INTO v_has USING v_plan;
  RETURN COALESCE(v_has, false);
EXCEPTION WHEN OTHERS THEN RETURN false;
END; $$;

GRANT EXECUTE ON FUNCTION public.has_premium_feature(UUID, TEXT) TO authenticated;

-- ── 8. RPC: create_community_invite ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_community_invite(
  p_community_id UUID,
  p_max_uses     INTEGER DEFAULT 100,
  p_expires_hours INTEGER DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_token TEXT;
  v_exp   TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_community_id AND user_id = v_uid
      AND role IN ('owner', 'admin', 'ceo')
    UNION ALL
    SELECT 1 FROM public.profiles WHERE id = v_uid AND role IN ('ceo', 'admin')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_permission');
  END IF;

  v_token := substr(md5(random()::text || v_uid::text), 1, 12);
  IF p_expires_hours IS NOT NULL THEN
    v_exp := now() + (p_expires_hours || ' hours')::interval;
  END IF;

  INSERT INTO public.community_invites (community_id, token, created_by, max_uses, expires_at)
  VALUES (p_community_id, v_token, v_uid, p_max_uses, v_exp);

  RETURN jsonb_build_object('ok', true, 'token', v_token);
END; $$;

GRANT EXECUTE ON FUNCTION public.create_community_invite(UUID, INTEGER, INTEGER) TO authenticated;

-- ── 9. RPC: join_via_invite ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_via_invite(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_invite RECORD;
BEGIN
  SELECT * INTO v_invite FROM public.community_invites
  WHERE token = p_token
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses = 0 OR uses < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;

  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (v_invite.community_id, v_uid, 'member')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  UPDATE public.community_invites SET uses = uses + 1 WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true, 'community_id', v_invite.community_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.join_via_invite(TEXT) TO authenticated;
