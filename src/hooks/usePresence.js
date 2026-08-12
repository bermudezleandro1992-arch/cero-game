import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Registers the current user as "online" and updates last_seen_at periodically
export function usePresence(userId) {
  const channelRef = useRef(null)

  useEffect(() => {
    if (!userId) return

    async function updateSeen() {
      await supabase.from('users')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', userId)
    }

    updateSeen()
    const interval = setInterval(updateSeen, 30000)

    // Presence channel so others can see us online in real-time
    channelRef.current = supabase.channel('global-presence', { config: { presence: { key: userId } } })
    channelRef.current.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channelRef.current.track({ user_id: userId, online_at: Date.now() })
      }
    })

    const onVisible = () => { if (!document.hidden) updateSeen() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [userId])
}
