-- 080: trigger que auto-setea conversation_id en announcements de torneo
-- Si el insert viene con conversation_id NULL pero tournament_id seteado,
-- deriva la comunidad desde conversations.community_id del torneo.
-- Esto protege contra stale closures y cualquier otro path que olvide setear conversation_id.

CREATE OR REPLACE FUNCTION public.trg_auto_set_announcement_community()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.conversation_id IS NULL
     AND NEW.tournament_id IS NOT NULL
     AND NEW.category IN ('torneo', 'liga')
  THEN
    SELECT community_id INTO NEW.conversation_id
    FROM public.conversations
    WHERE id = NEW.tournament_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_announcement_community ON public.announcements;
CREATE TRIGGER trg_announcement_community
  BEFORE INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_set_announcement_community();
