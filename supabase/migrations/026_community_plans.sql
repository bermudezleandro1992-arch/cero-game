-- ═══════════════════════════════════════════════════════════
-- 026: Community Plans — free vs PRO
-- ═══════════════════════════════════════════════════════════

-- Plan field on conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free','pro'));

-- Thresholds for bot alerts (e.g. notify when N spots left)
ALTER TABLE public.bot_templates
  ADD COLUMN IF NOT EXISTS alert_thresholds integer[] DEFAULT NULL;

-- Index for fast plan lookups by bot-api
CREATE INDEX IF NOT EXISTS idx_conversations_plan ON public.conversations(plan);

-- Policy: only service role can change plan (admins use dashboard)
-- Regular users can read plan
DROP POLICY IF EXISTS "read_plan" ON public.conversations;
