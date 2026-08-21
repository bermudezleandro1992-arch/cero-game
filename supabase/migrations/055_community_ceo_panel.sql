-- ═══════════════════════════════════════════════════════════════════════════
-- 055: CEO Panel — campos adicionales en conversations para gestión
-- ═══════════════════════════════════════════════════════════════════════════

-- invite_code para generar links de invitación
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS invite_code text UNIQUE DEFAULT gen_random_uuid()::text;

-- is_private para control de visibilidad
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

-- dispute_timeout_minutes para configurar el tiempo de disputa por comunidad
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS dispute_timeout_minutes integer DEFAULT 10;

-- Índice para búsqueda por invite_code
CREATE INDEX IF NOT EXISTS idx_conversations_invite_code ON public.conversations(invite_code);

-- Rellenar invite_code donde sea NULL (por filas existentes antes de este migración)
UPDATE public.conversations
SET invite_code = gen_random_uuid()::text
WHERE invite_code IS NULL;
