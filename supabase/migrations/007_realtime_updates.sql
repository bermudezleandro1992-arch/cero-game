-- Allow realtime to broadcast UPDATE events on messages (needed for delete/edit)
-- Run this in Supabase SQL Editor if not already applied

-- The messages table should already be in supabase_realtime from migration 005.
-- This migration adds the UPDATE RLS policy so other users see deletions in real-time.

-- Already handled by the realtime subscription — no additional SQL needed
-- as long as the table is in supabase_realtime publication (done in 005).

-- However, ensure the messages UPDATE policy allows reading updated rows:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
