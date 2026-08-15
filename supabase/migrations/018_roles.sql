-- ═══════════════════════════════════════════════════════════
-- Sistema de Rangos
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       text NOT NULL,  -- 'vip' | 'community' | 'moderator'
  granted_by uuid REFERENCES public.users(id),
  notes      text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden ver los rangos (para mostrar badges)
CREATE POLICY "anyone_can_read_roles"
  ON public.user_roles FOR SELECT TO authenticated USING (true);

-- Solo admins pueden gestionar rangos
CREATE POLICY "admins_manage_roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- Función para verificar si el usuario tiene un rango
CREATE OR REPLACE FUNCTION user_has_role(target_user_id uuid, p_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = target_user_id AND role = p_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Índice
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role  ON public.user_roles(role);

-- Las comunidades/grupos ahora son privados por defecto
-- (is_public ya existe, solo actualizamos el default conceptual — los existentes quedan como están)
-- Para dejarlos todos privados de golpe, descomentar:
-- UPDATE public.conversations SET is_public = false WHERE is_group = true;
