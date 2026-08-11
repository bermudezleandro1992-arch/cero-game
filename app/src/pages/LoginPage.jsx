import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('phone') // 'phone' | 'otp'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function sendOtp(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({ phone })
    if (error) {
      setError(error.message)
    } else {
      setStep('otp')
    }
    setLoading(false)
  }

  async function verifyOtp(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' })
    if (error) setError(error.message)
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
            {step === 'phone' ? 'Ingresá tu número de teléfono' : 'Ingresá el código que recibiste'}
          </p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={sendOtp} className="flex flex-col gap-4">
            <input
              type="tel"
              placeholder="+54 11 1234-5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-white text-base outline-none"
              style={{ background: '#202c33', border: '1px solid #2a3942' }}
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || !phone}
              className="w-full py-3 rounded-xl font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: '#00a884' }}
            >
              {loading ? 'Enviando...' : 'Continuar'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Código de 6 dígitos"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              required
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-white text-base text-center tracking-widest outline-none"
              style={{ background: '#202c33', border: '1px solid #2a3942', fontSize: '1.5rem' }}
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full py-3 rounded-xl font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: '#00a884' }}
            >
              {loading ? 'Verificando...' : 'Verificar'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setOtp(''); setError('') }}
              className="text-sm text-center"
              style={{ color: '#00a884' }}
            >
              Cambiar número
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
