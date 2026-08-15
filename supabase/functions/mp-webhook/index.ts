// Edge Function: Webhook de Mercado Pago
// MP llama a esta URL cuando cambia el estado de un pago

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_ACCESS_TOKEN    = Deno.env.get('MP_ACCESS_TOKEN') || ''
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // MP envía el evento como query param o body
  const url  = new URL(req.url)
  const type = url.searchParams.get('type') || ''
  const id   = url.searchParams.get('data.id') || ''

  if (type !== 'payment' || !id) {
    return new Response('ok', { status: 200 })
  }

  try {
    // Buscar el pago en la API de MP
    const res  = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
    })
    const mp = await res.json()

    const mpStatus       = mp.status          // 'approved' | 'pending' | 'rejected'
    const externalRef    = mp.external_reference || '' // "user_id|plan_id|payment_db_id"
    const [userId, planId, paymentDbId] = externalRef.split('|')
    const months         = mp.metadata?.months || 1

    // Actualizar el pago en DB
    await supabase.from('payments').update({
      status:    mpStatus === 'approved' ? 'approved' : mpStatus === 'rejected' ? 'rejected' : 'pending',
      raw_data:  mp,
      updated_at: new Date().toISOString(),
    }).eq('id', paymentDbId)

    // Si fue aprobado → activar suscripción
    if (mpStatus === 'approved' && userId && planId) {
      const basePlan = planId.replace('_anual', '')
      await supabase.rpc('activate_subscription', {
        p_user_id:    userId,
        p_plan:       basePlan,
        p_payment_id: paymentDbId || null,
        p_method:     'mercadopago',
        p_months:     months,
      })
    }

    return new Response('ok', { status: 200 })
  } catch (e) {
    console.error('MP webhook error:', e)
    return new Response('error', { status: 500 })
  }
})
