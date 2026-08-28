-- 047: Tournament extra fields + daily limit bump + security fields on profiles

-- ── Conversations (tournaments / ligas) ──────────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS result_mode          text    DEFAULT 'jugadores',  -- 'manual' | 'jugadores'
  ADD COLUMN IF NOT EXISTS dispute_time_min     int     DEFAULT 10,
  ADD COLUMN IF NOT EXISTS start_date           timestamptz,
  ADD COLUMN IF NOT EXISTS registration_close   timestamptz,
  ADD COLUMN IF NOT EXISTS platform             text    DEFAULT 'crossplay',  -- 'ps5','ps4','pc','xbox','crossplay'
  ADD COLUMN IF NOT EXISTS country_restriction  text    DEFAULT 'global',     -- ISO-3166-1 alpha-2 or 'global'
  ADD COLUMN IF NOT EXISTS rules                text,                         -- reglamento de sala
  ADD COLUMN IF NOT EXISTS inscription_fee      text;                         -- descripción precio (gratis / USD X / LFC X)

-- ── Liga-specific columns ─────────────────────────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS liga_tipo        text    DEFAULT 'genuino',  -- 'genuino' | 'dreamteam'
  ADD COLUMN IF NOT EXISTS liga_fase        text,                       -- 'apertura' | 'clausura' | 'copa' | null
  ADD COLUMN IF NOT EXISTS temporada        int     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS division         text    DEFAULT 'A',        -- 'A' | 'B' | 'C' | 'D'
  ADD COLUMN IF NOT EXISTS clasifica_copa   int     DEFAULT 8;          -- top N que van a Copa

-- ── Profiles: security fields ─────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS country_code         text,   -- ISO-3166-1 alpha-2, set on signup via IP
  ADD COLUMN IF NOT EXISTS registration_ip      text,   -- IP on first signup
  ADD COLUMN IF NOT EXISTS device_fingerprint   text;   -- optional browser fingerprint hash

-- ── Daily limit: miembros normales ahora pueden crear 2 por día ───────────────
CREATE OR REPLACE FUNCTION get_role_daily_limit(p_role text)
RETURNS int
LANGUAGE sql
IMMUTABLE AS $$
  SELECT CASE p_role
    WHEN 'ceo'         THEN 999
    WHEN 'admin'       THEN 99
    WHEN 'comunidad'   THEN 20
    WHEN 'vip'         THEN 10
    WHEN 'moderador'   THEN 5
    WHEN 'organizador' THEN 3
    ELSE 2   -- member / default: 2 por día
  END;
$$;
