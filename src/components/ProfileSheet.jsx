import { useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { C } from '../App'
import { soundSettings } from '../lib/sounds'
import LegalPage from '../pages/LegalPage'
import BotApiPage from '../pages/BotApiPage'

export default function ProfileSheet({ onClose, forceSetup = false }) {
  const { profile, updateProfile } = useAuthStore()
  const [showLegal, setShowLegal] = useState(false)
  const [showBotApi, setShowBotApi] = useState(false)
  const defaultName = (!profile?.display_name || profile.display_name === 'Usuario' || profile.display_name.startsWith('user_')) ? '' : profile.display_name
  const defaultUser = (!profile?.username || profile.username.startsWith('user_')) ? '' : profile.username
  const [name, setName] = useState(defaultName)
  const [username, setUsername] = useState(defaultUser)
  const [bio, setBio] = useState(profile?.bio || '')
  const [soundOn, setSoundOn] = useState(soundSettings.isEnabled())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef(null)

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('La imagen debe pesar menos de 5 MB'); return }
    setUploadingAvatar(true)
    setError('')
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      // Unique path per upload avoids upsert permission issues
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('attachments').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('attachments').getPublicUrl(path)
      const url = data.publicUrl
      const err = await updateProfile(profile.id, { avatar_url: url })
      if (err) throw new Error(err)
      setAvatarUrl(url)
    } catch (err) {
      setError(`No se pudo subir la foto: ${err.message || 'Intentá de nuevo.'}`)
      console.error(err)
    } finally {
      setUploadingAvatar(false)
      e.target.value = ''
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    const cleanUser = username.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '')
    const err = await updateProfile(profile.id, {
      display_name: name.trim(),
      username: cleanUser || profile.username,
      bio: bio.trim(),
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

  if (showLegal) return <LegalPage onBack={() => setShowLegal(false)} />
  if (showBotApi) return <BotApiPage onBack={() => setShowBotApi(false)} />

  return (
    <div style={{
      flex: 1, minHeight: 0,
      display: 'flex', flexDirection: 'column',
      background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      overflowY: 'auto',
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
        <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          disabled={uploadingAvatar}
          style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {avatarUrl
            ? <img src={avatarUrl} alt="avatar" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${C.green}44`, boxShadow: `0 0 32px ${C.green}22` }} />
            : (
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
            )
          }
          {/* Camera overlay */}
          <div style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 28, height: 28, borderRadius: '50%',
            background: uploadingAvatar ? C.panel2 : C.green,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${C.bg}`,
          }}>
            {uploadingAvatar
              ? <div style={{ width: 12, height: 12, border: `2px solid ${C.bg}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            }
          </div>
        </button>
        {profile?.username && (
          <p style={{ margin: '10px 0 0', color: C.green, fontSize: 13, fontWeight: 600 }}>
            @{profile.username}
          </p>
        )}
        <p style={{ margin: '4px 0 0', color: C.textDim, fontSize: 12 }}>
          {uploadingAvatar ? 'Subiendo foto...' : 'Tocá para cambiar la foto'}
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* Gamer Stats */}
      {!forceSetup && (
        <div style={{
          padding: '16px 20px', background: C.panel2,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            Estadísticas
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { icon: '🏆', label: 'Torneos',     value: profile?.stats_tournaments || 0 },
              { icon: '🥇', label: 'Campeonatos', value: profile?.stats_wins || 0 },
              { icon: '⚔️', label: 'Partidos',    value: profile?.stats_matches || 0 },
              { icon: '✅', label: 'Victorias',   value: profile?.stats_victories || 0 },
              { icon: '⚽', label: 'Goles',       value: profile?.stats_goals || 0 },
              { icon: '📊', label: 'Ranking',     value: profile?.stats_ranking ? `#${profile.stats_ranking}` : '--' },
            ].map(s => (
              <div key={s.label} style={{
                background: C.panel, borderRadius: 12, padding: '10px 8px',
                border: `1px solid ${C.border}`, textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, marginBottom: 2 }}>{s.icon}</div>
                <div style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>{s.value}</div>
                <div style={{ color: C.textDim, fontSize: 10, marginTop: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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

        {/* Bio */}
        <div style={{ padding: '0 24px 20px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.text2, letterSpacing: '1.5px', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>
            Bio
          </label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            maxLength={160}
            placeholder="Algo sobre vos..."
            rows={3}
            style={{
              width: '100%', background: 'transparent', border: 'none',
              borderBottom: `1px solid ${C.border}`, color: C.text,
              fontSize: 15, padding: '4px 0 8px', outline: 'none',
              resize: 'none', lineHeight: 1.5, boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: 12, color: C.textDim, margin: '4px 0 0', textAlign: 'right' }}>{bio.length}/160</p>
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

        {/* Bot API link */}
        {!forceSetup && (
          <div style={{ padding: '0 24px 4px' }}>
            <button type="button" onClick={() => setShowBotApi(true)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              background: 'none', border: `1px solid ${C.border}`, borderRadius: 12,
              padding: '12px 16px', cursor: 'pointer', color: C.textDim,
            }}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: C.text2, fontSize: 14, fontWeight: 600 }}>API de Bots</div>
                <div style={{ fontSize: 11, color: C.textDim }}>Conectá plataformas externas y bots</div>
              </div>
              <svg style={{ marginLeft: 'auto' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
        )}

        {/* Legal link */}
        {!forceSetup && (
          <div style={{ padding: '0 24px 4px' }}>
            <button type="button" onClick={() => setShowLegal(true)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              background: 'none', border: `1px solid ${C.border}`, borderRadius: 12,
              padding: '12px 16px', cursor: 'pointer', color: C.textDim,
            }}>
              <span style={{ fontSize: 18 }}>⚖️</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: C.text2, fontSize: 14, fontWeight: 600 }}>Legal y Privacidad</div>
                <div style={{ fontSize: 11, color: C.textDim }}>Términos, privacidad y reglamento</div>
              </div>
              <svg style={{ marginLeft: 'auto' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
        )}

        {/* Save button */}
        <div style={{ padding: '20px 24px' }}>
          <button
            type="submit"
            disabled={disabled}
            style={{
              padding: '11px 28px',
              borderRadius: 10, border: 'none',
              background: disabled ? C.panel2 : C.green,
              color: disabled ? C.textDim : C.bg,
              fontSize: 14, fontWeight: 700,
              cursor: disabled ? 'not-allowed' : 'pointer',
              boxShadow: disabled ? 'none' : `0 2px 16px ${C.green}33`,
              transition: 'all .2s',
            }}>
            {saving ? 'Guardando...' : forceSetup ? 'Entrar al chat' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
