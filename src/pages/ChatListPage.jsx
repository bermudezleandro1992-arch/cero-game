import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { supabase } from '../lib/supabase'
import NewGroupPage from './NewGroupPage'

// ── Helpers ───────────────────────────────────────────────────────────────────
const COLORS = ['#e91e63','#9c27b0','#2196f3','#00bcd4','#4caf50','#ff9800','#f44336']
function userColor(id) {
  if (!id) return '#1a2e22'
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return COLORS[Math.abs(h) % COLORS.length]
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts), now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const yest = new Date(now); yest.setDate(yest.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 48, color, avatarUrl, unread }) {
  const letters = name?.slice(0, 2).toUpperCase() || '?'
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {avatarUrl
        ? <img src={avatarUrl} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
        : (
          <div style={{
            width: size, height: size, borderRadius: '50%',
            background: color || '#1a2e22',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.35, fontWeight: 700, color: '#fff',
          }}>{letters}</div>
        )
      }
      {unread > 0 && (
        <span style={{
          position: 'absolute', top: -2, right: -4,
          minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
          background: '#00e676', color: '#0a1409', fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid #0a1409',
        }}>{unread > 99 ? '99+' : unread}</span>
      )}
    </div>
  )
}

// ── Check ticks ───────────────────────────────────────────────────────────────
function Ticks({ read }) {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ flexShrink: 0 }}>
      {read
        ? <><path d="M1 5l3 3 6-7" stroke="#00e676" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 5l3 3 6-7" stroke="#00e676" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></>
        : <><path d="M1 5l3 3 6-7" stroke="#5f7a6a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 5l3 3 6-7" stroke="#5f7a6a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></>
      }
    </svg>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ChatListPage({ desktopMode }) {
  const { profile, signOut } = useAuthStore()
  const { conversations, fetchConversations, findOrCreateConversation, setActiveConversation, activeConversation } = useChatStore()
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [filter, setFilter] = useState('todos') // todos | directos | grupos
  const [showFab, setShowFab] = useState(false)

  useEffect(() => {
    if (!profile?.id) return
    fetchConversations(profile.id)
  }, [profile?.id])

  // Close FAB when clicking outside
  useEffect(() => {
    if (!showFab) return
    const h = () => setShowFab(false)
    document.addEventListener('click', h, { capture: true, once: true })
    return () => document.removeEventListener('click', h, { capture: true })
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
      || conversations.find(c => c.user?.id === userId)?.user
    setActiveConversation({ id: convId, user, isGroup: false })
    setSearch(''); setSearchResults([])
    fetchConversations(profile.id)
  }

  function handleGroupCreated(convId, name, members) {
    setShowNewGroup(false)
    setActiveConversation({ id: convId, name, isGroup: true, members })
    fetchConversations(profile.id)
  }

  if (showNewGroup) return <NewGroupPage onBack={() => setShowNewGroup(false)} onCreated={handleGroupCreated} />

  const filtered = search ? [] : conversations.filter(c => {
    if (filter === 'directos') return !c.isGroup
    if (filter === 'grupos')   return c.isGroup
    return true
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a1409', overflow: 'hidden', position: 'relative' }}>

      {/* ── HEADER ── */}
      <div style={{ background: '#0e1a14', padding: '14px 16px 0', flexShrink: 0 }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#00e676', boxShadow: '0 0 8px #00e676',
            }} />
            <h1 style={{ color: '#c8ddd0', fontWeight: 800, fontSize: 18, margin: 0, letterSpacing: '-0.3px' }}>
              Mi Mensajero
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!desktopMode && (
              <button
                onClick={signOut}
                style={{ background: 'none', border: '1px solid #1c2e23', cursor: 'pointer', color: '#5f7a6a', fontSize: 11, padding: '4px 10px', borderRadius: 8 }}>
                Salir
              </button>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center',
          background: '#111e17', border: '1px solid #1c2e23',
          borderRadius: 12, padding: '0 12px', gap: 8, marginBottom: 12,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5f7a6a" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar usuarios..."
            value={search}
            onChange={e => { setSearch(e.target.value); searchUsers(e.target.value) }}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#c8ddd0', fontSize: 14, padding: '9px 0',
            }}
          />
          {search && (
            <button onClick={() => { setSearch(''); setSearchResults([]) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f7a6a', fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
          )}
        </div>

        {/* Category tabs */}
        {!search && (
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1c2e23', marginLeft: -16, marginRight: -16, paddingLeft: 16 }}>
            {[['todos','Todos'],['directos','Directos'],['grupos','Grupos']].map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '8px 16px 10px',
                color: filter === id ? '#00e676' : '#5f7a6a',
                fontSize: 13, fontWeight: filter === id ? 700 : 500,
                borderBottom: filter === id ? '2px solid #00e676' : '2px solid transparent',
                marginBottom: -1, transition: 'color .15s',
              }}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── LIST ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Search results */}
        {search && (
          <>
            {searching && (
              <p style={{ color: '#5f7a6a', fontSize: 12, margin: '8px 16px 0' }}>Buscando...</p>
            )}
            {!searching && searchResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#5f7a6a' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                <p style={{ margin: 0, fontSize: 14 }}>No se encontraron usuarios</p>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>Probá con otro nombre o @usuario</p>
              </div>
            )}
            {searchResults.map(u => (
              <button key={u.id} onClick={() => openChat(u.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px', background: 'none', border: 'none',
                borderBottom: '1px solid #111e17', cursor: 'pointer', textAlign: 'left',
              }}>
                <Avatar name={u.display_name} size={46} color={userColor(u.id)} avatarUrl={u.avatar_url} />
                <div>
                  <p style={{ margin: 0, color: '#c8ddd0', fontWeight: 600, fontSize: 14 }}>{u.display_name}</p>
                  <p style={{ margin: '2px 0 0', color: '#5f7a6a', fontSize: 12 }}>@{u.username}</p>
                </div>
              </button>
            ))}
          </>
        )}

        {/* Empty state */}
        {!search && filtered.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', color: '#5f7a6a',
            padding: '0 32px', textAlign: 'center', gap: 12,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(0,230,118,0.06)', border: '1.5px solid rgba(0,230,118,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
            }}>💬</div>
            <p style={{ margin: 0, fontSize: 15, color: '#c8ddd0', fontWeight: 600 }}>Sin conversaciones</p>
            <p style={{ margin: 0, fontSize: 12 }}>Buscá un usuario o tocá el botón + para crear un grupo</p>
          </div>
        )}

        {/* Conversation list */}
        {!search && filtered.map(conv => {
          const isGroup  = conv.isGroup
          const name     = isGroup ? conv.name : conv.user?.display_name
          const avatarColor = isGroup ? '#1a4a35' : userColor(conv.user?.id)
          const lastMsg  = conv.lastMessage
          const isMine   = lastMsg?.sender_id === profile?.id
          const preview  = lastMsg?.type === 'image' ? '📷 Imagen'
            : lastMsg?.type === 'audio' ? '🎤 Audio'
            : lastMsg?.content?.startsWith('[↩ ') ? '↩ ' + (lastMsg.content.split('\n')[1] || lastMsg.content)
            : lastMsg?.content || ''
          const isActive = activeConversation?.id === conv.id

          return (
            <button key={conv.id} onClick={() => setActiveConversation(conv)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px',
              background: isActive ? 'rgba(0,230,118,0.06)' : 'none',
              border: 'none',
              borderLeft: isActive ? '3px solid #00e676' : '3px solid transparent',
              borderBottom: '1px solid #0d1a11',
              cursor: 'pointer', textAlign: 'left',
              transition: 'background .15s',
            }}>
              <Avatar
                name={name} size={50}
                color={avatarColor}
                avatarUrl={!isGroup ? conv.user?.avatar_url : null}
                unread={conv.unread}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <p style={{
                    margin: 0, color: '#c8ddd0', fontWeight: 600, fontSize: 14,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                  }}>{name}</p>
                  {lastMsg && (
                    <span style={{
                      fontSize: 11, flexShrink: 0, marginLeft: 8,
                      color: conv.unread > 0 ? '#00e676' : '#3d5949',
                    }}>{formatTime(lastMsg.created_at)}</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {isMine && lastMsg && <Ticks read={lastMsg.read_at != null} />}
                  <p style={{
                    margin: 0, fontSize: 12, color: conv.unread > 0 ? '#7fa98d' : '#3d5949',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    fontWeight: conv.unread > 0 ? 500 : 400,
                  }}>
                    {isMine && <span style={{ color: '#3d5949' }}>Vos: </span>}
                    {preview || 'Conversación iniciada'}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── FAB ── */}
      <div style={{ position: 'absolute', bottom: desktopMode ? 24 : 80, right: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, zIndex: 30 }}>
        {showFab && (
          <>
            <FabItem label="Nuevo grupo" icon="👥" onClick={() => { setShowFab(false); setShowNewGroup(true) }} />
            <FabItem label="Nuevo chat" icon="💬" onClick={() => { setShowFab(false); document.querySelector('input[placeholder*="Buscar"]')?.focus() }} />
          </>
        )}
        <button
          onClick={e => { e.stopPropagation(); setShowFab(v => !v) }}
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#00e676', border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,230,118,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: showFab ? 'rotate(45deg)' : 'none',
            transition: 'transform .2s, box-shadow .2s',
          }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="#0a1409" strokeWidth="2.5" strokeLinecap="round"/>
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
      padding: '9px 16px', background: '#0e1a14',
      border: '1px solid #1c2e23', borderRadius: 24, cursor: 'pointer',
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ color: '#c8ddd0', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}
