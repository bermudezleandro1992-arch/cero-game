// Edge Function: Crea una preferencia de pago en Mercado Pago
// Se llama desde el frontend cuando el usuario elige suscribirse

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN') || ''
const APP_URL = Deno.env.get('APP_URL') || 'https://mimensajero.vercel.app'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const PLANS: Record<string, { title: string; price: number; months: number }> = {
  vip:       { title: 'Mi Mensajero VIP',          price: 4.99,  months: 1 },
  comunidad: { title: 'Mi Mensajero Comunidad Pro', price: 9.99,  months: 1 },
  vip_anual: { title: 'Mi Mensajero VIP Anual',     price: 39.99, months: 12 },
  com_anual: { title: 'Comunidad Pro Anual',         price: 79.99, months: 12 },
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { plan_id, user_id, user_email } = await req.json()

    const plan = PLANS[plan_id]
    if (!plan) return new Response(JSON.stringify({ error: 'Plan inválido' }), { status: 400, headers: cors })

    // Registrar pago pendiente en DB
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: payment } = await supabase.from('payments').insert({
      user_id,
      plan: plan_id.replace('_anual', ''),
      method: 'mercadopago',
      amount_usd: plan.price,
      status: 'pending',
    }).select('id').single()

    // Crear preferencia en MP
    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        items: [{
          title: plan.title,
          unit_price: plan.price,
          quantity: 1,
          currency_id: 'USD',
        }],
        payer: { email: user_email },
        back_urls: {
          success: `${APP_URL}/payment/success?payment_id=${payment?.id}`,
          failure: `${APP_URL}/payment/failure`,
          pending: `${APP_URL}/payment/pending`,
        },
        auto_return: 'approved',
        external_reference: `${user_id}|${plan_id}|${payment?.id}`,
        notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
        metadata: {
          user_id,
          plan_id,
          months: plan.months,
          payment_db_id: payment?.id,
        },
      }),
    })

    const data = await res.json()

    // Guardar el preference_id en el pago
    if (payment?.id && data.id) {
      await supabase.from('payments').update({ external_id: data.id }).eq('id', payment.id)
    }

    return new Response(JSON.stringify({
      checkout_url: data.init_point,         // redirect al checkout de MP
      sandbox_url:  data.sandbox_init_point, // para pruebas
      preference_id: data.id,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors })
  }
})
