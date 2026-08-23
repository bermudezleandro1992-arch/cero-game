/**
 * AdminGate — biometric/2FA lock before the admin panel.
 *
 * Security layers (must pass ONE):
 *   1. WebAuthn passkey — device fingerprint/Face ID/Windows Hello
 *   2. Supabase TOTP MFA — Google Authenticator code
 *
 * Additional invariants:
 *   - User must be authenticated in Supabase AND have role ceo/admin/moderador
 *   - Session unlock stored in sessionStorage → clears when tab closes
 *   - Auto-locks after 30 min of inactivity
 */

import { useState, useEffect, useCallback } from 'react'
import { C } from '../theme'
import { supabase } from '../lib/supabase'

const UNLOCK_KEY   = 'admin_unlocked_at'
const SESSION_TTL  = 30 * 60 * 1000 // 30 min
const RP_ID        = window.location.hostname // 'mimensajero.vercel.app' or 'localhost'
const RP_NAME      = 'Mi Mensajero Admin'
const ADMIN_ROLES  = ['ceo', 'admin', 'moderador']

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64urlDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(s + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0))
}

function randomBytes(n) {
  const buf = new Uint8Array(n)
  crypto.getRandomValues(buf)
  return buf
}

export default function AdminGate({ profile, children }) {
  const [unlocked, setUnlocked]     = useState(false)
  const [step, setStep]             = useState('check') // check|choose|biometric|totp|enroll-bio|enroll-totp
  const [totpCode, setTotpCode]     = useState('')
  const [totpFactorId, setTotpFactorId] = useState(null)
  const [totpQR, setTotpQR]         = useState(null) // for enrollment
  const [totpSecret, setTotpSecret] = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [hasPasskey, setHasPasskey] = useState(false)
  const [passkeyId, setPasskeyId]   = useState(null)
  const [hasTOTP, setHasTOTP]       = useState(false)
  const [bioSupported, setBioSupported] = useState(false)

  // Check if session already unlocked (within TTL)
  const checkSession = useCallback(() => {
    const at = sessionStorage.getItem(UNLOCK_KEY)
    if (at && Date.now() - Number(at) < SESSION_TTL) {
      setUnlocked(true); return true
    }
    return false
  }, [])

  // Reset inactivity timer on any interaction
  useEffect(() => {
    if (!unlocked) return
    const bump = () => sessionStorage.setItem(UNLOCK_KEY, String(Date.now()))
    window.addEventListener('pointerdown', bump)
    window.addEventListener('keydown', bump)
    return () => { window.removeEventListener('pointerdown', bump); window.removeEventListener('keydown', bump) }
  }, [unlocked])

  useEffect(() => {
    if (checkSession()) return
    init()
  }, [])

  async function init() {
    setStep('check')
    // Check WebAuthn support
    const bio = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false)
    setBioSupported(bio)

    // Check if user has a registered passkey in DB
    if (bio && profile?.id) {
      const { data } = await supabase.from('admin_passkeys').select('id, credential_id').eq('user_id', profile.id).limit(1)
      if (data?.length) { setHasPasskey(true); setPasskeyId(data[0].credential_id) }
    }

    // Check if user has TOTP enrolled in Supabase
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const totp = factors?.all?.find(f => f.factor_type === 'totp' && f.status === 'verified')
    if (totp) { setHasTOTP(true); setTotpFactorId(totp.id) }

    setStep('choose')
  }

  function grantAccess() {
    sessionStorage.setItem(UNLOCK_KEY, String(Date.now()))
    setUnlocked(true)
  }

  // ── WebAuthn: register passkey ─────────────────────────────────────────────
  async function registerPasskey() {
    setLoading(true); setError('')
    try {
      const challenge = randomBytes(32)
      const userId    = new TextEncoder().encode(profile.id)

      const cred = await navigator.credentials.create({
        publicKey: {
          rp: { id: RP_ID, name: RP_NAME },
          user: { id: userId, name: profile.email || profile.username, displayName: profile.display_name || profile.username },
          challenge,
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
        },
      })

      const credId = b64url(cred.rawId)
      const deviceName = getDeviceName()

      await supabase.from('admin_passkeys').insert({ user_id: profile.id, credential_id: credId, device_name: deviceName })
      setHasPasskey(true); setPasskeyId(credId)
      grantAccess()
    } catch (e) {
      setError(e.name === 'NotAllowedError' ? 'Cancelaste la verificación biométrica.' : e.message)
    }
    setLoading(false)
  }

  // ── WebAuthn: verify passkey ───────────────────────────────────────────────
  async function verifyPasskey() {
    setLoading(true); setError('')
    try {
      const challenge = randomBytes(32)

      const assertion = await navigator.credentials.get({
        publicKey: {
          rpId: RP_ID,
          challenge,
          allowCredentials: passkeyId
            ? [{ id: b64urlDecode(passkeyId), type: 'public-key' }]
            : [],
          userVerification: 'required',
          timeout: 60000,
        },
      })

      if (!assertion) throw new Error('Sin respuesta del autenticador')

      // Update last_used_at
      await supabase.from('admin_passkeys').update({ last_used_at: new Date().toISOString() })
        .eq('credential_id', b64url(assertion.rawId))

      grantAccess()
    } catch (e) {
      setError(e.name === 'NotAllowedError' ? 'Cancelaste la verificación. Intentá de nuevo.' : e.message)
    }
    setLoading(false)
  }

  // ── TOTP: enroll ──────────────────────────────────────────────────────────
  async function enrollTOTP() {
    setLoading(true); setError('')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Admin Panel' })
      if (error) throw error
      setTotpFactorId(data.id)
      setTotpQR(data.totp.qr_code)
      setTotpSecret(data.totp.secret)
      setStep('enroll-totp')
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  // ── TOTP: verify challenge ─────────────────────────────────────────────────
  async function verifyTOTP(factorId) {
    if (totpCode.length < 6) return
    setLoading(true); setError('')
    try {
      const { data: challenge } = await supabase.auth.mfa.challenge({ factorId })
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: totpCode })
      if (error) throw error
      if (!hasTOTP) setHasTOTP(true)
      grantAccess()
    } catch (e) {
      setError('Código incorrecto. Verificá que el reloj de tu dispositivo esté en hora.')
    }
    setLoading(false)
  }

  function getDeviceName() {
    const ua = navigator.userAgent
    if (/iPhone/.test(ua)) return 'iPhone – Touch ID / Face ID'
    if (/iPad/.test(ua)) return 'iPad – Touch ID / Face ID'
    if (/Android/.test(ua)) return 'Android – Huella digital'
    if (/Mac/.test(ua)) return 'Mac – Touch ID'
    if (/Win/.test(ua)) return 'Windows – Windows Hello'
    return 'Dispositivo desconocido'
  }

  if (unlocked) return children

  // Not an admin role at all
  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: C.bg }}>
        <span style={{ fontSize: 56 }}>🔒</span>
        <p style={{ color: C.textDim, fontSize: 14, margin: 0 }}>Acceso restringido</p>
      </div>
    )
  }

  const inp = {
    width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 12,
    background: C.panel2, border: `1px solid ${C.border}`,
    color: C.text, fontSize: 16, letterSpacing: 6, textAlign: 'center', outline: 'none',
  }
  const btn = (accent) => ({
    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
    background: accent || C.green, color: C.bg, fontWeight: 800, fontSize: 14,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1, transition: 'opacity .15s',
  })
  const btnSecondary = {
    width: '100%', padding: '12px', borderRadius: 12, border: `1px solid ${C.border}`,
    background: 'transparent', color: C.textDim, fontWeight: 600, fontSize: 13,
    cursor: 'pointer',
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: '0 24px' }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: '0 auto 16px',
            background: `radial-gradient(circle at 35% 35%, ${C.green}22 0%, ${C.greenDk || '#0a3d0a'}44 100%)`,
            border: `1.5px solid ${C.green}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
            boxShadow: `0 0 30px ${C.green}18`,
          }}>🛡️</div>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Panel Admin</h2>
          <p style={{ color: C.textDim, fontSize: 13, margin: 0 }}>
            {profile.display_name || profile.username} · {profile.role?.toUpperCase()}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#ef444418', border: '1px solid #ef444433', borderRadius: 10, padding: '10px 14px', color: '#ef4444', fontSize: 13, textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* ── CHOOSE screen ── */}
        {step === 'choose' && (
          <>
            {/* Biometric — if supported and registered */}
            {bioSupported && hasPasskey && (
              <button onClick={() => { setStep('biometric'); verifyPasskey() }} style={btn()}>
                👆 Verificar con huella / Face ID
              </button>
            )}

            {/* TOTP — if enrolled */}
            {hasTOTP && (
              <button onClick={() => setStep('totp')} style={btn('#6366f1')}>
                🔐 Código de Google Authenticator
              </button>
            )}

            {/* Setup options if nothing configured */}
            {!hasPasskey && !hasTOTP && (
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px', textAlign: 'center' }}>
                <p style={{ color: C.text, fontWeight: 700, margin: '0 0 8px', fontSize: 14 }}>Configurá tu verificación</p>
                <p style={{ color: C.textDim, fontSize: 12, margin: '0 0 16px', lineHeight: 1.6 }}>
                  Es la primera vez que entrás al panel. Elegí cómo verificar tu identidad.
                </p>
                {bioSupported && (
                  <button onClick={registerPasskey} disabled={loading} style={{ ...btn(), marginBottom: 10 }}>
                    {loading ? 'Registrando...' : '👆 Registrar huella / Face ID'}
                  </button>
                )}
                <button onClick={enrollTOTP} disabled={loading} style={btn('#6366f1')}>
                  {loading ? 'Preparando...' : '🔐 Configurar Google Authenticator'}
                </button>
              </div>
            )}

            {/* Add biometric if only TOTP */}
            {bioSupported && !hasPasskey && hasTOTP && (
              <button onClick={registerPasskey} disabled={loading} style={btnSecondary}>
                {loading ? 'Registrando...' : '+ Registrar huella digital en este dispositivo'}
              </button>
            )}

            {/* Add TOTP if only biometric */}
            {!hasTOTP && hasPasskey && (
              <button onClick={enrollTOTP} disabled={loading} style={btnSecondary}>
                {loading ? 'Preparando...' : '+ Configurar Google Authenticator como respaldo'}
              </button>
            )}
          </>
        )}

        {/* ── BIOMETRIC verifying ── */}
        {step === 'biometric' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 56 }}>👆</div>
            <p style={{ color: C.text, fontSize: 15, margin: 0 }}>
              {loading ? 'Esperando tu huella / Face ID...' : 'Verificación lista'}
            </p>
            <button onClick={() => setStep('choose')} style={btnSecondary}>Volver</button>
          </div>
        )}

        {/* ── TOTP entry ── */}
        {step === 'totp' && (
          <>
            <p style={{ color: C.textDim, fontSize: 13, textAlign: 'center', margin: 0 }}>
              Ingresá el código de 6 dígitos de Google Authenticator
            </p>
            <input
              type="tel" inputMode="numeric" maxLength={6} autoFocus
              value={totpCode}
              onChange={e => { setTotpCode(e.target.value.replace(/\D/g, '')); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') verifyTOTP(totpFactorId) }}
              style={inp} placeholder="000000"
            />
            <button onClick={() => verifyTOTP(totpFactorId)} disabled={loading || totpCode.length < 6} style={btn('#6366f1')}>
              {loading ? 'Verificando...' : 'Entrar al panel'}
            </button>
            <button onClick={() => { setStep('choose'); setTotpCode(''); setError('') }} style={btnSecondary}>Volver</button>
          </>
        )}

        {/* ── TOTP enrollment ── */}
        {step === 'enroll-totp' && (
          <>
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
              <p style={{ color: C.text, fontWeight: 700, margin: '0 0 8px', fontSize: 14 }}>Configurar Google Authenticator</p>
              <p style={{ color: C.textDim, fontSize: 12, margin: '0 0 14px', lineHeight: 1.6 }}>
                1. Abrí Google Authenticator en tu celular<br/>
                2. Tocá + → Escanear código QR<br/>
                3. Escaneá el QR de abajo
              </p>
              {totpQR && (
                <img src={totpQR} alt="QR TOTP" style={{ width: '100%', maxWidth: 200, display: 'block', margin: '0 auto 12px', borderRadius: 10 }} />
              )}
              {totpSecret && (
                <div style={{ background: C.panel2, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1 }}>Clave manual</p>
                  <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 12, color: C.text, letterSpacing: 2, wordBreak: 'break-all' }}>{totpSecret}</p>
                </div>
              )}
              <p style={{ color: C.textDim, fontSize: 12, margin: '0 0 10px' }}>
                Ingresá el código que aparece en la app para confirmar:
              </p>
              <input
                type="tel" inputMode="numeric" maxLength={6} autoFocus
                value={totpCode}
                onChange={e => { setTotpCode(e.target.value.replace(/\D/g, '')); setError('') }}
                onKeyDown={e => { if (e.key === 'Enter') verifyTOTP(totpFactorId) }}
                style={{ ...inp, marginBottom: 10 }} placeholder="000000"
              />
              <button onClick={() => verifyTOTP(totpFactorId)} disabled={loading || totpCode.length < 6} style={btn('#6366f1')}>
                {loading ? 'Verificando...' : '✅ Confirmar y entrar'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
