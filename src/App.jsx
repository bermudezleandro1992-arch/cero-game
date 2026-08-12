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

// ── Icons ────────────────────────────────────────────────────────────────────
function IconChat({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#00e676' : '#5f7a6a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}
function IconUsers({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#00e676' : '#5f7a6a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function IconProfile({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#00e676' : '#5f7a6a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

// ── BottomNav ─────────────────────────────────────────────────────────────────
function BottomNav({ tab, setTab, totalUnread }) {
  const tabs = [
    { id: 'chats',    label: 'Chats',     Icon: IconChat },
    { id: 'comunidad',label: 'Comunidad', Icon: IconUsers },
    { id: 'perfil',   label: 'Perfil',    Icon: IconProfile },
  ]
  return (
    <nav style={{
      display: 'flex', height: 58, background: '#0e1a14',
      borderTop: '1px solid #1c2e23', flexShrink: 0,
    }}>
      {tabs.map(({ id, label, Icon }) => {
        const active = tab === id
        return (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 3, border: 'none', background: 'none',
            cursor: 'pointer', position: 'relative',
          }}>
            {id === 'chats' && totalUnread > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: '28%',
                minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
                background: '#00e676', color: '#0a1409', fontSize: 10, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{totalUnread > 99 ? '99+' : totalUnread}</span>
            )}
            <Icon active={active} />
            <span style={{
              fontSize: 10, fontWeight: active ? 700 : 500,
              color: active ? '#00e676' : '#5f7a6a',
            }}>{label}</span>
            {active && (
              <div style={{
                position: 'absolute', bottom: 0, left: '25%', right: '25%',
                height: 2, borderRadius: 2, background: '#00e676',
              }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}

// ── ComunidadPage placeholder ─────────────────────────────────────────────────
function ComunidadPage() {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', color: '#5f7a6a', gap: 12, padding: '0 32px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 52 }}>🏆</div>
      <p style={{ margin: 0, fontSize: 16, color: '#c8ddd0', fontWeight: 600 }}>Comunidad</p>
      <p style={{ margin: 0, fontSize: 13 }}>Torneos, resultados y anuncios próximamente</p>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { user, profile, loading, setUser, setLoading, fetchProfile } = useAuthStore()
  const { incomingCall, setIncomingCall, clearCall } = useCallStore()
  const { conversations, activeConversation, setActiveConversation, fetchConversations, subscribeToConversations } = useChatStore()
  const [tab, setTab] = useState('chats')
  usePresence(user?.id)

  // Single subscription for conversation list (avoids duplicate channels from dual layout)
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
      .on('broadcast', { event: 'call-offer' }, ({ payload }) => {
        setIncomingCall(payload)
      })
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

  const needsProfileSetup = !profile.display_name
    || profile.display_name === 'Usuario'
    || profile.display_name.startsWith('user_')
    || !profile.username
    || profile.username.startsWith('user_')

  if (needsProfileSetup) {
    return <ProfileSheet onClose={() => fetchProfile(user.id)} forceSetup />
  }

  function goBack() {
    setActiveConversation(null)
    fetchConversations(profile.id)
  }

  const totalUnread = conversations.reduce((s, c) => s + (c.unread || 0), 0)

  // Desktop: >= 768px → sidebar layout
  // Mobile: one panel at a time with bottom nav
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0a1409', overflow: 'hidden' }}>
      <UpdateBanner />

      {/* Incoming call overlay */}
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

      {/* ── DESKTOP LAYOUT (≥768px) ── */}
      <div className="desktop-layout" style={{ flex: 1, overflow: 'hidden' }}>

        {/* Sidebar list */}
        <div className="sidebar-panel">
          <ChatListPage desktopMode />
        </div>

        {/* Main content panel */}
        <div className="main-panel">
          {activeConversation
            ? <ChatPage onBack={goBack} hideBackButton />
            : <DesktopEmpty />}
        </div>
      </div>

      {/* ── MOBILE LAYOUT (<768px) ── */}
      <div className="mobile-layout" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {tab === 'chats' && (
            activeConversation
              ? <ChatPage onBack={goBack} />
              : <ChatListPage />
          )}
          {tab === 'comunidad' && <ComunidadPage />}
          {tab === 'perfil' && <ProfileSheet onClose={() => setTab('chats')} />}
        </div>
        {!activeConversation && (
          <BottomNav tab={tab} setTab={setTab} totalUnread={totalUnread} />
        )}
      </div>

      <style>{`
        .desktop-layout { display: none !important; }
        .mobile-layout  { display: flex !important; }
        @media (min-width: 768px) {
          .desktop-layout { display: flex !important; }
          .mobile-layout  { display: none !important; }
        }
        .sidebar-panel {
          width: 360px; flex-shrink: 0;
          border-right: 1px solid #1c2e23;
          height: 100%; overflow: hidden;
        }
        .main-panel {
          flex: 1; height: 100%; overflow: hidden;
        }
      `}</style>
    </div>
  )
}

function Splash() {
  return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a1409' }}>
      <div style={{ fontSize: 48, animation: 'pulse 1.2s ease-in-out infinite' }}>💬</div>
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
    </div>
  )
}

function DesktopEmpty() {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0a1409', color: '#5f7a6a', gap: 16, textAlign: 'center', padding: '0 40px',
    }}>
      <div style={{
        width: 100, height: 100, borderRadius: '50%',
        background: 'rgba(0,230,118,0.06)', border: '2px solid rgba(0,230,118,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44,
      }}>💬</div>
      <div>
        <p style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#c8ddd0' }}>Mi Mensajero</p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
          Seleccioná una conversación para empezar<br />o buscá un usuario para chatear
        </p>
      </div>
    </div>
  )
}
