-- Migration 026: tabla de reportes + privacidad de usuario

-- Tabla de reportes de usuarios/mensajes
CREATE TABLE IF NOT EXISTS public.reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  reported_msg_id  uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  reason           text NOT NULL,
  context          text DEFAULT 'profile', -- 'profile' | 'message' | 'group'
  status           text DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  reviewed_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_insert" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

CREATE POLICY "reports_admin" ON public.reports
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ceo','admin')));

-- Columna show_last_seen si no existe (ya puede estar en 004)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS show_last_seen boolean DEFAULT true;

-- Columna privacy_dm: quién puede enviarme DMs
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS privacy_dm text DEFAULT 'everyone'
  CHECK (privacy_dm IN ('everyone','contacts','nobody'));

-- Índices
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON public.reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker   ON public.blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked   ON public.blocks(blocked_id);
