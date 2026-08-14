import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get FCM access token using Service Account credentials
async function getFCMAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))

  const signingInput = `${header}.${payload}`

  // Import private key
  const privateKey = serviceAccount.private_key
  const keyData = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')

  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenRes.json()
  return tokenData.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { targetUserId, type, payload } = await req.json()

    // Get target user's FCM token from DB
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: user } = await supabase
      .from('users')
      .select('fcm_token, display_name')
      .eq('id', targetUserId)
      .single()

    if (!user?.fcm_token) {
      return new Response(JSON.stringify({ error: 'No FCM token for user' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    // Get service account from env
    const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!)
    const accessToken = await getFCMAccessToken(serviceAccount)
    const projectId = serviceAccount.project_id

    // Build FCM message
    const title = type === 'call'
      ? `📞 Llamada de ${payload.fromName}`
      : payload.title || 'Mi Mensajero'

    const body = type === 'call'
      ? `${payload.callType === 'video' ? '📹 Video' : '🎙️ Audio'} llamada entrante`
      : payload.body || ''

    const fcmMessage = {
      message: {
        token: user.fcm_token,
        notification: { title, body },
        data: {
          type,
          ...Object.fromEntries(
            Object.entries(payload).map(([k, v]) => [k, String(v)])
          ),
        },
        android: {
          priority: 'high',
          notification: {
            channel_id: type === 'call' ? 'calls' : 'messages',
            sound: type === 'call' ? 'ringtone' : 'default',
          },
        },
      }
    }

    const fcmRes = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fcmMessage),
      }
    )

    const fcmData = await fcmRes.json()

    if (!fcmRes.ok) {
      throw new Error(fcmData.error?.message || 'FCM send failed')
    }

    return new Response(JSON.stringify({ success: true, messageId: fcmData.name }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
