import { useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import ChatListPage from './pages/ChatListPage'
import UpdateBanner from './components/UpdateBanner'

export default function App() {
  const { user, loading, setUser, setLoading, fetchProfile } = useAuthStore()

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

  return (
    <>
      <UpdateBanner />
      {user ? <ChatListPage /> : <LoginPage />}
    </>
  )
}
