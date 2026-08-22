import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useSubscription } from '../hooks/useSubscription'
import { C } from '../theme'

const PLAN_CFG = {
  free: { label: 'Gratis',       color: '#6b7280', bg: '#6b728018', icon: '🆓' },
  vip:  { label: 'VIP',          color: '#f59e0b', bg: '#f59e0b18', icon: '⭐' },
  pro:  { label: 'PRO',          color: '#8b5cf6', bg: '#8b5cf618', icon: '💎' },
}

export default function SubscriptionPanel({ onBack, onUpgrade }) {
  const { profile } = useAuthStore()
  const { plan, loading, limits } = useSubscription(profile?.id)
  const [sub, setSub] = useState(null)
  const [payments, setPayments] = useState([])
  const [canceling, setCanceling] = useState(false)

  useEffect(() => {
    if (!profile?.id) return
    supabase.from('subscriptions')
      .select('*')
      .eq('user_id', profile.id)
      .in('status', ['active', 'trial'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => setSub(data))

    supabase.from('payment_history')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setPayments(data || []))
  }, [profile?.id])

  async function cancelSubscription() {
    if (!sub) return
    setCanceling(true)
    await supabase.from('subscriptions')
      .update({ status: 'canceled' })
      .eq('id', sub.id)
    setSub(null)
    setCanceling(false)
  }

  const cfg = PLAN_CFG[plan] || PLAN_CFG.free
  const endDate = sub?.end_date ? new Date(sub.end_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) : null

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', background: C.panel,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>Mi Suscripción</h2>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Plan actual */}
        <div style={{
          background: cfg.bg, border: `1.5px solid ${cfg.color}55`,
          borderRadius: 16, padding: '20px 18px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>{cfg.icon}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color, marginBottom: 4 }}>
            Plan {cfg.label}
          </div>
          {endDate && (
            <div style={{ fontSize: 12, color: C.textDim }}>
              Vence el {endDate}
            </div>
          )}
          {!sub && plan === 'free' && (
            <div style={{ fontSize: 12, color: C.textDim }}>Gratuito · Sin vencimiento</div>
          )}
        </div>

        {/* Límites del plan */}
        <div style={{ background: C.panel, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1px', textTransform: 'uppercase' }}>
              Límites incluidos
            </span>
          </div>
          {[
            ['🌐 Comunidades', limits.comunidades >= 99 ? '∞' : limits.comunidades],
            ['👥 Miembros por comunidad', limits.miembros >= 9999 ? '∞' : limits.miembros],
            ['🏆 Torneos simultáneos', limits.torneos >= 99 ? '∞' : limits.torneos],
            ['⚽ Jugadores por torneo', limits.jugadores >= 9999 ? '∞' : limits.jugadores],
          ].map(([label, val]) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '11px 16px', borderBottom: `1px solid ${C.border}22`, fontSize: 13,
            }}>
              <span style={{ color: C.textDim }}>{label}</span>
              <strong style={{ color: C.text }}>{val}</strong>
            </div>
          ))}
        </div>

        {/* Botones de acción */}
        {plan === 'free' ? (
          <button onClick={onUpgrade} style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
            background: `linear-gradient(135deg, #f59e0b, #8b5cf6)`,
            color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer',
          }}>
            ⭐ Mejorar a VIP o PRO
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onUpgrade} style={{
              flex: 1, padding: '12px', borderRadius: 12, border: `1.5px solid ${cfg.color}`,
              background: cfg.bg, color: cfg.color, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              Cambiar plan
            </button>
            {sub && (
              <button onClick={cancelSubscription} disabled={canceling} style={{
                flex: 1, padding: '12px', borderRadius: 12,
                border: `1.5px solid ${C.border}`,
                background: C.panel, color: C.textDim, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
                {canceling ? 'Cancelando...' : 'Cancelar'}
              </button>
            )}
          </div>
        )}

        {/* Historial de pagos */}
        {payments.length > 0 && (
          <div>
            <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: C.textDim, letterSpacing: '1px', textTransform: 'uppercase' }}>
              Historial de pagos
            </h3>
            <div style={{ background: C.panel, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              {payments.map((p, i) => (
                <div key={p.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', borderBottom: i < payments.length - 1 ? `1px solid ${C.border}22` : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                      Plan {p.plan.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 11, color: C.textDim }}>
                      {new Date(p.created_at).toLocaleDateString('es-AR')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: p.status === 'completed' ? C.green : C.red }}>
                      ${p.amount} {p.currency}
                    </div>
                    <div style={{ fontSize: 10, color: C.textDim, textTransform: 'capitalize' }}>{p.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
