-- 035: roles personalizados para comunidades PRO + RPC para validar límites de join

-- ── Tabla de roles personalizados ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_custom_roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  color           text NOT NULL DEFAULT '#64748b',
  icon            text,
  priority        int  NOT NULL DEFAULT 0,
  -- Permisos booleanos
  can_send_messages   boolean NOT NULL DEFAULT true,
  can_manage_members  boolean NOT NULL DEFAULT false,
  can_kick_members    boolean NOT NULL DEFAULT false,
  can_ban_members     boolean NOT NULL DEFAULT false,
  can_mute_members    boolean NOT NULL DEFAULT false,
  can_manage_roles    boolean NOT NULL DEFAULT false,
  can_create_tournaments boolean NOT NULL DEFAULT false,
  can_manage_tournaments boolean NOT NULL DEFAULT false,
  can_create_events   boolean NOT NULL DEFAULT false,
  can_manage_events   boolean NOT NULL DEFAULT false,
  can_publish_announcements boolean NOT NULL DEFAULT false,
  can_manage_announcements  boolean NOT NULL DEFAULT false,
  can_view_stats      boolean NOT NULL DEFAULT false,
  can_manage_bots     boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, name)
);

-- Asignación de roles personalizados a miembros
CREATE TABLE IF NOT EXISTS public.community_role_members (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id         uuid NOT NULL REFERENCES public.community_custom_roles(id) ON DELETE CASCADE,
  assigned_by     uuid REFERENCES public.users(id),
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_roles_conv ON public.community_custom_roles(conversation_id);
CREATE INDEX IF NOT EXISTS idx_role_members_conv  ON public.community_role_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_role_members_user  ON public.community_role_members(user_id);

-- RLS
ALTER TABLE public.community_custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_role_members ENABLE ROW LEVEL SECURITY;

-- Lectura: miembros de la comunidad
CREATE POLICY "members_read_custom_roles"
  ON public.community_custom_roles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = community_custom_roles.conversation_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = community_custom_roles.conversation_id AND c.is_public = true
    )
  );

-- Gestión: owner/admin de la comunidad
CREATE POLICY "admins_manage_custom_roles"
  ON public.community_custom_roles FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_roles gr
      WHERE gr.conversation_id = community_custom_roles.conversation_id
        AND gr.user_id = auth.uid()
        AND gr.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'ceo')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_roles gr
      WHERE gr.conversation_id = community_custom_roles.conversation_id
        AND gr.user_id = auth.uid()
        AND gr.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'ceo')
    )
  );

CREATE POLICY "members_read_role_assignments"
  ON public.community_role_members FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admins_manage_role_assignments"
  ON public.community_role_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_roles gr
      WHERE gr.conversation_id = community_role_members.conversation_id
        AND gr.user_id = auth.uid()
        AND gr.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'ceo')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_roles gr
      WHERE gr.conversation_id = community_role_members.conversation_id
        AND gr.user_id = auth.uid()
        AND gr.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'ceo')
    )
  );

-- ── RPC: join_community con validación de límite ──────────────────────────────
-- Verifica capacidad según el plan del owner antes de dejar unirse
CREATE OR REPLACE FUNCTION public.join_community(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_owner_id    uuid;
  v_owner_role  text;
  v_max_members int;
  v_current     int;
  v_is_public   boolean;
  v_group_type  text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Obtener datos de la conversación
  SELECT created_by, is_public, group_type
    INTO v_owner_id, v_is_public, v_group_type
    FROM public.conversations
   WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Solo comunidades/grupos públicos
  IF NOT v_is_public THEN
    RETURN jsonb_build_object('ok', false, 'error', 'private');
  END IF;

  -- Si ya es miembro, retornar ok sin duplicar
  IF EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_member', true);
  END IF;

  -- Obtener rol del owner para determinar límite
  SELECT role INTO v_owner_role FROM public.users WHERE id = v_owner_id;

  -- Mapear rol a límite de miembros
  v_max_members := CASE v_owner_role
    WHEN 'ceo'       THEN 9999
    WHEN 'admin'     THEN 9999
    WHEN 'comunidad' THEN 10000
    WHEN 'vip'       THEN 1000
    ELSE 50  -- member, organizador, moderador
  END;

  -- Contar miembros actuales
  SELECT COUNT(*) INTO v_current
    FROM public.conversation_members
   WHERE conversation_id = p_conversation_id;

  IF v_current >= v_max_members THEN
    RETURN jsonb_build_object('ok', false, 'error', 'capacity_reached', 'max', v_max_members);
  END IF;

  -- Insertar miembro
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (p_conversation_id, v_uid)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.join_community(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.join_community(uuid) TO authenticated;

-- ── Vista de stats de comunidad ───────────────────────────────────────────────
CREATE OR REPLACE VIEW public.community_stats AS
SELECT
  c.id AS conversation_id,
  COUNT(DISTINCT cm.user_id)                                             AS total_members,
  COUNT(DISTINCT CASE WHEN cm.joined_at >= now() - interval '7 days'
                      THEN cm.user_id END)                              AS new_members_7d,
  COUNT(DISTINCT CASE WHEN cm.joined_at >= now() - interval '30 days'
                      THEN cm.user_id END)                              AS new_members_30d,
  COUNT(DISTINCT m.id)                                                   AS total_messages,
  COUNT(DISTINCT CASE WHEN m.created_at >= now() - interval '7 days'
                      THEN m.id END)                                    AS messages_7d,
  COUNT(DISTINCT CASE WHEN m.created_at >= now() - interval '30 days'
                      THEN m.id END)                                    AS messages_30d,
  COUNT(DISTINCT t.id) FILTER (WHERE t.group_type = 'tournament')      AS total_tournaments,
  COUNT(DISTINCT e.id)                                                   AS total_events
FROM public.conversations c
LEFT JOIN public.conversation_members cm ON cm.conversation_id = c.id
LEFT JOIN public.messages m ON m.conversation_id = c.id AND m.type != 'system'
LEFT JOIN public.conversations t ON t.created_by = c.created_by AND t.group_type = 'tournament'
LEFT JOIN public.events e ON e.conversation_id = c.id AND e.is_active = true
WHERE c.is_group = true AND c.group_type = 'community'
GROUP BY c.id;
