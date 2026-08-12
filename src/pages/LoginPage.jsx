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
    setLoading(true)
    setError('')

    if (mode === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) setError(error.message)
      else setSent(true)

    } else if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name || email.split('@')[0] },
          emailRedirectTo: window.location.origin,
        }
      })
      if (error) setError(error.message)
      else setSent(true)

    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('Email o contraseña incorrectos')
    }

    setLoading(false)
  }

  const titles = {
    login: 'Ingresá para continuar',
    register: 'Crear cuenta nueva',
    magic: 'Te mandamos un link al email',
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#111b21' }}>
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="text-5xl mb-4">💬</div>
          <h1 className="text-2xl font-bold text-white">Mi Mensajero</h1>
          <p className="text-sm mt-1" style={{ color: '#8696a0' }}>
            {sent ? (mode === 'register' ? 'Revisá tu email para confirmar' : 'Revisá tu email') : titles[mode]}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">

            {mode === 'register' && (
              <input
                type="text"
                placeholder="Tu nombre"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-white text-base outline-none"
                style={{ background: '#202c33', border: '1px solid #2a3942' }}
              />
            )}

            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus={mode !== 'register'}
              className="w-full px-4 py-3 rounded-xl text-white text-base outline-none"
              style={{ background: '#202c33', border: '1px solid #2a3942' }}
            />

            {(mode === 'login' || mode === 'register') && (
              <input
                type="password"
                placeholder={mode === 'register' ? 'Elegí una contraseña' : 'Contraseña'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-white text-base outline-none"
                style={{ background: '#202c33', border: '1px solid #2a3942' }}
              />
            )}

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 rounded-xl font-semibold text-white transition-opacity disabled:opacity-50 mt-1"
              style={{ background: '#00a884' }}
            >
              {loading ? '...' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear cuenta' : 'Enviar link'}
            </button>

            {/* Switchers */}
            <div className="flex flex-col gap-2 mt-1">
              {mode === 'login' && (
                <>
                  <button type="button" onClick={() => { setMode('register'); setError('') }}
                    className="text-sm text-center font-medium" style={{ color: '#00a884' }}>
                    ¿No tenés cuenta? Registrate
                  </button>
                  <button type="button" onClick={() => { setMode('magic'); setError('') }}
                    className="text-sm text-center" style={{ color: '#8696a0' }}>
                    Entrar con link por email
                  </button>
                </>
              )}
              {mode === 'register' && (
                <button type="button" onClick={() => { setMode('login'); setError('') }}
                  className="text-sm text-center" style={{ color: '#8696a0' }}>
                  Ya tengo cuenta — Iniciar sesión
                </button>
              )}
              {mode === 'magic' && (
                <button type="button" onClick={() => { setMode('login'); setError('') }}
                  className="text-sm text-center" style={{ color: '#8696a0' }}>
                  Volver
                </button>
              )}
            </div>
          </form>

        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-4xl">📩</div>
            <p className="text-white text-base">
              Te mandamos un email a <span style={{ color: '#00a884' }}>{email}</span>
            </p>
            <p className="text-sm" style={{ color: '#8696a0' }}>
              {mode === 'register'
                ? 'Confirmá tu cuenta desde el email y después volvé a iniciar sesión.'
                : 'Hacé click en el link para entrar.'}
            </p>
            <button onClick={() => { setSent(false); setEmail(''); setPassword(''); setName('') }}
              className="text-sm mt-2" style={{ color: '#00a884' }}>
              Volver
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
