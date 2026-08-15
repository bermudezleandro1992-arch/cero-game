-- ═══════════════════════════════════════════════════════════
-- Chat Features: categorías privadas, solicitudes de amistad,
--                historial, mensajes temporales
-- ═══════════════════════════════════════════════════════════

-- ── Solicitudes de amistad ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending'  -- 'pending' | 'accepted' | 'rejected'
              CHECK (status IN ('pending','accepted','rejected')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (from_id, to_id)
);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede enviar, solo los involucrados pueden ver/gestionar
CREATE POLICY "send_friend_request"
  ON public.friend_requests FOR INSERT TO authenticated
  WITH CHECK (from_id = auth.uid() AND from_id <> to_id);

CREATE POLICY "see_own_requests"
  ON public.friend_requests FOR SELECT TO authenticated
  USING (from_id = auth.uid() OR to_id = auth.uid());

CREATE POLICY "manage_received_requests"
  ON public.friend_requests FOR UPDATE TO authenticated
  USING (to_id = auth.uid());

CREATE POLICY "delete_own_request"
  ON public.friend_requests FOR DELETE TO authenticated
  USING (from_id = auth.uid() OR to_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_friend_requests_to
  ON public.friend_requests(to_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from
  ON public.friend_requests(from_id, status);

-- ── Categorías de contactos privadas (Amigo, Clan, Conocido) ─
CREATE TABLE IF NOT EXISTS public.contact_categories (
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category   text NOT NULL CHECK (category IN ('amigo','clan','conocido')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, contact_id)
);

ALTER TABLE public.contact_categories ENABLE ROW LEVEL SECURITY;

-- Solo el propio usuario ve y gestiona sus categorías (completamente privado)
CREATE POLICY "users_manage_own_categories"
  ON public.contact_categories FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_contact_categories_user
  ON public.contact_categories(user_id, category);

-- ── Configuraciones de grupo ────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS auto_delete_hours  integer,
  ADD COLUMN IF NOT EXISTS who_can_send       text DEFAULT 'everyone',   -- 'everyone'|'admins'
  ADD COLUMN IF NOT EXISTS who_can_add        text DEFAULT 'everyone',   -- 'everyone'|'admins'
  ADD COLUMN IF NOT EXISTS who_can_edit_info  text DEFAULT 'everyone',   -- 'everyone'|'admins'
  ADD COLUMN IF NOT EXISTS slow_mode_seconds  integer,                   -- null = off
  ADD COLUMN IF NOT EXISTS invite_link        text UNIQUE,
  ADD COLUMN IF NOT EXISTS is_locked          boolean DEFAULT false;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- ── Limpiar historial por usuario ──────────────────────────
ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS cleared_at  timestamptz,
  ADD COLUMN IF NOT EXISTS muted_until timestamptz;    -- miembro silenciado en el grupo

-- ── Roles dentro del grupo ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_roles (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','moderator','member')),
  granted_by      uuid REFERENCES public.users(id),
  created_at      timestamptz DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.group_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_see_group_roles"
  ON public.group_roles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = group_roles.conversation_id AND user_id = auth.uid()
  ));

CREATE POLICY "admins_manage_group_roles"
  ON public.group_roles FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_roles gr2
    WHERE gr2.conversation_id = group_roles.conversation_id
      AND gr2.user_id = auth.uid()
      AND gr2.role IN ('owner','admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.group_roles gr2
    WHERE gr2.conversation_id = group_roles.conversation_id
      AND gr2.user_id = auth.uid()
      AND gr2.role IN ('owner','admin')
  ));

CREATE INDEX IF NOT EXISTS idx_group_roles_conv ON public.group_roles(conversation_id);
CREATE INDEX IF NOT EXISTS idx_group_roles_user ON public.group_roles(user_id);

-- ── Índice para auto-borrado ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_expires
  ON public.messages(expires_at) WHERE expires_at IS NOT NULL;
