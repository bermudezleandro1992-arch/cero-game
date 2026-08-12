import { useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import ChatListPage from './pages/ChatListPage'
import UpdateBanner from './components/UpdateBanner'
import ProfileSheet from './components/ProfileSheet'
import { usePresence } from './hooks/usePresence'

export default function App() {
  const { user, profile, loading, setUser, setLoading, fetchProfile } = useAuthStore()
  usePresence(user?.id)

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

  return (
    <>
      <UpdateBanner />
      <ChatListPage />
    </>
  )
}
