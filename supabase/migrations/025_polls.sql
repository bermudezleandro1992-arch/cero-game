-- Migration 025: polls and poll_votes

CREATE TABLE IF NOT EXISTS public.polls (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question         text NOT NULL,
  options          text[] NOT NULL,
  conversation_id  uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  created_by       uuid REFERENCES public.users(id) ON DELETE CASCADE,
  multi_choice     boolean DEFAULT false,
  ends_at          timestamptz,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id      uuid REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.users(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (poll_id, user_id, option_index)
);

-- match_results table (for CargaResultadosPage)
CREATE TABLE IF NOT EXISTS public.match_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local           text NOT NULL,
  visitante       text NOT NULL,
  goles_local     integer DEFAULT 0,
  goles_visitante integer DEFAULT 0,
  nota            text,
  photo_url       text,
  submitted_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status          text DEFAULT 'pendiente' CHECK (status IN ('pendiente','aprobado','rechazado')),
  reviewed_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.polls        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "polls_select"      ON public.polls;
DROP POLICY IF EXISTS "polls_insert"      ON public.polls;
DROP POLICY IF EXISTS "polls_delete"      ON public.polls;
DROP POLICY IF EXISTS "votes_select"      ON public.poll_votes;
DROP POLICY IF EXISTS "votes_upsert"      ON public.poll_votes;
DROP POLICY IF EXISTS "results_select"    ON public.match_results;
DROP POLICY IF EXISTS "results_insert"    ON public.match_results;

CREATE POLICY "polls_select"   ON public.polls        FOR SELECT USING (true);
CREATE POLICY "polls_insert"   ON public.polls        FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "polls_delete"   ON public.polls        FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "votes_select"   ON public.poll_votes   FOR SELECT USING (true);
CREATE POLICY "votes_upsert"   ON public.poll_votes   FOR ALL   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "results_select" ON public.match_results FOR SELECT USING (true);
CREATE POLICY "results_insert" ON public.match_results FOR INSERT WITH CHECK (auth.uid() = submitted_by);

-- Storage bucket for result photos (run separately if bucket doesn't exist)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('result-photos', 'result-photos', true)
-- ON CONFLICT DO NOTHING;
