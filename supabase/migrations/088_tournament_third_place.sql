-- Add third place match toggle to tournaments
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS has_third_place boolean NOT NULL DEFAULT false;
