import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { supabase } from '../lib/supabase'
import ChatPage from './ChatPage'

export default function ChatListPage() {
  const { profile, signOut } = useAuthStore()
  const { conversations, fetchConversations, findOrCreateConversation, setActiveConversation, activeConversation } = useChatStore()
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (profile?.id) fetchConversations(profile.id)
  }, [profile])

  async function searchUsers(q) {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('users')
      .select('id, display_name, username, avatar_url')
      .ilike('username', `%${q.replace('@', '')}%`)
      .neq('id', profile.id)
      .limit(5)
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

  if (activeConversation) {
    return <ChatPage onBack={() => { setActiveConversation(null); fetchConversations(profile.id) }} />
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: '#111b21' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2" style={{ background: '#202c33' }}>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-white">Mi Mensajero</h1>
          <button onClick={signOut} className="text-xs px-3 py-1 rounded-lg" style={{ color: '#8696a0', background: '#2a3942' }}>
            Salir
          </button>
        </div>
        {/* Buscador */}
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar por @usuario"
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

        {/* Resultados de búsqueda */}
        {searchResults.length > 0 && (
          <div className="mt-1 rounded-xl overflow-hidden" style={{ background: '#2a3942' }}>
            {searchResults.map(u => (
              <button key={u.id} onClick={() => openChat(u.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:brightness-110 transition-all"
                style={{ background: '#2a3942' }}>
                <Avatar user={u} size={36} />
                <div>
                  <p className="text-sm font-medium text-white">{u.display_name}</p>
                  <p className="text-xs" style={{ color: '#8696a0' }}>@{u.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {searching && <p className="text-xs mt-1 px-1" style={{ color: '#8696a0' }}>Buscando...</p>}
      </div>

      {/* Lista de conversaciones */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && !search && (
          <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: '#8696a0' }}>
            <div className="text-4xl">💬</div>
            <p className="text-sm">Buscá un usuario por @usuario para comenzar</p>
          </div>
        )}
        {conversations.map(conv => (
          <button key={conv.id}
            onClick={() => setActiveConversation(conv)}
            className="w-full flex items-center gap-3 px-4 py-3 border-b text-left transition-all hover:brightness-110"
            style={{ borderColor: '#2a3942', background: '#111b21' }}>
            <Avatar user={conv.user} size={48} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <p className="font-medium text-white text-sm">{conv.user?.display_name}</p>
                {conv.lastMessage && (
                  <span className="text-xs" style={{ color: '#8696a0' }}>
                    {formatTime(conv.lastMessage.created_at)}
                  </span>
                )}
              </div>
              <p className="text-xs truncate mt-0.5" style={{ color: '#8696a0' }}>
                {conv.lastMessage?.content || 'Conversación iniciada'}
              </p>
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
    <div className="rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-white text-sm"
      style={{ width: size, height: size, background: '#2a3942', fontSize: size * 0.35 }}>
      {user?.avatar_url
        ? <img src={user.avatar_url} className="rounded-full w-full h-full object-cover" />
        : initials}
    </div>
  )
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
