-- Add tournament_id to announcements so organizers can link a tournament to an announcement
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_announcements_tournament_id ON public.announcements(tournament_id);
