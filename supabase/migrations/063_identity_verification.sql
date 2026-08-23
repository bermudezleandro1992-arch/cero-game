-- Identity verification (DNI upload) system
-- Users must verify identity to access: VIP plan, PRO communities, paid tournaments

-- Add is_verified to users if not present
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_verified       BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_tier TEXT        DEFAULT 'none'
    CHECK (verification_tier IN ('none','pending','verified','rejected'));

-- Identity verification requests
CREATE TABLE IF NOT EXISTS public.identity_verifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dni_front_url   TEXT        NOT NULL,
  dni_back_url    TEXT,
  selfie_url      TEXT,
  full_name       TEXT,
  dni_number      TEXT,
  birth_date      DATE,
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
  rejection_reason TEXT,
  reviewed_by     UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  UNIQUE(user_id)
);

ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;

-- User reads/inserts their own
CREATE POLICY "user reads own verification" ON public.identity_verifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user inserts own verification" ON public.identity_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user updates own verification" ON public.identity_verifications
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Staff reads all
CREATE POLICY "staff reads all verifications" ON public.identity_verifications
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role IN ('ceo','admin','moderador'))
  );
CREATE POLICY "staff updates verifications" ON public.identity_verifications
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role IN ('ceo','admin','moderador'))
  );

-- Storage bucket for identity docs (run in Supabase Dashboard → Storage)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('identity-docs', 'identity-docs', false);

-- RLS for storage: users upload their own docs, staff can read all
-- CREATE POLICY "users upload own docs" ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'identity-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "users read own docs" ON storage.objects FOR SELECT
--   USING (bucket_id = 'identity-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "staff reads all docs" ON storage.objects FOR SELECT
--   USING (bucket_id = 'identity-docs' AND auth.uid() IN (
--     SELECT id FROM public.users WHERE role IN ('ceo','admin','moderador')
--   ));

-- Function: approve identity verification
CREATE OR REPLACE FUNCTION approve_identity_verification(
  p_verification_id UUID,
  p_reviewer_id     UUID
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM identity_verifications WHERE id = p_verification_id;
  UPDATE identity_verifications
    SET status = 'approved', reviewed_by = p_reviewer_id, reviewed_at = now()
    WHERE id = p_verification_id;
  UPDATE users
    SET is_verified = true, verified_at = now(), verification_tier = 'verified'
    WHERE id = v_user_id;
END;
$$;

-- Function: reject identity verification
CREATE OR REPLACE FUNCTION reject_identity_verification(
  p_verification_id UUID,
  p_reviewer_id     UUID,
  p_reason          TEXT DEFAULT 'Documento no válido'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM identity_verifications WHERE id = p_verification_id;
  UPDATE identity_verifications
    SET status = 'rejected', reviewed_by = p_reviewer_id, reviewed_at = now(),
        rejection_reason = p_reason
    WHERE id = p_verification_id;
  UPDATE users
    SET verification_tier = 'rejected'
    WHERE id = v_user_id;
END;
$$;
