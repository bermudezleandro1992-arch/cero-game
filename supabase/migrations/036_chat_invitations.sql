-- 036: sistema de invitaciones para chatear
-- Flujo: buscar usuario → invitar a chatear → la otra persona acepta/rechaza
--        → recién entonces se habilita el chat y ambos pasan a ser contactos

-- ── Configuración de privacidad de invitaciones en users ────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS who_can_invite text NOT NULL DEFAULT 'everyone';
-- valores: 'everyone' | 'contacts_of_contacts' | 'community_members' | 'nobody'

-- ── Tabla de invitaciones de chat ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending',
  -- status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  message      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_invitations_to   ON public.chat_invitations(to_user_id,   status);
CREATE INDEX IF NOT EXISTS idx_invitations_from ON public.chat_invitations(from_user_id, status);

ALTER TABLE public.chat_invitations ENABLE ROW LEVEL SECURITY;

-- Leer las propias invitaciones (enviadas o recibidas)
CREATE POLICY "read_own_invitations"
  ON public.chat_invitations FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- Enviar invitación
CREATE POLICY "send_invitation"
  ON public.chat_invitations FOR INSERT TO authenticated
  WITH CHECK (from_user_id = auth.uid());

-- Actualizar estado (aceptar/rechazar/cancelar)
CREATE POLICY "update_invitation"
  ON public.chat_invitations FOR UPDATE TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- Eliminar (cancelar propia invitación)
CREATE POLICY "delete_invitation"
  ON public.chat_invitations FOR DELETE TO authenticated
  USING (from_user_id = auth.uid());

-- ── RPC: accept_chat_invitation ──────────────────────────────────────────────
-- Acepta la invitación, crea la conversación y agrega ambos como contactos
CREATE OR REPLACE FUNCTION public.accept_chat_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_from     uuid;
  v_conv_id  uuid;
  v_existing uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Obtener la invitación
  SELECT from_user_id INTO v_from
    FROM public.chat_invitations
   WHERE id = p_invitation_id AND to_user_id = v_uid AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Marcar como aceptada
  UPDATE public.chat_invitations
     SET status = 'accepted', responded_at = now()
   WHERE id = p_invitation_id;

  -- Buscar conversación 1-1 existente entre ambos
  SELECT cm1.conversation_id INTO v_existing
    FROM public.conversation_members cm1
    JOIN public.conversation_members cm2 ON cm2.conversation_id = cm1.conversation_id
    JOIN public.conversations c ON c.id = cm1.conversation_id
   WHERE cm1.user_id = v_from AND cm2.user_id = v_uid AND c.is_group = false
   LIMIT 1;

  IF v_existing IS NULL THEN
    -- Crear conversación nueva
    INSERT INTO public.conversations (is_group, created_by)
    VALUES (false, v_from)
    RETURNING id INTO v_conv_id;

    INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES (v_conv_id, v_from), (v_conv_id, v_uid);
  ELSE
    v_conv_id := v_existing;
  END IF;

  -- Agregar como contactos mutuos
  INSERT INTO public.contacts (owner_id, contact_id)
  VALUES (v_from, v_uid), (v_uid, v_from)
  ON CONFLICT (owner_id, contact_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'conversation_id', v_conv_id);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_chat_invitation(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_chat_invitation(uuid) TO authenticated;
