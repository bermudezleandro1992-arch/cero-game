import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { supabase } from '../lib/supabase'
import NewGroupPage from './NewGroupPage'
import { StoriesBar, useStoryUserIds } from './StoriesPage'
import { useOnlineUsers } from '../hooks/usePresence'
import { C } from '../theme'

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#e91e63','#9c27b0','#1565c0','#00838f','#2e7d32','#e65100','#c62828']
function avatarColor(id) {
  if (!id) return C.panel2
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts), now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const y = new Date(now); y.setDate(y.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 48, color, url }) {
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: color || C.panel2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.34, fontWeight: 700, color: '#fff',
        border: `1.5px solid ${C.border}`,
      }}>
        {name?.slice(0, 2).toUpperCase() || '?'}
      </div>
    )
}

// ── Group Avatar — mosaic of up to 4 member faces ─────────────────────────────
function GroupAvatar({ members = [], size = 50, isCommunity = false }) {
  const shown = members.slice(0, 4)
  const bg = isCommunity
    ? 'linear-gradient(135deg,#7c3aed,#4f46e5)'
    : 'linear-gradient(135deg,#0B7A2A,#065f21)'

  if (shown.length < 2) {
    // Single face or no members — show icon
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4, border: `1.5px solid ${C.border}`,
      }}>
        {isCommunity ? '🌐' : '👥'}
      </div>
    )
  }

  const half = size / 2
  const cellSize = half - 1

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      overflow: 'hidden', background: C.panel2, flexDirection: 'row',
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1,
      border: `1.5px solid ${C.border}`,
    }}>
      {shown.map((m, i) => {
        const n = m.display_name || m.username || '?'
        const col = avatarColor(m.id)
        return m.avatar_url
          ? <img key={i} src={m.avatar_url} alt={n} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (
            <div key={i} style={{
              background: col, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: cellSize * 0.38, fontWeight: 700, color: '#fff',
            }}>
              {n.slice(0, 1).toUpperCase()}
            </div>
          )
      })}
    </div>
  )
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
      <div className="skeleton" style={{ width: 50, height: 50, borderRadius: '50%' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton" style={{ height: 13, width: '55%' }} />
        <div className="skeleton" style={{ height: 11, width: '80%' }} />
      </div>
    </div>
  )
}

// ── Ticks ─────────────────────────────────────────────────────────────────────
function Ticks({ read }) {
  return (
    <svg width="14" height="9" viewBox="0 0 16 11" fill="none" style={{ flexShrink: 0 }}>
      <path d="M1 5.5L5 9.5L11 2" stroke={read ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5.5L9 9.5L15 2" stroke={read ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ChatListPage({ onProfileClick, initialFilter }) {
  const { profile, signOut } = useAuthStore()
  const { conversations, fetchConversations, findOrCreateConversation, setActiveConversation, activeConversation } = useChatStore()
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newGroupType, setNewGroupType] = useState('group')
  const [filter, setFilter] = useState(initialFilter || 'todos')

  useEffect(() => { setFilter(initialFilter || 'todos') }, [initialFilter])
  const [showFab, setShowFab] = useState(false)
  // If conversations already in store, don't flash skeleton on tab switch
  const [loadingConvs, setLoadingConvs] = useState(conversations.length === 0)
  const storyUserIds = useStoryUserIds()
  const onlineUsers = useOnlineUsers()

  useEffect(() => {
    if (!profile?.id) return
    fetchConversations(profile.id).then(() => setLoadingConvs(false))
  }, [profile?.id])

  useEffect(() => {
    if (!showFab) return
    const h = () => setShowFab(false)
    // Use setTimeout so FAB item onClick fires before the close handler
    const t = setTimeout(() => document.addEventListener('click', h, { once: true }), 0)
    return () => { clearTimeout(t); document.removeEventListener('click', h) }
  }, [showFab])

  async function searchUsers(q) {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase.from('users')
      .select('id, display_name, username, avatar_url')
      .or(`username.ilike.%${q.replace('@', '')}%,display_name.ilike.%${q}%`)
      .neq('id', profile.id).limit(8)
    setSearchResults(data || [])
    setSearching(false)
  }

  async function openChat(userId) {
    const convId = await findOrCreateConversation(profile.id, userId)
    const user = searchResults.find(u => u.id === userId)
    setActiveConversation({ id: convId, user, isGroup: false })
    setSearch(''); setSearchResults([])
    fetchConversations(profile.id)
  }

  function handleGroupCreated(convId, name, members) {
    setShowNewGroup(false)
    setActiveConversation({ id: convId, name, isGroup: true, members })
    fetchConversations(profile.id)
  }

  if (showNewGroup) return <NewGroupPage initialType={newGroupType} onBack={() => setShowNewGroup(false)} onCreated={handleGroupCreated} />

  const filtered = search ? [] : conversations.filter(c => {
    if (filter === 'directos') return !c.isGroup
    if (filter === 'grupos')   return c.isGroup
    return true
  })

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden', position: 'relative' }}>

      {/* ── HEADER ── */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Logo icon */}
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: `linear-gradient(135deg, ${C.greenDk} 0%, #0f3d1a 100%)`,
              border: `1px solid ${C.green}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 12px ${C.green}22`,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={C.green} stroke="none">
                <path d="M13 2L4.5 13.5H11L10 22L20.5 10H14L13 2Z"/>
              </svg>
            </div>
            <span style={{ color: C.text, fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px' }}>
              Mi Mensajero
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => onProfileClick?.()} style={{
              width: 32, height: 32, borderRadius: '50%', background: C.panel2,
              border: `1px solid ${C.border}`, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.text2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </button>
            <button onClick={signOut} style={{
              background: 'none', border: `1px solid ${C.border}`, cursor: 'pointer',
              color: C.textDim, fontSize: 11, padding: '4px 10px', borderRadius: 8,
            }}>Salir</button>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '0 16px 10px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: C.panel2, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '0 12px',
            transition: 'border-color .2s',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
            </svg>
            <input
              type="text" placeholder="Buscar chats o usuarios..." value={search}
              onChange={e => { setSearch(e.target.value); searchUsers(e.target.value) }}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: C.text, fontSize: 14, padding: '10px 0',
              }}
            />
            {search && (
              <button onClick={() => { setSearch(''); setSearchResults([]) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 16, lineHeight: 1 }}>✕</button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        {!search && (
          <div style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
            {[['todos','Todos'],['directos','Directos'],['grupos','Grupos']].map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} style={{
                flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                padding: '9px 8px 10px',
                color: filter === id ? C.green : C.textDim,
                fontSize: 12, fontWeight: filter === id ? 700 : 400,
                borderBottom: filter === id ? `2px solid ${C.green}` : '2px solid transparent',
                marginBottom: -1, transition: 'color .15s',
                letterSpacing: '.3px',
              }}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── STORIES BAR ── */}
      <StoriesBar />

      {/* ── LIST ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowAnchor: 'none' }}>

        {/* Skeleton loading */}
        {loadingConvs && !search && (
          <>{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</>
        )}

        {/* Search results */}
        {search && (
          <>
            {searching && (
              <div style={{ padding: '20px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
                <div className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 12, width: '50%', marginBottom: 6 }} />
                  <div className="skeleton" style={{ height: 10, width: '70%' }} />
                </div>
              </div>
            )}
            {!searching && searchResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: C.textDim }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                <p style={{ margin: '0 0 4px', fontSize: 14, color: C.text2 }}>Sin resultados</p>
                <p style={{ margin: 0, fontSize: 12 }}>Probá con otro nombre o @usuario</p>
              </div>
            )}
            {searchResults.map(u => (
              <button key={u.id} onClick={() => openChat(u.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px', background: 'none', border: 'none',
                borderBottom: `1px solid ${C.border}22`, cursor: 'pointer', textAlign: 'left',
                transition: 'background .15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = C.panel}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <Avatar name={u.display_name} size={46} color={avatarColor(u.id)} url={u.avatar_url} />
                <div>
                  <p style={{ margin: 0, color: C.text, fontWeight: 600, fontSize: 14 }}>{u.display_name}</p>
                  <p style={{ margin: '2px 0 0', color: C.textDim, fontSize: 12 }}>@{u.username}</p>
                </div>
              </button>
            ))}
          </>
        )}

        {/* Empty state */}
        {!search && !loadingConvs && filtered.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', color: C.textDim,
            padding: '0 32px', textAlign: 'center', gap: 12,
          }}>
            <div style={{
              width: 68, height: 68, borderRadius: '50%',
              background: `${C.green}0A`, border: `1.5px solid ${C.green}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            }}>💬</div>
            <p style={{ margin: 0, fontSize: 14, color: C.text2, fontWeight: 600 }}>Sin conversaciones</p>
            <p style={{ margin: 0, fontSize: 12 }}>Buscá un usuario o tocá + para crear un grupo</p>
          </div>
        )}

        {/* Conversations */}
        {!search && filtered.map((conv) => {
          const isGroup     = conv.isGroup
          const isCommunity = conv.isCommunity
          const name        = isGroup ? conv.name : conv.user?.display_name
          const color       = isCommunity ? '#7c3aed' : isGroup ? C.greenDk : avatarColor(conv.user?.id)
          const lastMsg     = conv.lastMessage
          const isMine      = lastMsg?.sender_id === profile?.id
          const isActive    = activeConversation?.id === conv.id
          const preview     = lastMsg?.type === 'image' ? '📷 Imagen'
            : lastMsg?.type === 'audio' ? '🎤 Audio'
            : lastMsg?.content?.startsWith('[↩ ') ? '↩ ' + (lastMsg.content.split('\n')[1] || lastMsg.content)
            : lastMsg?.content || ''
          // For groups: find sender name from members list
          const senderMember = isGroup && !isMine && lastMsg
            ? conv.members?.find(m => m.id === lastMsg.sender_id)
            : null
          const senderName = senderMember?.display_name || senderMember?.username || null
          const memberCount = conv.members?.length || 0

          return (
            <button key={conv.id} onClick={() => setActiveConversation(conv)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px',
                background: isActive ? `${C.green}0C` : 'none',
                border: 'none',
                borderLeft: isActive ? `3px solid ${C.green}` : '3px solid transparent',
                borderBottom: `1px solid ${C.border}22`,
                cursor: 'pointer', textAlign: 'left',
                transition: 'background .15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.panel }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'none' }}
            >
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {isGroup
                  ? <GroupAvatar members={conv.members || []} size={50} isCommunity={isCommunity} />
                  : storyUserIds.has(conv.user?.id)
                    ? (
                      <div style={{
                        width: 54, height: 54, borderRadius: '50%',
                        background: `conic-gradient(${C.green}, #00cc66, ${C.green})`,
                        padding: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.bg}` }}>
                          <Avatar name={name} size={46} color={color} url={conv.user?.avatar_url} />
                        </div>
                      </div>
                    )
                    : <Avatar name={name} size={50} color={color} url={conv.user?.avatar_url} />
                }
                {/* Online dot — only for direct chats */}
                {!isGroup && onlineUsers.has(conv.user?.id) && (
                  <span style={{
                    position: 'absolute', bottom: 1, right: 1,
                    width: 11, height: 11, borderRadius: '50%',
                    background: C.green, border: `2px solid ${C.bg}`,
                    boxShadow: `0 0 6px ${C.green}99`,
                  }} />
                )}
                {conv.unread > 0 && (
                  <span style={{
                    position: 'absolute', top: -3, right: -4,
                    minWidth: 18, height: 18, borderRadius: 9, padding: '0 5px',
                    background: C.green, color: C.bg, fontSize: 10, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${C.bg}`,
                    boxShadow: `0 0 8px ${C.green}88`,
                  }}>{conv.unread > 99 ? '99+' : conv.unread}</span>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, color: conv.unread > 0 ? C.text : C.text2,
                      fontWeight: conv.unread > 0 ? 700 : 600, fontSize: 14,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{name}</p>
                    {isCommunity && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: '#a78bfa', flexShrink: 0,
                        background: '#7c3aed22', border: '1px solid #7c3aed44',
                        borderRadius: 4, padding: '1px 5px', letterSpacing: '0.5px', textTransform: 'uppercase',
                      }}>Comunidad</span>
                    )}
                    {isGroup && !isCommunity && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: C.green, flexShrink: 0,
                        background: `${C.green}15`, border: `1px solid ${C.green}30`,
                        borderRadius: 4, padding: '1px 5px', letterSpacing: '0.5px', textTransform: 'uppercase',
                      }}>Grupo</span>
                    )}
                  </div>
                  {lastMsg && (
                    <span style={{
                      fontSize: 11, flexShrink: 0, marginLeft: 8,
                      color: conv.unread > 0 ? C.green : C.textDim,
                      fontWeight: conv.unread > 0 ? 600 : 400,
                    }}>{formatTime(lastMsg.created_at)}</span>
                  )}
                </div>
                {/* Member count for groups */}
                {isGroup && !lastMsg && (
                  <p style={{ margin: 0, fontSize: 11, color: C.textDim }}>
                    {memberCount} miembro{memberCount !== 1 ? 's' : ''}
                  </p>
                )}
                {lastMsg && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isMine && <Ticks read={!!lastMsg.read_at} />}
                    <p style={{
                      margin: 0, fontSize: 12,
                      color: conv.unread > 0 ? C.text2 : C.textDim,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                      fontWeight: conv.unread > 0 ? 500 : 400,
                    }}>
                      {isMine
                        ? <span style={{ color: C.textDim }}>Vos: </span>
                        : senderName
                          ? <span style={{ color: C.text2, fontWeight: 600 }}>{senderName.split(' ')[0]}: </span>
                          : null
                      }
                      {preview || 'Conversación iniciada'}
                    </p>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── FAB ── */}
      <div style={{ position: 'absolute', bottom: 20, right: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, zIndex: 30 }}>
        {showFab && (
          <>
            <FabItem label="Nueva comunidad" icon="🌐" onClick={() => { setShowFab(false); setNewGroupType('community'); setShowNewGroup(true) }} />
            <FabItem label="Nuevo grupo" icon="👥" onClick={() => { setShowFab(false); setNewGroupType('group'); setShowNewGroup(true) }} />
            <FabItem label="Nuevo chat" icon="💬" onClick={() => { setShowFab(false); document.querySelector('input[placeholder*="Buscar"]')?.focus() }} />
          </>
        )}
        <button
          onClick={e => { e.stopPropagation(); setShowFab(v => !v) }}
          style={{
            width: 50, height: 50, borderRadius: '50%',
            background: C.green, border: 'none', cursor: 'pointer',
            boxShadow: `0 4px 20px ${C.green}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: showFab ? 'rotate(45deg)' : 'none',
            transition: 'transform .2s, box-shadow .2s',
          }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke={C.bg} strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function FabItem({ label, icon, onClick }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick() }} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 16px', background: C.panel,
      border: `1px solid ${C.border}`, borderRadius: 24, cursor: 'pointer',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ color: C.text2, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}
