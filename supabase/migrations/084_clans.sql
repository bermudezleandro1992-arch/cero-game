-- 084: Clan system for coop/guerra tournaments

-- Clans table
CREATE TABLE IF NOT EXISTS public.clans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  tag           text NOT NULL,          -- short tag like [ABC]
  description   text,
  logo_url      text,
  banner_url    text,
  leader_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_public     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- Unique clan tag (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clans_tag ON public.clans (lower(tag));

-- Clan members
CREATE TABLE IF NOT EXISTS public.clan_members (
  clan_id    uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member',  -- 'leader' | 'officer' | 'member'
  joined_at  timestamptz DEFAULT now(),
  PRIMARY KEY (clan_id, user_id)
);

-- Tournament clan participants (a clan enters a tournament)
CREATE TABLE IF NOT EXISTS public.tournament_clan_participants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  clan_id        uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  joined_at      timestamptz DEFAULT now(),
  UNIQUE (tournament_id, clan_id)
);

-- Add team_size column to conversations (for guerra tournaments: 2,3,4,5)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS team_size integer DEFAULT 1;

-- RLS
ALTER TABLE public.clans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_clan_participants ENABLE ROW LEVEL SECURITY;

-- Everyone can read public clans
CREATE POLICY "clans_read" ON public.clans FOR SELECT USING (is_public OR leader_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.clan_members WHERE clan_id = clans.id AND user_id = auth.uid()
));

-- Only leader can update/delete their clan
CREATE POLICY "clans_insert" ON public.clans FOR INSERT WITH CHECK (leader_id = auth.uid());
CREATE POLICY "clans_update" ON public.clans FOR UPDATE USING (leader_id = auth.uid());
CREATE POLICY "clans_delete" ON public.clans FOR DELETE USING (leader_id = auth.uid());

-- Clan members readable if in the clan or public clan
CREATE POLICY "clan_members_read" ON public.clan_members FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.clans WHERE id = clan_members.clan_id AND (is_public OR leader_id = auth.uid())
  )
);

-- Leaders and officers can add members; members can remove themselves
CREATE POLICY "clan_members_insert" ON public.clan_members FOR INSERT WITH CHECK (
  user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.clans WHERE id = clan_members.clan_id AND leader_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.clan_members cm WHERE cm.clan_id = clan_members.clan_id AND cm.user_id = auth.uid() AND cm.role IN ('leader','officer')
  )
);

CREATE POLICY "clan_members_delete" ON public.clan_members FOR DELETE USING (
  user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.clans WHERE id = clan_members.clan_id AND leader_id = auth.uid()
  )
);

-- Tournament clan participants
CREATE POLICY "tcp_read" ON public.tournament_clan_participants FOR SELECT USING (true);
CREATE POLICY "tcp_insert" ON public.tournament_clan_participants FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clans WHERE id = tournament_clan_participants.clan_id AND leader_id = auth.uid())
);
CREATE POLICY "tcp_delete" ON public.tournament_clan_participants FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.clans WHERE id = tournament_clan_participants.clan_id AND leader_id = auth.uid())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clan_members_user ON public.clan_members(user_id);
CREATE INDEX IF NOT EXISTS idx_clan_members_clan ON public.clan_members(clan_id);
CREATE INDEX IF NOT EXISTS idx_tcp_tournament ON public.tournament_clan_participants(tournament_id);
