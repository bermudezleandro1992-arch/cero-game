import { useState } from 'react'
import { C } from '../theme'

const AMOUNTS = [
  { value: 1,  emoji: '☕', label: 'Un café' },
  { value: 5,  emoji: '🍕', label: 'Una pizza' },
  { value: 10, emoji: '🎮', label: 'Apoyá el juego' },
  { value: 25, emoji: '🚀', label: 'Impulsá el proyecto' },
  { value: 50, emoji: '💎', label: 'Héroe de la comunidad' },
]


export default function DonationsPage({ onBack }) {
  const [selected, setSelected] = useState(5)
  const [custom, setCustom] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [step, setStep] = useState('form') // 'form' | 'thanks'

  const amount = custom ? parseFloat(custom) : selected

  function handleDonate() {
    if (!amount || amount < 1) return
    setStep('thanks')
  }

  if (step === 'thanks') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>Donaciones</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 20, textAlign: 'center' }}>
          <span style={{ fontSize: 72 }}>💚</span>
          <div>
            <div style={{ color: C.text, fontSize: 22, fontWeight: 800, marginBottom: 8 }}>¡Gracias {name || 'amigo'}!</div>
            <div style={{ color: C.textDim, fontSize: 14, lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>
              Tu donación de <strong style={{ color: C.green }}>${amount}</strong> nos ayuda a mantener
              la plataforma gratis y seguir mejorando. 🙏
            </div>
          </div>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px 20px', width: '100%', maxWidth: 300 }}>
            <div style={{ color: C.textDim, fontSize: 12, lineHeight: 1.6 }}>
              🚧 Los pagos estarán disponibles muy pronto.<br />
              Te avisamos cuando esté listo.
            </div>
          </div>
          <button onClick={onBack} style={{
            padding: '12px 32px', borderRadius: 14, border: 'none',
            background: C.green, color: C.bg, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
            Volver al inicio
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
        <span style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>Apoyá el proyecto</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Hero */}
        <div style={{
          padding: '32px 20px 24px', textAlign: 'center',
          background: `radial-gradient(ellipse at 50% 0%, ${C.green}18 0%, transparent 65%)`,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💚</div>
          <h1 style={{ margin: '0 0 8px', color: C.text, fontSize: 21, fontWeight: 900 }}>
            Ayudanos a crecer
          </h1>
          <p style={{ margin: 0, color: C.textDim, fontSize: 13.5, lineHeight: 1.6, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
            NexoTribu es un proyecto independiente.
            Con tu donación pagamos servidores, desarrollo y mantenemos todo gratis para todos.
          </p>
        </div>

        <div style={{ padding: '20px 16px' }}>

          {/* Amount selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>
              ¿Cuánto querés donar?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
              {AMOUNTS.map(a => (
                <button key={a.value} onClick={() => { setSelected(a.value); setCustom('') }} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '12px 8px', borderRadius: 14, cursor: 'pointer',
                  background: selected === a.value && !custom ? `${C.green}18` : C.panel,
                  border: `2px solid ${selected === a.value && !custom ? C.green : C.border}`,
                  transition: 'all .15s',
                }}>
                  <span style={{ fontSize: 22 }}>{a.emoji}</span>
                  <span style={{ color: C.green, fontWeight: 800, fontSize: 15 }}>${a.value}</span>
                  <span style={{ color: C.textDim, fontSize: 10, textAlign: 'center', lineHeight: 1.2 }}>{a.label}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0 12px' }}>
              <span style={{ color: C.textDim, fontWeight: 700, fontSize: 16 }}>$</span>
              <input
                type="number" min="1" max="9999"
                placeholder="Otro monto..."
                value={custom}
                onChange={e => { setCustom(e.target.value); setSelected(null) }}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 15, padding: '12px 0' }}
              />
            </div>
          </div>

          {/* Name & message */}
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="text"
              placeholder="Tu nombre (opcional)"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={40}
              style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', color: C.text, fontSize: 14, outline: 'none' }}
            />
            <textarea
              placeholder="Dejá un mensaje para la comunidad (opcional)..."
              value={msg}
              onChange={e => setMsg(e.target.value)}
              maxLength={140}
              rows={2}
              style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', color: C.text, fontSize: 14, outline: 'none', resize: 'none', lineHeight: 1.5 }}
            />
          </div>

          {/* Donate button */}
          <button
            onClick={handleDonate}
            disabled={!amount || amount < 1}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
              background: amount >= 1 ? C.green : C.panel2,
              color: amount >= 1 ? C.bg : C.textDim,
              fontSize: 15, fontWeight: 800, cursor: amount >= 1 ? 'pointer' : 'not-allowed',
              boxShadow: amount >= 1 ? `0 4px 20px ${C.green}40` : 'none',
              transition: 'all .2s',
              marginBottom: 24,
            }}
          >
            {amount >= 1 ? `💚 Donar $${amount}` : 'Elegí un monto'}
          </button>

        </div>
      </div>
    </div>
  )
}
