-- RPC to delete tournaments owned by the calling user
-- Cascades: messages, topics, conversation_members, then conversation
CREATE OR REPLACE FUNCTION public.delete_tournaments(tournament_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only delete conversations where the caller is the creator
  DELETE FROM public.messages
  WHERE conversation_id = ANY(tournament_ids)
    AND conversation_id IN (
      SELECT id FROM public.conversations
      WHERE created_by = auth.uid() AND group_type = 'tournament'
    );

  DELETE FROM public.topics
  WHERE conversation_id = ANY(tournament_ids)
    AND conversation_id IN (
      SELECT id FROM public.conversations
      WHERE created_by = auth.uid() AND group_type = 'tournament'
    );

  DELETE FROM public.conversation_members
  WHERE conversation_id = ANY(tournament_ids)
    AND conversation_id IN (
      SELECT id FROM public.conversations
      WHERE created_by = auth.uid() AND group_type = 'tournament'
    );

  DELETE FROM public.conversations
  WHERE id = ANY(tournament_ids)
    AND created_by = auth.uid()
    AND group_type = 'tournament';
END;
$$;

REVOKE ALL ON FUNCTION public.delete_tournaments FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_tournaments TO authenticated;
