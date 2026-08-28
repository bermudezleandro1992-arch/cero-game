import { useState } from 'react'
import { supabase } from '../lib/supabase'

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
          <div key={i} style={{ marginBottom:20 }}>
            <div style={{ color:'#00d278', fontSize:15, fontWeight:700, marginBottom:8, borderLeft:'3px solid #00d278', paddingLeft:12 }}>{h.replace(/\*\*/g,'')}</div>
            {rest.map((line, j) => <p key={j} style={{ color:'rgba(255,255,255,.6)', fontSize:14, margin:'0 0 6px', lineHeight:1.7, paddingLeft:15 }}>{line}</p>)}
          </div>
        )
      }
      return <p key={i} style={{ color:'rgba(255,255,255,.6)', fontSize:14, margin:'0 0 12px', lineHeight:1.7 }}>{block}</p>
    })
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'#080d12', overflowY:'auto', padding:'0 0 40px' }}>
      {/* Header */}
      <div style={{ position:'sticky', top:0, background:'#080d12', borderBottom:'1px solid rgba(255,255,255,.08)', padding:'12px 20px', display:'flex', alignItems:'center', gap:12, zIndex:1 }}>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,.08)', border:'none', borderRadius:8, padding:'6px 14px', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
          ← Volver
        </button>
        {/* Tabs */}
        <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,.05)', borderRadius:8, padding:3 }}>
          {[['terminos','Términos de Uso'],['privacidad','Política de Privacidad']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              background: tab === id ? '#00d278' : 'transparent',
              border:'none', borderRadius:6, padding:'5px 12px',
              color: tab === id ? '#fff' : 'rgba(255,255,255,.4)',
              fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s',
            }}>{label}</button>
          ))}
        </div>
      </div>
      {/* Content */}
      <div style={{ maxWidth:640, margin:'0 auto', padding:'28px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:24 }}>
          <img src="/logo.svg" alt="NexoTribu" width={28} height={28} />
          <span style={{ color:'rgba(255,255,255,.4)', fontSize:12 }}>Última actualización: agosto de 2026</span>
        </div>
        {renderContent(content)}
        <div style={{ marginTop:40, paddingTop:20, borderTop:'1px solid rgba(255,255,255,.08)', color:'rgba(255,255,255,.2)', fontSize:12, textAlign:'center' }}>
          © 2026 NexoTribu. Todos los derechos reservados.
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [modal, setModal] = useState(null) // 'terminos' | 'privacidad' | null

  if (modal) return <LegalModal initialTab={modal} onClose={() => setModal(null)} />

  async function loginGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600;700&display=swap');
        html, body { margin:0; padding:0; background:#080d12; }
        * { box-sizing:border-box; }
        .login-root { display:flex; background:#080d12; font-family:'Inter',sans-serif; }
        .hero { flex:1; display:flex; flex-direction:column; justify-content:center; padding:60px 64px; position:relative; overflow:hidden; min-width:0; min-height:100dvh; }
        .form-col { width:400px; flex-shrink:0; display:flex; flex-direction:column; justify-content:center; padding:48px 40px; background:#0e1419; border-left:1px solid rgba(255,255,255,.06); min-height:100dvh; }
        .feat-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:32px; max-width:520px; }
        .feat-card { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:16px; transition:border-color .2s,background .2s; }
        .feat-card:hover { border-color:rgba(0,210,120,.3); background:rgba(0,210,120,.04); }
        .glow-btn { width:100%; padding:15px; border-radius:12px; background:#fff; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:12px; font-family:'Inter',sans-serif; font-size:15px; font-weight:700; color:#111; transition:transform .15s,box-shadow .15s; }
        .glow-btn:hover { transform:translateY(-1px); box-shadow:0 8px 32px rgba(0,210,120,.25); }
        .glow-btn:active { transform:translateY(0); }
        .apk-btn { width:100%; padding:13px; border-radius:12px; background:transparent; border:1.5px solid rgba(0,210,120,.4); cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px; font-family:'Inter',sans-serif; font-size:14px; font-weight:600; color:#00d278; transition:all .15s; text-decoration:none; margin-top:10px; }
        .apk-btn:hover { background:rgba(0,210,120,.08); border-color:#00d278; }
        @media (max-width:860px) {
          .login-root { flex-direction:column; }
          .hero { min-height:auto; padding:32px 20px 24px; justify-content:flex-start; }
          .form-col { width:100%; min-height:auto; padding:24px 20px 52px; border-left:none; border-top:1px solid rgba(255,255,255,.06); justify-content:flex-start; }
          .feat-grid { margin-top:16px; max-width:100%; }
        }
        @media (max-width:600px) {
          .feat-grid { grid-template-columns:1fr 1fr; gap:8px; }
          .hero { padding:20px 16px 20px; }
          .form-col { padding:20px 16px 44px; }
          .feat-card { padding:12px; }
          .glow-btn { padding:14px; font-size:14px; }
          .apk-btn { padding:12px; font-size:13px; }
        }
      `}</style>

      <div className="login-root">
        {/* ── HERO ── */}
        <div className="hero">
          <div style={{ position:'absolute', top:-120, left:-80, width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(0,210,120,.07) 0%,transparent 70%)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:-80, right:-40, width:360, height:360, borderRadius:'50%', background:'radial-gradient(circle,rgba(0,150,255,.05) 0%,transparent 70%)', pointerEvents:'none' }} />

          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:'clamp(20px,4vw,48px)' }}>
            <img src="/logo.svg" alt="NexoTribu" width={48} height={48} />
            <div>
              <div style={{ fontFamily:'Rajdhani,sans-serif', color:'#fff', fontWeight:700, fontSize:22, letterSpacing:'.5px' }}>NexoTribu</div>
              <div style={{ color:'rgba(255,255,255,.35)', fontSize:10, letterSpacing:'2.5px', textTransform:'uppercase' }}>COMPETÍ · CONECTÁ · GANÁ</div>
            </div>
          </div>

          <h1 style={{ fontFamily:'Rajdhani,sans-serif', color:'#fff', fontSize:'clamp(38px,5.5vw,68px)', fontWeight:700, lineHeight:1.0, margin:'0 0 20px', maxWidth:560, letterSpacing:'-0.5px', textWrap:'balance' }}>
            Tu comunidad gamer,<br />
            <span style={{ color:'#00d278', fontWeight:700 }}>organizada de verdad.</span>
          </h1>
          <p style={{ color:'rgba(255,255,255,.5)', fontSize:16, margin:0, maxWidth:420, lineHeight:1.7 }}>
            Mensajería, torneos, comunidades y bots. Todo lo que tu tribu necesita para organizarse y competir.
          </p>

          <div className="feat-grid">
            {[
              { icon:'💬', t:'Chats que funcionan',  d:'Privados, grupales y de comunidad. Sin límite de miembros.' },
              { icon:'🏆', t:'Torneos integrados',   d:'Creá, inscribite y seguí los resultados desde la app.' },
              { icon:'🌐', t:'Comunidades propias',  d:'Con roles, canales y control total para el admin.' },
              { icon:'🤖', t:'Bots y automatización',d:'API abierta para que tu bot publique, notifique y juegue.' },
            ].map(f => (
              <div key={f.t} className="feat-card">
                <div className="feat-card-icon" style={{ fontSize:22, marginBottom:8 }}>{f.icon}</div>
                <div>
                  <div style={{ color:'#fff', fontWeight:700, fontSize:13, marginBottom:4 }}>{f.t}</div>
                  <div style={{ color:'rgba(255,255,255,.4)', fontSize:12, lineHeight:1.5 }}>{f.d}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop:'clamp(16px,3vw,36px)', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#00d278', boxShadow:'0 0 8px #00d278' }} />
            <span style={{ color:'rgba(255,255,255,.4)', fontSize:12 }}>
              Plataforma en desarrollo activo · <span style={{ color:'rgba(255,255,255,.6)', fontWeight:600 }}>Registrate gratis y sé parte desde el inicio</span>
            </span>
          </div>
        </div>

        {/* ── FORM ── */}
        <div className="form-col">
          <div style={{ marginBottom:32 }}>
            <h2 style={{ fontFamily:'Rajdhani,sans-serif', color:'#fff', fontSize:26, fontWeight:700, margin:'0 0 6px' }}>
              Ingresá a NexoTribu
            </h2>
            <p style={{ color:'rgba(255,255,255,.4)', fontSize:13, margin:0 }}>
              Usá tu cuenta de Google para entrar o registrarte.
            </p>
          </div>

          <a className="apk-btn" href="https://drive.google.com/file/d/1WvjWDxj3Dl-bkr7_YkQeJhRCEe5o2xN7/view" target="_blank" rel="noreferrer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 17V3M7 12l5 5 5-5"/><rect x="3" y="17" width="18" height="4" rx="1"/>
            </svg>
            Descargar para Android (.apk)
          </a>

          <div style={{ display:'flex', alignItems:'center', gap:10, margin:'14px 0' }}>
            <div style={{ flex:1, height:1, background:'rgba(255,255,255,.08)' }} />
            <span style={{ color:'rgba(255,255,255,.2)', fontSize:11 }}>o entrá desde el navegador</span>
            <div style={{ flex:1, height:1, background:'rgba(255,255,255,.08)' }} />
          </div>

          <button className="glow-btn" onClick={loginGoogle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>

          <div style={{ margin:'16px 0 8px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ flex:1, height:1, background:'rgba(255,255,255,.08)' }} />
            <span style={{ color:'rgba(255,255,255,.25)', fontSize:11 }}>inicio de sesión seguro</span>
            <div style={{ flex:1, height:1, background:'rgba(255,255,255,.08)' }} />
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { icon:'🔒', t:'Acceso seguro con Google',  d:'Sin contraseñas que recordar.' },
              { icon:'🔞', t:'Solo para mayores de 18',   d:'Verificamos tu edad al registrarte.' },
              { icon:'🏆', t:'Torneos y comunidades',     d:'Organizá, competí y crecé con tu tribu.' },
            ].map(b => (
              <div key={b.t} style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:18, flexShrink:0 }}>{b.icon}</span>
                <div>
                  <div style={{ color:'rgba(255,255,255,.7)', fontSize:12, fontWeight:600 }}>{b.t}</div>
                  <div style={{ color:'rgba(255,255,255,.3)', fontSize:11 }}>{b.d}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop:32, display:'flex', justifyContent:'center', gap:20 }}>
            <button type="button" onClick={() => setModal('terminos')} style={{ background:'none', border:'none', padding:0, color:'rgba(255,255,255,.3)', fontSize:11, cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>
              Términos de Uso
            </button>
            <button type="button" onClick={() => setModal('privacidad')} style={{ background:'none', border:'none', padding:0, color:'rgba(255,255,255,.3)', fontSize:11, cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>
              Política de Privacidad
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
