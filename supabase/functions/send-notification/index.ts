/**
 * Unified notification sender — called by Database Webhook on messages INSERT.
 * Sends both FCM (Android APK) and Web Push (PWA) to all conversation/group participants
 * except the sender.
 *
 * Database Webhook setup (Supabase Dashboard → Database → Webhooks):
 *   Table: messages   Event: INSERT
 *   URL: https://<project-ref>.supabase.co/functions/v1/send-notification
 *   Method: POST  Auth: service-role key as Bearer token
 *
 * Required edge function secrets (Dashboard → Settings → Edge Functions):
 *   VAPID_PUBLIC_KEY   = BLCy9nx7ys67rMaCUt81qkazrY6RSfrczT2kOaxZ1_5jPGD_Wc0b6s5Cupl-sxsyOFrhj6iY4swj5o2zuxBiO8U
 *   VAPID_PRIVATE_KEY  = Wkfapl_mt7Ki4y4NIMbqghf6HOrI61nGOiUOlvIgiTU
 *   VAPID_SUBJECT      = mailto:bermudezleandro1992@gmail.com
 *   FIREBASE_SERVICE_ACCOUNT = <json from Firebase console>
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── VAPID / Web Push helpers ───────────────────────────────────────────────────
const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT') || 'mailto:info@mimensajero.app'

function base64urlToUint8(b64: string): Uint8Array {
  const pad = '='.repeat((4 - b64.length % 4) % 4)
  const b = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from([...b].map(c => c.charCodeAt(0)))
}

function uint8ToBase64url(u8: Uint8Array): string {
  return btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function makeVapidJwt(audience: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'ES256', typ: 'JWT' }
  const payload = { aud: audience, exp: now + 43200, sub: VAPID_SUBJECT }

  const enc = (o: object) => uint8ToBase64url(new TextEncoder().encode(JSON.stringify(o)))
  const sigInput = `${enc(header)}.${enc(payload)}`

  // Import VAPID private key (raw 32-byte EC private key)
  const privKeyBytes = base64urlToUint8(VAPID_PRIVATE_KEY)

  // Build JWK for P-256 private key
  const pubKeyBytes = base64urlToUint8(VAPID_PUBLIC_KEY)
  // pubKeyBytes is 65 bytes: 0x04 + 32 X + 32 Y
  const x = uint8ToBase64url(pubKeyBytes.slice(1, 33))
  const y = uint8ToBase64url(pubKeyBytes.slice(33, 65))
  const d = uint8ToBase64url(privKeyBytes)

  const privKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d, key_ops: ['sign'] },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privKey,
    new TextEncoder().encode(sigInput),
  )

  return `${sigInput}.${uint8ToBase64url(new Uint8Array(sig))}`
}

// Encrypt payload for Web Push (RFC 8291 — AES-128-GCM + ECDH + HKDF)
async function encryptWebPush(
  payloadStr: string,
  p256dhB64: string,
  authB64: string,
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const payload = new TextEncoder().encode(payloadStr)
  const authSecret = base64urlToUint8(authB64)
  const receiverPublicKey = base64urlToUint8(p256dhB64)

  // Generate ephemeral EC key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  )

  // Export server public key as raw (65 bytes)
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  )

  // Import receiver public key
  const receiverKey = await crypto.subtle.importKey(
    'raw', receiverPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  )

  // ECDH shared secret (32 bytes)
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverKey }, serverKeyPair.privateKey, 256
  )
  const sharedSecret = new Uint8Array(sharedBits)

  // Salt (16 bytes random)
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // HKDF-Extract: PRK = HMAC-SHA-256(auth_secret, ecdh_secret)
  const hkdfKey = async (ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, len: number) => {
    const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info }, baseKey, len * 8
    )
    return new Uint8Array(bits)
  }

  const PRK = await hkdfKey(sharedSecret, authSecret,
    new TextEncoder().encode('WebPush: info\0' + '\0'), 32)

  // Derive content encryption key (16 bytes) and nonce (12 bytes)
  const cekInfo  = new TextEncoder().encode('Content-Encoding: aes128gcm\0')
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0')
  const cek   = await hkdfKey(PRK, salt, cekInfo, 16)
  const nonce = await hkdfKey(PRK, salt, nonceInfo, 12)

  // AES-128-GCM encrypt (with 2-byte padding: [0x02, 0x00] record type + end of message)
  const padded = new Uint8Array([...payload, 0x02])
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, aesKey, padded
  )

  return { ciphertext: new Uint8Array(ciphertextBuf), salt, serverPublicKey: serverPublicKeyRaw }
}

async function sendWebPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: object) {
  const url = new URL(sub.endpoint)
  const audience = `${url.protocol}//${url.host}`
  const jwt = await makeVapidJwt(audience)

  const payloadStr = JSON.stringify(payload)
  const { ciphertext, salt, serverPublicKey } = await encryptWebPush(payloadStr, sub.p256dh, sub.auth)

  // Build encrypted body: salt(16) + rs(4=4096) + keyidlen(1) + server_public_key(65) + ciphertext
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096)
  const body = new Uint8Array([
    ...salt,
    ...rs,
    serverPublicKey.length,
    ...serverPublicKey,
    ...ciphertext,
  ])

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
    },
    body,
  })

  return { ok: res.ok, status: res.status }
}

// ── FCM helpers (reuse existing logic) ────────────────────────────────────────
async function getFCMAccessToken(serviceAccount: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const toB64 = (o: object) => btoa(JSON.stringify(o))
  const header  = toB64({ alg: 'RS256', typ: 'JWT' })
  const payload = toB64({ iss: serviceAccount.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })
  const sigInput = `${header}.${payload}`

  const keyData = serviceAccount.private_key.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\n/g, '')
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput))
  const jwt = `${sigInput}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`

  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` })
  return (await res.json()).access_token
}

async function sendFCM(fcmToken: string, title: string, body: string, data: Record<string, string>, type: string): Promise<boolean> {
  try {
    const sa = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!)
    const token = await getFCMAccessToken(sa)
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { token: fcmToken, notification: { title, body }, data, android: { priority: 'high', notification: { channel_id: type === 'call' ? 'calls' : 'messages', sound: type === 'call' ? 'ringtone' : 'default' } } } })
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('FCM error:', res.status, err)
    }
    return res.ok
  } catch (e) {
    console.error('FCM exception:', e)
    return false
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()

    // Accept both direct calls { targetUserId, type, payload }
    // AND Database Webhook { type: 'INSERT', table: 'messages', record: {...} }
    let targetUserIds: string[] = []
    let notifTitle = 'Mi Mensajero'
    let notifBody  = ''
    let notifType  = 'message'
    let notifData: Record<string, string> = {}

    if (body.table === 'messages' && body.record) {
      // Database Webhook — new message inserted
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const msg = body.record
      const senderId = msg.sender_id

      // Get sender name
      const { data: sender } = await supabase.from('users').select('display_name').eq('id', senderId).single()
      const senderName = sender?.display_name || 'Alguien'

      // Get recipients
      if (msg.conversation_id) {
        const { data: members } = await supabase.from('conversation_members').select('user_id').eq('conversation_id', msg.conversation_id).neq('user_id', senderId)
        targetUserIds = (members || []).map((m: { user_id: string }) => m.user_id)
      } else if (msg.group_id) {
        const { data: members } = await supabase.from('group_members').select('user_id').eq('group_id', msg.group_id).neq('user_id', senderId)
        targetUserIds = (members || []).map((m: { user_id: string }) => m.user_id)

        const { data: grp } = await supabase.from('groups').select('name').eq('id', msg.group_id).single()
        notifTitle = grp?.name ? `${senderName} en ${grp.name}` : senderName
      }

      const contentPreview = msg.type === 'text' ? (msg.content?.slice(0, 100) || '') :
        msg.type === 'image' ? '📷 Foto' :
        msg.type === 'video' ? '🎬 Video' :
        msg.type === 'audio' ? '🎙️ Audio' :
        msg.type === 'sticker' ? '🎭 Sticker' :
        msg.type === 'gif' ? '🎬 GIF' : '📎 Archivo'

      if (!msg.group_id) notifTitle = senderName
      notifBody = contentPreview
      notifType = 'message'
      notifData = { type: 'message', convId: msg.conversation_id || '', groupId: msg.group_id || '', senderId, senderName }

    } else if (body.targetUserId) {
      // Direct call from app
      targetUserIds = [body.targetUserId]
      const p = body.payload || {}
      notifType = body.type || 'message'
      notifTitle = notifType === 'call' ? `📞 Llamada de ${p.fromName}` : (p.title || 'Mi Mensajero')
      notifBody  = notifType === 'call' ? `${p.callType === 'video' ? '📹 Video' : '🎙️ Audio'} llamada entrante` : (p.body || '')
      notifData  = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)]))
      notifData.type = notifType
    } else {
      return new Response(JSON.stringify({ error: 'Unknown payload' }), { status: 400, headers: CORS })
    }

    if (!targetUserIds.length) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Fetch all targets' tokens and web push subs in one go
    const { data: users } = await supabase.from('users').select('id, fcm_token').in('id', targetUserIds)
    const { data: webSubs } = await supabase.from('push_subscriptions').select('user_id, endpoint, p256dh, auth').in('user_id', targetUserIds)

    const results: { userId: string; fcm?: boolean; webPush?: number }[] = []

    for (const userId of targetUserIds) {
      const user = users?.find((u: { id: string; fcm_token: string }) => u.id === userId)
      const subs = (webSubs || []).filter((s: { user_id: string }) => s.user_id === userId)
      const result: { userId: string; fcm?: boolean; webPush?: number } = { userId }

      // FCM
      if (user?.fcm_token) {
        result.fcm = await sendFCM(user.fcm_token, notifTitle, notifBody, notifData, notifType)
      }

      // Web Push (one per subscription/browser)
      let wpCount = 0
      for (const sub of subs) {
        if (!sub.p256dh || !sub.auth) continue
        try {
          const r = await sendWebPush(sub, { title: notifTitle, body: notifBody, tag: `mm-${notifType}`, type: notifType, data: notifData })
          if (r.ok) wpCount++
          // Remove expired subscriptions (410 Gone)
          if (r.status === 410) {
            await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', sub.endpoint)
          }
        } catch {}
      }
      result.webPush = wpCount
      results.push(result)
    }

    return new Response(JSON.stringify({ sent: results.length, results }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
