-- ═══════════════════════════════════════════════════════════
-- 025: Bot Templates — plantillas de mensajes configurables
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.bot_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id          uuid NOT NULL REFERENCES public.bot_tokens(id) ON DELETE CASCADE,
  name            text NOT NULL,
  channel         text NOT NULL DEFAULT 'general'
                    CHECK (channel IN ('general','avisos','anuncios')),
  category        text NOT NULL DEFAULT 'torneos'
                    CHECK (category IN ('torneos','ligas','clanes','noticias','resultados','otro')),
  message_template text NOT NULL,
  include_link    boolean DEFAULT false,
  include_prizes  boolean DEFAULT false,
  active          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.bot_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_templates" ON public.bot_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bot_tokens bt
      WHERE bt.id = bot_templates.bot_id AND bt.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.bot_tokens bt
      WHERE bt.id = bot_templates.bot_id AND bt.owner_id = auth.uid())
  );
