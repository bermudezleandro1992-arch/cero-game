-- 033: vincular anuncios a comunidades/grupos, corregir RLS y agregar campo status torneos

-- Link opcional al grupo/comunidad que publica el anuncio
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;

-- Link opcional a un torneo existente (para anuncios de tipo 'torneo')
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS tournament_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;

-- Índice para filtrar anuncios de una comunidad
CREATE INDEX IF NOT EXISTS idx_announcements_conversation
  ON public.announcements(conversation_id, is_active, created_at DESC);

-- ── Corregir RLS de publicación ────────────────────────────────────────────────
-- Quitar la política permisiva anterior
DROP POLICY IF EXISTS "authenticated_can_post_announcements" ON public.announcements;

-- Nueva política: puede publicar quien tenga rol en group_roles o sea admin/ceo global
CREATE POLICY "org_can_post_announcements"
  ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      -- Admin o CEO global pueden publicar sin grupo
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'moderador')
      )
      OR
      -- Owner o admin de al menos un grupo/comunidad
      EXISTS (
        SELECT 1 FROM public.group_roles gr
        WHERE gr.user_id = auth.uid()
          AND gr.role IN ('owner', 'admin')
          AND (conversation_id IS NULL OR gr.conversation_id = announcements.conversation_id)
      )
    )
  );

-- Política de lectura: anuncios de comunidades privadas solo para miembros
DROP POLICY IF EXISTS "anyone_can_read_announcements" ON public.announcements;

CREATE POLICY "read_public_announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (
      -- Sin comunidad asociada = anuncio global público
      conversation_id IS NULL
      OR
      -- Comunidad pública
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = announcements.conversation_id AND c.is_public = true
      )
      OR
      -- Miembro de la comunidad privada
      EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = announcements.conversation_id
          AND cm.user_id = auth.uid()
      )
    )
  );
