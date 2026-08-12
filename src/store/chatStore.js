import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  loadingMessages: false,

  setActiveConversation: (conv) => set({ activeConversation: conv, messages: [] }),

  fetchConversations: async (userId) => {
    const { data } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId)

    if (!data) return

    const convIds = data.map(d => d.conversation_id)
    if (convIds.length === 0) { set({ conversations: [] }); return }

    const lastReadMap = {}
    data.forEach(d => { lastReadMap[d.conversation_id] = d.last_read_at })

    const [membersRes, lastMsgsRes] = await Promise.all([
      supabase
        .from('conversation_members')
        .select('conversation_id, user_id, users(id, display_name, username, avatar_url)')
        .in('conversation_id', convIds)
        .neq('user_id', userId),
      supabase
        .from('messages')
        .select('conversation_id, content, created_at, type, sender_id')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false }),
    ])

    const lastMsgMap = {}
    lastMsgsRes.data?.forEach(m => {
      if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m
    })

    // Count unread per conversation
    const unreadCounts = await Promise.all(
      convIds.map(async (convId) => {
        const lastRead = lastReadMap[convId]
        if (!lastRead) {
          // Never read — count all messages not from me
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', convId)
            .neq('sender_id', userId)
          return [convId, count || 0]
        }
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', convId)
          .gt('created_at', lastRead)
          .neq('sender_id', userId)
        return [convId, count || 0]
      })
    )
    const unreadMap = Object.fromEntries(unreadCounts)

    const conversations = convIds
      .map(convId => {
        const other = membersRes.data?.find(m => m.conversation_id === convId)
        return {
          id: convId,
          user: other?.users,
          lastMessage: lastMsgMap[convId],
          lastReadAt: lastReadMap[convId],
          unread: unreadMap[convId] || 0,
        }
      })
      .filter(c => c.user)
      .sort((a, b) => {
        const ta = a.lastMessage?.created_at || ''
        const tb = b.lastMessage?.created_at || ''
        return tb.localeCompare(ta)
      })

    set({ conversations })
  },

  markAsRead: async (conversationId, userId) => {
    const now = new Date().toISOString()
    await supabase
      .from('conversation_members')
      .update({ last_read_at: now })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)

    set(state => ({
      conversations: state.conversations.map(c =>
        c.id === conversationId ? { ...c, unread: 0, lastReadAt: now } : c
      )
    }))
  },

  subscribeToConversations: (userId) => {
    const channel = supabase
      .channel(`user-convs:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new
        set(state => {
          const convs = state.conversations
          const idx = convs.findIndex(c => c.id === msg.conversation_id)
          if (idx === -1) return state
          const updated = convs.map(c => {
            if (c.id !== msg.conversation_id) return c
            const isActive = state.activeConversation?.id === c.id
            return {
              ...c,
              lastMessage: msg,
              unread: isActive || msg.sender_id === userId ? c.unread : c.unread + 1,
            }
          })
          return {
            conversations: updated.sort((a, b) => {
              const ta = a.lastMessage?.created_at || ''
              const tb = b.lastMessage?.created_at || ''
              return tb.localeCompare(ta)
            })
          }
        })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  },

  fetchMessages: async (conversationId) => {
    set({ loadingMessages: true })
    const { data } = await supabase
      .from('messages')
      .select('*, users(display_name, username, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100)
    set({ messages: data || [], loadingMessages: false })
  },

  sendMessage: async (conversationId, senderId, content) => {
    const { data } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, content, type: 'text' })
      .select('*, users(display_name, username, avatar_url)')
      .single()
    if (data) {
      set(state => ({ messages: [...state.messages, data] }))
    }
  },

  subscribeToMessages: (conversationId) => {
    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload) => {
        const { data: msg } = await supabase
          .from('messages')
          .select('*, users(display_name, username, avatar_url)')
          .eq('id', payload.new.id)
          .single()
        if (msg) {
          set(state => {
            const exists = state.messages.find(m => m.id === msg.id)
            if (exists) return state
            return { messages: [...state.messages, msg] }
          })
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  },

  findOrCreateConversation: async (myId, otherUserId) => {
    const { data: myConvs } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', myId)

    if (myConvs?.length) {
      const myIds = myConvs.map(c => c.conversation_id)
      const { data: shared } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', otherUserId)
        .in('conversation_id', myIds)

      if (shared?.length) return shared[0].conversation_id
    }

    const { data: conv } = await supabase
      .from('conversations')
      .insert({})
      .select()
      .single()

    await supabase.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: myId },
      { conversation_id: conv.id, user_id: otherUserId },
    ])

    return conv.id
  },
}))
