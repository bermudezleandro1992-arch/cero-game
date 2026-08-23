/**
 * IdentityVerification — DNI upload flow shown inside PerfilPage.
 * Tiers:
 *   none     → show "Verificá tu identidad" CTA
 *   pending  → show "En revisión" state
 *   verified → show green badge
 *   rejected → show reason + allow retry
 */
import { useState, useEffect, useRef } from 'react'
import { C } from '../theme'
import { supabase } from '../lib/supabase'

export default function IdentityVerification({ profile, onVerified }) {
  const [status, setStatus]   = useState(profile?.verification_tier || 'none')
  const [step, setStep]       = useState('idle') // idle|form|uploading|done
  const [frontFile, setFrontFile] = useState(null)
  const [backFile, setBackFile]   = useState(null)
  const [frontPreview, setFrontPreview] = useState(null)
  const [backPreview, setBackPreview]   = useState(null)
  const [fullName, setFullName]   = useState(profile?.display_name || '')
  const [dniNumber, setDniNumber] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const frontRef = useRef()
  const backRef  = useRef()

  useEffect(() => {
    if (!profile?.id) return
    loadStatus()
  }, [profile?.id])

  async function loadStatus() {
    const { data } = await supabase
      .from('identity_verifications')
      .select('status, rejection_reason, created_at')
      .eq('user_id', profile.id)
      .maybeSingle()

    if (data) {
      setStatus(data.status)
      if (data.rejection_reason) setRejectionReason(data.rejection_reason)
    } else {
      setStatus(profile?.verification_tier || 'none')
    }
  }

  function pickFile(file, setFile, setPreview) {
    if (!file) return
    setFile(file)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  async function uploadDoc(file, path) {
    const { error } = await supabase.storage
      .from('identity-docs')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    const { data } = supabase.storage.from('identity-docs').getPublicUrl(path)
    // Bucket is private — use signed URL
    const { data: signed } = await supabase.storage
      .from('identity-docs')
      .createSignedUrl(path, 60 * 60 * 24 * 30) // 30 days
    return signed?.signedUrl || data.publicUrl
  }

  async function handleSubmit() {
    if (!frontFile) { setError('Subí la foto del frente del DNI'); return }
    if (!fullName.trim()) { setError('Ingresá tu nombre completo'); return }
    setLoading(true); setError('')

    try {
      const uid   = profile.id
      const front = await uploadDoc(frontFile, `${uid}/dni-front.${frontFile.name.split('.').pop()}`)
      const back  = backFile
        ? await uploadDoc(backFile, `${uid}/dni-back.${backFile.name.split('.').pop()}`)
        : null

      const payload = {
        user_id: uid,
        dni_front_url: front,
        dni_back_url:  back,
        full_name:     fullName.trim(),
        dni_number:    dniNumber.trim() || null,
        birth_date:    birthDate || null,
        status:        'pending',
      }

      const { error: dbErr } = await supabase
        .from('identity_verifications')
        .upsert(payload, { onConflict: 'user_id' })

      if (dbErr) throw dbErr

      // Update local tier
      await supabase.from('users').update({ verification_tier: 'pending' }).eq('id', uid)

      setStatus('pending')
      setStep('idle')
    } catch (e) {
      setError(e.message || 'Error al subir los documentos')
    }
    setLoading(false)
  }

  const inp = {
    width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10,
    background: C.panel2, border: `1px solid ${C.border}`,
    color: C.text, fontSize: 14, outline: 'none',
  }

  // ── VERIFIED ──────────────────────────────────────────────────────────────
  if (status === 'approved' || status === 'verified' || profile?.is_verified) {
    return (
      <div style={{
        background: `${C.green}10`, border: `1.5px solid ${C.green}44`,
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: `${C.green}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>✅</div>
        <div>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: C.green }}>Identidad verificada</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textDim }}>
            Podés acceder a torneos con premio, VIP y comunidades PRO.
          </p>
        </div>
      </div>
    )
  }

  // ── PENDING ───────────────────────────────────────────────────────────────
  if (status === 'pending') {
    return (
      <div style={{
        background: '#f59e0b0f', border: '1px solid #f59e0b44',
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: '#f59e0b20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>⏳</div>
        <div>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#f59e0b' }}>Verificación en revisión</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textDim }}>
            Estamos revisando tu DNI. Normalmente tarda menos de 24hs.
          </p>
        </div>
      </div>
    )
  }

  // ── FORM ──────────────────────────────────────────────────────────────────
  if (step === 'form') {
    return (
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => setStep('idle')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 0, display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: C.text }}>Verificar identidad</p>
        </div>

        {status === 'rejected' && (
          <div style={{ background: '#ef444418', border: '1px solid #ef444433', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#ef4444', fontWeight: 700 }}>Verificación rechazada</p>
            {rejectionReason && <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textDim }}>{rejectionReason}</p>}
            <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textDim }}>Podés volver a intentarlo con mejores fotos.</p>
          </div>
        )}

        {error && (
          <div style={{ background: '#ef444418', border: '1px solid #ef444433', borderRadius: 10, padding: '10px 14px', marginBottom: 12, color: '#ef4444', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Datos personales */}
        <p style={{ margin: '0 0 8px', fontSize: 12, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Tus datos</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <input type="text" placeholder="Nombre completo (como figura en el DNI)" value={fullName}
            onChange={e => setFullName(e.target.value)} style={inp} />
          <input type="text" placeholder="Número de DNI (opcional)" value={dniNumber}
            onChange={e => setDniNumber(e.target.value.replace(/\D/g, ''))} inputMode="numeric" style={inp} />
          <div>
            <label style={{ fontSize: 11, color: C.textDim, display: 'block', marginBottom: 4 }}>Fecha de nacimiento</label>
            <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
              style={{ ...inp, colorScheme: 'dark' }} />
          </div>
        </div>

        {/* Foto frente DNI */}
        <p style={{ margin: '0 0 8px', fontSize: 12, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
          Foto del DNI <span style={{ color: '#ef4444' }}>*</span>
        </p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {/* Frente */}
          <div style={{ flex: 1 }}>
            <input ref={frontRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => pickFile(e.target.files?.[0], setFrontFile, setFrontPreview)} />
            <button onClick={() => frontRef.current?.click()} style={{
              width: '100%', aspectRatio: '4/3', borderRadius: 12,
              border: `2px dashed ${frontPreview ? C.green + '66' : C.border}`,
              background: frontPreview ? 'transparent' : C.panel2,
              cursor: 'pointer', overflow: 'hidden', padding: 0, position: 'relative',
            }}>
              {frontPreview
                ? <img src={frontPreview} alt="frente" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 6 }}>
                    <span style={{ fontSize: 28 }}>📷</span>
                    <span style={{ fontSize: 11, color: C.textDim }}>Frente del DNI</span>
                  </div>
              }
            </button>
          </div>
          {/* Dorso */}
          <div style={{ flex: 1 }}>
            <input ref={backRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => pickFile(e.target.files?.[0], setBackFile, setBackPreview)} />
            <button onClick={() => backRef.current?.click()} style={{
              width: '100%', aspectRatio: '4/3', borderRadius: 12,
              border: `2px dashed ${backPreview ? C.green + '66' : C.border}`,
              background: backPreview ? 'transparent' : C.panel2,
              cursor: 'pointer', overflow: 'hidden', padding: 0,
            }}>
              {backPreview
                ? <img src={backPreview} alt="dorso" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 6 }}>
                    <span style={{ fontSize: 28 }}>🪪</span>
                    <span style={{ fontSize: 11, color: C.textDim }}>Dorso (opcional)</span>
                  </div>
              }
            </button>
          </div>
        </div>

        <p style={{ margin: '0 0 14px', fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
          🔒 Tus documentos se guardan de forma privada y segura. Solo los revisamos para verificar tu edad y no se comparten con nadie.
        </p>

        <button onClick={handleSubmit} disabled={loading || !frontFile || !fullName.trim()} style={{
          width: '100%', padding: '13px', borderRadius: 12, border: 'none',
          background: (!frontFile || !fullName.trim()) ? C.panel2 : C.green,
          color: (!frontFile || !fullName.trim()) ? C.textDim : C.bg,
          fontWeight: 800, fontSize: 14, cursor: loading ? 'wait' : 'pointer',
        }}>
          {loading ? 'Subiendo...' : '📤 Enviar para revisión'}
        </button>
      </div>
    )
  }

  // ── IDLE / CTA ────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#3b82f620', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🪪</div>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: C.text }}>
              {status === 'rejected' ? 'Verificación rechazada' : 'Verificá tu identidad'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textDim }}>
              {status === 'rejected' ? 'Podés volver a intentarlo' : 'Necesaria para torneos con premio y plan VIP'}
            </p>
          </div>
        </div>
      </div>

      {/* Tiers comparison */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {[
            { icon: '💬', label: 'Chat y comunidades gratuitas', free: true },
            { icon: '🏆', label: 'Torneos gratis', free: true },
            { icon: '⭐', label: 'Plan VIP', free: false },
            { icon: '🚀', label: 'Comunidades PRO', free: false },
            { icon: '🎖️', label: 'Torneos con premio', free: false },
          ].map(({ icon, label, free }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              <span style={{ flex: 1, fontSize: 13, color: C.text }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: free ? C.green : '#3b82f6' }}>
                {free ? '✓ Libre' : '🪪 Verificado'}
              </span>
            </div>
          ))}
        </div>

        <button onClick={() => { setStep('form'); setError('') }} style={{
          width: '100%', padding: '13px', borderRadius: 12, border: 'none',
          background: status === 'rejected' ? '#ef444422' : `${C.green}22`,
          color: status === 'rejected' ? '#ef4444' : C.green,
          fontWeight: 800, fontSize: 14, cursor: 'pointer',
          border: `1px solid ${status === 'rejected' ? '#ef444444' : C.green + '44'}`,
        }}>
          {status === 'rejected' ? '🔄 Intentar nuevamente' : '🪪 Verificar mi identidad'}
        </button>
      </div>
    </div>
  )
}
