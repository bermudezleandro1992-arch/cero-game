import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { C } from '../App'
import { soundSettings } from '../lib/sounds'

export default function ProfileSheet({ onClose, forceSetup = false }) {
  const { profile, updateProfile } = useAuthStore()
  const defaultName = (!profile?.display_name || profile.display_name === 'Usuario' || profile.display_name.startsWith('user_')) ? '' : profile.display_name
  const defaultUser = (!profile?.username || profile.username.startsWith('user_')) ? '' : profile.username
  const [name, setName] = useState(defaultName)
  const [username, setUsername] = useState(defaultUser)
  const [soundOn, setSoundOn] = useState(soundSettings.isEnabled())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    const cleanUser = username.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '')
    const err = await updateProfile(profile.id, {
      display_name: name.trim(),
      username: cleanUser || profile.username,
    })
    if (err) setError(err)
    else {
      setSuccess(true)
      setTimeout(onClose, 800)
    }
    setSaving(false)
  }

  const initials = (name || profile?.display_name || '?').slice(0, 2).toUpperCase()
  const disabled = saving || !name.trim()

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', flexDirection: 'column',
      background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px', background: C.panel,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        {!forceSetup && (
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.text2, padding: 4, display: 'flex',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
        )}
        <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>
          {forceSetup ? '¡Bienvenido! Completá tu perfil' : 'Editar perfil'}
        </h2>
      </div>

      {/* Avatar hero */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '40px 20px 32px',
        background: `radial-gradient(ellipse at 50% 0%, ${C.greenDk}22 0%, transparent 60%)`,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.greenDk}88, ${C.panel2})`,
          border: `2px solid ${C.green}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 34, fontWeight: 800, color: C.text,
          boxShadow: `0 0 32px ${C.green}22`,
          letterSpacing: '-1px',
        }}>
          {initials}
        </div>
        {profile?.username && (
          <p style={{ margin: '10px 0 0', color: C.green, fontSize: 13, fontWeight: 600 }}>
            @{profile.username}
          </p>
        )}
        <p style={{ margin: '4px 0 0', color: C.textDim, fontSize: 12 }}>
          Foto de perfil próximamente
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} style={{
        display: 'flex', flexDirection: 'column', gap: 0,
        padding: '8px 0', overflowY: 'auto', flex: 1,
      }}>
        {/* Name field */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}` }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: '1.5px', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>
            Tu nombre
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={50}
            autoFocus
            placeholder="Cómo querés que te vean"
            style={{
              width: '100%', background: 'transparent',
              border: 'none', borderBottom: `1.5px solid ${C.green}`,
              color: C.text, fontSize: 16, padding: '4px 0 8px',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          <p style={{ textAlign: 'right', fontSize: 11, color: C.textDim, margin: '6px 0 0' }}>
            {name.length}/50
          </p>
        </div>

        {/* Username field */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}` }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.text2, letterSpacing: '1.5px', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>
            Nombre de usuario
          </label>
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
            <span style={{ color: C.textDim, fontSize: 16, marginRight: 2 }}>@</span>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              maxLength={30}
              placeholder="tu_usuario"
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: C.text, fontSize: 16, padding: '4px 0',
                outline: 'none',
              }}
            />
          </div>
          <p style={{ fontSize: 12, color: C.textDim, margin: '8px 0 0' }}>
            Solo letras minúsculas, números y guión bajo
          </p>
        </div>

        {/* Status messages */}
        {error && (
          <div style={{ margin: '0 24px', padding: '10px 14px', background: `${C.red}18`, border: `1px solid ${C.red}44`, borderRadius: 10, color: C.red, fontSize: 13 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ margin: '0 24px', padding: '10px 14px', background: `${C.green}18`, border: `1px solid ${C.green}44`, borderRadius: 10, color: C.green, fontSize: 13, textAlign: 'center', fontWeight: 600 }}>
            ¡Perfil actualizado!
          </div>
        )}

        {/* Sound settings */}
        {!forceSetup && (
          <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.text2, letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 16px' }}>
              Configuración
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>{soundOn ? '🔔' : '🔕'}</span>
                <div>
                  <p style={{ margin: 0, fontSize: 14, color: C.text, fontWeight: 600 }}>Sonidos</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textDim }}>
                    {soundOn ? 'Activados' : 'Silenciados'}
                  </p>
                </div>
              </div>
              {/* Toggle switch */}
              <button
                type="button"
                onClick={() => { const next = soundSettings.toggle(); setSoundOn(next) }}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none',
                  background: soundOn ? C.green : C.border,
                  cursor: 'pointer', position: 'relative',
                  transition: 'background .2s',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: 3,
                  left: soundOn ? 25 : 3,
                  width: 20, height: 20, borderRadius: '50%',
                  background: soundOn ? C.bg : C.text2,
                  transition: 'left .2s',
                }} />
              </button>
            </div>
          </div>
        )}

        {/* Save button */}
        <div style={{ padding: '24px 24px', marginTop: 'auto' }}>
          <button
            type="submit"
            disabled={disabled}
            style={{
              width: '100%', padding: '15px',
              borderRadius: 14, border: 'none',
              background: disabled ? C.panel2 : C.green,
              color: disabled ? C.textDim : C.bg,
              fontSize: 15, fontWeight: 800,
              cursor: disabled ? 'not-allowed' : 'pointer',
              boxShadow: disabled ? 'none' : `0 4px 24px ${C.green}44`,
              transition: 'all .2s',
              letterSpacing: '.3px',
            }}>
            {saving ? 'Guardando...' : forceSetup ? 'Entrar al chat' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
