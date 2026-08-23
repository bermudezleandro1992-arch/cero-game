import { useState, useEffect } from 'react'
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
      '✅ Mensajes 1 a 1 ilimitados',
      '✅ Grupos hasta 50 personas',
      '✅ Archivos hasta 10 MB',
      '✅ Llamadas de audio y video (como WhatsApp)',
      '✅ Historias y estados',
      '✅ 1 comunidad básica (hasta 50 miembros)',
      '✅ 1 torneo o liga activo a la vez',
      '❌ Sin estadísticas avanzadas',
      '❌ Sin bots personalizados',
      '❌ Sin panel CEO / admin Pro',
    ],
  },
  {
    id: 'vip',
    name: 'VIP',
    price: '$5',
    priceUSD: 5,
    period: 'por mes',
    emoji: '⭐',
    color: '#f59e0b',
    highlight: true,
    features: [
      '✅ Todo lo del plan Gratis',
      '✅ Grupos hasta 1.000 personas',
      '✅ Hasta 3 comunidades (200 miembros c/u)',
      '✅ Archivos hasta 2 GB',
      '✅ Canales de difusión (como Telegram)',
      '✅ Estadísticas de tus comunidades',
      '✅ Badge VIP ⭐ en tu perfil',
      '✅ Ranking global 🏅',
      '✅ Hasta 3 torneos/ligas simultáneos',
      '✅ Soporte prioritario 24/7',
    ],
    annual: { id: 'vip_anual', price: '$72', save: '25%' },
  },
  {
    id: 'comunidad',
    name: 'Comunidad PRO',
    price: '$15',
    priceUSD: 15,
    period: 'por mes',
    emoji: '🏆',
    color: '#8b5cf6',
    tiers: [
      { label: 'Starter', price: '$15', priceUSD: 15, desc: 'Hasta 500 miembros', id: 'com_starter' },
      { label: 'Growth',  price: '$22', priceUSD: 22, desc: 'Hasta 2.000 miembros', id: 'com_growth' },
      { label: 'Elite',   price: '$35', priceUSD: 35, desc: 'Miembros ilimitados', id: 'com_elite' },
    ],
    features: [
      '✅ Todo lo del plan VIP',
      '✅ Comunidades sin límite de miembros (según tier)',
      '✅ Panel CEO completo 🎛️',
      '✅ Roles y permisos avanzados (CEO, Admin, Org, Mod)',
      '✅ Torneos y ligas ilimitados',
      '✅ Sorteos en vivo 🎰',
      '✅ API completa para bots de torneos',
      '✅ Compartir pantalla grupal (como Discord)',
      '✅ Estadísticas en tiempo real',
      '✅ Badge especial 🏆 y sin publicidad',
      '✅ Acceso anticipado a novedades',
    ],
    annual: { id: 'com_anual', price: '$135', save: '25%' },
  },
]

// Tasas de cambio fijas de respaldo (se actualizan si la API falla)
const FALLBACK_RATES = {
  ARS: 1250,   // Argentina
  MXN: 17.5,   // México
  BRL: 5.75,   // Brasil
  COP: 4200,   // Colombia
  CLP: 980,    // Chile
  UYU: 42,     // Uruguay
  PEN: 3.75,   // Perú
  PYG: 7800,   // Paraguay
}

const PAYMENT_METHODS = [
  {
    id: 'ar_transferencia',
    label: 'Transferencia Argentina',
    emoji: '🇦🇷',
    desc: 'Pesos ARS — CVU/Alias, cualquier banco o billetera',
    color: '#74b9ff',
    available: true,
    manual: true,
    currency: 'ARS',
    currencySymbol: '$',
    currencyLabel: 'ARS',
  },
  {
    id: 'astropay_latam',
    label: 'AstroPay — LATAM',
    emoji: '🌎',
    desc: 'Colombia, Chile, Brasil, Uruguay, Perú, Paraguay + más',
    color: '#a855f7',
    available: true,
    manual: true,
    currency: null, // se elige el país dentro
  },
  {
    id: 'mxn_transfer',
    label: 'Pesos Mexicanos (MXN)',
    emoji: '🇲🇽',
    desc: 'CLABE — Arcus / ARQ Dólar',
    color: '#e17055',
    available: true,
    manual: true,
    currency: 'MXN',
    currencySymbol: '$',
    currencyLabel: 'MXN',
  },
  {
    id: 'crypto',
    label: 'Crypto — USDT',
    emoji: '🟡',
    desc: 'TRC-20, ERC-20, Binance Pay',
    color: '#F3BA2F',
    available: true,
    manual: true,
    currency: 'USD',
  },
  {
    id: 'usd_wire',
    label: 'USD — Wire Transfer',
    emoji: '🇺🇸',
    desc: 'Desde cualquier banco al exterior',
    color: '#00b894',
    available: true,
    manual: true,
    currency: 'USD',
  },
  {
    id: 'mercadopago',
    label: 'Mercado Pago (checkout)',
    emoji: '💳',
    desc: 'Próximamente',
    color: '#009EE3',
    available: false,
  },
]

// Países LATAM para AstroPay
const ASTROPAY_COUNTRIES = [
  { id: 'co', flag: '🇨🇴', name: 'Colombia',  currency: 'COP', symbol: '$',  bank: 'Nequi / Bancolombia', currencyLabel: 'COP' },
  { id: 'cl', flag: '🇨🇱', name: 'Chile',     currency: 'CLP', symbol: '$',  bank: 'Cuenta RUT / banco',  currencyLabel: 'CLP' },
  { id: 'br', flag: '🇧🇷', name: 'Brasil',    currency: 'BRL', symbol: 'R$', bank: 'PIX',                 currencyLabel: 'BRL' },
  { id: 'uy', flag: '🇺🇾', name: 'Uruguay',   currency: 'UYU', symbol: '$',  bank: 'Transferencia',       currencyLabel: 'UYU' },
  { id: 'pe', flag: '🇵🇪', name: 'Perú',      currency: 'PEN', symbol: 'S/', bank: 'Yape / Plin / banco', currencyLabel: 'PEN' },
  { id: 'py', flag: '🇵🇾', name: 'Paraguay',  currency: 'PYG', symbol: '₲',  bank: 'Tigo Money / banco',  currencyLabel: 'PYG' },
]

// 🇦🇷 Argentina — 2 cuentas
const AR_ACCOUNTS = [
  {
    key: 'astropay',
    label: 'AstroPay',
    titular: 'Leandro Bermudez',
    cvu: '0000177500090225090423',
    alias: 'somoslfa',
    banco: 'AstroPay',
  },
  {
    key: 'arq',
    label: 'ARQ Dólar (AR)',
    titular: 'Leandro Bermudez',
    cvu: '0000069703532557685274',
    alias: 'neles.batazo.arq',
    banco: 'Garpa S.A.',
  },
]

// 🇺🇸 USD Wire
const USD_WIRE = {
  titular: 'Leandro Bermudez',
  banco: 'Lead Bank',
  aba: '101019644',
  cuenta: '218096984037',
  tipo: 'Corriente',
  direccion: '1801 Main St, Kansas City, Missouri 64108, EE.UU.',
  comision: '3 USD',
}

// 🇲🇽 MXN
const MXN_DATA = {
  banco: 'Arcus (ARQ Dólar)',
  clabe: '706969130679795077',
  comision: 'Gratis',
  nota: '1 USDc ≈ 17 MXN (varía)',
}

// 🟡 Crypto wallets — organizadas por comisión (menor primero)
const CRYPTO_WALLETS = [
  // ✅ Gratis
  { key: 'polygon_usdt', label: 'USDT — Polygon',        addr: '0x1e53fFCd7A176A1ec293d5e34a97A81265775FcA', red: 'Polygon',          comision: 'Gratis ✅', color: '#8247e5' },
  { key: 'polygon_usdc', label: 'USDc — Polygon',        addr: '0x1e53fFCd7A176A1ec293d5e34a97A81265775FcA', red: 'Polygon',          comision: 'Gratis ✅', color: '#8247e5' },
  { key: 'binance_id',   label: 'Binance Pay (ID)',       addr: '359177674',                                  red: 'Binance Pay',      comision: 'Gratis ✅', color: '#F3BA2F' },
  // 💛 3 USD/USDT comisión
  { key: 'trc20_arq',    label: 'USDT — TRC-20 (ARQ)',   addr: 'TUGgg59HrePJpNmL2Kvj36CJ318cSZMRjS',        red: 'Tron (TRC-20)',    comision: '3 USDT',    color: '#ef4444' },
  { key: 'trc20_bnb',    label: 'USDT — TRC-20 (Binance)',addr: 'TYbzEMciAbyp4L4xrDmG7srnChGhmXAmUq',       red: 'Tron (TRC-20)',    comision: '3 USDT',    color: '#ef4444' },
  { key: 'erc20_usdt',   label: 'USDT — Ethereum',       addr: '0x1e53fFCd7A176A1ec293d5e34a97A81265775FcA', red: 'Ethereum (ERC-20)', comision: '3 USDc',   color: '#ef4444' },
  { key: 'erc20_usdc',   label: 'USDc — Ethereum',       addr: '0x1e53fFCd7A176A1ec293d5e34a97A81265775FcA', red: 'Ethereum (ERC-20)', comision: '3 USDc',   color: '#ef4444' },
]

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
  const [comunidadTier, setComunidadTier] = useState(0) // index into PLANS[2].tiers
  const [annual, setAnnual] = useState(false)
  const [step, setStep] = useState('plans')   // 'plans' | 'payment' | 'manual' | 'success'
  const [payMethod, setPayMethod] = useState(null)
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [txNote, setTxNote] = useState('')
  const [copied, setCopied] = useState(null)
  const [proofFile, setProofFile] = useState(null)
  const [proofPreview, setProofPreview] = useState(null)

  const [rates, setRates] = useState(FALLBACK_RATES)
  const [ratesUpdated, setRatesUpdated] = useState(null)
  const [latamCountry, setLatamCountry] = useState(null)

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(data => {
        if (data?.rates) {
          setRates({
            ARS: data.rates.ARS || FALLBACK_RATES.ARS,
            MXN: data.rates.MXN || FALLBACK_RATES.MXN,
            BRL: data.rates.BRL || FALLBACK_RATES.BRL,
            COP: data.rates.COP || FALLBACK_RATES.COP,
            CLP: data.rates.CLP || FALLBACK_RATES.CLP,
            UYU: data.rates.UYU || FALLBACK_RATES.UYU,
            PEN: data.rates.PEN || FALLBACK_RATES.PEN,
            PYG: data.rates.PYG || FALLBACK_RATES.PYG,
          })
          setRatesUpdated(new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }))
        }
      })
      .catch(() => {}) // usa fallback si falla
  }, [])

  function toLocal(usd, currency) {
    const rate = rates[currency] || 1
    const amount = usd * rate
    if (amount >= 1000) return Math.round(amount).toLocaleString('es')
    return amount.toFixed(2)
  }

  const plan = PLANS.find(p => p.id === selected)
  const activeTier = plan?.tiers ? plan.tiers[comunidadTier] : null
  const activePriceUSD = activeTier ? activeTier.priceUSD : (plan?.priceUSD || 0)
  const planIdToSend = annual && plan?.annual
    ? (activeTier ? activeTier.id + '_anual' : plan.annual.id)
    : (activeTier ? activeTier.id : selected)
  const planUSD = annual
    ? parseFloat((activePriceUSD * 12 * 0.67).toFixed(2))
    : activePriceUSD

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

  function handleProofChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setProofFile(file)
    setProofPreview(URL.createObjectURL(file))
  }

  async function handleManualSubmit() {
    if (!txHash.trim() && !proofFile) return
    setLoading(true)
    try {
      let proofUrl = null
      if (proofFile) {
        const ext = proofFile.name.split('.').pop()
        const path = `payments/${profile.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('result-photos').upload(path, proofFile)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('result-photos').getPublicUrl(path)
          proofUrl = urlData?.publicUrl
        }
      }
      await supabase.from('payments').insert({
        user_id:    profile.id,
        plan:       selected,
        method:     payMethod,
        amount_usd: plan?.priceUSD || 0,
        status:     'pending',
        tx_hash:    txHash.trim() || null,
        raw_data:   { note: txNote, proof_url: proofUrl, submitted_at: new Date().toISOString() },
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

  // ── PASO: PAGO MANUAL ────────────────────────────────────────────────────────
  if (step === 'manual') {
    const pm = PAYMENT_METHODS.find(m => m.id === payMethod)
    const isBinance = payMethod === 'crypto'
    const titles = {
      ar_transferencia: '🇦🇷 Transferencia Argentina',
      usd_wire:         '🇺🇸 Wire Transfer USD',
      mxn_transfer:     '🇲🇽 Pesos Mexicanos',
      crypto:           '🟡 Crypto — USDT / USDc',
    }
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
        <Header onBack={() => setStep('payment')} title={titles[payMethod] || 'Pagar'} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>

          <Section label="Monto a pagar">
            {(() => {
              const pm = PAYMENT_METHODS.find(m => m.id === payMethod)
              const activeCurrency = payMethod === 'astropay_latam' && latamCountry
                ? latamCountry.currency
                : pm?.currency
              const activeSymbol = payMethod === 'astropay_latam' && latamCountry
                ? latamCountry.symbol
                : (activeCurrency === 'ARS' ? '$' : activeCurrency === 'MXN' ? '$' : '')
              const activeLabel = payMethod === 'astropay_latam' && latamCountry
                ? latamCountry.currencyLabel
                : (pm?.currencyLabel || pm?.currency || 'USD')
              const showLocal = activeCurrency && activeCurrency !== 'USD'
              return (
                <div style={{ background: C.panel, border: `1px solid ${plan?.color}44`, borderRadius: 14, padding: '16px', textAlign: 'center' }}>
                  {showLocal ? (
                    <>
                      <div style={{ fontSize: 32, fontWeight: 900, color: plan?.color }}>
                        {activeSymbol} {toLocal(planUSD, activeCurrency)} <span style={{ fontSize: 14 }}>{activeLabel}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>
                        ≈ ${planUSD} USD · {ratesUpdated ? `cotización ${ratesUpdated}` : 'cotización de referencia'}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 32, fontWeight: 900, color: plan?.color }}>
                      ${planUSD} <span style={{ fontSize: 14 }}>USD</span>
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: C.textDim, marginTop: 6 }}>
                    {plan?.emoji} {plan?.name} {annual ? '(anual)' : '(mensual)'}
                  </div>
                </div>
              )
            })()}
          </Section>

          {/* 🇦🇷 ARGENTINA */}
          {payMethod === 'ar_transferencia' && (
            <>
              {AR_ACCOUNTS.map(acc => (
                <Section key={acc.key} label={`Cuenta ${acc.label}`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[['Titular', acc.titular, 'tit_'+acc.key], ['CVU', acc.cvu, 'cvu_'+acc.key], ['Alias', acc.alias, 'ali_'+acc.key], ['Banco', acc.banco, 'ban_'+acc.key]].map(([lbl, val, k]) => (
                      <div key={k} style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 13px' }}>
                        <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>{lbl}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <p style={{ margin: 0, flex: 1, fontSize: 12, color: C.text, fontFamily: (lbl === 'CVU' || lbl === 'Alias') ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{val}</p>
                          {(lbl === 'CVU' || lbl === 'Alias') && (
                            <button onClick={() => copy(val, k)} style={{ background: copied===k?`${C.green}22`:`${C.green}15`, border:`1px solid ${C.green}33`, borderRadius:8, padding:'4px 9px', cursor:'pointer', color:C.green, fontSize:11, fontWeight:700, flexShrink:0 }}>{copied===k?'✓':'📋'}</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              ))}
              <p style={{ fontSize: 12, color: '#74b9ff', lineHeight: 1.6, marginBottom: 16 }}>
                💡 Transferí desde Mercado Pago, Uala, Naranja X, BBVA o cualquier banco/billetera. Usá el alias o el CVU.
              </p>
            </>
          )}

          {/* 🌎 ASTROPAY LATAM */}
          {payMethod === 'astropay_latam' && (
            <>
              <Section label="Seleccioná tu país">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                  {ASTROPAY_COUNTRIES.map(c => (
                    <button key={c.id} onClick={() => setLatamCountry(c)} style={{
                      padding: '10px 6px', borderRadius: 12, border: `1.5px solid ${latamCountry?.id === c.id ? '#a855f7' : C.border}`,
                      background: latamCountry?.id === c.id ? '#a855f720' : C.panel,
                      cursor: 'pointer', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 22 }}>{c.flag}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginTop: 3 }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: C.textDim }}>{c.bank}</div>
                    </button>
                  ))}
                </div>
              </Section>
              {latamCountry && (
                <Section label={`Instrucciones — ${latamCountry.flag} ${latamCountry.name}`}>
                  <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: C.text, fontWeight: 700 }}>Cómo pagar vía AstroPay</p>
                    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.textDim, lineHeight: 1.8 }}>
                      <li>Abrí AstroPay en tu dispositivo</li>
                      <li>Cargá saldo desde {latamCountry.bank}</li>
                      <li>Enviá el monto equivalente a <strong style={{ color: C.text }}>somoslfa</strong> (alias/usuario AstroPay)</li>
                      <li>Subí el comprobante abajo</li>
                    </ol>
                    <div style={{ marginTop: 10, padding: '10px 12px', background: `#a855f715`, border: `1px solid #a855f733`, borderRadius: 10 }}>
                      <p style={{ margin: 0, fontSize: 11, color: C.textDim }}>Monto a enviar</p>
                      <p style={{ margin: '3px 0 0', fontSize: 18, fontWeight: 900, color: '#a855f7' }}>
                        {latamCountry.symbol} {toLocal(planUSD, latamCountry.currency)} {latamCountry.currencyLabel}
                        <span style={{ fontSize: 11, fontWeight: 400, color: C.textDim, marginLeft: 8 }}>≈ ${planUSD} USD</span>
                      </p>
                      {ratesUpdated && <p style={{ margin: '3px 0 0', fontSize: 10, color: C.textDim }}>Cotización actualizada a las {ratesUpdated}</p>}
                    </div>
                  </div>
                </Section>
              )}
            </>
          )}

          {/* 🇺🇸 USD WIRE */}
          {payMethod === 'usd_wire' && (
            <Section label="Datos bancarios — Lead Bank (EE.UU.)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[['Titular', USD_WIRE.titular,'w_tit'],['Banco', USD_WIRE.banco,'w_ban'],['ABA / Routing', USD_WIRE.aba,'w_aba'],['N° de cuenta', USD_WIRE.cuenta,'w_cta'],['Tipo', USD_WIRE.tipo,'w_tip'],['Dirección banco', USD_WIRE.direccion,'w_dir'],['Comisión', USD_WIRE.comision,'w_com']].map(([lbl,val,k]) => (
                  <div key={k} style={{ background: C.panel2, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 13px' }}>
                    <p style={{ margin:'0 0 3px', fontSize:10, fontWeight:700, color:C.textDim, textTransform:'uppercase', letterSpacing:'1px' }}>{lbl}</p>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <p style={{ margin:0, flex:1, fontSize:12, color:C.text, fontFamily:['ABA / Routing','N° de cuenta'].includes(lbl)?'monospace':'inherit', wordBreak:'break-all' }}>{val}</p>
                      {['ABA / Routing','N° de cuenta'].includes(lbl) && (
                        <button onClick={() => copy(val, k)} style={{ background:copied===k?`${C.green}22`:`${C.green}15`, border:`1px solid ${C.green}33`, borderRadius:8, padding:'4px 9px', cursor:'pointer', color:C.green, fontSize:11, fontWeight:700, flexShrink:0 }}>{copied===k?'✓':'📋'}</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ marginTop:10, fontSize:12, color:'#00b894', lineHeight:1.6 }}>⚠️ Comisión de 3 USD cobrada por el banco intermediario.</p>
            </Section>
          )}

          {/* 🇲🇽 MXN */}
          {payMethod === 'mxn_transfer' && (
            <Section label="CLABE — Arcus / ARQ Dólar">
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[['Banco', MXN_DATA.banco,'m_ban'],['CLABE', MXN_DATA.clabe,'m_cla'],['Comisión', MXN_DATA.comision,'m_com'],['Tipo de cambio', MXN_DATA.nota,'m_tc']].map(([lbl,val,k]) => (
                  <div key={k} style={{ background:C.panel2, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 13px' }}>
                    <p style={{ margin:'0 0 3px', fontSize:10, fontWeight:700, color:C.textDim, textTransform:'uppercase', letterSpacing:'1px' }}>{lbl}</p>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <p style={{ margin:0, flex:1, fontSize:12, color:C.text, fontFamily:lbl==='CLABE'?'monospace':'inherit', wordBreak:'break-all' }}>{val}</p>
                      {lbl==='CLABE' && <button onClick={() => copy(val,k)} style={{ background:copied===k?`${C.green}22`:`${C.green}15`, border:`1px solid ${C.green}33`, borderRadius:8, padding:'4px 9px', cursor:'pointer', color:C.green, fontSize:11, fontWeight:700, flexShrink:0 }}>{copied===k?'✓':'📋'}</button>}
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ marginTop:10, fontSize:12, color:'#e17055', lineHeight:1.6 }}>💡 El tipo de cambio puede variar. Enviá el equivalente en MXN al monto USD del plan.</p>
            </Section>
          )}

          {/* 🟡 CRYPTO */}
          {payMethod === 'crypto' && (
            <>
              <p style={{ margin:'0 0 12px', fontSize:12, color:C.textDim, lineHeight:1.6 }}>
                💡 <strong style={{color:C.green}}>Recomendado: Polygon</strong> — comisión gratis. Enviá exactamente el monto en USD equivalente.
              </p>
              <Section label="Wallets disponibles">
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {CRYPTO_WALLETS.map(w => (
                    <div key={w.key} style={{ background:C.panel2, border:`1px solid ${C.border}`, borderRadius:12, padding:'12px 14px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                        <p style={{ margin:0, fontSize:12, fontWeight:700, color:C.text }}>{w.label}</p>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:w.comision.includes('Gratis')?`${C.green}22`:'#f59e0b22', color:w.comision.includes('Gratis')?C.green:'#f59e0b' }}>{w.comision}</span>
                      </div>
                      <p style={{ margin:'0 0 6px', fontSize:10, color:C.textDim }}>Red: {w.red}</p>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <p style={{ margin:0, flex:1, fontSize:11, fontFamily:'monospace', color:C.text, wordBreak:'break-all' }}>{w.addr}</p>
                        <button onClick={() => copy(w.addr, w.key)} style={{ background:copied===w.key?`${C.green}22`:`${C.green}15`, border:`1px solid ${C.green}33`, borderRadius:8, padding:'5px 10px', cursor:'pointer', color:C.green, fontSize:11, fontWeight:700, flexShrink:0 }}>{copied===w.key?'✓':'📋'}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}

          <Section label="Subí tu comprobante">
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, padding: '20px', borderRadius: 14, cursor: 'pointer',
              border: `2px dashed ${proofFile ? C.green : C.border}`,
              background: proofFile ? `${C.green}08` : C.panel,
              marginBottom: 10,
            }}>
              <input type="file" accept="image/*" onChange={handleProofChange} style={{ display: 'none' }} />
              {proofPreview ? (
                <img src={proofPreview} alt="comprobante" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 10, objectFit: 'contain' }} />
              ) : (
                <>
                  <span style={{ fontSize: 36 }}>📸</span>
                  <p style={{ margin: 0, fontSize: 13, color: C.textDim, textAlign: 'center' }}>
                    Tocá para subir foto del comprobante<br/>
                    <span style={{ fontSize: 11 }}>(captura de pantalla, foto, PDF)</span>
                  </p>
                </>
              )}
            </label>

            <input
              value={txHash}
              onChange={e => setTxHash(e.target.value)}
              placeholder={isBinance ? 'Hash de transacción (ej: 0x1a2b3c...)' : 'N° de operación o comprobante (opcional si subís foto)'}
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
              placeholder="Nota opcional (ej: transferí desde Mercado Pago, 17/08/2026)"
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
            disabled={(!txHash.trim() && !proofFile) || loading}
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
                    if (!m.available) return
                    setPayMethod(m.id)
                    setStep('manual')
                  }}
                  disabled={!m.available}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 14,
                    background: C.panel, border: `1.5px solid ${C.border}`,
                    cursor: m.available ? 'pointer' : 'default',
                    textAlign: 'left', opacity: m.available ? 1 : 0.5,
                    transition: 'all .15s',
                  }}
                  onMouseEnter={e => { if (m.available) { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.background = `${m.color}0A` } }}
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
            const tier = p.tiers ? p.tiers[comunidadTier] : null
            const basePrice = tier ? tier.price : p.price
            const basePriceUSD = tier ? tier.priceUSD : (p.priceUSD || 0)
            const displayPrice = annual && p.annual
              ? `$${Math.round(basePriceUSD * 12 * 0.67)}`
              : basePrice
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
                      <span style={{ color: C.textDim, fontSize: 11 }}>{annual && p.annual ? 'por año' : (p.period || 'por mes')}</span>
                    </div>
                  </div>
                </div>

                {/* Tier selector for Comunidad PRO */}
                {p.tiers && isSelected && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }} onClick={e => e.stopPropagation()}>
                    {p.tiers.map((t, i) => (
                      <button key={t.id} onClick={e => { e.stopPropagation(); setComunidadTier(i) }} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 10, border: `1.5px solid ${comunidadTier === i ? p.color : C.border}`,
                        background: comunidadTier === i ? `${p.color}20` : C.panel2, cursor: 'pointer',
                        color: comunidadTier === i ? p.color : C.textDim, fontSize: 11, fontWeight: 700, textAlign: 'center',
                      }}>
                        <div>{t.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: comunidadTier === i ? p.color : C.text }}>{t.price}/mes</div>
                        <div style={{ fontSize: 10, fontWeight: 400, color: C.textDim, marginTop: 1 }}>{t.desc}</div>
                      </button>
                    ))}
                  </div>
                )}

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
              ['🇦🇷', 'Transferencia AR'],
              ['🇺🇸', 'Wire USD'],
              ['🇲🇽', 'Pesos MXN'],
              ['🟡', 'Crypto / USDT'],
              ['💳', 'MP (pronto)'],
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
