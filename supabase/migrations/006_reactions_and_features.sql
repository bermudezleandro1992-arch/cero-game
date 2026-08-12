-- Pinned message on conversations
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS pinned_message text;

-- Enable Realtime for message_reactions
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;

-- Allow users to delete own messages
CREATE POLICY IF NOT EXISTS "Usuarios pueden eliminar sus mensajes"
  ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id);

-- Allow reactions insert/delete
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Ver reacciones de mis conversaciones"
  ON public.message_reactions FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Agregar reacciones"
  ON public.message_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Eliminar propias reacciones"
  ON public.message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Allow leaving groups
CREATE POLICY IF NOT EXISTS "Salir de conversaciones"
  ON public.conversation_members FOR DELETE
  USING (auth.uid() = user_id);

-- Allow pinning (update conversations)
CREATE POLICY IF NOT EXISTS "Actualizar conversación propia"
  ON public.conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_id = conversations.id AND user_id = auth.uid()
    )
  );
