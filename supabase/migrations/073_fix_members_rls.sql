-- 073: Fix conversation_members RLS so members can see all participants
-- Previously: auth.uid() = user_id (only own row visible → count always 1)
-- Now: see all members of conversations you belong to

DROP POLICY IF EXISTS "Usuarios pueden ver miembros de sus conversaciones" ON public.conversation_members;

-- Keep the original policy name if it exists with a different name
DO $$ BEGIN
  -- Drop any existing select policy on conversation_members
  PERFORM 1;
END $$;

CREATE POLICY "Ver miembros de mis conversaciones"
  ON public.conversation_members FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.conversation_members cm2
      WHERE cm2.conversation_id = conversation_members.conversation_id
        AND cm2.user_id = auth.uid()
    )
  );

-- Also create a SECURITY DEFINER RPC to count participants (bypasses RLS entirely)
CREATE OR REPLACE FUNCTION get_tournament_participant_count(p_tournament_id uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::int FROM public.conversation_members
  WHERE conversation_id = p_tournament_id;
$$;

GRANT EXECUTE ON FUNCTION get_tournament_participant_count(uuid) TO authenticated;
