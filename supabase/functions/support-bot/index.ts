/**
 * support-bot — Bot de soporte técnico de Mi Mensajero
 *
 * Invocado via HTTP POST desde el cliente (o webhook de DB).
 * Recibe un mensaje de usuario en el grupo de soporte,
 * matchea contra la FAQ y responde automáticamente.
 * Si no hay match → crea un ticket y notifica al staff.
 *
 * Endpoint: POST /support-bot
 * Body: { message_id, conversation_id, sender_id, content }
 * Auth: service role (interno) o Authorization: Bearer <SUPPORT_BOT_SECRET>
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { matchFAQ } from './faq.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BOT_SECRET   = Deno.env.get('SUPPORT_BOT_SECRET') ?? ''

// Tiempo mínimo entre respuestas del bot al mismo usuario (ms)
const COOLDOWN_MS = 30_000
const recentReplies = new Map<string, number>()

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Auth check
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (BOT_SECRET && token !== BOT_SECRET && token !== SERVICE_KEY) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let body: { message_id?: number; conversation_id?: string; sender_id?: string; content?: string }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const { message_id, conversation_id, sender_id, content } = body
  if (!conversation_id || !sender_id || !content) {
    return json({ error: 'Missing fields' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // ── Get bot user ──────────────────────────────────────────────────────────
  const { data: botUser } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('is_bot', true)
    .eq('bot_type', 'support')
    .single()

  if (!botUser) return json({ error: 'Bot user not configured' }, 500)

  // ── Verify sender is not the bot itself ───────────────────────────────────
  if (sender_id === botUser.id) return json({ ok: true, skipped: 'bot message' })

  // ── Cooldown check ────────────────────────────────────────────────────────
  const now = Date.now()
  const lastReply = recentReplies.get(sender_id) ?? 0
  if (now - lastReply < COOLDOWN_MS) {
    return json({ ok: true, skipped: 'cooldown' })
  }

  // ── Get sender info ───────────────────────────────────────────────────────
  const { data: sender } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', sender_id)
    .single()

  const senderName = sender?.display_name ?? 'Usuario'

  // ── FAQ matching ──────────────────────────────────────────────────────────
  const match = matchFAQ(content)

  if (match) {
    // ── Send FAQ answer ───────────────────────────────────────────────────
    const response = `Hola *${senderName}* 👋\n\n${match.answer}`

    await supabase.from('messages').insert({
      conversation_id,
      sender_id: botUser.id,
      content: response,
      type: 'text',
    })

    recentReplies.set(sender_id, now)

    // If FAQ entry suggests escalation, also create ticket
    if (match.escalate) {
      await createTicket(supabase, botUser.id, conversation_id, sender_id, message_id, content, senderName)
    }

    return json({ ok: true, action: 'faq_answer', escalated: match.escalate })
  }

  // ── No FAQ match → create ticket + escalate ───────────────────────────────
  const ticketInfo = await createTicket(supabase, botUser.id, conversation_id, sender_id, message_id, content, senderName)

  const noMatchResponse =
    `Hola *${senderName}* 👋\n\n` +
    `Recibí tu consulta y generé un ticket de soporte:\n` +
    `🎫 *${ticketInfo.ticketNo}*\n\n` +
    `Un agente de soporte te va a responder en breve. Mientras tanto, podés:\n` +
    `• Describir mejor el problema (dispositivo, qué estabas haciendo)\n` +
    `• Incluir una captura de pantalla si ayuda\n\n` +
    `_Horario de atención: lunes a viernes 9–18 hs (UTC-3)_`

  await supabase.from('messages').insert({
    conversation_id,
    sender_id: botUser.id,
    content: noMatchResponse,
    type: 'text',
  })

  recentReplies.set(sender_id, now)
  return json({ ok: true, action: 'ticket_created', ticket: ticketInfo.ticketNo })
})

// ── Create support ticket ─────────────────────────────────────────────────────
async function createTicket(
  supabase: ReturnType<typeof createClient>,
  botId: string,
  conversationId: string,
  userId: string,
  messageId: number | undefined,
  content: string,
  senderName: string,
) {
  // Generate ticket number
  const { data: seqRow } = await supabase.rpc('nextval', { seq: 'support_ticket_seq' }).single()
  // Fallback: use timestamp if RPC not available
  const seqNum = seqRow ?? Math.floor(Date.now() / 1000) % 100000
  const ticketNo = `TKT-${String(seqNum).padStart(4, '0')}`

  await supabase.from('support_tickets').insert({
    ticket_no: ticketNo,
    user_id: userId,
    conversation_id: conversationId,
    message_id: messageId ?? null,
    status: 'open',
  })

  // Notify staff in the same group with a pinned-style message
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: botId,
    content:
      `🎫 *Nuevo ticket ${ticketNo}*\n` +
      `👤 Usuario: ${senderName}\n` +
      `📝 Consulta: "${content.slice(0, 120)}${content.length > 120 ? '…' : ''}"\n` +
      `\n_⚡ Staff: respondé en este chat para cerrar el ticket._`,
    type: 'text',
  })

  return { ticketNo }
}
