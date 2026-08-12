import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ONLINE_THRESHOLD_MS = 90000 // 90s — presence updates every 30s

function isRecentlySeen(lastSeenAt) {
  if (!lastSeenAt) return false
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS
}

// Returns online status, last seen, and typing state for a contact in a conversation
export function useContactStatus(contactId, conversationId, myUserId) {
  const [lastSeen, setLastSeen] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  const [otherLastRead, setOtherLastRead] = useState(null)

  const isOnline = isRecentlySeen(lastSeen)

  useEffect(() => {
    if (!contactId) return

    // Fetch initial last_seen_at
    supabase.from('users').select('last_seen_at').eq('id', contactId).single()
      .then(({ data }) => { if (data) setLastSeen(data.last_seen_at) })

    // Subscribe to their row updates (last_seen_at changes) — unique channel per contact
    const userChannel = supabase.channel(`contact-user:${contactId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${contactId}` },
        (payload) => { if (payload.new.last_seen_at) setLastSeen(payload.new.last_seen_at) })
      .subscribe()

    return () => { supabase.removeChannel(userChannel) }
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

    // Unique channel name to avoid conflicts with subscribeToMessages
    const convChannel = supabase.channel(`contact-conv:${conversationId}:${contactId}`)
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
