-- ═══════════════════════════════════════════════════════════════════════════
-- 057: Add missing columns to conversations
-- ═══════════════════════════════════════════════════════════════════════════

-- max_members: capacity cap for communities (used in CEOPanel Config tab)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 500;

-- liga_tipo: type of league (used in CommunityTournamentsPanel / TournamentDashboard)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS liga_tipo TEXT DEFAULT 'todos_contra_todos'
    CHECK (liga_tipo IN ('todos_contra_todos', 'grupos_y_eliminatoria', 'suizo'));

-- liga_tipo / liga_fase / temporada / division: league sub-type fields
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS liga_tipo  TEXT DEFAULT 'todos_contra_todos'
    CHECK (liga_tipo IN ('todos_contra_todos', 'grupos_y_eliminatoria', 'suizo'));
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS liga_fase  TEXT;
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS temporada  TEXT;
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS division   TEXT;

-- invite_code was added in 055 but may be missing if that migration wasn't run
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;
