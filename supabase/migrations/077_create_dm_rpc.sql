-- 077: RPC to create a DM conversation (bypasses RLS for member insertion)

CREATE OR REPLACE FUNCTION public.find_or_create_dm(p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_conv_id  uuid;
  v_count    int;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  IF v_uid = p_other_user_id THEN RETURN NULL; END IF;

  -- Find existing 2-person DM between these two users
  SELECT cm1.conversation_id INTO v_conv_id
  FROM public.conversation_members cm1
  JOIN public.conversation_members cm2
    ON cm2.conversation_id = cm1.conversation_id
   AND cm2.user_id = p_other_user_id
  JOIN public.conversations c
    ON c.id = cm1.conversation_id
   AND (c.is_group = false OR c.is_group IS NULL)
  WHERE cm1.user_id = v_uid
  LIMIT 1;

  -- Verify it's only 2 members (not a group that happens to have both)
  IF v_conv_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.conversation_members
    WHERE conversation_id = v_conv_id;
    IF v_count != 2 THEN v_conv_id := NULL; END IF;
  END IF;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- Create new DM conversation
  INSERT INTO public.conversations (is_group, created_by, dm_status)
  VALUES (false, v_uid, 'pending')
  RETURNING id INTO v_conv_id;

  -- Insert both members (SECURITY DEFINER bypasses RLS)
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (v_conv_id, v_uid), (v_conv_id, p_other_user_id);

  RETURN v_conv_id;
EXCEPTION WHEN OTHERS THEN
  -- Fallback without dm_status if column doesn't exist yet
  INSERT INTO public.conversations (is_group, created_by)
  VALUES (false, v_uid)
  RETURNING id INTO v_conv_id;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (v_conv_id, v_uid), (v_conv_id, p_other_user_id);

  RETURN v_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_dm(uuid) TO authenticated;
