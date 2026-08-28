-- ── Estados / Stories ─────────────────────────────────────────────────────────
-- Tipo: imagen, video o texto. expires_at controla visibilidad.
-- duration_hours: cuánto dura la historia (plan-dependiente)

CREATE TABLE IF NOT EXISTS public.estados (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type          text NOT NULL DEFAULT 'image' CHECK (type IN ('image','video','text')),
  media_url     text,
  caption       text,
  bg_color      text DEFAULT '#1a1a2e',
  duration_hours int NOT NULL DEFAULT 24 CHECK (duration_hours IN (6,12,24,48,72)),
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Vistas: quién vio cada estado
CREATE TABLE IF NOT EXISTS public.estado_views (
  estado_id uuid NOT NULL REFERENCES public.estados(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (estado_id, viewer_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_estados_user_id    ON public.estados(user_id);
CREATE INDEX IF NOT EXISTS idx_estados_expires_at ON public.estados(expires_at);

-- RLS
ALTER TABLE public.estados     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estado_views ENABLE ROW LEVEL SECURITY;

-- Policies: estados
-- Ver: propios + contactos mutuos con estado no expirado
CREATE POLICY "estados_select" ON public.estados FOR SELECT USING (
  auth.uid() = user_id
  OR expires_at > now()
);

CREATE POLICY "estados_insert" ON public.estados FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "estados_delete" ON public.estados FOR DELETE USING (auth.uid() = user_id);

-- Policies: vistas
CREATE POLICY "views_insert" ON public.estado_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);
CREATE POLICY "views_select" ON public.estado_views FOR SELECT USING (
  auth.uid() = viewer_id
  OR auth.uid() = (SELECT user_id FROM public.estados WHERE id = estado_id)
);

-- Storage bucket para estados (si no existe lo crea el siguiente script)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('estados', 'estados', true, 52428800, ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
ON CONFLICT (id) DO NOTHING;

-- Storage policy
CREATE POLICY "estados_storage_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'estados' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "estados_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'estados');
CREATE POLICY "estados_storage_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'estados' AND auth.uid()::text = (storage.foldername(name))[1]
);
