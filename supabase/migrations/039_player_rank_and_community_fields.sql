-- ── Player rank within community ─────────────────────────────────────────────
ALTER TABLE public.group_roles
  ADD COLUMN IF NOT EXISTS player_rank text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notes       text DEFAULT NULL;

-- ── Community competition config columns (if not already added) ───────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS torneos_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS ligas_enabled   boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS clanes_enabled  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS game_rules      jsonb   DEFAULT '{}';
