import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import ContactPage from './ContactPage'
import { useContactStatus, formatLastSeen } from '../hooks/useContactStatus'
import { supabase } from '../lib/supabase'

const EMOJIS = ['😀','😂','❤️','👍','🔥','😍','🥺','😭','🙏','✅','💯','😎','🤣','😊','🎉','👏','🤔','😅','😢','💪','🫡','😆','🤩','😮','🥳','👀','💀','🙌','🤝','⚡']
const SENDER_COLORS = ['#e91e63','#9c27b0','#2196f3','#00bcd4','#4caf50','#ff9800','#f44336']

function senderColor(id) {
  if (!id) return SENDER_COLORS[0]
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length]
}

function Avatar({ name, size = 32, color }) {
  const letters = name?.slice(0, 2).toUpperCase() || '?'
  const bg = color || '#2a3942'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0,
      letterSpacing: '-0.5px',
    }}>
      {letters}
    </div>
  )
}

function Ticks({ read, color }) {
  const c = read ? '#53bdeb' : (color || '#a8d5c8')
  return (
    <svg width="14" height="9" viewBox="0 0 16 11" fill="none" style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 2 }}>
      <path d="M1 5.5L5 9.5L11 2" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5.5L9 9.5L15 2" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function DateSeparator({ dateStr }) {
  const d = new Date(dateStr)
  const now = new Date()
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
  let label = d.toDateString() === now.toDateString() ? 'Hoy'
    : d.toDateString() === yesterday.toDateString() ? 'Ayer'
    : d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
      <span style={{
        fontSize: 11, padding: '3px 12px', borderRadius: 20,
        background: 'rgba(17,27,33,0.85)', color: '#8696a0',
        backdropFilter: 'blur(4px)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }}>{label}</span>
    </div>
  )
}

function groupByDate(messages) {
  const groups = []
  let current = null
  for (const msg of messages) {
    const date = msg.created_at?.slice(0, 10)
    if (!current || current.date !== date) { current = { date, msgs: [] }; groups.push(current) }
    current.msgs.push(msg)
  }
  return groups
}

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatPage({ onBack }) {
  const { profile } = useAuthStore()
  const { activeConversation, messages, loadingMessages, fetchMessages, sendMessage, subscribeToMessages, markAsRead, uploadImage } = useChatStore()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [longPressMsg, setLongPressMsg] = useState(null)
  const [showContact, setShowContact] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const fileRef = useRef(null)
  const longPressTimer = useRef(null)

  const isGroup = activeConversation?.isGroup
  const otherUser = activeConversation?.user
  const groupName = activeConversation?.name
  const { isOnline, lastSeen, isTyping, otherLastRead } = useContactStatus(
    isGroup ? null : otherUser?.id, activeConversation?.id, profile?.id
  )

  // Broadcast presence in this chat
  useEffect(() => {
    if (!activeConversation?.id || !profile?.id || isGroup) return
    const ch = supabase.channel(`contact-conv:${activeConversation.id}:${profile.id}`)
    const ping = () => ch.send({ type: 'broadcast', event: 'chat-presence', payload: { user_id: profile.id } })
    ch.subscribe(() => ping())
    const t = setInterval(ping, 20000)
    return () => { ch.send({ type: 'broadcast', event: 'chat-leave', payload: {} }); clearInterval(t); supabase.removeChannel(ch) }
  }, [activeConversation?.id, profile?.id])

  useEffect(() => {
    if (!activeConversation?.id) return
    fetchMessages(activeConversation.id)
    const unsub = subscribeToMessages(activeConversation.id)
    markAsRead(activeConversation.id, profile.id)
    return unsub
  }, [activeConversation?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (messages.length > 0) markAsRead(activeConversation?.id, profile?.id)
  }, [messages])

  const typingTimer = useRef(null)
  function handleTyping() {
    if (!activeConversation?.id || !profile?.id) return
    supabase.channel(`contact-conv:${activeConversation.id}:${profile.id}`)
      .send({ type: 'broadcast', event: 'typing', payload: { user_id: profile.id } })
    clearTimeout(typingTimer.current)
  }

  async function handleSend(e) {
    e?.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    const content = replyTo
      ? `[↩ ${replyTo.sender?.display_name}: ${replyTo.content?.slice(0, 40)}${replyTo.content?.length > 40 ? '…' : ''}]\n${text.trim()}`
      : text.trim()
    setReplyTo(null); setText('')
    try { await sendMessage(activeConversation.id, profile.id, content, 'text') }
    catch (err) { alert(`Error: ${err.message}`); setText(content) }
    setSending(false)
    inputRef.current?.focus()
  }

  async function handleImagePick(e) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('Máximo 10MB'); return }
    setUploadingImage(true)
    try { const url = await uploadImage(file, profile.id); await sendMessage(activeConversation.id, profile.id, url, 'image') }
    catch (err) { alert(`Error al subir: ${err.message}`) }
    setUploadingImage(false); fileRef.current.value = ''
  }

  const grouped = groupByDate(messages)

  // Build a map of member profiles for groups
  const memberMap = {}
  activeConversation?.members?.forEach(m => { if (m) memberMap[m.id] = m })
  if (otherUser) memberMap[otherUser.id] = otherUser

  return (
    <>
    {showContact && !isGroup && (
      <ContactPage user={otherUser} onBack={() => setShowContact(false)} onChat={() => setShowContact(false)} />
    )}
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0b141a', overflow: 'hidden' }}
      onClick={() => { setLongPressMsg(null); setShowEmoji(false) }}>

      {/* ── HEADER ── */}
      <div style={{
        background: '#202c33', display: 'flex', alignItems: 'center',
        padding: '8px 12px', gap: 10, flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}>
        <button onClick={onBack} style={{ color: '#aebac1', padding: 6, borderRadius: '50%', display: 'flex', background: 'none', border: 'none', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button onClick={() => !isGroup && setShowContact(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ position: 'relative' }}>
            <Avatar
              name={isGroup ? groupName : otherUser?.display_name}
              size={40}
              color={isGroup ? '#1f6b5c' : senderColor(otherUser?.id)}
            />
            {isOnline && !isGroup && (
              <span style={{
                position: 'absolute', bottom: 1, right: 1,
                width: 11, height: 11, borderRadius: '50%',
                background: '#00a884', border: '2px solid #202c33',
              }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: '#e9edef', fontWeight: 600, fontSize: 15, margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isGroup ? groupName : otherUser?.display_name}
            </p>
            <p style={{ margin: 0, fontSize: 12, marginTop: 1, color: isTyping ? '#00a884' : (isOnline ? '#00a884' : '#8696a0') }}>
              {isGroup
                ? `${(activeConversation?.members?.length || 0) + 1} participantes`
                : isTyping ? 'Escribiendo...'
                : formatLastSeen(lastSeen, isOnline)}
            </p>
          </div>
        </button>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <HeaderBtn onClick={() => alert('Llamadas de voz — próximamente')} title="Llamada">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
          </HeaderBtn>
          <HeaderBtn onClick={() => alert('Videollamadas — próximamente')} title="Video">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
          </HeaderBtn>
        </div>
      </div>

      {/* ── MESSAGES ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '8px 12px',
        display: 'flex', flexDirection: 'column',
        background: `#0b141a url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.6'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}>
        {loadingMessages && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <div style={{ color: '#8696a0', fontSize: 13 }}>Cargando mensajes...</div>
          </div>
        )}

        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            <DateSeparator dateStr={date} />
            {msgs.map((msg, i) => {
              const isMine = msg.sender_id === profile?.id
              const isSystem = msg.type === 'system'
              const prevMsg = msgs[i - 1]
              const nextMsg = msgs[i + 1]
              const isFirst = msg.sender_id !== prevMsg?.sender_id
              const isLast = msg.sender_id !== nextMsg?.sender_id
              const senderInfo = msg.sender || memberMap[msg.sender_id]
              const senderName = senderInfo?.display_name || 'Usuario'
              const isReply = msg.content?.startsWith('[↩ ')

              if (isSystem) return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                  <span style={{ fontSize: 11, padding: '3px 12px', borderRadius: 20, background: 'rgba(17,27,33,0.85)', color: '#8696a0' }}>
                    {msg.content}
                  </span>
                </div>
              )

              const bubbleBg = isMine ? '#005c4b' : '#202c33'
              const borderRadius = isMine
                ? (isFirst ? '12px 4px 12px 12px' : isLast ? '12px 12px 4px 12px' : '12px 4px 4px 12px')
                : (isFirst ? '4px 12px 12px 12px' : isLast ? '12px 12px 12px 4px' : '4px 12px 12px 4px')

              return (
                <div key={msg.id}
                  style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: isLast ? 6 : 2, alignItems: 'flex-end', gap: 6 }}
                  onMouseDown={() => { longPressTimer.current = setTimeout(() => setLongPressMsg(msg), 400) }}
                  onMouseUp={() => clearTimeout(longPressTimer.current)}
                  onTouchStart={() => { longPressTimer.current = setTimeout(() => setLongPressMsg(msg), 400) }}
                  onTouchEnd={() => clearTimeout(longPressTimer.current)}
                  onClick={e => e.stopPropagation()}>

                  {/* Avatar for received messages */}
                  {!isMine && (
                    <div style={{ width: 28, flexShrink: 0, marginBottom: 2 }}>
                      {isLast && (
                        <Avatar name={senderName} size={28} color={senderColor(msg.sender_id)} />
                      )}
                    </div>
                  )}

                  <div style={{ maxWidth: 'min(80%, 480px)', position: 'relative' }}>
                    {/* Sender name (groups or DM context) */}
                    {!isMine && isFirst && (
                      <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 2px 8px', color: senderColor(msg.sender_id) }}>
                        {senderName}
                        {!isGroup && <span style={{ color: '#8696a0', fontWeight: 400, marginLeft: 4 }}>@{senderInfo?.username || ''}</span>}
                      </p>
                    )}

                    <div style={{
                      background: bubbleBg, borderRadius, padding: '6px 10px 4px',
                      color: '#e9edef', fontSize: 14, lineHeight: 1.45,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      wordBreak: 'break-word',
                    }}>
                      {/* Reply quote */}
                      {isReply && (() => {
                        const lines = msg.content.split('\n')
                        const quote = lines[0].replace('[↩ ', '').replace(']', '')
                        const body = lines.slice(1).join('\n')
                        return (
                          <>
                            <div style={{ padding: '4px 8px', marginBottom: 4, borderRadius: 6, borderLeft: '3px solid #00a884', background: 'rgba(0,0,0,0.2)', fontSize: 12, color: '#a8d5c8' }}>
                              {quote}
                            </div>
                            <MessageContent msg={{ ...msg, content: body }} isMine={isMine} otherLastRead={otherLastRead} />
                          </>
                        )
                      })()}

                      {!isReply && <MessageContent msg={msg} isMine={isMine} otherLastRead={otherLastRead} />}
                    </div>

                    {/* Long press menu */}
                    {longPressMsg?.id === msg.id && (
                      <div style={{
                        position: 'absolute', zIndex: 30,
                        bottom: 'calc(100% + 4px)',
                        [isMine ? 'right' : 'left']: 0,
                        background: '#2a3942', borderRadius: 12,
                        display: 'flex', gap: 4, padding: '4px 6px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                      }} onClick={e => e.stopPropagation()}>
                        <ActionChip label="↩ Responder" onClick={() => { setReplyTo(msg); setLongPressMsg(null); inputRef.current?.focus() }} />
                        <ActionChip label="📋 Copiar" onClick={() => { navigator.clipboard.writeText(msg.content); setLongPressMsg(null) }} />
                      </div>
                    )}
                  </div>

                  {/* Spacer for sent messages alignment */}
                  {isMine && <div style={{ width: 28, flexShrink: 0 }} />}
                </div>
              )
            })}
          </div>
        ))}

        {messages.length === 0 && !loadingMessages && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#8696a0', paddingTop: 60 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#1a2530', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>💬</div>
            <p style={{ margin: 0, fontSize: 14 }}>{isGroup ? '¡Rompé el hielo!' : 'Comenzá la conversación'}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#4a5568' }}>Tiempo real · Sin delay</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── REPLY BAR ── */}
      {replyTo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#1f2c34', borderLeft: '4px solid #00a884', flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#00a884' }}>{replyTo.sender?.display_name || 'Usuario'}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#8696a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {replyTo.type === 'image' ? '📷 Imagen' : replyTo.content}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} style={{ color: '#8696a0', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
          </button>
        </div>
      )}

      {/* ── EMOJI PICKER ── */}
      {showEmoji && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 16px', background: '#202c33', borderTop: '1px solid #2a3942', flexShrink: 0 }}
          onClick={e => e.stopPropagation()}>
          {EMOJIS.map(em => (
            <button key={em} onClick={() => { setText(t => t + em); setShowEmoji(false); inputRef.current?.focus() }}
              style={{ fontSize: 22, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
              {em}
            </button>
          ))}
        </div>
      )}

      {/* ── INPUT BAR ── */}
      <form onSubmit={handleSend}
        style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 12px', background: '#202c33', borderTop: '1px solid #1a2530', flexShrink: 0 }}
        onClick={e => e.stopPropagation()}>
        <input type="file" accept="image/*,video/*" ref={fileRef} onChange={handleImagePick} style={{ display: 'none' }} />

        <button type="button" onClick={() => { setShowEmoji(v => !v); setLongPressMsg(null) }}
          style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0, fontSize: 18,
            background: showEmoji ? '#00a884' : '#2a3942', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s',
          }}>😊</button>

        <div style={{ flex: 1, background: '#2a3942', borderRadius: 24, display: 'flex', alignItems: 'center', padding: '0 14px', minHeight: 40 }}>
          <input ref={inputRef} type="text" placeholder="Escribe un mensaje" value={text}
            onChange={e => { setText(e.target.value); handleTyping() }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSend(e) }}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e9edef', fontSize: 14, padding: '8px 0' }}
            autoFocus />
        </div>

        {text.trim() ? (
          <button type="submit" disabled={sending}
            style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: '#00a884', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: sending ? 0.5 : 1, transition: 'transform .1s',
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingImage}
            style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: '#2a3942', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: uploadingImage ? 0.5 : 1,
            }}>
            {uploadingImage ? <span style={{ color: '#8696a0', fontSize: 11 }}>...</span>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2.5"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>}
          </button>
        )}
      </form>
    </div>
    </>
  )
}

function MessageContent({ msg, isMine, otherLastRead }) {
  const time = (
    <span style={{ fontSize: 10, color: isMine ? '#a8d5c8' : '#8696a0', marginLeft: 6, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 1, verticalAlign: 'bottom' }}>
      {formatTime(msg.created_at)}
      {isMine && <Ticks read={otherLastRead && otherLastRead > msg.created_at} />}
    </span>
  )
  if (msg.type === 'image') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <img src={msg.content} alt="" onClick={() => window.open(msg.content, '_blank')}
        style={{ borderRadius: 8, maxWidth: '100%', maxHeight: 280, objectFit: 'cover', cursor: 'pointer', display: 'block' }} loading="lazy" />
      <div style={{ textAlign: 'right' }}>{time}</div>
    </div>
  )
  return (
    <span style={{ whiteSpace: 'pre-wrap' }}>
      {msg.content}
      {time}
    </span>
  )
}

function HeaderBtn({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width: 38, height: 38, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', color: '#aebac1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseEnter={e => e.currentTarget.style.background = '#2a3942'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
      {children}
    </button>
  )
}

function ActionChip({ label, onClick }) {
  return (
    <button onClick={onClick}
      style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, color: '#e9edef', background: '#3d5460', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {label}
    </button>
  )
}
