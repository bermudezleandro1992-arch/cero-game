import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Plan → expected USD amount + role to assign
const PLAN_CFG: Record<string, { amountUSD: number; role: string; label: string }> = {
  vip:         { amountUSD: 3.99,  role: 'vip',      label: 'VIP' },
  com_starter: { amountUSD: 15.99, role: 'comunidad', label: 'PRO Starter' },
  com_elite:   { amountUSD: 29.99, role: 'comunidad', label: 'PRO Elite' },
}

async function getPayPalToken(): Promise<string> {
  const clientId     = Deno.env.get('PAYPAL_CLIENT_ID')!
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')!
  const base         = Deno.env.get('PAYPAL_BASE_URL') || 'https://api-m.paypal.com'

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('PayPal auth failed')
  return data.access_token
}

async function getTransaction(token: string, txId: string) {
  const base = Deno.env.get('PAYPAL_BASE_URL') || 'https://api-m.paypal.com'
  // Search transactions window: last 31 days
  const endDate   = new Date().toISOString()
  const startDate = new Date(Date.now() - 31 * 86400 * 1000).toISOString()

  const url = `${base}/v1/reporting/transactions?` + new URLSearchParams({
    transaction_id: txId,
    fields: 'transaction_info,payer_info',
    start_date: startDate,
    end_date: endDate,
  })

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  return res.json()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })

    // Get caller user ID from JWT
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })

    const { planKey, transactionId } = await req.json()

    if (!planKey || !transactionId) {
      return new Response(JSON.stringify({ error: 'Faltan datos: planKey y transactionId son requeridos' }), { status: 400, headers: CORS })
    }

    const planCfg = PLAN_CFG[planKey]
    if (!planCfg) {
      return new Response(JSON.stringify({ error: 'Plan no válido' }), { status: 400, headers: CORS })
    }

    const txIdClean = transactionId.trim().toUpperCase()

    // Check if this transaction was already used
    const { data: existing } = await supabase
      .from('payments')
      .select('id')
      .eq('paypal_tx_id', txIdClean)
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({ error: 'Este ID de transacción ya fue utilizado' }), { status: 400, headers: CORS })
    }

    // Verify with PayPal API
    const token = await getPayPalToken()
    const txData = await getTransaction(token, txIdClean)

    const txList = txData.transaction_details
    if (!txList || txList.length === 0) {
      return new Response(JSON.stringify({ error: 'Transacción no encontrada en PayPal. Verificá el ID e intentá de nuevo.' }), { status: 404, headers: CORS })
    }

    const tx = txList[0]
    const txInfo = tx.transaction_info

    // Verify transaction status (S = Success)
    if (txInfo.transaction_status !== 'S') {
      return new Response(JSON.stringify({ error: `La transacción tiene estado "${txInfo.transaction_status}", no está completada.` }), { status: 400, headers: CORS })
    }

    // Verify amount (allow small tolerance for currency conversion)
    const paidAmount = Math.abs(parseFloat(txInfo.transaction_amount?.value || '0'))
    const tolerance  = 0.50 // 50 cents tolerance
    if (paidAmount < planCfg.amountUSD - tolerance) {
      return new Response(JSON.stringify({
        error: `Monto insuficiente. Se esperaba US$${planCfg.amountUSD}, se recibió US$${paidAmount.toFixed(2)}.`
      }), { status: 400, headers: CORS })
    }

    // All good — activate plan
    const expiresAt = new Date(Date.now() + 31 * 86400 * 1000).toISOString()

    const { error: updateErr } = await supabase
      .from('users')
      .update({
        plan: planKey,
        role: planCfg.role,
        subscription_expires_at: expiresAt,
      })
      .eq('id', user.id)

    if (updateErr) throw updateErr

    // Record payment to prevent reuse
    await supabase.from('payments').insert({
      user_id: user.id,
      amount: paidAmount,
      currency: 'USD',
      method: 'paypal',
      plan: planKey,
      status: 'approved',
      paypal_tx_id: txIdClean,
      reviewed_by: null,
    })

    return new Response(JSON.stringify({
      ok: true,
      plan: planKey,
      planLabel: planCfg.label,
      expiresAt,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('verify-paypal error:', err)
    return new Response(JSON.stringify({ error: 'Error interno. Intentá de nuevo.' }), { status: 500, headers: CORS })
  }
})
