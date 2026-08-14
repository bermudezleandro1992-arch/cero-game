-- Permite que grupos/comunidades sean públicos (descubribles)
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS member_count integer DEFAULT 0;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Índice para buscar comunidades públicas
CREATE INDEX IF NOT EXISTS idx_conversations_public
  ON public.conversations(is_public, group_type, is_group)
  WHERE is_group = true AND is_public = true;

-- Política para que todos puedan VER grupos públicos (sin estar adentro)
CREATE POLICY IF NOT EXISTS "anyone_can_view_public_groups"
  ON public.conversations FOR SELECT
  USING (is_public = true AND is_group = true);

-- Función para mantener member_count actualizado
CREATE OR REPLACE FUNCTION update_conversation_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.conversations
      SET member_count = (SELECT COUNT(*) FROM public.conversation_members WHERE conversation_id = NEW.conversation_id)
      WHERE id = NEW.conversation_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.conversations
      SET member_count = (SELECT COUNT(*) FROM public.conversation_members WHERE conversation_id = OLD.conversation_id)
      WHERE id = OLD.conversation_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_member_count ON public.conversation_members;
CREATE TRIGGER trg_member_count
  AFTER INSERT OR DELETE ON public.conversation_members
  FOR EACH ROW EXECUTE FUNCTION update_conversation_member_count();
