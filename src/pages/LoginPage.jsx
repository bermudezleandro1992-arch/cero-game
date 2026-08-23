import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import { useAppVersion } from '../hooks/useAppVersion'
import { Capacitor } from '@capacitor/core'

const APK_URL = '/mimensajero.apk'

export default function LoginPage() {
  const { updateAvailable, newVersion, apkUrl } = useAppVersion()
  const isNative = Capacitor.isNativePlatform()
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [name, setName]             = useState('')
  const [birthdate, setBirthdate]   = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [referralCode, setReferralCode]   = useState('')
  const [mode, setMode]             = useState('login') // 'login' | 'register' | 'magic'
  const [sent, setSent]             = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  // Auto-fill referral code from URL param (?ref=CODE or ?referral=CODE)
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

      // Geolocate by IP
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
        // Post-signup: save country_code + register referral
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
    width: '100%', padding: '13px 16px', borderRadius: 12, outline: 'none',
    background: C.panel2, border: `1px solid ${C.border}`,
    color: C.text, fontSize: 15, boxSizing: 'border-box', transition: 'border-color .15s',
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: C.bg, padding: '24px 20px', overflowY: 'auto',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Update banner (native) */}
        {isNative && updateAvailable && (
          <a href={apkUrl || APK_URL} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: `${C.green}20`, border: `1.5px solid ${C.green}66`,
            borderRadius: 14, padding: '12px 16px', marginBottom: 20, textDecoration: 'none',
          }}>
            <span style={{ fontSize: 22 }}>🆕</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, color: C.green, fontWeight: 800, fontSize: 13 }}>¡Nueva versión! {newVersion}</p>
              <p style={{ margin: 0, color: C.textDim, fontSize: 11, marginTop: 2 }}>Tocá para actualizar</p>
            </div>
            <span style={{ color: C.green, fontSize: 18 }}>⬇️</span>
          </a>
        )}

        {/* APK Download Banner (web) */}
        {!isNative && (
          <a href={APK_URL} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: `${C.green}15`, border: `1px solid ${C.green}44`,
            borderRadius: 14, padding: '12px 16px', marginBottom: 20, textDecoration: 'none', transition: 'background .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = `${C.green}25`}
            onMouseLeave={e => e.currentTarget.style.background = `${C.green}15`}
          >
            <span style={{ fontSize: 22 }}>📱</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, color: C.green, fontWeight: 700, fontSize: 13 }}>Descargar APK Android</p>
              <p style={{ margin: 0, color: C.textDim, fontSize: 11, marginTop: 2 }}>Instalá la app nativa · última versión</p>
            </div>
            <span style={{ color: C.green, fontSize: 18 }}>⬇️</span>
          </a>
        )}

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24, margin: '0 auto 20px',
            background: `radial-gradient(circle at 35% 35%, ${C.green}22 0%, ${C.greenDk}44 100%)`,
            border: `1.5px solid ${C.green}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 38, boxShadow: `0 0 40px ${C.green}22`,
          }}>⚡</div>
          <h1 style={{ color: C.text, fontWeight: 800, fontSize: 24, margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            Mi Mensajero
          </h1>
          <p style={{ color: C.textDim, fontSize: 11, margin: '0 0 4px', letterSpacing: '2.5px', textTransform: 'uppercase', fontWeight: 600 }}>
            COMPETÍ · CONECTÁ · GANÁ
          </p>
          <p style={{ color: C.textDim, fontSize: 13, margin: '12px 0 0' }}>
            {sent
              ? (mode === 'register' ? 'Revisá tu email para confirmar' : 'Revisá tu email')
              : mode === 'login' ? 'Ingresá para continuar'
              : mode === 'register' ? 'Crear cuenta nueva'
              : 'Link mágico por email'}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {mode === 'register' && (
              <>
                <input type="text" placeholder="Tu nombre" value={name}
                  onChange={e => setName(e.target.value)} autoFocus style={inp} />
                <div>
                  <label style={{ fontSize: 11, color: C.textDim, display: 'block', marginBottom: 4 }}>
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
                {/* Referral */}
                <div>
                  <label style={{ fontSize: 11, color: C.textDim, display: 'block', marginBottom: 4 }}>
                    Código de referido <span style={{ opacity: 0.5 }}>(opcional)</span>
                  </label>
                  <input type="text" placeholder="Ej: ABC123" value={referralCode}
                    onChange={e => setReferralCode(e.target.value.toUpperCase().trim())}
                    maxLength={12}
                    style={{ ...inp, fontFamily: 'monospace', letterSpacing: 2, fontSize: 14 }} />
                </div>

                {/* Terms */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '4px 0' }}>
                  <input type="checkbox" checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    style={{ marginTop: 2, accentColor: C.green, width: 16, height: 16, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>
                    Tengo 18 años o más y acepto los{' '}
                    <span style={{ color: C.green, fontWeight: 600 }}>Términos de Uso</span>
                    {' '}y la{' '}
                    <span style={{ color: C.green, fontWeight: 600 }}>Política de Privacidad</span>.
                    Esta plataforma es exclusivamente para mayores de 18 años.
                  </span>
                </label>
              </>
            )}

            {error && (
              <div style={{
                background: `${C.red}18`, border: `1px solid ${C.red}44`,
                borderRadius: 10, padding: '10px 14px',
                color: C.red, fontSize: 13, textAlign: 'center',
              }}>{error}</div>
            )}

            <button type="submit" disabled={disabled} style={{
              width: '100%', padding: '14px', borderRadius: 12,
              background: disabled ? C.panel2 : C.green,
              border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
              color: disabled ? C.textDim : C.bg,
              fontSize: 15, fontWeight: 800, marginTop: 4,
              boxShadow: disabled ? 'none' : `0 4px 24px ${C.green}44`,
              transition: 'all .2s', letterSpacing: '.3px',
            }}>
              {loading ? '...' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear cuenta' : 'Enviar link'}
            </button>

            {/* Google OAuth */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ color: C.textDim, fontSize: 11, whiteSpace: 'nowrap' }}>o continuar con</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            <button type="button" onClick={async () => {
              await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
            }} style={{
              width: '100%', padding: '12px', borderRadius: 12,
              background: C.panel, border: `1px solid ${C.border}`,
              color: C.text, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'border-color .15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.green}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continuar con Google
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {mode === 'login' && (
                <>
                  <button type="button" onClick={() => { setMode('register'); setError('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, fontSize: 13, fontWeight: 600, padding: '4px 0' }}>
                    ¿No tenés cuenta? Registrate
                  </button>
                  <button type="button" onClick={() => { setMode('magic'); setError('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 12, padding: '4px 0' }}>
                    Entrar con link por email
                  </button>
                </>
              )}
              {mode === 'register' && (
                <button type="button" onClick={() => { setMode('login'); setError('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 12, padding: '4px 0' }}>
                  Ya tengo cuenta — Iniciar sesión
                </button>
              )}
              {mode === 'magic' && (
                <button type="button" onClick={() => { setMode('login'); setError('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 12, padding: '4px 0' }}>
                  Volver
                </button>
              )}
            </div>
          </form>

        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: `${C.green}18`, border: `1.5px solid ${C.green}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            }}>📩</div>
            <p style={{ color: C.text, fontSize: 15, margin: 0 }}>
              Email enviado a <span style={{ color: C.green, fontWeight: 600 }}>{email}</span>
            </p>
            <p style={{ color: C.textDim, fontSize: 12, margin: 0 }}>
              {mode === 'register'
                ? 'Confirmá tu cuenta desde el email y después volvé a iniciar sesión.'
                : 'Hacé click en el link para entrar.'}
            </p>
            <button onClick={() => { setSent(false); setEmail(''); setPassword(''); setName(''); setBirthdate('') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, fontSize: 13, fontWeight: 600, marginTop: 4 }}>
              Volver
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
