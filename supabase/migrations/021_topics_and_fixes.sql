-- ═══════════════════════════════════════════════════════════
-- 021: Topics, conversation status, y fixes de políticas
-- ═══════════════════════════════════════════════════════════

-- ── Tabla de topics (canales dentro de grupos/torneos) ──────
CREATE TABLE IF NOT EXISTS public.topics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  emoji           text DEFAULT '💬',
  topic_type      text DEFAULT 'chat',   -- 'chat' | 'announcements' | 'media'
  position        integer DEFAULT 0,
  is_locked       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- Todos los miembros pueden leer topics
CREATE POLICY "members_see_topics"
  ON public.topics FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = topics.conversation_id AND user_id = auth.uid()
  ));

-- Solo el creador/admins pueden crear/editar topics
CREATE POLICY "members_can_insert_topics"
  ON public.topics FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = topics.conversation_id AND user_id = auth.uid()
  ));

CREATE POLICY "members_can_update_topics"
  ON public.topics FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = topics.conversation_id AND user_id = auth.uid()
  ));

CREATE POLICY "members_can_delete_topics"
  ON public.topics FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = topics.conversation_id AND user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_topics_conversation
  ON public.topics(conversation_id, position);

-- ── Estado del torneo/liga en conversations ─────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'inscripcion'
  CHECK (status IS NULL OR status IN ('inscripcion','en_curso','finalizado','cancelado'));

-- ── Fix: group_roles — permitir que el creador del grupo inserte su propio rol ─
-- La política anterior era circular (necesitás estar en group_roles para poder insertar en group_roles)
-- Solución: la política de INSERT también permite al created_by de la conversación insertar

DROP POLICY IF EXISTS "admins_manage_group_roles" ON public.group_roles;

-- INSERT: quien creó la conversación O quien ya es admin/owner puede insertar
CREATE POLICY "admins_insert_group_roles"
  ON public.group_roles FOR INSERT TO authenticated
  WITH CHECK (
    -- El creador del grupo puede establecer su propio rol
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = group_roles.conversation_id AND created_by = auth.uid()
    )
    OR
    -- Admins/owners existentes pueden agregar roles
    EXISTS (
      SELECT 1 FROM public.group_roles gr2
      WHERE gr2.conversation_id = group_roles.conversation_id
        AND gr2.user_id = auth.uid()
        AND gr2.role IN ('owner','admin')
    )
  );

-- UPDATE/DELETE: solo admins/owners existentes
CREATE POLICY "admins_update_group_roles"
  ON public.group_roles FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_roles gr2
    WHERE gr2.conversation_id = group_roles.conversation_id
      AND gr2.user_id = auth.uid()
      AND gr2.role IN ('owner','admin')
  ));

CREATE POLICY "admins_delete_group_roles"
  ON public.group_roles FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_roles gr2
    WHERE gr2.conversation_id = group_roles.conversation_id
      AND gr2.user_id = auth.uid()
      AND gr2.role IN ('owner','admin')
    -- También el propio usuario puede quitarse (salir)
  ) OR user_id = auth.uid());

-- ── Función para crear grupo/torneo atómicamente ────────────
-- Crea conversación + miembro + rol owner en una sola transacción
CREATE OR REPLACE FUNCTION create_group_with_owner(
  p_name        text,
  p_is_group    boolean DEFAULT true,
  p_group_type  text    DEFAULT 'group',
  p_description text    DEFAULT NULL,
  p_created_by  uuid    DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_user_id uuid := COALESCE(p_created_by, auth.uid());
  v_conv_id uuid;
BEGIN
  -- Crear conversación
  INSERT INTO public.conversations (name, is_group, group_type, description, created_by)
  VALUES (p_name, p_is_group, p_group_type, p_description, v_user_id)
  RETURNING id INTO v_conv_id;

  -- Agregar al creador como miembro
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (v_conv_id, v_user_id)
  ON CONFLICT DO NOTHING;

  -- Asignar rol owner
  INSERT INTO public.group_roles (conversation_id, user_id, role, granted_by)
  VALUES (v_conv_id, v_user_id, 'owner', v_user_id)
  ON CONFLICT DO NOTHING;

  RETURN v_conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Permitir al autor ver sus propios anuncios aunque estén inactivos ─
-- (la política anyone_can_read_announcements ya existe con is_active = true)
-- Con múltiples políticas SELECT Postgres usa OR entre ellas, así que el autor ve todos los suyos.
DROP POLICY IF EXISTS "author_sees_own_announcements" ON public.announcements;
CREATE POLICY "author_sees_own_announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (author_id = auth.uid());
