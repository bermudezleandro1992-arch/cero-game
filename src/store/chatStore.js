import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { sounds } from '../lib/sounds'

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  loadingMessages: false,
  topics: [],
  activeTopicId: null,

  setActiveConversation: (conv) => set({ activeConversation: conv, messages: [], topics: [], activeTopicId: null }),
  setActiveTopic: (topicId) => set({ activeTopicId: topicId }),

  fetchTopics: async (conversationId) => {
    const { data } = await supabase
      .from('topics')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('position', { ascending: true })
    set({ topics: data || [] })
  },

  createTopic: async (conversationId, name, emoji = '💬', topicType = 'chat') => {
    const { topics } = get()
    const position = topics.length
    const { data } = await supabase
      .from('topics')
      .insert({ conversation_id: conversationId, name, emoji, topic_type: topicType, position })
      .select()
      .single()
    if (data) set(state => ({ topics: [...state.topics, data] }))
    return data
  },

  fetchMessages: async (conversationId, topicId = null) => {
    set({ loadingMessages: true })
    const userId = (await supabase.auth.getUser()).data?.user?.id

    // Get cleared_at for this user so we hide messages before the clear point
    let clearedAt = null
    if (userId) {
      const { data: mem } = await supabase
        .from('conversation_members')
        .select('cleared_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .single()
      clearedAt = mem?.cleared_at || null
    }

    let q = supabase
      .from('messages')
      .select('*, sender:users!messages_sender_id_fkey(id, display_name, username, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (topicId) q = q.eq('topic_id', topicId)
    else q = q.is('topic_id', null)
    if (clearedAt) q = q.gt('created_at', clearedAt)
    const { data } = await q
    set({ messages: (data || []).reverse(), loadingMessages: false })
  },

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
      .select('id, name, is_group, created_by, avatar_url, group_type, description')
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
          isCommunity: meta?.group_type === 'community',
          name: isGroup ? meta?.name : null,
          description: meta?.description,
          avatarUrl: meta?.avatar_url,
          user: isGroup ? null : members[0],  // for 1-on-1
          members,                              // for groups
          lastMessage: lastMsgMap[convId],
          lastReadAt: lastReadMap[convId],
          unread: unreadMap[convId] || 0,
        }
      })
      .filter(c => {
        if (!c.isGroup && !c.user) return false
        // Torneos y ligas no van en el chat list — se acceden desde la sección Torneos
        const meta = convMeta[c.id]
        if (meta?.group_type === 'tournament' || meta?.group_type === 'liga') return false
        return true
      })
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


  sendMessage: async (conversationId, senderId, content, type = 'text', maxViews = null, topicId = null) => {
    const row = { conversation_id: conversationId, sender_id: senderId, content, type }
    if (maxViews) row.max_views = maxViews
    if (topicId) row.topic_id = topicId
    const { data, error } = await supabase
      .from('messages')
      .insert(row)
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
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const updated = payload.new
        set(state => ({
          messages: state.messages.map(m =>
            m.id === updated.id ? { ...m, ...updated } : m
          )
        }))
      })
      .subscribe()

    // Separate broadcast channel for instant delete propagation
    const evtChannel = supabase
      .channel(`conv-events:${conversationId}`)
      .on('broadcast', { event: 'msg-deleted' }, ({ payload }) => {
        set(state => ({
          messages: state.messages.map(m =>
            m.id === payload.messageId ? { ...m, is_deleted: true, content: '' } : m
          )
        }))
      })
      .subscribe()

    // Realtime reactions
    const reactChannel = supabase
      .channel(`reactions:${conversationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_reactions',
      }, async (payload) => {
        const msgId = payload.new?.message_id || payload.old?.message_id
        if (!msgId) return
        const { data: reactions } = await supabase
          .from('message_reactions')
          .select('emoji, user_id')
          .eq('message_id', msgId)
        set(state => ({
          messages: state.messages.map(m =>
            m.id === msgId ? { ...m, reactions: reactions || [] } : m
          )
        }))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(evtChannel)
      supabase.removeChannel(reactChannel)
    }
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

  deleteMessage: async (messageId, conversationId) => {
    await supabase.from('messages').update({ is_deleted: true, content: '' }).eq('id', messageId)
    // Broadcast deletion so all participants update instantly
    if (conversationId) {
      supabase.channel(`conv-events:${conversationId}`)
        .send({ type: 'broadcast', event: 'msg-deleted', payload: { messageId } })
    }
    set(state => ({
      messages: state.messages.map(m =>
        m.id === messageId ? { ...m, is_deleted: true, content: '' } : m
      )
    }))
  },

  editMessage: async (messageId, newContent) => {
    const now = new Date().toISOString()
    await supabase.from('messages').update({ content: newContent, edited_at: now }).eq('id', messageId)
    set(state => ({
      messages: state.messages.map(m =>
        m.id === messageId ? { ...m, content: newContent, edited_at: now } : m
      )
    }))
  },

  forwardMessage: async (fromConvId, toConvId, senderId, content, type) => {
    const row = { conversation_id: toConvId, sender_id: senderId, content, type }
    const { data } = await supabase.from('messages').insert(row)
      .select('*, sender:users!messages_sender_id_fkey(id, display_name, username, avatar_url)').single()
    return data
  },

  blockUser: async (blockerId, blockedId) => {
    await supabase.from('blocks').upsert({ blocker_id: blockerId, blocked_id: blockedId })
  },

  unblockUser: async (blockerId, blockedId) => {
    await supabase.from('blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId)
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

  createGroup: async (name, memberIds, createdBy, type = 'group', description = '', isPublic = true) => {
    const isCommunity = type === 'community'
    const insertData = { name, is_group: true, created_by: createdBy }
    if (isCommunity) {
      insertData.group_type = 'community'
      insertData.is_public = isPublic
    }
    if (description) {
      insertData.description = description
    }
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      // Fallback without new columns if migration not run
      const { data: conv2 } = await supabase
        .from('conversations')
        .insert({ name, is_group: true, created_by: createdBy })
        .select()
        .single()
      if (!conv2) return null
      await supabase.from('conversation_members').insert(
        [createdBy, ...memberIds].map(uid => ({ conversation_id: conv2.id, user_id: uid }))
      )
      await supabase.from('messages').insert({
        conversation_id: conv2.id, sender_id: createdBy, type: 'system',
        content: `${isCommunity ? 'Comunidad' : 'Grupo'} "${name}" creado`,
      })
      return conv2.id
    }

    await supabase.from('conversation_members').insert(
      [createdBy, ...memberIds].map(uid => ({
        conversation_id: conv.id,
        user_id: uid,
      }))
    )

    // Asignar rol owner al creador
    await supabase.from('group_roles').upsert(
      { conversation_id: conv.id, user_id: createdBy, role: 'owner' },
      { onConflict: 'conversation_id,user_id' }
    )

    await supabase.from('messages').insert({
      conversation_id: conv.id,
      sender_id: createdBy,
      type: 'system',
      content: `${isCommunity ? 'Comunidad' : 'Grupo'} "${name}" creado`,
    })

    return conv.id
  },
}))
