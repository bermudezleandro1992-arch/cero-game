import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { C } from '../theme'

function timeAgo(ts) {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

const TYPE_CONFIG = {
  message:      { icon: '💬', label: 'Mensaje',    color: C.green },
  group:        { icon: '👥', label: 'Grupo',      color: '#7c3aed' },
  reaction:     { icon: '❤️', label: 'Reacción',   color: '#e91e63' },
  mention:      { icon: '@',  label: 'Mención',    color: '#00acc1' },
  system:       { icon: '🔔', label: 'Sistema',    color: C.yellow },
  tournament:   { icon: '🏆', label: 'Torneo',     color: C.yellow },
  match:        { icon: '⚔️', label: 'Partido',    color: '#fb8c00' },
}

export default function NotificationsPage({ onConvClick }) {
  const { profile } = useAuthStore()
  const { conversations, setActiveConversation } = useChatStore()
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!profile?.id) return
    loadNotifications()
    // Subscribe to realtime new messages that mention us or are in our convs
    const ch = supabase
      .channel(`notifs:${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new
        // Check if it's in one of our conversations
        const conv = conversations.find(c => c.id === msg.conversation_id)
        if (!conv || msg.sender_id === profile.id) return
        const isMention = msg.content?.includes(`@${profile.display_name}`)
        const senderName = conv.user?.display_name || conv.name || 'Alguien'
        addNotif({
          id: `msg-${msg.id}`,
          type: isMention ? 'mention' : 'message',
          title: isMention ? `${senderName} te mencionó` : `Nuevo mensaje de ${senderName}`,
          body: msg.content?.slice(0, 80),
          conversation_id: msg.conversation_id,
          created_at: msg.created_at,
          read: false,
        })
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [profile?.id, conversations.length])

  async function loadNotifications() {
    setLoading(true)
    // Build notifications from unread messages in conversations
    const built = []
    for (const conv of conversations) {
      if (conv.unread > 0) {
        const name = conv.name || conv.user?.display_name || 'Conversación'
        built.push({
          id: `unread-${conv.id}`,
          type: conv.isGroup ? 'group' : 'message',
          title: conv.isGroup
            ? `${conv.unread} mensaje${conv.unread > 1 ? 's' : ''} en ${name}`
            : `${conv.unread} mensaje${conv.unread > 1 ? 's' : ''} de ${name}`,
          body: conv.lastMessage?.content?.slice(0, 80) || '',
          conversation_id: conv.id,
          created_at: conv.lastMessage?.created_at,
          read: false,
        })
      }
    }
    // Sort by date
    built.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    setNotifs(built)
    setLoading(false)
  }

  function addNotif(n) {
    setNotifs(prev => {
      const exists = prev.find(x => x.id === n.id)
      if (exists) return prev
      return [n, ...prev].slice(0, 100)
    })
  }

  function markRead(id) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  function openConversation(notif) {
    markRead(notif.id)
    const conv = conversations.find(c => c.id === notif.conversation_id)
    if (conv) { setActiveConversation(conv); onConvClick?.() }
  }

  const FILTERS = [
    { id: 'all',     label: 'Todos' },
    { id: 'message', label: '💬 Mensajes' },
    { id: 'mention', label: '@ Menciones' },
    { id: 'group',   label: '👥 Grupos' },
  ]

  const filtered = filter === 'all' ? notifs : notifs.filter(n => n.type === filter)
  const unreadCount = notifs.filter(n => !n.read).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 10px', background: C.panel,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🔔</span>
            <span style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>Notificaciones</span>
            {unreadCount > 0 && (
              <span style={{
                background: C.green, color: C.bg, borderRadius: 10,
                fontSize: 11, fontWeight: 800, padding: '1px 7px',
              }}>{unreadCount}</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{
              background: 'none', border: `1px solid ${C.border}`,
              borderRadius: 8, color: C.textDim, fontSize: 12,
              padding: '4px 10px', cursor: 'pointer',
            }}>Marcar todo leído</button>
          )}
        </div>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              background: filter === f.id ? `${C.green}20` : C.panel2,
              border: `1px solid ${filter === f.id ? C.green : C.border}`,
              borderRadius: 20, color: filter === f.id ? C.green : C.text2,
              fontSize: 12, padding: '4px 12px', cursor: 'pointer',
              fontWeight: filter === f.id ? 700 : 400, whiteSpace: 'nowrap',
              transition: 'all .15s',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.panel2 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 13, background: C.panel2, borderRadius: 6, width: '60%' }} />
                  <div style={{ height: 11, background: C.panel2, borderRadius: 6, width: '80%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 }}>
            <span style={{ fontSize: 48 }}>🔕</span>
            <p style={{ color: C.textDim, fontSize: 14, margin: 0, textAlign: 'center' }}>Sin notificaciones</p>
          </div>
        )}

        {!loading && filtered.map(notif => {
          const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system
          return (
            <button
              key={notif.id}
              onClick={() => openConversation(notif)}
              style={{
                width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '13px 16px',
                background: notif.read ? 'none' : `${C.green}06`,
                border: 'none', borderBottom: `1px solid ${C.border}22`,
                cursor: 'pointer', textAlign: 'left',
                transition: 'background .15s',
              }}
              onMouseEnter={e => { if (notif.read) e.currentTarget.style.background = C.panel }}
              onMouseLeave={e => { if (notif.read) e.currentTarget.style.background = 'none' }}
            >
              {/* Icon */}
              <div style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                background: `${cfg.color}18`, border: `1px solid ${cfg.color}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: cfg.icon === '@' ? 16 : 20, fontWeight: 800,
                color: cfg.icon === '@' ? cfg.color : 'inherit',
              }}>{cfg.icon}</div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                  <span style={{ color: notif.read ? C.text2 : C.text, fontWeight: notif.read ? 500 : 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {notif.title}
                  </span>
                  <span style={{ color: C.textDim, fontSize: 11, flexShrink: 0 }}>{timeAgo(notif.created_at)}</span>
                </div>
                {notif.body && (
                  <p style={{ margin: 0, color: C.textDim, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {notif.body}
                  </p>
                )}
                <span style={{
                  display: 'inline-block', marginTop: 4,
                  fontSize: 10, fontWeight: 700, color: cfg.color,
                  background: `${cfg.color}15`, borderRadius: 6, padding: '1px 6px',
                }}>{cfg.label}</span>
              </div>

              {/* Unread dot */}
              {!notif.read && (
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: C.green, flexShrink: 0, marginTop: 4,
                  boxShadow: `0 0 6px ${C.green}`,
                }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
