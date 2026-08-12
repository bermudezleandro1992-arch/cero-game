import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'

export default function ChatPage({ onBack }) {
  const { profile } = useAuthStore()
  const {
    activeConversation, messages, loadingMessages,
    fetchMessages, sendMessage, subscribeToMessages, markAsRead,
  } = useChatStore()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!activeConversation?.id) return
    fetchMessages(activeConversation.id)
    const unsub = subscribeToMessages(activeConversation.id)
    markAsRead(activeConversation.id, profile.id)
    return unsub
  }, [activeConversation?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (messages.length > 0) {
      markAsRead(activeConversation?.id, profile?.id)
    }
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    await sendMessage(activeConversation.id, profile.id, text.trim())
    setText('')
    setSending(false)
    inputRef.current?.focus()
  }

  const otherUser = activeConversation?.user

  // Group messages by date
  const grouped = groupByDate(messages)

  return (
    <div className="h-screen flex flex-col" style={{ background: '#0b141a' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: '#202c33' }}>
        <button onClick={onBack} className="text-white p-1 rounded-full hover:bg-white/10 transition-all">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
          style={{ background: '#2a3942' }}>
          {otherUser?.display_name?.slice(0, 2).toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm leading-tight truncate">{otherUser?.display_name}</p>
          <p className="text-xs truncate" style={{ color: '#8696a0' }}>@{otherUser?.username}</p>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-0.5">
        {loadingMessages && (
          <div className="flex justify-center pt-8">
            <span className="text-sm" style={{ color: '#8696a0' }}>Cargando mensajes...</span>
          </div>
        )}

        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            <DateSeparator dateStr={date} />
            {msgs.map((msg) => {
              const isMine = msg.sender_id === profile?.id
              return (
                <div key={msg.id} className={`flex mb-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[78%] px-3 py-1.5 text-sm"
                    style={{
                      background: isMine ? '#005c4b' : '#202c33',
                      color: '#e9edef',
                      borderRadius: isMine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    }}>
                    <span>{msg.content}</span>
                    <span className="inline-flex items-center gap-1 ml-2 align-bottom" style={{ fontSize: 10, color: '#8696a0' }}>
                      {formatTime(msg.created_at)}
                      {isMine && <Ticks />}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {messages.length === 0 && !loadingMessages && (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 pt-16" style={{ color: '#8696a0' }}>
            <p className="text-sm">Comenzá la conversación</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-3" style={{ background: '#202c33' }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Escribe un mensaje"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend(e)}
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

function Ticks() {
  return (
    <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
      <path d="M1 5.5L5 9.5L11 2" stroke="#8696a0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5.5L9 9.5L15 2" stroke="#8696a0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
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
      <span className="text-xs px-3 py-1 rounded-full" style={{ background: '#182229', color: '#8696a0' }}>
        {label}
      </span>
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
