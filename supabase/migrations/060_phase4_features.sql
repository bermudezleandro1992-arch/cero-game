-- Phase 4: community columns, user_devices, referral RPCs, ELO trigger

-- ── conversations: columnas adicionales ──────────────────────────────────────
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_public        BOOLEAN   DEFAULT true;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN  DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS category         TEXT;      -- 'gaming','efootball','fc','deportes','general'
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tags             TEXT[];
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS banner_url       TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS rules            TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS max_members      INTEGER   DEFAULT 50;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS referral_code    TEXT      UNIQUE;

-- ── users: columnas adicionales ──────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code    TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS platform         TEXT;  -- 'pc','ps','xbox','nintendo'
ALTER TABLE users ADD COLUMN IF NOT EXISTS sound_settings   JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme            TEXT  DEFAULT 'dark';

-- ── user_devices (anti-multicuenta) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_devices (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint TEXT        NOT NULL,
  user_agent  TEXT,
  ip_address  INET,
  first_seen  TIMESTAMPTZ DEFAULT now(),
  last_seen   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(fingerprint)
);

CREATE INDEX IF NOT EXISTS user_devices_user_id_idx ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS user_devices_fingerprint_idx ON user_devices(fingerprint);

ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own devices" ON user_devices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own devices" ON user_devices FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── referrals: ajustar FK a users (si apunta a profiles) ────────────────────
-- Safe: solo agrega la tabla si no existe con la FK correcta
CREATE TABLE IF NOT EXISTS referrals (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id UUID        REFERENCES conversations(id) ON DELETE SET NULL,
  status       TEXT        DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referred_id)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON referrals(referrer_id);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals visible to participants" ON referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- ── community_requests ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT        DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(community_id, user_id)
);

ALTER TABLE community_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_requests select" ON community_requests FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM group_roles gr
    WHERE gr.group_id = community_id AND gr.user_id = auth.uid()
    AND gr.role IN ('owner','admin','organizador')
  ));

-- ── RPC: generate_referral_code ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_referral_code(p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_code TEXT;
BEGIN
  SELECT referral_code INTO v_code FROM users WHERE id = p_user_id;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;

  LOOP
    v_code := upper(substring(md5(random()::text || p_user_id::text) FROM 1 FOR 8));
    BEGIN
      UPDATE users SET referral_code = v_code WHERE id = p_user_id;
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- retry
    END;
  END LOOP;
END;
$$;

-- ── RPC: verify_referral ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION verify_referral(p_referral_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE referrals
  SET status = 'verified', verified_at = now()
  WHERE id = p_referral_id AND status = 'pending';
END;
$$;

-- ── RPC: get_referral_ranking ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_referral_ranking(p_month INT, p_year INT)
RETURNS TABLE(
  id            UUID,
  display_name  TEXT,
  avatar_url    TEXT,
  total         BIGINT,
  verified      BIGINT
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    u.id, u.display_name, u.avatar_url,
    COUNT(r.id)                                              AS total,
    COUNT(r.id) FILTER (WHERE r.status = 'verified')        AS verified
  FROM referrals r
  JOIN users u ON r.referrer_id = u.id
  WHERE EXTRACT(MONTH FROM r.created_at) = p_month
    AND EXTRACT(YEAR  FROM r.created_at) = p_year
  GROUP BY u.id
  ORDER BY verified DESC, total DESC
  LIMIT 20;
$$;

-- ── RPC: request_join_community ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION request_join_community(p_community_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_requires BOOLEAN;
BEGIN
  SELECT requires_approval INTO v_requires FROM conversations WHERE id = p_community_id;
  IF v_requires THEN
    INSERT INTO community_requests(community_id, user_id)
    VALUES (p_community_id, p_user_id)
    ON CONFLICT (community_id, user_id) DO NOTHING;
  ELSE
    INSERT INTO conversation_members(conversation_id, user_id)
    VALUES (p_community_id, p_user_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- ── RPC: resolve_community_request ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_community_request(
  p_request_id UUID,
  p_approve    BOOLEAN
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req community_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM community_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;

  -- Verify caller is admin/owner of the community
  IF NOT EXISTS (
    SELECT 1 FROM group_roles
    WHERE group_id = v_req.community_id AND user_id = auth.uid()
    AND role IN ('owner','admin','organizador')
  ) THEN RAISE EXCEPTION 'not authorized'; END IF;

  IF p_approve THEN
    INSERT INTO conversation_members(conversation_id, user_id)
    VALUES (v_req.community_id, v_req.user_id)
    ON CONFLICT DO NOTHING;
    UPDATE community_requests SET status = 'approved' WHERE id = p_request_id;
  ELSE
    UPDATE community_requests SET status = 'rejected' WHERE id = p_request_id;
  END IF;
END;
$$;

-- ── RPC: update_elo (llamar al finalizar partido) ────────────────────────────
CREATE OR REPLACE FUNCTION update_elo(p_match_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winner_id    UUID;
  v_loser_id     UUID;
  v_winner_elo   INT;
  v_loser_elo    INT;
  v_expected     FLOAT;
  v_delta        INT;
BEGIN
  -- Assumes matches table has winner_id, player1_id, player2_id, result_confirmed=true
  SELECT winner_id,
    CASE WHEN winner_id = player1_id THEN player2_id ELSE player1_id END
  INTO v_winner_id, v_loser_id
  FROM matches WHERE id = p_match_id AND result_confirmed = true;

  IF v_winner_id IS NULL THEN RETURN; END IF;

  SELECT elo INTO v_winner_elo FROM users WHERE id = v_winner_id;
  SELECT elo INTO v_loser_elo  FROM users WHERE id = v_loser_id;

  v_winner_elo := COALESCE(v_winner_elo, 1200);
  v_loser_elo  := COALESCE(v_loser_elo,  1200);

  -- ELO formula
  v_expected := 1.0 / (1.0 + power(10.0, (v_loser_elo - v_winner_elo) / 400.0));
  v_delta    := GREATEST(5, LEAST(30, round(30 * (1 - v_expected))::INT));

  UPDATE users SET
    elo          = COALESCE(elo, 1200) + v_delta,
    wins         = COALESCE(wins, 0) + 1,
    total_matches = COALESCE(total_matches, 0) + 1
  WHERE id = v_winner_id;

  UPDATE users SET
    elo          = GREATEST(800, COALESCE(elo, 1200) - v_delta),
    losses       = COALESCE(losses, 0) + 1,
    total_matches = COALESCE(total_matches, 0) + 1
  WHERE id = v_loser_id;
END;
$$;

-- ── Trigger: generar referral_code al registrarse ────────────────────────────
CREATE OR REPLACE FUNCTION trg_generate_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := upper(substring(md5(random()::text || NEW.id::text) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_insert_referral_code ON users;
CREATE TRIGGER on_user_insert_referral_code
  BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION trg_generate_referral_code();

-- Backfill existing users without referral_code
UPDATE users SET referral_code = upper(substring(md5(random()::text || id::text) FROM 1 FOR 8))
WHERE referral_code IS NULL;

-- ── Trigger: actualizar email_verified_at ────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION trg_set_email_verified()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE users SET email_verified_at = now() WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
