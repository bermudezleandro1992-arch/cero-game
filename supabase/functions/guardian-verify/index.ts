/**
 * Guardian email verification for minor users.
 *
 * POST /functions/v1/guardian-verify  { action: 'send', minor_id, guardian_email, minor_name }
 *   → sends approval email to guardian, inserts guardian_verifications row
 *
 * GET  /functions/v1/guardian-verify?token=XXX&action=approve|reject
 *   → updates status, redirects to app with result
 *
 * Required edge function secrets:
 *   RESEND_API_KEY  = re_xxxxxxxxxxxxxxxxxxxx   (from resend.com, free plan)
 *   SUPABASE_URL    = (auto-provided)
 *   SUPABASE_SERVICE_ROLE_KEY = (auto-provided)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APP_URL = 'https://mimensajero.vercel.app'
const FROM_EMAIL = 'noreply@mimensajero.app'
const FROM_NAME  = 'Mi Mensajero'

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) throw new Error('RESEND_API_KEY not configured')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to, subject, html }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error ${res.status}: ${err}`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = new URL(req.url)
  const supabase = supabaseAdmin()

  // ── GET: guardian clicks approve/reject link ──────────────────────────────
  if (req.method === 'GET') {
    const token  = url.searchParams.get('token')
    const action = url.searchParams.get('action') // 'approve' | 'reject'

    if (!token || !['approve','reject'].includes(action ?? '')) {
      return new Response('Link inválido.', { status: 400 })
    }

    const { data: row, error } = await supabase
      .from('guardian_verifications')
      .select('id, minor_id, status')
      .eq('token', token)
      .maybeSingle()

    if (error || !row) {
      return new Response('Token no encontrado o ya usado.', { status: 404 })
    }
    if (row.status !== 'pending') {
      return Response.redirect(`${APP_URL}?guardian=already_responded`, 302)
    }

    const newStatus  = action === 'approve' ? 'approved' : 'rejected'
    const guardianStatus = action === 'approve' ? 'approved' : 'rejected'

    await supabase.from('guardian_verifications').update({
      status: newStatus, responded_at: new Date().toISOString(),
    }).eq('id', row.id)

    await supabase.from('users').update({ guardian_status: guardianStatus }).eq('id', row.minor_id)

    const msg = action === 'approve'
      ? '✅ Autorizaste el registro. El menor ya puede usar Mi Mensajero.'
      : '❌ Rechazaste el registro. La cuenta del menor fue bloqueada.'

    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Mi Mensajero</title>
      <style>body{font-family:sans-serif;background:#05080A;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px}
      p{font-size:18px;text-align:center}a{color:#39FF14;font-size:14px}</style></head>
      <body><p>${msg}</p><a href="${APP_URL}">Ir a Mi Mensajero</a></body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    )
  }

  // ── POST: send guardian verification email ────────────────────────────────
  if (req.method === 'POST') {
    let body: { action?: string; minor_id?: string; guardian_email?: string; minor_name?: string }
    try { body = await req.json() } catch { return new Response('Bad JSON', { status: 400, headers: CORS }) }

    if (body.action !== 'send' || !body.minor_id || !body.guardian_email) {
      return new Response(JSON.stringify({ error: 'missing fields' }), { status: 400, headers: CORS })
    }

    const name = body.minor_name || 'Un menor'

    // Upsert verification row (get the generated token)
    const { data: row, error: insertErr } = await supabase
      .from('guardian_verifications')
      .upsert({ minor_id: body.minor_id, guardian_email: body.guardian_email, status: 'pending' },
               { onConflict: 'minor_id' })
      .select('token')
      .single()

    if (insertErr || !row) {
      return new Response(JSON.stringify({ error: insertErr?.message ?? 'db error' }), { status: 500, headers: CORS })
    }

    const fnUrl = Deno.env.get('SUPABASE_URL')!.replace('/rest/v1','') + '/functions/v1/guardian-verify'
    const approveUrl = `${fnUrl}?token=${row.token}&action=approve`
    const rejectUrl  = `${fnUrl}?token=${row.token}&action=reject`

    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f4f4f4;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px #0002">
    <div style="background:#111B21;padding:28px 24px;text-align:center">
      <span style="font-size:40px">⚡</span>
      <h1 style="color:#fff;margin:12px 0 0;font-size:20px">Mi Mensajero</h1>
    </div>
    <div style="padding:28px 24px">
      <h2 style="margin:0 0 12px;font-size:17px;color:#111">Solicitud de registro de un menor</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 20px">
        <strong>${name}</strong> quiere registrarse en <strong>Mi Mensajero</strong> y declaró que sos su tutor/a legal.
        Como menor de edad, necesita tu autorización para poder usar la plataforma.
      </p>
      <a href="${approveUrl}" style="display:block;background:#39FF14;color:#111;font-weight:800;font-size:15px;text-align:center;padding:14px;border-radius:10px;text-decoration:none;margin-bottom:10px">
        ✅ Autorizar el registro
      </a>
      <a href="${rejectUrl}" style="display:block;background:#f3f4f6;color:#666;font-size:13px;text-align:center;padding:12px;border-radius:10px;text-decoration:none">
        ❌ No autorizo — bloquear esta cuenta
      </a>
      <p style="color:#999;font-size:11px;margin:20px 0 0;line-height:1.5">
        Si no reconocés esta solicitud, hacé click en "No autorizo". El menor no podrá usar la aplicación.<br>
        Este link vence en 7 días.
      </p>
    </div>
  </div>
</body></html>`

    try {
      await sendEmail(body.guardian_email, `${name} quiere registrarse en Mi Mensajero — Autorizá su cuenta`, html)
      // Mark minor as pending
      await supabase.from('users').update({ guardian_status: 'pending' }).eq('id', body.minor_id)
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
  }

  return new Response('Method not allowed', { status: 405, headers: CORS })
})
