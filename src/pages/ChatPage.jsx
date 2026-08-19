import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import ContactPage from './ContactPage'
import CallPage from './CallPage'
import GroupCallPage from './GroupCallPage'
import GroupInfoPage from './GroupInfoPage'
import CommunityTournamentsPanel from './CommunityTournamentsPanel'
import { useContactStatus, formatLastSeen } from '../hooks/useContactStatus'
import { supabase } from '../lib/supabase'
import { sounds } from '../lib/sounds'
import { acquireWakeLock } from '../lib/appStartup'
import { useCallStore } from '../store/callStore'
import { detectSpam, applyAutoSanction, checkSanction, reportMessage, sanctionMessage } from '../lib/antispam'
import { C } from '../theme'

// ── Support bot trigger ────────────────────────────────────────────────────────
const SUPABASE_FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL || 'https://gxberqtxbnrnudawwyzd.supabase.co')
  .replace('supabase.co', 'supabase.co/functions/v1')
const SUPPORT_BOT_SECRET = import.meta.env.VITE_SUPPORT_BOT_SECRET || ''

let _supportGroupId = undefined // undefined = not fetched; null = not set

async function getSupportGroupId() {
  if (_supportGroupId !== undefined) return _supportGroupId
  try {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'support_group_id').single()
    _supportGroupId = data?.value ?? null
  } catch { _supportGroupId = null }
  return _supportGroupId
}

async function triggerSupportBot(conversationId, senderId, content, messageId) {
  try {
    const supportGroupId = await getSupportGroupId()
    if (!supportGroupId || conversationId !== supportGroupId) return
    fetch(`${SUPABASE_FUNCTIONS_URL}/support-bot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPPORT_BOT_SECRET}` },
      body: JSON.stringify({ conversation_id: conversationId, sender_id: senderId, content, message_id: messageId }),
    }).catch(() => {})
  } catch {}
}

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

const TENOR_KEY_V2 = import.meta.env.VITE_TENOR_KEY || ''

const STICKER_PACKS = [
  { id: 'fiestas',   label: '🎉', title: 'Fiestas',    stickers: ['🎉','🎊','🥳','🏆','🔥','💯','⭐','✨','🎯','🌟','🥂','🍾','👑','🎈','🎁','🎀','🏅','💎','🎆','🎇'] },
  { id: 'deportes',  label: '⚽', title: 'Deportes',   stickers: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🏆','🥇','🥈','🥉','🏃','💪','🤸','⛷','🏊','🚴','🤺','🎽','🥊'] },
  { id: 'mood',      label: '😎', title: 'Mood',       stickers: ['😎','🤙','🤔','😤','🥱','😍','🤣','🫡','💀','🙄','🫠','😭','🤯','🥴','😱','🫶','🤡','👻','🫥','😴'] },
  { id: 'vibes',     label: '🌈', title: 'Vibes',      stickers: ['🌈','🌙','☀️','🌊','🎵','🎮','🍕','☕','🌸','🌺','🦋','🐬','🦁','🦄','🌴','🍀','🌋','❄️','🌀','🎭'] },
  { id: 'reacciones',label: '💅', title: 'Reacciones', stickers: ['💅','🫵','👀','👁️','🤌','💁','🙋','🤷','🤦','👏','🫂','🤝','✌️','🫶','🙌','💪','🦾','🫳','🫴','🙏'] },
]

const CHAT_BG_PRESETS = [
  { id: 'default', label: 'Por defecto',  gradient: null, color: null },
  { id: 'forest',  label: 'Bosque',       gradient: 'linear-gradient(160deg,#061a10 0%,#0d2818 60%,#061a10 100%)' },
  { id: 'ocean',   label: 'Océano',       gradient: 'linear-gradient(160deg,#05101e 0%,#0a1f40 60%,#051018 100%)' },
  { id: 'sunset',  label: 'Atardecer',    gradient: 'linear-gradient(160deg,#1a0520 0%,#2a0e18 50%,#1a1208 100%)' },
  { id: 'aurora',  label: 'Aurora',       gradient: 'linear-gradient(160deg,#050d1a 0%,#0a1f15 35%,#0e0d20 65%,#050d1a 100%)' },
  { id: 'cosmos',  label: 'Cosmos',       gradient: 'linear-gradient(160deg,#080810 0%,#12082a 50%,#080818 100%)' },
  { id: 'desert',  label: 'Desierto',     gradient: 'linear-gradient(160deg,#1a1005 0%,#2a1f08 50%,#1a1005 100%)' },
  { id: 'cherry',  label: 'Sakura',       gradient: 'linear-gradient(160deg,#1a0810 0%,#2a0818 50%,#1a0810 100%)' },
]

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

function normalizeTs(ts) {
  if (!ts) return ts
  if (!/Z|[+-]\d{2}:?\d{2}$/.test(ts)) return ts.replace(' ', 'T') + 'Z'
  return ts
}
function formatTime(ts) {
  if (!ts) return ''
  return new Date(normalizeTs(ts)).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDuration(s) {
  if (!isFinite(s) || isNaN(s) || s < 0) return '--:--'
  const sec = Math.floor(s)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
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
  const audioCtxRef = useRef(null)
  // Static waveform bars (decorative — real waveform requires Web Audio decoding)
  const bars = [0.3,0.6,0.9,0.5,1,0.7,0.4,0.8,0.6,1,0.5,0.7,0.9,0.4,0.6,0.8,0.5,1,0.3,0.7,0.9,0.5,0.6,0.4,0.8,1,0.6,0.4,0.7,0.5]

  useEffect(() => {
    if (!src) return
    const a = new Audio()
    a.crossOrigin = 'anonymous'
    a.preload = 'metadata'
    audioRef.current = a
    let durationFixed = false

    // Web Audio normalization: compressor + gain to keep consistent volume
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const source = ctx.createMediaElementSource(a)
      const compressor = ctx.createDynamicsCompressor()
      compressor.threshold.value = -24
      compressor.knee.value = 10
      compressor.ratio.value = 8
      compressor.attack.value = 0.003
      compressor.release.value = 0.15
      const gain = ctx.createGain()
      gain.gain.value = 1.4
      source.connect(compressor)
      compressor.connect(gain)
      gain.connect(ctx.destination)
      audioCtxRef.current = ctx
    } catch (_) {}

    a.onloadedmetadata = () => {
      if (isFinite(a.duration) && a.duration > 0) {
        durationFixed = true; setDuration(a.duration)
      } else {
        a.currentTime = 1e9  // WebM Infinity fix: seek to end to force duration calc
      }
    }
    a.onseeked = () => {
      if (!durationFixed && isFinite(a.duration) && a.duration > 0) {
        durationFixed = true; setDuration(a.duration); a.currentTime = 0
      }
    }
    a.ondurationchange = () => {
      if (!durationFixed && isFinite(a.duration) && a.duration > 0) {
        durationFixed = true; setDuration(a.duration)
        if (a.currentTime > 1000) a.currentTime = 0
      }
    }
    a.ontimeupdate = () => {
      if (!durationFixed) return
      setCurrent(a.currentTime)
      setProgress(a.duration > 0 ? (a.currentTime / a.duration) * 100 : 0)
    }
    a.onended = () => { setPlaying(false); setProgress(0); setCurrent(0); a.currentTime = 0 }
    a.onerror = () => {}
    a.src = src
    return () => {
      a.pause(); a.src = ''; audioRef.current = null
      audioCtxRef.current?.close(); audioCtxRef.current = null
    }
  }, [src])

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else {
      audioCtxRef.current?.resume()
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
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

  const accent = isMine ? C.green : C.text2
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
            {fmtDuration(playing || current > 0 ? current : duration)}
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

// ── Link Preview ──────────────────────────────────────────────────────────────
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/g

function LinkPreview({ text }) {
  const matches = text?.match(URL_REGEX)
  if (!matches) return null
  const url = matches[0]
  let domain = ''
  try { domain = new URL(url).hostname.replace('www.', '') } catch (_) { return null }

  const isYoutube = domain.includes('youtube.com') || domain.includes('youtu.be')
  const isTwitter = domain.includes('twitter.com') || domain.includes('x.com')
  const isInstagram = domain.includes('instagram.com')
  const isTwitch = domain.includes('twitch.tv')

  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`

  const ICONS = {
    youtube: '▶️', twitter: '🐦', instagram: '📸', twitch: '🎮',
  }
  const icon = isYoutube ? ICONS.youtube : isTwitter ? ICONS.twitter : isInstagram ? ICONS.instagram : isTwitch ? ICONS.twitch : null

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
      <div style={{
        marginTop: 6, padding: '8px 10px', borderRadius: 10,
        background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.25)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.15)'}
      >
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
          {icon
            ? <span style={{ fontSize: 16 }}>{icon}</span>
            : <img src={favicon} alt="" style={{ width: 18, height: 18 }} onError={e => { e.target.style.display='none' }} />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{domain}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{url.length > 50 ? url.slice(0, 50) + '…' : url}</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </div>
    </a>
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

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = 'Aceptar', danger = false }) {
  if (!open) return null
  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1a1a2e', borderRadius: 18, padding: '28px 24px 20px',
        maxWidth: 340, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
        border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {title && <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: '#fff' }}>{title}</p>}
        <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '11px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
            background: 'transparent', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '11px 0', borderRadius: 12, border: 'none',
            background: danger ? '#ef4444' : '#22c55e', color: '#fff',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ChatPage({ onBack }) {
  const { profile } = useAuthStore()
  const { activeConversation, messages, loadingMessages, fetchMessages, sendMessage, subscribeToMessages, markAsRead, uploadImage, deleteMessage, reactToMessage, fetchReactions, editMessage, forwardMessage, topics, activeTopicId, fetchTopics, createTopic, setActiveTopic } = useChatStore()
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
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedMsgs, setSelectedMsgs] = useState(new Set())

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
  function handleClearHistory() {
    setShowChatMenu(false)
    setConfirmDialog({
      title: 'Limpiar historial',
      message: 'Se borrarán todos los mensajes solo para vos.',
      danger: true, confirmLabel: 'Limpiar',
      onConfirm: async () => {
        setConfirmDialog(null)
        // Mark all visible messages as deleted-for-me locally
        const allIds = messages.map(m => m.id)
        setDeletedForMe(prev => {
          const next = new Set(prev); allIds.forEach(id => next.add(id))
          localStorage.setItem(deletedForMeKey, JSON.stringify([...next]))
          return next
        })
      },
    })
  }

  function handleDeleteChat() {
    setShowChatMenu(false)
    setConfirmDialog({
      title: 'Eliminar chat',
      message: '¿Eliminar este chat de tu lista?',
      danger: true, confirmLabel: 'Eliminar',
      onConfirm: async () => {
        setConfirmDialog(null)
        await supabase.rpc('leave_conversations', { conv_ids: [activeConversation.id] })
        onBack?.()
      },
    })
  }

  async function handleSetAutoDelete(hours) {
    setShowAutoDeletePicker(false)
    setShowChatMenu(false)
    setAutoDeleteHours(hours)
    await supabase.from('conversations')
      .update({ auto_delete_hours: hours })
      .eq('id', activeConversation.id)
  }

  const [showContact, setShowContact] = useState(false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [call, setCall] = useState(null)
  const [groupCall, setGroupCall] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [showStickerPicker, setShowStickerPicker] = useState(false)
  const [stickerPack, setStickerPack] = useState('fiestas')
  const [showPollModal, setShowPollModal] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [gifQuery, setGifQuery] = useState('')
  const [gifs, setGifs] = useState([])
  const [gifsLoading, setGifsLoading] = useState(false)
  const [pollQ, setPollQ] = useState('')
  const [pollOpts, setPollOpts] = useState(['', ''])
  const [evTitle, setEvTitle] = useState('')
  const [evDate, setEvDate] = useState('')
  const [evTime, setEvTime] = useState('')
  const [evPlace, setEvPlace] = useState('')
  const [chatBg, setChatBg] = useState(null)
  const [pinnedDismissed, setPinnedDismissed] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(null) // messageId
  const [editingMsg, setEditingMsg] = useState(null) // { id, content }
  const [editText, setEditText] = useState('')
  const [forwardMsg, setForwardMsg] = useState(null) // message to forward
  const [viewOncePending, setViewOncePending] = useState(null) // { file, type } waiting for view count pick
  const [showTopicsPanel, setShowTopicsPanel] = useState(false)
  const [showTournamentsPanel, setShowTournamentsPanel] = useState(false)
  const [showNewTopic, setShowNewTopic] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [newTopicEmoji, setNewTopicEmoji] = useState('💬')
  const [showChatMenu, setShowChatMenu] = useState(false)
  const [autoDeleteHours, setAutoDeleteHours] = useState(null)
  const [showAutoDeletePicker, setShowAutoDeletePicker] = useState(false)
  const [searchMode, setSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)
  const [mentionQuery, setMentionQuery] = useState(null) // string after @, or null
  const [mentionIndex, setMentionIndex] = useState(0)
  const [recording, setRecording] = useState(false)
  const [recDuration, setRecDuration] = useState(0)
  const [recCancelling, setRecCancelling] = useState(false)
  const [recLocked, setRecLocked] = useState(false)
  const recorderRef = useRef(null)
  const recChunks = useRef([])
  const recTimer = useRef(null)
  const recCancelledRef = useRef(false)
  const micBtnRef = useRef(null)

  const bottomRef = useRef(null)
  const initialScrollDone = useRef(false)
  const inputRef = useRef(null)
  const fileRef = useRef(null)
  const longPressTimer = useRef(null)

  useEffect(() => {
    if (!showChatMenu) return
    const h = () => setShowChatMenu(false)
    const t = setTimeout(() => document.addEventListener('click', h, { once: true }), 0)
    return () => { clearTimeout(t); document.removeEventListener('click', h) }
  }, [showChatMenu])

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

  // Presence broadcast — keep ref so typing reuses same subscribed channel
  const presenceChRef = useRef(null)
  useEffect(() => {
    if (!activeConversation?.id || isGroup) return
    const ch = supabase.channel(`nudge:${activeConversation.id}`)
    ch.on('broadcast', { event: 'nudge' }, ({ payload }) => {
      if (payload?.from !== profile?.id) sounds.nudge()
    }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeConversation?.id, isGroup])

  useEffect(() => {
    if (!activeConversation?.id || !profile?.id || isGroup) return
    const ch = supabase.channel(`contact-conv:${activeConversation.id}:${profile.id}`)
    const ping = () => ch.send({ type: 'broadcast', event: 'chat-presence', payload: { user_id: profile.id } })
    ch.subscribe(() => { presenceChRef.current = ch; ping() })
    const t = setInterval(ping, 20000)
    return () => {
      presenceChRef.current = null
      ch.send({ type: 'broadcast', event: 'chat-leave', payload: {} })
      clearInterval(t)
      supabase.removeChannel(ch)
    }
  }, [activeConversation?.id, profile?.id])

  useEffect(() => {
    if (!activeConversation?.id) return
    sounds.chatOpen()
    fetchMessages(activeConversation.id, activeTopicId).then(() => {
      const { messages: msgs } = useChatStore.getState()
      const ids = msgs.map(m => m.id)
      if (ids.length) fetchReactions(ids)
    })
    const unsub = subscribeToMessages(activeConversation.id)
    markAsRead(activeConversation.id, profile.id)
    if (activeConversation.isGroup) fetchTopics(activeConversation.id)
    return unsub
  }, [activeConversation?.id, activeTopicId])

  useEffect(() => {
    if (!messages.length) return
    const behavior = initialScrollDone.current ? 'smooth' : 'instant'
    initialScrollDone.current = true
    bottomRef.current?.scrollIntoView({ behavior })
    markAsRead(activeConversation?.id, profile?.id)
  }, [messages])

  const typingTimer = useRef(null)
  function handleTyping() {
    if (!activeConversation?.id || !profile?.id) return
    presenceChRef.current?.send({ type: 'broadcast', event: 'typing', payload: { user_id: profile.id } })
    clearTimeout(typingTimer.current)
  }

  // Members list for mention autocomplete
  const allMembers = [
    ...(activeConversation?.members || []),
    otherUser,
    profile,
  ].filter(Boolean).filter((m, i, arr) => arr.findIndex(x => x?.id === m?.id) === i)

  const mentionMatches = mentionQuery !== null
    ? allMembers.filter(m => m?.display_name?.toLowerCase().includes(mentionQuery.toLowerCase()) || m?.username?.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
    : []

  function handleTextChange(val) {
    setText(val)
    // Detect @mention
    const match = val.match(/@([\w ]*)$/)
    if (match) {
      setMentionQuery(match[1])
      setMentionIndex(0)
    } else {
      setMentionQuery(null)
    }
  }

  function insertMention(member) {
    const replaced = text.replace(/@([\w ]*)$/, `@${member.display_name} `)
    setText(replaced)
    setMentionQuery(null)
    inputRef.current?.focus()
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

    // ── Anti-spam check ──────────────────────────────────────
    const rawText = text.trim()

    // 1. Verificar si el usuario ya está sancionado
    const sanction = await checkSanction(profile.id)
    if (sanction?.sanctioned) {
      alert(sanctionMessage(sanction))
      setSending(false)
      return
    }

    // 2. Detectar spam en el contenido (solo en grupos)
    if (activeConversation?.isGroup) {
      const spam = detectSpam(rawText)
      if (spam) {
        // Reportar y aplicar sanción automática
        const result = await applyAutoSanction(profile.id, spam.detail, {
          message: rawText,
          conversation_id: activeConversation.id,
        })
        await reportMessage({
          reporterId:      profile.id,
          reportedUserId:  profile.id,
          conversationId:  activeConversation.id,
          reason:          spam.type,
          contentSnapshot: rawText,
        })
        const msg = sanctionMessage({ sanctioned: true, ...result })
        alert(`⚠️ Mensaje bloqueado.\n\n${msg || 'Tu mensaje fue bloqueado por spam.'}`)
        setSending(false)
        return
      }
    }
    // ── Fin anti-spam ────────────────────────────────────────

    const content = replyTo
      ? `[↩ ${replyTo.sender?.display_name}: ${replyTo.content?.slice(0, 40)}${replyTo.content?.length > 40 ? '…' : ''}]\n${rawText}`
      : rawText
    setReplyTo(null); setText('')
    try {
      const msg = await sendMessage(activeConversation.id, profile.id, content, 'text', null, activeTopicId)
      sounds.msgSent()
      // If this is the support group, trigger the support bot
      triggerSupportBot(activeConversation.id, profile.id, content, msg?.id)
    } catch (err) { alert(`Error: ${err.message}`); setText(content) }
    setSending(false)
    // On mobile: blur to dismiss keyboard after send; on desktop: keep focus
    if (window.innerWidth < 768) {
      inputRef.current?.blur()
    } else {
      inputRef.current?.focus()
    }
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

  // ── Chat backgrounds ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeConversation?.id) return
    try {
      const saved = localStorage.getItem(`chatBg:${activeConversation.id}`)
      setChatBg(saved ? JSON.parse(saved) : null)
    } catch { setChatBg(null) }
  }, [activeConversation?.id])

  function saveChatBg(bg) {
    setChatBg(bg)
    if (bg) localStorage.setItem(`chatBg:${activeConversation.id}`, JSON.stringify(bg))
    else localStorage.removeItem(`chatBg:${activeConversation.id}`)
    setShowBgPicker(false)
  }

  // ── GIFs ──────────────────────────────────────────────────────────────────
  async function fetchGifs(q) {
    setGifsLoading(true)
    try {
      let ep, isV2 = !!TENOR_KEY_V2
      if (isV2) {
        ep = q
          ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY_V2}&limit=24&media_filter=gif`
          : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY_V2}&limit=24&media_filter=gif`
      } else {
        ep = q
          ? `https://api.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=LIVDSRZULELA&limit=24&media_filter=minimal`
          : `https://api.tenor.com/v1/trending?key=LIVDSRZULELA&limit=24&media_filter=minimal`
      }
      const r = await fetch(ep)
      const d = await r.json()
      if (isV2) {
        setGifs(d.results || [])
      } else {
        setGifs((d.results || []).map(g => ({
          id: g.id, title: g.title || '',
          media_formats: {
            gif: { url: g.media?.[0]?.gif?.url || '' },
            tinygif: { url: g.media?.[0]?.tinygif?.url || '' },
          },
        })))
      }
    } catch { setGifs([]) }
    setGifsLoading(false)
  }

  function sendNudge() {
    if (!activeConversation?.id || !otherUser?.id) return
    sounds.nudge()
    supabase.channel(`nudge:${activeConversation.id}`).send({
      type: 'broadcast', event: 'nudge', payload: { from: profile.id },
    })
  }

  async function sendGif(url) {
    setShowGifPicker(false); setShowAttachMenu(false)
    await sendMessage(activeConversation.id, profile.id, url, 'gif')
    sounds.msgSent()
  }

  async function sendSticker(emoji) {
    setShowStickerPicker(false); setShowAttachMenu(false)
    await sendMessage(activeConversation.id, profile.id, emoji, 'sticker')
    sounds.msgSent()
  }

  async function sendPoll() {
    const question = pollQ.trim()
    const options = pollOpts.map(o => o.trim()).filter(Boolean)
    if (!question || options.length < 2) return
    const payload = JSON.stringify({ question, options })
    setPollQ(''); setPollOpts(['', '']); setShowPollModal(false)
    await sendMessage(activeConversation.id, profile.id, payload, 'poll')
    sounds.msgSent()
  }

  async function sendEvent() {
    const title = evTitle.trim()
    if (!title || !evDate) return
    const payload = JSON.stringify({ title, date: evDate, time: evTime, place: evPlace.trim() })
    setEvTitle(''); setEvDate(''); setEvTime(''); setEvPlace(''); setShowEventModal(false)
    await sendMessage(activeConversation.id, profile.id, payload, 'event')
    sounds.msgSent()
  }

  async function sendFile(file) {
    setShowAttachMenu(false)
    setUploadingImage(true)
    try {
      const url = await uploadImage(file, profile.id)
      const type = file.type.startsWith('video/') ? 'video'
        : file.type.startsWith('image/') ? 'image' : 'file'
      const meta = JSON.stringify({ name: file.name, size: file.size, mime: file.type, url })
      if (type === 'file') {
        await sendMessage(activeConversation.id, profile.id, meta, 'file')
      } else {
        await sendMessage(activeConversation.id, profile.id, url, type)
      }
      sounds.msgSent()
    } catch (err) { alert(`Error: ${err.message}`) }
    setUploadingImage(false)
  }

  async function handleImagePick(e) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 30 * 1024 * 1024) { alert('Máximo 30MB'); return }
    fileRef.current.value = ''
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const type = file.type.startsWith('video/') ? 'video' : 'image'
      setViewOncePending({ file, type })
    } else {
      await sendFile(file)
    }
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
    if (recorderRef.current || recording) return
    recCancelledRef.current = false
    try { navigator.vibrate?.(30) } catch (_) {}
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (recCancelledRef.current) { stream.getTracks().forEach(t => t.stop()); return }
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) || ''
      const recOpts = {}
      if (mimeType) recOpts.mimeType = mimeType
      // audioBitsPerSecond only for WebM/Ogg — iOS Safari mp4 ignores it and can corrupt audio
      if (mimeType.includes('webm') || mimeType.includes('ogg')) recOpts.audioBitsPerSecond = 128000
      const recorder = new MediaRecorder(stream, recOpts)
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
      recorder.start()  // no timeslice — iOS delivers all data on stop()
      recorderRef.current = recorder
      setRecording(true); setRecLocked(true); setRecCancelling(false); setRecDuration(0)
      let s = 0
      recTimer.current = setInterval(() => setRecDuration(++s), 1000)
    } catch (_) { alert('No se pudo acceder al micrófono.') }
  }

  function cancelRecording() {
    try { navigator.vibrate?.(60) } catch (_) {}
    recCancelledRef.current = true
    recorderRef.current?.stop()
    recorderRef.current = null
    clearInterval(recTimer.current)
    setRecording(false); setRecLocked(false); setRecCancelling(false); setRecDuration(0)
  }

  function stopRecording() {
    recorderRef.current?.stop()
    recorderRef.current = null
    clearInterval(recTimer.current)
    setRecording(false); setRecLocked(false); setRecCancelling(false); setRecDuration(0)
  }

  const filteredMessages = searchQuery
    ? messages.filter(m => !deletedForMe.has(m.id) && m.content?.toLowerCase?.().includes(searchQuery.toLowerCase()))
    : messages.filter(m => !deletedForMe.has(m.id))
  const grouped = groupByDate(filteredMessages)
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

  // Active topic metadata
  const activeTopic = activeTopicId ? topics.find(t => t.id === activeTopicId) : null
  const isAnnouncementTopic = activeTopic?.topic_type === 'announcements'

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
          myUserName={profile?.display_name || ''}
          contact={otherUser}
          callType={call.type}
          isIncoming={false}
          onEnd={() => { setCall(null); useCallStore.getState().setInCall(false) }}
          onAccept={() => { useCallStore.getState().setInCall(true); acquireWakeLock() }}
        />
      )}
      {groupCall && (
        <GroupCallPage
          conversationId={activeConversation?.id}
          myUserId={profile?.id}
          myName={profile?.display_name || 'Yo'}
          members={activeConversation?.members}
          onEnd={() => setGroupCall(false)}
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

      {/* ── Poll modal ── */}
      {showPollModal && (
        <div onClick={() => setShowPollModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#141E24', borderRadius: 20, padding: '22px 18px', width: '100%', maxWidth: 400, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>📊 Crear encuesta</div>
            <input
              value={pollQ} onChange={e => setPollQ(e.target.value)}
              placeholder="Pregunta..."
              style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, padding: '10px 12px', outline: 'none' }}
              autoFocus
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pollOpts.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    value={opt} onChange={e => { const n=[...pollOpts]; n[i]=e.target.value; setPollOpts(n) }}
                    placeholder={`Opción ${i + 1}...`}
                    style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, padding: '9px 12px', outline: 'none' }}
                  />
                  {pollOpts.length > 2 && (
                    <button onClick={() => setPollOpts(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 18, padding: '0 4px' }}>✕</button>
                  )}
                </div>
              ))}
              {pollOpts.length < 4 && (
                <button onClick={() => setPollOpts(p => [...p, ''])} style={{ background: 'none', border: `1px dashed ${C.border}`, borderRadius: 12, color: C.textDim, fontSize: 13, padding: '9px 0', cursor: 'pointer' }}>+ Agregar opción</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowPollModal(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
              <button onClick={sendPoll} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: C.green, color: C.bg, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>Enviar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Event modal ── */}
      {showEventModal && (
        <div onClick={() => setShowEventModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#141E24', borderRadius: 20, padding: '22px 18px', width: '100%', maxWidth: 400, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>📅 Crear evento</div>
            {[
              { ph: 'Título del evento...', val: evTitle, set: setEvTitle },
              { ph: 'Lugar (opcional)...', val: evPlace, set: setEvPlace },
            ].map(({ ph, val, set }) => (
              <input key={ph} value={val} onChange={e => set(e.target.value)} placeholder={ph}
                style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, padding: '10px 12px', outline: 'none' }} />
            ))}
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="date" value={evDate} onChange={e => setEvDate(e.target.value)}
                style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, padding: '10px 12px', outline: 'none' }} />
              <input type="time" value={evTime} onChange={e => setEvTime(e.target.value)}
                style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, padding: '10px 12px', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowEventModal(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
              <button onClick={sendEvent} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: C.green, color: C.bg, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>Enviar</button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: chatBg?.gradient ? 'transparent' : C.bg2, backgroundImage: chatBg?.gradient || 'none', overflow: 'hidden', position: 'relative' }}
        onClick={() => { setLongPressMsg(null); setShowEmoji(false); setDeleteMenuMsg(null); setShowAttachMenu(false); setShowBgPicker(false) }}
      >

        {/* ── COMMUNITY TOURNAMENTS PANEL (overlay) ── */}
        {activeConversation?.isCommunity && showTournamentsPanel && (
          <CommunityTournamentsPanel
            community={activeConversation}
            onClose={() => setShowTournamentsPanel(false)}
          />
        )}

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
              <HdrBtn title="Llamada" onClick={() => { useCallStore.getState().setInCall(true); setCall({ type: 'audio' }) }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={C.text2}>
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
              </HdrBtn>
              <HdrBtn title="Video" onClick={() => { useCallStore.getState().setInCall(true); setCall({ type: 'video' }) }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill={C.text2}>
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
              </HdrBtn>
            </div>
          )}
          {/* Group call button */}
          {isGroup && (
            <HdrBtn title="Llamada grupal" onClick={() => setGroupCall(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={C.text2}>
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
            </HdrBtn>
          )}
          {/* Topics button — only for groups */}
          {isGroup && (
            <HdrBtn title="Canales" onClick={() => setShowTopicsPanel(v => !v)}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={showTopicsPanel ? C.green : C.text2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </HdrBtn>
          )}
          {/* Tournaments button — only for communities */}
          {activeConversation?.isCommunity && (
            <HdrBtn title="Torneos & Ligas" onClick={() => setShowTournamentsPanel(v => !v)}>
              <span style={{ fontSize: 16, lineHeight: 1, color: showTournamentsPanel ? C.green : C.text2 }}>🏆</span>
            </HdrBtn>
          )}
          {/* Search button */}
          <HdrBtn title="Buscar en chat" onClick={() => { setSearchMode(v => !v); setSearchQuery(''); setTimeout(() => searchInputRef.current?.focus(), 50) }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={searchMode ? C.green : C.text2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </HdrBtn>

          {/* Background picker button */}
          <HdrBtn title="Fondo de chat" onClick={() => setShowBgPicker(v => !v)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={showBgPicker ? C.green : C.text2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
            </svg>
          </HdrBtn>

          {/* ⋯ more menu */}
          <div style={{ position: 'relative' }}>
            <HdrBtn title="Más opciones" onClick={() => { setShowChatMenu(v => !v); setShowAutoDeletePicker(false) }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={C.text2}>
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </HdrBtn>
            {showChatMenu && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute', top: 38, right: 0, zIndex: 200,
                  background: C.panel, border: `1px solid ${C.border}`,
                  borderRadius: 12, overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  minWidth: 210,
                }}
              >
                {/* Auto-delete / mensajes temporales */}
                <div
                  onClick={() => setShowAutoDeletePicker(v => !v)}
                  style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: C.text, display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${C.border}22`, background: showAutoDeletePicker ? C.panel2 : 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = C.panel2}
                  onMouseLeave={e => e.currentTarget.style.background = showAutoDeletePicker ? C.panel2 : 'transparent'}
                >
                  <span>⏱️</span>
                  <span style={{ flex: 1 }}>Mensajes temporales</span>
                  {autoDeleteHours ? <span style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>ON</span> : <span style={{ fontSize: 10, color: C.textDim }}>▼</span>}
                </div>
                {showAutoDeletePicker && (
                  <div style={{ background: C.panel2, borderBottom: `1px solid ${C.border}22` }}>
                    {[
                      [null,'Desactivado'],
                      [0.083,'5 minutos'],
                      [1,'1 hora'],
                      [12,'12 horas'],
                      [24,'24 horas'],
                      [168,'7 días'],
                    ].map(([h, label]) => (
                      <div
                        key={label}
                        onClick={() => handleSetAutoDelete(h)}
                        style={{
                          padding: '8px 28px', cursor: 'pointer', fontSize: 12,
                          color: autoDeleteHours === h ? C.green : C.text,
                          fontWeight: autoDeleteHours === h ? 700 : 400,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = C.panel}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >{label} {autoDeleteHours === h ? '✓' : ''}</div>
                    ))}
                  </div>
                )}
                <div
                  onClick={() => { setShowChatMenu(false); setSelectMode(true); setSelectedMsgs(new Set()) }}
                  style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: C.text, display: 'flex', gap: 8, alignItems: 'center', borderTop: `1px solid ${C.border}22` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.panel2}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span>☑️</span> Seleccionar mensajes
                </div>
                <div
                  onClick={handleClearHistory}
                  style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: C.text, display: 'flex', gap: 8, alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = C.panel2}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span>🧹</span> Limpiar historial
                </div>
                <div
                  onClick={handleDeleteChat}
                  style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#ef4444', display: 'flex', gap: 8, alignItems: 'center', borderTop: `1px solid ${C.border}22` }}
                  onMouseEnter={e => e.currentTarget.style.background = '#ef444418'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span>🗑️</span> Borrar chat
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search bar */}
        {searchMode && (
          <div style={{ padding: '8px 12px', background: C.panel, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar en la conversación..."
              autoFocus
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: C.text, fontSize: 14 }}
            />
            {searchQuery && (
              <span style={{ color: C.textDim, fontSize: 12, fontWeight: 600 }}>
                {messages.filter(m => m.content?.toLowerCase?.().includes(searchQuery.toLowerCase())).length} resultado{messages.filter(m => m.content?.toLowerCase?.().includes(searchQuery.toLowerCase())).length !== 1 ? 's' : ''}
              </span>
            )}
            <button onClick={() => { setSearchMode(false); setSearchQuery('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 13, fontWeight: 600 }}>✕</button>
          </div>
        )}

        {/* Pinned message */}
        {pinnedText && !pinnedDismissed && (
          <PinnedBanner text={pinnedText} onDismiss={() => setPinnedDismissed(true)} />
        )}

        {/* ── TOPICS PANEL ── */}
        {isGroup && showTopicsPanel && (
          <div style={{
            background: C.panel, borderBottom: `1px solid ${C.border}`,
            padding: '8px 12px 10px', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: C.text2, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Canales</span>
              <button onClick={() => setShowNewTopic(v => !v)} style={{
                background: showNewTopic ? `${C.green}22` : 'none', border: `1px solid ${showNewTopic ? C.green : C.border}`,
                borderRadius: 8, color: showNewTopic ? C.green : C.text2, fontSize: 11, padding: '3px 8px',
                cursor: 'pointer', fontWeight: 600,
              }}>+ Nuevo</button>
            </div>

            {/* New topic form */}
            {showNewTopic && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  value={newTopicEmoji}
                  onChange={e => setNewTopicEmoji(e.target.value)}
                  placeholder="💬"
                  style={{
                    width: 36, background: C.panel2, border: `1px solid ${C.border}`,
                    borderRadius: 8, color: C.text, fontSize: 16, padding: '6px', textAlign: 'center', outline: 'none',
                  }}
                />
                <input
                  value={newTopicName}
                  onChange={e => setNewTopicName(e.target.value)}
                  placeholder="Nombre del canal..."
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && newTopicName.trim()) {
                      await createTopic(activeConversation.id, newTopicName.trim(), newTopicEmoji || '💬')
                      setNewTopicName(''); setNewTopicEmoji('💬'); setShowNewTopic(false)
                    }
                  }}
                  style={{
                    flex: 1, background: C.panel2, border: `1px solid ${C.border}`,
                    borderRadius: 8, color: C.text, fontSize: 13, padding: '6px 10px', outline: 'none',
                  }}
                />
                <button onClick={async () => {
                  if (!newTopicName.trim()) return
                  await createTopic(activeConversation.id, newTopicName.trim(), newTopicEmoji || '💬')
                  setNewTopicName(''); setNewTopicEmoji('💬'); setShowNewTopic(false)
                }} style={{
                  background: C.green, border: 'none', borderRadius: 8,
                  color: C.bg, fontWeight: 700, fontSize: 12, padding: '6px 12px', cursor: 'pointer',
                }}>OK</button>
              </div>
            )}

            {/* Topic list */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => { setActiveTopic(null) }}
                style={{
                  background: activeTopicId === null ? `${C.green}22` : C.panel2,
                  border: `1px solid ${activeTopicId === null ? C.green : C.border}`,
                  borderRadius: 20, color: activeTopicId === null ? C.green : C.text2,
                  fontSize: 12, padding: '4px 12px', cursor: 'pointer', fontWeight: 600,
                  transition: 'all .15s',
                }}
              >💬 General</button>
              {topics.map(t => (
                <button key={t.id}
                  onClick={() => setActiveTopic(t.id)}
                  style={{
                    background: activeTopicId === t.id ? `${C.green}22` : C.panel2,
                    border: `1px solid ${activeTopicId === t.id ? C.green : C.border}`,
                    borderRadius: 20, color: activeTopicId === t.id ? C.green : C.text2,
                    fontSize: 12, padding: '4px 12px', cursor: 'pointer', fontWeight: 600,
                    transition: 'all .15s',
                  }}
                >{t.emoji} {t.name}</button>
              ))}
            </div>
          </div>
        )}

        {/* Active topic indicator */}
        {isGroup && activeTopicId && (() => {
          const t = topics.find(x => x.id === activeTopicId)
          return t ? (
            <div style={{
              background: `${C.green}10`, borderBottom: `1px solid ${C.green}33`,
              padding: '4px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            }}>
              <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>{t.emoji} {t.name}</span>
              <button onClick={() => setActiveTopic(null)} style={{
                background: 'none', border: 'none', color: C.textDim, fontSize: 11, cursor: 'pointer', marginLeft: 'auto',
              }}>✕ Volver a General</button>
            </div>
          ) : null
        })()}

        {/* ── ANNOUNCEMENTS FEED (topic_type = announcements) ── */}
        {isAnnouncementTopic && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loadingMessages && <MsgSkeleton />}
            {!loadingMessages && messages.filter(m => !m.is_deleted).map(msg => {
              const senderInfo = msg.sender || memberMap[msg.sender_id]
              const senderName = senderInfo?.display_name || 'Admin'
              const reactions = msg.reactions || []
              const ANNOUNCE_REACTS = ['👍','🔥','⚽','❤️']
              const grouped = reactions.reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc }, {})
              const myReacts = new Set(reactions.filter(r => r.user_id === profile?.id).map(r => r.emoji))
              return (
                <div key={msg.id} style={{
                  background: C.panel, borderRadius: 16, overflow: 'hidden',
                  border: `1px solid ${C.border}`,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}>
                  {/* Author bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 8px' }}>
                    <Avatar name={senderName} size={34} color={C.green} url={senderInfo?.avatar_url} />
                    <div>
                      <div style={{ color: C.green, fontWeight: 700, fontSize: 13 }}>{senderName}</div>
                      <div style={{ color: C.textDim, fontSize: 11 }}>{formatTime(msg.created_at)}</div>
                    </div>
                    {msg.pinned && <span style={{ marginLeft: 'auto', fontSize: 11, color: C.yellow }}>📌 Fijado</span>}
                  </div>
                  {/* Content */}
                  <div style={{ padding: '0 14px 12px', color: C.text, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {msg.type === 'image'
                      ? <img src={msg.content} alt="" style={{ width: '100%', borderRadius: 10, display: 'block' }} />
                      : msg.content}
                  </div>
                  {/* Reactions bar */}
                  <div style={{
                    borderTop: `1px solid ${C.border}`, padding: '8px 14px',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {ANNOUNCE_REACTS.map(em => {
                      const count = grouped[em] || 0
                      const mine = myReacts.has(em)
                      return (
                        <button key={em} onClick={() => reactToMessage(msg.id, profile.id, em)} style={{
                          background: mine ? `${C.green}22` : C.panel2,
                          border: `1px solid ${mine ? C.green : C.border}`,
                          borderRadius: 20, padding: '4px 10px', cursor: 'pointer',
                          fontSize: 14, display: 'flex', alignItems: 'center', gap: 4,
                          color: mine ? C.green : C.text2, fontWeight: mine ? 700 : 400,
                          transition: 'all .15s',
                        }}>
                          {em}{count > 0 && <span style={{ fontSize: 11 }}>{count}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {/* ── MESSAGES (normal chat) ── */}
        {!isAnnouncementTopic && <div style={{
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

                // Sent: green-tinted. Received: panel2
                const bubbleBg = isMine
                  ? `linear-gradient(135deg, ${C.green}1a 0%, ${C.green}26 100%)`
                  : C.panel2
                const bubbleBorder = isMine ? `1px solid ${C.green}33` : `1px solid ${C.border}`

                const isMsgSelected = selectedMsgs.has(msg.id)
                return (
                  <div
                    key={msg.id}
                    className="msg-in"
                    style={{
                      display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start',
                      marginBottom: isLast ? 8 : 2, alignItems: 'flex-end', gap: 7, position: 'relative',
                      background: isMsgSelected ? 'rgba(34,197,94,0.1)' : 'transparent',
                      borderRadius: 8, transition: 'background .15s',
                    }}
                    onMouseEnter={() => !selectMode && setHoveredMsg(msg.id)}
                    onMouseLeave={() => { setHoveredMsg(null) }}
                    onMouseDown={() => { if (!selectMode) longPressTimer.current = setTimeout(() => setLongPressMsg(msg), 500) }}
                    onMouseUp={() => clearTimeout(longPressTimer.current)}
                    onTouchStart={() => { if (!selectMode) longPressTimer.current = setTimeout(() => setLongPressMsg(msg), 500) }}
                    onTouchEnd={() => clearTimeout(longPressTimer.current)}
                    onClick={e => {
                      e.stopPropagation()
                      if (selectMode) {
                        setSelectedMsgs(prev => { const n = new Set(prev); n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id); return n })
                      }
                    }}
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
        </div>}

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

        {/* ── ATTACH MENU ── */}
        {showAttachMenu && !showGifPicker && !showStickerPicker && (
          <div style={{
            background: C.panel, borderTop: `1px solid ${C.border}`, flexShrink: 0,
            padding: '16px 12px 12px', animation: 'emojiSlideUp .2s ease',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { icon: '🖼️', label: 'Foto/Video', action: () => { fileRef.current.accept='image/*,video/*'; fileRef.current?.click(); setShowAttachMenu(false) } },
                { icon: '📄', label: 'Documento',  action: () => { fileRef.current.accept='*/*'; fileRef.current?.click(); setShowAttachMenu(false) } },
                { icon: '🎬', label: 'GIF',        action: () => { setShowGifPicker(true); fetchGifs('') } },
                { icon: '🎭', label: 'Sticker',    action: () => setShowStickerPicker(true) },
                { icon: '📊', label: 'Encuesta',   action: () => { setShowPollModal(true); setShowAttachMenu(false) } },
                { icon: '📅', label: 'Evento',     action: () => { setShowEventModal(true); setShowAttachMenu(false) } },
                { icon: '📞', label: 'Llamada gr.', action: () => { alert('Próximamente: llamadas grupales'); setShowAttachMenu(false) } },
                { icon: '🎵', label: 'Audio',      action: () => { setShowAttachMenu(false) } },
                ...(!isGroup ? [{ icon: '📳', label: 'Zumbido', action: () => { sendNudge(); setShowAttachMenu(false) } }] : []),
              ].map(item => (
                <button key={item.label} onClick={item.action} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '12px 4px', borderRadius: 14, background: C.panel2,
                  border: `1px solid ${C.border}`, cursor: 'pointer',
                  transition: 'background .1s, transform .1s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${C.green}15`; e.currentTarget.style.borderColor = `${C.green}50` }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.panel2; e.currentTarget.style.borderColor = C.border }}
                  onTouchStart={e => { e.currentTarget.style.transform = 'scale(.95)' }}
                  onTouchEnd={e => { e.currentTarget.style.transform = 'none' }}
                >
                  <span style={{ fontSize: 24 }}>{item.icon}</span>
                  <span style={{ fontSize: 10, color: C.textDim, textAlign: 'center', lineHeight: 1.2 }}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── GIF PICKER ── */}
        {showAttachMenu && showGifPicker && (
          <div style={{
            background: C.panel, borderTop: `1px solid ${C.border}`, flexShrink: 0,
            display: 'flex', flexDirection: 'column', height: 300, animation: 'emojiSlideUp .2s ease',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', flexShrink: 0 }}>
              <button onClick={() => setShowGifPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 18, padding: '0 4px' }}>←</button>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: C.panel2, borderRadius: 12, padding: '7px 12px', border: `1px solid ${C.border}` }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  value={gifQuery}
                  onChange={e => setGifQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchGifs(gifQuery)}
                  placeholder="Buscar GIFs..."
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 13 }}
                  autoFocus
                />
                <button onClick={() => fetchGifs(gifQuery)} style={{ background: C.green, border: 'none', borderRadius: 8, padding: '3px 10px', cursor: 'pointer', color: C.bg, fontSize: 12, fontWeight: 700 }}>IR</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 8px', scrollbarWidth: 'thin' }}>
              {gifsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: C.textDim, fontSize: 13 }}>Cargando...</div>
              ) : gifs.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: C.textDim, fontSize: 13 }}>Buscá un GIF arriba</div>
              ) : (
                <div style={{ columns: 2, gap: 6 }}>
                  {gifs.map(gif => {
                    const url = gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url || ''
                    if (!url) return null
                    return (
                      <div key={gif.id} style={{ breakInside: 'avoid', marginBottom: 6 }}>
                        <img src={url} alt={gif.title || 'gif'} loading="lazy"
                          onClick={() => sendGif(url)}
                          style={{ width: '100%', borderRadius: 8, cursor: 'pointer', display: 'block', transition: 'opacity .1s' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STICKER PICKER ── */}
        {showAttachMenu && showStickerPicker && (
          <div style={{
            background: C.panel, borderTop: `1px solid ${C.border}`, flexShrink: 0,
            display: 'flex', flexDirection: 'column', height: 300, animation: 'emojiSlideUp .2s ease',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px', flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
              <button onClick={() => setShowStickerPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 18, padding: '0 6px' }}>←</button>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text2, flex: 1 }}>Stickers</span>
              {STICKER_PACKS.map(pack => (
                <button key={pack.id} onClick={() => setStickerPack(pack.id)} style={{
                  fontSize: 20, padding: '5px 7px', borderRadius: 10, cursor: 'pointer',
                  background: stickerPack === pack.id ? `${C.green}20` : 'none',
                  border: stickerPack === pack.id ? `1.5px solid ${C.green}50` : '1.5px solid transparent',
                }} title={pack.title}>{pack.label}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px', scrollbarWidth: 'thin' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                {(STICKER_PACKS.find(p => p.id === stickerPack)?.stickers || []).map((s, i) => (
                  <button key={i} onClick={() => sendSticker(s)} style={{
                    fontSize: 36, padding: '8px 4px', borderRadius: 12,
                    background: 'none', border: '1.5px solid transparent', cursor: 'pointer',
                    transition: 'background .1s, transform .1s', lineHeight: 1.2, textAlign: 'center',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.panel2; e.currentTarget.style.borderColor = `${C.green}30`; e.currentTarget.style.transform = 'scale(1.15)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'none' }}
                    onTouchStart={e => e.currentTarget.style.transform = 'scale(1.2)'}
                    onTouchEnd={e => { e.currentTarget.style.transform = 'none'; sendSticker(s) }}
                  >{s}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── BACKGROUND PICKER ── */}
        {showBgPicker && (
          <div style={{
            position: 'absolute', top: 58, right: 8, zIndex: 120,
            background: '#141E24', borderRadius: 16, padding: 14,
            border: `1px solid ${C.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            width: 240, animation: 'emojiSlideUp .2s ease',
          }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: C.text2, letterSpacing: '.5px', textTransform: 'uppercase' }}>Fondo de chat</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {CHAT_BG_PRESETS.map(bg => (
                <button key={bg.id} onClick={() => saveChatBg(bg.gradient ? bg : null)} style={{
                  height: 44, borderRadius: 10, cursor: 'pointer',
                  background: bg.gradient || C.bg2,
                  border: chatBg?.id === bg.id ? `2px solid ${C.green}` : `1.5px solid ${C.border}`,
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                  padding: '3px 2px', transition: 'border .1s',
                }} title={bg.label}>
                  <span style={{ fontSize: 8, color: '#ffffff88', fontWeight: 600, letterSpacing: .2 }}>{bg.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

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

        {/* Announcements: only admins post, others see read-only bar */}
        {isAnnouncementTopic && (
          <div style={{
            padding: '10px 16px', background: C.panel, borderTop: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          }}>
            <span style={{ fontSize: 18 }}>📢</span>
            <span style={{ color: C.textDim, fontSize: 13 }}>Solo los administradores pueden publicar avisos</span>
          </div>
        )}

        {/* ── INPUT BAR ── */}
        {!isAnnouncementTopic && !recLocked && (
          <form onSubmit={handleSend} style={{
            display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 12px 10px',
            background: C.panel, borderTop: `1px solid ${C.border}`, flexShrink: 0,
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          }} onClick={e => e.stopPropagation()}>
            <input type="file" accept="image/*,video/*,application/pdf,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain" ref={fileRef} onChange={handleImagePick} style={{ display: 'none' }} />

            {/* + Attach btn */}
            <button type="button" onClick={() => { setShowAttachMenu(v => !v); setShowEmoji(false) }} style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: showAttachMenu ? `${C.green}22` : C.panel2,
              border: `1px solid ${showAttachMenu ? C.green : C.border}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .15s', fontSize: 20, color: showAttachMenu ? C.green : C.textDim, fontWeight: 300,
            }}>+</button>

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
                <div style={{ flex: 1, position: 'relative' }}>
                  {/* Mention dropdown */}
                  {mentionQuery !== null && mentionMatches.length > 0 && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: 0, right: 0,
                      background: C.panel, border: `1px solid ${C.border}`,
                      borderRadius: 12, overflow: 'hidden', zIndex: 50,
                      boxShadow: '0 -8px 24px rgba(0,0,0,0.5)',
                      marginBottom: 4,
                    }}>
                      {mentionMatches.map((m, i) => (
                        <button key={m.id} onMouseDown={e => { e.preventDefault(); insertMention(m) }} style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', background: i === mentionIndex ? `${C.green}18` : 'none',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                        }}>
                          <Avatar name={m.display_name} size={28} color={senderColor(m.id)} url={m.avatar_url} />
                          <div>
                            <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{m.display_name}</div>
                            <div style={{ color: C.textDim, fontSize: 11 }}>@{m.username}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    ref={inputRef} type="text" placeholder="Escribe un mensaje..." value={text}
                    onChange={e => { handleTextChange(e.target.value); handleTyping() }}
                    onKeyDown={e => {
                      if (mentionQuery !== null && mentionMatches.length > 0) {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionMatches.length - 1)) }
                        if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)) }
                        if (e.key === 'Enter') { e.preventDefault(); insertMention(mentionMatches[mentionIndex]); return }
                        if (e.key === 'Escape') { setMentionQuery(null) }
                      } else if (e.key === 'Enter' && !e.shiftKey) { handleSend(e) }
                    }}
                    style={{ width: '100%', background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 14, padding: '9px 0' }}
                  />
                </div>
              )}
            </div>

            {/* Send / mic */}
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
                {/* Mic button — tap to record */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    ref={micBtnRef}
                    type="button"
                    onClick={startRecording}
                    style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: C.green,
                      border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 4px 16px ${C.green}55`,
                      transform: 'scale(1)',
                      transition: 'background .15s, box-shadow .15s, transform .15s',
                      userSelect: 'none', WebkitUserSelect: 'none',
                    }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={C.bg}>
                      <path d="M12 1c-1.66 0-3 1.34-3 3v8c0 1.66 1.34 3 3 3s3-1.34 3-3V4c0-1.66-1.34-3-3-3zm5.3 9c0 3-2.54 5.1-5.3 5.1S6.7 13 6.7 10H5c0 3.41 2.72 6.23 6 6.72V20h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                    </svg>
                  </button>
                </div>
                <style>{`@keyframes recHintIn{from{opacity:0;transform:translateY(-50%) scale(.9)}to{opacity:1;transform:translateY(-50%) scale(1)}}`}</style>
              </div>
            )}
          </form>
        )}

        {/* Select mode bar */}
        {selectMode && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100,
            background: C.panel, borderTop: `1px solid ${C.border}`,
            padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <button onClick={() => setSelectMode(false)} style={{
              padding: '9px 14px', borderRadius: 12, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.text, fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>Cancelar</button>
            <button onClick={() => {
              const visible = messages.filter(m => !deletedForMe.has(m.id) && !m.is_deleted)
              if (selectedMsgs.size === visible.length) setSelectedMsgs(new Set())
              else setSelectedMsgs(new Set(visible.map(m => m.id)))
            }} style={{
              flex: 1, padding: '9px 0', borderRadius: 12, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.text, fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>
              {selectedMsgs.size === messages.filter(m => !deletedForMe.has(m.id) && !m.is_deleted).length
                ? 'Deseleccionar todo' : `Seleccionar todo`}
            </button>
            <button disabled={selectedMsgs.size === 0} onClick={() => {
              if (!selectedMsgs.size) return
              setConfirmDialog({
                title: 'Eliminar mensajes',
                message: `¿Eliminar ${selectedMsgs.size} mensaje${selectedMsgs.size > 1 ? 's' : ''} solo para vos?`,
                danger: true, confirmLabel: 'Eliminar',
                onConfirm: () => {
                  setConfirmDialog(null)
                  setDeletedForMe(prev => {
                    const next = new Set(prev); selectedMsgs.forEach(id => next.add(id))
                    localStorage.setItem(deletedForMeKey, JSON.stringify([...next]))
                    return next
                  })
                  setSelectedMsgs(new Set())
                  setSelectMode(false)
                },
              })
            }} style={{
              padding: '9px 16px', borderRadius: 12, border: 'none',
              background: selectedMsgs.size === 0 ? C.panel2 : '#ef4444',
              color: selectedMsgs.size === 0 ? C.sub : '#fff',
              fontWeight: 700, fontSize: 13, cursor: selectedMsgs.size === 0 ? 'not-allowed' : 'pointer',
            }}>
              {selectedMsgs.size === 0 ? 'Eliminar' : `Eliminar (${selectedMsgs.size})`}
            </button>
          </div>
        )}

        <ConfirmDialog
          open={!!confirmDialog}
          title={confirmDialog?.title}
          message={confirmDialog?.message}
          confirmLabel={confirmDialog?.confirmLabel}
          danger={confirmDialog?.danger}
          onConfirm={confirmDialog?.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      </div>
    </>
  )
}

// ── Poll bubble ───────────────────────────────────────────────────────────────
function PollBubble({ data, msgId, isMine }) {
  const accent = isMine ? C.green : C.text2
  const { profile } = useAuthStore()
  const userId = profile?.id

  // votes / voters live in message content (synced via Supabase realtime)
  const votes = data.votes || {}
  const voterOptions = data.voterOptions || {}
  const voted = voterOptions[userId] || null

  const total = Object.values(votes).reduce((s, v) => s + v, 0)

  async function vote(opt) {
    if (voted || !userId) return
    const nextVotes = { ...votes, [opt]: (votes[opt] || 0) + 1 }
    const nextVoterOptions = { ...voterOptions, [userId]: opt }
    const nextData = { ...data, votes: nextVotes, voterOptions: nextVoterOptions }
    try {
      await supabase.from('messages').update({ content: JSON.stringify(nextData) }).eq('id', msgId)
    } catch {}
    try { navigator.vibrate?.(20) } catch {}
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
      <div style={{ fontSize: 12, color: accent, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill={accent}><rect x="2" y="2" width="4" height="20"/><rect x="10" y="7" width="4" height="15"/><rect x="18" y="11" width="4" height="11"/></svg>
        ENCUESTA
      </div>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{data.question}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.options.map((opt, i) => {
          const count = votes[opt] || 0
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const isVoted = voted === opt
          return (
            <button key={i} onClick={() => vote(opt)} disabled={!!voted} style={{
              border: `1.5px solid ${isVoted ? accent : `${accent}40`}`,
              borderRadius: 10, padding: '7px 10px', background: 'transparent',
              cursor: voted ? 'default' : 'pointer', position: 'relative', overflow: 'hidden',
              textAlign: 'left', color: C.text, fontSize: 13,
            }}>
              {voted && (
                <div style={{ position: 'absolute', inset: 0, left: 0, width: `${pct}%`, background: `${accent}18`, transition: 'width .4s ease' }} />
              )}
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: isVoted ? 700 : 400 }}>{isVoted ? '✓ ' : ''}{opt}</span>
                {voted && <span style={{ fontSize: 11, color: accent, fontWeight: 700, marginLeft: 8 }}>{pct}%</span>}
              </div>
            </button>
          )
        })}
      </div>
      {voted && <p style={{ margin: 0, fontSize: 11, color: C.textDim, textAlign: 'center' }}>{total} {total === 1 ? 'voto' : 'votos'}</p>}
    </div>
  )
}

// ── Event bubble ──────────────────────────────────────────────────────────────
function EventBubble({ data, isMine }) {
  const accent = isMine ? C.green : C.text2
  const dateStr = data.date ? new Date(data.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
      <div style={{ fontSize: 12, color: accent, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        EVENTO
      </div>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{data.title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {dateStr && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: C.text2 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            {dateStr}{data.time ? ` · ${data.time}` : ''}
          </div>
        )}
        {data.place && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: C.text2 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {data.place}
          </div>
        )}
      </div>
    </div>
  )
}

// ── File bubble ────────────────────────────────────────────────────────────────
function FileBubble({ data, isMine }) {
  const accent = isMine ? C.green : C.text2
  const ext = data.name?.split('.').pop()?.toUpperCase() || 'FILE'
  const size = data.size ? (data.size > 1024 * 1024 ? `${(data.size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(data.size / 1024)} KB`) : ''
  return (
    <a href={data.url} target="_blank" rel="noreferrer" style={{
      display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
      padding: '4px 0', minWidth: 180,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: `${accent}20`, border: `1px solid ${accent}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, color: accent, fontWeight: 800, letterSpacing: -.3,
      }}>{ext}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.name || 'Archivo'}</p>
        {size && <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textDim }}>{size}</p>}
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    </a>
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
  if (msg.type === 'gif') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <img src={msg.content} alt="GIF" onClick={() => window.open(msg.content, '_blank')}
        style={{ borderRadius: 10, maxWidth: '100%', maxHeight: 260, objectFit: 'cover', cursor: 'pointer', display: 'block' }} loading="lazy" />
      <div style={{ textAlign: 'right', paddingRight: 4 }}>{time}</div>
    </div>
  )
  if (msg.type === 'sticker') return (
    <div style={{ textAlign: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: 56, lineHeight: 1, display: 'block' }}>{msg.content}</span>
      <div style={{ textAlign: 'right', marginTop: 2 }}>{time}</div>
    </div>
  )
  if (msg.type === 'video') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <video src={msg.content} controls playsInline style={{ borderRadius: 10, maxWidth: '100%', maxHeight: 300, display: 'block' }} />
      <div style={{ textAlign: 'right', paddingRight: 4 }}>{time}</div>
    </div>
  )
  if (msg.type === 'audio') return (
    <div>
      <AudioPlayer src={msg.content} isMine={isMine} />
      <div style={{ textAlign: 'right', marginTop: 2 }}>{time}</div>
    </div>
  )
  if (msg.type === 'poll') {
    try {
      const data = JSON.parse(msg.content)
      return (
        <div>
          <PollBubble data={data} msgId={msg.id} isMine={isMine} />
          <div style={{ textAlign: 'right', marginTop: 6 }}>{time}</div>
        </div>
      )
    } catch { return <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}{time}</span> }
  }
  if (msg.type === 'event') {
    try {
      const data = JSON.parse(msg.content)
      return (
        <div>
          <EventBubble data={data} isMine={isMine} />
          <div style={{ textAlign: 'right', marginTop: 6 }}>{time}</div>
        </div>
      )
    } catch { return <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}{time}</span> }
  }
  if (msg.type === 'file') {
    try {
      const data = JSON.parse(msg.content)
      return (
        <div>
          <FileBubble data={data} isMine={isMine} />
          <div style={{ textAlign: 'right', marginTop: 4 }}>{time}</div>
        </div>
      )
    } catch { return <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}{time}</span> }
  }
  // Highlight @mentions + link preview
  const content = msg.content || ''
  const hasUrl = URL_REGEX.test(content); URL_REGEX.lastIndex = 0
  if (content.includes('@')) {
    const parts = content.split(/(@\w[\w ]*)/g)
    return (
      <div>
        <span style={{ whiteSpace: 'pre-wrap' }}>
          {parts.map((p, i) => p.startsWith('@')
            ? <span key={i} style={{ color: C.green, fontWeight: 700 }}>{p}</span>
            : p
          )}
          {time}
        </span>
        {hasUrl && <LinkPreview text={content} />}
      </div>
    )
  }
  return (
    <div>
      <span style={{ whiteSpace: 'pre-wrap' }}>{content}{time}</span>
      {hasUrl && <LinkPreview text={content} />}
    </div>
  )
}

function HdrBtn({ children, onClick, title }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick?.(e) }} title={title} style={{
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
