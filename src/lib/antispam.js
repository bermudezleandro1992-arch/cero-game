import { supabase } from './supabase'

// ── Patrones de spam ─────────────────────────────────────────
// Links a grupos externos (WhatsApp, Telegram, Discord, etc.)
const SPAM_LINK_PATTERNS = [
  /https?:\/\/(chat\.whatsapp\.com|wa\.me)\//i,
  /https?:\/\/(t\.me|telegram\.me|telegram\.dog)\//i,
  /https?:\/\/(discord\.gg|discord\.com\/invite)\//i,
  /https?:\/\/(invite\.viber\.com)\//i,
  /https?:\/\/(signal\.group)\//i,
]

// Palabras de captación de usuarios hacia otros grupos
const SPAM_KEYWORDS = [
  /únete\s+a\s+(mi|nuestro|otro|un nuevo)/i,
  /join\s+(my|our|this|new)\s+(group|channel)/i,
  /grupo\s+(vip|exclusivo|oficial)\s*(de|para)?/i,
]

// Device fingerprint (sin bibliotecas externas)
export function getDeviceFingerprint() {
  try {
    const parts = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || '',
      navigator.platform || '',
    ]
    // Simple hash de las partes
    let h = 0
    const str = parts.join('|')
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
    }
    // Almacenar en localStorage para consistencia
    const stored = localStorage.getItem('_dfp')
    if (stored) return stored
    const fp = Math.abs(h).toString(36)
    localStorage.setItem('_dfp', fp)
    return fp
  } catch {
    return 'unknown'
  }
}

// ── Detección ────────────────────────────────────────────────
export function detectSpam(content) {
  if (!content || typeof content !== 'string') return null

  // Link a grupo externo
  for (const pattern of SPAM_LINK_PATTERNS) {
    if (pattern.test(content)) {
      return { type: 'spam_link', detail: 'Link a grupo externo detectado' }
    }
  }

  // Captación por palabras clave
  for (const pattern of SPAM_KEYWORDS) {
    if (pattern.test(content)) {
      return { type: 'spam_keyword', detail: 'Contenido de captación detectado' }
    }
  }

  return null
}

// ── Verificar si el usuario tiene sanción activa ──────────────
export async function checkSanction(userId) {
  const { data, error } = await supabase.rpc('check_user_sanctioned', {
    target_user_id: userId,
  })
  if (error) return { sanctioned: false }
  return data
}

// ── Aplicar sanción automática ───────────────────────────────
export async function applyAutoSanction(userId, reason, context = {}) {
  const fingerprint = getDeviceFingerprint()

  const { data, error } = await supabase.rpc('auto_apply_sanction', {
    target_user_id:  userId,
    p_reason:        reason,
    p_fingerprint:   fingerprint,
    p_context:       context,
  })

  if (error) {
    console.error('Error applying sanction:', error)
    return null
  }

  return data
}

// ── Reportar mensaje ─────────────────────────────────────────
export async function reportMessage({ reporterId, reportedUserId, messageId, conversationId, reason, contentSnapshot }) {
  const { error } = await supabase.from('spam_reports').insert({
    reporter_id:      reporterId,
    reported_user_id: reportedUserId,
    message_id:       messageId,
    conversation_id:  conversationId,
    reason,
    content_snapshot: contentSnapshot,
  })
  return !error
}

// ── Mensaje de sanción para mostrar al usuario ───────────────
export function sanctionMessage(sanction) {
  if (!sanction?.sanctioned) return null

  if (sanction.sanction_type === 'permanent_ban') {
    return 'Tu cuenta ha sido suspendida permanentemente por violar las normas de la comunidad.'
  }

  if (sanction.expires_at) {
    const expires = new Date(sanction.expires_at)
    const now = new Date()
    const diffMs = expires - now
    const diffH = Math.ceil(diffMs / 3600000)
    const diffD = Math.floor(diffH / 24)

    const timeStr = diffD > 0
      ? `${diffD} día${diffD !== 1 ? 's' : ''}`
      : `${diffH} hora${diffH !== 1 ? 's' : ''}`

    if (sanction.sanction_type === 'ban') {
      return `Tu cuenta está suspendida por ${timeStr}. Motivo: ${sanction.reason}`
    }
    return `Estás silenciado por ${timeStr}. Motivo: ${sanction.reason}`
  }

  return `Acción aplicada: ${sanction.reason}`
}
