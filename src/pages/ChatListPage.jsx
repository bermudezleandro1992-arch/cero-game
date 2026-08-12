import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { supabase } from '../lib/supabase'
import ChatPage from './ChatPage'
import ProfileSheet from '../components/ProfileSheet'

export default function ChatListPage() {
  const { profile, signOut } = useAuthStore()
  const {
    conversations, fetchConversations, findOrCreateConversation,
    setActiveConversation, activeConversation, subscribeToConversations,
  } = useChatStore()
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  useEffect(() => {
    if (!profile?.id) return
    fetchConversations(profile.id)
    const unsub = subscribeToConversations(profile.id)
    return unsub
  }, [profile?.id])

  async function searchUsers(q) {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('users')
      .select('id, display_name, username, avatar_url')
      .or(`username.ilike.%${q.replace('@', '')}%,display_name.ilike.%${q}%`)
      .neq('id', profile.id)
      .limit(8)
    setSearchResults(data || [])
    setSearching(false)
  }

  async function openChat(userId) {
    const convId = await findOrCreateConversation(profile.id, userId)
    const user = searchResults.find(u => u.id === userId) ||
      conversations.find(c => c.user?.id === userId)?.user
    setActiveConversation({ id: convId, user })
    setSearch('')
    setSearchResults([])
    fetchConversations(profile.id)
  }

  if (showProfile) {
    return <ProfileSheet onClose={() => setShowProfile(false)} />
  }

  if (activeConversation) {
    return <ChatPage onBack={() => { setActiveConversation(null); fetchConversations(profile.id) }} />
  }

  const initials = (profile?.display_name || '?').slice(0, 2).toUpperCase()

  return (
    <div className="h-screen flex flex-col" style={{ background: '#111b21' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3" style={{ background: '#202c33' }}>
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowProfile(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
            style={{ background: '#2a3942' }}>
            {initials}
          </button>
          <h1 className="text-base font-bold text-white">Mi Mensajero</h1>
          <button onClick={signOut} className="text-xs px-3 py-1 rounded-lg" style={{ color: '#8696a0', background: '#2a3942' }}>
            Salir
          </button>
        </div>

        {/* Buscador */}
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar por nombre o @usuario"
            value={search}
            onChange={e => { setSearch(e.target.value); searchUsers(e.target.value) }}
            className="w-full px-4 py-2 rounded-xl text-white text-sm outline-none"
            style={{ background: '#2a3942', color: '#e9edef' }}
          />
          {search && (
            <button onClick={() => { setSearch(''); setSearchResults([]) }}
              className="absolute right-3 top-2 text-sm"
              style={{ color: '#8696a0' }}>✕</button>
          )}
        </div>
        {searching && <p className="text-xs mt-1 px-1" style={{ color: '#8696a0' }}>Buscando...</p>}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">
        {/* Resultados de búsqueda */}
        {search && (
          <>
            {searchResults.length === 0 && !searching && (
              <p className="text-sm text-center py-8" style={{ color: '#8696a0' }}>
                No se encontraron usuarios
              </p>
            )}
            {searchResults.map(u => (
              <button key={u.id} onClick={() => openChat(u.id)}
                className="w-full flex items-center gap-3 px-4 py-3 border-b text-left"
                style={{ borderColor: '#2a3942', background: '#111b21' }}>
                <Avatar user={u} size={48} />
                <div>
                  <p className="font-medium text-white text-sm">{u.display_name}</p>
                  <p className="text-xs" style={{ color: '#8696a0' }}>@{u.username}</p>
                </div>
              </button>
            ))}
          </>
        )}

        {/* Lista de conversaciones */}
        {!search && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: '#8696a0' }}>
            <div className="text-4xl">💬</div>
            <p className="text-sm text-center px-8">
              Buscá un usuario por nombre o @usuario para empezar a chatear
            </p>
          </div>
        )}

        {!search && conversations.map(conv => (
          <button key={conv.id}
            onClick={() => setActiveConversation(conv)}
            className="w-full flex items-center gap-3 px-4 py-3 border-b text-left"
            style={{ borderColor: '#2a3942', background: '#111b21' }}>
            <Avatar user={conv.user} size={50} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-white text-sm">{conv.user?.display_name}</p>
                {conv.lastMessage && (
                  <span className="text-xs flex-shrink-0 ml-2"
                    style={{ color: conv.unread > 0 ? '#00a884' : '#8696a0' }}>
                    {formatTime(conv.lastMessage.created_at)}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center mt-0.5">
                <p className="text-xs truncate flex-1" style={{ color: '#8696a0' }}>
                  {conv.lastMessage?.content || 'Conversación iniciada'}
                </p>
                {conv.unread > 0 && (
                  <span className="ml-2 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: '#00a884', fontSize: 11 }}>
                    {conv.unread > 99 ? '99' : conv.unread}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function Avatar({ user, size = 40 }) {
  const initials = user?.display_name?.slice(0, 2).toUpperCase() || '?'
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white"
      style={{ width: size, height: size, background: '#2a3942', fontSize: size * 0.33 }}>
      {user?.avatar_url
        ? <img src={user.avatar_url} className="rounded-full w-full h-full object-cover" alt="" />
        : initials}
    </div>
  )
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}
