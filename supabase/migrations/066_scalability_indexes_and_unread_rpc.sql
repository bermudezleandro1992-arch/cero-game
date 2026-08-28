-- ── Scalability: indexes + unread count RPC ───────────────────────────────────
-- Replaces N+1 unread count queries (one per conversation) with a single RPC.
-- Adds missing indexes that back RLS policies and common lookups.

-- ── 1. Indexes ─────────────────────────────────────────────────────────────────

-- RLS on messages does: EXISTS (SELECT 1 FROM conversation_members WHERE user_id = auth.uid() ...)
-- Without this index, every row in messages scans the entire conversation_members table.
CREATE INDEX IF NOT EXISTS idx_conv_members_user_conv
  ON public.conversation_members(user_id, conversation_id);

-- Used by delete-account RPC and sender filtering
CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON public.messages(sender_id);

-- Hot path: fetch last N messages for a conversation, ordered by time
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON public.messages(conversation_id, created_at DESC);

-- Used by unread count queries and message list filtering
CREATE INDEX IF NOT EXISTS idx_messages_conv_sender_created
  ON public.messages(conversation_id, sender_id, created_at);

-- Topic-based message fetching
CREATE INDEX IF NOT EXISTS idx_messages_topic
  ON public.messages(topic_id)
  WHERE topic_id IS NOT NULL;

-- Conversation lookup by membership (used everywhere)
CREATE INDEX IF NOT EXISTS idx_conv_members_conv
  ON public.conversation_members(conversation_id);

-- ── 2. Unread count RPC — replaces N queries with 1 ───────────────────────────
-- Returns unread message count per conversation for a given user.
-- Takes into account each conversation's individual last_read_at timestamp.
CREATE OR REPLACE FUNCTION get_unread_counts(p_user_id uuid)
RETURNS TABLE(conversation_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cm.conversation_id,
    COUNT(m.id) AS unread_count
  FROM public.conversation_members cm
  LEFT JOIN public.messages m
    ON m.conversation_id = cm.conversation_id
    AND m.sender_id != p_user_id
    AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
    AND (m.is_deleted IS NULL OR m.is_deleted = false)
  WHERE cm.user_id = p_user_id
  GROUP BY cm.conversation_id;
$$;

GRANT EXECUTE ON FUNCTION get_unread_counts(uuid) TO authenticated;

-- ── 3. Content length constraint ───────────────────────────────────────────────
-- Prevents multi-megabyte messages from being stored and broadcast.
-- 64KB is generous for text; images/files use URLs anyway.
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_content_length;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_length
  CHECK (octet_length(content) <= 65536);
