-- Fix: normalize conversation_id and sender_id before insert into messages
-- This handles the case where UUIDs arrive with embedded double-quote characters
-- e.g. "08a1cb79-6f86-47db-9126-ac06daac047c" → 08a1cb79-6f86-47db-9126-ac06daac047c

CREATE OR REPLACE FUNCTION normalize_message_uuids()
RETURNS TRIGGER AS $$
DECLARE
  v_conv text;
  v_sender text;
  v_uuid_pattern text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
BEGIN
  -- Strip any non-UUID characters from conversation_id
  v_conv := (regexp_matches(NEW.conversation_id::text, v_uuid_pattern, 'i'))[1];
  IF v_conv IS NOT NULL THEN
    NEW.conversation_id := v_conv::uuid;
  END IF;

  -- Strip any non-UUID characters from sender_id
  v_sender := (regexp_matches(NEW.sender_id::text, v_uuid_pattern, 'i'))[1];
  IF v_sender IS NOT NULL THEN
    NEW.sender_id := v_sender::uuid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_message_uuids ON messages;
CREATE TRIGGER trg_normalize_message_uuids
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION normalize_message_uuids();

-- Also create a safe send_message RPC as backup
CREATE OR REPLACE FUNCTION send_message_safe(
  p_conversation_id text,
  p_sender_id text,
  p_content text,
  p_type text DEFAULT 'text',
  p_max_views int DEFAULT NULL,
  p_topic_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uuid_pattern text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  v_conv_id uuid;
  v_sender_id uuid;
  v_topic_id uuid;
  v_row messages;
BEGIN
  v_conv_id   := (regexp_matches(p_conversation_id, v_uuid_pattern, 'i'))[1]::uuid;
  v_sender_id := (regexp_matches(p_sender_id,       v_uuid_pattern, 'i'))[1]::uuid;
  IF p_topic_id IS NOT NULL THEN
    v_topic_id := (regexp_matches(p_topic_id, v_uuid_pattern, 'i'))[1]::uuid;
  END IF;

  INSERT INTO messages (conversation_id, sender_id, content, type, max_views, topic_id)
  VALUES (v_conv_id, v_sender_id, p_content, p_type, p_max_views, v_topic_id)
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row);
END;
$$;
