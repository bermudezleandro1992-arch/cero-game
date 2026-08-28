/**
 * TournamentChat — chat grupal en tiempo real para participantes del torneo.
 * Usa Supabase Realtime sobre la tabla `messages` con conversation_id = tournamentId.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

function fmtTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

function avatar(p, size = 30) {
  const style = { width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${C.border}`, flexShrink: 0 }
  return p?.avatar_url
    ? <img src={p.avatar_url} alt="" style={style} />
    : <div style={{ ...style, background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, color: C.textDim }}>
        {(p?.display_name || p?.username || '?')[0].toUpperCase()}
      </div>
}

export default function TournamentChat({ tournamentId, profile }) {
  const [messages,  setMessages]  = useState([])
  const [text,      setText]      = useState('')
  const [sending,   setSending]   = useState(false)
  const [profiles,  setProfiles]  = useState({})
  const [isMember,  setIsMember]  = useState(null)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  // Verificar si el usuario es participante
  useEffect(() => {
    if (!profile?.id || !tournamentId) return
    supabase.from('conversation_members')
      .select('user_id', { head: true, count: 'exact' })
      .eq('conversation_id', tournamentId)
      .eq('user_id', profile.id)
      .then(({ count }) => setIsMember((count ?? 0) > 0))
  }, [profile?.id, tournamentId])

  // Cargar perfiles de participantes
  const loadProfiles = useCallback(async () => {
    const { data: members } = await supabase.from('conversation_members').select('user_id').eq('conversation_id', tournamentId)
    const ids = (members || []).map(m => m.user_id)
    if (!ids.length) return
    const { data: rows } = await supabase.from('users').select('id, display_name, username, avatar_url').in('id', ids)
    const map = {}
    ;(rows || []).forEach(p => { map[p.id] = p })
    setProfiles(map)
  }, [tournamentId])

  // Cargar mensajes
  const loadMessages = useCallback(async () => {
    const { data } = await supabase.from('messages')
      .select('id, content, sender_id, created_at, type')
      .eq('conversation_id', tournamentId)
      .neq('type', 'system')
      .order('created_at', { ascending: true })
      .limit(150)
    setMessages(data || [])
  }, [tournamentId])

  useEffect(() => {
    loadProfiles()
    loadMessages()
  }, [loadProfiles, loadMessages])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`tournament-chat-${tournamentId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${tournamentId}`,
      }, payload => {
        const msg = payload.new
        if (msg.type === 'system') return
        setMessages(prev => [...prev, msg])
        // Cargar perfil del nuevo sender si no lo tenemos
        if (!profiles[msg.sender_id]) {
          supabase.from('users').select('id, display_name, username, avatar_url').eq('id', msg.sender_id).single()
            .then(({ data: p }) => { if (p) setProfiles(prev => ({ ...prev, [p.id]: p })) })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tournamentId, profiles])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sending || !profile?.id) return
    if (isMember === false) { alert('Primero inscribite al torneo para poder chatear.'); return }
    setSending(true)
    setText('')
    const { error } = await supabase.from('messages').insert({
      conversation_id: tournamentId,
      sender_id: profile.id,
      content: trimmed,
      type: 'text',
    })
    if (error) { alert(`Error al enviar: ${error.message}`); setText(trimmed) }
    setSending(false)
    inputRef.current?.focus()
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (isMember === null) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    </div>
  )

  if (isMember === false) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32, gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>Solo para participantes</div>
      <div style={{ color: C.textDim, fontSize: 13 }}>Inscribite al torneo para acceder al chat grupal.</div>
    </div>
  )

  // Group consecutive messages by same sender
  const grouped = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1]
    const sameUser = prev?.sender_id === msg.sender_id
    const timeDiff = prev ? new Date(msg.created_at) - new Date(prev.created_at) < 5 * 60 * 1000 : false
    acc.push({ ...msg, grouped: sameUser && timeDiff })
    return acc
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {grouped.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: C.textDim, textAlign: 'center' }}>
            <div style={{ fontSize: 44 }}>💬</div>
            <div style={{ fontSize: 13 }}>Sé el primero en escribir en el chat del torneo.</div>
          </div>
        ) : grouped.map(msg => {
          const p = profiles[msg.sender_id]
          const isMe = msg.sender_id === profile?.id
          return (
            <div key={msg.id} style={{
              display: 'flex', gap: 8, alignItems: 'flex-end',
              flexDirection: isMe ? 'row-reverse' : 'row',
              marginTop: msg.grouped ? 1 : 8,
            }}>
              {/* Avatar: solo en primer mensaje del grupo */}
              <div style={{ width: 30, flexShrink: 0 }}>
                {!msg.grouped && !isMe && avatar(p, 28)}
              </div>

              {/* Bubble */}
              <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 3, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                {!msg.grouped && !isMe && (
                  <span style={{ color: C.textDim, fontSize: 10, fontWeight: 700, marginLeft: 4 }}>
                    {p?.display_name || p?.username || '?'}
                  </span>
                )}
                <div style={{
                  background: isMe ? C.green : C.panel,
                  color: isMe ? '#000' : C.text,
                  borderRadius: isMe
                    ? (msg.grouped ? '16px 4px 16px 16px' : '16px 4px 16px 16px')
                    : (msg.grouped ? '4px 16px 16px 16px' : '4px 16px 16px 16px'),
                  padding: '8px 12px',
                  fontSize: 14, lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
                {!msg.grouped && (
                  <span style={{ color: C.textDim, fontSize: 10, marginLeft: isMe ? 0 : 4, marginRight: isMe ? 4 : 0 }}>
                    {fmtTime(msg.created_at)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribí un mensaje..."
          style={{
            flex: 1, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 24,
            padding: '10px 16px', color: C.text, fontSize: 14, outline: 'none',
          }}
        />
        <button onClick={handleSend} disabled={!text.trim() || sending} style={{
          width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: text.trim() ? 'pointer' : 'default',
          background: text.trim() ? C.green : C.panel2, color: text.trim() ? '#000' : C.textDim,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          transition: 'background .15s',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
        </button>
      </div>
    </div>
  )
}
