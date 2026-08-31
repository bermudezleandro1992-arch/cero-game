-- 076: DM Chat Requests
-- New DMs between users start as 'pending' until recipient accepts.
-- Groups/communities always start as 'accepted'.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS dm_status text NOT NULL DEFAULT 'accepted'
    CHECK (dm_status IN ('pending', 'accepted', 'blocked'));

-- Index for fast lookup of pending DMs by recipient
CREATE INDEX IF NOT EXISTS idx_conversations_dm_status
  ON public.conversations (dm_status) WHERE dm_status = 'pending';

-- RPC: accept a DM request
CREATE OR REPLACE FUNCTION public.accept_dm_request(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Only the recipient (non-creator) can accept
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_member');
  END IF;

  UPDATE public.conversations
  SET dm_status = 'accepted'
  WHERE id = p_conversation_id AND is_group = false AND dm_status = 'pending';

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- RPC: decline/block a DM request
CREATE OR REPLACE FUNCTION public.decline_dm_request(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_member');
  END IF;

  UPDATE public.conversations
  SET dm_status = 'blocked'
  WHERE id = p_conversation_id AND is_group = false;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_dm_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_dm_request(uuid) TO authenticated;
