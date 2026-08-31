import { useEffect, useState, useCallback, useRef } from 'react'
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

// ── Tab bar (base — CEO tab added dynamically) ────────────────────────────────
const BASE_TABS = [
  { id: 'inicio',    label: 'Inicio',    emoji: '🏠' },
  { id: 'chat',      label: 'Chat',      emoji: '💬' },
  { id: 'torneos',   label: 'Torneos',   emoji: '🏆' },
  { id: 'miembros',  label: 'Miembros',  emoji: '👥' },
]

// ── Channels tab — WhatsApp-style ────────────────────────────────────────────
function ChannelsTab({ community, profile, isAdmin }) {
  const { setActiveConversation } = useChatStore()
  const [channels, setChannels]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName]       = useState('')
  const [newType, setNewType]       = useState('general')
  const [creating, setCreating]     = useState(false)

  const loadChannels = useCallback(async () => {
    const { data } = await supabase
      .from('conversations')
      .select('id, name, description, group_type, created_by, created_at, is_public')
      .eq('community_id', community.id)
      .eq('group_type', 'channel')
      .order('created_at', { ascending: true })
    // Avisos lives in Inicio tab — exclude it from Chat channels
    setChannels((data || []).filter(c => c.name !== 'Avisos' && !c.is_public))
    setLoading(false)
  }, [community.id])

  useEffect(() => { loadChannels() }, [loadChannels])

  // Auto-create default channels if none exist
  useEffect(() => {
    if (!loading || !isAdmin) return
    if (channels.length === 0) {
      // will be handled after load
    }
  }, [loading, channels.length, isAdmin])

  useEffect(() => {
    if (loading) return
    if (channels.length === 0 && isAdmin) {
      createDefaultChannels()
    }
  }, [loading])

  async function createDefaultChannels() {
    const defaults = [
      { name: 'General', description: 'Canal principal de la comunidad', is_public: false },
    ]
    for (const ch of defaults) {
      const { data } = await supabase.from('conversations').insert({
        name: ch.name,
        description: ch.description,
        group_type: 'channel',
        community_id: community.id,
        created_by: profile.id,
        is_public: ch.is_public,
      }).select('id, name, description, group_type, created_by, created_at, is_public').single()
      if (data) {
        await supabase.from('conversation_members').insert({ conversation_id: data.id, user_id: profile.id, role: 'owner' })
      }
    }
    loadChannels()
  }

  async function createChannel(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    const { data, error } = await supabase.from('conversations').insert({
      name: newName.trim(),
      description: newType === 'avisos' ? 'Solo el admin puede publicar' : null,
      group_type: 'channel',
      community_id: community.id,
      created_by: profile.id,
      is_public: newType === 'avisos',
    }).select('id, name, description, group_type, created_by, created_at, is_public').single()
    if (data) {
      await supabase.from('conversation_members').insert({ conversation_id: data.id, user_id: profile.id, role: 'owner' })
      setChannels(prev => [...prev, data])
      setNewName('')
      setShowCreate(false)
    }
    setCreating(false)
  }

  async function deleteChannel(chId) {
    if (!confirm('¿Eliminar este canal? Se perderán todos los mensajes.')) return
    await supabase.from('conversations').delete().eq('id', chId)
    setChannels(prev => prev.filter(c => c.id !== chId))
  }

  function openChannel(ch) {
    setActiveConversation({
      ...ch,
      isGroup: true,
      isCommunity: false,
      group_type: 'channel',
      is_announcement: ch.is_public === true,
    })
  }

  function channelIcon(ch) {
    if (ch.is_public) return '📢'
    if (ch.name === 'General') return '💬'
    return '#'
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <div style={{ width: 26, height: 26, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px 8px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Canales · {channels.length}
        </div>
      </div>

      {/* Channel list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {channels.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 32px', color: C.textDim }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
            <p style={{ margin: 0, color: C.text2, fontWeight: 700 }}>Sin canales</p>
            {isAdmin
              ? <p style={{ margin: '6px 0 0', fontSize: 12 }}>Creá el primer canal para empezar a chatear</p>
              : <p style={{ margin: '6px 0 0', fontSize: 12 }}>El administrador aún no creó canales</p>}
          </div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {channels.map(ch => (
              <div key={ch.id} style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => openChannel(ch)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                    borderBottom: `1px solid ${C.border}18`,
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.panel}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: ch.is_public ? `#f59e0b22` : `${C.green}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                    border: `1px solid ${ch.is_public ? '#f59e0b33' : C.green + '33'}`,
                  }}>
                    {channelIcon(ch)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {ch.name}
                      {ch.is_public && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: '#f59e0b22', color: '#f59e0b', letterSpacing: 0.5 }}>SOLO LECTURA</span>}
                    </div>
                    {ch.description && (
                      <div style={{ color: C.textDim, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.description}</div>
                    )}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
                {isAdmin && ch.name !== 'General' && ch.name !== 'Avisos' && (
                  <button
                    onClick={() => deleteChannel(ch.id)}
                    style={{
                      padding: '12px 14px', background: 'none', border: 'none',
                      cursor: 'pointer', color: C.textDim, fontSize: 16,
                      flexShrink: 0,
                    }}
                    title="Eliminar canal"
                  >
                    🗑
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
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
            💬 Ver canales
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

      {/* Avisos — siempre visible */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0, color: C.text, fontSize: 14, fontWeight: 800 }}>📢 Avisos</h3>
        </div>
        {announcements.length === 0 ? (
          <div style={{ background: C.panel, borderRadius: 12, padding: '20px 16px', border: `1px solid ${C.border}`, textAlign: 'center', color: C.textDim }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
            <p style={{ margin: 0, fontSize: 12 }}>No hay avisos publicados aún</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {announcements.slice(0, 3).map(a => (
              <div key={a.id} style={{
                background: C.panel, borderRadius: 12, padding: '12px 14px',
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{a.title}</div>
                    {a.body && <p style={{ margin: 0, color: C.textDim, fontSize: 12, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{a.body}</p>}
                  </div>
                  <span style={{ fontSize: 11, color: C.textDim, flexShrink: 0 }}>{timeAgo(a.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
function MiembrosTab({ communityId, ownerId, isAdmin, myId }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionMember, setActionMember] = useState(null)

  const loadMembers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('conversation_members')
      .select('user_id, role, users(id, display_name, username, avatar_url)')
      .eq('conversation_id', communityId)
      .limit(200)
    setMembers((data || []).filter(m => m.users))
    setLoading(false)
  }, [communityId])

  useEffect(() => { loadMembers() }, [loadMembers])

  const ROLE_CFG = {
    ceo:        { label: 'CEO',        color: '#f59e0b' },
    owner:      { label: 'CEO',        color: '#f59e0b' },
    admin:      { label: 'Admin',      color: '#8b5cf6' },
    organizador:{ label: 'Organizador',color: '#22c55e' },
    moderador:  { label: 'Moderador',  color: '#3b82f6' },
    member:     { label: 'Miembro',    color: C.textDim },
  }

  const ROLE_OPTIONS = [
    { value: 'admin',       label: '⭐ Admin' },
    { value: 'organizador', label: '🎯 Organizador' },
    { value: 'moderador',   label: '🛡️ Moderador' },
    { value: 'member',      label: '👤 Miembro' },
  ]

  async function changeRole(userId, newRole) {
    await supabase
      .from('group_roles')
      .upsert({ user_id: userId, group_id: communityId, role: newRole }, { onConflict: 'user_id,group_id' })
    await supabase
      .from('conversation_members')
      .update({ role: newRole })
      .eq('conversation_id', communityId)
      .eq('user_id', userId)
    setActionMember(null)
    loadMembers()
  }

  async function removeMember(userId) {
    if (!confirm('¿Expulsar a este miembro de la comunidad?')) return
    await supabase
      .from('conversation_members')
      .delete()
      .eq('conversation_id', communityId)
      .eq('user_id', userId)
    setActionMember(null)
    loadMembers()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <div style={{ width: 26, height: 26, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: '0 0 24px' }}>
      <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', padding: '12px 16px 6px' }}>
        {members.length} miembro{members.length !== 1 ? 's' : ''}
      </div>
      {members.map(m => {
        const u = m.users
        if (!u) return null
        const isOwner = u.id === ownerId
        const isMe = u.id === myId
        const role = isOwner ? 'ceo' : (m.role || 'member')
        const rCfg = ROLE_CFG[role] || ROLE_CFG.member
        return (
          <div key={m.user_id}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
              borderBottom: `1px solid ${C.border}18`,
              cursor: isAdmin && !isOwner && !isMe ? 'pointer' : 'default',
            }}
              onClick={() => isAdmin && !isOwner && !isMe && setActionMember(actionMember?.user_id === m.user_id ? null : m)}
            >
              {u.avatar_url
                ? <img src={u.avatar_url} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                : <div style={{ width: 40, height: 40, borderRadius: '50%', background: avatarColor(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {(u.display_name || '?').slice(0, 2).toUpperCase()}
                  </div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>
                  {u.display_name || 'Usuario'}{isMe && <span style={{ color: C.textDim, fontWeight: 400, fontSize: 12 }}> (Yo)</span>}
                </div>
                {u.username && <div style={{ color: C.textDim, fontSize: 12 }}>@{u.username}</div>}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: `${rCfg.color}20`, color: rCfg.color }}>
                {rCfg.label}
              </span>
              {isAdmin && !isOwner && !isMe && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="5" r="1" fill={C.textDim}/><circle cx="12" cy="12" r="1" fill={C.textDim}/><circle cx="12" cy="19" r="1" fill={C.textDim}/>
                </svg>
              )}
            </div>

            {/* Action panel */}
            {isAdmin && actionMember?.user_id === m.user_id && (
              <div style={{ background: C.panel2, padding: '10px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Cambiar rol:</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ROLE_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => changeRole(m.user_id, opt.value)} style={{
                      padding: '5px 10px', borderRadius: 8,
                      border: `1px solid ${role === opt.value ? C.green : C.border}`,
                      background: role === opt.value ? `${C.green}18` : 'none',
                      color: role === opt.value ? C.green : C.text2,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>{opt.label}</button>
                  ))}
                </div>
                <button onClick={() => removeMember(m.user_id)} style={{
                  alignSelf: 'flex-start', marginTop: 4, padding: '5px 10px', borderRadius: 8,
                  border: `1px solid #ef444444`, background: '#ef444412',
                  color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>🚫 Expulsar</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── CEO Panel ─────────────────────────────────────────────────────────────────
function CeoPanel({ community, profile, onAvisoPublished }) {
  const { setActiveConversation } = useChatStore()
  const [channels, setChannels] = useState([])
  const [loadingCh, setLoadingCh] = useState(true)
  const [showCreateCh, setShowCreateCh] = useState(false)
  const [newChName, setNewChName] = useState('')
  const [newChDesc, setNewChDesc] = useState('')
  const [newChAccess, setNewChAccess] = useState('everyone') // who_can_send
  const [creatingCh, setCreatingCh] = useState(false)
  const [chPermMenu, setChPermMenu] = useState(null) // channel id with open perm menu
  const [savingPerm, setSavingPerm] = useState(null)

  // Aviso form
  const [avisoTitle, setAvisoTitle] = useState('')
  const [avisoBody, setAvisoBody] = useState('')
  const [publishingAviso, setPublishingAviso] = useState(false)
  const [avisoDone, setAvisoDone] = useState(false)

  // Members for role management
  const [members, setMembers] = useState([])
  const [loadingM, setLoadingM] = useState(true)

  const ROLE_CFG = {
    owner:       { label: 'CEO',         color: '#f59e0b' },
    admin:       { label: 'Admin',       color: '#ef4444' },
    organizador: { label: 'Organizador', color: '#22c55e' },
    moderador:   { label: 'Moderador',   color: '#8b5cf6' },
    member:      { label: 'Miembro',     color: '#64748b' },
  }

  useEffect(() => {
    loadChannels()
    loadMembers()
  }, [community.id])

  async function loadChannels() {
    setLoadingCh(true)
    const { data } = await supabase
      .from('conversations')
      .select('id, name, description, is_public, who_can_send, created_at')
      .eq('community_id', community.id)
      .eq('group_type', 'channel')
      .order('created_at', { ascending: true })
    setChannels(data || [])
    setLoadingCh(false)
  }

  async function loadMembers() {
    setLoadingM(true)
    const { data } = await supabase
      .from('conversation_members')
      .select('user_id, role, users(id, display_name, username, avatar_url)')
      .eq('conversation_id', community.id)
      .limit(200)
    setMembers(data || [])
    setLoadingM(false)
  }

  async function createChannel() {
    if (!newChName.trim()) return
    setCreatingCh(true)
    const { data } = await supabase.from('conversations').insert({
      name: newChName.trim(),
      description: newChDesc.trim() || null,
      group_type: 'channel',
      community_id: community.id,
      created_by: profile.id,
      is_public: false,
      who_can_send: newChAccess,
    }).select('id, name, description, is_public, who_can_send, created_at').single()
    if (data) {
      await supabase.from('conversation_members').insert({ conversation_id: data.id, user_id: profile.id, role: 'owner' })
      setChannels(prev => [...prev, data])
    }
    setNewChName(''); setNewChDesc(''); setNewChAccess('everyone')
    setShowCreateCh(false); setCreatingCh(false)
  }

  async function deleteChannel(chId) {
    if (!confirm('¿Eliminar este canal? Se perderán todos los mensajes.')) return
    await supabase.from('conversations').delete().eq('id', chId)
    setChannels(prev => prev.filter(c => c.id !== chId))
  }

  async function updateChannelPerm(chId, who_can_send) {
    setSavingPerm(chId)
    await supabase.from('conversations').update({ who_can_send }).eq('id', chId)
    setChannels(prev => prev.map(c => c.id === chId ? { ...c, who_can_send } : c))
    setSavingPerm(null)
    setChPermMenu(null)
  }

  async function changeRole(userId, newRole) {
    await supabase.from('conversation_members')
      .update({ role: newRole })
      .eq('conversation_id', community.id)
      .eq('user_id', userId)
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role: newRole } : m))
  }

  async function publishAviso() {
    if (!avisoTitle.trim()) return
    setPublishingAviso(true)
    await supabase.from('announcements').insert({
      conversation_id: community.id,
      author_id: profile.id,
      title: avisoTitle.trim(),
      body: avisoBody.trim() || null,
    })
    setAvisoTitle(''); setAvisoBody(''); setPublishingAviso(false); setAvisoDone(true)
    setTimeout(() => setAvisoDone(false), 3000)
    if (onAvisoPublished) onAvisoPublished()
  }

  const whoCanSendLabel = { everyone: 'Todos', members: 'Miembros', moderators: 'Moderadores', admins: 'Solo admins' }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Canales ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0, color: C.text, fontSize: 14, fontWeight: 800 }}>💬 Canales</h3>
          <button onClick={() => setShowCreateCh(v => !v)} style={{
            padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.green}`,
            background: showCreateCh ? `${C.green}22` : 'none', color: C.green,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>{showCreateCh ? 'Cancelar' : '+ Nuevo canal'}</button>
        </div>

        {showCreateCh && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={newChName} onChange={e => setNewChName(e.target.value)} placeholder="Nombre del canal"
              style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            <input value={newChDesc} onChange={e => setNewChDesc(e.target.value)} placeholder="Descripción (opcional)"
              style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            <div>
              <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, marginBottom: 6 }}>¿Quién puede enviar mensajes?</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(whoCanSendLabel).map(([v, l]) => (
                  <button key={v} onClick={() => setNewChAccess(v)} style={{
                    padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${newChAccess === v ? C.green : C.border}`,
                    background: newChAccess === v ? `${C.green}18` : 'none',
                    color: newChAccess === v ? C.green : C.textDim,
                  }}>{l}</button>
                ))}
              </div>
            </div>
            <button onClick={createChannel} disabled={creatingCh || !newChName.trim()} style={{
              padding: '9px', borderRadius: 10, border: 'none', background: C.green, color: '#000',
              fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: creatingCh ? 0.6 : 1,
            }}>{creatingCh ? 'Creando...' : 'Crear canal'}</button>
          </div>
        )}

        {loadingCh ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <div style={{ width: 22, height: 22, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          </div>
        ) : channels.length === 0 ? (
          <div style={{ background: C.panel, borderRadius: 12, padding: '20px', textAlign: 'center', color: C.textDim, border: `1px solid ${C.border}` }}>
            <p style={{ margin: 0, fontSize: 12 }}>Sin canales aún. Creá el primero arriba.</p>
          </div>
        ) : channels.map(ch => (
          <div key={ch.id} style={{ background: C.panel, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
              <span style={{ fontSize: 18 }}>{ch.is_public ? '📢' : ch.name === 'Avisos' ? '📢' : '💬'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{ch.name}</div>
                {ch.description && <div style={{ color: C.textDim, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.description}</div>}
              </div>
              <button onClick={() => setChPermMenu(chPermMenu === ch.id ? null : ch.id)} style={{
                padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${C.border}`, background: C.panel2, color: C.textDim,
              }}>
                🔐 {whoCanSendLabel[ch.who_can_send] || 'Todos'}
              </button>
              {ch.name !== 'General' && ch.name !== 'Avisos' && (
                <button onClick={() => deleteChannel(ch.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: '4px' }}>🗑</button>
              )}
            </div>
            {chPermMenu === ch.id && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 14px', background: C.panel2 }}>
                <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, marginBottom: 8 }}>¿Quién puede enviar mensajes?</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(whoCanSendLabel).map(([v, l]) => (
                    <button key={v} onClick={() => updateChannelPerm(ch.id, v)} disabled={savingPerm === ch.id} style={{
                      padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${ch.who_can_send === v ? C.green : C.border}`,
                      background: ch.who_can_send === v ? `${C.green}18` : 'none',
                      color: ch.who_can_send === v ? C.green : C.textDim,
                    }}>{l}{savingPerm === ch.id && ch.who_can_send === v ? ' ✓' : ''}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Publicar Aviso ── */}
      <div>
        <h3 style={{ margin: '0 0 10px', color: C.text, fontSize: 14, fontWeight: 800 }}>📢 Publicar Aviso</h3>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={avisoTitle} onChange={e => setAvisoTitle(e.target.value)} placeholder="Título del aviso"
            style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
          <textarea value={avisoBody} onChange={e => setAvisoBody(e.target.value)} placeholder="Contenido (opcional)" rows={3}
            style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit' }} />
          <button onClick={publishAviso} disabled={publishingAviso || !avisoTitle.trim()} style={{
            padding: '9px', borderRadius: 10, border: 'none',
            background: avisoDone ? '#22c55e' : C.green,
            color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            opacity: publishingAviso ? 0.6 : 1,
          }}>
            {avisoDone ? '✓ Publicado' : publishingAviso ? 'Publicando...' : '📢 Publicar aviso'}
          </button>
        </div>
      </div>

      {/* ── Roles de miembros ── */}
      <div>
        <h3 style={{ margin: '0 0 10px', color: C.text, fontSize: 14, fontWeight: 800 }}>👥 Roles de miembros</h3>
        {loadingM ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <div style={{ width: 22, height: 22, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          </div>
        ) : members.map(m => {
          const u = m.users
          if (!u) return null
          const isOwner = u.id === community.created_by
          const isMe = u.id === profile?.id
          const role = isOwner ? 'owner' : (m.role || 'member')
          const rCfg = ROLE_CFG[role] || ROLE_CFG.member
          return (
            <div key={m.user_id} style={{ background: C.panel, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isOwner || isMe ? 0 : 8 }}>
                {u.avatar_url
                  ? <img src={u.avatar_url} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                  : <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#334', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>
                      {(u.display_name || '?').slice(0, 2).toUpperCase()}
                    </div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{u.display_name}{isMe && <span style={{ color: C.textDim, fontSize: 11, fontWeight: 400 }}> (Vos)</span>}</div>
                  {u.username && <div style={{ color: C.textDim, fontSize: 11 }}>@{u.username}</div>}
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: `${rCfg.color}20`, color: rCfg.color }}>{rCfg.label}</span>
              </div>
              {!isOwner && !isMe && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {[
                    { value: 'admin',       label: '🛡️ Admin' },
                    { value: 'organizador', label: '🎖️ Organizador' },
                    { value: 'moderador',   label: '🔰 Moderador' },
                    { value: 'member',      label: '👤 Miembro' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => changeRole(m.user_id, opt.value)} style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${role === opt.value ? C.green : C.border}`,
                      background: role === opt.value ? `${C.green}18` : 'none',
                      color: role === opt.value ? C.green : C.textDim,
                    }}>{opt.label}</button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main CommunityDashboard ───────────────────────────────────────────────────
export default function CommunityDashboard({ community, onBack }) {
  const { profile } = useAuthStore()
  const [myRole, setMyRole] = useState(community.myRole || null)

  useEffect(() => {
    if (!profile?.id || !community?.id) return
    if (myRole) return
    supabase
      .from('conversation_members')
      .select('role')
      .eq('conversation_id', community.id)
      .eq('user_id', profile.id)
      .single()
      .then(({ data }) => { if (data?.role) setMyRole(data.role) })
  }, [profile?.id, community?.id])

  const isAdmin = community.created_by === profile?.id
    || myRole === 'owner' || myRole === 'admin'
    || profile?.role === 'superadmin' || profile?.role === 'admin'
  const TABS = isAdmin
    ? [...BASE_TABS, { id: 'ceo', label: 'CEO', emoji: '⚙️' }]
    : BASE_TABS
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
    // Get participant counts via SECURITY DEFINER RPC (bypasses RLS)
    if (tRows.length) {
      const counts = await Promise.all(
        tRows.map(t => supabase.rpc('get_tournament_participant_count', { p_tournament_id: t.id }).then(r => ({ id: t.id, count: r.data ?? 0 })))
      )
      const cmap = Object.fromEntries(counts.map(c => [c.id, c.count]))
      setTorneos(tRows.map(t => ({ ...t, participant_count: cmap[t.id] || 0 })))
    } else {
      setTorneos([])
    }

    setAnnouncements(aRes.data || [])
    setMemberCount(mRes.count || 0)
    setAnnLoading(false)
  }, [community?.id])

  useEffect(() => { loadData() }, [loadData])

  if (viewingTournament) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={() => { setViewingTournament(null); loadData() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4 }}>
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
            isAdmin={isAdmin || viewingTournament.created_by === profile?.id}
            onBack={() => { setViewingTournament(null); loadData() }}
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
          <MiembrosTab communityId={community.id} ownerId={community.created_by} isAdmin={isAdmin} myId={profile?.id} />
        )}
        {tab === 'chat' && (
          <ChannelsTab community={community} profile={profile} isAdmin={isAdmin} />
        )}
        {tab === 'ceo' && isAdmin && (
          <CeoPanel community={community} profile={profile} onAvisoPublished={loadData} />
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
