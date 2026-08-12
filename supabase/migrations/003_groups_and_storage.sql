-- Soporte de grupos en conversaciones
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS is_group boolean DEFAULT false;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS avatar_url text;

-- Bucket de almacenamiento para imágenes y archivos
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT DO NOTHING;

-- Políticas de storage
CREATE POLICY IF NOT EXISTS "Usuarios autenticados pueden subir archivos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY IF NOT EXISTS "Todos pueden ver archivos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments');

CREATE POLICY IF NOT EXISTS "Usuarios pueden borrar sus archivos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
