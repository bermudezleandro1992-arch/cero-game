-- 071: sorteo_starts_at for synchronized countdown across all viewers
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS sorteo_starts_at timestamptz;
