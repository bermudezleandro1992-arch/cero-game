-- Referral tracking
-- invited_by: user_id de quien generó el link que usó este usuario para registrarse
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_source text; -- token del link de invitación usado

-- Índice para contar referidos por usuario rápidamente
CREATE INDEX IF NOT EXISTS idx_users_invited_by ON users(invited_by) WHERE invited_by IS NOT NULL;

-- Vista de referidos por usuario (para el panel admin)
CREATE OR REPLACE VIEW referral_stats AS
SELECT
  u.id          AS referrer_id,
  u.display_name AS referrer_name,
  u.username    AS referrer_username,
  u.avatar_url  AS referrer_avatar,
  COUNT(r.id)   AS total_referrals,
  COUNT(r.id) FILTER (WHERE r.created_at >= date_trunc('month', NOW())) AS referrals_this_month
FROM users u
LEFT JOIN users r ON r.invited_by = u.id
WHERE u.is_bot IS NOT TRUE
GROUP BY u.id, u.display_name, u.username, u.avatar_url
HAVING COUNT(r.id) > 0
ORDER BY referrals_this_month DESC, total_referrals DESC;

-- RLS: solo admins/CEO pueden ver la vista
GRANT SELECT ON referral_stats TO authenticated;
