import { useState } from 'react'
import { C } from '../theme'
import { useAuthStore } from '../store/authStore'

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
      '✅ Badge VIP en tu perfil ⭐',
      '✅ Encuestas avanzadas',
      '✅ Canales de difusión',
      '✅ Soporte prioritario',
    ],
  },
  {
    id: 'comunidad',
    name: 'Comunidad Pro',
    price: '$9.99',
    period: 'por mes',
    emoji: '🏆',
    color: '#8b5cf6',
    features: [
      '✅ Todo lo del plan VIP',
      '✅ Grupos hasta 10.000 personas',
      '✅ API completa para bots',
      '✅ Panel de administración',
      '✅ Roles y permisos avanzados',
      '✅ Torneos y eventos integrados',
      '✅ Estadísticas en tiempo real',
      '✅ Sin publicidad nunca',
      '✅ Badge especial 🏆',
      '✅ Acceso anticipado a novedades',
    ],
  },
]

const VIP_EXTRAS = [
  { emoji: '🎭', title: 'Temas exclusivos', desc: 'Acceso a packs de temas premium que no están en el plan gratis' },
  { emoji: '🤖', title: 'Bots inteligentes', desc: 'Creá bots con respuestas automáticas, comandos y webhooks' },
  { emoji: '📊', title: 'Estadísticas', desc: 'Métricas detalladas de tu comunidad: actividad, horarios pico, miembros' },
  { emoji: '🔔', title: 'Canales de difusión', desc: 'Enviá mensajes a todos tus seguidores de una vez, como Instagram broadcast' },
  { emoji: '🏆', title: 'Torneos', desc: 'Organizá torneos con brackets, resultados automáticos y premiación' },
  { emoji: '🎨', title: 'Personalización total', desc: 'Logo, banner y colores propios para tu comunidad' },
]

export default function VipPage({ onBack }) {
  const { profile } = useAuthStore()
  const [selected, setSelected] = useState('vip')
  const [showPayment, setShowPayment] = useState(false)

  if (showPayment) {
    const plan = PLANS.find(p => p.id === selected)
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={() => setShowPayment(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>Suscribirse a {plan.name}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 20 }}>
          <span style={{ fontSize: 64 }}>{plan.emoji}</span>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: C.text, fontSize: 22, fontWeight: 800 }}>{plan.name}</div>
            <div style={{ color: plan.color, fontSize: 32, fontWeight: 900, margin: '8px 0 4px' }}>{plan.price}</div>
            <div style={{ color: C.textDim, fontSize: 13 }}>{plan.period}</div>
          </div>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px', width: '100%', maxWidth: 320, textAlign: 'center' }}>
            <div style={{ color: C.textDim, fontSize: 13, lineHeight: 1.6 }}>
              🚀 Los pagos estarán disponibles muy pronto.<br/>
              Dejá tu correo y te avisamos cuando lancemos.
            </div>
            <div style={{ color: C.green, fontWeight: 700, fontSize: 14, marginTop: 12 }}>
              {profile?.username ? `@${profile.username}` : profile?.display_name}
            </div>
            <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>
              Ya registrado en lista de espera ✅
            </div>
          </div>
          <button onClick={() => setShowPayment(false)} style={{
            padding: '12px 32px', borderRadius: 14, border: 'none',
            background: plan.color, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
            Volver a los planes
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>Planes y Membresías</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Hero */}
        <div style={{
          padding: '32px 20px 24px', textAlign: 'center',
          background: `radial-gradient(ellipse at 50% 0%, ${C.green}18 0%, transparent 65%)`,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
          <h1 style={{ margin: '0 0 8px', color: C.text, fontSize: 22, fontWeight: 900 }}>
            Desbloqueá todo el potencial
          </h1>
          <p style={{ margin: 0, color: C.textDim, fontSize: 14, lineHeight: 1.5, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
            La mensajería básica siempre gratis. Los superpoderes, con VIP.
          </p>
        </div>

        {/* Plans */}
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {PLANS.map(plan => (
            <button
              key={plan.id}
              onClick={() => setSelected(plan.id)}
              style={{
                display: 'flex', flexDirection: 'column', textAlign: 'left',
                padding: '18px 18px', borderRadius: 18, cursor: 'pointer',
                background: selected === plan.id ? `${plan.color}10` : C.panel,
                border: `2px solid ${selected === plan.id ? plan.color : C.border}`,
                transition: 'all .2s', position: 'relative', overflow: 'hidden',
              }}
            >
              {plan.highlight && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  background: plan.color, color: '#fff',
                  fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                  letterSpacing: '.5px',
                }}>MÁS POPULAR</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 28 }}>{plan.emoji}</span>
                <div>
                  <div style={{ color: plan.color, fontWeight: 800, fontSize: 17 }}>{plan.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ color: C.text, fontWeight: 900, fontSize: 22 }}>{plan.price}</span>
                    <span style={{ color: C.textDim, fontSize: 12 }}>{plan.period}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ color: f.startsWith('❌') ? C.textDim : C.text, fontSize: 12.5, lineHeight: 1.4 }}>{f}</div>
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* Subscribe button */}
        {selected !== 'free' && (
          <div style={{ padding: '0 16px 16px' }}>
            <button
              onClick={() => setShowPayment(true)}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
                background: PLANS.find(p => p.id === selected)?.color || C.green,
                color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                boxShadow: `0 4px 20px ${PLANS.find(p => p.id === selected)?.color || C.green}40`,
              }}
            >
              Suscribirse al plan {PLANS.find(p => p.id === selected)?.name} →
            </button>
          </div>
        )}

        {/* VIP extras */}
        <div style={{ padding: '8px 16px 32px' }}>
          <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>
            Extras exclusivos VIP
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {VIP_EXTRAS.map(x => (
              <div key={x.title} style={{
                background: C.panel, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: '14px 12px',
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{x.emoji}</div>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 12.5, marginBottom: 4 }}>{x.title}</div>
                <div style={{ color: C.textDim, fontSize: 11, lineHeight: 1.4 }}>{x.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
