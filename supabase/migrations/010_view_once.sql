-- View-once / limited views for images and audio messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS max_views integer DEFAULT NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;

-- Track who viewed a view-once message
CREATE TABLE IF NOT EXISTS public.message_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE public.message_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_see_own_views" ON public.message_views
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
