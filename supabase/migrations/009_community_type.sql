-- Add group_type and description to conversations
-- group_type: 'group' (default) | 'community'
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS group_type text DEFAULT 'group';
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS description text;
