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

// ── Design tokens ─────────────────────────────────────────────────────────────
export const C = {
  bg:       '#05080A',
  bg2:      '#0A1014',
  panel:    '#0D151A',
  panel2:   '#111B21',
  border:   '#1C292F',
  green:    '#39FF14',
  green2:   '#19D84A',
  greenDk:  '#0B7A2A',
  text:     '#FFFFFF',
  text2:    '#A7B0B5',
  textDim:  '#667078',
  red:      '#FF3B30',
  yellow:   '#FFD600',
}

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
    id: 'resultados', label: 'Resultados',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
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

export default function App() {
  const { user, profile, loading, setUser, setLoading, fetchProfile } = useAuthStore()
  const { incomingCall, setIncomingCall, clearCall } = useCallStore()
  const { conversations, activeConversation, setActiveConversation, fetchConversations, subscribeToConversations } = useChatStore()
  const [tab, setTab] = useState('chats')
  const [showProfile, setShowProfile] = useState(false)
  usePresence(user?.id)

  useEffect(() => {
    if (!profile?.id) return
    fetchConversations(profile.id)
    const unsub = subscribeToConversations(profile.id)
    return unsub
  }, [profile?.id])

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

  const showChat = !!activeConversation
  const totalUnread = conversations.reduce((s, c) => s + (c.unread || 0), 0)

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <UpdateBanner />

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

      {showProfile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: C.bg }}>
          <ProfileSheet onClose={() => setShowProfile(false)} />
        </div>
      )}

      {/* Shell */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* LEFT — list */}
        <div className={`slfa-left${showChat ? ' slfa-left--hidden' : ''}`}>
          <ChatListPage onProfileClick={() => setShowProfile(true)} />
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
          {NAV.map(({ id, label, icon }) => {
            const active = tab === id
            const isProfile = id === 'perfil'
            return (
              <button key={id} onClick={() => isProfile ? setShowProfile(true) : setTab(id)} style={{
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
        .slfa-left, .slfa-right {
          position: absolute; inset: 0;
          transition: transform .28s cubic-bezier(.4,0,.2,1);
          overflow: hidden;
          background: ${C.bg};
        }
        .slfa-left               { transform: translateX(0); }
        .slfa-left--hidden       { transform: translateX(-100%); }
        .slfa-right              { transform: translateX(100%); }
        .slfa-right--visible     { transform: translateX(0); }

        /* Desktop ≥768px: sidebar layout */
        @media (min-width: 768px) {
          .slfa-bottom-nav { display: none !important; }
          .slfa-left, .slfa-right {
            position: relative !important;
            transform: none !important;
          }
          .slfa-left  { width: 340px; flex-shrink: 0; border-right: 1px solid ${C.border}; }
          .slfa-right { flex: 1; }
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }

        /* Message entrance animation */
        @keyframes msgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .msg-in { animation: msgIn .18s ease-out both; }

        /* Skeleton pulse */
        @keyframes skelPulse { 0%,100%{opacity:.4} 50%{opacity:.9} }
        .skeleton { animation: skelPulse 1.4s ease-in-out infinite; background: ${C.panel2}; border-radius: 8px; }

        /* Green glow on focus */
        input:focus, textarea:focus { outline: none; border-color: ${C.green} !important; box-shadow: 0 0 0 2px ${C.green}22 !important; }

        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
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
        width: 90, height: 90, borderRadius: '50%',
        border: `1.5px solid ${C.green}30`,
        background: `radial-gradient(circle, ${C.green}10 0%, transparent 70%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 38, boxShadow: `0 0 40px ${C.green}18`,
      }}>⚡</div>
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
