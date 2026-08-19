import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { C } from '../theme'
import BannerAd from '../components/BannerAd'

const AVATAR_COLORS = ['#e91e63','#9c27b0','#1565c0','#00838f','#2e7d32','#e65100','#c62828']
function avatarColor(id) {
  if (!id) return C.panel2
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function Avatar({ name, url, size = 52 }) {
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{
        width: size, height: size, borderRadius: 14, flexShrink: 0,
        background: avatarColor(name),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.36, fontWeight: 800, color: '#fff',
      }}>{name?.slice(0, 2).toUpperCase() || '?'}</div>
}

const GAME_CATALOG = {
  efootball: { label: 'eFootball', icon: '⚽' },
  fc26:      { label: 'FC 26',     icon: '⚽' },
  fc27:      { label: 'FC 27',     icon: '⚽' },
  valorant:  { label: 'Valorant',  icon: '🎯' },
  cs2:       { label: 'CS2',       icon: '🎯' },
  warzone:   { label: 'Warzone',   icon: '🔫' },
  pubg:      { label: 'PUBG',      icon: '🔫' },
  freef:     { label: 'Free Fire', icon: '🔥' },
  clashroyale: { label: 'Clash Royale', icon: '👑' },
}

const TOURNAMENT_STATUS = {
  open:       { label: 'Inscripciones abiertas', color: '#22c55e', bg: '#22c55e18' },
  in_progress:{ label: 'En curso',               color: '#f59e0b', bg: '#f59e0b18' },
  finished:   { label: 'Finalizado',             color: '#6b7280', bg: '#6b728018' },
  upcoming:   { label: 'Próximamente',           color: '#3b82f6', bg: '#3b82f618' },
}

const TABS = [
  { id: 'community', label: 'Comunidades', emoji: '🌐' },
  { id: 'group',     label: 'Grupos',      emoji: '👥' },
  { id: 'tournament',label: 'Torneos',     emoji: '🏆' },
  { id: 'event',     label: 'Eventos',     emoji: '📅' },
]

const EVENT_TYPE_CFG = {
  general:     { label: 'General',    icon: '📢' },
  competitive: { label: 'Competitivo',icon: '⚔️' },
  special:     { label: 'Especial',   icon: '⭐' },
  meeting:     { label: 'Reunión',    icon: '🤝' },
}

const GAMES_FILTER = [
  { id: '', label: 'Todos' },
  ...Object.entries(GAME_CATALOG).map(([id, cfg]) => ({ id: cfg.label, label: `${cfg.icon} ${cfg.label}` }))
]

export default function DiscoverPage() {
  const { profile } = useAuthStore()
  const { fetchConversations, setActiveConversation } = useChatStore()

  const [tab, setTab] = useState('community')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [gameFilter, setGameFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [joined, setJoined] = useState(new Set())
  const [joining, setJoining] = useState(null)

  // ── load items según tab activo ───────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)

    if (tab === 'tournament') {
      let q = supabase
        .from('conversations')
        .select('id, name, description, avatar_url, group_type, member_count, tags, is_group, created_at, status, game, max_participants, created_by')
        .eq('is_group', true)
        .eq('is_public', true)
        .eq('group_type', 'tournament')
        .order('created_at', { ascending: false })
        .limit(60)

      if (search.trim()) q = q.ilike('name', `%${search.trim()}%`)
      if (gameFilter)    q = q.eq('game', gameFilter)
      if (statusFilter)  q = q.eq('status', statusFilter)

      const { data } = await q
      setItems(data || [])
    } else if (tab === 'event') {
      let q = supabase
        .from('events')
        .select('id, title, description, event_type, start_at, end_at, location, max_participants, is_public, created_by, conversation_id, conversations(name)')
        .eq('is_active', true)
        .eq('is_public', true)
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true })
        .limit(60)

      if (search.trim()) q = q.ilike('title', `%${search.trim()}%`)

      const { data } = await q
      setItems(data || [])
    } else {
      let q = supabase
        .from('conversations')
        .select('id, name, description, avatar_url, group_type, member_count, tags, is_group, created_at, game, created_by, is_public, is_locked, who_can_send, who_can_add, who_can_edit_info, require_approval, announcement_only, torneos_enabled, ligas_enabled, clanes_enabled, invite_link, pinned_message')
        .eq('is_group', true)
        .eq('is_public', true)
        .eq('group_type', tab)
        .order('member_count', { ascending: false })
        .limit(60)

      if (search.trim()) q = q.ilike('name', `%${search.trim()}%`)

      const { data } = await q
      setItems(data || [])
    }

    setLoading(false)
  }, [tab, search, gameFilter, statusFilter])

  // Load mis membresías
  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', profile.id)
      .then(({ data }) => setJoined(new Set((data || []).map(r => r.conversation_id))))
  }, [profile?.id])

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  // Reset filtros al cambiar tab
  useEffect(() => {
    setGameFilter('')
    setStatusFilter('')
    setSearch('')
  }, [tab])

  async function joinGroup(group) {
    if (!profile?.id || joining) return
    setJoining(group.id)
    try {
      const isCommunity = group.group_type === 'community'
      if (isCommunity) {
        // Usar RPC para validar límites de capacidad
        const { data, error } = await supabase.rpc('join_community', { p_conversation_id: group.id })
        if (error || !data?.ok) {
          const msg = data?.error === 'capacity_reached'
            ? `Esta comunidad llegó al límite de ${data.max} miembros.`
            : 'No se pudo unir a la comunidad.'
          alert(msg)
          setJoining(null)
          return
        }
      } else {
        await supabase.from('conversation_members').upsert(
          { conversation_id: group.id, user_id: profile.id },
          { onConflict: 'conversation_id,user_id' }
        )
      }
      setJoined(prev => new Set([...prev, group.id]))
      fetchConversations(profile.id)
    } catch {}
    setJoining(null)
  }

  function openGroup(group) {
    setActiveConversation({
      ...group,
      isGroup: true,
      isCommunity: group.group_type === 'community',
    })
  }

  const isJoined = id => joined.has(id)

  // ── Render de una tarjeta según tab ──────────────────────────────────────────
  function renderCard(item, i) {
    const isMine = isJoined(item.id)
    const isLoading = joining === item.id

    if (tab === 'event') {
      const cfg = EVENT_TYPE_CFG[item.event_type] || EVENT_TYPE_CFG.general
      const startDate = new Date(item.start_at)
      const dateStr = startDate.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
      const timeStr = startDate.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
      const isPast = startDate < new Date()

      return (
        <div key={item.id} style={{
          background: C.panel, borderRadius: 16, overflow: 'hidden',
          border: `1px solid ${C.border}`, marginBottom: 10,
          opacity: isPast ? 0.6 : 1,
        }}>
          <div style={{
            background: `${isPast ? '#6b728018' : '#3b82f618'}`,
            padding: '5px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: isPast ? C.textDim : '#3b82f6' }}>
              {cfg.icon} {cfg.label}
            </span>
            {item.conversations?.name && (
              <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>
                🌐 {item.conversations.name}
              </span>
            )}
          </div>

          <div style={{ padding: '12px 16px' }}>
            <p style={{ margin: '0 0 6px', color: C.text, fontWeight: 800, fontSize: 14 }}>{item.title}</p>
            {item.description && (
              <p style={{ margin: '0 0 8px', color: C.textDim, fontSize: 12, lineHeight: 1.5 }}>{item.description}</p>
            )}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.text2 }}>📅 {dateStr} · {timeStr}</span>
              {item.location && <span style={{ fontSize: 12, color: C.text2 }}>📍 {item.location}</span>}
              {item.max_participants && (
                <span style={{ fontSize: 12, color: C.text2 }}>👥 Hasta {item.max_participants} participantes</span>
              )}
            </div>
          </div>
        </div>
      )
    }

    if (tab === 'tournament') {
      const gameInfo = Object.values(GAME_CATALOG).find(g => g.label === item.game)
      const status = TOURNAMENT_STATUS[item.status] || TOURNAMENT_STATUS.open
      const members = item.member_count || 0
      const maxP = item.max_participants || '?'

      return (
        <div key={item.id} style={{
          background: C.panel, borderRadius: 16, overflow: 'hidden',
          border: `1px solid ${C.border}`,
          marginBottom: 10,
        }}>
          {/* Status bar */}
          <div style={{
            background: status.bg, padding: '5px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: status.color }}>
              {status.label}
            </span>
            {item.game && (
              <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>
                {gameInfo ? `${gameInfo.icon} ${item.game}` : `🎮 ${item.game}`}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
            <Avatar name={item.name} url={item.avatar_url} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 14, marginBottom: 2 }}>
                {item.name}
              </div>
              {item.description && (
                <p style={{ margin: '0 0 4px', color: C.textDim, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: C.textDim }}>
                  👥 {members}/{maxP}
                </span>
                {item.created_at && (
                  <span style={{ fontSize: 11, color: C.textDim }}>
                    📅 {new Date(item.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => isMine ? openGroup(item) : joinGroup(item)}
              disabled={!!isLoading}
              style={{
                padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: isMine ? `${C.green}20` : C.green,
                color: isMine ? C.green : C.bg,
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                opacity: isLoading ? 0.6 : 1,
                boxShadow: isMine ? 'none' : `0 2px 8px ${C.green}33`,
              }}
            >
              {isLoading ? '...' : isMine ? 'Ver' : 'Unirse'}
            </button>
          </div>
        </div>
      )
    }

    // Comunidad / Grupo
    const typeLabel = tab === 'community' ? 'Comunidad' : 'Grupo'
    const typeColor = tab === 'community' ? '#8b5cf6' : C.green
    const members = item.member_count || 0

    // Parse tags for game display
    const rawTags = Array.isArray(item.tags) ? item.tags : (typeof item.tags === 'string' ? (item.tags.startsWith('[') ? JSON.parse(item.tags) : item.tags.split(',').map(t => t.trim())) : [])
    const knownGameKeys = Object.keys(GAME_CATALOG)
    const gameTags = rawTags.filter(t => knownGameKeys.includes(t.toLowerCase()))

    return (
      <div
        key={item.id}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '12px 16px',
          borderBottom: i < items.length - 1 ? `1px solid ${C.border}22` : 'none',
          transition: 'background .12s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = C.panel}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <button
          onClick={() => isMine ? openGroup(item) : null}
          style={{ background: 'none', border: 'none', padding: 0, cursor: isMine ? 'pointer' : 'default', flexShrink: 0 }}
        >
          <Avatar name={item.name} url={item.avatar_url} size={52} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ color: C.text, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
              {item.name}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
              background: `${typeColor}20`, color: typeColor, flexShrink: 0,
            }}>
              {typeLabel}
            </span>
          </div>
          {item.description && (
            <p style={{ margin: '2px 0 0', color: C.textDim, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.description}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ color: C.textDim, fontSize: 11 }}>
              {members > 0 ? `👥 ${members.toLocaleString()} miembro${members !== 1 ? 's' : ''}` : '👥 Sin miembros aún'}
            </span>
            {gameTags.map(t => {
              const g = GAME_CATALOG[t.toLowerCase()]
              return g ? (
                <span key={t} style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: `${C.green}15`, color: C.green, border: `1px solid ${C.green}30` }}>
                  {g.icon} {g.label}
                </span>
              ) : null
            })}
          </div>
        </div>

        {isMine ? (
          <button onClick={() => openGroup(item)} style={{
            padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: `${C.green}20`, color: C.green, fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>Abrir</button>
        ) : (
          <button onClick={() => joinGroup(item)} disabled={!!isLoading} style={{
            padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: C.green, color: C.bg, fontSize: 12, fontWeight: 700, flexShrink: 0,
            opacity: isLoading ? 0.6 : 1,
            boxShadow: `0 2px 8px ${C.green}33`,
          }}>
            {isLoading ? '...' : 'Unirse'}
          </button>
        )}
      </div>
    )
  }

  // ── Filtros de torneos ────────────────────────────────────────────────────────
  const showTournamentFilters = tab === 'tournament'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 10px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
          </svg>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px' }}>Explorar</span>
        </div>

        {/* Search */}
        <div style={{ padding: '0 16px 10px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: C.panel2, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '0 12px',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder={`Buscar ${tab === 'community' ? 'comunidades' : tab === 'group' ? 'grupos' : tab === 'tournament' ? 'torneos' : 'eventos'}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 14, padding: '9px 0' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 0, fontSize: 13 }}>✕</button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', padding: '0 16px' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 0', fontSize: 12, fontWeight: 600,
              color: tab === t.id ? C.green : C.textDim,
              borderBottom: `2px solid ${tab === t.id ? C.green : 'transparent'}`,
              transition: 'color .15s, border-color .15s',
            }}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {/* Filtros de torneos */}
        {showTournamentFilters && (
          <div style={{ display: 'flex', gap: 8, padding: '8px 16px', overflowX: 'auto' }}>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.text, fontSize: 12, padding: '5px 10px', outline: 'none', cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <option value="">Estado: Todos</option>
              <option value="open">Inscripciones abiertas</option>
              <option value="in_progress">En curso</option>
              <option value="upcoming">Próximamente</option>
              <option value="finished">Finalizados</option>
            </select>
            <select
              value={gameFilter}
              onChange={e => setGameFilter(e.target.value)}
              style={{
                background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.text, fontSize: 12, padding: '5px 10px', outline: 'none', cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {GAMES_FILTER.map(g => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading && (
          <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 32px', gap: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}>
              {tab === 'community' ? '🌐' : tab === 'group' ? '👥' : tab === 'tournament' ? '🏆' : '📅'}
            </div>
            <p style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>
              {search ? `Sin resultados para "${search}"` :
               tab === 'community' ? 'No hay comunidades públicas aún' :
               tab === 'group'     ? 'No hay grupos públicos aún' :
               tab === 'tournament'? 'No hay torneos públicos aún' :
                                    'No hay eventos próximos'}
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13, lineHeight: 1.5, maxWidth: 260 }}>
              {search ? 'Probá con otro nombre o quitá los filtros.' :
               tab === 'tournament' ? 'Los torneos públicos aparecen acá para que cualquiera pueda unirse.' :
               tab === 'event'      ? 'Los eventos públicos de comunidades aparecen acá.' :
               'Los grupos y comunidades públicas aparecen acá cuando sus creadores los hacen visibles.'}
            </p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <BannerAd position="explorar" style={{ margin: '4px 12px 8px' }} />

            {tab === 'tournament' || tab === 'event' ? (
              <div style={{ padding: '0 12px' }}>
                {items.map((item, i) => renderCard(item, i))}
              </div>
            ) : (
              items.map((item, i) => renderCard(item, i))
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
