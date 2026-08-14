-- Add is_highlighted to stories (for featured/pinned stories)
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS is_highlighted boolean NOT NULL DEFAULT false;

-- Allow users to update their own stories (e.g. toggle highlighted)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stories'
      AND policyname = 'stories_update'
  ) THEN
    CREATE POLICY "stories_update"
      ON public.stories
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS stories_highlighted_idx
  ON public.stories(user_id, is_highlighted)
  WHERE is_highlighted = true;
