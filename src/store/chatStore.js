import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { sounds } from '../lib/sounds'

// Extract clean UUID from any string (handles embedded quotes, JSON encoding, etc.)
const cleanUUID = v => {
  if (!v) return v
  const s = typeof v === 'string' ? v : String(v)
  const m = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  return m ? m[0] : s
}

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  loadingMessages: false,
  topics: [],
  activeTopicId: null,
  subChannelMap: {}, // subChannelId → communityConvId

  setActiveConversation: (conv) => {
    const cleaned = conv ? { ...conv, id: cleanUUID(conv.id) } : conv
    set({ activeConversation: cleaned, messages: [], topics: [], activeTopicId: null })
  },
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

  fetchMessages: async (rawConversationId, topicId = null) => {
    const conversationId = cleanUUID(rawConversationId)
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
    const convIds0 = memberships.map(m => cleanUUID(m.conversation_id))
    let convMeta = {}
    const { data: metaRows } = await supabase
      .from('conversations')
      .select('id, name, is_group, created_by, avatar_url, group_type, description, is_public, is_locked, who_can_send, who_can_add, who_can_edit_info, slow_mode_seconds, auto_delete_hours, allow_export, allow_auto_save, announcement_only, require_approval, invite_link, pinned_message, torneos_enabled, ligas_enabled, clanes_enabled, tags, member_count, game_rules, plan')
      .in('id', convIds0)
    metaRows?.forEach(r => { convMeta[r.id] = r })

    const convIds = convIds0
    const lastReadMap = Object.fromEntries(memberships.map(m => [m.conversation_id, m.last_read_at]))

    const [membersRpc, lastMsgsRes] = await Promise.all([
      // SECURITY DEFINER RPC bypasses RLS — sees all members including DM partners
      supabase.rpc('get_conversation_members', { p_conversation_ids: convIds }),
      supabase
        .from('messages')
        .select('conversation_id, content, created_at, type, sender_id')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false }),
    ])

    // Fallback to direct query if RPC not deployed yet
    const allMemberRows = membersRpc.data
      ?? (await supabase.from('conversation_members').select('conversation_id, user_id').in('conversation_id', convIds)).data
      ?? []

    const lastMsgMap = {}
    lastMsgsRes.data?.forEach(m => {
      if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m
    })

    // Fetch all users' profiles in one query
    const allUserIds = [...new Set(allMemberRows.map(m => m.user_id).filter(id => id !== userId))]
    const { data: userRows } = allUserIds.length
      ? await supabase.from('users').select('id, display_name, username, avatar_url').in('id', allUserIds)
      : { data: [] }
    const userMap = Object.fromEntries((userRows || []).map(u => [u.id, u]))

    // Group members by conversation (exclude self)
    const groupMembersMap = {}
    allMemberRows.forEach(m => {
      if (m.user_id === userId) return
      if (!groupMembersMap[m.conversation_id]) groupMembersMap[m.conversation_id] = []
      const profile = userMap[m.user_id] || { id: m.user_id }
      groupMembersMap[m.conversation_id].push(profile)
    })

    // Count unread per conversation — single RPC instead of one query per conversation
    const { data: unreadRows } = await supabase.rpc('get_unread_counts', { p_user_id: userId })
    const unreadMap = Object.fromEntries((unreadRows || []).map(r => [r.conversation_id, Number(r.unread_count)]))

    // dm_status (requires migration 076 — gracefully skip if column missing)
    let dmStatusMap = {}
    try {
      const { data: dmRows, error: dmErr } = await supabase
        .from('conversations').select('id, dm_status').in('id', convIds)
      if (!dmErr && dmRows) dmRows.forEach(r => { dmStatusMap[r.id] = r.dm_status })
    } catch (_) { /* migration not applied yet */ }

    const conversations = convIds
      .map(convId => {
        const meta = convMeta[convId]
        const members = groupMembersMap[convId] || []
        const isGroup = meta?.is_group || false
        return {
          id: convId,
          isGroup,
          isCommunity: meta?.group_type === 'community',
          group_type: meta?.group_type,
          name: isGroup ? meta?.name : null,
          description: meta?.description,
          avatarUrl: meta?.avatar_url,
          avatar_url: meta?.avatar_url,
          created_by: meta?.created_by,
          is_public: meta?.is_public,
          is_locked: meta?.is_locked,
          who_can_send: meta?.who_can_send,
          who_can_add: meta?.who_can_add,
          who_can_edit_info: meta?.who_can_edit_info,
          slow_mode_seconds: meta?.slow_mode_seconds,
          auto_delete_hours: meta?.auto_delete_hours,
          allow_export: meta?.allow_export,
          allow_auto_save: meta?.allow_auto_save,
          announcement_only: meta?.announcement_only,
          plan: meta?.plan ?? 'free',
          require_approval: meta?.require_approval,
          invite_link: meta?.invite_link,
          pinned_message: meta?.pinned_message,
          torneos_enabled: meta?.torneos_enabled,
          ligas_enabled: meta?.ligas_enabled,
          clanes_enabled: meta?.clanes_enabled,
          tags: meta?.tags,
          member_count: meta?.member_count,
          game_rules: meta?.game_rules,
          user: isGroup ? null : members[0],  // for 1-on-1
          members,                              // for groups
          lastMessage: lastMsgMap[convId],
          lastReadAt: lastReadMap[convId],
          unread: unreadMap[convId] || 0,
          dm_status: dmStatusMap?.[convId] ?? 'accepted',
        }
      })
      .filter(c => {
        if (!c.isGroup && !c.user) return false
        // Torneos y ligas no van en el chat list — se acceden desde la sección Torneos
        const meta = convMeta[c.id]
        if (meta?.group_type === 'tournament' || meta?.group_type === 'liga') return false
        if (meta?.group_type === 'deleted') return false
        return true
      })

    // For communities: fetch last message across sub-channels and attach channel name
    const communityConvs = conversations.filter(c => c.isCommunity)
    if (communityConvs.length > 0) {
      const communityIds = communityConvs.map(c => c.id)
      const { data: subChannels } = await supabase
        .from('conversations')
        .select('id, name, community_id, group_type')
        .in('community_id', communityIds)
        .in('group_type', ['channel', 'group'])
        .order('created_at', { ascending: true })

      if (subChannels?.length) {
        const channelIds = subChannels.map(ch => ch.id)
        const { data: channelMsgs } = await supabase
          .from('messages')
          .select('conversation_id, content, created_at, type, sender_id')
          .in('conversation_id', channelIds)
          .order('created_at', { ascending: false })

        // Map: communityId → latest msg with channel_name
        const communityLastMsg = {}
        channelMsgs?.forEach(msg => {
          const ch = subChannels.find(c => c.id === msg.conversation_id)
          if (!ch) return
          const existing = communityLastMsg[ch.community_id]
          if (!existing || msg.created_at > existing.created_at) {
            communityLastMsg[ch.community_id] = { ...msg, channel_name: ch.name }
          }
        })

        // Unread count across all sub-channels per community
        const communityUnread = {}
        for (const c of communityConvs) {
          const chIds = subChannels.filter(ch => ch.community_id === c.id).map(ch => ch.id)
          if (!chIds.length) continue
          let total = 0
          for (const chId of chIds) {
            const lastRead = lastReadMap[chId] || lastReadMap[c.id]
            const q = supabase.from('messages').select('*', { count: 'exact', head: true })
              .eq('conversation_id', chId).neq('sender_id', userId)
            if (lastRead) q.gt('created_at', lastRead)
            const { count } = await q
            total += count || 0
          }
          communityUnread[c.id] = total
        }

        // Build sub-channel → community map for realtime updates
        const subChannelMap = {}
        subChannels?.forEach(ch => { subChannelMap[ch.id] = ch.community_id })

        conversations.forEach(c => {
          if (!c.isCommunity) return
          if (communityLastMsg[c.id]) {
            c.lastMessage = communityLastMsg[c.id]
            c.unread = (communityUnread[c.id] || 0) + (c.unread || 0)
          }
        })

        set(state => ({ subChannelMap: { ...state.subChannelMap, ...subChannelMap } }))
      }
    }

    conversations.sort((a, b) => {
      const ta = a.lastMessage?.created_at || a.id
      const tb = b.lastMessage?.created_at || b.id
      return tb.localeCompare(ta)
    })

    set({ conversations })
  },

  markAsRead: async (conversationId, userId) => {
    conversationId = cleanUUID(conversationId)
    if (!conversationId || !userId) return
    try {
      const priv = JSON.parse(localStorage.getItem('privacySettings') || '{}')
      if (priv.readReceipts === false) return
    } catch {}
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${userId}` }, () => {
        get().fetchConversations(userId)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, (payload) => {
        const updated = payload.new
        set(state => ({
          conversations: state.conversations.map(c =>
            c.id === updated.id ? { ...c, ...updated } : c
          )
        }))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new
        set(state => {
          // Resolve the conversation to update — may be a community parent via sub-channel
          const communityId = state.subChannelMap[msg.conversation_id]
          const targetId = communityId || msg.conversation_id

          const idx = state.conversations.findIndex(c => c.id === targetId)
          if (idx === -1) return state

          const isActive = state.activeConversation?.id === msg.conversation_id
          const isOwn = msg.sender_id === userId
          if (!isOwn) {
            sounds.msgReceived()
            if (document.visibilityState !== 'visible' && Notification.permission === 'granted') {
              const conv = state.conversations[idx]
              const convName = conv?.name || 'NexoTribu'
              const body = msg.type === 'image' ? '📷 Imagen' : msg.type === 'audio' ? '🎵 Audio' : (msg.content || '').slice(0, 80)
              try {
                new Notification(convName, {
                  body,
                  icon: '/icon-192.png',
                  badge: '/icon-192.png',
                  tag: `msg-${targetId}`,
                  silent: false,
                })
              } catch {}
            }
          }
          const updated = state.conversations.map(c => {
            if (c.id !== targetId) return c
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
    // Aggressively extract UUID - handle any encoding (double-quotes, JSON-encoded, etc)
    const raw = String(conversationId ?? '')
    const uuidMatch = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    if (!uuidMatch) throw new Error(`ID de conversación inválido: ${raw}`)
    const cleanConvId = uuidMatch[0]
    const rawSender = String(senderId ?? '')
    const senderMatch = rawSender.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    const cleanSenderId = senderMatch ? senderMatch[0] : rawSender
    console.log('[sendMsg v2.3.3] conv:', cleanConvId, 'sender:', cleanSenderId, 'rawConv:', raw, 'rawSender:', rawSender)
    const row = { conversation_id: cleanConvId, sender_id: cleanSenderId, content, type }
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
    conversationId = cleanUUID(conversationId)
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
    // Use SECURITY DEFINER RPC — bypasses RLS so both members get inserted correctly
    const { data: convId, error } = await supabase.rpc('find_or_create_dm', {
      p_other_user_id: otherUserId,
    })
    if (!error && convId) return cleanUUID(convId)

    // Fallback: direct insert (may fail RLS for other member row)
    const { data: conv } = await supabase
      .from('conversations')
      .insert({ is_group: false, created_by: myId })
      .select()
      .single()
    if (!conv) return null
    await supabase.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: myId },
      { conversation_id: conv.id, user_id: otherUserId },
    ])
    return cleanUUID(conv.id)
  },

  acceptDmRequest: async (conversationId) => {
    await supabase.rpc('accept_dm_request', { p_conversation_id: conversationId })
    set(state => ({
      conversations: state.conversations.map(c =>
        c.id === conversationId ? { ...c, dm_status: 'accepted' } : c
      ),
    }))
  },

  declineDmRequest: async (conversationId) => {
    await supabase.rpc('decline_dm_request', { p_conversation_id: conversationId })
    set(state => ({
      conversations: state.conversations.filter(c => c.id !== conversationId),
      activeConversation: null,
    }))
  },

  deleteMessage: async (messageId, conversationId, senderRole) => {
    // Preserve original content for VIP visibility; wipe display content
    const msg = get().messages.find(m => m.id === messageId)
    const originalContent = msg?.content || ''
    await supabase.from('messages').update({
      is_deleted: true,
      content: '',
      deleted_content: senderRole === 'superadmin' ? null : originalContent,
      deleted_by_role: senderRole || 'member',
    }).eq('id', messageId)
    if (conversationId) {
      supabase.channel(`conv-events:${conversationId}`)
        .send({ type: 'broadcast', event: 'msg-deleted', payload: { messageId } })
    }
    set(state => ({
      messages: state.messages.map(m =>
        m.id === messageId ? { ...m, is_deleted: true, content: '', deleted_content: senderRole === 'superadmin' ? null : originalContent, deleted_by_role: senderRole || 'member' } : m
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

    // Auto-create default channels for communities
    if (isCommunity) {
      await supabase.from('topics').insert([
        { conversation_id: conv.id, name: 'General', emoji: '💬', topic_type: 'chat', position: 0, is_default: true, who_can_send: 'everyone' },
        { conversation_id: conv.id, name: 'Avisos', emoji: '📢', topic_type: 'announcements', position: 1, is_default: true, who_can_send: 'admins' },
      ])
    }

    return conv.id
  },
}))
