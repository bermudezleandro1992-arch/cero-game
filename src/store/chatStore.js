import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { sounds } from '../lib/sounds'

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  loadingMessages: false,

  setActiveConversation: (conv) => set({ activeConversation: conv, messages: [] }),

  fetchConversations: async (userId) => {
    const { data: memberships } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at, conversations(id, created_at)')
      .eq('user_id', userId)

    if (!memberships?.length) { set({ conversations: [] }); return }

    // Try to get group metadata (only available after migration 003)
    const convIds0 = memberships.map(m => m.conversation_id)
    let convMeta = {}
    const { data: metaRows } = await supabase
      .from('conversations')
      .select('id, name, is_group, created_by, avatar_url')
      .in('id', convIds0)
    metaRows?.forEach(r => { convMeta[r.id] = r })

    const convIds = convIds0
    const lastReadMap = Object.fromEntries(memberships.map(m => [m.conversation_id, m.last_read_at]))

    const [membersRes, lastMsgsRes] = await Promise.all([
      supabase
        .from('conversation_members')
        .select('conversation_id, user_id, member:users!conversation_members_user_id_fkey(id, display_name, username, avatar_url)')
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

    // Group members by conversation
    const groupMembersMap = {}
    membersRes.data?.forEach(m => {
      if (!groupMembersMap[m.conversation_id]) groupMembersMap[m.conversation_id] = []
      groupMembersMap[m.conversation_id].push(m.member)
    })

    // Count unread per conversation
    const unreadEntries = await Promise.all(
      convIds.map(async (convId) => {
        const lastRead = lastReadMap[convId]
        const query = supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', convId)
          .neq('sender_id', userId)
        if (lastRead) query.gt('created_at', lastRead)
        const { count } = await query
        return [convId, count || 0]
      })
    )
    const unreadMap = Object.fromEntries(unreadEntries)

    const conversations = convIds
      .map(convId => {
        const meta = convMeta[convId]
        const members = groupMembersMap[convId] || []
        const isGroup = meta?.is_group || false
        return {
          id: convId,
          isGroup,
          name: isGroup ? meta?.name : null,
          avatarUrl: meta?.avatar_url,
          user: isGroup ? null : members[0],  // for 1-on-1
          members,                              // for groups
          lastMessage: lastMsgMap[convId],
          lastReadAt: lastReadMap[convId],
          unread: unreadMap[convId] || 0,
        }
      })
      .filter(c => c.isGroup || c.user)
      .sort((a, b) => {
        const ta = a.lastMessage?.created_at || a.id
        const tb = b.lastMessage?.created_at || b.id
        return tb.localeCompare(ta)
      })

    set({ conversations })
  },

  markAsRead: async (conversationId, userId) => {
    if (!conversationId || !userId) return
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new
        set(state => {
          const idx = state.conversations.findIndex(c => c.id === msg.conversation_id)
          if (idx === -1) return state
          const isActive = state.activeConversation?.id === msg.conversation_id
          const isOwn = msg.sender_id === userId
          // Play sound for any incoming message from someone else
          if (!isOwn) sounds.msgReceived()
          const updated = state.conversations.map(c => {
            if (c.id !== msg.conversation_id) return c
            return {
              ...c,
              lastMessage: msg,
              unread: isActive || isOwn ? c.unread : c.unread + 1,
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
      .select('*, sender:users!messages_sender_id_fkey(id, display_name, username, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100)
    set({ messages: data || [], loadingMessages: false })
  },

  sendMessage: async (conversationId, senderId, content, type = 'text') => {
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, content, type })
      .select('*, sender:users!messages_sender_id_fkey(id, display_name, username, avatar_url)')
      .single()
    if (error) {
      console.error('sendMessage error:', error)
      throw error
    }
    if (data) {
      set(state => ({ messages: [...state.messages, data] }))
    }
  },

  uploadImage: async (file, userId) => {
    const ext = file.name.split('.').pop()
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('attachments').upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('attachments').getPublicUrl(path)
    return data.publicUrl
  },

  subscribeToMessages: (conversationId) => {
    const channel = supabase
      .channel(`msgs:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload) => {
        const { data: msg } = await supabase
          .from('messages')
          .select('*, sender:users!messages_sender_id_fkey(id, display_name, username, avatar_url)')
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
    // Get all conversations both users share
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

    // Create new conversation — try with is_group first, fall back without it
    let conv = null
    const { data: d1, error: e1 } = await supabase
      .from('conversations')
      .insert({ is_group: false })
      .select()
      .single()

    if (e1) {
      // Column might not exist yet, insert without it
      const { data: d2 } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single()
      conv = d2
    } else {
      conv = d1
    }

    if (!conv) return null

    await supabase.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: myId },
      { conversation_id: conv.id, user_id: otherUserId },
    ])

    return conv.id
  },

  deleteMessage: async (messageId) => {
    await supabase.from('messages').update({ is_deleted: true, content: '' }).eq('id', messageId)
    set(state => ({
      messages: state.messages.map(m =>
        m.id === messageId ? { ...m, is_deleted: true, content: '' } : m
      )
    }))
  },

  reactToMessage: async (messageId, userId, emoji) => {
    // Toggle: if already reacted with this emoji, remove it
    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle()

    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: userId, emoji })
    }

    // Reload reactions for this message
    const { data: reactions } = await supabase
      .from('message_reactions')
      .select('emoji, user_id')
      .eq('message_id', messageId)

    set(state => ({
      messages: state.messages.map(m =>
        m.id === messageId ? { ...m, reactions: reactions || [] } : m
      )
    }))
  },

  pinMessage: async (conversationId, text) => {
    await supabase.from('conversations').update({ pinned_message: text }).eq('id', conversationId)
    set(state => ({
      conversations: state.conversations.map(c =>
        c.id === conversationId ? { ...c, pinned_message: text } : c
      ),
      activeConversation: state.activeConversation?.id === conversationId
        ? { ...state.activeConversation, pinned_message: text }
        : state.activeConversation,
    }))
  },

  leaveGroup: async (conversationId, userId) => {
    await supabase.from('conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
    set(state => ({
      conversations: state.conversations.filter(c => c.id !== conversationId),
      activeConversation: state.activeConversation?.id === conversationId ? null : state.activeConversation,
    }))
  },

  fetchReactions: async (messageIds) => {
    if (!messageIds?.length) return
    const { data } = await supabase
      .from('message_reactions')
      .select('message_id, emoji, user_id')
      .in('message_id', messageIds)
    if (!data) return
    const byMsg = {}
    data.forEach(r => {
      if (!byMsg[r.message_id]) byMsg[r.message_id] = []
      byMsg[r.message_id].push(r)
    })
    set(state => ({
      messages: state.messages.map(m => ({ ...m, reactions: byMsg[m.id] || m.reactions || [] }))
    }))
  },

  createGroup: async (name, memberIds, createdBy) => {
    const { data: conv } = await supabase
      .from('conversations')
      .insert({ name, is_group: true, created_by: createdBy })
      .select()
      .single()

    await supabase.from('conversation_members').insert(
      [createdBy, ...memberIds].map(uid => ({
        conversation_id: conv.id,
        user_id: uid,
      }))
    )

    // System message
    await supabase.from('messages').insert({
      conversation_id: conv.id,
      sender_id: createdBy,
      type: 'system',
      content: `Grupo "${name}" creado`,
    })

    return conv.id
  },
}))
