-- RPC para que un usuario elimine sus propias membresías de conversación
CREATE OR REPLACE FUNCTION public.leave_conversations(conv_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.conversation_members
  WHERE user_id = auth.uid()
    AND conversation_id = ANY(conv_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.leave_conversations FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_conversations TO authenticated;
