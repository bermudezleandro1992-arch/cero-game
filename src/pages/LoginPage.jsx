import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../App'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'magic'
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')

    if (mode === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({
        email, options: { emailRedirectTo: window.location.origin },
      })
      if (error) setError(error.message); else setSent(true)
    } else if (mode === 'register') {
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
              <input type="text" placeholder="Tu nombre" value={name}
                onChange={e => setName(e.target.value)} autoFocus style={inp} />
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
