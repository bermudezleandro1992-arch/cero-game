import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Shared online users state — updated by the single presence channel
let _onlineIds = new Set()
const _listeners = new Set()

function notifyListeners() {
  _listeners.forEach(fn => fn(new Set(_onlineIds)))
}

// Single shared channel — created once, reused by both hooks
let _channel = null
let _channelUserId = null

function getOrCreateChannel(userId) {
  // If channel exists for same user, reuse it
  if (_channel && _channelUserId === userId) return _channel

  // Remove old channel if user changed
  if (_channel) {
    supabase.removeChannel(_channel)
    _channel = null
    _channelUserId = null
  }

  const ch = supabase.channel('global-presence', { config: { presence: { key: userId } } })

  ch
    .on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState()
      const ids = new Set()
      Object.values(state).forEach(presences =>
        presences.forEach(p => { if (p.user_id) ids.add(p.user_id) })
      )
      _onlineIds = ids
      notifyListeners()
    })
    .on('presence', { event: 'join' }, ({ newPresences }) => {
      newPresences?.forEach(p => { if (p.user_id) _onlineIds.add(p.user_id) })
      notifyListeners()
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
      leftPresences?.forEach(p => { if (p.user_id) _onlineIds.delete(p.user_id) })
      notifyListeners()
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && userId) {
        await ch.track({ user_id: userId, online_at: Date.now() })
      }
    })

  _channel = ch
  _channelUserId = userId
  return ch
}

// Registers the current user as "online" and updates last_seen_at periodically
export function usePresence(userId) {
  useEffect(() => {
    if (!userId) return
    // Respect showOnline privacy setting
    try {
      const priv = JSON.parse(localStorage.getItem('privacySettings') || '{}')
      if (priv.showOnline === false) return
    } catch {}

    async function updateSeen() {
      await supabase.from('users')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', userId)
    }

    updateSeen()
    const interval = setInterval(updateSeen, 30000)
    getOrCreateChannel(userId)

    const onVisible = () => { if (!document.hidden) updateSeen() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId])
}

// Returns a Set of user IDs currently online
export function useOnlineUsers() {
  const [onlineIds, setOnlineIds] = useState(() => new Set(_onlineIds))

  useEffect(() => {
    const fn = (ids) => setOnlineIds(ids)
    _listeners.add(fn)
    return () => _listeners.delete(fn)
  }, [])

  return onlineIds
}
