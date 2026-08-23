import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { C } from '../theme'
import TournamentDashboard from './TournamentDashboard'

// ── helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#e91e63','#9c27b0','#1565c0','#00838f','#2e7d32','#e65100','#c62828']
function avatarColor(id) {
  if (!id) return C.panel2
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function Avatar({ name, url, size = 44, radius = 12 }) {
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        background: avatarColor(name),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 800, color: '#fff',
      }}>{name?.slice(0, 2).toUpperCase() || '?'}</div>
}

function timeAgo(ts) {
  if (!ts) return ''
  const d = (Date.now() - new Date(ts)) / 1000
  if (d < 60)    return 'ahora'
  if (d < 3600)  return `${Math.floor(d / 60)}m`
  if (d < 86400) return `${Math.floor(d / 3600)}h`
  return `${Math.floor(d / 86400)}d`
}

const STATUS_CFG = {
  inscripcion: { label: 'Inscripciones abiertas', color: '#22c55e', bg: '#22c55e18' },
  en_curso:    { label: 'En curso',               color: '#f59e0b', bg: '#f59e0b18' },
  finalizado:  { label: 'Finalizado',             color: '#6b7280', bg: '#6b728018' },
  draw:        { label: 'Sorteo',                 color: '#8b5cf6', bg: '#8b5cf618' },
  cancelado:   { label: 'Cancelado',              color: '#ef4444', bg: '#ef444418' },
}

// ── Tab bar ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'inicio',    label: 'Inicio',    emoji: '🏠' },
  { id: 'chat',      label: 'Chat',      emoji: '💬' },
  { id: 'torneos',   label: 'Torneos',   emoji: '🏆' },
  { id: 'anuncios',  label: 'Anuncios',  emoji: '📢' },
  { id: 'miembros',  label: 'Miembros',  emoji: '👥' },
]

// ── Chat interno (canal General) ─────────────────────────────────────────────
function CommunityChat({ community }) {
  const { setActiveConversation } = useChatStore()

  useEffect(() => {
    setActiveConversation({
      ...community,
      isGroup: true,
      isCommunity: false,
      group_type: 'community',
    })
  }, [community.id])

  return null
}

// ── Inicio tab ────────────────────────────────────────────────────────────────
function InicioTab({ community, profile, torneos, announcements, memberCount, onOpenTournament, onChangeTab }) {
  const isAdmin = community.created_by === profile?.id

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Community hero */}
      <div style={{
        background: `linear-gradient(135deg, ${C.panel} 0%, ${C.panel2} 100%)`,
        borderRadius: 16, padding: '20px 20px 16px',
        border: `1px solid ${C.border}`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: `${C.green}08` }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <Avatar name={community.name} url={community.avatar_url} size={56} radius={14} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, color: C.text, fontSize: 18, fontWeight: 900 }}>{community.name}</h2>
              {isAdmin && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: `${C.green}20`, color: C.green }}>CEO</span>
              )}
            </div>
            <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>
              👥 {memberCount} miembro{memberCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        {community.description && (
          <p style={{ margin: '0 0 12px', color: C.text2, fontSize: 13, lineHeight: 1.6 }}>{community.description}</p>
        )}

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => onChangeTab('chat')} style={{
            padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: C.green, color: '#000', fontSize: 12, fontWeight: 700,
            boxShadow: `0 2px 8px ${C.green}44`,
          }}>
            💬 Abrir chat
          </button>
          {torneos.filter(t => t.tournament_status === 'inscripcion').length > 0 && (
            <button onClick={() => onChangeTab('torneos')} style={{
              padding: '8px 16px', borderRadius: 10, border: `1px solid ${C.border}`, cursor: 'pointer',
              background: C.panel, color: C.text, fontSize: 12, fontWeight: 700,
            }}>
              🏆 Ver torneos
            </button>
          )}
        </div>
      </div>

      {/* Torneos activos */}
      {torneos.filter(t => ['inscripcion','en_curso','draw'].includes(t.tournament_status)).length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ margin: 0, color: C.text, fontSize: 14, fontWeight: 800 }}>🏆 Torneos activos</h3>
            <button onClick={() => onChangeTab('torneos')} style={{ background: 'none', border: 'none', color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Ver todos →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {torneos.filter(t => ['inscripcion','en_curso','draw'].includes(t.tournament_status)).slice(0, 3).map(t => {
              const s = STATUS_CFG[t.tournament_status] || STATUS_CFG.inscripcion
              return (
                <div key={t.id}
                  onClick={() => onOpenTournament(t)}
                  style={{
                    background: C.panel, borderRadius: 12, padding: '12px 14px',
                    border: `1px solid ${C.border}`, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                    transition: 'background .12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.panel2}
                  onMouseLeave={e => e.currentTarget.style.background = C.panel}
                >
                  <div style={{ fontSize: 22 }}>{t.group_type === 'liga' ? '⚽' : '🏆'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{t.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, padding: '1px 7px', borderRadius: 6 }}>{s.label}</span>
                      <span style={{ fontSize: 11, color: C.textDim }}>👥 {t.participant_count || 0}/{t.max_participants || '?'}</span>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Últimos anuncios */}
      {announcements.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ margin: 0, color: C.text, fontSize: 14, fontWeight: 800 }}>📢 Últimos anuncios</h3>
            <button onClick={() => onChangeTab('anuncios')} style={{ background: 'none', border: 'none', color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Ver todos →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {announcements.slice(0, 3).map(a => (
              <div key={a.id} style={{
                background: C.panel, borderRadius: 12, padding: '12px 14px',
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ display: 'flex', align: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{a.title}</div>
                    {a.body && <p style={{ margin: 0, color: C.textDim, fontSize: 12, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{a.body}</p>}
                  </div>
                  <span style={{ fontSize: 11, color: C.textDim, flexShrink: 0 }}>{timeAgo(a.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {torneos.length === 0 && announcements.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: C.textDim }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌟</div>
          <p style={{ margin: 0, fontWeight: 700, color: C.text2 }}>Comunidad recién creada</p>
          <p style={{ margin: '6px 0 0', fontSize: 12 }}>Crea torneos y publica anuncios para empezar</p>
        </div>
      )}
    </div>
  )
}

// ── Torneos tab ───────────────────────────────────────────────────────────────
function TorneosTab({ torneos, profile, onOpenTournament }) {
  const active = torneos.filter(t => ['inscripcion','en_curso','draw'].includes(t.tournament_status))
  const finished = torneos.filter(t => ['finalizado','cancelado'].includes(t.tournament_status))

  function TorneoCard({ t }) {
    const s = STATUS_CFG[t.tournament_status] || STATUS_CFG.inscripcion
    return (
      <div onClick={() => onOpenTournament(t)} style={{
        background: C.panel, borderRadius: 14, overflow: 'hidden',
        border: `1px solid ${C.border}`, cursor: 'pointer', marginBottom: 10,
        transition: 'box-shadow .15s',
      }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = `0 4px 20px ${C.green}22`}
        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
      >
        <div style={{ background: s.bg, padding: '5px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</span>
          <span style={{ fontSize: 11, color: C.textDim }}>{t.group_type === 'liga' ? '⚽ Liga' : '🏆 Torneo'}</span>
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 28 }}>{t.group_type === 'liga' ? '⚽' : '🏆'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>{t.name}</div>
            <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>
              👥 {t.participant_count || 0} / {t.max_participants || '?'} · {t.game || '—'}
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    )
  }

  if (torneos.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 32px', color: C.textDim }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
        <p style={{ margin: 0, fontWeight: 700, color: C.text2 }}>Sin torneos aún</p>
        <p style={{ margin: '6px 0 0', fontSize: 12 }}>Los torneos de esta comunidad aparecerán acá</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 16px' }}>
      {active.length > 0 && (
        <>
          <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>Activos</div>
          {active.map(t => <TorneoCard key={t.id} t={t} />)}
        </>
      )}
      {finished.length > 0 && (
        <>
          <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', margin: '16px 0 8px' }}>Finalizados</div>
          {finished.map(t => <TorneoCard key={t.id} t={t} />)}
        </>
      )}
    </div>
  )
}

// ── Anuncios tab ──────────────────────────────────────────────────────────────
function AnunciosTab({ announcements, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <div style={{ width: 26, height: 26, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      </div>
    )
  }
  if (!announcements.length) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 32px', color: C.textDim }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📢</div>
        <p style={{ margin: 0, fontWeight: 700, color: C.text2 }}>Sin anuncios aún</p>
        <p style={{ margin: '6px 0 0', fontSize: 12 }}>Los anuncios de esta comunidad aparecerán acá</p>
      </div>
    )
  }
  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {announcements.map(a => (
        <div key={a.id} style={{
          background: C.panel, borderRadius: 14, padding: '14px 16px',
          border: `1px solid ${C.border}`,
          boxShadow: a.is_pinned ? `0 0 0 2px ${C.green}44` : 'none',
        }}>
          {a.is_pinned && (
            <div style={{ color: C.green, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>📌 Fijado</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            {a.author?.avatar_url
              ? <img src={a.author.avatar_url} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} alt="" />
              : <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(a.author_id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>
                  {(a.author?.display_name || '?').slice(0, 2).toUpperCase()}
                </div>
            }
            <div>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{a.author?.display_name || 'Organizador'}</div>
              <div style={{ color: C.textDim, fontSize: 11 }}>{timeAgo(a.created_at)}</div>
            </div>
          </div>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 6 }}>{a.title}</div>
          {a.body && <p style={{ margin: '0 0 10px', color: C.text2, fontSize: 13, lineHeight: 1.6 }}>{a.body}</p>}
          {a.image_url && (
            <img src={a.image_url} alt="" style={{ width: '100%', borderRadius: 10, objectFit: 'cover', maxHeight: 200, display: 'block', marginBottom: 10 }} />
          )}
          {a.link_url && (
            <a href={a.link_url} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
              background: C.green, color: '#000', fontSize: 12, fontWeight: 700, textDecoration: 'none',
            }}>
              🔗 {a.link_label || 'Ver más'}
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Miembros tab ──────────────────────────────────────────────────────────────
function MiembrosTab({ communityId, ownerId }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('conversation_members')
      .select('user_id, role, joined_at, users!inner(id, display_name, username, avatar_url)')
      .eq('conversation_id', communityId)
      .order('joined_at', { ascending: true })
      .limit(100)
      .then(({ data, error }) => {
        if (error) {
          // fallback: two-step query
          supabase
            .from('conversation_members')
            .select('user_id, role, joined_at')
            .eq('conversation_id', communityId)
            .order('joined_at', { ascending: true })
            .limit(100)
            .then(async ({ data: mData }) => {
              const ids = (mData || []).map(r => r.user_id)
              if (!ids.length) { setMembers([]); setLoading(false); return }
              const { data: uData } = await supabase
                .from('users')
                .select('id, display_name, username, avatar_url')
                .in('id', ids)
              const uMap = {}
              ;(uData || []).forEach(u => { uMap[u.id] = u })
              setMembers((mData || []).map(m => ({ ...m, users: uMap[m.user_id] })))
              setLoading(false)
            })
        } else {
          setMembers(data || [])
          setLoading(false)
        }
      })
  }, [communityId])

  const ROLE_CFG = {
    ceo:   { label: 'CEO', color: '#f59e0b' },
    owner: { label: 'CEO', color: '#f59e0b' },
    admin: { label: 'Admin', color: '#8b5cf6' },
    moderator: { label: 'Mod', color: '#3b82f6' },
    member: { label: 'Miembro', color: C.textDim },
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <div style={{ width: 26, height: 26, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', padding: '8px 16px 6px' }}>
        {members.length} miembro{members.length !== 1 ? 's' : ''}
      </div>
      {members.map(m => {
        const u = m.users
        if (!u) return null
        const isOwner = u.id === ownerId
        const role = isOwner ? 'ceo' : (m.role || 'member')
        const rCfg = ROLE_CFG[role] || ROLE_CFG.member
        return (
          <div key={m.user_id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
            borderBottom: `1px solid ${C.border}10`,
          }}>
            {u.avatar_url
              ? <img src={u.avatar_url} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
              : <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarColor(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {(u.display_name || '?').slice(0, 2).toUpperCase()}
                </div>
            }
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{u.display_name || 'Usuario'}</div>
              {u.username && <div style={{ color: C.textDim, fontSize: 12 }}>@{u.username}</div>}
            </div>
            {role !== 'member' && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: `${rCfg.color}20`, color: rCfg.color }}>
                {rCfg.label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main CommunityDashboard ───────────────────────────────────────────────────
export default function CommunityDashboard({ community, onBack }) {
  const { profile } = useAuthStore()
  const { setActiveConversation } = useChatStore()
  const [tab, setTab] = useState('inicio')
  const [torneos, setTorneos] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [memberCount, setMemberCount] = useState(0)
  const [annLoading, setAnnLoading] = useState(true)
  const [viewingTournament, setViewingTournament] = useState(null)

  const loadData = useCallback(async () => {
    if (!community?.id) return

    // Parallel loads
    const [tRes, aRes, mRes] = await Promise.all([
      supabase
        .from('conversations')
        .select('id, name, group_type, tournament_status, max_participants, game, created_by, created_at')
        .eq('community_id', community.id)
        .in('group_type', ['tournament', 'liga'])
        .order('created_at', { ascending: false }),
      supabase
        .from('announcements')
        .select('*, author:users!announcements_author_id_fkey(id, display_name, username, avatar_url)')
        .eq('conversation_id', community.id)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('conversation_members')
        .select('conversation_id', { count: 'exact', head: true })
        .eq('conversation_id', community.id),
    ])

    const tRows = tRes.data || []
    // Get participant counts
    if (tRows.length) {
      const ids = tRows.map(t => t.id)
      const { data: mRows } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .in('conversation_id', ids)
      const cmap = {}
      ;(mRows || []).forEach(r => { cmap[r.conversation_id] = (cmap[r.conversation_id] || 0) + 1 })
      setTorneos(tRows.map(t => ({ ...t, participant_count: cmap[t.id] || 0 })))
    } else {
      setTorneos([])
    }

    setAnnouncements(aRes.data || [])
    setMemberCount(mRes.count || 0)
    setAnnLoading(false)
  }, [community?.id])

  useEffect(() => { loadData() }, [loadData])

  function openChat() {
    // isCommunity: false so App.jsx routes to ChatPage instead of CommunityDashboard
    setActiveConversation({
      ...community,
      isGroup: true,
      isCommunity: false,
      group_type: 'community',
    })
  }

  if (viewingTournament) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px' }}>
          {onBack && (
            <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
          )}
          <Avatar name={community.name} url={community.avatar_url} size={36} radius={10} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {community.name}
            </div>
            <div style={{ color: C.textDim, fontSize: 11 }}>🌐 Comunidad · {memberCount} miembro{memberCount !== 1 ? 's' : ''}</div>
          </div>
          {/* Chat button */}
          <button onClick={openChat} style={{
            padding: '7px 14px', background: C.green, color: '#000',
            border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            flexShrink: 0, boxShadow: `0 2px 8px ${C.green}44`,
          }}>
            💬 Chat
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: '0 0 auto', background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 16px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
              color: tab === t.id ? C.green : C.textDim,
              borderBottom: `2px solid ${tab === t.id ? C.green : 'transparent'}`,
              transition: 'color .15s, border-color .15s',
            }}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'inicio' && (
          <InicioTab
            community={community}
            profile={profile}
            torneos={torneos}
            announcements={announcements}
            memberCount={memberCount}
            onOpenTournament={setViewingTournament}
            onChangeTab={setTab}
          />
        )}
        {tab === 'torneos' && (
          <TorneosTab
            torneos={torneos}
            profile={profile}
            onOpenTournament={setViewingTournament}
          />
        )}
        {tab === 'anuncios' && (
          <AnunciosTab announcements={announcements} loading={annLoading} />
        )}
        {tab === 'miembros' && (
          <MiembrosTab communityId={community.id} ownerId={community.created_by} />
        )}
        {tab === 'chat' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}>💬</div>
            <p style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>Chat de la comunidad</p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>El chat se abre en la vista principal</p>
            <button onClick={openChat} style={{
              padding: '12px 24px', background: C.green, color: '#000',
              border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer',
              boxShadow: `0 4px 16px ${C.green}44`,
            }}>
              💬 Abrir chat
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
