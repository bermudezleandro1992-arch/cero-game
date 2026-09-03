-- 086: Website URL and game tag for communities
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS game text;
