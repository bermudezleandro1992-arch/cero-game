-- ═══════════════════════════════════════════════════════════
-- 024: Bot API — tokens, logs y función de envío
-- ═══════════════════════════════════════════════════════════

-- ── Extender bot_tokens con más campos ───────────────────────
CREATE TABLE IF NOT EXISTS public.bot_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  token           text UNIQUE NOT NULL,
  active          boolean DEFAULT true,
  webhook_url     text DEFAULT NULL,
  last_used_at    timestamptz DEFAULT NULL,
  created_at      timestamptz DEFAULT now()
);

-- Agregar columnas si ya existe la tabla
ALTER TABLE public.bot_tokens
  ADD COLUMN IF NOT EXISTS webhook_url  text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz DEFAULT NULL;

ALTER TABLE public.bot_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner" ON public.bot_tokens;
CREATE POLICY "owner_all" ON public.bot_tokens
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ── Logs de actividad del bot ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bot_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id          uuid NOT NULL REFERENCES public.bot_tokens(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  action          text NOT NULL,
  payload         jsonb DEFAULT '{}',
  status          text DEFAULT 'ok' CHECK (status IN ('ok','error')),
  error           text DEFAULT NULL,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_see_logs" ON public.bot_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bot_tokens bt
      WHERE bt.id = bot_logs.bot_id AND bt.owner_id = auth.uid()
    )
  );

-- ── Función RPC: envío de mensaje vía bot ────────────────────
-- Usada desde la app directamente si se quiere. La Edge Function
-- bot-api usa service role y no necesita esta función, pero la
-- mantenemos para compatibilidad.
CREATE OR REPLACE FUNCTION public.bot_send_message(
  bot_token  text,
  message    text,
  type       text DEFAULT 'text'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tok public.bot_tokens;
BEGIN
  SELECT * INTO tok
    FROM public.bot_tokens
    WHERE token = bot_token AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token inválido o inactivo';
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, content, type, metadata)
  VALUES (
    tok.conversation_id,
    tok.owner_id,
    message,
    type,
    jsonb_build_object('bot', true, 'bot_id', tok.id, 'bot_name', tok.name)
  );

  UPDATE public.bot_tokens
    SET last_used_at = now()
    WHERE id = tok.id;

  INSERT INTO public.bot_logs (bot_id, conversation_id, action, payload, status)
  VALUES (tok.id, tok.conversation_id, 'send_message', jsonb_build_object('message', message, 'type', type), 'ok');

  RETURN json_build_object('ok', true);
END;
$$;
