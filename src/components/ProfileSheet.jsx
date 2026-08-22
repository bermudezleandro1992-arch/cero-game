import { useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import { soundSettings, SOUND_PACKS, ringSettings, RINGTONES, OUTGOING_TONES } from '../lib/sounds'
import LegalPage from '../pages/LegalPage'
import BotApiPage from '../pages/BotApiPage'
import VipPage from '../pages/VipPage'
import DonationsPage from '../pages/DonationsPage'
import SubscriptionPanel from '../pages/SubscriptionPanel'
import { useTheme } from '../lib/ThemeContext'
import { useSubscription } from '../hooks/useSubscription'

// ── Role config ───────────────────────────────────────────────────────────────
const ROLES = {
  ceo:          { label: 'CEO',              color: '#a855f7', bg: '#a855f718', icon: '👑' },
  organizador:  { label: 'Organizador',      color: '#f59e0b', bg: '#f59e0b18', icon: '🎖️' },
  comunidad:    { label: 'Comunidad',        color: '#3b82f6', bg: '#3b82f618', icon: '🌐' },
  vip:          { label: 'Miembro VIP',      color: '#f59e0b', bg: '#f59e0b18', icon: '⭐' },
  member:       { label: 'Miembro',          color: '#64748b', bg: '#64748b18', icon: '👤' },
}

const PLANS = {
  community: { label: 'Comunidad PRO', color: '#8b5cf6', bg: '#8b5cf614', icon: '💎' },
  pro:       { label: 'PRO',           color: '#8b5cf6', bg: '#8b5cf614', icon: '💎' },
  vip:       { label: 'VIP',           color: '#f59e0b', bg: '#f59e0b14', icon: '⭐' },
  free:      { label: 'Gratuito',      color: '#64748b', bg: '#64748b14', icon: '🆓' },
}

function RoleBadge({ role }) {
  const cfg = ROLES[role] || ROLES.member
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700,
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}44`,
      borderRadius: 20, padding: '2px 8px',
    }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function VerifiedBadge() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#3b82f6" style={{ flexShrink: 0 }}>
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="12" cy="12" r="11" fill="#3b82f6"/>
      <polyline points="8 12 11 15 16 9" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

export default function ProfileSheet({ onClose, forceSetup = false, initialShowVip = false }) {
  const { profile, updateProfile } = useAuthStore()
  const { themeId, setTheme, themes } = useTheme()
  const [showLegal, setShowLegal] = useState(false)
  const [showBotApi, setShowBotApi] = useState(false)
  const [showVip, setShowVip] = useState(initialShowVip)
  const [showDonations, setShowDonations] = useState(false)
  const [showSub, setShowSub] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [section, setSection] = useState('perfil') // 'perfil' | 'cuenta' | 'preferencias'

  const defaultName = (!profile?.display_name || profile.display_name === 'Usuario' || profile.display_name.startsWith('user_')) ? '' : profile.display_name
  const defaultUser = (!profile?.username || profile.username.startsWith('user_')) ? '' : profile.username
  const [name, setName] = useState(defaultName)
  const [username, setUsername] = useState(defaultUser)
  const [bio, setBio] = useState(profile?.bio || '')
  const [soundOn, setSoundOn] = useState(soundSettings.isEnabled())
  const [soundPack, setSoundPack] = useState(soundSettings.getPack())
  const [ringId, setRingId] = useState(ringSettings.getRing())
  const [outId, setOutId] = useState(ringSettings.getOut())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef(null)

  const userRole = profile?.role || 'member'
  const isVerified = profile?.is_verified || false
  const { plan: subPlan } = useSubscription(profile?.id)
  const userPlan = subPlan || profile?.plan || 'free'
  const planCfg = PLANS[userPlan] || PLANS.free

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('La imagen debe pesar menos de 5 MB'); return }
    setUploadingAvatar(true); setError('')
    try {
      const ext = file.name.split('.').pop().toLowerCase()
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
    } finally {
      setUploadingAvatar(false); e.target.value = ''
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError('')
    const cleanUser = username.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '')
    const err = await updateProfile(profile.id, {
      display_name: name.trim(),
      username: cleanUser || profile.username,
      bio: bio.trim(),
    })
    if (err) setError(err)
    else { setSuccess(true); setTimeout(onClose, 800) }
    setSaving(false)
  }

  const initials = (name || profile?.display_name || '?').slice(0, 2).toUpperCase()
  const disabled = saving || !name.trim()

  async function handleDeleteAccount() {
    setDeleting(true); setDeleteError('')
    try {
      const { error } = await supabase.rpc('delete_user_account')
      if (error) throw error
      await supabase.auth.signOut()
    } catch (err) {
      setDeleteError(err.message || 'Error al eliminar la cuenta. Intentá de nuevo.')
      setDeleting(false)
    }
  }

  if (showLegal) return <LegalPage onBack={() => setShowLegal(false)} />
  if (showBotApi) return <BotApiPage onBack={() => setShowBotApi(false)} />
  if (showVip) return <VipPage onBack={() => setShowVip(false)} />
  if (showDonations) return <DonationsPage onBack={() => setShowDonations(false)} />
  if (showSub) return <SubscriptionPanel onBack={() => setShowSub(false)} onUpgrade={() => { setShowSub(false); setShowVip(true) }} />

  const inp = {
    width: '100%', background: C.panel2,
    border: `1px solid ${C.border}`, borderRadius: 10,
    color: C.text, fontSize: 15, padding: '11px 14px',
    outline: 'none', boxSizing: 'border-box',
    transition: 'border-color .15s',
  }

  const SECTIONS = [
    { id: 'perfil', label: 'Perfil' },
    { id: 'cuenta', label: 'Cuenta' },
    { id: 'preferencias', label: 'Preferencias' },
  ]

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .settings-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 600px) { .settings-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 900px) { .settings-grid { grid-template-columns: 1fr 1fr 1fr; } }
        .stat-grid { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
        .stat-grid::-webkit-scrollbar { display: none; }
        .stat-item { flex: 0 0 calc(33.333% - 6px); min-width: 76px; }
        @media (min-width: 600px) { .stat-item { flex: 1; min-width: 0; } }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px', background: C.panel,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        {!forceSetup && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
        )}
        <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16, flex: 1 }}>
          {forceSetup ? '¡Bienvenido! Completá tu perfil' : 'Ajustes'}
        </h2>
        {!forceSetup && userPlan !== 'free' && (
          <span style={{
            fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
            background: planCfg.bg, color: planCfg.color,
            border: `1px solid ${planCfg.color}44`,
          }}>
            {planCfg.icon} {planCfg.label}
          </span>
        )}
      </div>

      {/* Hero — avatar + info + badges + stats */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '14px 16px 14px',
        background: `radial-gradient(ellipse at 50% 0%, ${C.greenDk}22 0%, transparent 65%)`,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}
          style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="avatar" style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: `2.5px solid ${C.green}55`, boxShadow: `0 0 32px ${C.green}22` }} />
            : (
              <div style={{
                width: 88, height: 88, borderRadius: '50%',
                background: `linear-gradient(135deg, ${C.greenDk}88, ${C.panel2})`,
                border: `2.5px solid ${C.green}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 800, color: C.text,
                boxShadow: `0 0 32px ${C.green}22`,
              }}>{initials}</div>
            )
          }
          <div style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 26, height: 26, borderRadius: '50%',
            background: uploadingAvatar ? C.panel2 : C.green,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${C.bg}`,
          }}>
            {uploadingAvatar
              ? <div style={{ width: 11, height: 11, border: `2px solid ${C.bg}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            }
          </div>
        </button>

        {/* Name + verified */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>{name || profile?.display_name || 'Usuario'}</span>
          {isVerified && <VerifiedBadge />}
        </div>
        {profile?.username && (
          <span style={{ color: C.green, fontSize: 13, fontWeight: 600, marginTop: 2 }}>@{profile.username}</span>
        )}

        {/* Badges row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, justifyContent: 'center' }}>
          <RoleBadge role={userRole} />
          {userPlan !== 'free' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700,
              color: planCfg.color, background: planCfg.bg,
              border: `1px solid ${planCfg.color}44`,
              borderRadius: 20, padding: '2px 8px',
            }}>
              {planCfg.icon} {planCfg.label}
            </span>
          )}
        </div>

        {!forceSetup && profile?.bio && (
          <p style={{ color: C.textDim, fontSize: 12, margin: '6px 0 0', textAlign: 'center', maxWidth: 280, lineHeight: 1.4 }}>{profile.bio}</p>
        )}
        <p style={{ margin: '4px 0 0', color: C.textDim, fontSize: 10 }}>
          {uploadingAvatar ? 'Subiendo foto...' : 'Tocá la foto para cambiarla'}
        </p>

        {/* Stats inline en el hero */}
        {!forceSetup && (
          <div style={{ width: '100%', marginTop: 12 }}>
            <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left' }}>Estadísticas</p>
            <div className="stat-grid">
              {[
                { icon: '🏆', label: 'Torneos',     value: profile?.stats_tournaments || 0 },
                { icon: '🥇', label: 'Campeonatos', value: profile?.stats_wins || 0 },
                { icon: '⚔️', label: 'Partidos',    value: profile?.stats_matches || 0 },
                { icon: '✅', label: 'Victorias',   value: profile?.stats_victories || 0 },
                { icon: '⚽', label: 'Goles',       value: profile?.stats_goals || 0 },
                { icon: '📊', label: 'Ranking',     value: profile?.stats_ranking ? `#${profile.stats_ranking}` : '--' },
              ].map(s => (
                <div key={s.label} className="stat-item" style={{
                  background: `${C.panel}cc`, borderRadius: 10, padding: '8px 4px',
                  border: `1px solid ${C.border}`, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 1 }}>{s.icon}</div>
                  <div style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>{s.value}</div>
                  <div style={{ color: C.textDim, fontSize: 9, marginTop: 1 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section tabs */}
      {!forceSetup && (
        <div style={{
          display: 'flex', gap: 0, background: C.panel,
          borderBottom: `1px solid ${C.border}`, flexShrink: 0, zIndex: 1,
        }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              flex: 1, padding: '12px 4px', background: 'none',
              border: 'none', borderBottom: `2px solid ${section === s.id ? C.green : 'transparent'}`,
              color: section === s.id ? C.green : C.textDim,
              fontSize: 13, fontWeight: section === s.id ? 700 : 500,
              cursor: 'pointer', transition: 'all .15s',
            }}>{s.label}</button>
          ))}
        </div>
      )}

      {/* Content — scrollable area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 40px', minHeight: 0 }}>

        {/* ── PERFIL ── */}
        {(section === 'perfil' || forceSetup) && (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ padding: '20px 20px 0' }}>
              <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Información personal</p>
              <div className="settings-grid">
                <div>
                  <label style={{ fontSize: 11, color: C.green, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Nombre</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={50}
                    autoFocus={forceSetup} placeholder="Tu nombre" style={inp} />
                  <p style={{ textAlign: 'right', fontSize: 10, color: C.textDim, margin: '4px 0 0' }}>{name.length}/50</p>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.textDim, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Usuario</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.textDim, fontSize: 15 }}>@</span>
                    <input type="text" value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      maxLength={30} placeholder="tu_usuario"
                      style={{ ...inp, paddingLeft: 28 }} />
                  </div>
                </div>
                <div style={{ gridColumn: 'span 1' }}>
                  <label style={{ fontSize: 11, color: C.textDim, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Bio</label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={160}
                    placeholder="Algo sobre vos..." rows={3}
                    style={{ ...inp, resize: 'none', lineHeight: 1.5 }} />
                  <p style={{ fontSize: 10, color: C.textDim, margin: '4px 0 0', textAlign: 'right' }}>{bio.length}/160</p>
                </div>
              </div>
            </div>

            {error && (
              <div style={{ margin: '12px 20px 0', padding: '10px 14px', background: `${C.red}18`, border: `1px solid ${C.red}44`, borderRadius: 10, color: C.red, fontSize: 13 }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ margin: '12px 20px 0', padding: '10px 14px', background: `${C.green}18`, border: `1px solid ${C.green}44`, borderRadius: 10, color: C.green, fontSize: 13, textAlign: 'center', fontWeight: 600 }}>
                ¡Perfil actualizado!
              </div>
            )}

            <div style={{ padding: '20px 20px 0' }}>
              <button type="submit" disabled={disabled} style={{
                padding: '13px 28px', borderRadius: 12, border: 'none', width: '100%',
                background: disabled ? C.panel2 : C.green,
                color: disabled ? C.textDim : C.bg,
                fontSize: 15, fontWeight: 800,
                cursor: disabled ? 'not-allowed' : 'pointer',
                boxShadow: disabled ? 'none' : `0 4px 20px ${C.green}44`,
                transition: 'all .2s',
              }}>
                {saving ? 'Guardando...' : forceSetup ? 'Entrar al chat' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}

        {/* ── CUENTA ── */}
        {section === 'cuenta' && !forceSetup && (
          <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Plan actual */}
            <div style={{
              background: planCfg.bg, border: `1.5px solid ${planCfg.color}55`,
              borderRadius: 16, padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: `${planCfg.color}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
              }}>{planCfg.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: planCfg.color, fontWeight: 800, fontSize: 15 }}>{planCfg.label}</div>
                <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>
                  {userPlan === 'community' ? 'Acceso completo a Comunidad — gratis durante beta' : 'Acceso completo a todas las funciones'}
                </div>
              </div>
              {isVerified && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <VerifiedBadge />
                  <span style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700 }}>VERIFICADO</span>
                </div>
              )}
            </div>

            {/* Rol */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px 18px' }}>
              <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Tu rango</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(ROLES).map(([key, cfg]) => (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 12,
                    background: userRole === key ? cfg.bg : C.panel2,
                    border: `1.5px solid ${userRole === key ? cfg.color : C.border}`,
                    opacity: userRole === key ? 1 : 0.5,
                  }}>
                    <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: userRole === key ? cfg.color : C.textDim }}>{cfg.label}</span>
                    {userRole === key && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Acciones */}
            {[
              { icon: planCfg.icon, label: `Mi Suscripción · ${planCfg.label}`, desc: userPlan === 'free' ? 'Mejorar a VIP o PRO' : 'Ver plan, historial de pagos y más', color: planCfg.color, action: () => setShowSub(true) },
              { icon: '⭐', label: 'Planes VIP y PRO', desc: 'Comunidades ilimitadas, bots y más', color: '#f59e0b', action: () => setShowVip(true) },
              { icon: '💚', label: 'Apoyá el proyecto', desc: 'Donaciones para mantener todo gratis', color: C.green, action: () => setShowDonations(true) },
              { icon: '🤖', label: 'API de Bots', desc: 'Conectá plataformas externas y bots', color: C.textDim, action: () => setShowBotApi(true) },
              { icon: '⚖️', label: 'Legal y Privacidad', desc: 'Términos, privacidad y reglamento', color: C.textDim, action: () => setShowLegal(true) },
            ].map(item => (
              <button key={item.label} type="button" onClick={item.action} style={{
                display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                background: C.panel, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                transition: 'border-color .15s',
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: item.color !== C.textDim ? item.color : C.text, fontSize: 14, fontWeight: 700 }}>{item.label}</div>
                  <div style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{item.desc}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            ))}

            {/* Danger zone — delete account */}
            <div style={{
              background: '#ef444410', border: `1px solid #ef444430`,
              borderRadius: 16, padding: '16px 18px', marginTop: 8,
            }}>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#ef4444', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Zona de peligro</p>
              {!deleteConfirm ? (
                <button type="button" onClick={() => setDeleteConfirm(true)} style={{
                  width: '100%', padding: '12px', borderRadius: 12, border: `1px solid #ef444444`,
                  background: 'transparent', color: '#ef4444', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer',
                }}>
                  🗑️ Eliminar mi cuenta
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ margin: 0, color: '#ef4444', fontSize: 13, lineHeight: 1.6, fontWeight: 600 }}>
                    ¿Estás seguro? Esta acción es <strong>irreversible</strong>. Se eliminarán todos tus mensajes, torneos, datos y tu cuenta de forma permanente.
                  </p>
                  {deleteError && (
                    <p style={{ margin: 0, color: '#ef4444', fontSize: 12, background: '#ef444418', borderRadius: 8, padding: '8px 12px' }}>{deleteError}</p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => { setDeleteConfirm(false); setDeleteError('') }} style={{
                      flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${C.border}`,
                      background: C.panel2, color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>
                      Cancelar
                    </button>
                    <button type="button" onClick={handleDeleteAccount} disabled={deleting} style={{
                      flex: 1, padding: '11px', borderRadius: 10, border: 'none',
                      background: deleting ? '#ef444444' : '#ef4444', color: '#fff',
                      fontSize: 13, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer',
                    }}>
                      {deleting ? 'Eliminando...' : 'Sí, eliminar todo'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PREFERENCIAS ── */}
        {section === 'preferencias' && !forceSetup && (
          <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Sonidos */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
                <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Sonidos</p>
              </div>
              <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20 }}>{soundOn ? '🔔' : '🔕'}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, color: C.text, fontWeight: 600 }}>Sonidos de notificación</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textDim }}>{soundOn ? 'Activados' : 'Silenciados'}</p>
                  </div>
                </div>
                <button type="button" onClick={() => { const next = soundSettings.toggle(); setSoundOn(next) }} style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none',
                  background: soundOn ? C.green : C.border,
                  cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute', top: 3, left: soundOn ? 25 : 3,
                    width: 20, height: 20, borderRadius: '50%',
                    background: soundOn ? C.bg : C.text2, transition: 'left .2s',
                  }} />
                </button>
              </div>
              {soundOn && (
                <div style={{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '1px', textTransform: 'uppercase' }}>Pack de sonidos</p>
                  {Object.values(SOUND_PACKS).map(p => (
                    <button key={p.id} type="button" onClick={() => { soundSettings.setPack(p.id); setSoundPack(p.id) }} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      background: soundPack === p.id ? `${C.green}18` : C.panel2,
                      border: `1.5px solid ${soundPack === p.id ? C.green : C.border}`,
                      transition: 'all .15s',
                    }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{p.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: soundPack === p.id ? C.green : C.text, fontWeight: 600, fontSize: 13 }}>{p.label}</div>
                        <div style={{ color: C.textDim, fontSize: 11, marginTop: 1 }}>{p.desc}</div>
                      </div>
                      {soundPack === p.id && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  ))}

                  <p style={{ margin: '10px 0 6px', fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '1px', textTransform: 'uppercase' }}>Tono de llamada entrante</p>
                  {Object.values(RINGTONES).map(r => (
                    <button key={r.id} type="button" onClick={() => { ringSettings.setRing(r.id); setRingId(r.id); r.play() }} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      background: ringId === r.id ? `${C.green}18` : C.panel2,
                      border: `1.5px solid ${ringId === r.id ? C.green : C.border}`,
                      transition: 'all .15s',
                    }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{r.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: ringId === r.id ? C.green : C.text, fontWeight: 600, fontSize: 13 }}>{r.label}</div>
                        <div style={{ color: C.textDim, fontSize: 11, marginTop: 1 }}>{r.desc}</div>
                      </div>
                      {ringId === r.id && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  ))}

                  <p style={{ margin: '10px 0 6px', fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '1px', textTransform: 'uppercase' }}>Tono de llamada saliente</p>
                  {Object.values(OUTGOING_TONES).map(o => (
                    <button key={o.id} type="button" onClick={() => { ringSettings.setOut(o.id); setOutId(o.id); o.play() }} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      background: outId === o.id ? `${C.green}18` : C.panel2,
                      border: `1.5px solid ${outId === o.id ? C.green : C.border}`,
                      transition: 'all .15s',
                    }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{o.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: outId === o.id ? C.green : C.text, fontWeight: 600, fontSize: 13 }}>{o.label}</div>
                        <div style={{ color: C.textDim, fontSize: 11, marginTop: 1 }}>{o.desc}</div>
                      </div>
                      {outId === o.id && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tema */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
                <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Apariencia</p>
              </div>
              <div style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Object.values(themes).map(t => (
                    <button key={t.id} type="button" onClick={() => setTheme(t.id)} style={{
                      flex: 1, padding: '12px 4px', borderRadius: 14, cursor: 'pointer',
                      background: t.bg, border: `2.5px solid ${themeId === t.id ? t.green : t.border}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      transition: 'border .15s',
                    }}>
                      <span style={{ fontSize: 20 }}>{t.emoji}</span>
                      <span style={{ fontSize: 10, color: t.text2, fontWeight: 600 }}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
