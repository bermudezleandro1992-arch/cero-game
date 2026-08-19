-- ── Tournament status column ──────────────────────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS tournament_status text DEFAULT 'inscripcion';
