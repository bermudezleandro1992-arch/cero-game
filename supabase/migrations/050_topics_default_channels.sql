-- ═══════════════════════════════════════════════════════════
-- 050: Canales por defecto y permisos por canal
-- ═══════════════════════════════════════════════════════════

-- 1. Agregar columnas a topics
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS is_default   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS who_can_send text    DEFAULT 'everyone' CHECK (who_can_send IN ('everyone','admins'));

-- 2. Arreglar duplicados: si hay más de un topic llamado "Avisos" en la misma comunidad, borrar los extras
DELETE FROM public.topics
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY conversation_id, lower(name) ORDER BY created_at ASC) AS rn
    FROM public.topics
    WHERE lower(name) IN ('avisos', 'general')
  ) sub
  WHERE rn > 1
);

-- 3. Marcar los canales General y Avisos existentes como is_default
UPDATE public.topics SET is_default = true
WHERE lower(name) IN ('general', 'avisos');

-- 4. Poner who_can_send = 'admins' en los Avisos existentes
UPDATE public.topics SET who_can_send = 'admins'
WHERE lower(name) = 'avisos';

-- 5. Para comunidades que NO tienen topics todavía, crearlos
INSERT INTO public.topics (conversation_id, name, emoji, topic_type, position, is_default, who_can_send)
SELECT c.id, 'General', '💬', 'chat', 0, true, 'everyone'
FROM public.conversations c
WHERE c.group_type = 'community'
  AND NOT EXISTS (
    SELECT 1 FROM public.topics t WHERE t.conversation_id = c.id AND lower(t.name) = 'general'
  );

INSERT INTO public.topics (conversation_id, name, emoji, topic_type, position, is_default, who_can_send)
SELECT c.id, 'Avisos', '📢', 'announcements', 1, true, 'admins'
FROM public.conversations c
WHERE c.group_type = 'community'
  AND NOT EXISTS (
    SELECT 1 FROM public.topics t WHERE t.conversation_id = c.id AND lower(t.name) = 'avisos'
  );
