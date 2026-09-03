-- Add team name columns to tournament_matches for guerra/coop mode
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS player1_name text,
  ADD COLUMN IF NOT EXISTS player2_name text;
