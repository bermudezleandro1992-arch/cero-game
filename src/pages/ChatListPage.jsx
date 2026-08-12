import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { supabase } from '../lib/supabase'
import ChatPage from './ChatPage'
import ProfileSheet from '../components/ProfileSheet'
import NewGroupPage from './NewGroupPage'

const COLORS = ['#e91e63','#9c27b0','#2196f3','#00bcd4','#4caf50','#ff9800','#f44336']
function userColor(id) {
  if (!id) return '#2a3942'
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return COLORS[Math.abs(h) % COLORS.length]
}

function Avatar({ name, size = 48, color, avatarUrl }) {
  const letters = name?.slice(0, 2).toUpperCase() || '?'
  if (avatarUrl) return (
    <img src={avatarUrl} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  )
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color || '#2a3942',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>{letters}</div>
  )
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

export default function ChatListPage() {
  const { profile, signOut } = useAuthStore()
  const { conversations, fetchConversations, findOrCreateConversation, setActiveConversation, activeConversation, subscribeToConversations } = useChatStore()
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [showFab, setShowFab] = useState(false)

  useEffect(() => {
    if (!profile?.id) return
    fetchConversations(profile.id)
    const unsub = subscribeToConversations(profile.id)
    return unsub
  }, [profile?.id])

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
    const user = searchResults.find(u => u.id === userId) || conversations.find(c => c.user?.id === userId)?.user
    setActiveConversation({ id: convId, user, isGroup: false })
    setSearch(''); setSearchResults([])
    fetchConversations(profile.id)
  }

  function handleGroupCreated(convId, name, members) {
    setShowNewGroup(false)
    setActiveConversation({ id: convId, name, isGroup: true, members })
    fetchConversations(profile.id)
  }

  if (showProfile) return <ProfileSheet onClose={() => setShowProfile(false)} />
  if (showNewGroup) return <NewGroupPage onBack={() => setShowNewGroup(false)} onCreated={handleGroupCreated} />
  if (activeConversation) return (
    <ChatPage onBack={() => { setActiveConversation(null); fetchConversations(profile.id) }} />
  )

  const myColor = userColor(profile?.id)

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#111b21', overflow: 'hidden' }}>

      {/* ── HEADER ── */}
      <div style={{ background: '#202c33', padding: '10px 16px 12px', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={() => setShowProfile(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Avatar name={profile?.display_name} size={36} color={myColor} avatarUrl={profile?.avatar_url} />
          </button>
          <h1 style={{ color: '#e9edef', fontWeight: 700, fontSize: 17, margin: 0 }}>Mi Mensajero</h1>
          <button onClick={signOut}
            style={{ background: '#2a3942', border: 'none', cursor: 'pointer', color: '#8696a0', fontSize: 12, padding: '5px 10px', borderRadius: 8 }}>
            Salir
          </button>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#2a3942', borderRadius: 24, padding: '0 14px', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
          </svg>
          <input type="text" placeholder="Buscar o empezar nuevo chat" value={search}
            onChange={e => { setSearch(e.target.value); searchUsers(e.target.value) }}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e9edef', fontSize: 14, padding: '9px 0' }} />
          {search && (
            <button onClick={() => { setSearch(''); setSearchResults([]) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
          )}
        </div>
        {searching && <p style={{ color: '#8696a0', fontSize: 12, margin: '4px 4px 0' }}>Buscando...</p>}
      </div>

      {/* ── LIST ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Search results */}
        {search && (
          <>
            {searchResults.length === 0 && !searching && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8696a0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                <p style={{ margin: 0, fontSize: 14 }}>No se encontraron usuarios</p>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>Probá con otro nombre o @usuario</p>
              </div>
            )}
            {searchResults.map(u => (
              <button key={u.id} onClick={() => openChat(u.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid #1a2530', cursor: 'pointer', textAlign: 'left' }}>
                <Avatar name={u.display_name} size={50} color={userColor(u.id)} avatarUrl={u.avatar_url} />
                <div>
                  <p style={{ margin: 0, color: '#e9edef', fontWeight: 600, fontSize: 15 }}>{u.display_name}</p>
                  <p style={{ margin: '2px 0 0', color: '#8696a0', fontSize: 13 }}>@{u.username}</p>
                </div>
              </button>
            ))}
          </>
        )}

        {/* Conversations */}
        {!search && conversations.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8696a0', padding: '0 32px', textAlign: 'center', gap: 12 }}>
            <div style={{ fontSize: 52 }}>💬</div>
            <p style={{ margin: 0, fontSize: 15, color: '#e9edef', fontWeight: 600 }}>Sin conversaciones</p>
            <p style={{ margin: 0, fontSize: 13 }}>Buscá un usuario para chatear o usá el botón + para crear un grupo</p>
          </div>
        )}

        {!search && conversations.map(conv => {
          const isGroup = conv.isGroup
          const name = isGroup ? conv.name : conv.user?.display_name
          const avatarColor = isGroup ? '#1f6b5c' : userColor(conv.user?.id)
          const lastMsg = conv.lastMessage
          const preview = lastMsg?.type === 'image' ? '📷 Imagen'
            : lastMsg?.content?.startsWith('[↩ ') ? '↩ ' + lastMsg.content.split('\n')[1] || lastMsg.content
            : lastMsg?.content || ''
          const isMineLastMsg = lastMsg?.sender_id === profile?.id

          return (
            <button key={conv.id} onClick={() => setActiveConversation(conv)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid #1a2530', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ position: 'relative' }}>
                <Avatar name={name} size={52} color={avatarColor} avatarUrl={!isGroup ? conv.user?.avatar_url : null} />
                {conv.unread > 0 && (
                  <span style={{
                    position: 'absolute', top: -2, right: -2,
                    minWidth: 18, height: 18, padding: '0 5px', borderRadius: 10,
                    background: '#00a884', color: '#fff', fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid #111b21',
                  }}>{conv.unread > 99 ? '99+' : conv.unread}</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <p style={{ margin: 0, color: '#e9edef', fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{name}</p>
                  {lastMsg && (
                    <span style={{ fontSize: 12, color: conv.unread > 0 ? '#00a884' : '#8696a0', flexShrink: 0, marginLeft: 8 }}>
                      {formatTime(lastMsg.created_at)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#8696a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {isMineLastMsg && <span style={{ color: '#8696a0' }}>Vos: </span>}
                    {preview || 'Conversación iniciada'}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── FAB ── */}
      {showFab && <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setShowFab(false)} />}
      <div style={{ position: 'fixed', bottom: 24, right: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, zIndex: 20 }}>
        {showFab && (
          <>
            <FabItem label="Nuevo grupo" icon="👥" onClick={() => { setShowFab(false); setShowNewGroup(true) }} />
            <FabItem label="Nuevo chat" icon="💬" onClick={() => { setShowFab(false); document.querySelector('input[placeholder*="Buscar"]')?.focus() }} />
          </>
        )}
        <button onClick={() => setShowFab(v => !v)}
          style={{
            width: 56, height: 56, borderRadius: '50%', background: '#00a884',
            border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,168,132,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: showFab ? 'rotate(45deg)' : 'none', transition: 'transform .2s',
          }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function FabItem({ label, icon, onClick }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#202c33', borderRadius: 24, border: 'none', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.4)', zIndex: 20 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ color: '#e9edef', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}
