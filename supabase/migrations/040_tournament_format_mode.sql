-- ── Tournament format and mode columns ───────────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS tournament_format text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tournament_mode   text DEFAULT NULL;
