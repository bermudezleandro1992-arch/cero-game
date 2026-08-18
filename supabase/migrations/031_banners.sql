-- Banners / sponsors system
CREATE TABLE IF NOT EXISTS public.banners (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text        NOT NULL,
  subtitle    text,
  emoji       text        DEFAULT '🎮',
  image_url   text,
  link_url    text,
  bg_color    text        DEFAULT '#0f172a',
  accent_color text       DEFAULT '#22c55e',
  position    text        DEFAULT 'all',   -- 'chats' | 'explorar' | 'torneos' | 'all'
  active      boolean     DEFAULT true,
  priority    integer     DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Anyone can read active banners
CREATE POLICY "banners_select" ON public.banners
  FOR SELECT USING (active = true);

-- Only admin/ceo can write
CREATE POLICY "banners_admin" ON public.banners
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'ceo')
    )
  );

-- Seed with a demo banner
INSERT INTO public.banners (title, subtitle, emoji, bg_color, accent_color, position, priority)
VALUES
  ('eFootball 2025', 'Descargá gratis y jugá torneos online', '⚽', '#0a1628', '#3b82f6', 'all', 10),
  ('Mi Mensajero VIP', 'Organizá torneos sin límites desde $4.99/mes', '⭐', '#1a0f00', '#f59e0b', 'chats', 5);
