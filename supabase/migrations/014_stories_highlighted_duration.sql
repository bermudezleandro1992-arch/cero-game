-- Add is_highlighted to stories (for featured/pinned stories)
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS is_highlighted boolean NOT NULL DEFAULT false;

-- Allow update own stories (for toggling highlighted)
CREATE POLICY IF NOT EXISTS "stories_update"
  ON public.stories
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS stories_highlighted_idx ON public.stories(user_id, is_highlighted) WHERE is_highlighted = true;
