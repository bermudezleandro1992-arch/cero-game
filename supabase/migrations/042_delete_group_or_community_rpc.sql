-- RPC to delete a group or community owned by the calling user
-- Child tables use ON DELETE CASCADE so everything gets cleaned up
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

  DELETE FROM public.conversations WHERE id = p_conversation_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_group_or_community FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_group_or_community TO authenticated;
