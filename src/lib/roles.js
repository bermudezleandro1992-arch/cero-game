// Role hierarchy and permissions helper

export const ROLE_HIERARCHY = ['member', 'organizador', 'vip', 'comunidad', 'admin', 'ceo']

export const ROLE_CFG = {
  ceo:          { label: 'CEO',              color: '#a855f7', bg: '#a855f718', icon: '👑', tier: 5 },
  admin:        { label: 'Admin',            color: '#ef4444', bg: '#ef444418', icon: '🛡️', tier: 4 },
  comunidad:    { label: 'Comunidad',        color: '#3b82f6', bg: '#3b82f618', icon: '🌐', tier: 3 },
  vip:          { label: 'VIP',              color: '#f59e0b', bg: '#f59e0b18', icon: '⭐', tier: 2 },
  organizador:  { label: 'Organizador',      color: '#10b981', bg: '#10b98118', icon: '🎖️', tier: 1 },
  member:       { label: 'Miembro',          color: '#64748b', bg: '#64748b18', icon: '👤', tier: 0 },
}

// Tier limits per role
export const ROLE_LIMITS = {
  ceo:         { maxParticipants: 9999, maxTournamentsPerDay: 999, canPublishAnnouncements: true, canCreateGroup: true, canCreateCommunity: true },
  admin:       { maxParticipants: 9999, maxTournamentsPerDay: 99,  canPublishAnnouncements: true, canCreateGroup: true, canCreateCommunity: true },
  comunidad:   { maxParticipants: 9999, maxTournamentsPerDay: 20,  canPublishAnnouncements: true, canCreateGroup: true, canCreateCommunity: true },
  vip:         { maxParticipants: 128,  maxTournamentsPerDay: 10,  canPublishAnnouncements: true, canCreateGroup: true, canCreateCommunity: false },
  organizador: { maxParticipants: 32,   maxTournamentsPerDay: 3,   canPublishAnnouncements: true, canCreateGroup: true, canCreateCommunity: false },
  member:      { maxParticipants: 16,   maxTournamentsPerDay: 1,   canPublishAnnouncements: false, canCreateGroup: true, canCreateCommunity: false },
}

export function getRoleCfg(role) {
  return ROLE_CFG[role] || ROLE_CFG.member
}

export function getLimits(profile) {
  const role = profile?.role || 'member'
  return ROLE_LIMITS[role] || ROLE_LIMITS.member
}

export function canPublishAnnouncements(profile) {
  if (!profile) return false
  const role = profile.role || 'member'
  // App-level role check
  if (ROLE_LIMITS[role]?.canPublishAnnouncements) return true
  return false
}

export function getMaxParticipants(profile) {
  return getLimits(profile).maxParticipants
}
