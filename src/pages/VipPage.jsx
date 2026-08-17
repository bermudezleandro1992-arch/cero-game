import { useState } from 'react'
import { C } from '../theme'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

const PLANS = [
  {
    id: 'free',
    name: 'Gratis',
    price: '$0',
    period: 'para siempre',
    emoji: '🆓',
    color: '#6b7280',
    features: [
      '✅ Mensajes ilimitados',
      '✅ Chats 1 a 1',
      '✅ Grupos hasta 50 personas',
      '✅ Archivos hasta 10 MB',
      '✅ Llamadas de audio y video',
      '✅ Historias',
      '❌ Sin comunidades avanzadas',
      '❌ Sin bots personalizados',
      '❌ Sin estadísticas',
    ],
  },
  {
    id: 'vip',
    name: 'VIP',
    price: '$4.99',
    priceUSD: 4.99,
    period: 'por mes',
    emoji: '⭐',
    color: '#f59e0b',
    highlight: true,
    features: [
      '✅ Todo lo del plan Gratis',
      '✅ Grupos hasta 1.000 personas',
      '✅ Comunidades ilimitadas',
      '✅ Archivos hasta 2 GB',
      '✅ Bots personalizados',
      '✅ Estadísticas de comunidades',
      '✅ Badge VIP ⭐ visible en tu perfil',
      '✅ Mensajes temporales avanzados',
      '✅ Canales de difusión',
      '✅ Soporte prioritario',
    ],
    annual: { id: 'vip_anual', price: '$39.99', save: '33%' },
  },
  {
    id: 'comunidad',
    name: 'Comunidad Pro',
    price: '$9.99',
    priceUSD: 9.99,
    period: 'por mes',
    emoji: '🏆',
    color: '#8b5cf6',
    features: [
      '✅ Todo lo del plan VIP',
      '✅ Grupos hasta 10.000 personas',
      '✅ API completa para bots',
      '✅ Panel de administración Pro',
      '✅ Roles y permisos avanzados',
      '✅ Torneos y eventos integrados',
      '✅ Estadísticas en tiempo real',
      '✅ Sin publicidad nunca',
      '✅ Badge especial 🏆',
      '✅ Acceso anticipado a novedades',
    ],
    annual: { id: 'com_anual', price: '$79.99', save: '33%' },
  },
]

const PAYMENT_METHODS = [
  {
    id: 'mercadopago',
    label: 'Mercado Pago',
    emoji: '💳',
    desc: 'Tarjeta, débito, saldo MP, cuotas',
    color: '#009EE3',
    available: true,
  },
  {
    id: 'binance',
    label: 'Binance Pay / Crypto',
    emoji: '🟡',
    desc: 'USDT, BNB, BTC, ETH y más',
    color: '#F3BA2F',
    available: true,
    manual: true,
  },
  {
    id: 'astropay',
    label: 'AstroPay',
    emoji: '🌟',
    desc: 'Tarjeta prepaga virtual',
    color: '#FF6B35',
    available: true,
    manual: true,
  },
  {
    id: 'transferencia',
    label: 'Transferencia bancaria',
    emoji: '🏦',
    desc: 'CBU / CVU / Alias — Argentina',
    color: '#3b82f6',
    available: true,
    manual: true,
  },
]

const BINANCE_ADDRESS = {
  USDT_TRC20: 'TU_WALLET_USDT_TRC20',   // ← reemplazá con tu wallet TRC-20
  BINANCE_ID: 'TU_BINANCE_ID',           // ← reemplazá con tu Binance ID
}

const BANK_DATA = {
  titular: 'Leandro Bermudez',
  cbu:     'TU_CBU_ACÁ',      // ← reemplazá
  alias:   'TU.ALIAS.ACÁ',    // ← reemplazá
  banco:   'Banco / Billetera (ej: Mercado Pago, BBVA, Uala)',
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>{label}</p>
      {children}
    </div>
  )
}

export default function VipPage({ onBack }) {
  const { profile } = useAuthStore()
  const [selected, setSelected] = useState('vip')
  const [annual, setAnnual] = useState(false)
  const [step, setStep] = useState('plans')   // 'plans' | 'payment' | 'manual' | 'success'
  const [payMethod, setPayMethod] = useState(null)
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [txNote, setTxNote] = useState('')
  const [copied, setCopied] = useState(null)

  const plan = PLANS.find(p => p.id === selected)
  const planIdToSend = annual && plan?.annual ? plan.annual.id : selected

  async function handleMercadoPago() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mp-create-preference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          plan_id:    planIdToSend,
          user_id:    profile.id,
          user_email: profile.email || '',
        }),
      })
      const data = await res.json()
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        alert('Error al generar el pago. Intentá de nuevo.')
      }
    } catch {
      alert('Error de conexión. Revisá tu internet.')
    }
    setLoading(false)
  }

  async function handleManualSubmit() {
    if (!txHash.trim()) return
    setLoading(true)
    try {
      await supabase.from('payments').insert({
        user_id:   profile.id,
        plan:      selected,
        method:    payMethod,
        amount_usd: plan?.priceUSD || 0,
        status:    'pending',
        tx_hash:   txHash.trim(),
        raw_data:  { note: txNote, submitted_at: new Date().toISOString() },
      })
      setStep('success')
    } catch {
      alert('Error al enviar. Intentá de nuevo.')
    }
    setLoading(false)
  }

  async function copy(text, key) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  // ── PASO: ÉXITO MANUAL ──────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
        <Header onBack={() => setStep('plans')} title="Pago enviado" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 72 }}>✅</div>
          <h2 style={{ margin: 0, color: C.text, fontSize: 20, fontWeight: 800 }}>¡Comprobante enviado!</h2>
          <p style={{ margin: 0, color: C.textDim, fontSize: 14, lineHeight: 1.6, maxWidth: 300 }}>
            Un admin verificará tu pago en las próximas <strong style={{ color: C.green }}>24 horas</strong>. Te llegará una notificación cuando tu plan esté activo.
          </p>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', width: '100%', maxWidth: 300 }}>
            <p style={{ margin: 0, fontSize: 12, color: C.textDim }}>Plan solicitado</p>
            <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 800, color: plan?.color }}>{plan?.emoji} {plan?.name}</p>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: C.textDim }}>TX: <span style={{ color: C.text, fontFamily: 'monospace', fontSize: 11 }}>{txHash.slice(0, 20)}...</span></p>
          </div>
          <button onClick={() => { setStep('plans'); setTxHash(''); setTxNote('') }} style={{
            padding: '12px 32px', borderRadius: 14, border: 'none',
            background: C.green, color: C.bg, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>Volver</button>
        </div>
      </div>
    )
  }

  // ── PASO: PAGO MANUAL (Binance / AstroPay) ───────────────────────────────────
  if (step === 'manual') {
    const isBinance = payMethod === 'binance'
    const isTransfer = payMethod === 'transferencia'
    const methodLabel = isBinance ? 'Binance' : isTransfer ? 'Transferencia bancaria' : 'AstroPay'
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
        <Header onBack={() => setStep('payment')} title={`Pagar con ${methodLabel}`} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>

          <Section label="Monto a pagar">
            <div style={{ background: C.panel, border: `1px solid ${plan?.color}44`, borderRadius: 14, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: plan?.color }}>
                ${annual && plan?.annual ? plan.annual.price.replace('$','') : plan?.priceUSD} USD
              </div>
              <div style={{ fontSize: 13, color: C.textDim, marginTop: 4 }}>
                {plan?.emoji} {plan?.name} {annual ? '(anual)' : '(mensual)'}
              </div>
            </div>
          </Section>

          {isBinance && (
            <Section label="Enviá el pago a">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['💛 USDT (TRC-20)', BINANCE_ADDRESS.USDT_TRC20, 'usdt'],
                  ['🔶 Binance ID', BINANCE_ADDRESS.BINANCE_ID, 'bid'],
                ].map(([label, addr, key]) => (
                  <div key={key} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: C.text2 }}>{label}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ margin: 0, flex: 1, fontSize: 11, fontFamily: 'monospace', color: C.text, wordBreak: 'break-all' }}>{addr}</p>
                      <button onClick={() => copy(addr, key)} style={{
                        background: copied === key ? `${C.green}22` : `${C.green}15`, border: `1px solid ${C.green}33`,
                        borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: C.green, fontSize: 11, fontWeight: 700, flexShrink: 0,
                      }}>{copied === key ? '✓' : '📋'}</button>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 10, fontSize: 11, color: '#f59e0b', lineHeight: 1.5 }}>
                ⚠️ Enviá <strong>exactamente</strong> el monto indicado en USD. Usá la red TRC-20 para USDT (comisión mínima).
              </p>
            </Section>
          )}

          {!isBinance && !isTransfer && (
            <Section label="Instrucciones AstroPay">
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px', lineHeight: 1.7, fontSize: 13, color: C.text2 }}>
                <p style={{ margin: '0 0 6px' }}>1. Cargá tu tarjeta AstroPay con el monto exacto en USD</p>
                <p style={{ margin: '0 0 6px' }}>2. Enviá el pago al email: <strong style={{ color: C.green }}>pagos@mimensajero.com</strong></p>
                <p style={{ margin: 0 }}>3. Pegá el comprobante o código de transacción abajo</p>
              </div>
            </Section>
          )}

          {isTransfer && (
            <Section label="Datos bancarios">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['Titular', BANK_DATA.titular, 'titular'],
                  ['CBU / CVU', BANK_DATA.cbu, 'cbu'],
                  ['Alias', BANK_DATA.alias, 'alias'],
                  ['Banco', BANK_DATA.banco, 'banco'],
                ].map(([label, val, key]) => (
                  <div key={key} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ margin: 0, flex: 1, fontSize: 13, color: C.text, fontFamily: key === 'cbu' || key === 'alias' ? 'monospace' : 'inherit' }}>{val}</p>
                      {(key === 'cbu' || key === 'alias') && (
                        <button onClick={() => copy(val, key)} style={{
                          background: copied === key ? `${C.green}22` : `${C.green}15`, border: `1px solid ${C.green}33`,
                          borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: C.green, fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}>{copied === key ? '✓' : '📋'}</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 10, fontSize: 12, color: '#3b82f6', lineHeight: 1.5 }}>
                💡 Transferí desde cualquier banco o billetera (Mercado Pago, Uala, Naranja X, etc.). El importe debe coincidir exactamente.
              </p>
            </Section>
          )}

          <Section label="Confirmá tu pago">
            <input
              value={txHash}
              onChange={e => setTxHash(e.target.value)}
              placeholder={isBinance ? 'Hash de transacción (ej: 0x1a2b3c...)' : isTransfer ? 'Número de comprobante de transferencia' : 'Código o número de transacción'}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: C.panel2, border: `1px solid ${txHash ? C.green : C.border}`,
                borderRadius: 10, padding: '12px 14px', color: C.text, fontSize: 13,
                outline: 'none', marginBottom: 10, fontFamily: 'monospace',
              }}
            />
            <textarea
              value={txNote}
              onChange={e => setTxNote(e.target.value)}
              placeholder="Nota opcional (ej: enviado desde Binance app, 15/08/2026)"
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: C.panel2, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 12,
                outline: 'none', resize: 'none', fontFamily: 'inherit',
              }}
            />
          </Section>

          <button
            onClick={handleManualSubmit}
            disabled={!txHash.trim() || loading}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
              background: !txHash.trim() ? C.panel2 : plan?.color || C.green,
              color: !txHash.trim() ? C.textDim : '#fff',
              fontSize: 15, fontWeight: 800, cursor: !txHash.trim() ? 'default' : 'pointer',
              marginBottom: 32,
            }}
          >
            {loading ? 'Enviando...' : '📤 Enviar comprobante'}
          </button>
        </div>
      </div>
    )
  }

  // ── PASO: ELEGIR MÉTODO DE PAGO ─────────────────────────────────────────────
  if (step === 'payment') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
        <Header onBack={() => setStep('plans')} title="Elegí cómo pagar" />
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>

          {/* Resumen del plan */}
          <div style={{
            background: `${plan?.color}10`, border: `1.5px solid ${plan?.color}44`,
            borderRadius: 16, padding: '16px 18px', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <span style={{ fontSize: 36 }}>{plan?.emoji}</span>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: plan?.color }}>{plan?.name}</p>
              <p style={{ margin: '3px 0 0', fontSize: 20, fontWeight: 900, color: C.text }}>
                {annual && plan?.annual ? plan.annual.price : plan?.price}
                <span style={{ fontSize: 12, fontWeight: 400, color: C.textDim, marginLeft: 6 }}>{annual ? 'por año' : 'por mes'}</span>
              </p>
              {annual && plan?.annual && (
                <span style={{ fontSize: 11, fontWeight: 700, color: C.green, background: `${C.green}18`, borderRadius: 6, padding: '2px 8px' }}>
                  Ahorrás {plan.annual.save}
                </span>
              )}
            </div>
          </div>

          <Section label="Método de pago">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    setPayMethod(m.id)
                    if (m.id === 'mercadopago') handleMercadoPago()
                    else setStep('manual')
                  }}
                  disabled={loading && payMethod === m.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 14,
                    background: C.panel, border: `1.5px solid ${C.border}`,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.background = `${m.color}0A` }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.panel }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: `${m.color}18`, border: `1px solid ${m.color}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22,
                  }}>{m.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: C.text }}>{m.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textDim }}>{m.desc}</p>
                  </div>
                  {loading && payMethod === m.id ? (
                    <div style={{ width: 18, height: 18, border: `2px solid ${C.border}`, borderTopColor: m.color, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
              ))}
            </div>
          </Section>

          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', marginTop: 8 }}>
            <p style={{ margin: 0, fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
              🔒 Pago 100% seguro. Para Mercado Pago: procesado directamente por MP, nunca guardamos tu tarjeta. Para crypto: verificación manual en menos de 24hs.
            </p>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── PASO: PLANES ────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <Header onBack={onBack} title="Planes y Membresías" />

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Hero */}
        <div style={{
          padding: '28px 20px 20px', textAlign: 'center',
          background: `radial-gradient(ellipse at 50% 0%, ${C.green}18 0%, transparent 65%)`,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>⭐</div>
          <h1 style={{ margin: '0 0 8px', color: C.text, fontSize: 21, fontWeight: 900 }}>
            Desbloqueá todo el potencial
          </h1>
          <p style={{ margin: '0 0 16px', color: C.textDim, fontSize: 13, lineHeight: 1.5, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
            La mensajería básica siempre gratis. Los superpoderes, con VIP.
          </p>

          {/* Toggle mensual / anual */}
          <div style={{ display: 'inline-flex', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: 3 }}>
            {[false, true].map(isAnnual => (
              <button key={String(isAnnual)} onClick={() => setAnnual(isAnnual)} style={{
                padding: '6px 18px', borderRadius: 18, border: 'none', cursor: 'pointer',
                background: annual === isAnnual ? C.green : 'transparent',
                color: annual === isAnnual ? C.bg : C.textDim,
                fontSize: 12, fontWeight: 700, transition: 'all .2s',
              }}>
                {isAnnual ? '🗓 Anual (-33%)' : 'Mensual'}
              </button>
            ))}
          </div>
        </div>

        {/* Plan actual del usuario */}
        {profile?.plan && profile.plan !== 'free' && (
          <div style={{ margin: '16px 16px 0', background: `${C.green}10`, border: `1px solid ${C.green}33`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.green }}>Plan activo: {profile.plan.toUpperCase()}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textDim }}>Podés cambiar o renovar tu plan abajo</p>
            </div>
          </div>
        )}

        {/* Plans */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PLANS.map(p => {
            const isSelected = selected === p.id
            const displayPrice = annual && p.annual ? p.annual.price : p.price
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                style={{
                  display: 'flex', flexDirection: 'column', textAlign: 'left',
                  padding: '16px 18px', borderRadius: 18, cursor: 'pointer',
                  background: isSelected ? `${p.color}10` : C.panel,
                  border: `2px solid ${isSelected ? p.color : C.border}`,
                  transition: 'all .2s', position: 'relative', overflow: 'hidden',
                }}
              >
                {p.highlight && (
                  <div style={{ position: 'absolute', top: 12, right: 12, background: p.color, color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>
                    MÁS POPULAR
                  </div>
                )}
                {annual && p.annual && (
                  <div style={{ position: 'absolute', top: p.highlight ? 36 : 12, right: 12, background: '#10b981', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>
                    -{p.annual.save}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 26 }}>{p.emoji}</span>
                  <div>
                    <div style={{ color: p.color, fontWeight: 800, fontSize: 16 }}>{p.name}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ color: C.text, fontWeight: 900, fontSize: 20 }}>{displayPrice}</span>
                      <span style={{ color: C.textDim, fontSize: 11 }}>{annual && p.annual ? 'por año' : p.period}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ color: f.startsWith('❌') ? C.textDim : C.text2, fontSize: 12.5, lineHeight: 1.4 }}>{f}</div>
                  ))}
                </div>
              </button>
            )
          })}
        </div>

        {/* CTA */}
        {selected !== 'free' && (
          <div style={{ padding: '0 16px 20px' }}>
            <button
              onClick={() => setStep('payment')}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
                background: plan?.color || C.green,
                color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                boxShadow: `0 4px 20px ${plan?.color || C.green}40`,
              }}
            >
              Suscribirme a {plan?.name} →
            </button>
            <p style={{ textAlign: 'center', margin: '10px 0 0', fontSize: 11, color: C.textDim }}>
              🔒 Pago seguro · Cancelá cuando quieras · Soporte 24/7
            </p>
          </div>
        )}

        {/* Métodos de pago aceptados */}
        <div style={{ padding: '0 16px 28px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '1px', textTransform: 'uppercase' }}>Métodos de pago aceptados</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              ['💳', 'Mercado Pago'],
              ['🟡', 'Binance Pay'],
              ['🌟', 'AstroPay'],
              ['💰', 'USDT / Crypto'],
              ['🏦', 'Transferencia'],
            ].map(([emoji, label]) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: C.panel, border: `1px solid ${C.border}`,
                borderRadius: 20, padding: '5px 12px',
                fontSize: 12, color: C.text2,
              }}>
                <span>{emoji}</span>{label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Header({ onBack, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
      </button>
      <span style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>{title}</span>
    </div>
  )
}
