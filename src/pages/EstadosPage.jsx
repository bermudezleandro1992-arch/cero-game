import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'

// ── Duración permitida por plan ────────────────────────────────────────────────
const PLAN_DURATIONS = {
  free:        [24],
  member:      [24],
  vip:         [6, 12, 24],
  ceo:         [6, 12, 24, 48],      // CEO = creadores de comunidades
  com_starter: [6, 12, 24, 48],
  com_elite:   [6, 12, 24, 48, 72],
  organizador: [6, 12, 24, 48],
  admin:       [6, 12, 24, 48, 72],
  superadmin:  [6, 12, 24, 48, 72],  // superadmin = vos
}

function getPlanDurations(profile) {
  const plan = profile?.plan || profile?.role || 'free'
  return PLAN_DURATIONS[plan] || PLAN_DURATIONS.free
}

function getPlanLabel(profile) {
  const plan = profile?.plan || profile?.role || 'free'
  const map = { free: 'Gratis', member: 'Gratis', vip: 'VIP', com_starter: 'PRO Starter', com_elite: 'PRO Elite', ceo: 'CEO', organizador: 'Organizador', admin: 'Admin', superadmin: 'Superadmin' }
  return map[plan] || plan
}

// ── Colores para estados de texto ─────────────────────────────────────────────
const TEXT_BG_OPTIONS = [
  '#1a1a2e', '#0f3460', '#16213e', '#1b4332', '#370617',
  '#240046', '#7b2d00', '#1e3a5f', '#2d1b69', '#1a2e05',
]

// ── Progress bar de vista ──────────────────────────────────────────────────────
function ProgressBar({ count, current, duration, onNext }) {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); onNext(); return 100 }
        return p + (100 / (duration * 10))
      })
    }, 100)
    return () => clearInterval(interval)
  }, [current])

  return (
    <div style={{ display: 'flex', gap: 4, padding: '8px 12px 4px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, background: '#fff',
            width: i < current ? '100%' : i === current ? `${progress}%` : '0%',
            transition: i === current ? 'none' : 'none',
          }} />
        </div>
      ))}
    </div>
  )
}

// ── Viewer modal ───────────────────────────────────────────────────────────────
function EstadoViewer({ groups, startGroupIdx, onClose, myId }) {
  const [groupIdx, setGroupIdx] = useState(startGroupIdx)
  const [itemIdx, setItemIdx] = useState(0)
  const [showViews, setShowViews] = useState(false)
  const [views, setViews] = useState([])

  const group = groups[groupIdx]
  const estado = group?.items[itemIdx]

  useEffect(() => {
    if (!estado) return
    // Mark as viewed
    supabase.from('estado_views').upsert({ estado_id: estado.id, viewer_id: myId }, { onConflict: 'estado_id,viewer_id' })
  }, [estado?.id])

  function next() {
    if (itemIdx < group.items.length - 1) {
      setItemIdx(i => i + 1)
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(g => g + 1)
      setItemIdx(0)
    } else {
      onClose()
    }
  }

  function prev() {
    if (itemIdx > 0) setItemIdx(i => i - 1)
    else if (groupIdx > 0) { setGroupIdx(g => g - 1); setItemIdx(0) }
  }

  async function loadViews() {
    if (!estado) return
    const { data } = await supabase
      .from('estado_views')
      .select('viewer_id, viewed_at, users!estado_views_viewer_id_fkey(display_name, username, avatar_url)')
      .eq('estado_id', estado.id)
    setViews(data || [])
    setShowViews(true)
  }

  if (!estado) return null
  const isOwn = estado.user_id === myId
  const DISPLAY_SECS = 5

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000, background: '#000',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ position: 'relative', zIndex: 10, background: 'linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)' }}>
        <ProgressBar count={group.items.length} current={itemIdx} duration={DISPLAY_SECS} onNext={next} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 14px 12px' }}>
          {/* Botón volver — siempre visible */}
          <button onClick={onClose} style={{
            background: 'rgba(0,0,0,0.4)', border: 'none', cursor: 'pointer',
            color: '#fff', width: 36, height: 36, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: C.border, flexShrink: 0 }}>
            {group.avatar_url
              ? <img src={group.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👤</div>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{group.display_name}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
              {timeAgo(estado.created_at)} · {estado.duration_hours}h
            </div>
          </div>
          {isOwn && (
            <button onClick={loadViews} style={{ background: 'rgba(0,0,0,0.4)', border: 'none', cursor: 'pointer', color: '#fff', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👁️</button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={e => { const x = e.clientX / window.innerWidth; x < 0.35 ? prev() : next() }}
      >
        {estado.type === 'text' ? (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: estado.bg_color || '#1a1a2e', padding: 32, boxSizing: 'border-box',
          }}>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 700, textAlign: 'center', lineHeight: 1.5, maxWidth: 340, wordBreak: 'break-word' }}>
              {estado.caption}
            </div>
          </div>
        ) : estado.type === 'video' ? (
          <video src={estado.media_url} autoPlay muted playsInline style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <img src={estado.media_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="" />
        )}
        {estado.caption && estado.type !== 'text' && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
            padding: '32px 20px 16px', color: '#fff', fontSize: 15, textAlign: 'center',
          }}>{estado.caption}</div>
        )}
      </div>

      {/* Views drawer */}
      {showViews && (
        <div style={{ background: C.panel, borderTop: `1px solid ${C.border}`, maxHeight: '40%', overflowY: 'auto' }}>
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: C.text, fontWeight: 700 }}>👁️ {views.length} vista{views.length !== 1 ? 's' : ''}</span>
            <button onClick={() => setShowViews(false)} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
          {views.map(v => (
            <div key={v.viewer_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.border, overflow: 'hidden', flexShrink: 0 }}>
                {v.users?.avatar_url
                  ? <img src={v.users?.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 16 }}>👤</div>
                }
              </div>
              <div>
                <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{v.users?.display_name || 'Usuario'}</div>
                <div style={{ color: C.textDim, fontSize: 11 }}>{timeAgo(v.viewed_at)}</div>
              </div>
            </div>
          ))}
          {views.length === 0 && <div style={{ padding: '12px 16px', color: C.textDim, fontSize: 13 }}>Nadie lo vio todavía</div>}
        </div>
      )}
    </div>
  )
}

// ── Composer ───────────────────────────────────────────────────────────────────
function EstadoComposer({ profile, onClose, onPublished }) {
  const [mode, setMode] = useState(null) // 'image' | 'text'
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [caption, setCaption] = useState('')
  const [bgColor, setBgColor] = useState(TEXT_BG_OPTIONS[0])
  const [duration, setDuration] = useState(() => getPlanDurations(profile)[getPlanDurations(profile).length - 1])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  const allowedDurations = getPlanDurations(profile)
  const planLabel = getPlanLabel(profile)
  const isUpgradable = allowedDurations.length === 1

  function pickFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setMode(f.type.startsWith('video') ? 'video' : 'image')
  }

  async function publish() {
    if (!mode) return
    setUploading(true)
    setError(null)
    try {
      let media_url = null
      let type = mode

      if (mode === 'text') {
        type = 'text'
      } else {
        const ext = file.name.split('.').pop()
        const path = `${profile.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('estados').upload(path, file)
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('estados').getPublicUrl(path)
        media_url = publicUrl
      }

      const expires_at = new Date(Date.now() + duration * 3600 * 1000).toISOString()
      const { error: insErr } = await supabase.from('estados').insert({
        user_id: profile.id,
        type,
        media_url,
        caption: caption.trim() || null,
        bg_color: mode === 'text' ? bgColor : null,
        duration_hours: duration,
        expires_at,
      })
      if (insErr) throw insErr
      onPublished()
    } catch (e) {
      setError(e.message || 'Error al publicar')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8000, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>Nuevo estado</div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: C.textDim }}>Plan: <span style={{ color: C.green, fontWeight: 700 }}>{planLabel}</span></div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!mode ? (
          // Mode picker
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400, margin: '40px auto', width: '100%' }}>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 18, textAlign: 'center', marginBottom: 8 }}>¿Qué tipo de estado?</div>

            <button onClick={() => fileRef.current?.click()} style={{
              padding: '20px', borderRadius: 16, border: `2px dashed ${C.border}`, background: C.panel,
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 36 }}>📷</span>
              <span style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>Foto o Video</span>
              <span style={{ color: C.textDim, fontSize: 12 }}>JPG, PNG, GIF, MP4 · máx 50 MB</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={pickFile} />

            <button onClick={() => setMode('text')} style={{
              padding: '20px', borderRadius: 16, border: `2px dashed ${C.border}`, background: C.panel,
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 36 }}>✏️</span>
              <span style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>Texto</span>
              <span style={{ color: C.textDim, fontSize: 12 }}>Mensaje con fondo de color</span>
            </button>
          </div>
        ) : (
          <>
            {/* Preview */}
            {mode === 'text' ? (
              <div style={{ borderRadius: 16, overflow: 'hidden', background: bgColor, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, textAlign: 'center', lineHeight: 1.5, wordBreak: 'break-word', width: '100%' }}>
                  {caption || <span style={{ opacity: 0.4 }}>Escribí tu estado...</span>}
                </div>
              </div>
            ) : mode === 'video' ? (
              <video src={preview} style={{ width: '100%', borderRadius: 16, maxHeight: 300, objectFit: 'cover' }} controls />
            ) : (
              <img src={preview} style={{ width: '100%', borderRadius: 16, maxHeight: 300, objectFit: 'cover' }} alt="" />
            )}

            {/* Caption */}
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder={mode === 'text' ? 'Escribí tu estado...' : 'Agregar descripción (opcional)'}
              rows={mode === 'text' ? 4 : 2}
              maxLength={300}
              style={{ width: '100%', padding: '12px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, resize: 'none', boxSizing: 'border-box' }}
            />

            {/* BG color picker (solo text) */}
            {mode === 'text' && (
              <div>
                <div style={{ color: C.textDim, fontSize: 12, marginBottom: 8 }}>Color de fondo</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TEXT_BG_OPTIONS.map(c => (
                    <button key={c} onClick={() => setBgColor(c)} style={{
                      width: 32, height: 32, borderRadius: '50%', background: c, border: `3px solid ${bgColor === c ? C.green : 'transparent'}`, cursor: 'pointer',
                    }} />
                  ))}
                </div>
              </div>
            )}

            {/* Duración */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ color: C.textDim, fontSize: 12 }}>Duración visible</div>
                {isUpgradable && (
                  <div style={{ color: C.green, fontSize: 11, fontWeight: 700 }}>↑ Mejorá tu plan para más opciones</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[6, 12, 24, 48, 72].map(h => {
                  const allowed = allowedDurations.includes(h)
                  const active = duration === h
                  return (
                    <button key={h} onClick={() => allowed && setDuration(h)} style={{
                      padding: '8px 16px', borderRadius: 20, border: `2px solid ${active ? C.green : C.border}`,
                      background: active ? `${C.green}20` : C.panel,
                      color: allowed ? (active ? C.green : C.text) : C.textDim,
                      fontWeight: active ? 700 : 400, fontSize: 13, cursor: allowed ? 'pointer' : 'not-allowed',
                      opacity: allowed ? 1 : 0.45, position: 'relative',
                    }}>
                      {h}h
                      {!allowed && <span style={{ fontSize: 9, position: 'absolute', top: -6, right: -2, background: '#f59e0b', color: '#000', borderRadius: 8, padding: '1px 4px', fontWeight: 800 }}>🔒</span>}
                    </button>
                  )
                })}
              </div>
              <div style={{ color: C.textDim, fontSize: 11, marginTop: 6 }}>
                Tu estado expirará {duration < 24 ? `en ${duration} horas` : duration === 24 ? 'en 24 horas' : `en ${duration} horas (${duration/24} días)`}
              </div>
            </div>

            {error && <div style={{ color: '#ef4444', fontSize: 13, background: '#ef444420', padding: '10px 14px', borderRadius: 10 }}>{error}</div>}
          </>
        )}
      </div>

      {/* Footer */}
      {mode && (
        <div style={{ background: C.panel, borderTop: `1px solid ${C.border}`, padding: '12px 16px', display: 'flex', gap: 10 }}>
          <button onClick={() => { setMode(null); setFile(null); setPreview(null); setCaption('') }} style={{
            flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${C.border}`, background: 'none', color: C.text, fontWeight: 600, cursor: 'pointer',
          }}>Cambiar</button>
          <button
            onClick={publish}
            disabled={uploading || (mode === 'text' && !caption.trim()) || (!file && mode !== 'text')}
            style={{
              flex: 2, padding: '12px', borderRadius: 12, border: 'none',
              background: uploading ? C.border : C.green, color: C.bg,
              fontWeight: 700, fontSize: 15, cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Publicando...' : '✓ Publicar estado'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function AvatarRing({ avatarUrl, hasActive, size = 52, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer', padding: 2,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        padding: 2,
        background: hasActive ? `conic-gradient(${C.green}, #00e676, ${C.green})` : C.border,
      }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.bg}` }}>
          {avatarUrl
            ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            : <div style={{ width: '100%', height: '100%', background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4 }}>👤</div>
          }
        </div>
      </div>
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EstadosPage() {
  const { profile } = useAuthStore()
  const [myEstados, setMyEstados] = useState([])
  const [contactEstados, setContactEstados] = useState([])
  const [loading, setLoading] = useState(true)
  const [showComposer, setShowComposer] = useState(false)
  const [viewerData, setViewerData] = useState(null) // { groups, startIdx }

  async function load() {
    if (!profile?.id) return
    setLoading(true)
    const now = new Date().toISOString()

    // Mis estados activos
    const { data: mine } = await supabase
      .from('estados')
      .select('*')
      .eq('user_id', profile.id)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })

    // Estados de contactos (otros usuarios activos — simplificado)
    const { data: others } = await supabase
      .from('estados')
      .select('*, users!estados_user_id_fkey(id, display_name, username, avatar_url)')
      .neq('user_id', profile.id)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })

    setMyEstados(mine || [])

    // Agrupar por usuario
    const grouped = {}
    ;(others || []).forEach(e => {
      const uid = e.user_id
      if (!grouped[uid]) grouped[uid] = { ...e.users, items: [] }
      grouped[uid].items.push(e)
    })
    setContactEstados(Object.values(grouped))
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.id])

  function openViewer(groups, startIdx) {
    setViewerData({ groups, startIdx })
  }

  // Grupo propio para el viewer
  const myGroup = {
    user_id: profile?.id,
    display_name: profile?.display_name || 'Vos',
    avatar_url: profile?.avatar_url,
    items: myEstados,
  }

  const allGroups = myEstados.length > 0
    ? [myGroup, ...contactEstados]
    : contactEstados

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 18 }}>Estados</div>
        <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>Actualizaciones de tus contactos</div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* Mi estado */}
          <div style={{ padding: '16px 16px 8px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ color: C.textDim, fontSize: 11, fontWeight: 600, letterSpacing: '1px', marginBottom: 12 }}>MI ESTADO</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ position: 'relative' }}>
                <AvatarRing
                  avatarUrl={profile?.avatar_url}
                  hasActive={myEstados.length > 0}
                  onClick={() => myEstados.length > 0 ? openViewer(allGroups, 0) : setShowComposer(true)}
                />
                <button
                  onClick={() => setShowComposer(true)}
                  style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 22, height: 22, borderRadius: '50%',
                    background: C.green, border: `2px solid ${C.bg}`,
                    color: C.bg, fontSize: 14, fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', lineHeight: 1,
                  }}
                >+</button>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>
                  {myEstados.length > 0 ? 'Mi estado' : 'Agregar a mi estado'}
                </div>
                <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>
                  {myEstados.length > 0
                    ? `${myEstados.length} publicación${myEstados.length !== 1 ? 'es' : ''} activa${myEstados.length !== 1 ? 's' : ''}`
                    : 'Toca para compartir una actualización'
                  }
                </div>
              </div>
              <button
                onClick={() => setShowComposer(true)}
                style={{
                  background: `${C.green}18`, border: `1px solid ${C.green}40`,
                  borderRadius: 20, padding: '7px 16px', color: C.green,
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}
              >+ Nuevo</button>
            </div>

            {/* Plan info */}
            <div style={{ marginTop: 12, padding: '8px 12px', background: C.panel, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: C.textDim, fontSize: 11 }}>Duración disponible:</span>
                {getPlanDurations(profile).map(h => (
                  <span key={h} style={{ background: `${C.green}20`, color: C.green, borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{h}h</span>
                ))}
                {getPlanDurations(profile).length === 1 && (
                  <span style={{ color: '#f59e0b', fontSize: 11, fontWeight: 600 }}>· Mejorá tu plan para más opciones</span>
                )}
              </div>
            </div>
          </div>

          {/* Estados de contactos */}
          {contactEstados.length > 0 && (
            <div style={{ padding: '16px 16px 8px' }}>
              <div style={{ color: C.textDim, fontSize: 11, fontWeight: 600, letterSpacing: '1px', marginBottom: 12 }}>ACTUALIZACIONES RECIENTES</div>
              {contactEstados.map((group, idx) => (
                <button key={group.id} onClick={() => openViewer(allGroups, myEstados.length > 0 ? idx + 1 : idx)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '10px 0', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
                }}>
                  <AvatarRing avatarUrl={group.avatar_url} hasActive={true} size={48} onClick={() => {}} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{group.display_name}</div>
                    <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>
                      {group.items.length} actualización{group.items.length !== 1 ? 'es' : ''} · {timeAgo(group.items[0].created_at)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {contactEstados.length === 0 && myEstados.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12, marginTop: 24 }}>
              <div style={{ fontSize: 56 }}>👁️</div>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>Sin estados por ahora</div>
              <div style={{ color: C.textDim, fontSize: 13, textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>
                Publicá tu primer estado y aparecerá aquí. También verás los estados de tus contactos.
              </div>
              <button onClick={() => setShowComposer(true)} style={{
                marginTop: 8, padding: '12px 24px', borderRadius: 20, border: 'none',
                background: C.green, color: C.bg, fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}>+ Crear mi primer estado</button>
            </div>
          )}
        </div>
      )}

      {/* Composer */}
      {showComposer && (
        <EstadoComposer
          profile={profile}
          onClose={() => setShowComposer(false)}
          onPublished={() => { setShowComposer(false); load() }}
        />
      )}

      {/* Viewer */}
      {viewerData && (
        <EstadoViewer
          groups={viewerData.groups}
          startGroupIdx={viewerData.startIdx}
          onClose={() => { setViewerData(null); load() }}
          myId={profile?.id}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
