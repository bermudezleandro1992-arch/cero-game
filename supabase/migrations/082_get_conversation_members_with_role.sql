-- 082: Update get_conversation_members to also return role and joined_at
-- Fixes: CEOPanel can't read roles of other members due to RLS

CREATE OR REPLACE FUNCTION public.get_conversation_members(p_conversation_ids uuid[])
RETURNS TABLE(conversation_id uuid, user_id uuid, role text, joined_at timestamptz)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT conversation_id, user_id, COALESCE(role, 'member') AS role, joined_at
  FROM public.conversation_members
  WHERE conversation_id = ANY(p_conversation_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_members(uuid[]) TO authenticated;
