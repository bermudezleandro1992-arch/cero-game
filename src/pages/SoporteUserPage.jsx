import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'

const CATEGORIES = [
  { id: 'technical', label: 'Problema técnico', icon: '🔧', desc: 'La app no funciona bien' },
  { id: 'account',   label: 'Mi cuenta',         icon: '👤', desc: 'Acceso, datos, contraseña' },
  { id: 'billing',   label: 'Planes / Pagos',     icon: '💳', desc: 'Suscripción, cobros, VIP' },
  { id: 'other',     label: 'Otro',               icon: '💬', desc: 'Consulta general' },
]

const FAQS = {
  technical: [
    { q: '¿La app no carga?', a: 'Intentá recargar la página con Ctrl+Shift+R. Si persiste, borrá la caché del navegador.' },
    { q: '¿No puedo enviar mensajes?', a: 'Verificá tu conexión a internet. Si el problema sigue, cerrá sesión y volvé a entrar.' },
    { q: '¿Las notificaciones no llegan?', a: 'Revisá que el navegador tenga permisos de notificaciones para esta página en la configuración.' },
  ],
  account: [
    { q: '¿Cómo cambio mi nombre de usuario?', a: 'Andá a Perfil → Editar perfil y cambiá tu nombre de usuario.' },
    { q: '¿Olvidé mi contraseña?', a: 'En la pantalla de login usá "Olvidé mi contraseña" y te llegará un mail de recuperación.' },
    { q: '¿Cómo elimino mi cuenta?', a: 'Contactá a soporte — la eliminación de cuenta se hace manualmente por seguridad.' },
  ],
  billing: [
    { q: '¿Cómo activo VIP?', a: 'Andá a Perfil → Mi cuenta y seleccioná un plan VIP o Pro para desbloquearlo.' },
    { q: '¿Cuánto cuesta VIP?', a: 'Los planes están disponibles en la sección de cuenta. Hay VIP y Pro con diferentes beneficios.' },
    { q: '¿Se puede cancelar el plan?', a: 'Sí, contactá a soporte y procesamos la cancelación en menos de 24h.' },
  ],
  other: [
    { q: '¿Cómo creo una comunidad?', a: 'Andá a Explorar → botón "+" y seguí los pasos para crear tu comunidad.' },
    { q: '¿Cómo creo un torneo?', a: 'Usá el ícono de torneos en la barra de navegación y tocá "Crear torneo".' },
    { q: '¿Cómo invito personas a mi comunidad?', a: 'Desde tu comunidad, tocá el ícono de miembros y usá el enlace de invitación.' },
  ],
}

function BotMsg({ text, delay = 0 }) {
  const [visible, setVisible] = useState(delay === 0)
  useEffect(() => { if (delay > 0) { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t) } }, [delay])
  if (!visible) return null
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-end' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.green, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
      <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: '18px 18px 18px 4px', padding: '10px 14px', maxWidth: '80%', color: C.text, fontSize: 13, lineHeight: 1.5 }}>{text}</div>
    </div>
  )
}

function UserMsg({ text }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
      <div style={{ background: C.green, borderRadius: '18px 18px 4px 18px', padding: '10px 14px', maxWidth: '80%', color: '#fff', fontSize: 13, lineHeight: 1.5 }}>{text}</div>
    </div>
  )
}

export default function SoporteUserPage({ onBack, onTicketCreated, onViewTickets }) {
  const { profile } = useAuthStore()
  const [step, setStep] = useState('categories') // categories | faq | describe | submitting | success
  const [category, setCategory] = useState(null)
  const [openFaq, setOpenFaq] = useState(null)
  const [description, setDescription] = useState('')
  const [ticket, setTicket] = useState(null)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [step, openFaq])

  async function createTicket() {
    if (!description.trim()) return
    setStep('submitting')
    setError('')
    try {
      const { data, error: err } = await supabase.rpc('create_support_ticket', {
        p_category: category,
        p_subject: description.trim().slice(0, 200),
      })
      if (err) throw err
      setTicket(typeof data === 'string' ? JSON.parse(data) : data)
      setStep('success')
      onTicketCreated?.()
    } catch (e) {
      setError('No se pudo crear el ticket. Intentá de nuevo.')
      setStep('describe')
    }
  }

  const cat = CATEGORIES.find(c => c.id === category)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
        <div>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>Soporte NexoTribu</div>
          <div style={{ color: C.green, fontSize: 11 }}>● En línea</div>
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <BotMsg text="¡Hola! Soy el asistente de soporte de NexoTribu 👋 Estoy aquí para ayudarte." />
        <BotMsg text="¿Sobre qué tema necesitás ayuda?" delay={400} />

        {/* Category selection */}
        {step === 'categories' && (
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} ref={bottomRef}>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => { setCategory(c.id); setStep('faq') }} style={{
                background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: '12px 10px', cursor: 'pointer', textAlign: 'left',
                transition: 'all .15s', color: C.text,
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.green}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
              >
                <div style={{ fontSize: 22, marginBottom: 4 }}>{c.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{c.label}</div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{c.desc}</div>
              </button>
            ))}
          </div>
        )}

        {/* FAQ step */}
        {(step === 'faq' || step === 'describe') && cat && (
          <>
            <UserMsg text={`${cat.icon} ${cat.label}`} />
            <BotMsg text={`Entendido. Aquí hay algunas respuestas frecuentes sobre "${cat.label}":`} delay={200} />

            <div style={{ marginTop: 8, marginBottom: 12 }}>
              {FAQS[category]?.map((faq, i) => (
                <div key={i} style={{ marginBottom: 6, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
                    width: '100%', background: C.panel, border: 'none', cursor: 'pointer',
                    padding: '10px 14px', textAlign: 'left', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', color: C.text, fontSize: 13, fontWeight: 600, gap: 8,
                  }}>
                    <span>{faq.q}</span>
                    <span style={{ color: C.textDim, fontSize: 12, flexShrink: 0 }}>{openFaq === i ? '▲' : '▼'}</span>
                  </button>
                  {openFaq === i && (
                    <div style={{ padding: '10px 14px', background: C.panel2, color: C.textDim, fontSize: 13, lineHeight: 1.5, borderTop: `1px solid ${C.border}` }}>{faq.a}</div>
                  )}
                </div>
              ))}
            </div>

            {step === 'faq' && (
              <>
                <BotMsg text="¿Pudiste resolver tu problema? Si no, puedo conectarte con un agente." delay={300} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }} ref={bottomRef}>
                  <button onClick={onBack} style={{ flex: 1, padding: '10px', borderRadius: 20, border: `1.5px solid ${C.border}`, background: 'transparent', color: C.textDim, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    ✓ Se resolvió
                  </button>
                  <button onClick={() => setStep('describe')} style={{ flex: 1, padding: '10px', borderRadius: 20, border: `1.5px solid ${C.green}`, background: C.green, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    Hablar con un agente
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* Describe step */}
        {step === 'describe' && (
          <>
            <BotMsg text="Perfecto. Describí brevemente tu problema y un agente te va a responder a la brevedad." delay={200} />
            <div style={{ marginTop: 12 }} ref={bottomRef}>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describí tu consulta o problema..."
                maxLength={500}
                style={{
                  width: '100%', minHeight: 100, background: C.panel2, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: 12, color: C.text, fontSize: 13, resize: 'vertical',
                  outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ color: C.textDim, fontSize: 11 }}>{description.length}/500</span>
                {error && <span style={{ color: '#ef4444', fontSize: 12 }}>{error}</span>}
              </div>
              <button
                onClick={createTicket}
                disabled={!description.trim()}
                style={{
                  width: '100%', marginTop: 8, padding: '12px', borderRadius: 12,
                  background: description.trim() ? C.green : C.border,
                  border: 'none', color: description.trim() ? '#fff' : C.textDim,
                  fontWeight: 700, fontSize: 14, cursor: description.trim() ? 'pointer' : 'default',
                  transition: 'all .15s',
                }}
              >
                Enviar consulta →
              </button>
            </div>
          </>
        )}

        {/* Submitting */}
        {step === 'submitting' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <div style={{ width: 24, height: 24, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          </div>
        )}

        {/* Success */}
        {step === 'success' && ticket && (
          <>
            <UserMsg text={description} />
            <BotMsg text="¡Gracias! Tu consulta fue recibida correctamente." delay={300} />
            <div style={{ margin: '12px 0 4px 42px', background: `${C.green}15`, border: `1.5px solid ${C.green}40`, borderRadius: 14, padding: '16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: 1, marginBottom: 4 }}>TICKET CREADO</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: -1 }}>{ticket.ticket_number || ticket.ticket_no}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 6, lineHeight: 1.5 }}>
                Un agente te va a responder a la brevedad. Para ver el estado de tu ticket tocá <strong>"Ver mis tickets"</strong> aquí abajo.
              </div>
            </div>
            <BotMsg text="¿Hay algo más en lo que pueda ayudarte?" delay={800} />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }} ref={bottomRef}>
              <button onClick={onViewTickets} style={{ width: '100%', padding: '11px', borderRadius: 20, border: 'none', background: C.green, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Ver mis tickets →
              </button>
              <button onClick={onBack} style={{ width: '100%', padding: '10px', borderRadius: 20, border: `1.5px solid ${C.border}`, background: 'transparent', color: C.textDim, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Volver al inicio
              </button>
            </div>
          </>
        )}

        <div ref={bottomRef} />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
