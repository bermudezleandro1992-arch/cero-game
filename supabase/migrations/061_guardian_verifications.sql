-- Guardian email verifications for minor users (age 13-17)
CREATE TABLE IF NOT EXISTS guardian_verifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  minor_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guardian_email TEXT       NOT NULL,
  token         TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  responded_at  TIMESTAMPTZ,
  UNIQUE(minor_id)
);

ALTER TABLE guardian_verifications ENABLE ROW LEVEL SECURITY;

-- Minor can read their own verification status
CREATE POLICY "minor reads own" ON guardian_verifications FOR SELECT
  USING (auth.uid() = minor_id);

-- Service role can do everything (edge function)
CREATE POLICY "service role all" ON guardian_verifications FOR ALL
  USING (true) WITH CHECK (true);

-- Mark minor account as pending guardian approval
ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_status TEXT DEFAULT NULL;
-- NULL = adult (no restriction), 'pending' = waiting guardian, 'approved' = guardian approved
