-- ═══════════════════════════════════════════════════════════
-- 022: Sistema de roles y límites por tier
-- ═══════════════════════════════════════════════════════════

-- Agregar columna role a users si no existe
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'member'
  CHECK (role IS NULL OR role IN ('member','organizador','vip','comunidad','admin','ceo'));

-- Agregar columna plan a users si no existe
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free'
  CHECK (plan IS NULL OR plan IN ('free','organizador','vip','comunidad'));

-- ── Asignar CEO al dueño de la plataforma ────────────────────
-- IMPORTANTE: reemplazá el email con el tuyo si es diferente
UPDATE public.users
  SET role = 'ceo'
  WHERE email IN ('bermudezleandro1992@gmail.com', 'mutrueno@live.com.ar');

-- ── Vista helper: perfil completo con permisos ───────────────
CREATE OR REPLACE VIEW public.user_permissions AS
SELECT
  u.id,
  u.role,
  u.plan,
  u.is_verified,
  CASE u.role
    WHEN 'ceo'         THEN 9999
    WHEN 'admin'       THEN 9999
    WHEN 'comunidad'   THEN 512
    WHEN 'vip'         THEN 128
    WHEN 'organizador' THEN 32
    ELSE 16
  END AS max_participants,
  CASE u.role
    WHEN 'ceo'         THEN true
    WHEN 'admin'       THEN true
    WHEN 'comunidad'   THEN true
    WHEN 'vip'         THEN true
    WHEN 'organizador' THEN true
    ELSE false
  END AS can_publish_announcements,
  CASE u.role
    WHEN 'ceo'         THEN true
    WHEN 'admin'       THEN true
    WHEN 'comunidad'   THEN true
    ELSE false
  END AS can_create_community
FROM public.users u
WHERE u.id = auth.uid();

GRANT SELECT ON public.user_permissions TO authenticated;
