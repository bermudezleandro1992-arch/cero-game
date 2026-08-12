import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import ContactPage from './ContactPage'
import CallPage from './CallPage'
import { useContactStatus, formatLastSeen } from '../hooks/useContactStatus'
import { supabase } from '../lib/supabase'
import { sounds } from '../lib/sounds'
import { C } from '../App'

const EMOJIS = ['😀','😂','❤️','👍','🔥','😍','🥺','😭','🙏','✅','💯','😎','🤣','😊','🎉','👏','🤔','😅','😢','💪','🫡','⚡','🏆','⚽','🎮','🔥','💀','🙌','🤝','🎯','👀']

const SENDER_COLORS = ['#e91e63','#ab47bc','#1e88e5','#00acc1','#43a047','#fb8c00','#e53935']
function senderColor(id) {
  if (!id) return SENDER_COLORS[0]
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length]
}

function groupByDate(messages) {
  const groups = []; let cur = null
  for (const msg of messages) {
    const date = msg.created_at?.slice(0, 10)
    if (!cur || cur.date !== date) { cur = { date, msgs: [] }; groups.push(cur) }
    cur.msgs.push(msg)
  }
  return groups
}

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDuration(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ── Role badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  if (!role || role === 'jugador') return null
  const cfg = {
    admin:      { label: 'Admin',      color: C.green,  bg: `${C.green}18` },
    moderador:  { label: 'Mod',        color: C.yellow, bg: `${C.yellow}18` },
  }[role.toLowerCase()] || null
  if (!cfg) return null
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`,
      marginLeft: 5, letterSpacing: '.5px', verticalAlign: 'middle',
    }}>{cfg.label.toUpperCase()}</span>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 32, color, url }) {
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1.5px solid ${C.border}` }} />
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color || C.panel2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: 700, color: '#fff', flexShrink: 0,
      border: `1.5px solid ${C.border}`,
    }}>
      {name?.slice(0, 2).toUpperCase() || '?'}
    </div>
  )
}

// ── Ticks ─────────────────────────────────────────────────────────────────────
function Ticks({ read }) {
  return (
    <svg width="14" height="9" viewBox="0 0 16 11" fill="none" style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 3 }}>
      <path d="M1 5.5L5 9.5L11 2" stroke={read ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5.5L9 9.5L15 2" stroke={read ? C.green : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Date separator ────────────────────────────────────────────────────────────
function DateSeparator({ dateStr }) {
  const d = new Date(dateStr), now = new Date()
  const y = new Date(now); y.setDate(y.getDate() - 1)
  const label = d.toDateString() === now.toDateString() ? 'Hoy'
    : d.toDateString() === y.toDateString() ? 'Ayer'
    : d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 1, background: `${C.border}66` }} />
      <span style={{
        fontSize: 11, padding: '3px 12px', borderRadius: 20,
        background: C.panel, color: C.textDim, border: `1px solid ${C.border}`,
        letterSpacing: '.5px',
      }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: `${C.border}66` }} />
    </div>
  )
}

// ── Audio player ──────────────────────────────────────────────────────────────
function AudioPlayer({ src, isMine }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audio = useRef(null)

  useEffect(() => {
    audio.current = new Audio(src)
    audio.current.onloadedmetadata = () => setDuration(Math.round(audio.current.duration))
    audio.current.ontimeupdate = () => {
      const p = (audio.current.currentTime / audio.current.duration) * 100
      setProgress(isNaN(p) ? 0 : p)
    }
    audio.current.onended = () => { setPlaying(false); setProgress(0) }
    return () => { audio.current.pause(); audio.current = null }
  }, [src])

  function toggle() {
    if (!audio.current) return
    if (playing) { audio.current.pause(); setPlaying(false) }
    else { audio.current.play(); setPlaying(true) }
  }

  const btnColor = isMine ? C.green : C.text2
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 190, padding: '2px 0' }}>
      <button onClick={toggle} style={{
        background: isMine ? `${C.green}22` : `${C.text2}18`,
        border: `1px solid ${btnColor}44`, borderRadius: '50%',
        width: 34, height: 34, display: 'flex', alignItems: 'center',
        justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
      }}>
        {playing
          ? <svg width="11" height="11" viewBox="0 0 24 24" fill={btnColor}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          : <svg width="11" height="11" viewBox="0 0 24 24" fill={btnColor}><path d="M8 5v14l11-7z"/></svg>
        }
      </button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{ height: 3, background: `${btnColor}30`, borderRadius: 2, cursor: 'pointer', position: 'relative' }}
          onClick={e => {
            const r = e.currentTarget.getBoundingClientRect()
            if (audio.current) audio.current.currentTime = ((e.clientX - r.left) / r.width) * audio.current.duration
          }}>
          <div style={{ width: `${progress}%`, height: '100%', background: btnColor, borderRadius: 2, transition: 'width .1s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, color: C.textDim }}>🎤 Audio</span>
          <span style={{ fontSize: 9, color: C.textDim }}>{fmtDuration(duration)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Pinned message banner ─────────────────────────────────────────────────────
function PinnedBanner({ text, onDismiss }) {
  if (!text) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px', background: C.panel,
      borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      cursor: 'pointer',
    }}>
      <div style={{ width: 3, alignSelf: 'stretch', background: C.green, borderRadius: 3, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 10, color: C.green, fontWeight: 700, letterSpacing: '.5px' }}>📌 MENSAJE FIJADO</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</p>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 14 }}>✕</button>
      )}
    </div>
  )
}

// ── Msg skeleton ──────────────────────────────────────────────────────────────
function MsgSkeleton() {
  return (
    <div style={{ padding: '4px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: i % 2 === 0 ? 'flex-start' : 'flex-end' }}>
          <div className="skeleton" style={{ height: 38, width: `${40 + (i * 13) % 30}%`, borderRadius: 12 }} />
        </div>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
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
  const [call, setCall] = useState(null)
  const [pinnedDismissed, setPinnedDismissed] = useState(false)
  // Recording
  const [recording, setRecording] = useState(false)
  const [recDuration, setRecDuration] = useState(0)
  const recorderRef = useRef(null)
  const recChunks = useRef([])
  const recTimer = useRef(null)

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

  const prevMsgCount = useRef(0)
  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      const last = messages[messages.length - 1]
      if (last?.sender_id !== profile?.id) sounds.msgReceived()
    }
    prevMsgCount.current = messages.length
  }, [messages])

  // Presence broadcast
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
    try {
      await sendMessage(activeConversation.id, profile.id, content, 'text')
      sounds.msgSent()
    } catch (err) { alert(`Error: ${err.message}`); setText(content) }
    setSending(false)
    inputRef.current?.focus()
  }

  async function handleImagePick(e) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('Máximo 10MB'); return }
    setUploadingImage(true)
    try {
      const url = await uploadImage(file, profile.id)
      const type = file.type.startsWith('video/') ? 'video' : 'image'
      await sendMessage(activeConversation.id, profile.id, url, type)
      sounds.msgSent()
    } catch (err) { alert(`Error: ${err.message}`) }
    setUploadingImage(false); fileRef.current.value = ''
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })
      recChunks.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) recChunks.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(recChunks.current, { type: mimeType })
        if (blob.size < 500) return
        setUploadingImage(true)
        try {
          const ext = mimeType.includes('mp4') ? 'm4a' : 'webm'
          const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType })
          const url = await uploadImage(file, profile.id)
          await sendMessage(activeConversation.id, profile.id, url, 'audio')
          sounds.msgSent()
        } catch (err) { alert(`Error al enviar audio: ${err.message}`) }
        setUploadingImage(false)
      }
      recorder.start(100)
      recorderRef.current = recorder
      setRecording(true)
      let s = 0
      recTimer.current = setInterval(() => setRecDuration(++s), 1000)
    } catch (e) { alert('No se pudo acceder al micrófono.') }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    clearInterval(recTimer.current)
    setRecording(false); setRecDuration(0)
  }

  const grouped = groupByDate(messages)
  const memberMap = {}
  activeConversation?.members?.forEach(m => { if (m) memberMap[m.id] = m })
  if (otherUser) memberMap[otherUser.id] = otherUser

  const displayName = isGroup ? groupName : otherUser?.display_name || 'Usuario'
  const statusText = isGroup
    ? `${(activeConversation?.members?.length || 0) + 1} participantes`
    : isTyping ? 'Escribiendo...'
    : formatLastSeen(lastSeen, isOnline)

  // Pinned message (first pinned message in conversation metadata)
  const pinnedText = activeConversation?.pinned_message || null

  if (call) return (
    <CallPage
      conversationId={activeConversation?.id}
      myUserId={profile?.id}
      contact={otherUser}
      callType={call.type}
      isIncoming={false}
      onEnd={() => setCall(null)}
    />
  )

  return (
    <>
      {showContact && !isGroup && (
        <ContactPage user={otherUser} onBack={() => setShowContact(false)} onChat={() => setShowContact(false)} />
      )}
      <div
        style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg2, overflow: 'hidden' }}
        onClick={() => { setLongPressMsg(null); setShowEmoji(false) }}
      >

        {/* ── HEADER ── */}
        <div style={{
          background: C.panel, display: 'flex', alignItems: 'center',
          padding: '8px 12px', gap: 10, flexShrink: 0,
          borderBottom: `1px solid ${C.border}`,
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        }}>
          <button onClick={onBack} style={{
            color: C.text2, padding: '6px 8px 6px 4px', background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', borderRadius: 8,
            transition: 'color .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = C.green}
            onMouseLeave={e => e.currentTarget.style.color = C.text2}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <button
            onClick={() => !isGroup && setShowContact(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ position: 'relative' }}>
              <Avatar name={displayName} size={40} color={isGroup ? C.greenDk : senderColor(otherUser?.id)} url={!isGroup ? otherUser?.avatar_url : null} />
              {isOnline && !isGroup && (
                <span style={{
                  position: 'absolute', bottom: 1, right: 1, width: 11, height: 11,
                  borderRadius: '50%', background: C.green,
                  border: `2px solid ${C.panel}`,
                  boxShadow: `0 0 8px ${C.green}`,
                }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: C.text, fontWeight: 700, fontSize: 15, margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </p>
              <p style={{
                margin: '2px 0 0', fontSize: 12,
                color: isTyping ? C.green : isOnline ? C.green : C.textDim,
                fontWeight: isOnline || isTyping ? 500 : 400,
              }}>
                {statusText}
              </p>
            </div>
          </button>

          {/* Call buttons */}
          {!isGroup && (
            <div style={{ display: 'flex', gap: 2 }}>
              <HdrBtn title="Llamada" onClick={() => setCall({ type: 'audio' })}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={C.text2}>
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
              </HdrBtn>
              <HdrBtn title="Video" onClick={() => setCall({ type: 'video' })}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill={C.text2}>
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
              </HdrBtn>
            </div>
          )}
        </div>

        {/* Pinned message */}
        {pinnedText && !pinnedDismissed && (
          <PinnedBanner text={pinnedText} onDismiss={() => setPinnedDismissed(true)} />
        )}

        {/* ── MESSAGES ── */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '10px 12px',
          display: 'flex', flexDirection: 'column',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%231C292F' fill-opacity='0.15' fill-rule='evenodd'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")`,
        }}>
          {loadingMessages && <MsgSkeleton />}

          {!loadingMessages && grouped.map(({ date, msgs }) => (
            <div key={date}>
              <DateSeparator dateStr={date} />
              {msgs.map((msg, i) => {
                const isMine  = msg.sender_id === profile?.id
                const isSystem = msg.type === 'system'
                const prevMsg = msgs[i - 1]
                const nextMsg = msgs[i + 1]
                const isFirst = msg.sender_id !== prevMsg?.sender_id
                const isLast  = msg.sender_id !== nextMsg?.sender_id
                const senderInfo = msg.sender || memberMap[msg.sender_id]
                const senderName = senderInfo?.display_name || 'Usuario'
                const senderRole = senderInfo?.role
                const isReply = msg.content?.startsWith('[↩ ')

                if (isSystem) return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                    <span style={{
                      fontSize: 11, padding: '3px 14px', borderRadius: 20,
                      background: C.panel, color: C.textDim, border: `1px solid ${C.border}`,
                    }}>{msg.content}</span>
                  </div>
                )

                const br = isMine
                  ? (isFirst && isLast ? '14px 4px 14px 14px' : isFirst ? '14px 4px 4px 14px' : isLast ? '14px 14px 4px 14px' : '14px 4px 4px 14px')
                  : (isFirst && isLast ? '4px 14px 14px 14px' : isFirst ? '4px 14px 14px 4px' : isLast ? '4px 14px 14px 4px' : '4px 14px 14px 4px')

                // Sent: dark green gradient. Received: panel2
                const bubbleBg = isMine
                  ? `linear-gradient(135deg, #0D2918 0%, #12351F 100%)`
                  : C.panel2
                const bubbleBorder = isMine ? `1px solid #1a4a2a` : `1px solid ${C.border}`

                return (
                  <div
                    key={msg.id}
                    className="msg-in"
                    style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: isLast ? 8 : 2, alignItems: 'flex-end', gap: 7 }}
                    onMouseDown={() => { longPressTimer.current = setTimeout(() => setLongPressMsg(msg), 400) }}
                    onMouseUp={() => clearTimeout(longPressTimer.current)}
                    onTouchStart={() => { longPressTimer.current = setTimeout(() => setLongPressMsg(msg), 400) }}
                    onTouchEnd={() => clearTimeout(longPressTimer.current)}
                    onClick={e => e.stopPropagation()}
                  >
                    {!isMine && (
                      <div style={{ width: 30, flexShrink: 0 }}>
                        {isLast && <Avatar name={senderName} size={30} color={senderColor(msg.sender_id)} url={senderInfo?.avatar_url} />}
                      </div>
                    )}

                    <div style={{ maxWidth: 'min(78%, 480px)', position: 'relative' }}>
                      {!isMine && isFirst && (
                        <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 3px 2px', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: senderRole === 'admin' ? C.green : senderColor(msg.sender_id) }}>
                            {senderName}
                          </span>
                          <RoleBadge role={senderRole} />
                          {!isGroup && senderInfo?.username && (
                            <span style={{ color: C.textDim, fontWeight: 400 }}>@{senderInfo.username}</span>
                          )}
                        </p>
                      )}

                      <div style={{
                        background: bubbleBg,
                        borderRadius: br,
                        padding: msg.type === 'image' ? '4px' : '7px 11px 5px',
                        color: C.text, fontSize: 14, lineHeight: 1.45,
                        boxShadow: isMine ? '0 2px 8px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.3)',
                        wordBreak: 'break-word',
                        border: bubbleBorder,
                      }}>
                        {isReply && (() => {
                          const lines = msg.content.split('\n')
                          const quote = lines[0].replace('[↩ ', '').replace(']', '')
                          const body = lines.slice(1).join('\n')
                          return (
                            <>
                              <div style={{
                                padding: '5px 8px', marginBottom: 6, borderRadius: 6,
                                borderLeft: `3px solid ${C.green}`, background: `${C.green}0A`,
                                fontSize: 12, color: C.text2,
                              }}>{quote}</div>
                              <MsgBody msg={{ ...msg, content: body }} isMine={isMine} otherLastRead={otherLastRead} />
                            </>
                          )
                        })()}
                        {!isReply && <MsgBody msg={msg} isMine={isMine} otherLastRead={otherLastRead} />}
                      </div>

                      {/* Context menu */}
                      {longPressMsg?.id === msg.id && (
                        <div
                          style={{
                            position: 'absolute', zIndex: 30,
                            bottom: 'calc(100% + 6px)',
                            [isMine ? 'right' : 'left']: 0,
                            background: C.panel, borderRadius: 12,
                            display: 'flex', gap: 4, padding: '5px 7px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                            border: `1px solid ${C.border}`,
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <CtxBtn label="↩ Responder" onClick={() => { setReplyTo(msg); setLongPressMsg(null); inputRef.current?.focus() }} />
                          <CtxBtn label="📋 Copiar" onClick={() => { navigator.clipboard.writeText(msg.content); setLongPressMsg(null) }} />
                        </div>
                      )}
                    </div>

                    {isMine && <div style={{ width: 30, flexShrink: 0 }} />}
                  </div>
                )
              })}
            </div>
          ))}

          {!loadingMessages && messages.length === 0 && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 10, color: C.textDim, paddingTop: 60, textAlign: 'center',
            }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: `${C.green}0A`, border: `1.5px solid ${C.green}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
              }}>⚡</div>
              <p style={{ margin: 0, fontSize: 14, color: C.text2 }}>{isGroup ? '¡Rompé el hielo!' : 'Comenzá la conversación'}</p>
              <p style={{ margin: 0, fontSize: 11, color: C.textDim }}>Competí · Conectá · Ganá</p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── REPLY BAR ── */}
        {replyTo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
            background: C.panel, borderLeft: `4px solid ${C.green}`, flexShrink: 0,
            borderTop: `1px solid ${C.border}`,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.green }}>
                {replyTo.sender?.display_name || 'Usuario'}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {replyTo.type === 'image' ? '📷 Imagen' : replyTo.type === 'audio' ? '🎤 Audio' : replyTo.content}
              </p>
            </div>
            <button onClick={() => setReplyTo(null)} style={{ color: C.textDim, background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* ── EMOJI PICKER ── */}
        {showEmoji && (
          <div
            style={{
              display: 'flex', flexWrap: 'wrap', gap: 6, padding: '12px 14px',
              background: C.panel, borderTop: `1px solid ${C.border}`, flexShrink: 0,
            }}
            onClick={e => e.stopPropagation()}
          >
            {EMOJIS.map(em => (
              <button key={em}
                onClick={() => { setText(t => t + em); setShowEmoji(false); inputRef.current?.focus() }}
                style={{
                  fontSize: 21, background: 'none', border: 'none', cursor: 'pointer',
                  padding: '3px', borderRadius: 6, transition: 'transform .1s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.25)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >{em}</button>
            ))}
          </div>
        )}

        {/* ── RECORDING BAR ── */}
        {recording && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            background: C.panel, borderTop: `1px solid ${C.border}`, flexShrink: 0,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.red, animation: 'recPulse 1s ease infinite' }} />
            <span style={{ color: C.text, fontSize: 14, flex: 1 }}>Grabando... {fmtDuration(recDuration)}</span>
            <button onClick={stopRecording} style={{
              background: C.green, border: 'none', borderRadius: '50%',
              width: 38, height: 38, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 12px ${C.green}55`,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill={C.bg}><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
            </button>
            <style>{`@keyframes recPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.8)}}`}</style>
          </div>
        )}

        {/* ── INPUT BAR ── */}
        {!recording && (
          <form onSubmit={handleSend} style={{
            display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 12px 10px',
            background: C.panel, borderTop: `1px solid ${C.border}`, flexShrink: 0,
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          }} onClick={e => e.stopPropagation()}>
            <input type="file" accept="image/*,video/*" ref={fileRef} onChange={handleImagePick} style={{ display: 'none' }} />

            {/* Emoji btn */}
            <button type="button" onClick={() => { setShowEmoji(v => !v); setLongPressMsg(null) }} style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              fontSize: 18, background: showEmoji ? `${C.green}22` : C.panel2,
              border: `1px solid ${showEmoji ? C.green : C.border}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>😊</button>

            {/* Text input */}
            <div style={{
              flex: 1, background: C.panel2, borderRadius: 22,
              display: 'flex', alignItems: 'center', padding: '0 14px',
              minHeight: 42, border: `1px solid ${C.border}`,
              transition: 'border-color .2s',
            }}>
              <input
                ref={inputRef} type="text" placeholder="Escribe un mensaje..." value={text}
                onChange={e => { setText(e.target.value); handleTyping() }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSend(e) }}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: C.text, fontSize: 14, padding: '9px 0',
                }}
                autoFocus
              />
            </div>

            {/* Send / media / mic */}
            {text.trim() ? (
              <button type="submit" disabled={sending} style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                background: C.green, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: sending ? 0.5 : 1,
                boxShadow: `0 4px 16px ${C.green}55`,
                transition: 'transform .1s, box-shadow .1s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill={C.bg}><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingImage} style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: C.panel2, border: `1px solid ${C.border}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: uploadingImage ? 0.5 : 1,
                }}>
                  {uploadingImage
                    ? <span style={{ color: C.textDim, fontSize: 11 }}>...</span>
                    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.text2} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  }
                </button>
                <button type="button"
                  onMouseDown={startRecording} onTouchStart={startRecording}
                  style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: C.green, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 4px 16px ${C.green}55`,
                  }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={C.bg}>
                    <path d="M12 1c-1.66 0-3 1.34-3 3v8c0 1.66 1.34 3 3 3s3-1.34 3-3V4c0-1.66-1.34-3-3-3zm5.3 9c0 3-2.54 5.1-5.3 5.1S6.7 13 6.7 10H5c0 3.41 2.72 6.23 6 6.72V20h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                  </svg>
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </>
  )
}

// ── MsgBody ───────────────────────────────────────────────────────────────────
function MsgBody({ msg, isMine, otherLastRead }) {
  const time = (
    <span style={{
      fontSize: 10, color: isMine ? `${C.green}99` : C.textDim,
      marginLeft: 6, whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: 1, verticalAlign: 'bottom',
    }}>
      {formatTime(msg.created_at)}
      {isMine && <Ticks read={otherLastRead && otherLastRead > msg.created_at} />}
    </span>
  )
  if (msg.type === 'image') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <img src={msg.content} alt="" onClick={() => window.open(msg.content, '_blank')}
        style={{ borderRadius: 10, maxWidth: '100%', maxHeight: 300, objectFit: 'cover', cursor: 'pointer', display: 'block' }} loading="lazy" />
      <div style={{ textAlign: 'right', paddingRight: 4 }}>{time}</div>
    </div>
  )
  if (msg.type === 'audio') return (
    <div>
      <AudioPlayer src={msg.content} isMine={isMine} />
      <div style={{ textAlign: 'right', marginTop: 2 }}>{time}</div>
    </div>
  )
  return <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}{time}</span>
}

function HdrBtn({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 38, height: 38, borderRadius: '50%', background: 'none',
      border: 'none', cursor: 'pointer', color: C.text2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background .15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = C.panel2}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >{children}</button>
  )
}

function CtxBtn({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 12, padding: '6px 10px', borderRadius: 8,
      color: C.text2, background: C.panel2,
      border: `1px solid ${C.border}`, cursor: 'pointer', whiteSpace: 'nowrap',
      transition: 'color .15s, border-color .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.color = C.green; e.currentTarget.style.borderColor = C.green }}
      onMouseLeave={e => { e.currentTarget.style.color = C.text2; e.currentTarget.style.borderColor = C.border }}
    >{label}</button>
  )
}
