import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import { useCallStore } from './store/callStore'
import { useChatStore } from './store/chatStore'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import LoginPage from './pages/LoginPage'
import ChatListPage from './pages/ChatListPage'
import ChatPage from './pages/ChatPage'
import CallPage from './pages/CallPage'
import LlamadasPage from './pages/LlamadasPage'
import ContactsListPage from './pages/ContactsListPage'
import NotificationsPage from './pages/NotificationsPage'
import TournamentsPage from './pages/TournamentsPage'
import DiscoverPage from './pages/DiscoverPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import AdminPage from './pages/AdminPage'
import InviteJoinPage from './pages/InviteJoinPage'
import ProfileSheet from './components/ProfileSheet'
import UpdateBanner from './components/UpdateBanner'
import { usePresence } from './hooks/usePresence'
import { initPushNotifications, initWebPush, listenNotificationClicks } from './lib/pushNotifications'
import { acquireWakeLock, releaseWakeLock } from './lib/appStartup'
export { C } from './theme'
import { C } from './theme'

// ── Nav icons ─────────────────────────────────────────────────────────────────
const NAV = [
  {
    id: 'chats', label: 'Chats',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id: 'contactos', label: 'Contactos',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    id: 'explorar', label: 'Explorar',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
      </svg>
    ),
  },
  {
    id: 'torneos', label: 'Torneos',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
        <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
      </svg>
    ),
  },
  {
    id: 'grupos', label: 'Grupos',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id: 'anuncios', label: 'Anuncios',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
  },
  {
    id: 'admin', label: 'Admin',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    id: 'ajustes', label: 'Ajustes',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
]

export default function App() {
  const { user, profile, loading, setUser, setLoading, fetchProfile } = useAuthStore()
  const { incomingCall, setIncomingCall, clearCall } = useCallStore()
  const { conversations, activeConversation, setActiveConversation, fetchConversations, subscribeToConversations } = useChatStore()
  const [tab, setTab] = useState('chats')
  const [showProfile, setShowProfile] = useState(false)
  const [inviteToken, setInviteToken] = useState(() => {
    const m = window.location.pathname.match(/^\/join\/([^/]+)/)
    return m ? m[1] : null
  })
  usePresence(user?.id)

  // Fix keyboard overlap — shrink root height when keyboard opens (iOS + Android)
  useEffect(() => {
    const root = document.getElementById('root')
    const vv = window.visualViewport
    if (!vv || !root) return
    const update = () => {
      root.style.height = `${vv.height}px`
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`)
    }
    update()
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    if (!profile?.id) return
    fetchConversations(profile.id)
    const unsub = subscribeToConversations(profile.id)
    return unsub
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id) return
    let ch, retryTimer

    function connectCallChannel() {
      if (ch) supabase.removeChannel(ch)
      ch = supabase.channel(`user-calls:${profile.id}`, {
        config: { broadcast: { ack: false } },
      })
        .on('broadcast', { event: 'call-offer' }, ({ payload }) => setIncomingCall(payload))
        .subscribe((status) => {
          // Auto-reconnect if channel drops (mobile network switches, sleep, etc.)
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            clearTimeout(retryTimer)
            retryTimer = setTimeout(connectCallChannel, 3000)
          }
        })
    }

    connectCallChannel()

    // Also reconnect when tab becomes visible again (tab switch, screen wake)
    const onVisible = () => {
      if (document.visibilityState === 'visible') connectCallChannel()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(retryTimer)
      document.removeEventListener('visibilitychange', onVisible)
      if (ch) supabase.removeChannel(ch)
    }
  }, [profile?.id])

  // Init push notifications: native FCM (APK) + Web Push (PWA)
  useEffect(() => {
    if (!profile?.id) return
    initPushNotifications(profile.id, (callPayload) => setIncomingCall(callPayload))
    initWebPush(profile.id)
    const unlisten = listenNotificationClicks(({ data }) => {
      if (data?.type === 'call') setIncomingCall(data)
    })
    return unlisten
  }, [profile?.id])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) await fetchProfile(session.user.id)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Handle Android hardware back button — must be before any conditional returns
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const listener = CapApp.addListener('backButton', () => {
      if (activeConversation) {
        setActiveConversation(null)
      } else if (showProfile) {
        setShowProfile(false)
      } else if (tab !== 'chats') {
        setTab('chats')
      }
    })
    return () => { listener.then(h => h.remove()) }
  }, [activeConversation, showProfile, tab])

  if (loading) return <Splash />
  if (!user) return <LoginPage />
  if (!profile) return <Splash />

  // Invite link handler — show join page before normal app
  if (inviteToken) {
    return <InviteJoinPage token={inviteToken} onBack={() => {
      setInviteToken(null)
      window.history.replaceState(null, '', '/')
    }} />
  }

  const needsSetup = !profile.display_name || profile.display_name === 'Usuario'
    || profile.display_name.startsWith('user_') || !profile.username || profile.username.startsWith('user_')
  if (needsSetup) return <ProfileSheet onClose={() => fetchProfile(user.id)} forceSetup />

  function goBack() {
    setActiveConversation(null)
    fetchConversations(profile.id)
  }

  const showChat = !!activeConversation
  const totalUnread = conversations.reduce((s, c) => s + (c.unread || 0), 0)

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <UpdateBanner />

      {incomingCall && (
        <CallPage
          conversationId={incomingCall.convId}
          myUserId={profile.id}
          myUserName={profile.display_name || ''}
          contact={{ id: incomingCall.from, display_name: incomingCall.fromName || 'Usuario' }}
          callType={incomingCall.callType}
          isIncoming={true}
          incomingOffer={incomingCall.offer}
          onEnd={() => { clearCall(); releaseWakeLock() }}
          onAccept={acquireWakeLock}
        />
      )}

      {/* Shell */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* DESKTOP sidebar nav */}
        <nav className="slfa-side-nav">
          {NAV.filter(({ id }) => id !== 'admin' || ['ceo','admin'].includes(profile?.role)).map(({ id, label, icon }) => {
            const active = (id === 'ajustes' ? showProfile : !showProfile && tab === id)
            return (
              <button key={id} onClick={() => id === 'ajustes' ? setShowProfile(true) : (setShowProfile(false), setTab(id))} style={{
                width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 4, border: 'none',
                background: active ? `${C.green}12` : 'none',
                cursor: 'pointer', padding: '14px 0', position: 'relative',
                borderLeft: `3px solid ${active ? C.green : 'transparent'}`,
                transition: 'background .15s',
              }}>
                {id === 'chats' && totalUnread > 0 && (
                  <span style={{
                    position: 'absolute', top: 10, right: '12%',
                    minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
                    background: C.green, color: C.bg, fontSize: 9, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{totalUnread > 99 ? '99+' : totalUnread}</span>
                )}
                {icon(active)}
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? C.green : C.textDim }}>{label}</span>
              </button>
            )
          })}
        </nav>

        {/* LEFT — list or profile */}
        <div className={`slfa-left${showChat ? ' slfa-left--hidden' : ''}`}>
          {showProfile
            ? <ProfileSheet onClose={() => setShowProfile(false)} />
            : tab === 'contactos'
            ? <ContactsListPage />
            : tab === 'grupos'
            ? <ChatListPage onProfileClick={() => setShowProfile(true)} initialFilter="grupos" />
            : tab === 'explorar'
            ? <DiscoverPage />
            : tab === 'torneos'
            ? <TournamentsPage />
            : tab === 'anuncios'
            ? <AnnouncementsPage />
            : tab === 'admin'
            ? <AdminPage onBack={() => setTab('chats')} />
            : <ChatListPage onProfileClick={() => setShowProfile(true)} />
          }
        </div>

        {/* RIGHT — chat */}
        <div className={`slfa-right${showChat ? ' slfa-right--visible' : ''}`}>
          {activeConversation
            ? <ChatPage onBack={goBack} />
            : <EmptyState />}
        </div>
      </div>

      {/* Bottom nav — mobile only, hidden when chat open */}
      {!showChat && (
        <nav style={{
          display: 'flex', height: 60, background: C.panel,
          borderTop: `1px solid ${C.border}`, flexShrink: 0,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }} className="slfa-bottom-nav">
          {NAV.filter(({ id }) => id !== 'admin' || ['ceo','admin'].includes(profile?.role)).map(({ id, label, icon }) => {
            const active = (id === 'ajustes' ? showProfile : !showProfile && tab === id)
            return (
              <button key={id} onClick={() => id === 'ajustes' ? setShowProfile(true) : (setShowProfile(false), setTab(id))} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 4, border: 'none', background: 'none',
                cursor: 'pointer', position: 'relative', transition: 'opacity .15s',
              }}>
                {id === 'chats' && totalUnread > 0 && (
                  <span style={{
                    position: 'absolute', top: 8, right: '22%',
                    minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
                    background: C.green, color: C.bg, fontSize: 9, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 8px ${C.green}66`,
                  }}>{totalUnread > 99 ? '99+' : totalUnread}</span>
                )}
                {icon(active)}
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? C.green : C.textDim, letterSpacing: '.3px' }}>
                  {label}
                </span>
                {active && (
                  <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 2, background: C.green, borderRadius: '0 0 2px 2px', boxShadow: `0 0 8px ${C.green}88` }} />
                )}
              </button>
            )
          })}
        </nav>
      )}

      <style>{`
        /* Mobile: full-screen sliding panels */
        .slfa-side-nav { display: none; }
        .slfa-left, .slfa-right {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          transition: transform .28s cubic-bezier(.4,0,.2,1);
          overflow: hidden;
          background: var(--c-bg);
          display: flex;
          flex-direction: column;
        }
        .slfa-left               { transform: translateX(0); z-index: 1; }
        .slfa-left--hidden       { transform: translateX(-100%); }
        .slfa-right              { transform: translateX(100%); z-index: 2; }
        .slfa-right--visible     { transform: translateX(0); }

        /* Desktop ≥ 768px: sidebar layout */
        @media (min-width: 768px) {
          .slfa-bottom-nav { display: none !important; }
          .slfa-side-nav {
            display: flex; flex-direction: column;
            width: 68px; flex-shrink: 0;
            background: var(--c-panel); border-right: 1px solid var(--c-border);
          }
          .slfa-left, .slfa-right {
            position: relative !important;
            transform: none !important;
            top: auto !important; left: auto !important;
            right: auto !important; bottom: auto !important;
          }
          .slfa-left  { width: 420px !important; flex-shrink: 0; border-right: 1px solid ${C.border}; }
          .slfa-right { flex: 1 !important; min-width: 0; }
        }
        @media (min-width: 1200px) {
          .slfa-left  { width: 520px !important; }
        }
        @media (min-width: 1600px) {
          .slfa-left  { width: 600px !important; }
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }

        /* Animations */
        @keyframes msgIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .msg-in { animation: msgIn .18s ease-out both; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* Skeleton pulse */
        @keyframes skelPulse { 0%,100%{opacity:.4} 50%{opacity:.9} }
        .skeleton { animation: skelPulse 1.4s ease-in-out infinite; background: ${C.panel2}; border-radius: 8px; }

        /* Focus ring */
        input:focus, textarea:focus { outline: none; border-color: ${C.green} !important; box-shadow: 0 0 0 2px ${C.green}22 !important; }

        /* Base resets */
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        img { max-width: 100%; }
        button { touch-action: manipulation; }
      `}</style>
    </div>
  )
}

function Splash() {
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.bg, gap: 16 }}>
      <div style={{ fontSize: 52, animation: 'sp 1.4s ease-in-out infinite' }}>⚡</div>
      <div style={{ width: 120, height: 3, borderRadius: 3, background: C.panel2, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent, ${C.green}, transparent)`, animation: 'load 1.2s ease-in-out infinite' }} />
      </div>
      <style>{`
        @keyframes sp{0%,100%{opacity:.4;transform:scale(.9)}50%{opacity:1;transform:scale(1)}}
        @keyframes load{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
      `}</style>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 20, padding: '0 40px', textAlign: 'center',
      background: `radial-gradient(ellipse at 50% 60%, ${C.greenDk}18 0%, transparent 65%)`,
    }}>
      <div style={{
        width: 96, height: 96, borderRadius: 24,
        background: `linear-gradient(145deg, ${C.greenDk}cc 0%, #071a0c 100%)`,
        border: `1.5px solid ${C.green}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 48px ${C.green}22, inset 0 1px 0 ${C.green}30`,
      }}>
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="none">
          <defs>
            <linearGradient id="boltGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={C.green}/>
              <stop offset="100%" stopColor={C.green2}/>
            </linearGradient>
          </defs>
          <path d="M13 2L4.5 13.5H11L10 22L20.5 10H14L13 2Z" fill="url(#boltGrad)"/>
        </svg>
      </div>
      <div>
        <p style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: '-0.5px' }}>
          Mi Mensajero
        </p>
        <p style={{ margin: '0 0 4px', fontSize: 12, color: C.textDim, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
          Competí · Conectá · Ganá
        </p>
        <p style={{ margin: '12px 0 0', fontSize: 13, color: C.textDim, lineHeight: 1.6 }}>
          Seleccioná una conversación
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
        {['🔒 Cifrado', '⚡ Tiempo real', '📞 Llamadas', '🎤 Audios'].map(f => (
          <span key={f} style={{
            fontSize: 11, color: C.textDim, background: C.panel,
            padding: '5px 12px', borderRadius: 20, border: `1px solid ${C.border}`,
          }}>{f}</span>
        ))}
      </div>
    </div>
  )
}
