-- 045: Allow public read on all avatars bucket paths (group-avatars, match-results, etc.)
-- Supabase storage RLS — these policies let anyone read public files.

-- Public read for all paths in the avatars bucket
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES
  ('Public read avatars', 'avatars', 'SELECT', 'true')
ON CONFLICT (bucket_id, name, operation) DO NOTHING;

-- Also ensure the bucket is public
UPDATE storage.buckets SET public = true WHERE id = 'avatars';
