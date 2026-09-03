-- 083: Fix set_community_member_role to allow community creator even if role column = 'member'
-- Also ensure creators have role='owner' in conversation_members

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
  v_caller_id   uuid := auth.uid();
  v_caller_role text;
  v_is_creator  boolean;
BEGIN
  -- Check if caller is the community creator
  SELECT (created_by = v_caller_id) INTO v_is_creator
  FROM conversations
  WHERE id = p_conversation_id;

  -- Check caller's role in conversation_members
  SELECT role INTO v_caller_role
  FROM conversation_members
  WHERE conversation_id = p_conversation_id
    AND user_id = v_caller_id;

  -- Allow if creator OR has owner/admin role
  IF NOT (v_is_creator OR v_caller_role IN ('owner', 'admin')) THEN
    RAISE EXCEPTION 'No tenés permiso para cambiar roles en esta comunidad';
  END IF;

  -- Cannot change the creator's role
  IF EXISTS (
    SELECT 1 FROM conversations
    WHERE id = p_conversation_id AND created_by = p_user_id
  ) THEN
    RAISE EXCEPTION 'No podés cambiar el rol del creador de la comunidad';
  END IF;

  -- Update role
  UPDATE conversation_members
  SET role = p_role
  WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_community_member_role(uuid, uuid, text) TO authenticated;

-- Also ensure all community creators have role='owner'
UPDATE public.conversation_members cm
SET role = 'owner'
FROM public.conversations c
WHERE c.id = cm.conversation_id
  AND c.created_by = cm.user_id
  AND c.group_type = 'community'
  AND (cm.role IS NULL OR cm.role = 'member');
