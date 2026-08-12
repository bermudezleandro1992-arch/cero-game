import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import { useCallStore } from './store/callStore'
import LoginPage from './pages/LoginPage'
import ChatListPage from './pages/ChatListPage'
import CallPage from './pages/CallPage'
import UpdateBanner from './components/UpdateBanner'
import ProfileSheet from './components/ProfileSheet'
import { usePresence } from './hooks/usePresence'
import { ringtone } from './lib/sounds'

export default function App() {
  const { user, profile, loading, setUser, setLoading, fetchProfile } = useAuthStore()
  const { incomingCall, activeCall, setIncomingCall, setActiveCall, clearCall } = useCallStore()
  usePresence(user?.id)

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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: '#111b21' }}>
        <div className="text-3xl animate-pulse">💬</div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  // Profile not loaded yet
  if (!profile) return (
    <div className="h-full flex items-center justify-center" style={{ background: '#111b21' }}>
      <div className="text-3xl animate-pulse">💬</div>
    </div>
  )

  // First-time user: has default name or no real username → force profile setup
  const needsProfileSetup = !profile.display_name
    || profile.display_name === 'Usuario'
    || profile.display_name.startsWith('user_')
    || !profile.username
    || profile.username.startsWith('user_')

  if (needsProfileSetup) {
    return <ProfileSheet onClose={() => fetchProfile(user.id)} forceSetup />
  }

  // Show active call page
  if (activeCall) {
    return (
      <CallPage
        conversationId={activeCall.convId}
        myUserId={profile.id}
        contact={activeCall.contact}
        callType={activeCall.callType}
        isIncoming={activeCall.isIncoming}
        incomingOffer={activeCall.offer}
        onEnd={clearCall}
      />
    )
  }

  // Show incoming call banner
  if (incomingCall) {
    return (
      <>
        <UpdateBanner />
        <ChatListPage />
        <CallPage
          conversationId={incomingCall.convId}
          myUserId={profile.id}
          contact={{ id: incomingCall.from, display_name: incomingCall.fromName || 'Usuario' }}
          callType={incomingCall.callType}
          isIncoming={true}
          incomingOffer={incomingCall.offer}
          onEnd={clearCall}
        />
      </>
    )
  }

  return (
    <>
      <UpdateBanner />
      <ChatListPage />
    </>
  )
}
