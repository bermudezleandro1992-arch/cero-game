import { useEffect, useRef, useState } from 'react'
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

// Returns a Set of user IDs currently online (via Supabase Presence)
export function useOnlineUsers() {
  const [onlineIds, setOnlineIds] = useState(new Set())
  const chRef = useRef(null)

  useEffect(() => {
    chRef.current = supabase.channel('global-presence')

    const sync = () => {
      const state = chRef.current.presenceState()
      const ids = new Set()
      Object.values(state).forEach(presences =>
        presences.forEach(p => { if (p.user_id) ids.add(p.user_id) })
      )
      setOnlineIds(ids)
    }

    chRef.current
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe()

    return () => { supabase.removeChannel(chRef.current) }
  }, [])

  return onlineIds
}
