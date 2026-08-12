-- Tabla de contactos (usuario guarda a otro usuario)
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nickname text,           -- nombre personalizado que el owner le pone al contacto
  created_at timestamptz DEFAULT now(),
  UNIQUE(owner_id, contact_id)
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_contacts" ON public.contacts
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Agregar campo phone a users (opcional, futuro)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS show_last_seen boolean DEFAULT true;
