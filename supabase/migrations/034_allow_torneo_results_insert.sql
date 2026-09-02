-- 034: permitir a miembros publicar resultados de torneos en su comunidad
-- La política existente requiere owner/admin, pero los jugadores necesitan
-- poder insertar anuncios automáticos de tipo 'torneo' en la comunidad.

CREATE POLICY "members_can_post_torneo_results"
  ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND category = 'torneo'
    AND conversation_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = announcements.conversation_id
        AND cm.user_id = auth.uid()
    )
  );
