-- RPC to delete tournaments owned by the calling user
-- All child tables (messages, topics, members, etc.) use ON DELETE CASCADE
CREATE OR REPLACE FUNCTION public.delete_tournaments(tournament_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.conversations
  WHERE id = ANY(tournament_ids)
    AND created_by = auth.uid()
    AND group_type = 'tournament';
END;
$$;

REVOKE ALL ON FUNCTION public.delete_tournaments FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_tournaments TO authenticated;
