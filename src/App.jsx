import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import { useCallStore } from './store/callStore'
import { useChatStore } from './store/chatStore'
import LoginPage from './pages/LoginPage'
import ChatListPage from './pages/ChatListPage'
import ChatPage from './pages/ChatPage'
import CallPage from './pages/CallPage'
import ProfileSheet from './components/ProfileSheet'
import UpdateBanner from './components/UpdateBanner'
import { usePresence } from './hooks/usePresence'

// ── Icons ─────────────────────────────────────────────────────────────────────
function IconChat({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#00e676' : '#4a6358'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}
function IconUsers({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#00e676' : '#4a6358'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function IconProfile({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#00e676' : '#4a6358'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

export default function App() {
  const { user, profile, loading, setUser, setLoading, fetchProfile } = useAuthStore()
  const { incomingCall, setIncomingCall, clearCall } = useCallStore()
  const { conversations, activeConversation, setActiveConversation, fetchConversations, subscribeToConversations } = useChatStore()
  const [tab, setTab] = useState('chats')
  const [showProfile, setShowProfile] = useState(false)
  usePresence(user?.id)

  // Conversations subscription — only once at root level
  useEffect(() => {
    if (!profile?.id) return
    fetchConversations(profile.id)
    const unsub = subscribeToConversations(profile.id)
    return unsub
  }, [profile?.id])

  // Global incoming call listener
  useEffect(() => {
    if (!profile?.id) return
    const ch = supabase.channel(`user-calls:${profile.id}`)
      .on('broadcast', { event: 'call-offer' }, ({ payload }) => setIncomingCall(payload))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [profile?.id])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <Splash />
  if (!user) return <LoginPage />
  if (!profile) return <Splash />

  const needsSetup = !profile.display_name || profile.display_name === 'Usuario'
    || profile.display_name.startsWith('user_') || !profile.username || profile.username.startsWith('user_')
  if (needsSetup) return <ProfileSheet onClose={() => fetchProfile(user.id)} forceSetup />

  function goBack() {
    setActiveConversation(null)
    fetchConversations(profile.id)
  }

  const totalUnread = conversations.reduce((s, c) => s + (c.unread || 0), 0)
  const showChat = !!activeConversation

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0a1409', overflow: 'hidden' }}>
      <UpdateBanner />

      {/* Incoming call — fixed overlay */}
      {incomingCall && (
        <CallPage
          conversationId={incomingCall.convId}
          myUserId={profile.id}
          contact={{ id: incomingCall.from, display_name: incomingCall.fromName || 'Usuario' }}
          callType={incomingCall.callType}
          isIncoming={true}
          incomingOffer={incomingCall.offer}
          onEnd={clearCall}
        />
      )}

      {/* Profile sheet — tab Perfil */}
      {showProfile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#0a1409' }}>
          <ProfileSheet onClose={() => setShowProfile(false)} />
        </div>
      )}

      {/* ── Shell ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* LEFT PANEL — chat list */}
        <div className={`app-panel-left${showChat ? ' slide-out' : ''}`}>
          <ChatListPage onProfileClick={() => setShowProfile(true)} />
        </div>

        {/* RIGHT PANEL — chat or empty */}
        <div className={`app-panel-right${showChat ? ' slide-in' : ''}`}>
          {activeConversation
            ? <ChatPage onBack={goBack} />
            : <DesktopEmpty />}
        </div>
      </div>

      {/* ── Bottom nav (mobile only, hidden when chat open) ── */}
      {!showChat && (
        <nav style={{ display: 'flex', height: 58, background: '#0e1a14', borderTop: '1px solid #1a2e20', flexShrink: 0 }}
          className="mobile-nav">
          {[
            { id: 'chats',     label: 'Chats',     Icon: IconChat,    badge: totalUnread },
            { id: 'comunidad', label: 'Comunidad', Icon: IconUsers,   badge: 0 },
            { id: 'perfil',    label: 'Perfil',    Icon: IconProfile, badge: 0, action: () => setShowProfile(true) },
          ].map(({ id, label, Icon, badge, action }) => {
            const active = tab === id
            return (
              <button key={id} onClick={() => { action ? action() : setTab(id) }} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, border: 'none', background: 'none',
                cursor: 'pointer', position: 'relative',
              }}>
                {badge > 0 && (
                  <span style={{
                    position: 'absolute', top: 6, right: '26%',
                    minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
                    background: '#00e676', color: '#0a1409', fontSize: 10, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{badge > 99 ? '99+' : badge}</span>
                )}
                <Icon active={active} />
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? '#00e676' : '#4a6358' }}>{label}</span>
                {active && <div style={{ position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, background: '#00e676', borderRadius: 2 }} />}
              </button>
            )
          })}
        </nav>
      )}

      <style>{`
        /* Mobile: panels are absolute, full size, slide in/out */
        .app-panel-left, .app-panel-right {
          position: absolute; inset: 0;
          transition: transform .25s cubic-bezier(.4,0,.2,1);
          background: #0a1409;
          overflow: hidden;
        }
        .app-panel-left               { transform: translateX(0); }
        .app-panel-left.slide-out     { transform: translateX(-100%); }
        .app-panel-right              { transform: translateX(100%); }
        .app-panel-right.slide-in     { transform: translateX(0); }

        /* Desktop: side by side, no slide, no absolute */
        @media (min-width: 768px) {
          .mobile-nav { display: none !important; }
          .app-panel-left, .app-panel-right {
            position: relative !important;
            transform: none !important;
          }
          .app-panel-left {
            width: 340px;
            flex-shrink: 0;
            border-right: 1px solid #1a2e20;
          }
          .app-panel-right { flex: 1; }
        }
      `}</style>
    </div>
  )
}


function Splash() {
  return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a1409' }}>
      <div style={{ fontSize: 48, animation: 'sp 1.2s ease-in-out infinite' }}>💬</div>
      <style>{`@keyframes sp{0%,100%{opacity:.3;transform:scale(.9)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}

function DesktopEmpty() {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: '#4a6358', gap: 20, textAlign: 'center', padding: '0 40px',
    }}>
      <div style={{
        width: 96, height: 96, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,230,118,0.08) 0%, transparent 70%)',
        border: '1.5px solid rgba(0,230,118,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
      }}>💬</div>
      <div>
        <p style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#c8ddd0', letterSpacing: '-0.5px' }}>
          Mi Mensajero
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#4a6358', lineHeight: 1.7 }}>
          Seleccioná una conversación<br />o buscá un usuario para chatear
        </p>
      </div>
      <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
        {['🔒 Cifrado', '⚡ Tiempo real', '📞 Llamadas'].map(f => (
          <span key={f} style={{ fontSize: 11, color: '#2a4035', background: '#0e1a14', padding: '5px 10px', borderRadius: 20, border: '1px solid #1a2e20' }}>{f}</span>
        ))}
      </div>
    </div>
  )
}
