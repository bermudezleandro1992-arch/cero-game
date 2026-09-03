/**
 * TournamentChat — chat grupal para torneos.
 * - @menciones autocomplete de participantes
 * - Click derecho → limpiar historial (admin/organizer)
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

function fmtTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

function Avatar({ p, size = 30 }) {
  const style = { width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${C.border}`, flexShrink: 0 }
  return p?.avatar_url
    ? <img src={p.avatar_url} alt="" style={style} />
    : <div style={{ ...style, background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, color: C.textDim }}>
        {(p?.display_name || p?.username || '?')[0].toUpperCase()}
      </div>
}

const stripQ = s => (typeof s === 'string' ? s.replace(/^"+|"+$/g, '') : s)

export default function TournamentChat({ tournamentId: rawTournamentId, profile, isAdmin, tournamentStatus }) {
  const tournamentId = stripQ(rawTournamentId)
  const [messages,  setMessages]  = useState([])
  const [text,      setText]      = useState('')
  const [sending,   setSending]   = useState(false)
  const [profiles,  setProfiles]  = useState({})
  const [isMember,  setIsMember]  = useState(null)
  const [ctxMenu,   setCtxMenu]   = useState(null) // { x, y }
  const [clearing,  setClearing]  = useState(false)

  // @mention
  const [mentionQ,    setMentionQ]    = useState('')
  const [mentionList, setMentionList] = useState([])
  const [memberList,  setMemberList]  = useState([]) // all participants

  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)

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
    const { data: members } = await supabase
      .from('conversation_members').select('user_id').eq('conversation_id', tournamentId)
    const ids = (members || []).map(m => m.user_id)
    if (!ids.length) return
    const { data: rows } = await supabase
      .from('users').select('id, display_name, username, avatar_url').in('id', ids)
    const map = {}
    ;(rows || []).forEach(p => { map[p.id] = p })
    setProfiles(map)
    setMemberList(rows || [])
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

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`tournament-chat-${tournamentId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${tournamentId}`,
      }, payload => {
        const msg = payload.new
        if (msg.type === 'system') return
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
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

  // Close ctx menu on click elsewhere
  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [ctxMenu])

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sending || !profile?.id) return
    if (isMember === false) { alert('Primero inscribite al torneo para poder chatear.'); return }
    setSending(true)
    setText('')
    setMentionList([])
    const tempId = `tmp-${Date.now()}`
    const tempMsg = { id: tempId, conversation_id: tournamentId, sender_id: profile.id, content: trimmed, type: 'text', created_at: new Date().toISOString() }
    setMessages(prev => [...prev, tempMsg])
    const { data: inserted, error } = await supabase.from('messages').insert({
      conversation_id: tournamentId,
      sender_id: profile.id,
      content: trimmed,
      type: 'text',
    }).select('id, conversation_id, sender_id, content, type, created_at').single()
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setText(trimmed)
    } else if (inserted) {
      setMessages(prev => prev.map(m => m.id === tempId ? inserted : m))
    }
    setSending(false)
    inputRef.current?.focus()
  }

  function handleInputChange(e) {
    const val = e.target.value
    setText(val)
    // Detect @mention
    const match = val.match(/@(\w*)$/)
    if (match) {
      const q = match[1].toLowerCase()
      setMentionQ(q)
      const filtered = memberList.filter(m =>
        (m.display_name || '').toLowerCase().includes(q) ||
        (m.username || '').toLowerCase().includes(q)
      ).slice(0, 6)
      setMentionList(filtered)
    } else {
      setMentionQ('')
      setMentionList([])
    }
  }

  function insertMention(member) {
    const name = member.display_name || member.username || '?'
    const newText = text.replace(/@\w*$/, `@${name} `)
    setText(newText)
    setMentionList([])
    inputRef.current?.focus()
  }

  function handleKey(e) {
    if (mentionList.length > 0 && (e.key === 'Escape')) { setMentionList([]); return }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  async function handleClearHistory() {
    if (!isAdmin) return
    if (!window.confirm('¿Limpiar todo el historial del chat? Esta acción no se puede deshacer.')) return
    setClearing(true)
    setCtxMenu(null)
    const { error } = await supabase.from('messages')
      .delete()
      .eq('conversation_id', tournamentId)
    if (error) { alert(`Error: ${error.message}`) }
    else { setMessages([]) }
    setClearing(false)
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

  const grouped = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1]
    const sameUser = prev?.sender_id === msg.sender_id
    const timeDiff = prev ? new Date(msg.created_at) - new Date(prev.created_at) < 5 * 60 * 1000 : false
    acc.push({ ...msg, grouped: sameUser && timeDiff })
    return acc
  }, [])

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}
      onContextMenu={e => {
        e.preventDefault()
        if (isAdmin) setCtxMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {grouped.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: C.textDim, textAlign: 'center' }}>
            <div style={{ fontSize: 44 }}>💬</div>
            <div style={{ fontSize: 13 }}>Sé el primero en escribir en el chat del torneo.</div>
            {isAdmin && <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>Click derecho para gestionar el chat</div>}
          </div>
        ) : grouped.map(msg => {
          const p = profiles[msg.sender_id]
          const isMe = msg.sender_id === profile?.id
          const isBot = msg.type === 'bot_fixture' || msg.type === 'bot'
          return (
            <div key={msg.id} style={{
              display: 'flex', gap: 8, alignItems: 'flex-end',
              flexDirection: isMe ? 'row-reverse' : 'row',
              marginTop: msg.grouped ? 1 : 8,
            }}>
              <div style={{ width: 30, flexShrink: 0 }}>
                {!msg.grouped && !isMe && (
                  isBot
                    ? <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a1a2e', border: '1.5px solid #25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🤖</div>
                    : <Avatar p={p} size={28} />
                )}
              </div>
              <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 3, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                {!msg.grouped && !isMe && (
                  <span style={{ color: isBot ? C.green : C.textDim, fontSize: 10, fontWeight: 700, marginLeft: 4 }}>
                    {isBot ? '🤖 Bot' : (p?.display_name || p?.username || '?')}
                  </span>
                )}
                <div style={{
                  background: isMe ? C.green : isBot ? `${C.green}18` : C.panel,
                  color: isMe ? '#000' : C.text,
                  border: isBot ? `1px solid ${C.green}44` : 'none',
                  borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                  padding: '8px 12px',
                  fontSize: 13, lineHeight: 1.5,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}>
                  {/* Highlight @mentions */}
                  {msg.content.split(/(@\w[\w\s]*)/g).map((part, i) =>
                    part.startsWith('@')
                      ? <span key={i} style={{ color: isMe ? '#004d1a' : C.green, fontWeight: 700 }}>{part}</span>
                      : part
                  )}
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

      {/* @mention autocomplete */}
      {mentionList.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 70, left: 12, right: 12,
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 100, overflow: 'hidden',
        }}>
          {mentionList.map(m => (
            <button key={m.id} onClick={() => insertMention(m)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `1px solid ${C.border}`, textAlign: 'left',
            }}>
              <Avatar p={m} size={28} />
              <div>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{m.display_name || m.username}</div>
                {m.username && <div style={{ color: C.textDim, fontSize: 11 }}>@{m.username}</div>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      {tournamentStatus === 'finalizado' ? (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 16px', background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🏆</span>
          <span style={{ color: C.textDim, fontSize: 13, fontWeight: 600 }}>Torneo finalizado · Chat cerrado</span>
        </div>
      ) : (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={text}
            onChange={handleInputChange}
            onKeyDown={handleKey}
            placeholder="Escribí un mensaje… (@nombre para mencionar)"
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
      )}

      {/* Context menu (admin only) */}
      {ctxMenu && isAdmin && createPortal(
        <div onClick={() => setCtxMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', top: Math.min(ctxMenu.y, window.innerHeight - 120), left: Math.min(ctxMenu.x, window.innerWidth - 200),
              background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 9999, minWidth: 190, overflow: 'hidden',
            }}
          >
            <div style={{ padding: '8px 14px 6px', fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Gestión del chat
            </div>
            <button
              onClick={handleClearHistory}
              disabled={clearing}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer',
                color: '#ef4444', fontSize: 13, fontWeight: 700, textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 16 }}>🗑️</span>
              {clearing ? 'Limpiando…' : 'Limpiar historial'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
