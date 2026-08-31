-- 078: SECURITY DEFINER RPC to fetch conversation members (bypasses RLS)

CREATE OR REPLACE FUNCTION public.get_conversation_members(p_conversation_ids uuid[])
RETURNS TABLE(conversation_id uuid, user_id uuid)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT conversation_id, user_id
  FROM public.conversation_members
  WHERE conversation_id = ANY(p_conversation_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_members(uuid[]) TO authenticated;
