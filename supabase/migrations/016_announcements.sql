-- Tabla de anuncios globales (torneos, ligas, eventos de juegos)
CREATE TABLE IF NOT EXISTS public.announcements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  body         text,
  image_url    text,            -- flyer/imagen principal
  link_url     text,            -- link externo opcional (formulario torneo, etc.)
  link_label   text,            -- etiqueta del link ("Inscribirse", "Ver bracket", etc.)
  game         text,            -- 'eFootball' | 'FC 26' | 'Warzone' | etc.
  category     text DEFAULT 'general',  -- 'torneo' | 'liga' | 'evento' | 'noticia' | 'general'
  is_pinned    boolean DEFAULT false,
  is_active    boolean DEFAULT true,
  view_count   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer anuncios activos
CREATE POLICY "anyone_can_read_announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (is_active = true);

-- Solo admins/organizadores pueden crear anuncios
-- (cualquier usuario autenticado por ahora — se refina con roles más adelante)
CREATE POLICY "authenticated_can_post_announcements"
  ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- Solo el autor puede editar/borrar sus propios anuncios
CREATE POLICY "author_can_update_announcements"
  ON public.announcements FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

CREATE POLICY "author_can_delete_announcements"
  ON public.announcements FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- Índice para feed (activos, recientes primero)
CREATE INDEX IF NOT EXISTS idx_announcements_feed
  ON public.announcements(is_active, is_pinned DESC, created_at DESC);

-- Tabla de likes en anuncios
CREATE TABLE IF NOT EXISTS public.announcement_likes (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

ALTER TABLE public.announcement_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_likes"
  ON public.announcement_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "users_own_likes"
  ON public.announcement_likes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
