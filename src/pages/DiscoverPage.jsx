import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { C } from '../theme'
import BannerAd from '../components/BannerAd'
import TournamentDashboard from '../components/TournamentDashboard'

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
  inscripcion: { label: 'Inscripciones abiertas', color: '#22c55e', bg: '#22c55e18' },
  en_curso:    { label: 'En curso',               color: '#f59e0b', bg: '#f59e0b18' },
  finalizado:  { label: 'Finalizado',             color: '#6b7280', bg: '#6b728018' },
  cancelado:   { label: 'Cancelado',              color: '#ef4444', bg: '#ef444418' },
  draw:        { label: 'Sorteo',                 color: '#8b5cf6', bg: '#8b5cf618' },
  proximamente:{ label: 'Próximamente',           color: '#3b82f6', bg: '#3b82f618' },
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

  const [myCommunities, setMyCommunities] = useState([])
  const [myTournaments, setMyTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [joined, setJoined] = useState(new Set())
  const [pending, setPending] = useState(new Set())
  const [joining, setJoining] = useState(null)
  const [viewingTournament, setViewingTournament] = useState(null)
  const [activeSection, setActiveSection] = useState('comunidades') // 'comunidades' | 'participando'

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)

    // My memberships
    const { data: memberships } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', profile.id)
    const myIds = (memberships || []).map(m => m.conversation_id)
    setJoined(new Set(myIds))

    if (!myIds.length) { setMyCommunities([]); setMyTournaments([]); setLoading(false); return }

    // Fetch conversation metadata for all my conversations
    const { data: convRows } = await supabase
      .from('conversations')
      .select('id, name, description, avatar_url, group_type, tags, created_at, game, created_by, tournament_status, max_participants')
      .in('id', myIds)
      .order('created_at', { ascending: false })

    const rows = convRows || []
    const communities = rows.filter(c => c.group_type === 'community')
    const tournaments = rows.filter(c => c.group_type === 'tournament' || c.group_type === 'liga')

    const filtered = (list) => search.trim()
      ? list.filter(c => c.name?.toLowerCase().includes(search.trim().toLowerCase()))
      : list

    setMyCommunities(filtered(communities))
    setMyTournaments(filtered(tournaments))
    setLoading(false)
  }, [profile?.id, search])

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0)
    return () => clearTimeout(t)
  }, [load])

  async function joinGroup(group) {
    if (!profile?.id || joining) return
    setJoining(group.id)
    try {
      const isCommunity = group.group_type === 'community'
      if (isCommunity) {
        const { data, error } = await supabase.rpc('request_join_community', {
          p_community_id: group.id,
          p_message: null,
        })
        if (error) {
          // RPC fallback → direct insert (communities without requires_approval)
          await supabase.from('conversation_members').upsert(
            { conversation_id: group.id, user_id: profile.id },
            { onConflict: 'conversation_id,user_id' }
          )
          setJoined(prev => new Set([...prev, group.id]))
        } else if (data?.success) {
          if (data.joined) {
            setJoined(prev => new Set([...prev, group.id]))
            fetchConversations(profile.id)
          } else if (data.pending) {
            setPending(prev => new Set([...prev, group.id]))
          }
        } else if (data?.error === 'Ya sos miembro') {
          setJoined(prev => new Set([...prev, group.id]))
        } else {
          alert(data?.error || 'No se pudo unir a la comunidad.')
        }
      } else {
        await supabase.from('conversation_members').upsert(
          { conversation_id: group.id, user_id: profile.id },
          { onConflict: 'conversation_id,user_id' }
        )
        setJoined(prev => new Set([...prev, group.id]))
        fetchConversations(profile.id)
        if (group.group_type === 'tournament' || group.group_type === 'liga') {
          setViewingTournament(group)
        }
      }
    } catch {}
    setJoining(null)
  }

  function openGroup(group) {
    if (group.group_type === 'tournament' || group.group_type === 'liga') {
      setViewingTournament(group)
      return
    }
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

    if (false) { // events removed
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

    if (activeSection === 'participando') {
      const gameInfo = Object.values(GAME_CATALOG).find(g => g.label === item.game) || (item.game ? { icon: '🎮', label: item.game } : null)
      const status = TOURNAMENT_STATUS[item.tournament_status] || TOURNAMENT_STATUS.inscripcion
      const members = item.participant_count || 0
      const maxP = item.max_participants || '?'
      const isLiga = item.group_type === 'liga'

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>{item.name}</span>
                {isLiga && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#10b98118', color: '#10b981' }}>LIGA</span>}
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
    const isPending = pending.has(item.id)
    const isPrivate = item.requires_approval === true
    const typeLabel = item.group_type === 'community' ? 'Comunidad' : 'Grupo'
    const typeColor = item.group_type === 'community' ? '#8b5cf6' : C.green
    const members = item.participant_count || 0

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
              {isPrivate && <span style={{ marginRight: 4 }}>🔒</span>}{item.name}
            </span>
            {item.is_official && (
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20,
                background: 'linear-gradient(90deg, #3b82f620, #6366f120)',
                color: '#6366f1', border: '1px solid #6366f140', flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                ✦ OFICIAL
              </span>
            )}
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
        ) : isPending ? (
          <button disabled style={{
            padding: '7px 14px', borderRadius: 10, border: `1px solid #f59e0b40`, cursor: 'default',
            background: '#f59e0b15', color: '#f59e0b', fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}>⏳ Pendiente</button>
        ) : (
          <button onClick={() => joinGroup(item)} disabled={!!isLoading} style={{
            padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: C.green, color: C.bg, fontSize: 12, fontWeight: 700, flexShrink: 0,
            opacity: isLoading ? 0.6 : 1,
            boxShadow: `0 2px 8px ${C.green}33`,
          }}>
            {isLoading ? '...' : isPrivate ? 'Solicitar' : 'Unirse'}
          </button>
        )}
      </div>
    )
  }

  if (viewingTournament) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', background: C.panel,
          borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        }}>
          <button onClick={() => setViewingTournament(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {viewingTournament.name}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <TournamentDashboard
            tournamentId={viewingTournament.id}
            profile={profile}
            isAdmin={viewingTournament.created_by === profile?.id}
            onBack={() => setViewingTournament(null)}
          />
        </div>
      </div>
    )
  }

  const items = activeSection === 'comunidades' ? myCommunities : myTournaments
  const emptyIcon = activeSection === 'comunidades' ? '🌐' : '🏆'
  const emptyText = activeSection === 'comunidades'
    ? 'No estás en ninguna comunidad aún'
    : 'No estás participando en ningún torneo o liga'
  const emptyHint = activeSection === 'comunidades'
    ? 'Explorá comunidades públicas desde Explorar o pedí un link de invitación.'
    : 'Uníte a torneos desde la sección Torneos o desde una comunidad.'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ padding: '14px 16px 0' }}>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px' }}>Comunidades</span>
        </div>

        {/* Section tabs */}
        <div style={{ display: 'flex', padding: '8px 16px 0', gap: 4 }}>
          {[
            { id: 'comunidades', label: '🌐 Comunidades' },
            { id: 'participando', label: '🏆 Participando' },
          ].map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              padding: '7px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              background: activeSection === s.id ? C.green : C.panel2,
              color: activeSection === s.id ? '#000' : C.textDim,
              transition: 'all .15s',
            }}>{s.label}</button>
          ))}
        </div>

        {/* Search */}
        <div style={{ padding: '10px 16px' }}>
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
              placeholder={activeSection === 'comunidades' ? 'Buscar comunidades...' : 'Buscar torneos o ligas...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 14, padding: '9px 0' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 0, fontSize: 13 }}>✕</button>
            )}
          </div>
        </div>
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
            <div style={{ fontSize: 48 }}>{emptyIcon}</div>
            <p style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>
              {search ? `Sin resultados para "${search}"` : emptyText}
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13, lineHeight: 1.5, maxWidth: 260 }}>
              {search ? 'Probá con otro nombre.' : emptyHint}
            </p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <BannerAd position="explorar" style={{ margin: '4px 12px 8px' }} />
            {activeSection === 'participando'
              ? <div style={{ padding: '0 12px' }}>{items.map((item, i) => renderCard(item, i))}</div>
              : items.map((item, i) => renderCard(item, i))
            }
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
