import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'

export default function ChatPage({ onBack }) {
  const { profile } = useAuthStore()
  const {
    activeConversation, messages, loadingMessages,
    fetchMessages, sendMessage, subscribeToMessages, markAsRead, uploadImage,
  } = useChatStore()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const fileRef = useRef(null)

  const isGroup = activeConversation?.isGroup
  const otherUser = activeConversation?.user
  const groupName = activeConversation?.name

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

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    await sendMessage(activeConversation.id, profile.id, text.trim(), 'text')
    setText('')
    setSending(false)
    inputRef.current?.focus()
  }

  async function handleImagePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('La imagen no puede superar 5MB'); return }
    setUploadingImage(true)
    try {
      const url = await uploadImage(file, profile.id)
      await sendMessage(activeConversation.id, profile.id, url, 'image')
    } catch {
      alert('Error al subir la imagen')
    }
    setUploadingImage(false)
    fileRef.current.value = ''
  }

  const grouped = groupByDate(messages)

  return (
    <div className="h-screen flex flex-col" style={{ background: '#0b141a' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: '#202c33' }}>
        <button onClick={onBack} className="text-white p-1 rounded-full hover:bg-white/10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {isGroup ? (
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
            style={{ background: '#1f6b5c' }}>
            {groupName?.slice(0, 2).toUpperCase() || '👥'}
          </div>
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
            style={{ background: '#2a3942' }}>
            {otherUser?.display_name?.slice(0, 2).toUpperCase() || '?'}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm leading-tight truncate">
            {isGroup ? groupName : otherUser?.display_name}
          </p>
          <p className="text-xs truncate" style={{ color: '#8696a0' }}>
            {isGroup
              ? `${(activeConversation?.members?.length || 0) + 1} participantes`
              : `@${otherUser?.username}`
            }
          </p>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-0">
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

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <span className="text-xs px-3 py-1 rounded-full" style={{ background: '#182229', color: '#8696a0' }}>
                      {msg.content}
                    </span>
                  </div>
                )
              }

              return (
                <div key={msg.id} className={`flex mb-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[80%]">
                    {showName && (
                      <p className="text-xs font-semibold px-3 mb-0.5" style={{ color: senderColor(msg.sender_id) }}>
                        {msg.users?.display_name}
                      </p>
                    )}
                    <div className="px-3 py-1.5 text-sm"
                      style={{
                        background: isMine ? '#005c4b' : '#202c33',
                        color: '#e9edef',
                        borderRadius: isMine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      }}>
                      {msg.type === 'image' ? (
                        <div className="flex flex-col gap-1">
                          <img
                            src={msg.content}
                            alt="imagen"
                            className="rounded-lg max-w-full"
                            style={{ maxHeight: 280, objectFit: 'cover' }}
                            loading="lazy"
                          />
                          <span className="text-right block" style={{ fontSize: 10, color: isMine ? '#a8d5c8' : '#8696a0' }}>
                            {formatTime(msg.created_at)}
                            {isMine && ' '}
                            {isMine && <Ticks />}
                          </span>
                        </div>
                      ) : (
                        <>
                          <span>{msg.content}</span>
                          <span className="inline-flex items-center gap-0.5 ml-2 align-bottom"
                            style={{ fontSize: 10, color: isMine ? '#a8d5c8' : '#8696a0' }}>
                            {formatTime(msg.created_at)}
                            {isMine && <Ticks />}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {messages.length === 0 && !loadingMessages && (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 pt-16" style={{ color: '#8696a0' }}>
            <p className="text-sm">{isGroup ? 'Nadie escribió aún. ¡Rompé el hielo!' : 'Comenzá la conversación'}</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-3" style={{ background: '#202c33' }}>
        <input type="file" accept="image/*" ref={fileRef} onChange={handleImagePick} className="hidden" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadingImage}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50"
          style={{ background: '#2a3942' }}>
          {uploadingImage
            ? <span className="text-sm" style={{ color: '#8696a0' }}>...</span>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 15l-5-5L5 21"/>
              </svg>
          }
        </button>

        <input
          ref={inputRef}
          type="text"
          placeholder="Escribe un mensaje"
          value={text}
          onChange={e => setText(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-full text-sm text-white outline-none"
          style={{ background: '#2a3942' }}
          autoFocus
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-40 flex-shrink-0"
          style={{ background: '#00a884' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>
    </div>
  )
}

const SENDER_COLORS = ['#e91e63', '#9c27b0', '#2196f3', '#00bcd4', '#4caf50', '#ff9800', '#795548']
function senderColor(id) {
  if (!id) return SENDER_COLORS[0]
  let hash = 0
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length]
}

function Ticks() {
  return (
    <svg width="14" height="9" viewBox="0 0 16 11" fill="none" style={{ display: 'inline' }}>
      <path d="M1 5.5L5 9.5L11 2" stroke="#a8d5c8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5.5L9 9.5L15 2" stroke="#a8d5c8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
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
      <span className="text-xs px-3 py-1 rounded-full" style={{ background: '#182229', color: '#8696a0' }}>{label}</span>
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
