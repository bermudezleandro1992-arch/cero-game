import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('No signature', { status: 400 })

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = stripe.webhooks.constructEvent(body, sig, Deno.env.get('STRIPE_WEBHOOK_SECRET')!)
  } catch (err) {
    return new Response(`Webhook error: ${err.message}`, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const { user_id, plan } = session.metadata ?? {}
        if (!user_id || !plan) break

        const end = new Date(Date.now() + 30 * 86400000).toISOString()
        await supabase.from('subscriptions').insert({
          user_id,
          plan,
          status: 'active',
          start_date: new Date().toISOString(),
          end_date: end,
          stripe_subscription_id: session.subscription as string,
          stripe_customer_id: session.customer as string,
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await supabase.from('subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', sub.id)
        break
      }

      case 'invoice.payment_succeeded': {
        const inv = event.data.object as Stripe.Invoice
        const sub = inv.subscription
          ? await stripe.subscriptions.retrieve(inv.subscription as string)
          : null
        const user_id = sub?.metadata?.user_id
        const plan = sub?.metadata?.plan
        if (!user_id || !plan) break

        await supabase.from('payment_history').insert({
          user_id,
          amount: inv.amount_paid / 100,
          currency: inv.currency.toUpperCase(),
          plan,
          status: 'completed',
          stripe_payment_id: inv.payment_intent as string,
        })

        // Extend or update active subscription
        const end = new Date(Date.now() + 30 * 86400000).toISOString()
        await supabase.from('subscriptions')
          .update({ status: 'active', end_date: end, updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', inv.subscription as string)
        break
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice
        const user_id = (inv as any).metadata?.user_id
        if (!user_id) break

        await supabase.from('payment_history').insert({
          user_id,
          amount: inv.amount_due / 100,
          currency: inv.currency.toUpperCase(),
          plan: 'unknown',
          status: 'failed',
          stripe_payment_id: inv.payment_intent as string,
        })
        break
      }
    }
  } catch (err) {
    console.error('Handler error:', err)
    return new Response('Handler error', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
