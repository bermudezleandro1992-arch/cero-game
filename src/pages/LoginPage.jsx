import { supabase } from '../lib/supabase'
import { C } from '../theme'

export default function LoginPage() {
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

        .login-root {
          min-height: 100dvh;
          display: flex;
          background: #080d12;
          font-family: 'Inter', sans-serif;
        }
        .hero {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 60px 64px;
          position: relative;
          overflow: hidden;
        }
        .form-col {
          width: 400px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 48px 40px;
          background: #0e1419;
          border-left: 1px solid rgba(255,255,255,.06);
          position: relative;
        }
        .feat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 40px;
          max-width: 520px;
        }
        .feat-card {
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 14px;
          padding: 18px;
          transition: border-color .2s, background .2s;
        }
        .feat-card:hover {
          border-color: rgba(0,210,120,.3);
          background: rgba(0,210,120,.04);
        }
        .glow-btn {
          width: 100%;
          padding: 15px;
          border-radius: 12px;
          background: #fff;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: #111;
          transition: transform .15s, box-shadow .15s;
        }
        .glow-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 32px rgba(0,210,120,.25);
        }
        .glow-btn:active { transform: translateY(0); }

        @media (max-width: 860px) {
          .login-root { flex-direction: column; }
          .hero { padding: 48px 24px 32px; }
          .feat-grid { grid-template-columns: 1fr 1fr; }
          .form-col { width: 100%; padding: 32px 24px 48px; border-left: none; border-top: 1px solid rgba(255,255,255,.06); }
        }
        @media (max-width: 480px) {
          .feat-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
          .hero { padding: 36px 16px 24px; }
          .form-col { padding: 28px 16px 40px; }
        }
      `}</style>

      <div className="login-root">

        {/* ── HERO ── */}
        <div className="hero">
          {/* bg glows */}
          <div style={{ position:'absolute', top:-120, left:-80, width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(0,210,120,.07) 0%, transparent 70%)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:-80, right:-40, width:360, height:360, borderRadius:'50%', background:'radial-gradient(circle, rgba(0,150,255,.05) 0%, transparent 70%)', pointerEvents:'none' }} />

          {/* Brand */}
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:48 }}>
            <img src="/logo.svg" alt="NexoTribu" width={48} height={48} />
            <div>
              <div style={{ fontFamily:'Rajdhani, sans-serif', color:'#fff', fontWeight:700, fontSize:22, letterSpacing:'.5px' }}>NexoTribu</div>
              <div style={{ color:'rgba(255,255,255,.35)', fontSize:10, letterSpacing:'2.5px', textTransform:'uppercase' }}>COMPETÍ · CONECTÁ · GANÁ</div>
            </div>
          </div>

          {/* Headline */}
          <h1 style={{ fontFamily:'Rajdhani, sans-serif', color:'#fff', fontSize:'clamp(36px, 5vw, 58px)', fontWeight:700, lineHeight:1.1, margin:'0 0 16px', letterSpacing:'-0.5px', maxWidth:520 }}>
            Tu comunidad gamer,<br />
            <span style={{ color:'#00d278' }}>en un solo lugar.</span>
          </h1>
          <p style={{ color:'rgba(255,255,255,.5)', fontSize:16, margin:0, maxWidth:440, lineHeight:1.7 }}>
            Mensajería, torneos, comunidades y bots. Todo lo que tu tribu necesita para organizarse y competir.
          </p>

          {/* Feature cards */}
          <div className="feat-grid">
            {[
              { icon:'💬', t:'Mensajería real',   d:'Chats privados y grupos sin límites.' },
              { icon:'🏆', t:'Torneos',            d:'Creá y jugá torneos en tu comunidad.' },
              { icon:'🌐', t:'Comunidades',        d:'Grupos con roles, bots y canales.' },
              { icon:'🤖', t:'Bots y API',         d:'Automatizá con tu propio bot.' },
            ].map(f => (
              <div key={f.t} className="feat-card">
                <div style={{ fontSize:24, marginBottom:8 }}>{f.icon}</div>
                <div style={{ color:'#fff', fontWeight:700, fontSize:13, marginBottom:4 }}>{f.t}</div>
                <div style={{ color:'rgba(255,255,255,.4)', fontSize:12, lineHeight:1.5 }}>{f.d}</div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div style={{ marginTop:36, display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ display:'flex' }}>
              {['#00d278','#00b8e0','#a855f7','#f59e0b'].map((c, i) => (
                <div key={i} style={{ width:28, height:28, borderRadius:'50%', background:c, border:'2px solid #080d12', marginLeft: i ? -8 : 0 }} />
              ))}
            </div>
            <div style={{ color:'rgba(255,255,255,.4)', fontSize:12, lineHeight:1.5 }}>
              <span style={{ color:'rgba(255,255,255,.7)', fontWeight:600 }}>Jugadores ya conectados</span><br />
              Unite a la tribu hoy
            </div>
          </div>
        </div>

        {/* ── FORM COL ── */}
        <div className="form-col">
          <div style={{ marginBottom:32 }}>
            <h2 style={{ fontFamily:'Rajdhani, sans-serif', color:'#fff', fontSize:26, fontWeight:700, margin:'0 0 6px', letterSpacing:'.2px' }}>
              Ingresá a NexoTribu
            </h2>
            <p style={{ color:'rgba(255,255,255,.4)', fontSize:13, margin:0 }}>
              Usá tu cuenta de Google para entrar o registrarte.
            </p>
          </div>

          {/* Google button */}
          <button className="glow-btn" onClick={loginGoogle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>

          {/* Dividers / note */}
          <div style={{ margin:'20px 0', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ flex:1, height:1, background:'rgba(255,255,255,.08)' }} />
            <span style={{ color:'rgba(255,255,255,.25)', fontSize:11 }}>inicio de sesión seguro</span>
            <div style={{ flex:1, height:1, background:'rgba(255,255,255,.08)' }} />
          </div>

          {/* Trust badges */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { icon:'🔒', t:'Acceso seguro con Google', d:'Sin contraseñas que recordar.' },
              { icon:'🔞', t:'Solo para mayores de 18', d:'Verificamos tu edad al registrarte.' },
              { icon:'⚡', t:'Gratis para siempre', d:'Las funciones base nunca se cobran.' },
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

          <p style={{ color:'rgba(255,255,255,.2)', fontSize:10, marginTop:32, lineHeight:1.6, textAlign:'center' }}>
            Al continuar aceptás los Términos de Uso y la Política de Privacidad de NexoTribu.
          </p>
        </div>
      </div>
    </>
  )
}
