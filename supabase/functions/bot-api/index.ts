/**
 * Bot API — permite que plataformas externas publiquen mensajes en grupos/comunidades.
 *
 * Endpoints:
 *   POST /bot-api/send      — enviar mensaje
 *   POST /bot-api/announce  — enviar aviso (solo si el grupo lo permite)
 *   GET  /bot-api/info      — info del bot y estado
 *   GET  /bot-api/logs      — últimas 20 acciones del bot
 *
 * Auth: Authorization: Bearer <token>  ó  body { "bot_token": "..." }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bot-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const url = new URL(req.url)
  // Path after /bot-api
  const path = url.pathname.replace(/.*\/bot-api/, '') || '/'

  // ── Extract token ──────────────────────────────────────────
  let botToken: string | null = null
  const auth = req.headers.get('Authorization') || req.headers.get('x-bot-token')
  if (auth?.startsWith('Bearer ')) botToken = auth.slice(7)
  else if (auth) botToken = auth

  let body: Record<string, unknown> = {}
  if (req.method === 'POST') {
    try { body = await req.json() } catch { /* empty body ok */ }
  }
  if (!botToken) botToken = body.bot_token as string ?? null

  if (!botToken) return json({ error: 'Token requerido. Usá Authorization: Bearer <token>' }, 401)

  // ── Validate token ─────────────────────────────────────────
  const { data: bot, error: botErr } = await supabase
    .from('bot_tokens')
    .select('id, name, owner_id, conversation_id, active, webhook_url, created_at')
    .eq('token', botToken)
    .single()

  if (botErr || !bot) return json({ error: 'Token inválido o no encontrado' }, 403)
  if (!bot.active) return json({ error: 'Bot pausado. Activalo desde la app.' }, 403)

  // Update last_used_at
  supabase.from('bot_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', bot.id).then(() => {})

  // ── GET /info ──────────────────────────────────────────────
  if (path === '/info' && req.method === 'GET') {
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, name, group_type, announcement_only')
      .eq('id', bot.conversation_id)
      .single()
    return json({
      ok: true,
      bot: { id: bot.id, name: bot.name, active: bot.active, created_at: bot.created_at },
      conversation: conv ?? null,
    })
  }

  // ── GET /logs ──────────────────────────────────────────────
  if (path === '/logs' && req.method === 'GET') {
    const { data: logs } = await supabase
      .from('bot_logs')
      .select('action, status, payload, created_at')
      .eq('bot_id', bot.id)
      .order('created_at', { ascending: false })
      .limit(20)
    return json({ ok: true, logs: logs ?? [] })
  }

  // ── POST /send ─────────────────────────────────────────────
  if ((path === '/send' || path === '/' || path === '') && req.method === 'POST') {
    const message   = body.message as string
    const type      = (body.type as string) ?? 'text'
    const convId    = (body.conversation_id as string) ?? bot.conversation_id

    if (!message?.trim()) return json({ error: '"message" es requerido' }, 400)
    if (type && !['text','image','file','announcement'].includes(type)) {
      return json({ error: `Tipo inválido. Válidos: text, image, file, announcement` }, 400)
    }

    const msgPayload: Record<string, unknown> = {
      conversation_id: convId,
      sender_id: bot.owner_id,
      content: message.trim(),
      type: type === 'announcement' ? 'text' : type,
    }
    try {
      // metadata puede no estar en el cache de esquema aún
      const testCol = await supabase.from('messages').select('metadata').limit(0)
      if (!testCol.error) msgPayload.metadata = { bot: true, bot_id: bot.id, bot_name: bot.name }
    } catch { /* sin metadata */ }

    const { data: msg, error: msgErr } = await supabase
      .from('messages')
      .insert(msgPayload)
      .select('id, created_at')
      .single()

    const status = msgErr ? 'error' : 'ok'
    await supabase.from('bot_logs').insert({
      bot_id: bot.id,
      conversation_id: convId,
      action: 'send_message',
      payload: { message: message.trim(), type },
      status,
      error: msgErr?.message ?? null,
    })

    if (msgErr) return json({ error: msgErr.message }, 500)

    // Forward event to webhook if configured
    if (bot.webhook_url) {
      fetch(bot.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'message_sent', message_id: msg.id, bot_id: bot.id }),
      }).catch(() => {})
    }

    return json({ ok: true, message_id: msg.id, created_at: msg.created_at })
  }

  // ── POST /announce ─────────────────────────────────────────
  if (path === '/announce' && req.method === 'POST') {
    const message = body.message as string
    const convId  = (body.conversation_id as string) ?? bot.conversation_id

    if (!message?.trim()) return json({ error: '"message" es requerido' }, 400)

    // Check conv allows bot announcements
    const { data: conv } = await supabase
      .from('conversations')
      .select('announcement_only, is_locked')
      .eq('id', convId)
      .single()

    if (conv?.is_locked) return json({ error: 'El grupo está bloqueado' }, 403)

    const { data: msg, error: msgErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: convId,
        sender_id: bot.owner_id,
        content: `📢 ${message.trim()}`,
        type: 'text',
      })
      .select('id, created_at')
      .single()

    await supabase.from('bot_logs').insert({
      bot_id: bot.id,
      conversation_id: convId,
      action: 'announce',
      payload: { message: message.trim() },
      status: msgErr ? 'error' : 'ok',
      error: msgErr?.message ?? null,
    })

    if (msgErr) return json({ error: msgErr.message }, 500)
    return json({ ok: true, message_id: msg.id, created_at: msg.created_at })
  }

  return json({ error: `Ruta no encontrada: ${req.method} ${path}` }, 404)
})
