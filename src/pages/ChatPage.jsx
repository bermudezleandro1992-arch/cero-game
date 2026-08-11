import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'

export default function ChatPage({ onBack }) {
  const { profile } = useAuthStore()
  const { activeConversation, messages, loadingMessages, fetchMessages, sendMessage, subscribeToMessages } = useChatStore()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!activeConversation?.id) return
    fetchMessages(activeConversation.id)
    const unsub = subscribeToMessages(activeConversation.id)
    return unsub
  }, [activeConversation?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    await sendMessage(activeConversation.id, profile.id, text.trim())
    setText('')
    setSending(false)
  }

  const otherUser = activeConversation?.user

  return (
    <div className="h-screen flex flex-col" style={{ background: '#0b141a' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3" style={{ background: '#202c33' }}>
        <button onClick={onBack} className="text-white p-1 rounded-full hover:bg-white/10 transition-all">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-white text-sm flex-shrink-0"
          style={{ background: '#2a3942' }}>
          {otherUser?.display_name?.slice(0, 2).toUpperCase() || '?'}
        </div>
        <div>
          <p className="font-semibold text-white text-sm leading-tight">{otherUser?.display_name}</p>
          <p className="text-xs" style={{ color: '#8696a0' }}>@{otherUser?.username}</p>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">
        {loadingMessages && (
          <div className="flex justify-center pt-4">
            <span className="text-sm" style={{ color: '#8696a0' }}>Cargando mensajes...</span>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMine = msg.sender_id === profile?.id
          const prevMsg = messages[i - 1]
          const showSender = !isMine && msg.sender_id !== prevMsg?.sender_id

          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[75%] px-3 py-2 rounded-xl text-sm relative"
                style={{
                  background: isMine ? '#005c4b' : '#202c33',
                  color: '#e9edef',
                  borderRadius: isMine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                }}>
                {msg.content}
                <span className="text-right block mt-0.5" style={{ fontSize: 10, color: '#8696a0' }}>
                  {formatTime(msg.created_at)}
                </span>
              </div>
            </div>
          )
        })}
        {messages.length === 0 && !loadingMessages && (
          <div className="flex flex-col items-center justify-center flex-1 gap-2" style={{ color: '#8696a0' }}>
            <p className="text-sm">Comenzá la conversación</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-3" style={{ background: '#202c33' }}>
        <input
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
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-40"
          style={{ background: '#00a884' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>
    </div>
  )
}

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
