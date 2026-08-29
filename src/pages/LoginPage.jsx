import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Capacitor } from '@capacitor/core'

const APK_URL = 'https://drive.google.com/file/d/1WvjWDxj3Dl-bkr7_YkQeJhRCEe5o2xN7/view?usp=drive_link'
const GREEN = '#00d278'

const TERMINOS = `
**1. Quiénes somos**
NexoTribu es una plataforma de mensajería y comunidades orientada al mundo gamer.

**2. Elegibilidad**
Para usar NexoTribu debés tener al menos 18 años, proporcionar información verídica y no estar suspendido previamente.

**3. Tu cuenta**
Sos responsable de toda la actividad que ocurra desde tu cuenta. No podés transferirla a terceros.

**4. Conducta prohibida**
• Contenido ilegal, violento, sexual explícito, racista o discriminatorio
• Acoso, amenazas o intimidación a otros usuarios
• Hacerse pasar por otra persona o entidad
• Spam, malware o enlaces maliciosos
• Fraude o phishing de cualquier tipo
• Intentar acceder a datos de otros usuarios sin autorización
• Contenido que infrinja derechos de autor

**5. Contenido del usuario**
Tu contenido sigue siendo tuyo. Nos otorgás una licencia solo para prestar el servicio. No vendemos tu contenido.

**6. Suspensión y cancelación**
NexoTribu puede suspender cuentas que violen estos términos sin previo aviso. Podés eliminar tu cuenta contactando a soporte.

**7. Planes y pagos**
Las funciones básicas son gratuitas. Los planes VIP/Pro son opcionales. Los pagos no son reembolsables salvo que la ley lo requiera.

**8. Limitación de responsabilidad**
El servicio se provee "tal cual". No garantizamos disponibilidad continua ni ausencia de errores.

**9. Cambios**
Podemos modificar estos términos y te notificaremos por email o dentro de la app.

**10. Contacto**
Soporte disponible dentro de la aplicación.
`

const PRIVACIDAD = `
**1. Datos que recopilamos**
Al registrarte: nombre, email, foto de perfil, fecha de nacimiento y país de origen.
Al usar la app: mensajes, comunidades, actividad general y datos técnicos del dispositivo.

**2. Cómo usamos tus datos**
• Para prestar el servicio de mensajería y comunidades
• Para verificar tu identidad y edad
• Para enviarte notificaciones relevantes
• Para mejorar la plataforma y detectar problemas técnicos
• Para cumplir con obligaciones legales

No vendemos tus datos personales a terceros.

**3. Mensajes privados**
Solo accesibles por los participantes de la conversación. NexoTribu puede acceder solo ante denuncia por violación de Términos o requerimiento judicial.

**4. Terceros**
• Supabase — proveedor de infraestructura y base de datos
• Google — si iniciás sesión con Google aplica su propia política de privacidad
• Autoridades competentes si la ley lo requiere

**5. Seguridad**
Usamos HTTPS, acceso restringido y revisiones periódicas de seguridad.

**6. Retención de datos**
Guardamos tus datos mientras tu cuenta esté activa. Al eliminarla, borramos tus datos en 30 días.

**7. Tus derechos**
Podés acceder, corregir, y solicitar eliminar tus datos en cualquier momento desde Soporte.

**8. Cookies**
Usamos localStorage para mantener tu sesión. No usamos cookies de rastreo publicitario.

**9. Menores de edad**
La plataforma es exclusiva para mayores de 18 años. Eliminamos de inmediato datos de menores.

**10. Contacto**
Soporte disponible dentro de la aplicación.
`

function LegalModal({ initialTab, onClose }) {
  const [tab, setTab] = useState(initialTab || 'terminos')
  const content = tab === 'terminos' ? TERMINOS : PRIVACIDAD

  function renderContent(text) {
    return text.trim().split('\n\n').map((block, i) => {
      if (block.startsWith('**')) {
        const [h, ...rest] = block.split('\n')
        return (
          <div key={i} style={{ marginBottom: 20 }}>
            <div style={{ color: GREEN, fontSize: 15, fontWeight: 700, marginBottom: 8, borderLeft: `3px solid ${GREEN}`, paddingLeft: 12 }}>
              {h.replace(/\*\*/g, '')}
            </div>
            {rest.map((line, j) => (
              <p key={j} style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, margin: '0 0 6px', lineHeight: 1.7, paddingLeft: 15 }}>{line}</p>
            ))}
          </div>
        )
      }
      return <p key={i} style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, margin: '0 0 12px', lineHeight: 1.7 }}>{block}</p>
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#080d12', overflowY: 'auto', padding: '0 0 40px' }}>
      <div style={{ position: 'sticky', top: 0, background: '#080d12', borderBottom: '1px solid rgba(255,255,255,.08)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 1 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          ← Volver
        </button>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.05)', borderRadius: 8, padding: 3 }}>
          {[['terminos', 'Términos de Uso'], ['privacidad', 'Política de Privacidad']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              background: tab === id ? GREEN : 'transparent',
              border: 'none', borderRadius: 6, padding: '5px 12px',
              color: tab === id ? '#fff' : 'rgba(255,255,255,.4)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
            }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <img src="/logo.svg" alt="NexoTribu" width={28} height={28} />
          <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 12 }}>Última actualización: agosto de 2026</span>
        </div>
        {renderContent(content)}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.2)', fontSize: 12, textAlign: 'center' }}>
          © 2026 NexoTribu. Todos los derechos reservados.
        </div>
      </div>
    </div>
  )
}

const TICKER_TEXT = 'Plataforma en desarrollo activo  ·  Registrate gratis y sé parte desde el inicio  ·  NexoTribu  ·  '

export default function LoginPage() {
  const isNative = Capacitor.isNativePlatform()
  const [modal, setModal] = useState(null)
  const tickerRef = useRef(null)

  useEffect(() => {
    const el = tickerRef.current
    if (!el) return
    let pos = 0
    let raf
    const animate = () => {
      pos -= 0.5
      if (pos <= -(el.scrollWidth / 2)) pos = 0
      el.style.transform = `translateX(${pos}px)`
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  async function loginGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  if (modal) return <LegalModal initialTab={modal} onClose={() => setModal(null)} />

  return (
    <div style={{ minHeight: '100dvh', background: '#080d12', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* ── HERO ── */}
      <div style={{ width: '100%', maxWidth: 520, padding: '44px 20px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        <div style={{ marginBottom: 14 }}>
          <svg width="76" height="76" viewBox="0 0 80 80" fill="none">
            <polygon points="40,4 74,22 74,58 40,76 6,58 6,22" fill={`${GREEN}20`} stroke={GREEN} strokeWidth="1.5" />
            <text x="40" y="50" textAnchor="middle" fontSize="30" fontWeight="900" fill={GREEN} fontFamily="system-ui,sans-serif">N</text>
          </svg>
        </div>

        <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 30, margin: '0 0 4px', letterSpacing: '-0.5px', lineHeight: 1.1 }}>NexoTribu</h1>
        <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 11, margin: '0 0 22px', letterSpacing: '2.5px', textTransform: 'uppercase', fontWeight: 600 }}>
          COMPETÍ · CONECTÁ · GANÁ
        </p>

        <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 28, textAlign: 'center', margin: '0 0 10px', lineHeight: 1.25, letterSpacing: '-0.5px' }}>
          Tu comunidad gamer,{' '}
          <span style={{ color: GREEN }}>organizada de verdad.</span>
        </h2>
        <p style={{ color: 'rgba(255,255,255,.45)', fontSize: 14, textAlign: 'center', margin: '0 0 28px', lineHeight: 1.65, maxWidth: 360 }}>
          Mensajería, torneos, comunidades y bots. Todo lo que tu tribu necesita para organizarse y competir.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', marginBottom: 28 }}>
          {[
            { icon: '💬', t: 'Chats que funcionan', d: 'Privados, grupales y de comunidad.' },
            { icon: '🏆', t: 'Torneos integrados', d: 'Creá, inscribite y seguí resultados.' },
            { icon: '🌐', t: 'Comunidades propias', d: 'Con roles, canales y control total.' },
            { icon: '🤖', t: 'Bots y automatización', d: 'API abierta para publicar y notificar.' },
          ].map(f => (
            <div key={f.t} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '14px 12px' }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{f.t}</div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11, lineHeight: 1.5 }}>{f.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TICKER ── */}
      <div style={{ width: '100%', overflow: 'hidden', background: `${GREEN}12`, borderTop: `1px solid ${GREEN}30`, borderBottom: `1px solid ${GREEN}30`, padding: '8px 0', marginBottom: 36 }}>
        <div ref={tickerRef} style={{ display: 'flex', whiteSpace: 'nowrap', willChange: 'transform' }}>
          {[...Array(6)].map((_, i) => (
            <span key={i} style={{ color: GREEN, fontSize: 12, fontWeight: 600, letterSpacing: '.5px' }}>{TICKER_TEXT}</span>
          ))}
        </div>
      </div>

      {/* ── LOGIN ── */}
      <div style={{ width: '100%', maxWidth: 400, padding: '0 20px 52px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 24, margin: '0 0 8px', textAlign: 'center' }}>
          Ingresá a NexoTribu
        </h2>
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 13, textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>
          Usá tu cuenta de Google para entrar o registrarte.
        </p>

        {!isNative && (
          <a href={APK_URL} target="_blank" rel="noreferrer" style={{
            width: '100%', padding: '14px 16px', borderRadius: 13,
            background: GREEN, cursor: 'pointer',
            color: '#fff', fontSize: 15, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: `0 4px 20px ${GREEN}55`, marginBottom: 18,
            textDecoration: 'none', boxSizing: 'border-box',
          }}>
            <span style={{ fontSize: 18 }}>📱</span>
            Descargar para Android (.apk)
          </a>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginBottom: 18 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.1)' }} />
          <span style={{ color: 'rgba(255,255,255,.25)', fontSize: 11, whiteSpace: 'nowrap' }}>o entrá desde el navegador</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.1)' }} />
        </div>

        <button onClick={loginGoogle} style={{
          width: '100%', padding: '13px 16px', borderRadius: 13,
          background: '#fff', border: '1px solid #ddd',
          color: '#333', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          marginBottom: 24, boxSizing: 'border-box',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continuar con Google
        </button>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {[
            { icon: '🔒', t: 'Acceso seguro con Google', d: 'Sin contraseñas que recordar.' },
            { icon: '🔞', t: 'Solo para mayores de 18', d: 'Verificamos tu edad al registrarte.' },
            { icon: '🏆', t: 'Torneos y comunidades', d: 'Organizá, competí y crecé con tu tribu.' },
          ].map(b => (
            <div key={b.t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{b.icon}</span>
              <div>
                <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12, fontWeight: 600 }}>{b.t}</div>
                <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 11 }}>{b.d}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
          <button onClick={() => setModal('terminos')} style={{ background: 'none', border: 'none', padding: 0, color: 'rgba(255,255,255,.3)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
            Términos de Uso
          </button>
          <button onClick={() => setModal('privacidad')} style={{ background: 'none', border: 'none', padding: 0, color: 'rgba(255,255,255,.3)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
            Política de Privacidad
          </button>
        </div>
      </div>
    </div>
  )
}
