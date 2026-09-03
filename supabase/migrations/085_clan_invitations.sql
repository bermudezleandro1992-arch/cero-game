-- 085: Clan invitation system

CREATE TABLE IF NOT EXISTS public.clan_invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id     uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  inviter_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted' | 'rejected'
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (clan_id, invitee_id)
);

ALTER TABLE public.clan_invitations ENABLE ROW LEVEL SECURITY;

-- Inviter can create invitations for their clan
CREATE POLICY "ci_insert" ON public.clan_invitations FOR INSERT WITH CHECK (
  inviter_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.clans WHERE id = clan_invitations.clan_id AND leader_id = auth.uid()
  )
);

-- Invitee and inviter can read
CREATE POLICY "ci_read" ON public.clan_invitations FOR SELECT USING (
  invitee_id = auth.uid() OR inviter_id = auth.uid()
);

-- Invitee can update status (accept/reject)
CREATE POLICY "ci_update" ON public.clan_invitations FOR UPDATE USING (invitee_id = auth.uid());

-- Inviter (leader) can delete (cancel invite)
CREATE POLICY "ci_delete" ON public.clan_invitations FOR DELETE USING (inviter_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ci_invitee ON public.clan_invitations(invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_ci_clan ON public.clan_invitations(clan_id);
