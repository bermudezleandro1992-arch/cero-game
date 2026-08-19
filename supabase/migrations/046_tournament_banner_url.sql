-- 046: Add banner_url column to conversations (for tournament/liga banners)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS banner_url text;
