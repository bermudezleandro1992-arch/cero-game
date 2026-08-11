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
      .select(`
        conversation_id,
        conversations (id, created_at),
        last_read_at
      `)
      .eq('user_id', userId)

    if (!data) return

    const convIds = data.map(d => d.conversation_id)
    if (convIds.length === 0) { set({ conversations: [] }); return }

    // Para cada conversación, buscar el otro miembro
    const { data: members } = await supabase
      .from('conversation_members')
      .select('conversation_id, user_id, users(id, display_name, username, avatar_url)')
      .in('conversation_id', convIds)
      .neq('user_id', userId)

    // Último mensaje de cada conversación
    const { data: lastMsgs } = await supabase
      .from('messages')
      .select('conversation_id, content, created_at, type')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })

    const lastMsgMap = {}
    lastMsgs?.forEach(m => {
      if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m
    })

    const conversations = data.map(d => {
      const other = members?.find(m => m.conversation_id === d.conversation_id)
      return {
        id: d.conversation_id,
        user: other?.users,
        lastMessage: lastMsgMap[d.conversation_id],
        lastReadAt: d.last_read_at,
      }
    }).filter(c => c.user)

    set({ conversations })
  },

  fetchMessages: async (conversationId) => {
    set({ loadingMessages: true })
    const { data } = await supabase
      .from('messages')
      .select('*, users(display_name, username, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(50)
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
        // Buscar datos del sender
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
    // Buscar conversación existente
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

    // Crear nueva conversación
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
