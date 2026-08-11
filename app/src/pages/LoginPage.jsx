import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function sendMagicLink(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#111b21' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">💬</div>
          <h1 className="text-2xl font-bold text-white">Mi Mensajero</h1>
          <p className="text-sm mt-1" style={{ color: '#8696a0' }}>
            {sent ? 'Revisá tu email' : 'Ingresá tu email para continuar'}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={sendMagicLink} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-white text-base outline-none"
              style={{ background: '#202c33', border: '1px solid #2a3942' }}
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 rounded-xl font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: '#00a884' }}
            >
              {loading ? 'Enviando...' : 'Continuar'}
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-4xl">📩</div>
            <p className="text-white text-base">
              Te mandamos un link a <span style={{ color: '#00a884' }}>{email}</span>
            </p>
            <p className="text-sm" style={{ color: '#8696a0' }}>
              Abrí el email y hacé click en el link para entrar. Puede tardar unos segundos.
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="text-sm mt-2"
              style={{ color: '#00a884' }}
            >
              Usar otro email
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
