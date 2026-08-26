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
import CommunidadesPage from './pages/CommunidadesPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import AdminPage from './pages/AdminPage'
import AdminGate from './components/AdminGate'
import InviteJoinPage from './pages/InviteJoinPage'
import HomePage from './pages/HomePage'
import RankingPage from './pages/RankingPage'
import PerfilPage from './pages/PerfilPage'
import ProfileSheet from './components/ProfileSheet'
import CEOPanel from './components/CEOPanel'
import OrganizadorPanel from './components/OrganizadorPanel'
import UpdateBanner from './components/UpdateBanner'
import CommunityDashboard from './components/CommunityDashboard'
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
    id: 'comunidades', label: 'Comunidades',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
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
]

// ── CEO Panel Picker — selects a community then opens CEOPanel ─────────────────
function CEOPanelPicker({ onBack }) {
  const { profile } = useAuthStore()
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: owned } = await supabase
        .from('conversations')
        .select('id, name, description, avatar_url')
        .eq('group_type', 'community')
        .eq('created_by', profile.id)
      setCommunities(owned || [])
      setLoading(false)
    }
    load()
  }, [profile?.id, reloadKey])

  if (selected) return (
    <CEOPanel
      community={{ ...selected, myRole: 'admin' }}
      onBack={() => setSelected(null)}
      onCommunityDeleted={() => { setSelected(null); setReloadKey(k => k + 1) }}
    />
  )

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

// ── Organizador Panel Picker ──────────────────────────────────────────────────
function OrganizadorPanelPicker({ onBack }) {
  const { profile } = useAuthStore()
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: roles } = await supabase
        .from('group_roles')
        .select('group_id, conversations!group_roles_group_id_fkey(id, name, description, avatar_url)')
        .eq('user_id', profile.id)
        .in('role', ['organizador', 'admin', 'owner'])
      setCommunities((roles || []).map(r => r.conversations).filter(Boolean))
      setLoading(false)
    }
    load()
  }, [profile?.id])

  if (selected) return <OrganizadorPanel community={selected} onBack={() => setSelected(null)} />

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>🎯 Panel Organizador</div>
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
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
            <div>No tenés comunidades como organizador</div>
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

  // Open VipPage directly from anywhere via custom event
  const [openVipDirect, setOpenVipDirect] = useState(false)
  useEffect(() => {
    const handler = () => { setShowProfile(true); setOpenVipDirect(true) }
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
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden', fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
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
          {NAV.map(({ id, label, icon }) => {
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
          {/* Panel Organizador */}
          <button onClick={() => { setShowProfile(false); setTab('panel-organizador') }} style={{
            width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 4, border: 'none', marginTop: 'auto',
            background: tab === 'panel-organizador' ? `${C.green}12` : 'none',
            cursor: 'pointer', padding: '14px 0',
            borderLeft: `3px solid ${tab === 'panel-organizador' ? C.green : 'transparent'}`,
            transition: 'background .15s',
          }}>
            <span style={{ fontSize: 18 }}>🎯</span>
            <span style={{ fontSize: 9, fontWeight: tab === 'panel-organizador' ? 700 : 400, color: tab === 'panel-organizador' ? C.green : C.textDim }}>Organiz.</span>
          </button>

          {/* CEO Panel — visible para cualquier usuario con comunidades */}
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

          {/* Admin Panel — solo superadmin/admin */}
          {['superadmin','admin'].includes(profile?.role) && (
            <button onClick={() => { setShowProfile(false); setTab('admin') }} style={{
              width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 4, border: 'none',
              background: tab === 'admin' ? '#ef444412' : 'none',
              cursor: 'pointer', padding: '14px 0',
              borderLeft: `3px solid ${tab === 'admin' ? '#ef4444' : 'transparent'}`,
              transition: 'background .15s',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={tab === 'admin' ? '#ef4444' : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span style={{ fontSize: 10, fontWeight: tab === 'admin' ? 700 : 400, color: tab === 'admin' ? '#ef4444' : C.textDim }}>Admin</span>
            </button>
          )}
        </nav>

        {/* LEFT — list or profile */}
        <div className={`slfa-left${showChat ? ' slfa-left--hidden' : ''}`}>
          {showProfile
            ? <ProfileSheet onClose={() => { setShowProfile(false); setOpenVipDirect(false) }} />
            : tab === 'inicio'
            ? <HomePage onGoTorneos={() => setTab('comunidades')} onGoRanking={() => setTab('ranking')} onGoExplorar={() => setTab('explorar')} onGoAnuncios={() => setTab('anuncios')} onGoCuenta={() => setTab('perfil')} onGoPanelCeo={() => setTab('panel-ceo')} />
            : tab === 'ranking'
            ? <RankingPage />
            : tab === 'perfil'
            ? <PerfilPage onClose={() => setTab('chats')} />
            : tab === 'contactos'
            ? <ContactsListPage />
            : tab === 'grupos'
            ? <ChatListPage onProfileClick={() => { setShowProfile(false); setTab('perfil') }} initialFilter="grupos" />
            : tab === 'explorar'
            ? <DiscoverPage />
            : tab === 'comunidades'
            ? <CommunidadesPage />
            : tab === 'torneos'
            ? <DiscoverPage />
            : tab === 'anuncios'
            ? <AnnouncementsPage />
            : tab === 'admin'
            ? <AdminGate profile={profile}><AdminPage onBack={() => setTab('chats')} /></AdminGate>
            : tab === 'panel-organizador'
            ? <OrganizadorPanelPicker onBack={() => setTab('chats')} />
            : tab === 'panel-ceo'
            ? <CEOPanelPicker onBack={() => setTab('chats')} />
            : <ChatListPage onProfileClick={() => { setShowProfile(false); setTab('perfil') }} />
          }
        </div>

        {/* RIGHT — chat or community dashboard */}
        <div className={`slfa-right${showChat ? ' slfa-right--visible' : ''}`}>
          {activeConversation
            ? activeConversation.isCommunity && activeConversation.group_type === 'community'
              ? <CommunityDashboard community={activeConversation} onBack={goBack} />
              : <ChatPage onBack={goBack} />
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
              ...(['superadmin','admin'].includes(profile?.role) ? [
                { id: 'panel-ceo', icon: '⭐', label: 'Panel CEO' },
              ] : []),
              { id: 'panel-organizador', icon: '🎯', label: 'Panel Organizador' },
            ].map(({ id, icon, label }) => (
              <button key={id} onClick={() => {
                setShowMoreDrawer(false)
                setShowProfile(false); setTab(id)
              }} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 24px', border: 'none', background: 'none',
                cursor: 'pointer', textAlign: 'left',
                borderLeft: `3px solid ${tab === id && !showProfile ? C.green : 'transparent'}`,
              }}>
                <span style={{ fontSize: 22, width: 28, textAlign: 'center' }}>{icon}</span>
                <span style={{
                  color: tab === id && !showProfile ? C.green : C.text,
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
            { id: 'comunidades', label: 'Comunidades' },
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
      <img src="/logo.svg" alt="NexoTribu" width="72" height="72" style={{ animation: 'sp 1.4s ease-in-out infinite' }} />
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
  const steps = [
    { icon: '🌐', title: 'Creá tu comunidad', desc: 'Armá el espacio de tu tribu con canales, anuncios y configuración propia.' },
    { icon: '👥', title: 'Sumá a tu gente', desc: 'Compartí el link de invitación y reuní a todos en un solo lugar.' },
    { icon: '🏆', title: 'Creá torneos y ligas', desc: 'Organizá competencias con brackets, llaves y resultados en tiempo real.' },
    { icon: '🎲', title: 'Sorteos y brackets', desc: 'Generá cruces automáticos, sorteos en vivo y seguí cada partido.' },
  ]
  const features = [
    { icon: '🔒', label: 'Cifrado E2E' },
    { icon: '⚡', label: 'Tiempo real' },
    { icon: '📞', label: 'Llamadas' },
    { icon: '🎤', label: 'Audios' },
    { icon: '📊', label: 'Ranking ELO' },
    { icon: '🤖', label: 'Bots API' },
  ]
  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 32px 56px',
      background: `radial-gradient(ellipse at 50% 10%, ${C.greenDk}18 0%, transparent 60%)`,
    }}>
      <div style={{ width: '100%', maxWidth: 500 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img src="/logo.svg" alt="NexoTribu" width="64" height="64" style={{ display: 'block', margin: '0 auto 14px' }} />
          <p style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: '-0.5px' }}>NexoTribu</p>
          <p style={{ margin: 0, fontSize: 12, color: C.textDim, letterSpacing: '2.5px', textTransform: 'uppercase' }}>Competí · Conectá · Ganá</p>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              background: C.panel, border: `1px solid ${C.border}`,
              borderRadius: 14, padding: '14px 16px',
              transition: 'border-color .2s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = `${C.green}55`}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: `${C.green}14`, border: `1px solid ${C.green}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>{s.icon}</div>
              <div>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
                  <span style={{ color: C.green, fontWeight: 800, marginRight: 6 }}>{String(i + 1).padStart(2, '0')}.</span>
                  {s.title}
                </div>
                <div style={{ color: C.textDim, fontSize: 12, lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ color: C.textDim, fontSize: 11, fontWeight: 600, letterSpacing: '1px' }}>PLATAFORMA</span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {features.map(f => (
            <span key={f.label} style={{
              fontSize: 12, color: C.textDim, background: C.panel,
              padding: '6px 14px', borderRadius: 20,
              border: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span>{f.icon}</span>{f.label}
            </span>
          ))}
        </div>

        {/* Tagline */}
        <p style={{ textAlign: 'center', marginTop: 28, fontSize: 11, color: `${C.textDim}88`, letterSpacing: '0.5px' }}>
          Seleccioná una conversación para comenzar
        </p>
      </div>
    </div>
  )
}
