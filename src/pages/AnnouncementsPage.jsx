import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { C } from '../theme'
import { canPublishAnnouncements } from '../lib/roles'
import TournamentDashboard from '../components/TournamentDashboard'

// ── helpers ──────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return ''
  const d = (Date.now() - new Date(ts)) / 1000
  if (d < 60) return 'ahora'
  if (d < 3600) return `${Math.floor(d / 60)}m`
  if (d < 86400) return `${Math.floor(d / 3600)}h`
  if (d < 86400 * 7) return `${Math.floor(d / 86400)}d`
  return new Date(ts).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

const GAMES = ['eFootball', 'FC 26', 'FC 25', 'FIFA', 'Warzone', 'Fortnite', 'Free Fire', 'Otro']

// Límites de anuncios por plan (publicados en los últimos 30 días)
const ANN_LIMITS = {
  free:        1,   // 1 activo en total
  member:      1,
  vip:         5,
  ceo:         20,
  com_starter: 20,
  com_elite:   999,
  organizador: 10,
  admin:       999,
  superadmin:  999,
}
function annLimit(role) {
  return ANN_LIMITS[role] ?? (role ? 999 : 1)
}
const CATEGORIES = [
  { id: 'torneo',  label: 'Torneos',   emoji: '🏆' },
  { id: 'liga',    label: 'Ligas',     emoji: '⚽' },
  { id: 'evento',  label: 'Eventos',   emoji: '🎮' },
  { id: 'noticia', label: 'Noticias',  emoji: '📰' },
  { id: 'general', label: 'General',   emoji: '💬' },
]

const CATEGORY_CFG = {
  torneo:  { label: 'Torneo',  color: '#f59e0b', bg: '#f59e0b15' },
  liga:    { label: 'Liga',    color: '#10b981', bg: '#10b98115' },
  evento:  { label: 'Evento',  color: '#6366f1', bg: '#6366f115' },
  noticia: { label: 'Noticia', color: '#3b82f6', bg: '#3b82f615' },
  general: { label: 'General', color: '#6b7280', bg: '#6b728015' },
}

const AVATAR_COLORS = ['#e91e63','#9c27b0','#1565c0','#00838f','#2e7d32','#e65100','#c62828']
function avatarColor(id = '') {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function Avatar({ name, url, size = 34 }) {
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 800, color: '#fff' }}>
        {name?.slice(0, 2).toUpperCase() || '?'}
      </div>
}

// ── Form to create a new announcement ────────────────────────────────────────
function NewAnnouncementForm({ onClose, onCreate }) {
  const { profile } = useAuthStore()
  const { uploadImage } = useChatStore()
  const [title, setTitle]         = useState('')
  const [body, setBody]           = useState('')
  const [game, setGame]           = useState('')
  const [category, setCategory]   = useState('torneo')
  const [linkUrl, setLinkUrl]     = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [isPinned, setIsPinned]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [myCommunities, setMyCommunities] = useState([])
  const [selectedCommunity, setSelectedCommunity] = useState('')
  const [myTournaments, setMyTournaments] = useState([])
  const [selectedTournament, setSelectedTournament] = useState('')
  const [showExtra, setShowExtra] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('group_roles')
      .select('conversation_id, conversations(id, name, group_type)')
      .eq('user_id', profile.id)
      .in('role', ['owner', 'admin'])
      .then(({ data }) => {
        const convs = (data || []).map(r => r.conversations).filter(Boolean)
        setMyCommunities(convs)
        if (convs.length === 1) setSelectedCommunity(convs[0].id)
      })
    supabase
      .from('conversations')
      .select('id, name, group_type, tournament_status, community_id')
      .in('group_type', ['tournament', 'liga'])
      .eq('created_by', profile.id)
      .in('tournament_status', ['inscripcion', 'draw', 'en_curso'])
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setMyTournaments(data || []))
  }, [profile?.id])

  function pickImage(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target?.result)
    reader.readAsDataURL(f)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      const role = profile?.role || profile?.plan || 'member'
      const limit = annLimit(role)
      if (limit < 999) {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const { count } = await supabase
          .from('announcements')
          .select('id', { count: 'exact', head: true })
          .eq('author_id', profile.id)
          .gte('created_at', since)
        if ((count || 0) >= limit) {
          const planName = role === 'free' || role === 'member' ? 'Gratis' : role.toUpperCase()
          alert(limit === 1
            ? `Los usuarios Gratuitos solo pueden tener 1 anuncio activo.\nEliminá el anterior para publicar uno nuevo.\n\n⭐ Actualizá a VIP para publicar hasta 5 anuncios por mes.`
            : `Llegaste al límite de ${limit} anuncios por mes para el plan ${planName}.\n\nUpgrade a PRO Elite para publicar sin límites.`
          )
          setSaving(false)
          return
        }
      }
      let image_url = null
      if (imageFile) image_url = await uploadImage(imageFile, profile.id)
      let pinned = isPinned
      if (pinned && selectedCommunity) {
        const { count } = await supabase
          .from('announcements')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', selectedCommunity)
          .eq('is_pinned', true)
        if ((count || 0) >= 3) { alert('Solo se permiten 3 anuncios fijados por comunidad.'); pinned = false }
      }
      const { data, error } = await supabase.from('announcements').insert({
        author_id: profile.id,
        title: title.trim(),
        body: body.trim() || null,
        image_url,
        game: game || null,
        category,
        is_pinned: pinned,
        link_url: linkUrl.trim() || null,
        link_label: linkUrl.trim() ? (linkLabel.trim() || 'Ver más') : null,
        conversation_id: selectedCommunity || null,
        tournament_id: selectedTournament || null,
      }).select('*, author:users!announcements_author_id_fkey(id, display_name, username, avatar_url), community:conversations!announcements_conversation_id_fkey(id, name, group_type)').single()
      if (error) throw new Error(error.message)
      onCreate(data)
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
    setSaving(false)
  }

  const inp = {
    width: '100%', background: C.panel2, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 14,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color .15s',
  }
  const cfgCat = CATEGORY_CFG[category] || CATEGORY_CFG.general
  const canSubmit = !saving && title.trim() && selectedCommunity

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 540, maxHeight: '96vh',
        background: C.panel, borderRadius: '24px 24px 0 0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'slideUp .3s cubic-bezier(.32,1.1,.64,1)',
      }}>

        {/* ── Flyer preview hero (ocupa todo el ancho) ── */}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickImage} />
        {imagePreview ? (
          <div style={{ position: 'relative', flexShrink: 0, lineHeight: 0, cursor: 'pointer' }}
               onClick={() => fileRef.current?.click()}>
            <img src={imagePreview} alt="flyer"
              style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />
            {/* gradient overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(0,0,0,0.75) 100%)',
            }} />
            {/* title preview on image */}
            {title && (
              <div style={{
                position: 'absolute', bottom: 14, left: 14, right: 60,
                color: '#fff', fontWeight: 900, fontSize: 17, lineHeight: 1.25,
                textShadow: '0 2px 12px rgba(0,0,0,0.9)',
              }}>{title}</div>
            )}
            {/* category chip */}
            <div style={{
              position: 'absolute', top: 12, left: 12,
              background: cfgCat.color, color: '#fff',
              fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
              letterSpacing: '.7px',
            }}>{(CATEGORIES.find(c => c.id === category)?.emoji || '') + ' ' + (CATEGORIES.find(c => c.id === category)?.label || '').toUpperCase()}</div>
            {/* change / remove buttons */}
            <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
              <div style={{
                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#fff', fontWeight: 600,
              }}>Cambiar</div>
              <button type="button" onClick={ev => { ev.stopPropagation(); setImageFile(null); setImagePreview(null) }} style={{
                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                border: 'none', borderRadius: '50%', width: 26, height: 26,
                color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} style={{
            flexShrink: 0, width: '100%', padding: '32px 0', border: 'none',
            background: `linear-gradient(135deg, ${C.panel2} 0%, ${C.panel} 100%)`,
            borderBottom: `1px solid ${C.border}`,
            cursor: 'pointer', color: C.textDim,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 40, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}>🖼️</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Subir flyer / imagen</span>
            <span style={{ fontSize: 12, color: C.textDim }}>Toca para elegir · PNG, JPG, WebP</span>
          </button>
        )}

        {/* ── Header bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        }}>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>📢 Nuevo anuncio</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* ── Scrollable form body ── */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Comunidad */}
          {myCommunities.length === 0 ? (
            <div style={{ padding: '10px 12px', background: C.panel2, borderRadius: 10, border: `1px solid ${C.border}`, color: C.textDim, fontSize: 13 }}>
              Necesitás administrar una comunidad para publicar anuncios.
            </div>
          ) : myCommunities.length === 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: `${C.green}12`, borderRadius: 10, border: `1px solid ${C.green}33` }}>
              <span style={{ fontSize: 14 }}>🌐</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{myCommunities[0].name}</span>
              <span style={{ fontSize: 11, color: C.textDim, marginLeft: 'auto' }}>Comunidad seleccionada</span>
            </div>
          ) : (
            <select value={selectedCommunity} onChange={e => setSelectedCommunity(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              <option value="">🌐 Seleccionar comunidad…</option>
              {myCommunities.map(c => (
                <option key={c.id} value={c.id}>{c.group_type === 'community' ? '🌐' : '👥'} {c.name}</option>
              ))}
            </select>
          )}

          {/* Categoría — chips visuales */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textDim, display: 'block', marginBottom: 8, letterSpacing: '.5px' }}>CATEGORÍA</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => {
                const catCfg = CATEGORY_CFG[cat.id] || CATEGORY_CFG.general
                const active = category === cat.id
                return (
                  <button key={cat.id} type="button" onClick={() => setCategory(cat.id)} style={{
                    padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${active ? catCfg.color : C.border}`,
                    background: active ? catCfg.bg : 'transparent',
                    color: active ? catCfg.color : C.textDim,
                    fontSize: 13, fontWeight: active ? 800 : 500, cursor: 'pointer',
                    transition: 'all .15s',
                  }}>
                    {cat.emoji} {cat.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Título */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textDim, display: 'block', marginBottom: 6, letterSpacing: '.5px' }}>TÍTULO *</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Torneo de eFootball — Clasificatorio Agosto"
              required style={{ ...inp, fontSize: 15, fontWeight: 700 }}
            />
          </div>

          {/* Descripción */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textDim, display: 'block', marginBottom: 6, letterSpacing: '.5px' }}>DESCRIPCIÓN</label>
            <textarea
              value={body} onChange={e => setBody(e.target.value)}
              placeholder="Detalles, fechas, premios, requisitos…"
              rows={3} style={{ ...inp, resize: 'vertical' }}
            />
          </div>

          {/* Vincular torneo/liga — aparece si la categoría aplica */}
          {(category === 'torneo' || category === 'liga') && myTournaments.length > 0 && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textDim, display: 'block', marginBottom: 6, letterSpacing: '.5px' }}>VINCULAR TORNEO / LIGA</label>
              <select value={selectedTournament} onChange={e => {
                const tid = e.target.value
                setSelectedTournament(tid)
                if (tid) {
                  const t = myTournaments.find(x => x.id === tid)
                  if (t?.community_id) setSelectedCommunity(t.community_id)
                }
              }} style={{ ...inp, cursor: 'pointer' }}>
                <option value="">Sin vincular</option>
                {myTournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.group_type === 'liga' ? '⚽' : '🏆'} {t.name}</option>
                ))}
              </select>
              {selectedTournament && (
                <p style={{ margin: '5px 0 0', fontSize: 11, color: C.green }}>
                  ✓ Se mostrará botón para abrir el torneo desde el anuncio
                </p>
              )}
            </div>
          )}

          {/* Extras colapsables */}
          <button type="button" onClick={() => setShowExtra(x => !x)} style={{
            background: 'none', border: `1px dashed ${C.border}`, borderRadius: 10,
            padding: '8px 14px', cursor: 'pointer', color: C.textDim,
            fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 14 }}>{showExtra ? '▲' : '▼'}</span>
            {showExtra ? 'Ocultar opciones extra' : 'Más opciones (juego, link, fijar)'}
          </button>

          {showExtra && (
            <>
              {/* Juego */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.textDim, display: 'block', marginBottom: 6, letterSpacing: '.5px' }}>JUEGO</label>
                <select value={game} onChange={e => setGame(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="">Sin especificar</option>
                  {GAMES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              {/* Link externo */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.textDim, display: 'block', marginBottom: 6, letterSpacing: '.5px' }}>LINK EXTERNO</label>
                <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…" style={inp} />
                {linkUrl && (
                  <input value={linkLabel} onChange={e => setLinkLabel(e.target.value)}
                    placeholder='Texto del botón ("Inscribirse", "Ver bracket"…)'
                    style={{ ...inp, marginTop: 6 }} />
                )}
              </div>

              {/* Fijar */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                padding: '10px 12px', background: C.panel2, borderRadius: 10,
                border: `1px solid ${isPinned ? C.green : C.border}`, transition: 'border-color .15s',
              }}>
                <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: C.green, cursor: 'pointer' }} />
                <div>
                  <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>📌 Fijar anuncio</div>
                  <div style={{ color: C.textDim, fontSize: 11, marginTop: 1 }}>Aparece primero (máx. 3 fijados)</div>
                </div>
              </label>
            </>
          )}

          {/* Cuota del plan */}
          {(() => {
            const role = profile?.role || profile?.plan || 'member'
            const limit = annLimit(role)
            if (limit >= 999) return null
            const isFree = limit === 1
            return (
              <div style={{ padding: '8px 12px', background: isFree ? '#f59e0b14' : `${C.green}10`, borderRadius: 10, border: `1px solid ${isFree ? '#f59e0b33' : C.green + '33'}`, fontSize: 12, color: isFree ? '#f59e0b' : C.green }}>
                {isFree
                  ? '⚠️ Plan Gratuito: 1 anuncio activo. Actualizá a VIP para hasta 5/mes.'
                  : `✓ Plan ${role.toUpperCase()}: hasta ${limit} anuncios por mes.`}
              </div>
            )
          })()}

          {/* Submit */}
          <button type="submit" disabled={!canSubmit} style={{
            padding: '14px', borderRadius: 14, border: 'none',
            cursor: canSubmit ? 'pointer' : 'default',
            background: canSubmit ? C.green : C.panel2,
            color: canSubmit ? '#000' : C.textDim,
            fontSize: 15, fontWeight: 900, transition: 'all .15s',
            boxShadow: canSubmit ? `0 4px 24px ${C.green}55` : 'none',
            letterSpacing: '.3px',
          }}>
            {saving ? '⏳ Publicando…' : imagePreview ? '🚀 Publicar flyer' : '📢 Publicar anuncio'}
          </button>
        </form>
      </div>
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  )
}

// ── Single announcement card ──────────────────────────────────────────────────
function AnnouncementCard({ ann, myId, onLike, onDelete, onViewTournament }) {
  const cfg = CATEGORY_CFG[ann.category] || CATEGORY_CFG.general
  const liked = ann.liked_by_me
  const likeCount = ann.like_count || 0
  const isAuthor = ann.author_id === myId
  const hasFlyer = !!ann.image_url

  if (hasFlyer) {
    // ── FLYER card: imagen hero con overlay, diseño visual premium ──
    return (
      <div style={{
        borderRadius: 18, overflow: 'hidden',
        boxShadow: ann.is_pinned
          ? `0 0 0 2px ${cfg.color}88, 0 8px 40px rgba(0,0,0,0.5)`
          : '0 4px 28px rgba(0,0,0,0.35)',
        position: 'relative',
        background: '#000',
      }}>
        {/* Hero image */}
        <div style={{ position: 'relative', lineHeight: 0 }}>
          <img
            src={ann.image_url} alt={ann.title}
            style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: 420 }}
          />

          {/* Dark gradient overlay bottom */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 65%, rgba(0,0,0,0.92) 100%)',
          }} />

          {/* Top chips */}
          <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {ann.is_pinned && (
                <span style={{ background: C.green, color: '#000', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, letterSpacing: '.5px' }}>
                  📌 FIJADO
                </span>
              )}
              <span style={{
                background: cfg.color, color: '#fff',
                fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                letterSpacing: '.8px', boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
              }}>
                {cfg.label.toUpperCase()}
              </span>
            </div>
            {ann.game && (
              <span style={{
                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              }}>
                🎮 {ann.game}
              </span>
            )}
          </div>

          {/* Bottom overlay: title + author + actions */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 16px 14px' }}>
            {/* Community badge */}
            {ann.community && (
              <div style={{ marginBottom: 6 }}>
                <span style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600,
                  background: 'rgba(255,255,255,0.12)', padding: '2px 9px', borderRadius: 10, backdropFilter: 'blur(4px)',
                }}>
                  {ann.community.group_type === 'community' ? '🌐' : '👥'} {ann.community.name}
                </span>
              </div>
            )}

            <h3 style={{
              margin: '0 0 10px', color: '#fff', fontWeight: 900,
              fontSize: 18, lineHeight: 1.25,
              textShadow: '0 2px 12px rgba(0,0,0,0.8)',
            }}>
              {ann.title}
            </h3>

            {/* CTA buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {ann.tournament_id && (
                <button
                  onClick={() => onViewTournament && onViewTournament(ann.tournament_id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '9px 18px', borderRadius: 10,
                    background: C.green, color: '#000', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 800,
                    boxShadow: `0 2px 16px ${C.green}77`,
                  }}
                >
                  {ann.tournament?.tournament_status === 'inscripcion'
                    ? (ann.category === 'liga' ? '⚽ Inscribirse →' : '🏆 Inscribirse →')
                    : (ann.category === 'liga' ? '⚽ Ver liga →' : '🏆 Ver torneo →')}
                </button>
              )}
              {ann.link_url && (
                <a
                  href={ann.link_url} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 10,
                    background: ann.tournament_id ? 'rgba(255,255,255,0.15)' : C.green,
                    color: '#fff',
                    fontSize: 13, fontWeight: 700, textDecoration: 'none',
                    border: 'none', backdropFilter: 'blur(8px)',
                  }}
                >
                  🔗 {ann.link_label || 'Ver más'}
                </a>
              )}
            </div>

            {/* Footer row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar name={ann.author?.display_name} url={ann.author?.avatar_url} size={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                  {ann.author?.display_name || 'Anónimo'}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginLeft: 6 }}>{timeAgo(ann.created_at)}</span>
              </div>

              <button
                onClick={() => onLike(ann)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: liked ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.12)',
                  border: 'none', borderRadius: 20, padding: '5px 11px', cursor: 'pointer',
                  color: liked ? '#f87171' : 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600,
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span>{liked ? '❤️' : '🤍'}</span>
                {likeCount > 0 && <span style={{ fontSize: 12 }}>{likeCount}</span>}
              </button>

              {isAuthor && (
                <button
                  onClick={() => onDelete(ann.id)}
                  style={{
                    background: 'rgba(255,255,255,0.1)', border: 'none',
                    borderRadius: 20, padding: '5px 10px', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.55)', fontSize: 12, backdropFilter: 'blur(8px)',
                  }}
                >
                  🗑
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Body text below image (only if has text) */}
        {ann.body && (
          <div style={{ background: C.panel, padding: '12px 16px 14px', borderTop: `1px solid ${C.border}` }}>
            <p style={{ margin: 0, color: C.text2, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ann.body}</p>
          </div>
        )}
      </div>
    )
  }

  // ── Standard card (no image) ──
  return (
    <div style={{
      background: C.panel, borderRadius: 16, overflow: 'hidden',
      border: `1px solid ${ann.is_pinned ? cfg.color + '44' : C.border}`,
      boxShadow: ann.is_pinned ? `0 0 0 1px ${cfg.color}33, 0 4px 24px rgba(0,0,0,0.2)` : '0 2px 12px rgba(0,0,0,0.12)',
    }}>
      {ann.is_pinned && (
        <div style={{ background: `${C.green}18`, padding: '6px 14px', borderBottom: `1px solid ${C.green}22`, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>📌</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: '.5px' }}>FIJADO</span>
        </div>
      )}

      <div style={{ padding: '14px 16px 12px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>
            {cfg.label}
          </span>
          {ann.game && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: C.panel2, color: C.textDim }}>🎮 {ann.game}</span>}
          {ann.community && (
            <span style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 600, background: '#8b5cf614', padding: '2px 9px', borderRadius: 20 }}>
              {ann.community.group_type === 'community' ? '🌐' : '👥'} {ann.community.name}
            </span>
          )}
        </div>

        <h3 style={{ margin: '0 0 8px', color: C.text, fontWeight: 800, fontSize: 16, lineHeight: 1.3 }}>{ann.title}</h3>

        {ann.body && (
          <p style={{ margin: '0 0 12px', color: C.text2, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ann.body}</p>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: ann.link_url || ann.tournament_id ? 12 : 0 }}>
          {ann.tournament_id && (
            <button
              onClick={() => onViewTournament && onViewTournament(ann.tournament_id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', borderRadius: 10,
                background: C.green, color: C.bg, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 800,
                boxShadow: `0 2px 14px ${C.green}55`,
              }}
            >
              {ann.tournament?.tournament_status === 'inscripcion'
                ? (ann.category === 'liga' ? '⚽ Inscribirse a la liga →' : '🏆 Inscribirse al torneo →')
                : (ann.category === 'liga' ? '⚽ Ver liga →' : '🏆 Ver torneo →')}
            </button>
          )}
          {ann.link_url && (
            <a
              href={ann.link_url} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', borderRadius: 10,
                background: ann.tournament_id ? C.panel2 : C.green,
                color: ann.tournament_id ? C.text2 : C.bg,
                fontSize: 13, fontWeight: 700, textDecoration: 'none',
                border: ann.tournament_id ? `1px solid ${C.border}` : 'none',
                boxShadow: !ann.tournament_id ? `0 2px 10px ${C.green}44` : 'none',
              }}
            >
              🔗 {ann.link_label || 'Ver más'}
            </a>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <Avatar name={ann.author?.display_name} url={ann.author?.avatar_url} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text2 }}>{ann.author?.display_name || 'Anónimo'}</span>
            <span style={{ display: 'block', fontSize: 11, color: C.textDim }}>{timeAgo(ann.created_at)}</span>
          </div>

          <button
            onClick={() => onLike(ann)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: liked ? `${C.red}15` : C.panel2,
              border: `1px solid ${liked ? C.red + '44' : C.border}`,
              borderRadius: 20, padding: '5px 11px', cursor: 'pointer',
              color: liked ? C.red : C.textDim, fontSize: 13, fontWeight: 600,
              transition: 'all .15s',
            }}
          >
            <span>{liked ? '❤️' : '🤍'}</span>
            {likeCount > 0 && <span style={{ fontSize: 12 }}>{likeCount}</span>}
          </button>

          {isAuthor && (
            <button
              onClick={() => onDelete(ann.id)}
              style={{
                background: 'none', border: `1px solid ${C.border}`,
                borderRadius: 20, padding: '5px 10px', cursor: 'pointer',
                color: C.textDim, fontSize: 12, fontWeight: 600,
              }}
            >
              🗑
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AnnouncementsPage() {
  const { profile } = useAuthStore()
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [category, setCategory] = useState('torneo')
  const [showForm, setShowForm] = useState(false)
  const [likedSet, setLikedSet] = useState(new Set())
  const [likeCounts, setLikeCounts] = useState({})
  const [canPublish, setCanPublish] = useState(false)
  const [viewingTournamentId, setViewingTournamentId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('announcements')
      .select('*, author:users!announcements_author_id_fkey(id, display_name, username, avatar_url), community:conversations!announcements_conversation_id_fkey(id, name, group_type), tournament:conversations!announcements_tournament_id_fkey(id, name, tournament_status, group_type)')
      .eq('is_active', true)
      .is('conversation_id', null)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)

    q = q.eq('category', category)

    const { data } = await q
    const list = data || []

    // Load likes
    if (list.length && profile?.id) {
      const ids = list.map(a => a.id)
      const { data: likes } = await supabase
        .from('announcement_likes')
        .select('announcement_id')
        .eq('user_id', profile.id)
        .in('announcement_id', ids)

      const myLikes = new Set((likes || []).map(l => l.announcement_id))
      setLikedSet(myLikes)

      // Count likes per announcement
      const { data: counts } = await supabase
        .from('announcement_likes')
        .select('announcement_id')
        .in('announcement_id', ids)

      const cMap = {}
      ;(counts || []).forEach(r => { cMap[r.announcement_id] = (cMap[r.announcement_id] || 0) + 1 })
      setLikeCounts(cMap)

      setItems(list.map(a => ({ ...a, liked_by_me: myLikes.has(a.id), like_count: cMap[a.id] || 0 })))
    } else {
      setItems(list)
    }
    setLoading(false)
  }, [category, profile?.id])

  useEffect(() => { load() }, [load])

  // Can publish: roles con plan pago o que administran una comunidad
  useEffect(() => {
    if (!profile?.id) return
    const role = profile.role || profile.plan || 'member'
    // Todos pueden publicar (gratis con límite de 1, pago con límites más altos)
    setCanPublish(true)
  }, [profile?.id, profile?.role])

  // Realtime — new announcements
  useEffect(() => {
    const ch = supabase
      .channel('announcements:feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, () => load())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcements' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  async function handleLike(ann) {
    if (!profile?.id) return
    const wasLiked = likedSet.has(ann.id)
    // Optimistic update
    setLikedSet(prev => {
      const s = new Set(prev); wasLiked ? s.delete(ann.id) : s.add(ann.id); return s
    })
    setItems(prev => prev.map(a => a.id === ann.id
      ? { ...a, liked_by_me: !wasLiked, like_count: Math.max(0, (a.like_count || 0) + (wasLiked ? -1 : 1)) }
      : a
    ))
    if (wasLiked) {
      await supabase.from('announcement_likes').delete()
        .eq('announcement_id', ann.id).eq('user_id', profile.id)
    } else {
      await supabase.from('announcement_likes').upsert(
        { announcement_id: ann.id, user_id: profile.id },
        { onConflict: 'announcement_id,user_id' }
      )
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este anuncio?')) return
    await supabase.from('announcements').delete().eq('id', id)
    setItems(prev => prev.filter(a => a.id !== id))
  }

  function handleCreate(ann) {
    setItems(prev => [{ ...ann, liked_by_me: false, like_count: 0 }, ...prev])
    setShowForm(false)
  }

  if (viewingTournamentId) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={() => setViewingTournamentId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>Torneo</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <TournamentDashboard tournamentId={viewingTournamentId} profile={profile} isAdmin={false} onBack={() => setViewingTournamentId(null)} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📢</span>
            <span style={{ color: C.text, fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px' }}>Anuncios</span>
          </div>
          {canPublish ? (
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: C.green, border: 'none', borderRadius: 10,
                padding: '7px 14px', cursor: 'pointer',
                color: C.bg, fontSize: 13, fontWeight: 700,
                boxShadow: `0 2px 10px ${C.green}44`,
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Publicar
            </button>
          ) : (
            <div style={{ fontSize: 11, color: C.textDim, padding: '6px 10px', borderRadius: 8, background: C.panel2, border: `1px solid ${C.border}` }}>
              Solo admins de comunidades
            </div>
          )}
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', overflowX: 'auto', padding: '0 12px 10px', gap: 6 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              style={{
                flexShrink: 0, padding: '5px 12px', borderRadius: 20,
                border: `1px solid ${category === cat.id ? C.green : C.border}`,
                background: category === cat.id ? `${C.green}18` : C.panel2,
                color: category === cat.id ? C.green : C.textDim,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'all .15s', whiteSpace: 'nowrap',
              }}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {loading && (
          <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 24px', gap: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 52 }}>📢</div>
            <p style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>Sin anuncios aún</p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13, maxWidth: 260, lineHeight: 1.5 }}>
              {`No hay anuncios de "${CATEGORIES.find(c => c.id === category)?.label}" todavía. ¡Sé el primero!`}
            </p>
            {canPublish && (
              <button onClick={() => setShowForm(true)} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: C.green, color: C.bg, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: `0 2px 12px ${C.green}33` }}>
                + Publicar anuncio
              </button>
            )}
            {!canPublish && (
              <p style={{ color: C.textDim, fontSize: 12, margin: 0 }}>Solo organizadores con grupos o comunidades pueden publicar</p>
            )}
          </div>
        )}

        {!loading && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto' }}>
            {items.map(ann => (
              <AnnouncementCard
                key={ann.id}
                ann={ann}
                myId={profile?.id}
                onLike={handleLike}
                onDelete={handleDelete}
                onViewTournament={setViewingTournamentId}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && <NewAnnouncementForm onClose={() => setShowForm(false)} onCreate={handleCreate} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  )
}
