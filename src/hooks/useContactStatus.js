import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Returns online status, last seen, and typing state for a contact in a conversation
export function useContactStatus(contactId, conversationId, myUserId) {
  const [isOnline, setIsOnline] = useState(false)
  const [lastSeen, setLastSeen] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  const [otherLastRead, setOtherLastRead] = useState(null)

  useEffect(() => {
    if (!contactId) return

    // Fetch initial last_seen_at
    supabase.from('users').select('last_seen_at').eq('id', contactId).single()
      .then(({ data }) => { if (data) setLastSeen(data.last_seen_at) })

    // Subscribe to their row updates (last_seen_at changes)
    const userChannel = supabase.channel(`contact-status:${contactId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${contactId}` },
        (payload) => { setLastSeen(payload.new.last_seen_at) })
      .subscribe()

    // Presence: detect if they're online right now
    const presenceChannel = supabase.channel('global-presence')
    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState()
      const online = Object.values(state).flat().some(u => u.user_id === contactId)
      setIsOnline(online)
      if (online) setLastSeen(new Date().toISOString())
    }).subscribe()

    return () => {
      supabase.removeChannel(userChannel)
      supabase.removeChannel(presenceChannel)
    }
  }, [contactId])

  useEffect(() => {
    if (!conversationId || !contactId) return

    // Fetch other user's last_read_at for blue ticks
    supabase.from('conversation_members')
      .select('last_read_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', contactId)
      .single()
      .then(({ data }) => { if (data) setOtherLastRead(data.last_read_at) })

    // Subscribe to typing broadcasts + read receipt updates
    const convChannel = supabase.channel(`conv:${conversationId}`)
    let typingTimer = null

    convChannel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id !== myUserId) {
          setIsTyping(true)
          clearTimeout(typingTimer)
          typingTimer = setTimeout(() => setIsTyping(false), 3000)
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'conversation_members',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        if (payload.new.user_id === contactId) {
          setOtherLastRead(payload.new.last_read_at)
        }
      })
      .subscribe()

    return () => {
      clearTimeout(typingTimer)
      supabase.removeChannel(convChannel)
    }
  }, [conversationId, contactId, myUserId])

  return { isOnline, lastSeen, isTyping, otherLastRead }
}

export function formatLastSeen(lastSeen, isOnline) {
  if (isOnline) return 'En línea'
  if (!lastSeen) return ''
  const diff = Date.now() - new Date(lastSeen).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'Visto hace un momento'
  if (mins < 60) return `Visto hace ${mins} min`
  if (hours < 24) return `Visto hace ${hours} h`
  if (days === 1) return 'Visto ayer'
  return `Visto el ${new Date(lastSeen).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`
}
