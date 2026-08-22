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
import TorneosPage from './pages/TorneosPage'
import DiscoverPage from './pages/DiscoverPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import AdminPage from './pages/AdminPage'
import InviteJoinPage from './pages/InviteJoinPage'
import HomePage from './pages/HomePage'
import RankingPage from './pages/RankingPage'
import PerfilPage from './pages/PerfilPage'
import ProfileSheet from './components/ProfileSheet'
import CEOPanel from './components/CEOPanel'
import UpdateBanner from './components/UpdateBanner'
import { usePresence } from './hooks/usePresence'
import { initPushNotifications, initWebPush, listenNotificationClicks } from './lib/pushNotifications'
import { acquireWakeLock, releaseWakeLock } from './lib/appStartup'
export { C } from './theme'
import { C } from './theme'

// ── Nav icons ─────────────────────────────────────────────────────────────────
const NAV = [
  {
    id: 'inicio', label: 'Inicio',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
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
    id: 'torneos', label: 'Comunidad PRO',
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
    id: 'ranking', label: 'Ranking',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    id: 'perfil', label: 'Perfil',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
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

// ── CEO Panel Picker — selects a community then opens CEOPanel ─────────────────
function CEOPanelPicker({ onBack }) {
  const { profile } = useAuthStore()
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: owned } = await supabase
        .from('conversations')
        .select('id, name, description, avatar_url')
        .eq('group_type', 'community')
        .eq('created_by', profile.id)
      const { data: roles } = await supabase
        .from('group_roles')
        .select('conversation_id')
        .eq('user_id', profile.id)
        .in('role', ['owner', 'admin'])
      const extraIds = (roles || []).map(r => r.conversation_id).filter(id => !(owned || []).find(o => o.id === id))
      let extra = []
      if (extraIds.length) {
        const { data } = await supabase.from('conversations').select('id, name, description, avatar_url').in('id', extraIds)
        extra = data || []
      }
      setCommunities([...(owned || []), ...extra])
      setLoading(false)
    }
    load()
  }, [profile?.id])

  if (selected) return <CEOPanel community={{ ...selected, myRole: 'admin' }} onBack={() => setSelected(null)} />

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>⭐ Panel CEO</div>
          <div style={{ color: C.textDim, fontSize: 11 }}>Seleccioná una comunidad</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          </div>
        ) : communities.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60, color: C.textDim }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🌐</div>
            <div>No tenés comunidades administradas</div>
          </div>
        ) : communities.map(c => (
          <button key={c.id} onClick={() => setSelected(c)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px', background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: 12, marginBottom: 10, cursor: 'pointer', textAlign: 'left',
          }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.border, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              {c.avatar_url ? <img src={c.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : '🌐'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{c.name}</div>
              {c.description && <div style={{ color: C.textDim, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</div>}
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const { user, profile, loading, setUser, setLoading, fetchProfile } = useAuthStore()
  const { incomingCall, setIncomingCall, clearCall, inCall, setInCall } = useCallStore()
  const { conversations, activeConversation, setActiveConversation, fetchConversations, subscribeToConversations } = useChatStore()
  const [tab, setTab] = useState('chats')
  const [showProfile, setShowProfile] = useState(false)
  const [showMoreDrawer, setShowMoreDrawer] = useState(false)
  const [inviteToken, setInviteToken] = useState(() => {
    const m = window.location.pathname.match(/^\/join\/([^/]+)/)
    if (m) { localStorage.setItem('mm_pending_invite', m[1]); return m[1] }
    return localStorage.getItem('mm_pending_invite') || null
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

    const callChannels = []
    function connectCallChannel() {
      callChannels.forEach(c => supabase.removeChannel(c))
      callChannels.length = 0
      // Listen on all 3 channel names (caller retries with -0, -1, -2 suffix)
      for (let i = 0; i < 3; i++) {
        const name = i === 0 ? `user-calls:${profile.id}` : `user-calls:${profile.id}-${i - 1}`
        const c = supabase.channel(name, { config: { broadcast: { ack: false } } })
          .on('broadcast', { event: 'call-offer' }, ({ payload }) => {
            // If already in a call, send busy on the session channel so the caller hears it
            if (inCall) {
              const busyCh = supabase.channel(`call-session:${payload.convId}`, { config: { broadcast: { ack: false } } })
              busyCh.subscribe(s => {
                if (s === 'SUBSCRIBED') {
                  busyCh.send({ type: 'broadcast', event: 'call-busy', payload: { from: profile.id } })
                    .finally(() => setTimeout(() => supabase.removeChannel(busyCh), 1000))
                }
              })
              return
            }
            setIncomingCall(payload)
          })
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              clearTimeout(retryTimer)
              retryTimer = setTimeout(connectCallChannel, 3000)
            }
          })
        callChannels.push(c)
      }
      ch = callChannels[0]
    }

    connectCallChannel()

    // Reconnect when tab becomes visible after a long background period
    const onVisible = () => {
      if (document.visibilityState === 'visible') connectCallChannel()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(retryTimer)
      document.removeEventListener('visibilitychange', onVisible)
      callChannels.forEach(c => supabase.removeChannel(c))
    }
  }, [profile?.id])

  // Show browser notification when incoming call arrives while tab is hidden/minimized
  useEffect(() => {
    if (!incomingCall) return
    if (document.visibilityState === 'visible') return // app is visible — UI handles it
    if (Notification.permission !== 'granted') return

    const notif = new Notification(`📞 Llamada entrante de ${incomingCall.fromName || 'Usuario'}`, {
      body: incomingCall.callType === 'video' ? '📹 Videollamada' : '🎙️ Llamada de voz',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'incoming-call',
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200, 100, 200],
      silent: false,
    })

    const onNotifClick = () => {
      window.focus()
      notif.close()
    }
    notif.addEventListener('click', onNotifClick)

    return () => {
      notif.removeEventListener('click', onNotifClick)
      notif.close()
    }
  }, [incomingCall])

  // Request notification permission and init push
  useEffect(() => {
    if (!profile?.id) return
    // Request permission proactively (browser will only show dialog once)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    initPushNotifications(profile.id, (callPayload) => setIncomingCall(callPayload))
    initWebPush(profile.id)
    const unlisten = listenNotificationClicks(({ action, data }) => {
      if (data?.type === 'call') {
        setIncomingCall(data)
        window.focus()
      }
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

  // Open VipPage (ProfileSheet) from anywhere via custom event
  useEffect(() => {
    const handler = () => setShowProfile(true)
    window.addEventListener('open-vip-page', handler)
    return () => window.removeEventListener('open-vip-page', handler)
  }, [])

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
          onEnd={() => { clearCall(); setInCall(false); releaseWakeLock() }}
          onAccept={() => { setInCall(true); acquireWakeLock() }}
        />
      )}

      {/* Shell */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* DESKTOP sidebar nav */}
        <nav className="slfa-side-nav">
          {NAV.filter(({ id }) => {
            if (id === 'admin') return ['ceo','admin'].includes(profile?.role)
            return true
          }).map(({ id, label, icon }) => {
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
          {/* CEO Panel — sidebar only, ceo/admin */}
          {['ceo','admin'].includes(profile?.role) && (
            <button onClick={() => { setShowProfile(false); setTab('panel-ceo') }} style={{
              width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 4, border: 'none', marginTop: 'auto',
              background: tab === 'panel-ceo' ? `${C.green}12` : 'none',
              cursor: 'pointer', padding: '14px 0',
              borderLeft: `3px solid ${tab === 'panel-ceo' ? C.green : 'transparent'}`,
              transition: 'background .15s',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={tab === 'panel-ceo' ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span style={{ fontSize: 10, fontWeight: tab === 'panel-ceo' ? 700 : 400, color: tab === 'panel-ceo' ? C.green : C.textDim }}>CEO</span>
            </button>
          )}
        </nav>

        {/* LEFT — list or profile */}
        <div className={`slfa-left${showChat ? ' slfa-left--hidden' : ''}`}>
          {showProfile
            ? <ProfileSheet onClose={() => setShowProfile(false)} />
            : tab === 'inicio'
            ? <HomePage onGoTorneos={() => setTab('torneos')} onGoRanking={() => setTab('ranking')} onGoExplorar={() => setTab('explorar')} onGoAnuncios={() => setTab('anuncios')} />
            : tab === 'ranking'
            ? <RankingPage />
            : tab === 'perfil'
            ? <PerfilPage onClose={() => setTab('chats')} />
            : tab === 'contactos'
            ? <ContactsListPage />
            : tab === 'grupos'
            ? <ChatListPage onProfileClick={() => setShowProfile(true)} initialFilter="grupos" />
            : tab === 'explorar'
            ? <DiscoverPage />
            : tab === 'torneos'
            ? <TorneosPage />
            : tab === 'anuncios'
            ? <AnnouncementsPage />
            : tab === 'admin'
            ? <AdminPage onBack={() => setTab('chats')} />
            : tab === 'panel-ceo' && ['ceo','admin'].includes(profile?.role)
            ? <CEOPanelPicker onBack={() => setTab('chats')} />
            : tab === 'panel-ceo'
            ? (setTab('inicio'), null)
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

      {/* "Más" drawer — mobile */}
      {showMoreDrawer && (
        <div
          onClick={() => setShowMoreDrawer(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 60, left: 0, right: 0,
              background: C.panel, borderTop: `1px solid ${C.border}`,
              borderRadius: '20px 20px 0 0',
              padding: '12px 0 8px',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
              animation: 'drawerUp .22s cubic-bezier(.4,0,.2,1)',
            }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 16px' }} />

            {[
              { id: 'contactos',  icon: '👥', label: 'Contactos' },
              { id: 'explorar',   icon: '🔭', label: 'Explorar' },
              { id: 'anuncios',   icon: '📢', label: 'Anuncios' },
              ...(['ceo','admin'].includes(profile?.role) ? [
                { id: 'panel-ceo', icon: '⭐', label: 'Panel CEO' },
                { id: 'admin',     icon: '🛡️', label: 'Admin' },
              ] : []),
              { id: 'ajustes',    icon: '⚙️', label: 'Ajustes' },
            ].map(({ id, icon, label }) => (
              <button key={id} onClick={() => {
                setShowMoreDrawer(false)
                if (id === 'ajustes') { setShowProfile(true) }
                else { setShowProfile(false); setTab(id) }
              }} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 24px', border: 'none', background: 'none',
                cursor: 'pointer', textAlign: 'left',
                borderLeft: `3px solid ${(tab === id && !showProfile) || (id === 'ajustes' && showProfile) ? C.green : 'transparent'}`,
              }}>
                <span style={{ fontSize: 22, width: 28, textAlign: 'center' }}>{icon}</span>
                <span style={{
                  color: (tab === id && !showProfile) || (id === 'ajustes' && showProfile) ? C.green : C.text,
                  fontWeight: 600, fontSize: 15,
                }}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom nav — mobile only, hidden when chat open */}
      {!showChat && (
        <nav style={{
          display: 'flex', height: 60, background: C.panel,
          borderTop: `1px solid ${C.border}`, flexShrink: 0,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }} className="slfa-bottom-nav">
          {/* 5 fixed tabs */}
          {[
            { id: 'inicio',  label: 'Inicio' },
            { id: 'chats',   label: 'Chats' },
            { id: 'torneos', label: 'Torneos' },
            { id: 'ranking', label: 'Ranking' },
            { id: 'perfil',  label: 'Perfil' },
          ].map(({ id, label }) => {
            const navItem = NAV.find(n => n.id === id)
            if (!navItem) return null
            const active = !showProfile && tab === id && !showMoreDrawer
            return (
              <button key={id} onClick={() => { setShowProfile(false); setShowMoreDrawer(false); setTab(id) }} style={{
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
                {navItem.icon(active)}
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? C.green : C.textDim, letterSpacing: '.3px' }}>
                  {label}
                </span>
                {active && (
                  <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 2, background: C.green, borderRadius: '0 0 2px 2px', boxShadow: `0 0 8px ${C.green}88` }} />
                )}
              </button>
            )
          })}
          {/* Más button */}
          <button onClick={() => setShowMoreDrawer(d => !d)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 4, border: 'none', background: 'none',
            cursor: 'pointer', position: 'relative',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={showMoreDrawer ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="1" fill={showMoreDrawer ? C.green : C.textDim}/>
              <circle cx="12" cy="12" r="1" fill={showMoreDrawer ? C.green : C.textDim}/>
              <circle cx="12" cy="19" r="1" fill={showMoreDrawer ? C.green : C.textDim}/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: showMoreDrawer ? 700 : 400, color: showMoreDrawer ? C.green : C.textDim }}>Más</span>
            {showMoreDrawer && (
              <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 2, background: C.green, borderRadius: '0 0 2px 2px' }} />
            )}
          </button>
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
        @keyframes drawerUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
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
