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
const CATEGORIES = [
  { id: 'all',     label: 'Todo',      emoji: '📢' },
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
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [game, setGame]         = useState('')
  const [category, setCategory] = useState('general')
  const [linkUrl, setLinkUrl]   = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [myCommunities, setMyCommunities] = useState([])
  const [selectedCommunity, setSelectedCommunity] = useState('')
  const [myTournaments, setMyTournaments] = useState([])
  const [selectedTournament, setSelectedTournament] = useState('')
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
    // Load user's tournaments for linking
    supabase
      .from('conversations')
      .select('id, name, group_type, tournament_status')
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
      let image_url = null
      if (imageFile) {
        image_url = await uploadImage(imageFile, profile.id)
      }
      const { data, error } = await supabase.from('announcements').insert({
        author_id: profile.id,
        title: title.trim(),
        body: body.trim() || null,
        image_url,
        game: game || null,
        category,
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

  const inputStyle = {
    width: '100%', background: C.panel2, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 14,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color .15s',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 520, maxHeight: '92vh',
        background: C.panel, borderRadius: '20px 20px 0 0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'slideUp .25s ease',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>📢 Nuevo Anuncio</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Image/Flyer */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 8 }}>Flyer / Imagen</label>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickImage} />
            {imagePreview ? (
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
                <img src={imagePreview} alt="preview" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }} style={{
                  position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)',
                  border: 'none', borderRadius: '50%', width: 28, height: 28,
                  color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} style={{
                width: '100%', padding: '28px 0', borderRadius: 12, border: `2px dashed ${C.border}`,
                background: C.panel2, cursor: 'pointer', color: C.textDim, fontSize: 13,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 28 }}>🖼️</span>
                <span>Tocá para subir un flyer</span>
              </button>
            )}
          </div>

          {/* Comunidad origen */}
          {myCommunities.length > 0 && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 6 }}>Publicar como</label>
              <select value={selectedCommunity} onChange={e => setSelectedCommunity(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">Mi perfil (sin comunidad)</option>
                {myCommunities.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.group_type === 'community' ? '🌐' : '👥'} {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 6 }}>Título *</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Torneo de eFootball — Clasificatorio Agosto"
              required style={inputStyle}
            />
          </div>

          {/* Body */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 6 }}>Descripción</label>
            <textarea
              value={body} onChange={e => setBody(e.target.value)}
              placeholder="Detalles del torneo, fechas, premios..."
              rows={4} style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Category + Game row */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 6 }}>Categoría</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 6 }}>Juego</label>
              <select value={game} onChange={e => setGame(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">Sin especificar</option>
                {GAMES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          {/* Link torneo */}
          {(category === 'torneo' || category === 'liga') && myTournaments.length > 0 && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 6 }}>Vincular torneo/liga (opcional)</label>
              <select value={selectedTournament} onChange={e => setSelectedTournament(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">Sin vincular</option>
                {myTournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.group_type === 'liga' ? '⚽' : '🏆'} {t.name}</option>
                ))}
              </select>
              {selectedTournament && <p style={{ margin: '4px 0 0', fontSize: 11, color: C.green }}>✓ Se mostrará botón "Ver torneo →" en el anuncio</p>}
            </div>
          )}

          {/* Link */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 6 }}>Link externo (opcional)</label>
            <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://forms.google.com/..." style={inputStyle} />
            {linkUrl && (
              <input value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder='Etiqueta del botón ("Inscribirse", "Ver bracket")' style={{ ...inputStyle, marginTop: 6 }} />
            )}
          </div>

          {/* Submit */}
          <button type="submit" disabled={saving || !title.trim()} style={{
            padding: '13px', borderRadius: 12, border: 'none', cursor: saving || !title.trim() ? 'default' : 'pointer',
            background: saving || !title.trim() ? C.panel2 : C.green,
            color: saving || !title.trim() ? C.textDim : C.bg,
            fontSize: 14, fontWeight: 800, transition: 'all .15s',
            boxShadow: !saving && title.trim() ? `0 4px 20px ${C.green}44` : 'none',
          }}>
            {saving ? 'Publicando...' : '📢 Publicar anuncio'}
          </button>
        </form>
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  )
}

// ── Single announcement card ──────────────────────────────────────────────────
function AnnouncementCard({ ann, myId, onLike, onDelete, onViewTournament }) {
  const cfg = CATEGORY_CFG[ann.category] || CATEGORY_CFG.general
  const liked = ann.liked_by_me
  const likeCount = ann.like_count || 0
  const isAuthor = ann.author_id === myId
  const hasTournament = ann.tournament_id || (ann.category === 'torneo' && ann.community?.id)

  return (
    <div style={{
      background: C.panel, borderRadius: 16, overflow: 'hidden',
      border: `1px solid ${C.border}`,
      boxShadow: ann.is_pinned ? `0 0 0 2px ${C.green}44, 0 4px 24px rgba(0,0,0,0.2)` : '0 2px 12px rgba(0,0,0,0.12)',
    }}>
      {/* Pinned badge */}
      {ann.is_pinned && (
        <div style={{ background: `${C.green}18`, padding: '6px 14px', borderBottom: `1px solid ${C.green}22`, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>📌</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: '.5px' }}>FIJADO</span>
        </div>
      )}

      {/* Flyer image */}
      {ann.image_url && (
        <div style={{ position: 'relative' }}>
          <img
            src={ann.image_url} alt={ann.title}
            style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }}
          />
          {/* Category chip over image */}
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: cfg.color, color: '#fff',
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            {cfg.label.toUpperCase()}
          </div>
          {ann.game && (
            <div style={{
              position: 'absolute', top: 10, right: 10,
              background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(4px)',
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            }}>
              🎮 {ann.game}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: '14px 16px 12px' }}>
        {/* Category chip (no image case) */}
        {!ann.image_url && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>
              {cfg.label}
            </span>
            {ann.game && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: C.panel2, color: C.textDim }}>🎮 {ann.game}</span>}
          </div>
        )}

        {/* Title */}
        <h3 style={{ margin: '0 0 8px', color: C.text, fontWeight: 800, fontSize: 16, lineHeight: 1.3 }}>{ann.title}</h3>

        {/* Body */}
        {ann.body && (
          <p style={{ margin: '0 0 12px', color: C.text2, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ann.body}</p>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: ann.link_url || ann.tournament_id ? 12 : 0 }}>
          {ann.tournament_id && (
            <button
              onClick={() => onViewTournament && onViewTournament(ann.tournament_id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', borderRadius: 10,
                background: C.green, color: C.bg, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                boxShadow: `0 2px 10px ${C.green}44`,
              }}
            >
              {ann.category === 'liga' ? '⚽ Ver liga →' : '🏆 Ver torneo →'}
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

        {/* Footer: author + community + time + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <Avatar name={ann.author?.display_name} url={ann.author?.avatar_url} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text2 }}>{ann.author?.display_name || 'Anónimo'}</span>
              {ann.community && (
                <span style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 600, background: '#8b5cf614', padding: '1px 7px', borderRadius: 10 }}>
                  {ann.community.group_type === 'community' ? '🌐' : '👥'} {ann.community.name}
                </span>
              )}
            </div>
            <span style={{ fontSize: 11, color: C.textDim }}>{timeAgo(ann.created_at)}</span>
          </div>

          {/* Like */}
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

          {/* Delete (author only) */}
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
  const [category, setCategory] = useState('all')
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
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)

    if (category !== 'all') q = q.eq('category', category)

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

  // Check if user can publish announcements
  useEffect(() => {
    if (!profile?.id) return
    // Role-based check first (ceo, admin, organizador, vip, comunidad can publish)
    if (canPublishAnnouncements(profile)) { setCanPublish(true); return }
    // Fallback: also allow if user owns/admins at least one group or community
    supabase
      .from('group_roles')
      .select('conversation_id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .in('role', ['owner', 'admin'])
      .then(({ count }) => setCanPublish((count || 0) > 0))
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
              Solo organizadores
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
              {category === 'all'
                ? 'Sé el primero en publicar un torneo, liga o evento de la comunidad.'
                : `No hay anuncios de tipo "${CATEGORIES.find(c => c.id === category)?.label}" todavía.`}
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
