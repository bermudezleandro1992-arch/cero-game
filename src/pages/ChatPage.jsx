import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import ContactPage from './ContactPage'
import { useContactStatus, formatLastSeen } from '../hooks/useContactStatus'
import { supabase } from '../lib/supabase'

const EMOJIS = ['😀','😂','❤️','👍','🔥','😍','🥺','😭','🙏','✅','💯','😎','🤣','😊','🎉','👏','🤔','😅','😢','💪','🫡','😆','🤩','😮','🥳','👀','💀','🙌','🤝','⚡']

export default function ChatPage({ onBack }) {
  const { profile } = useAuthStore()
  const {
    activeConversation, messages, loadingMessages,
    fetchMessages, sendMessage, subscribeToMessages, markAsRead, uploadImage,
  } = useChatStore()
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
    isGroup ? null : otherUser?.id,
    activeConversation?.id,
    profile?.id
  )

  // Broadcast our presence in this chat so the other user sees "En línea"
  useEffect(() => {
    if (!activeConversation?.id || !profile?.id || isGroup) return
    const ch = supabase.channel(`contact-conv:${activeConversation.id}:${profile.id}`)
    const broadcastPresence = () => ch.send({ type: 'broadcast', event: 'chat-presence', payload: { user_id: profile.id } })
    ch.subscribe(() => { broadcastPresence() })
    const interval = setInterval(broadcastPresence, 20000)
    return () => {
      ch.send({ type: 'broadcast', event: 'chat-leave', payload: { user_id: profile.id } })
      clearInterval(interval)
      supabase.removeChannel(ch)
    }
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

  const typingTimeout = useRef(null)
  function handleTyping() {
    if (!activeConversation?.id || !profile?.id) return
    supabase.channel(`contact-conv:${activeConversation.id}:${profile.id}`).send({
      type: 'broadcast', event: 'typing', payload: { user_id: profile.id }
    })
    clearTimeout(typingTimeout.current)
  }

  async function handleSend(e) {
    e?.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    const content = replyTo
      ? `[↩ ${replyTo.sender?.display_name}: ${replyTo.content?.slice(0, 40)}${replyTo.content?.length > 40 ? '…' : ''}]\n${text.trim()}`
      : text.trim()
    setReplyTo(null)
    setText('')
    try {
      await sendMessage(activeConversation.id, profile.id, content, 'text')
    } catch (err) {
      alert(`Error al enviar: ${err.message}`)
      setText(content)
    }
    setSending(false)
    inputRef.current?.focus()
  }

  async function handleImagePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('La imagen no puede superar 10MB'); return }
    setUploadingImage(true)
    try {
      const url = await uploadImage(file, profile.id)
      await sendMessage(activeConversation.id, profile.id, url, 'image')
    } catch (err) {
      alert(`Error al subir imagen: ${err.message}`)
    }
    setUploadingImage(false)
    fileRef.current.value = ''
  }

  function onMsgLongPress(msg) {
    longPressTimer.current = setTimeout(() => setLongPressMsg(msg), 400)
  }
  function onMsgLongPressEnd() {
    clearTimeout(longPressTimer.current)
  }

  const grouped = groupByDate(messages)
  const avatarLetters = isGroup
    ? (groupName?.slice(0, 2).toUpperCase() || '👥')
    : (otherUser?.display_name?.slice(0, 2).toUpperCase() || '?')

  return (
    <>
    {showContact && !isGroup && (
      <ContactPage user={otherUser} onBack={() => setShowContact(false)} onChat={() => setShowContact(false)} />
    )}

    <div className="h-screen flex flex-col" style={{ background: '#0b141a' }}
      onClick={() => { setLongPressMsg(null); setShowEmoji(false) }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 flex-shrink-0 shadow-lg"
        style={{ background: '#202c33', borderBottom: '1px solid #1a2530' }}>
        <button onClick={onBack} className="text-white p-1 flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => !isGroup && setShowContact(true)}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0 relative"
            style={{ background: isGroup ? '#1f6b5c' : '#2a3942' }}>
            {avatarLetters}
            {isOnline && !isGroup && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                style={{ background: '#00a884', borderColor: '#202c33' }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm leading-tight truncate">
              {isGroup ? groupName : otherUser?.display_name}
            </p>
            {isGroup ? (
              <p className="text-xs" style={{ color: '#8696a0' }}>
                {`${(activeConversation?.members?.length || 0) + 1} participantes`}
              </p>
            ) : isTyping ? (
              <p className="text-xs font-medium" style={{ color: '#00a884' }}>Escribiendo...</p>
            ) : (
              <p className="text-xs" style={{ color: isOnline ? '#00a884' : '#8696a0' }}>
                {formatLastSeen(lastSeen, isOnline)}
              </p>
            )}
          </div>
        </button>

        {/* Call buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => alert('Llamadas de voz próximamente')}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ color: '#8696a0' }}
            onMouseEnter={e => e.currentTarget.style.background = '#2a3942'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
          </button>
          <button onClick={() => alert('Videollamadas próximamente')}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ color: '#8696a0' }}
            onMouseEnter={e => e.currentTarget.style.background = '#2a3942'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col"
        style={{ overscrollBehavior: 'contain', backgroundImage: 'radial-gradient(circle at 1px 1px, #1a2a34 1px, transparent 0)', backgroundSize: '20px 20px' }}>
        {loadingMessages && (
          <div className="flex justify-center pt-8">
            <span className="text-sm" style={{ color: '#8696a0' }}>Cargando...</span>
          </div>
        )}

        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            <DateSeparator dateStr={date} />
            {msgs.map((msg, i) => {
              const isMine = msg.sender_id === profile?.id
              const isSystem = msg.type === 'system'
              const prevMsg = msgs[i - 1]
              const showName = isGroup && !isMine && msg.sender_id !== prevMsg?.sender_id
              const isReply = msg.content?.startsWith('[↩ ')

              if (isSystem) return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="text-xs px-3 py-1 rounded-full" style={{ background: '#182229', color: '#8696a0' }}>
                    {msg.content}
                  </span>
                </div>
              )

              return (
                <div key={msg.id}
                  className={`flex mb-1 ${isMine ? 'justify-end' : 'justify-start'}`}
                  onMouseDown={() => onMsgLongPress(msg)}
                  onMouseUp={onMsgLongPressEnd}
                  onTouchStart={() => onMsgLongPress(msg)}
                  onTouchEnd={onMsgLongPressEnd}
                  onClick={e => e.stopPropagation()}>
                  <div className="max-w-[80%] relative">
                    {showName && (
                      <p className="text-xs font-semibold px-3 mb-0.5" style={{ color: senderColor(msg.sender_id) }}>
                        {msg.sender?.display_name}
                      </p>
                    )}
                    <div className="px-3 py-1.5 text-sm shadow-md"
                      style={{
                        background: isMine ? '#005c4b' : '#202c33',
                        color: '#e9edef',
                        borderRadius: isMine ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                      }}>

                      {/* Reply preview */}
                      {isReply && (() => {
                        const lines = msg.content.split('\n')
                        const replyLine = lines[0].replace('[↩ ', '').replace(']', '')
                        const mainText = lines.slice(1).join('\n')
                        return (
                          <>
                            <div className="px-2 py-1 mb-1 rounded-lg text-xs border-l-2 border-green-400"
                              style={{ background: 'rgba(0,0,0,0.2)', color: '#a8d5c8' }}>
                              {replyLine}
                            </div>
                            <span style={{ whiteSpace: 'pre-wrap' }}>{mainText}</span>
                            <span className="inline-flex items-center gap-0.5 ml-2 align-bottom"
                              style={{ fontSize: 10, color: isMine ? '#a8d5c8' : '#8696a0' }}>
                              {formatTime(msg.created_at)} {isMine && <Ticks read={otherLastRead && otherLastRead > msg.created_at} />}
                            </span>
                          </>
                        )
                      })()}

                      {!isReply && msg.type === 'image' ? (
                        <div className="flex flex-col gap-1">
                          <img src={msg.content} alt="imagen"
                            className="rounded-lg max-w-full cursor-pointer"
                            style={{ maxHeight: 280, objectFit: 'cover' }}
                            loading="lazy"
                            onClick={() => window.open(msg.content, '_blank')} />
                          <span className="text-right block text-xs" style={{ color: '#a8d5c8' }}>
                            {formatTime(msg.created_at)} {isMine && <Ticks read={otherLastRead && otherLastRead > msg.created_at} />}
                          </span>
                        </div>
                      ) : !isReply ? (
                        <>
                          <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                          <span className="inline-flex items-center gap-0.5 ml-2 align-bottom"
                            style={{ fontSize: 10, color: isMine ? '#a8d5c8' : '#8696a0' }}>
                            {formatTime(msg.created_at)} {isMine && <Ticks read={otherLastRead && otherLastRead > msg.created_at} />}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {/* Long press menu */}
                    {longPressMsg?.id === msg.id && (
                      <div className="absolute z-30 flex gap-1 py-1 px-2 rounded-xl shadow-lg"
                        style={{
                          background: '#2a3942',
                          bottom: '100%', marginBottom: 4,
                          [isMine ? 'right' : 'left']: 0,
                        }}
                        onClick={e => e.stopPropagation()}>
                        <MsgAction label="↩ Responder" onClick={() => { setReplyTo(msg); setLongPressMsg(null); inputRef.current?.focus() }} />
                        <MsgAction label="📋 Copiar" onClick={() => { navigator.clipboard.writeText(msg.content); setLongPressMsg(null) }} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {messages.length === 0 && !loadingMessages && (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 pt-16" style={{ color: '#8696a0' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-2"
              style={{ background: '#1a2530' }}>
              💬
            </div>
            <p className="text-sm">{isGroup ? '¡Rompé el hielo!' : 'Comenzá la conversación'}</p>
            <p className="text-xs" style={{ color: '#4a5568' }}>Los mensajes son en tiempo real</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview bar */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 border-l-4 border-green-500 flex-shrink-0"
          style={{ background: '#1f2c34' }}>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: '#00a884' }}>{replyTo.sender?.display_name}</p>
            <p className="text-xs truncate" style={{ color: '#8696a0' }}>
              {replyTo.type === 'image' ? '📷 Foto' : replyTo.content}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} style={{ color: '#8696a0' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div className="flex flex-wrap gap-2 px-4 py-3 flex-shrink-0 border-t"
          style={{ background: '#202c33', borderColor: '#2a3942' }}
          onClick={e => e.stopPropagation()}>
          {EMOJIS.map(em => (
            <button key={em} onClick={() => { setText(t => t + em); setShowEmoji(false); inputRef.current?.focus() }}
              className="text-2xl hover:scale-125 transition-transform">
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <form onSubmit={handleSend}
        className="flex items-center gap-2 px-3 py-3 flex-shrink-0"
        style={{ background: '#202c33', borderTop: '1px solid #1a2530' }}
        onClick={e => e.stopPropagation()}>
        <input type="file" accept="image/*,video/*" ref={fileRef} onChange={handleImagePick} className="hidden" />

        <button type="button"
          onClick={() => { setShowEmoji(v => !v); setLongPressMsg(null) }}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xl transition-colors"
          style={{ background: showEmoji ? '#00a884' : '#2a3942' }}>
          😊
        </button>

        <input
          ref={inputRef}
          type="text"
          placeholder="Escribe un mensaje"
          value={text}
          onChange={e => { setText(e.target.value); handleTyping() }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSend(e) }}
          className="flex-1 px-4 py-2.5 rounded-full text-sm text-white outline-none"
          style={{ background: '#2a3942' }}
          autoFocus
        />

        {text.trim() ? (
          <button type="submit" disabled={sending}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-transform active:scale-95"
            style={{ background: '#00a884' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        ) : (
          <button type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadingImage}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-colors"
            style={{ background: '#2a3942' }}>
            {uploadingImage
              ? <span className="text-xs" style={{ color: '#8696a0' }}>...</span>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
            }
          </button>
        )}
      </form>
    </div>
    </>
  )
}

function MsgAction({ label, onClick }) {
  return (
    <button onClick={onClick} className="text-xs px-2 py-1.5 rounded-lg text-white whitespace-nowrap"
      style={{ background: '#3d5460' }}>
      {label}
    </button>
  )
}

const SENDER_COLORS = ['#e91e63','#9c27b0','#2196f3','#00bcd4','#4caf50','#ff9800','#795548']
function senderColor(id) {
  if (!id) return SENDER_COLORS[0]
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length]
}

function Ticks({ read }) {
  const color = read ? '#53bdeb' : '#a8d5c8'
  return (
    <svg width="14" height="9" viewBox="0 0 16 11" fill="none" style={{ display: 'inline', verticalAlign: 'middle' }}>
      <path d="M1 5.5L5 9.5L11 2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5.5L9 9.5L15 2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function DateSeparator({ dateStr }) {
  const d = new Date(dateStr)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  let label
  if (d.toDateString() === now.toDateString()) label = 'Hoy'
  else if (d.toDateString() === yesterday.toDateString()) label = 'Ayer'
  else label = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div className="flex justify-center my-3">
      <span className="text-xs px-3 py-1 rounded-full shadow-sm" style={{ background: '#182229', color: '#8696a0' }}>{label}</span>
    </div>
  )
}

function groupByDate(messages) {
  const groups = []
  let current = null
  for (const msg of messages) {
    const date = msg.created_at?.slice(0, 10)
    if (!current || current.date !== date) {
      current = { date, msgs: [] }
      groups.push(current)
    }
    current.msgs.push(msg)
  }
  return groups
}

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
