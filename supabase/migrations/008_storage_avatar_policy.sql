-- Allow authenticated users to upload files to their own folder in attachments bucket
-- Run this in Supabase SQL Editor

-- Policy: users can upload to their own folder (user_id/*)
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Users can upload to own folder',
  'attachments',
  'INSERT',
  'auth.uid()::text = (storage.foldername(name))[1]'
)
ON CONFLICT DO NOTHING;

-- Policy: users can update files in their own folder
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Users can update own folder files',
  'attachments',
  'UPDATE',
  'auth.uid()::text = (storage.foldername(name))[1]'
)
ON CONFLICT DO NOTHING;

-- Policy: public can read all files (already set if bucket is public)
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Public read access',
  'attachments',
  'SELECT',
  'true'
)
ON CONFLICT DO NOTHING;
