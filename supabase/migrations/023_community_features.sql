-- ═══════════════════════════════════════════════════════════
-- 023: Community & Group advanced features
-- ═══════════════════════════════════════════════════════════

-- ── Extend conversations with privacy & community settings ──
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS who_can_send      text DEFAULT 'everyone'   CHECK (who_can_send      IN ('everyone','members','moderators','admins','owner')),
  ADD COLUMN IF NOT EXISTS who_can_add       text DEFAULT 'everyone'   CHECK (who_can_add       IN ('everyone','admins','owner')),
  ADD COLUMN IF NOT EXISTS who_can_edit_info text DEFAULT 'admins'     CHECK (who_can_edit_info IN ('everyone','admins','owner')),
  ADD COLUMN IF NOT EXISTS require_approval  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_export      boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_auto_save   boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS slow_mode_seconds integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS auto_delete_hours integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invite_link       text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_public         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_locked         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_url        text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pinned_message    text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS announcement_only boolean DEFAULT false;

-- ── Extend group_roles to include moderador and organizador ──
ALTER TABLE public.group_roles
  DROP CONSTRAINT IF EXISTS group_roles_role_check;

ALTER TABLE public.group_roles
  ADD CONSTRAINT group_roles_role_check
  CHECK (role IN ('owner','admin','moderador','organizador','member'));

-- ── Member join requests ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.join_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status          text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_at    timestamptz DEFAULT now(),
  reviewed_by     uuid REFERENCES public.users(id),
  reviewed_at     timestamptz,
  UNIQUE (conversation_id, user_id)
);

ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_see_requests"
  ON public.join_requests FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_roles gr
      WHERE gr.conversation_id = join_requests.conversation_id
        AND gr.user_id = auth.uid()
        AND gr.role IN ('owner','admin','moderador')
    )
  );

CREATE POLICY "anyone_can_request"
  ON public.join_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins_review_requests"
  ON public.join_requests FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_roles gr
    WHERE gr.conversation_id = join_requests.conversation_id
      AND gr.user_id = auth.uid()
      AND gr.role IN ('owner','admin','moderador')
  ));

-- ── RPC: approve join request ─────────────────────────────────
CREATE OR REPLACE FUNCTION approve_join_request(p_request_id uuid)
RETURNS void AS $$
DECLARE
  v_req public.join_requests;
BEGIN
  SELECT * INTO v_req FROM public.join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  -- Add to conversation_members
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (v_req.conversation_id, v_req.user_id)
  ON CONFLICT DO NOTHING;

  -- Mark as approved
  UPDATE public.join_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC: update group settings (bypasses RLS, only for admins) ─
CREATE OR REPLACE FUNCTION update_group_settings(
  p_conversation_id uuid,
  p_settings jsonb
) RETURNS void AS $$
BEGIN
  -- Only owner/admin of this conversation can update settings
  IF NOT EXISTS (
    SELECT 1 FROM public.group_roles
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
      AND role IN ('owner','admin')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = p_conversation_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.conversations
  SET
    name              = COALESCE((p_settings->>'name')::text,              name),
    description       = COALESCE((p_settings->>'description')::text,       description),
    who_can_send      = COALESCE((p_settings->>'who_can_send')::text,      who_can_send),
    who_can_add       = COALESCE((p_settings->>'who_can_add')::text,       who_can_add),
    who_can_edit_info = COALESCE((p_settings->>'who_can_edit_info')::text, who_can_edit_info),
    require_approval  = COALESCE((p_settings->>'require_approval')::boolean, require_approval),
    allow_export      = COALESCE((p_settings->>'allow_export')::boolean,   allow_export),
    allow_auto_save   = COALESCE((p_settings->>'allow_auto_save')::boolean, allow_auto_save),
    slow_mode_seconds = COALESCE((p_settings->>'slow_mode_seconds')::integer, slow_mode_seconds),
    auto_delete_hours = COALESCE((p_settings->>'auto_delete_hours')::integer, auto_delete_hours),
    is_public         = COALESCE((p_settings->>'is_public')::boolean,      is_public),
    is_locked         = COALESCE((p_settings->>'is_locked')::boolean,      is_locked),
    announcement_only = COALESCE((p_settings->>'announcement_only')::boolean, announcement_only),
    pinned_message    = COALESCE((p_settings->>'pinned_message')::text,    pinned_message)
  WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
