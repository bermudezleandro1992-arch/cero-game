-- 034: tabla de eventos vinculados a comunidades/grupos

CREATE TABLE IF NOT EXISTS public.events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  event_type    text NOT NULL DEFAULT 'general',
  -- event_type: 'general' | 'competitive' | 'special' | 'meeting'
  start_at      timestamptz NOT NULL,
  end_at        timestamptz,
  location      text,           -- texto libre: "Discord #sala-evento" o "Online"
  max_participants int,
  is_public     boolean NOT NULL DEFAULT true,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Tabla de participantes de eventos
CREATE TABLE IF NOT EXISTS public.event_participants (
  event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_events_conversation ON public.events(conversation_id, is_active, start_at);
CREATE INDEX IF NOT EXISTS idx_events_public ON public.events(is_public, is_active, start_at) WHERE is_public = true;

-- RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- Lectura: eventos públicos o de comunidades donde el usuario es miembro
CREATE POLICY "read_events"
  ON public.events FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (
      is_public = true
      OR conversation_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = events.conversation_id AND cm.user_id = auth.uid()
      )
    )
  );

-- Inserción: owner/admin de la comunidad o admin/ceo global
CREATE POLICY "org_can_create_events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'ceo')
      )
      OR EXISTS (
        SELECT 1 FROM public.group_roles gr
        WHERE gr.user_id = auth.uid()
          AND gr.role IN ('owner', 'admin')
          AND (conversation_id IS NULL OR gr.conversation_id = events.conversation_id)
      )
    )
  );

-- Update/delete: creador o admin de la comunidad
CREATE POLICY "org_can_update_events"
  ON public.events FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'ceo')
    )
  );

CREATE POLICY "org_can_delete_events"
  ON public.events FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'ceo')
    )
  );

-- Participantes: leer
CREATE POLICY "read_event_participants"
  ON public.event_participants FOR SELECT TO authenticated
  USING (true);

-- Participantes: inscribirse
CREATE POLICY "join_event"
  ON public.event_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Participantes: salir
CREATE POLICY "leave_event"
  ON public.event_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid());
