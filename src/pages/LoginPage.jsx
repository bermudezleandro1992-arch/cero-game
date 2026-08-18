import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import { useAppVersion } from '../hooks/useAppVersion'
import { Capacitor } from '@capacitor/core'

const APK_URL = '/mimensajero.apk'

export default function LoginPage() {
  const { updateAvailable, newVersion, apkUrl } = useAppVersion()
  const isNative = Capacitor.isNativePlatform()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'magic'
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      if (age < 13) { setError('Debés tener al menos 13 años para registrarte.'); setLoading(false); return }
      if (!termsAccepted) { setError('Aceptá los términos y condiciones para continuar'); setLoading(false); return }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { display_name: name || email.split('@')[0] },
          emailRedirectTo: window.location.origin,
        }
      })
      if (error) setError(error.message); else setSent(true)
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
    color: C.text, fontSize: 15, boxSizing: 'border-box',
    transition: 'border-color .15s',
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: C.bg, padding: '24px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Update banner — inside native app when update available */}
        {isNative && updateAvailable && (
          <a href={apkUrl || APK_URL} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: `${C.green}20`, border: `1.5px solid ${C.green}66`,
            borderRadius: 14, padding: '12px 16px', marginBottom: 20,
            textDecoration: 'none', animation: 'pulse 2s ease-in-out infinite',
          }}>
            <span style={{ fontSize: 22 }}>🆕</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, color: C.green, fontWeight: 800, fontSize: 13 }}>¡Nueva versión disponible! {newVersion}</p>
              <p style={{ margin: 0, color: C.textDim, fontSize: 11, marginTop: 2 }}>Tocá para actualizar la app</p>
            </div>
            <span style={{ color: C.green, fontSize: 18 }}>⬇️</span>
          </a>
        )}

        {/* APK Download Banner — only on web (not inside native app) */}
        {!isNative && (
          <a href={APK_URL} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: `${C.green}15`, border: `1px solid ${C.green}44`,
            borderRadius: 14, padding: '12px 16px', marginBottom: 20,
            textDecoration: 'none', transition: 'background .15s',
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

        {/* Logo / Hero */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24,
            background: `radial-gradient(circle at 35% 35%, ${C.green}22 0%, ${C.greenDk}44 100%)`,
            border: `1.5px solid ${C.green}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 38, margin: '0 auto 20px',
            boxShadow: `0 0 40px ${C.green}22`,
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
                  </label>
                  <input type="date" value={birthdate} onChange={e => setBirthdate(e.target.value)}
                    max={new Date(new Date().setFullYear(new Date().getFullYear() - 13)).toISOString().split('T')[0]}
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
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '4px 0' }}>
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                  style={{ marginTop: 2, accentColor: C.green, width: 16, height: 16, flexShrink: 0 }}
                />
                <span style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>
                  Tengo al menos 13 años y acepto los{' '}
                  <span style={{ color: C.green, fontWeight: 600 }}>Términos de Uso</span>
                  {' '}y la{' '}
                  <span style={{ color: C.green, fontWeight: 600 }}>Política de Privacidad</span>.
                  Los menores de 18 años requieren autorización de un tutor legal.
                </span>
              </label>
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
              transition: 'all .2s',
              letterSpacing: '.3px',
            }}>
              {loading ? '...' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear cuenta' : 'Enviar link'}
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
            <button onClick={() => { setSent(false); setEmail(''); setPassword(''); setName('') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, fontSize: 13, fontWeight: 600, marginTop: 4 }}>
              Volver
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
