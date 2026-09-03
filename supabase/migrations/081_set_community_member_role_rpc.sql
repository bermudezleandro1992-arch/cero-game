-- RPC para que el CEO/admin pueda cambiar roles en su comunidad
-- SECURITY DEFINER bypasses RLS safely — caller is verified inside
CREATE OR REPLACE FUNCTION public.set_community_member_role(
  p_conversation_id uuid,
  p_user_id        uuid,
  p_role           text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
BEGIN
  -- Verificar que quien llama es owner o admin de la comunidad
  SELECT role INTO v_caller_role
  FROM conversation_members
  WHERE conversation_id = p_conversation_id
    AND user_id = v_caller_id;

  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'No tenés permiso para cambiar roles en esta comunidad';
  END IF;

  -- No se puede cambiar el rol del owner
  IF EXISTS (
    SELECT 1 FROM conversations
    WHERE id = p_conversation_id AND created_by = p_user_id
  ) THEN
    RAISE EXCEPTION 'No podés cambiar el rol del creador de la comunidad';
  END IF;

  -- Actualizar el rol
  UPDATE conversation_members
  SET role = p_role
  WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_community_member_role(uuid, uuid, text) TO authenticated;
