import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import { useAppVersion } from '../hooks/useAppVersion'
import { Capacitor } from '@capacitor/core'

const APK_URL = '/mimensajero.apk'

const FEATURES = [
  { icon: '💬', title: 'Mensajería real', desc: 'Chats privados y grupales con todo lo que necesitás.' },
  { icon: '🏆', title: 'Torneos', desc: 'Creá y participá en torneos de tu comunidad gamer.' },
  { icon: '🌐', title: 'Comunidades', desc: 'Grupos temáticos con roles, bots y canales.' },
  { icon: '🤖', title: 'Bots y API', desc: 'Automatizá con bots propios o conectá tu sistema.' },
]

function ApkModal({ onClose, apkUrl }) {
  const url = apkUrl || APK_URL
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0 0 env(safe-area-inset-bottom)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1a2530', border: '1px solid rgba(255,255,255,.1)',
        borderRadius: '20px 20px 0 0', padding: '24px 20px 32px',
        width: '100%', maxWidth: 480,
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.2)', margin: '0 auto 20px' }} />
        <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>📱</div>
        <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 18, textAlign: 'center', margin: '0 0 8px' }}>
          Instalar NexoTribu en Android
        </h2>
        <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, textAlign: 'center', margin: '0 0 20px', lineHeight: 1.6 }}>
          La app no está en Play Store todavía, así que Android puede mostrar una advertencia al instalarla. Es completamente seguro — te explicamos cómo hacerlo.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {[
            { n: '1', t: 'Descargá el APK', d: 'Tocá el botón de abajo. El archivo se descarga en tu carpeta de Descargas.' },
            { n: '2', t: 'Abrí el archivo', d: 'Desde Descargas, tocá el archivo .apk para abrirlo.' },
            { n: '3', t: 'Permitir instalación', d: 'Android te pregunta si confiás en la fuente. Tocá "Configuración" → activá "Permitir de esta fuente" → volvé atrás e instalá.' },
            { n: '4', t: '¡Listo!', d: 'NexoTribu aparece en tu pantalla de inicio como cualquier otra app.' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: '#00b894',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 13, color: '#fff', flexShrink: 0, marginTop: 1,
              }}>{s.n}</div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{s.t}</div>
                <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, lineHeight: 1.5 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(0,184,148,.12)', border: '1px solid rgba(0,184,148,.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 20 }}>
          <p style={{ color: 'rgba(0,184,148,1)', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
            🔒 <strong>100% seguro:</strong> el APK es oficial de NexoTribu. Android avisa porque no viene de Play Store, pero eso no significa que sea peligroso.
          </p>
        </div>

        <a href={url} onClick={onClose} style={{
          display: 'block', width: '100%', padding: '14px',
          background: '#00b894', borderRadius: 12, textAlign: 'center',
          color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none',
          boxShadow: '0 4px 20px rgba(0,184,148,.4)',
        }}>
          ⬇️ Descargar APK Android
        </a>
        <button onClick={onClose} style={{
          width: '100%', marginTop: 10, padding: '11px',
          background: 'transparent', border: '1px solid rgba(255,255,255,.15)',
          borderRadius: 12, color: 'rgba(255,255,255,.5)', fontSize: 14, cursor: 'pointer',
        }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

function AuthForm({ isNative, updateAvailable, newVersion, apkUrl }) {
  const [showApkModal, setShowApkModal] = useState(false)
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [name, setName]             = useState('')
  const [birthdate, setBirthdate]   = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [referralCode, setReferralCode]   = useState('')
  const [mode, setMode]             = useState('login')
  const [sent, setSent]             = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref') || params.get('referral') || ''
    if (ref) { setReferralCode(ref.toUpperCase().trim()); setMode('register') }
  }, [])

  function getAge(dateStr) {
    if (!dateStr) return null
    const dob = new Date(dateStr)
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const m = today.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
    return age
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')

    if (mode === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({
        email, options: { emailRedirectTo: window.location.origin },
      })
      if (error) setError(error.message); else setSent(true)

    } else if (mode === 'register') {
      const age = getAge(birthdate)
      if (!birthdate || age === null) { setError('Ingresá tu fecha de nacimiento'); setLoading(false); return }
      if (age < 18) { setError('Debés tener al menos 18 años para registrarte.'); setLoading(false); return }
      if (!termsAccepted) { setError('Aceptá los términos y condiciones para continuar'); setLoading(false); return }

      let countryCode = null
      try {
        const geo = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) })
        if (geo.ok) { const geoData = await geo.json(); countryCode = geoData.country_code || null }
      } catch { /* silent */ }

      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          data: {
            display_name: name || email.split('@')[0],
            country_code: countryCode,
            ...(referralCode ? { referred_by_code: referralCode } : {}),
          },
          emailRedirectTo: window.location.origin,
        },
      })

      if (error) { setError(error.message) } else {
        setTimeout(async () => {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return
          if (countryCode) await supabase.from('users').update({ country_code: countryCode }).eq('id', user.id)
          if (referralCode) {
            const { data: referrer } = await supabase
              .from('users').select('id').eq('referral_code', referralCode).maybeSingle()
            if (referrer) {
              await supabase.from('referrals').insert({ referrer_id: referrer.id, referred_id: user.id }).catch(() => {})
            }
          }
        }, 3000)
        setSent(true)
      }

    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('Email o contraseña incorrectos')
    }
    setLoading(false)
  }

  const disabled = loading || !email
  const inp = {
    width: '100%', padding: '12px 14px', borderRadius: 10, outline: 'none',
    background: C.panel2, border: `1px solid ${C.border}`,
    color: C.text, fontSize: 14, boxSizing: 'border-box', transition: 'border-color .15s',
  }

  return (
    <div style={{ width: '100%' }}>
      {/* APK banner */}
      {isNative && updateAvailable && (
        <a href={apkUrl || APK_URL} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: `${C.green}20`, border: `1.5px solid ${C.green}66`,
          borderRadius: 12, padding: '11px 14px', marginBottom: 16, textDecoration: 'none',
        }}>
          <span style={{ fontSize: 20 }}>🆕</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, color: C.green, fontWeight: 800, fontSize: 12 }}>¡Nueva versión! {newVersion}</p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 11, marginTop: 1 }}>Tocá para actualizar</p>
          </div>
        </a>
      )}
      {!isNative && (
        <>
          <button type="button" onClick={() => setShowApkModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            background: `${C.green}12`, border: `1px solid ${C.green}33`,
            borderRadius: 12, padding: '10px 14px', marginBottom: 16,
            cursor: 'pointer', transition: 'background .15s', textAlign: 'left',
          }}
            onMouseEnter={e => e.currentTarget.style.background = `${C.green}22`}
            onMouseLeave={e => e.currentTarget.style.background = `${C.green}12`}
          >
            <span style={{ fontSize: 18 }}>📱</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, color: C.green, fontWeight: 700, fontSize: 12 }}>Descargar APK Android</p>
              <p style={{ margin: 0, color: C.textDim, fontSize: 11, marginTop: 1 }}>Instalá la app nativa · última versión</p>
            </div>
            <span style={{ color: C.green }}>⬇️</span>
          </button>
          {showApkModal && <ApkModal onClose={() => setShowApkModal(false)} apkUrl={apkUrl} />}
        </>
      )}

      {/* Mode label */}
      <p style={{ color: C.textDim, fontSize: 13, margin: '0 0 16px', textAlign: 'center' }}>
        {sent
          ? (mode === 'register' ? 'Revisá tu email para confirmar' : 'Revisá tu email')
          : mode === 'login' ? 'Ingresá para continuar'
          : mode === 'register' ? 'Crear cuenta nueva'
          : 'Link mágico por email'}
      </p>

      {!sent ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mode === 'register' && (
            <>
              <input type="text" placeholder="Tu nombre" value={name}
                onChange={e => setName(e.target.value)} autoFocus style={inp} />
              <div>
                <label style={{ fontSize: 11, color: C.textDim, display: 'block', marginBottom: 3 }}>
                  Fecha de nacimiento <span style={{ color: '#ef4444' }}>*</span>
                  <span style={{ opacity: 0.6, marginLeft: 4 }}>(requerís 18+ años)</span>
                </label>
                <input type="date" value={birthdate} onChange={e => setBirthdate(e.target.value)}
                  max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                  required style={{ ...inp, colorScheme: 'dark' }} />
              </div>
            </>
          )}

          <input type="email" placeholder="tu@email.com" value={email}
            onChange={e => setEmail(e.target.value)} required
            autoFocus={mode !== 'register'} style={inp} />

          {(mode === 'login' || mode === 'register') && (
            <input type="password"
              placeholder={mode === 'register' ? 'Elegí una contraseña' : 'Contraseña'}
              value={password} onChange={e => setPassword(e.target.value)}
              required style={inp} />
          )}

          {mode === 'register' && (
            <>
              <div>
                <label style={{ fontSize: 11, color: C.textDim, display: 'block', marginBottom: 3 }}>
                  Código de referido <span style={{ opacity: 0.5 }}>(opcional)</span>
                </label>
                <input type="text" placeholder="Ej: ABC123" value={referralCode}
                  onChange={e => setReferralCode(e.target.value.toUpperCase().trim())}
                  maxLength={12}
                  style={{ ...inp, fontFamily: 'monospace', letterSpacing: 2, fontSize: 13 }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '4px 0' }}>
                <input type="checkbox" checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                  style={{ marginTop: 2, accentColor: C.green, width: 15, height: 15, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>
                  Tengo 18 años o más y acepto los{' '}
                  <span style={{ color: C.green, fontWeight: 600 }}>Términos de Uso</span>
                  {' '}y la{' '}
                  <span style={{ color: C.green, fontWeight: 600 }}>Política de Privacidad</span>.
                </span>
              </label>
            </>
          )}

          {error && (
            <div style={{
              background: `${C.red}18`, border: `1px solid ${C.red}44`,
              borderRadius: 8, padding: '9px 12px',
              color: C.red, fontSize: 12, textAlign: 'center',
            }}>{error}</div>
          )}

          <button type="submit" disabled={disabled} style={{
            width: '100%', padding: '13px', borderRadius: 10,
            background: disabled ? C.panel2 : C.green,
            border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
            color: disabled ? C.textDim : '#fff',
            fontSize: 14, fontWeight: 800, marginTop: 2,
            boxShadow: disabled ? 'none' : `0 4px 20px ${C.green}44`,
            transition: 'all .2s',
          }}>
            {loading ? '...' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear cuenta' : 'Enviar link'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
            <div style={{ flex: 1, height: 1, background: C.border }} />
            <span style={{ color: C.textDim, fontSize: 11, whiteSpace: 'nowrap' }}>o continuar con</span>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>
          <button type="button" onClick={async () => {
            await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
          }} style={{
            width: '100%', padding: '11px', borderRadius: 10,
            background: C.panel, border: `1px solid ${C.border}`,
            color: C.text, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'border-color .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.green}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2, textAlign: 'center' }}>
            {mode === 'login' && (
              <>
                <button type="button" onClick={() => { setMode('register'); setError('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, fontSize: 13, fontWeight: 600, padding: '3px 0' }}>
                  ¿No tenés cuenta? Registrate
                </button>
                <button type="button" onClick={() => { setMode('magic'); setError('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 12, padding: '3px 0' }}>
                  Entrar con link por email
                </button>
              </>
            )}
            {mode === 'register' && (
              <button type="button" onClick={() => { setMode('login'); setError('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 12, padding: '3px 0' }}>
                Ya tengo cuenta — Iniciar sesión
              </button>
            )}
            {mode === 'magic' && (
              <button type="button" onClick={() => { setMode('login'); setError('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 12, padding: '3px 0' }}>
                Volver
              </button>
            )}
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: `${C.green}18`, border: `1.5px solid ${C.green}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          }}>📩</div>
          <p style={{ color: C.text, fontSize: 14, margin: 0 }}>
            Email enviado a <span style={{ color: C.green, fontWeight: 600 }}>{email}</span>
          </p>
          <p style={{ color: C.textDim, fontSize: 12, margin: 0 }}>
            {mode === 'register'
              ? 'Confirmá tu cuenta desde el email y después volvé a iniciar sesión.'
              : 'Hacé click en el link para entrar.'}
          </p>
          <button onClick={() => { setSent(false); setEmail(''); setPassword(''); setName(''); setBirthdate('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, fontSize: 13, fontWeight: 600 }}>
            Volver
          </button>
        </div>
      )}
    </div>
  )
}

export default function LoginPage() {
  const { updateAvailable, newVersion, apkUrl } = useAppVersion()
  const isNative = Capacitor.isNativePlatform()

  return (
    <>
      <style>{`
        @media (min-width: 900px) {
          .login-root { flex-direction: row !important; padding: 0 !important; min-height: 100dvh; }
          .login-hero { display: flex !important; }
          .login-form-col { width: 420px !important; min-height: 100dvh; overflow-y: auto; padding: 40px 40px !important; }
          .login-logo-mobile { display: none !important; }
        }
        @media (max-width: 899px) {
          .login-hero { display: none !important; }
          .login-form-col { width: 100% !important; padding: 20px 16px !important; }
        }
      `}</style>
      <div className="login-root" style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        background: C.bg,
      }}>
        {/* Left: hero / landing */}
        <div className="login-hero" style={{
          flex: 1, display: 'none',
          flexDirection: 'column', justifyContent: 'center',
          padding: '60px 64px',
          background: `linear-gradient(145deg, ${C.panel} 0%, ${C.bg} 100%)`,
          borderRight: `1px solid ${C.border}`,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Glow blob */}
          <div style={{
            position: 'absolute', top: -80, left: -80, width: 340, height: 340,
            borderRadius: '50%', background: `${C.green}0d`, filter: 'blur(60px)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -60, right: -60, width: 260, height: 260,
            borderRadius: '50%', background: `${C.green}08`, filter: 'blur(50px)', pointerEvents: 'none',
          }} />

          {/* Logo + brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
            <img src="/logo.svg" alt="NexoTribu" width="52" height="52" />
            <div>
              <div style={{ color: C.text, fontWeight: 900, fontSize: 22, letterSpacing: '-0.5px' }}>NexoTribu</div>
              <div style={{ color: C.textDim, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
                COMPETÍ · CONECTÁ · GANÁ
              </div>
            </div>
          </div>

          {/* Headline */}
          <h1 style={{
            color: C.text, fontSize: 40, fontWeight: 900, lineHeight: 1.15,
            margin: '0 0 16px', letterSpacing: '-1px', maxWidth: 480,
          }}>
            Tu comunidad gamer,<br />
            <span style={{ color: C.green }}>en un solo lugar.</span>
          </h1>
          <p style={{ color: C.textDim, fontSize: 16, margin: '0 0 44px', maxWidth: 420, lineHeight: 1.7 }}>
            Mensajes, torneos, comunidades y bots. Todo lo que necesitás para conectarte con tu tribu.
          </p>

          {/* Features */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 480 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                background: `${C.panel}cc`, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: '16px 18px',
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{f.icon}</div>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{f.title}</div>
                <div style={{ color: C.textDim, fontSize: 12, lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Footer tagline */}
          <p style={{ color: C.textDim, fontSize: 11, marginTop: 48, opacity: 0.5 }}>
            Gratis para siempre en lo esencial · Disponible en web y Android
          </p>
        </div>

        {/* Right: auth form */}
        <div className="login-form-col" style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'safe center',
          padding: '20px 16px',
        }}>
          <div style={{ width: '100%', maxWidth: 360 }}>
            {/* Logo visible only on mobile */}
            <div className="login-logo-mobile" style={{ textAlign: 'center', marginBottom: 20 }}>
              <img src="/logo.svg" alt="NexoTribu" width="72" height="72" style={{ display: 'block', margin: '0 auto 10px' }} />
              <h1 style={{ color: C.text, fontWeight: 800, fontSize: 22, margin: '0 0 5px', letterSpacing: '-0.5px' }}>
                NexoTribu
              </h1>
              <p style={{ color: C.textDim, fontSize: 10, margin: 0, letterSpacing: '2.5px', textTransform: 'uppercase', fontWeight: 600 }}>
                COMPETÍ · CONECTÁ · GANÁ
              </p>
            </div>

            <AuthForm isNative={isNative} updateAvailable={updateAvailable} newVersion={newVersion} apkUrl={apkUrl} />
          </div>
        </div>
      </div>
    </>
  )
}
