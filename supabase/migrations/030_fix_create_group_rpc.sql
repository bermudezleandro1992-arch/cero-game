-- Fix create_group_with_owner: remove granted_by column that doesn't exist in group_roles
CREATE OR REPLACE FUNCTION public.create_group_with_owner(
  p_name        text,
  p_is_group    boolean DEFAULT true,
  p_group_type  text    DEFAULT 'group',
  p_description text    DEFAULT NULL,
  p_created_by  uuid    DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := COALESCE(p_created_by, auth.uid());
  v_conv_id uuid;
BEGIN
  INSERT INTO public.conversations (name, is_group, group_type, description, created_by)
  VALUES (p_name, p_is_group, p_group_type, p_description, v_user_id)
  RETURNING id INTO v_conv_id;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (v_conv_id, v_user_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.group_roles (conversation_id, user_id, role)
  VALUES (v_conv_id, v_user_id, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN v_conv_id;
END;
$$;
