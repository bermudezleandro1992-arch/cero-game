-- Admin passkeys for WebAuthn biometric authentication
CREATE TABLE IF NOT EXISTS public.admin_passkeys (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  credential_id TEXT        NOT NULL UNIQUE,
  device_name   TEXT,       -- e.g. "iPhone 15 – Touch ID"
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);

ALTER TABLE public.admin_passkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own passkeys" ON public.admin_passkeys FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "user inserts own passkeys" ON public.admin_passkeys FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user deletes own passkeys" ON public.admin_passkeys FOR DELETE
  USING (auth.uid() = user_id);
CREATE POLICY "user updates own passkeys" ON public.admin_passkeys FOR UPDATE
  USING (auth.uid() = user_id);

-- Add staff_note and priority columns to support_tickets if not present
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS priority  TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  ADD COLUMN IF NOT EXISTS category  TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS staff_note TEXT,
  ADD COLUMN IF NOT EXISTS title     TEXT,
  ADD COLUMN IF NOT EXISTS body      TEXT;

-- Tournament disputes table
CREATE TABLE IF NOT EXISTS public.disputes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID        REFERENCES public.conversations(id) ON DELETE SET NULL,
  reporter_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  accused_id    UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  type          TEXT        NOT NULL DEFAULT 'result' CHECK (type IN ('result','conduct','cheating','other')),
  description   TEXT        NOT NULL,
  evidence_urls TEXT[],
  status        TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  resolution    TEXT,
  resolved_by   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reporter sees own disputes" ON public.disputes FOR SELECT
  USING (auth.uid() = reporter_id OR auth.uid() = accused_id
    OR auth.uid() IN (SELECT id FROM public.users WHERE role IN ('ceo','admin','moderador')));
CREATE POLICY "user inserts dispute" ON public.disputes FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "staff updates dispute" ON public.disputes FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('ceo','admin','moderador')));
