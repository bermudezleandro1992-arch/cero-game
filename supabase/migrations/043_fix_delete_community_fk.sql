-- Fix FK so deleting a community automatically nulls community_id on child conversations
-- Also update the RPC to handle this gracefully

-- 1. Drop old FK and re-add with ON DELETE SET NULL
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_community_id_fkey;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_community_id_fkey
  FOREIGN KEY (community_id) REFERENCES public.conversations(id)
  ON DELETE SET NULL;

-- 2. Update RPC to also handle community_id nulling (belt + suspenders)
CREATE OR REPLACE FUNCTION public.delete_group_or_community(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = p_conversation_id
      AND created_by = auth.uid()
      AND group_type IN ('group', 'community')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado o no existe');
  END IF;

  -- Detach child conversations that belong to this community
  UPDATE public.conversations
    SET community_id = NULL
    WHERE community_id = p_conversation_id;

  DELETE FROM public.conversations WHERE id = p_conversation_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_group_or_community FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_group_or_community TO authenticated;
