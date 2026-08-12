import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import ContactPage from './ContactPage'
import CallPage from './CallPage'
import GroupInfoPage from './GroupInfoPage'
import { useContactStatus, formatLastSeen } from '../hooks/useContactStatus'
import { supabase } from '../lib/supabase'
import { sounds } from '../lib/sounds'
import { C } from '../App'

const EMOJI_CATS = [
  { id: 'recientes', label: '🕐', title: 'Recientes', emojis: [] },
  { id: 'caritas',   label: '😀', title: 'Caritas',   emojis: ['😀','😁','😂','🤣','😃','😄','😅','😆','😇','😈','😉','😊','😋','😌','😍','😎','😏','😐','😑','😒','😓','😔','😕','😖','😗','😘','😙','😚','😛','😜','😝','😞','😟','😠','😡','😢','😣','😤','😥','😦','😧','😨','😩','😪','😫','😬','😭','😮','😯','😰','😱','😲','😳','😴','😵','😶','😷','🤐','🤑','🤒','🤓','🤔','🤕','🤗','🤘','🤙','🤚','🤛','🤜','🤝','🤞','🤟','🤠','🤡','🤢','🤣','🤤','🤥','🤦','🤧','🤨','🤩','🤪','🤫','🤬','🤭','🤮','🤯','🥰','🥱','🥲','🥳','🥴','🥵','🥶','🥸','🥹','🥺','🫠','🫡','🫣','🫤','🫥','🫦','🫨','🙂','🙃','🙄','🙁','🙂‍↔️','☺️','😺','😸','😹','😻','😼','😽','🙀','😿','😾'] },
  { id: 'gente',     label: '👋', title: 'Gente',     emojis: ['👋','🤚','🖐','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🙏','🤝','💅','🤳','💪','🦾','🦵','🦶','👂','🦻','👃','👣','👀','👁','🫦','👄','🦷','👅','🫀','🫁','🧠','🦴','💋','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧕','👮','🕵','💂','🥷','👷','🫅','🤴','👸','👳','👲','🧙','🧚','🧛','🧜','🧝','🧞','🧟','🧌','💆','💇','🚶','🧍','🧎','🏃','💃','🕺','🧖','🧗','🏇','🏋','🤸','🤼','🤽','🤾','🤺','🏊','🏄','🚴','🧘'] },
  { id: 'natura',    label: '🌱', title: 'Naturaleza', emojis: ['🌱','🌲','🌳','🌴','🌵','🌾','🌿','☘️','🍀','🍁','🍂','🍃','🪨','🪵','🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🪲','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿','🌸','🌺','🌻','🌹','🌷','🌼','💐','🍄','🌰','🦔'] },
  { id: 'comida',    label: '🍔', title: 'Comida',    emojis: ['🍎','🍊','🍋','🍇','🍓','🫐','🍈','🍉','🍑','🍒','🍍','🥭','🍌','🍐','🍏','🫒','🥑','🍅','🥝','🍆','🥦','🥬','🥒','🌶','🫑','🧄','🧅','🥔','🌽','🥕','🧇','🍞','🥐','🥖','🫓','🥨','🧀','🍳','🥚','🥓','🥞','🧈','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🌮','🌯','🫔','🥙','🧆','🥚','🍜','🍝','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🫘','🍯','🧃','🥤','🧋','☕','🍵','🫖','🍺','🍻','🥂','🍷','🫗','🥃','🍸','🍹','🧉','🍾'] },
  { id: 'viajes',    label: '✈️', title: 'Viajes',    emojis: ['🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍','🛵','🚲','🛴','🛹','🛼','🚁','🛸','✈️','🛩','🚀','🛶','⛵','🚤','🛥','🚢','⚓','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚝','🚞','🚋','🚌','🚍','🚎','🚐','🚑','🚒','🛑','🚗','🚙','🏎','🚓','🚕','🚖','🚘','🚔','🛻','🌍','🌎','🌏','🗺','🧭','🏔','⛰','🌋','🗻','🏕','🏖','🏜','🏝','🏞','🏟','🏛','🏗','🧱','🏘','🏚','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🕍','⛩','🕋','⛲','⛺','🌁','🌃','🌄','🌅','🌆','🌇','🌉','♨️','🎠','🛝','🎡','🎢','🌌','🌠','🎆','🎇','🗿'] },
  { id: 'deporte',   label: '⚽', title: 'Deporte',   emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🥍','🏑','🏏','🪃','🥅','⛳','🪁','🎿','🛷','🥌','🎯','🪀','🪁','🎱','🏆','🥇','🥈','🥉','🏅','🎖','🏵','🎗','🎫','🎟','🎪','🤹','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🎲','♟','🎮','🎰','🧩','🪄','🎳','🎣','🤿','🎽','🥊','🥋','🤸','⛷','🏂','🪂','🏋','🤼','🤺','🏇','🚵','🏌','🧗','🏄','🚴','🤾','🏊','🧘','🏄'] },
  { id: 'objetos',   label: '💡', title: 'Objetos',   emojis: ['💡','🔦','🕯','🪔','🧯','🛢','💰','💴','💵','💶','💷','💸','💳','🪙','💹','📈','📉','📊','📋','📌','📍','🗂','📁','📂','🗃','🗄','🗑','🔒','🔓','🔏','🔐','🔑','🗝','🔨','🪓','⛏','⚒','🛠','🗡','⚔','🛡','🪚','🔧','🪛','🔩','⚙️','🗜','⚖️','🦯','🔗','⛓','🪝','🧲','🔫','💣','🪤','🧨','🪬','🪄','🔮','🎱','🧿','🪬','🧸','🪆','🖼','🪞','🪟','🛋','🪑','🚽','🪠','🚿','🛁','🪤','🧹','🧺','🧻','🪣','🧼','🫧','🪥','🧴','🧷','🧹','🧺','✂️','🪡','🧵','🧶','📿','💎','👓','🕶','🥽','🌂','☂️','🧵','🧶','🪡'] },
  { id: 'simbolos',  label: '❤️', title: 'Símbolos',  emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','❗','❓','‼️','⁉️','🔅','🔆','✅','☑️','✔️','❎','🔱','⚜️','🔰','♻️','✅','🔄','🔃','☀️','🌟','⭐','🌙','⚡','🌈','🎵','🎶','💫','✨','🎊','🎉','🎈'] },
]
// flat default for backwards compat
const EMOJIS = EMOJI_CATS[1].emojis.slice(0, 31)

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
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const audioRef = useRef(null)
  // Static waveform bars (decorative — real waveform requires Web Audio decoding)
  const bars = [0.3,0.6,0.9,0.5,1,0.7,0.4,0.8,0.6,1,0.5,0.7,0.9,0.4,0.6,0.8,0.5,1,0.3,0.7,0.9,0.5,0.6,0.4,0.8,1,0.6,0.4,0.7,0.5]

  useEffect(() => {
    const a = new Audio(src)
    audioRef.current = a
    a.onloadedmetadata = () => setDuration(a.duration || 0)
    a.ontimeupdate = () => {
      setCurrent(a.currentTime)
      setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0)
    }
    a.onended = () => { setPlaying(false); setProgress(0); setCurrent(0); a.currentTime = 0 }
    return () => { a.pause(); audioRef.current = null }
  }, [src])

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play(); setPlaying(true) }
  }

  function seek(e) {
    const a = audioRef.current
    if (!a || !a.duration) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left
    a.currentTime = (x / r.width) * a.duration
  }

  function cycleSpeed() {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1
    setSpeed(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const accent = isMine ? C.green : '#60a5fa'
  const playedBars = Math.floor((progress / 100) * bars.length)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 210, padding: '2px 0' }}>
      {/* Play/pause */}
      <button onClick={toggle} style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: `${accent}22`, border: `1.5px solid ${accent}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        transition: 'transform .12s',
      }}
        onTouchStart={e => e.currentTarget.style.transform = 'scale(0.9)'}
        onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {playing
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill={accent}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          : <svg width="13" height="13" viewBox="0 0 24 24" fill={accent}><path d="M8 5v14l11-7z"/></svg>
        }
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {/* Waveform bars + scrub */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 2, height: 28, cursor: 'pointer' }}
          onClick={seek} onTouchStart={seek}
        >
          {bars.map((h, i) => (
            <div key={i} style={{
              flex: 1, borderRadius: 2,
              height: `${Math.max(20, h * 100)}%`,
              background: i < playedBars ? accent : `${accent}35`,
              transition: 'background .1s',
              animation: playing && i >= playedBars ? `wfPlay ${0.6 + i * 0.04}s ease-in-out ${i * 0.03}s infinite alternate` : 'none',
            }} />
          ))}
        </div>
        {/* Timer + speed */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: C.textDim, fontVariantNumeric: 'tabular-nums' }}>
            {fmtDuration(playing || current > 0 ? Math.floor(current) : Math.floor(duration))}
          </span>
          <button onClick={cycleSpeed} style={{
            fontSize: 10, color: accent, background: `${accent}15`,
            border: `1px solid ${accent}30`, borderRadius: 8,
            padding: '1px 6px', cursor: 'pointer', fontWeight: 700,
          }}>{speed}×</button>
        </div>
      </div>
      <style>{`@keyframes wfPlay{0%{transform:scaleY(.7)}100%{transform:scaleY(1)}}`}</style>
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

const REACTION_EMOJIS = ['👍','❤️','😂','🔥','⚽','🏆','😮','👏']

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ChatPage({ onBack }) {
  const { profile } = useAuthStore()
  const { activeConversation, messages, loadingMessages, fetchMessages, sendMessage, subscribeToMessages, markAsRead, uploadImage, deleteMessage, reactToMessage, fetchReactions, editMessage, forwardMessage } = useChatStore()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [emojiCat, setEmojiCat] = useState('caritas')
  const [emojiSearch, setEmojiSearch] = useState('')
  const [recentEmojis, setRecentEmojis] = useState(() => {
    try { return JSON.parse(localStorage.getItem('recentEmojis') || '[]') } catch { return [] }
  })
  const [replyTo, setReplyTo] = useState(null)
  const [longPressMsg, setLongPressMsg] = useState(null)
  const [hoveredMsg, setHoveredMsg] = useState(null)
  const [deleteMenuMsg, setDeleteMenuMsg] = useState(null) // messageId showing delete submenu

  // "Delete for me" stored in localStorage per user
  const deletedForMeKey = `dfm_${profile?.id}`
  const [deletedForMe, setDeletedForMe] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`dfm_${profile?.id}`) || '[]')) }
    catch { return new Set() }
  })
  function deleteForMe(msgId) {
    setDeletedForMe(prev => {
      const next = new Set(prev); next.add(msgId)
      localStorage.setItem(deletedForMeKey, JSON.stringify([...next]))
      return next
    })
    setDeleteMenuMsg(null); setLongPressMsg(null)
  }
  function deleteForAll(msgId) {
    deleteMessage(msgId, activeConversation.id)
    setDeleteMenuMsg(null); setLongPressMsg(null)
  }
  const [showContact, setShowContact] = useState(false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [call, setCall] = useState(null)
  const [pinnedDismissed, setPinnedDismissed] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(null) // messageId
  const [editingMsg, setEditingMsg] = useState(null) // { id, content }
  const [editText, setEditText] = useState('')
  const [forwardMsg, setForwardMsg] = useState(null) // message to forward
  const [viewOncePending, setViewOncePending] = useState(null) // { file, type } waiting for view count pick
  const [recording, setRecording] = useState(false) // 'hold' | 'locked' | false
  const [recDuration, setRecDuration] = useState(0)
  const [recCancelling, setRecCancelling] = useState(false)
  const [recLocked, setRecLocked] = useState(false)
  const recorderRef = useRef(null)
  const recChunks = useRef([])
  const recTimer = useRef(null)
  const recStartY = useRef(0)
  const recStartX = useRef(0)
  const recCancelledRef = useRef(false)
  const micBtnRef = useRef(null)

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
    fetchMessages(activeConversation.id).then(() => {
      const ids = messages.map(m => m.id)
      if (ids.length) fetchReactions(ids)
    })
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

  function insertEmoji(em) {
    setText(t => t + em)
    const next = [em, ...recentEmojis.filter(x => x !== em)].slice(0, 24)
    setRecentEmojis(next)
    try { localStorage.setItem('recentEmojis', JSON.stringify(next)) } catch {}
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

  async function handleEditSave() {
    if (!editingMsg || !editText.trim()) return
    await editMessage(editingMsg.id, editText.trim())
    setEditingMsg(null); setEditText('')
  }

  async function handleForward(conv) {
    if (!forwardMsg || !conv) return
    await forwardMessage(forwardMsg.conversation_id, conv.id, profile.id, forwardMsg.content, forwardMsg.type || 'text')
    setForwardMsg(null)
    sounds.msgSent()
  }

  async function handleImagePick(e) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('Máximo 10MB'); return }
    fileRef.current.value = ''
    // Show view-once picker before uploading
    const type = file.type.startsWith('video/') ? 'video' : 'image'
    setViewOncePending({ file, type })
  }

  async function sendWithViewCount(file, type, maxViews) {
    setViewOncePending(null)
    setUploadingImage(true)
    try {
      const url = await uploadImage(file, profile.id)
      await sendMessage(activeConversation.id, profile.id, url, type, maxViews || null)
      sounds.msgSent()
    } catch (err) { alert(`Error: ${err.message}`) }
    setUploadingImage(false)
  }

  async function startRecording(e) {
    e?.preventDefault()
    if (recording) return
    recCancelledRef.current = false
    const touch = e?.touches?.[0]
    recStartX.current = touch?.clientX ?? e?.clientX ?? 0
    recStartY.current = touch?.clientY ?? e?.clientY ?? 0
    try { navigator.vibrate?.(30) } catch (_) {}
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
        .find(t => MediaRecorder.isTypeSupported(t)) || ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      recChunks.current = []
      recorder.ondataavailable = ev => { if (ev.data.size > 0) recChunks.current.push(ev.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (recCancelledRef.current) return // cancelled — discard
        const type = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(recChunks.current, { type })
        if (blob.size < 500) return
        setUploadingImage(true)
        try {
          const ext = type.includes('mp4') || type.includes('m4a') ? 'm4a' : 'webm'
          const file = new File([blob], `voice-${Date.now()}.${ext}`, { type })
          const url = await uploadImage(file, profile.id)
          await sendMessage(activeConversation.id, profile.id, url, 'audio')
          sounds.msgSent()
        } catch (err) { alert(`Error al enviar audio: ${err.message}`) }
        setUploadingImage(false)
      }
      recorder.start(250)
      recorderRef.current = recorder
      setRecording(true); setRecLocked(false); setRecCancelling(false); setRecDuration(0)
      let s = 0
      recTimer.current = setInterval(() => setRecDuration(++s), 1000)
    } catch (_) { alert('No se pudo acceder al micrófono.') }
  }

  function onRecordingMove(e) {
    if (!recording || recLocked) return
    const touch = e?.touches?.[0]
    const cx = touch?.clientX ?? e?.clientX ?? 0
    const cy = touch?.clientY ?? e?.clientY ?? 0
    const dx = recStartX.current - cx  // swipe left → cancel
    const dy = recStartY.current - cy  // swipe up → lock
    if (dy > 60) { lockRecording(); return }
    setRecCancelling(dx > 40)
  }

  function lockRecording() {
    try { navigator.vibrate?.(40) } catch (_) {}
    setRecLocked(true); setRecCancelling(false)
  }

  function cancelRecording() {
    try { navigator.vibrate?.(60) } catch (_) {}
    recCancelledRef.current = true
    recorderRef.current?.stop()
    clearInterval(recTimer.current)
    setRecording(false); setRecLocked(false); setRecCancelling(false); setRecDuration(0)
  }

  function stopRecording() {
    recorderRef.current?.stop()
    clearInterval(recTimer.current)
    setRecording(false); setRecLocked(false); setRecCancelling(false); setRecDuration(0)
  }

  function onRecordingEnd() {
    // released finger without locking
    if (recLocked) return
    if (recCancelling) { cancelRecording() } else { stopRecording() }
  }

  const grouped = groupByDate(messages.filter(m => !deletedForMe.has(m.id)))
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

  if (showGroupInfo && isGroup) return (
    <GroupInfoPage
      conversation={activeConversation}
      onBack={() => setShowGroupInfo(false)}
      onLeft={() => { setShowGroupInfo(false); onBack() }}
    />
  )

  return (
    <>
      {/* Call overlay — renders on top of chat without leaving the page */}
      {call && (
        <CallPage
          conversationId={activeConversation?.id}
          myUserId={profile?.id}
          contact={otherUser}
          callType={call.type}
          isIncoming={false}
          onEnd={() => setCall(null)}
        />
      )}

      {showContact && !isGroup && (
        <ContactPage user={otherUser} onBack={() => setShowContact(false)} onChat={() => setShowContact(false)} />
      )}

      {/* ── View-once picker modal ── */}
      {viewOncePending && (
        <div onClick={() => setViewOncePending(null)} style={{
          position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#141E24', borderRadius: 22, padding: '28px 24px', width: 300,
            boxShadow: '0 12px 48px rgba(0,0,0,0.7)', border: `1px solid ${C.border}`,
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            {/* Preview thumbnail */}
            {viewOncePending.type === 'image' && (
              <img src={URL.createObjectURL(viewOncePending.file)} alt="preview"
                style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 12, opacity: 0.9 }} />
            )}
            {viewOncePending.type === 'video' && (
              <div style={{ textAlign: 'center', padding: '16px 0', color: C.textDim, fontSize: 13 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill={C.green}><path d="M8 5v14l11-7z"/></svg>
                <div>{viewOncePending.file.name}</div>
              </div>
            )}
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, textAlign: 'center' }}>
              ¿Cuántas veces se puede ver?
            </div>
            <div style={{ color: C.textDim, fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>
              Después de verlo {'{n}'} vez, se borra para siempre.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => sendWithViewCount(viewOncePending.file, viewOncePending.type, n)} style={{
                  flex: 1, padding: '14px 0', borderRadius: 14, border: `1.5px solid ${C.green}`,
                  background: 'transparent', color: C.green, fontWeight: 700, fontSize: 18, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  transition: 'background .15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = `${C.green}22`}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {n}
                  <span style={{ fontSize: 10, color: C.textDim, fontWeight: 400 }}>
                    {n === 1 ? 'vez' : 'veces'}
                  </span>
                </button>
              ))}
            </div>
            <button onClick={() => sendWithViewCount(viewOncePending.file, viewOncePending.type, null)} style={{
              background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 12,
              color: C.textDim, fontSize: 13, padding: '10px 0', cursor: 'pointer',
            }}>
              Sin límite de vistas
            </button>
            <button onClick={() => setViewOncePending(null)} style={{
              background: 'transparent', border: 'none', color: C.textDim, fontSize: 13, cursor: 'pointer',
            }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {/* ── Edit message modal ── */}
      {editingMsg && (
        <div onClick={() => setEditingMsg(null)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#141E24', borderRadius: 20, padding: '24px 20px', width: 320, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>✏️ Editar mensaje</div>
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              autoFocus
              rows={3}
              style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, padding: '10px 12px', resize: 'none', outline: 'none', lineHeight: 1.5 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditingMsg(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
              <button onClick={handleEditSave} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: C.green, color: C.bg, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Forward message modal ── */}
      {forwardMsg && (
        <div onClick={() => setForwardMsg(null)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#141E24', borderRadius: '20px 20px 0 0', padding: '20px 16px', width: '100%', maxWidth: 480, border: `1px solid ${C.border}`, maxHeight: '70vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>↗ Reenviar a...</div>
            <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {useChatStore.getState().conversations.filter(c => c.id !== activeConversation?.id).map(conv => (
                <button key={conv.id} onClick={() => handleForward(conv)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 12,
                  cursor: 'pointer', color: C.text, textAlign: 'left',
                }}>
                  <div style={{ width: 38, height: 38, borderRadius: conv.isGroup ? 10 : '50%', background: C.greenDk, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {(conv.name || conv.user?.display_name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 14 }}>{conv.name || conv.user?.display_name || conv.user?.username}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setForwardMsg(null)} style={{ padding: '10px 0', borderRadius: 12, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
          </div>
        </div>
      )}

      <div
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: C.bg2, overflow: 'hidden' }}
        onClick={() => { setLongPressMsg(null); setShowEmoji(false); setDeleteMenuMsg(null) }}
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
            onClick={() => isGroup ? setShowGroupInfo(true) : setShowContact(true)}
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

                if (msg.is_deleted) return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 4 }}>
                    <span style={{
                      fontSize: 12, fontStyle: 'italic', color: C.textDim,
                      padding: '5px 12px', background: C.panel, borderRadius: 10,
                      border: `1px solid ${C.border}`,
                    }}>🚫 Mensaje eliminado</span>
                  </div>
                )

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
                    style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: isLast ? 8 : 2, alignItems: 'flex-end', gap: 7, position: 'relative' }}
                    onMouseEnter={() => setHoveredMsg(msg.id)}
                    onMouseLeave={() => { setHoveredMsg(null) }}
                    onMouseDown={() => { longPressTimer.current = setTimeout(() => setLongPressMsg(msg), 500) }}
                    onMouseUp={() => clearTimeout(longPressTimer.current)}
                    onTouchStart={() => { longPressTimer.current = setTimeout(() => setLongPressMsg(msg), 500) }}
                    onTouchEnd={() => clearTimeout(longPressTimer.current)}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Hover action buttons — desktop (mis mensajes) */}
                    {isMine && hoveredMsg === msg.id && !msg.is_deleted && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, position: 'relative' }}>
                        <HoverBtn title="Responder" onClick={() => { setReplyTo(msg); inputRef.current?.focus() }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17H5v-4"/><path d="M5 13A10 10 0 0 1 19 13"/></svg>
                        </HoverBtn>
                        <HoverBtn title="Reaccionar" onClick={() => setShowReactionPicker(msg.id)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                        </HoverBtn>
                        <div style={{ position: 'relative' }}>
                          <HoverBtn title="Eliminar" danger onClick={() => setDeleteMenuMsg(deleteMenuMsg === msg.id ? null : msg.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                          </HoverBtn>
                          {deleteMenuMsg === msg.id && (
                            <DeleteMenu
                              onForMe={() => deleteForMe(msg.id)}
                              onForAll={() => deleteForAll(msg.id)}
                              right
                            />
                          )}
                        </div>
                      </div>
                    )}

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

                      {/* Reaction picker */}
                      {showReactionPicker === msg.id && (
                        <div
                          style={{
                            position: 'absolute', zIndex: 40,
                            bottom: 'calc(100% + 4px)',
                            [isMine ? 'right' : 'left']: 0,
                            background: C.panel, borderRadius: 40,
                            display: 'flex', gap: 2, padding: '6px 10px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                            border: `1px solid ${C.border}`,
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          {REACTION_EMOJIS.map(em => (
                            <button key={em} onClick={() => { reactToMessage(msg.id, profile.id, em); setShowReactionPicker(null); setLongPressMsg(null) }}
                              style={{ fontSize: 22, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: 8, transition: 'transform .1s' }}
                              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                            >{em}</button>
                          ))}
                        </div>
                      )}

                      {/* Context menu */}
                      {longPressMsg?.id === msg.id && (
                        <div
                          style={{
                            position: 'absolute', zIndex: 30,
                            bottom: 'calc(100% + 6px)',
                            [isMine ? 'right' : 'left']: 0,
                            background: C.panel, borderRadius: 12,
                            display: 'flex', flexDirection: 'column', gap: 2, padding: '6px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                            border: `1px solid ${C.border}`,
                            minWidth: 160,
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <CtxBtn label="😀 Reaccionar" onClick={() => { setShowReactionPicker(msg.id); setLongPressMsg(null) }} />
                          <CtxBtn label="↩ Responder" onClick={() => { setReplyTo(msg); setLongPressMsg(null); inputRef.current?.focus() }} />
                          {isMine && !msg.is_deleted && (msg.type === 'text' || !msg.type) && (
                            <CtxBtn label="✏️ Editar" onClick={() => { setEditingMsg(msg); setEditText(msg.content); setLongPressMsg(null) }} />
                          )}
                          <CtxBtn label="↗ Reenviar" onClick={() => { setForwardMsg(msg); setLongPressMsg(null) }} />
                          <CtxBtn label="📋 Copiar" onClick={() => { navigator.clipboard.writeText(msg.content); setLongPressMsg(null) }} />
                          {isGroup && (
                            <CtxBtn label="📌 Fijar mensaje" onClick={() => {
                              useChatStore.getState().pinMessage(activeConversation.id, msg.content?.slice(0, 200))
                              setLongPressMsg(null)
                            }} />
                          )}
                          {isMine ? (
                            <>
                              <CtxBtn label="🙈 Eliminar para mí" onClick={() => { deleteForMe(msg.id); setLongPressMsg(null) }} />
                              <CtxBtn label="🗑 Eliminar para todos" danger onClick={() => { deleteMessage(msg.id, activeConversation.id); setLongPressMsg(null) }} />
                            </>
                          ) : (
                            <CtxBtn label="🙈 Eliminar para mí" onClick={() => { deleteForMe(msg.id); setLongPressMsg(null) }} />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Reactions display */}
                    {msg.reactions?.length > 0 && (() => {
                      const grouped = msg.reactions.reduce((acc, r) => {
                        acc[r.emoji] = (acc[r.emoji] || 0) + 1
                        return acc
                      }, {})
                      return (
                        <div style={{
                          display: 'flex', flexWrap: 'wrap', gap: 4,
                          marginTop: 4, justifyContent: isMine ? 'flex-end' : 'flex-start',
                        }}>
                          {Object.entries(grouped).map(([em, count]) => (
                            <button key={em} onClick={() => reactToMessage(msg.id, profile.id, em)} style={{
                              background: `${C.green}18`, border: `1px solid ${C.green}33`,
                              borderRadius: 12, padding: '2px 7px', cursor: 'pointer',
                              fontSize: 13, display: 'flex', alignItems: 'center', gap: 3,
                              color: C.text2,
                            }}>
                              {em} <span style={{ fontSize: 11 }}>{count}</span>
                            </button>
                          ))}
                        </div>
                      )
                    })()}

                    {isMine && <div style={{ width: 30, flexShrink: 0 }} />}

                    {/* Hover action buttons — ajenos */}
                    {!isMine && hoveredMsg === msg.id && !msg.is_deleted && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, position: 'relative' }}>
                        <HoverBtn title="Responder" onClick={() => { setReplyTo(msg); inputRef.current?.focus() }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17H5v-4"/><path d="M5 13A10 10 0 0 1 19 13"/></svg>
                        </HoverBtn>
                        <HoverBtn title="Reaccionar" onClick={() => setShowReactionPicker(msg.id)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                        </HoverBtn>
                        <div style={{ position: 'relative' }}>
                          <HoverBtn title="Eliminar para mí" danger onClick={() => setDeleteMenuMsg(deleteMenuMsg === msg.id ? null : msg.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                          </HoverBtn>
                          {deleteMenuMsg === msg.id && (
                            <DeleteMenu
                              onForMe={() => deleteForMe(msg.id)}
                              onlyForMe
                            />
                          )}
                        </div>
                      </div>
                    )}
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

        {/* ── EMOJI PICKER (WhatsApp style) ── */}
        {showEmoji && (() => {
          const activeCat = EMOJI_CATS.find(c => c.id === emojiCat) || EMOJI_CATS[1]
          const emojisToShow = emojiSearch.trim()
            ? EMOJI_CATS.flatMap(c => c.emojis).filter(e => true) // simple: show all on search
                .filter((e, i, a) => a.indexOf(e) === i) // dedupe
            : emojiCat === 'recientes'
              ? recentEmojis
              : activeCat.emojis
          const filtered = emojiSearch.trim()
            ? EMOJI_CATS.flatMap(c => c.emojis).filter((e, i, a) => a.indexOf(e) === i)
            : emojisToShow
          return (
          <div style={{
            background: C.panel, borderTop: `1px solid ${C.border}`,
            flexShrink: 0, display: 'flex', flexDirection: 'column',
            height: 280, animation: 'emojiSlideUp .22s ease',
          }} onClick={e => e.stopPropagation()}>

            {/* Search bar */}
            <div style={{ padding: '8px 12px 4px', flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: C.panel2, borderRadius: 12, padding: '7px 12px',
                border: `1px solid ${C.border}`,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  value={emojiSearch}
                  onChange={e => setEmojiSearch(e.target.value)}
                  placeholder="Buscar emoji..."
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 13 }}
                />
                {emojiSearch && <button onClick={() => setEmojiSearch('')} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>}
              </div>
            </div>

            {/* Category tabs */}
            {!emojiSearch && (
              <div style={{ display: 'flex', gap: 2, padding: '4px 10px', flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {EMOJI_CATS.map(cat => (
                  <button key={cat.id} onClick={() => setEmojiCat(cat.id)} style={{
                    flexShrink: 0, fontSize: 18, padding: '5px 7px', borderRadius: 10,
                    background: emojiCat === cat.id ? `${C.green}20` : 'none',
                    border: emojiCat === cat.id ? `1.5px solid ${C.green}50` : '1.5px solid transparent',
                    cursor: 'pointer', transition: 'background .15s',
                    lineHeight: 1,
                  }} title={cat.title}>{cat.label}</button>
                ))}
              </div>
            )}

            {/* Category label */}
            {!emojiSearch && (
              <div style={{ padding: '2px 14px 4px', flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {activeCat.title}
                </span>
              </div>
            )}

            {/* Emoji grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px 8px', scrollbarWidth: 'thin' }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', color: C.textDim, fontSize: 13, paddingTop: 24 }}>
                  {emojiCat === 'recientes' ? 'No hay emojis recientes' : 'Sin resultados'}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}>
                  {filtered.map((em, i) => (
                    <button key={em + i}
                      onClick={() => { insertEmoji(em); inputRef.current?.focus() }}
                      style={{
                        fontSize: 22, padding: '6px 4px', borderRadius: 10,
                        background: 'none', border: 'none', cursor: 'pointer',
                        transition: 'background .1s, transform .1s',
                        lineHeight: 1.2,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.panel2; e.currentTarget.style.transform = 'scale(1.2)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.transform = 'none' }}
                      onTouchStart={e => e.currentTarget.style.background = C.panel2}
                      onTouchEnd={e => e.currentTarget.style.background = 'none'}
                    >{em}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          )
        })()}
        <style>{`@keyframes emojiSlideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>

        {/* ── RECORDING BAR (locked mode) ── */}
        {recLocked && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
            background: C.panel, borderTop: `1px solid ${C.border}`, flexShrink: 0,
            animation: 'recSlideUp .2s ease',
          }} onClick={e => e.stopPropagation()}>
            {/* Cancel */}
            <button onClick={cancelRecording} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px',
              color: C.red, fontSize: 13, fontWeight: 600, borderRadius: 8,
              transition: 'background .15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = `${C.red}15`}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >✕ Cancelar</button>

            {/* Waveform + timer */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.red, flexShrink: 0, animation: 'recPulse 1s ease infinite' }} />
              <span style={{ color: C.red, fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 36 }}>
                {fmtDuration(recDuration)}
              </span>
              {/* Animated bars */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 24, overflow: 'hidden' }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} style={{
                    flex: 1, borderRadius: 2, background: C.red,
                    opacity: 0.6,
                    animation: `recWave ${0.5 + Math.random() * 0.4}s ease-in-out ${i * 0.05}s infinite alternate`,
                    height: `${30 + Math.random() * 70}%`,
                  }} />
                ))}
              </div>
            </div>

            {/* Send */}
            <button onClick={stopRecording} style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
              background: C.green, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 16px ${C.green}55`,
              transition: 'transform .12s',
            }}
              onTouchStart={e => e.currentTarget.style.transform = 'scale(0.9)'}
              onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={C.bg}><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>
            </button>
          </div>
        )}
        <style>{`
          @keyframes recPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.8)}}
          @keyframes recWave{0%{transform:scaleY(.3)}100%{transform:scaleY(1)}}
          @keyframes recSlideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        `}</style>

        {/* ── INPUT BAR ── */}
        {!recLocked && (
          <form onSubmit={handleSend} style={{
            display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 12px 10px',
            background: C.panel, borderTop: `1px solid ${C.border}`, flexShrink: 0,
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          }} onClick={e => e.stopPropagation()}>
            <input type="file" accept="image/*,video/*,application/pdf,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" ref={fileRef} onChange={handleImagePick} style={{ display: 'none' }} />

            {/* Attach btn */}
            <button type="button" onClick={() => fileRef.current?.click()} style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: C.panel2, border: `1px solid ${C.border}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color .15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.green}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>

            {/* Emoji btn */}
            <button type="button" onClick={() => { setShowEmoji(v => !v); setLongPressMsg(null) }} style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              fontSize: 18, background: showEmoji ? `${C.green}22` : C.panel2,
              border: `1px solid ${showEmoji ? C.green : C.border}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>😊</button>

            {/* Text input / recording indicator */}
            <div style={{
              flex: 1, background: recording ? `${C.red}10` : C.panel2, borderRadius: 22,
              display: 'flex', alignItems: 'center', padding: '0 14px',
              minHeight: 42, border: `1px solid ${recording ? C.red + '60' : C.border}`,
              transition: 'border-color .2s, background .2s',
              overflow: 'hidden',
            }}>
              {recording ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.red, animation: 'recPulse 1s ease infinite', flexShrink: 0 }} />
                  <span style={{ color: C.red, fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(recDuration)}</span>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, height: 20 }}>
                    {Array.from({ length: 16 }).map((_, i) => (
                      <div key={i} style={{ flex: 1, borderRadius: 2, background: recCancelling ? C.red : C.green, opacity: 0.7, animation: `recWave ${0.4 + i * 0.06}s ease-in-out ${i * 0.04}s infinite alternate`, height: `${25 + (i % 3) * 25}%` }} />
                    ))}
                  </div>
                </div>
              ) : (
                <input
                  ref={inputRef} type="text" placeholder="Escribe un mensaje..." value={text}
                  onChange={e => { setText(e.target.value); handleTyping() }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSend(e) }}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 14, padding: '9px 0' }}
                  autoFocus
                />
              )}
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
                {/* Mic button — hold to record */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {/* Slide-to-cancel / lock hints (shown while holding) */}
                  {recording && !recLocked && (
                    <div style={{
                      position: 'absolute', right: 52, top: '50%', transform: 'translateY(-50%)',
                      display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                      background: C.panel, border: `1px solid ${C.border}`,
                      borderRadius: 20, padding: '5px 12px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                      animation: 'recHintIn .2s ease',
                      pointerEvents: 'none',
                    }}>
                      <span style={{ fontSize: 12, color: recCancelling ? C.red : C.textDim }}>
                        {recCancelling ? '🗑 Soltá para cancelar' : '← Deslizá para cancelar'}
                      </span>
                    </div>
                  )}
                  {recording && !recLocked && (
                    <div style={{
                      position: 'absolute', bottom: 52, right: 0,
                      background: C.panel, border: `1px solid ${C.border}`,
                      borderRadius: 20, padding: '6px 10px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                      pointerEvents: 'none',
                      animation: 'recHintIn .2s ease',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    }}>
                      <span style={{ fontSize: 14 }}>🔒</span>
                      <span style={{ fontSize: 10, color: C.textDim }}>↑ Fijar</span>
                    </div>
                  )}
                  <button
                    ref={micBtnRef}
                    type="button"
                    onMouseDown={startRecording}
                    onMouseUp={onRecordingEnd}
                    onMouseLeave={e => { if (recording && !recLocked) onRecordingEnd() }}
                    onMouseMove={onRecordingMove}
                    onTouchStart={startRecording}
                    onTouchMove={onRecordingMove}
                    onTouchEnd={onRecordingEnd}
                    style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: recording ? (recCancelling ? C.red : `${C.green}dd`) : C.green,
                      border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: recording ? `0 0 0 8px ${recCancelling ? C.red : C.green}22, 0 4px 16px ${C.green}55` : `0 4px 16px ${C.green}55`,
                      transform: recording ? 'scale(1.12)' : 'scale(1)',
                      transition: 'background .15s, box-shadow .15s, transform .15s',
                      userSelect: 'none', WebkitUserSelect: 'none',
                    }}>
                    {recording
                      ? <div style={{ width: 8, height: 8, borderRadius: 2, background: '#fff', animation: 'recPulse .8s ease infinite' }} />
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill={C.bg}>
                          <path d="M12 1c-1.66 0-3 1.34-3 3v8c0 1.66 1.34 3 3 3s3-1.34 3-3V4c0-1.66-1.34-3-3-3zm5.3 9c0 3-2.54 5.1-5.3 5.1S6.7 13 6.7 10H5c0 3.41 2.72 6.23 6 6.72V20h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                        </svg>
                    }
                  </button>
                </div>
                <style>{`@keyframes recHintIn{from{opacity:0;transform:translateY(-50%) scale(.9)}to{opacity:1;transform:translateY(-50%) scale(1)}}`}</style>
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
      {msg.edited_at && <span style={{ fontSize: 9, opacity: 0.7 }}>editado · </span>}
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

function DeleteMenu({ onForMe, onForAll, onlyForMe, right }) {
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute', zIndex: 50,
        bottom: 'calc(100% + 6px)',
        [right ? 'right' : 'left']: 0,
        background: '#141E24',
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        border: '1px solid #1C292F',
        minWidth: 200,
      }}
    >
      <div style={{ padding: '8px 14px 6px', borderBottom: '1px solid #1C292F22' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#667078', letterSpacing: '1px', textTransform: 'uppercase' }}>
          Eliminar mensaje
        </p>
      </div>
      <button onClick={onForMe} style={{
        width: '100%', padding: '11px 16px', background: 'none', border: 'none',
        cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
        transition: 'background .1s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = '#FF3B3015'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <span style={{ fontSize: 16 }}>🙈</span>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#FF3B30' }}>Eliminar para mí</p>
          <p style={{ margin: '1px 0 0', fontSize: 11, color: '#667078' }}>Solo vos dejás de verlo</p>
        </div>
      </button>
      {!onlyForMe && (
        <button onClick={onForAll} style={{
          width: '100%', padding: '11px 16px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
          transition: 'background .1s', borderTop: '1px solid #1C292F22',
        }}
          onMouseEnter={e => e.currentTarget.style.background = '#FF3B3015'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span style={{ fontSize: 16 }}>🗑</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#FF3B30' }}>Eliminar para todos</p>
            <p style={{ margin: '1px 0 0', fontSize: 11, color: '#667078' }}>Se borra para todos los participantes</p>
          </div>
        </button>
      )}
    </div>
  )
}

function HoverBtn({ children, onClick, danger, title }) {
  return (
    <button
      title={title}
      onClick={e => { e.stopPropagation(); onClick() }}
      style={{
        width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`,
        background: C.panel, cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: danger ? C.red : C.text2, transition: 'all .1s', flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? `${C.red}20` : C.panel2; e.currentTarget.style.color = danger ? C.red : C.green }}
      onMouseLeave={e => { e.currentTarget.style.background = C.panel; e.currentTarget.style.color = danger ? C.red : C.text2 }}
    >{children}</button>
  )
}

function CtxBtn({ label, onClick, danger }) {
  const col = danger ? C.red : C.text2
  const hov = danger ? C.red : C.green
  return (
    <button onClick={onClick} style={{
      fontSize: 13, padding: '8px 12px', borderRadius: 8,
      color: col, background: 'none',
      border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
      textAlign: 'left', width: '100%',
      transition: 'background .1s',
    }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? `${C.red}15` : `${C.green}10`; e.currentTarget.style.color = hov }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = col }}
    >{label}</button>
  )
}
