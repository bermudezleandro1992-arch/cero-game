import { useState } from 'react'
import { supabase } from '../lib/supabase'

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

  const inp = {
    width: '100%', padding: '13px 16px', borderRadius: 12, outline: 'none',
    background: '#111e17', border: '1px solid #1c2e23',
    color: '#c8ddd0', fontSize: 15, boxSizing: 'border-box',
    transition: 'border-color .15s',
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0a1409', padding: '24px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: 'linear-gradient(135deg, #00e676 0%, #00a854 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 34, margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(0,230,118,0.3)',
          }}>💬</div>
          <h1 style={{ color: '#c8ddd0', fontWeight: 800, fontSize: 22, margin: '0 0 4px', letterSpacing: '-0.3px' }}>
            Mi Mensajero
          </h1>
          <p style={{ color: '#5f7a6a', fontSize: 13, margin: 0 }}>
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
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10, padding: '10px 14px',
                color: '#fca5a5', fontSize: 13, textAlign: 'center',
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading || !email} style={{
              width: '100%', padding: '14px', borderRadius: 12,
              background: loading || !email ? '#1a2e22' : 'linear-gradient(135deg, #00e676 0%, #00c864 100%)',
              border: 'none', cursor: loading || !email ? 'not-allowed' : 'pointer',
              color: loading || !email ? '#3d5949' : '#0a1409',
              fontSize: 15, fontWeight: 700, marginTop: 4,
              boxShadow: loading || !email ? 'none' : '0 4px 20px rgba(0,230,118,0.25)',
              transition: 'all .2s',
            }}>
              {loading ? '...' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear cuenta' : 'Enviar link'}
            </button>

            {/* Mode switchers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {mode === 'login' && (
                <>
                  <button type="button" onClick={() => { setMode('register'); setError('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00e676', fontSize: 13, fontWeight: 600, padding: '4px 0' }}>
                    ¿No tenés cuenta? Registrate
                  </button>
                  <button type="button" onClick={() => { setMode('magic'); setError('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f7a6a', fontSize: 12, padding: '4px 0' }}>
                    Entrar con link por email
                  </button>
                </>
              )}
              {mode === 'register' && (
                <button type="button" onClick={() => { setMode('login'); setError('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f7a6a', fontSize: 12, padding: '4px 0' }}>
                  Ya tengo cuenta — Iniciar sesión
                </button>
              )}
              {mode === 'magic' && (
                <button type="button" onClick={() => { setMode('login'); setError('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f7a6a', fontSize: 12, padding: '4px 0' }}>
                  Volver
                </button>
              )}
            </div>
          </form>

        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(0,230,118,0.1)', border: '1.5px solid rgba(0,230,118,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            }}>📩</div>
            <p style={{ color: '#c8ddd0', fontSize: 15, margin: 0 }}>
              Email enviado a <span style={{ color: '#00e676', fontWeight: 600 }}>{email}</span>
            </p>
            <p style={{ color: '#5f7a6a', fontSize: 12, margin: 0 }}>
              {mode === 'register'
                ? 'Confirmá tu cuenta desde el email y después volvé a iniciar sesión.'
                : 'Hacé click en el link para entrar.'}
            </p>
            <button onClick={() => { setSent(false); setEmail(''); setPassword(''); setName('') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00e676', fontSize: 13, fontWeight: 600, marginTop: 4 }}>
              Volver
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
