import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { sounds, ringtone, outgoingRing, busyTone } from '../lib/sounds'

// openrelay.metered.ca is the free public TURN that works with openrelayproject credentials
// For production, set VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL + VITE_TURN_HOST in .env
const TURN_USER = import.meta.env.VITE_TURN_USERNAME || 'openrelayproject'
const TURN_CRED = import.meta.env.VITE_TURN_CREDENTIAL || 'openrelayproject'
const TURN_HOST = import.meta.env.VITE_TURN_HOST || 'openrelay.metered.ca'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: `turn:${TURN_HOST}:80`,                 username: TURN_USER, credential: TURN_CRED },
    { urls: `turn:${TURN_HOST}:80?transport=tcp`,   username: TURN_USER, credential: TURN_CRED },
    { urls: `turn:${TURN_HOST}:443`,                username: TURN_USER, credential: TURN_CRED },
    { urls: `turns:${TURN_HOST}:443?transport=tcp`, username: TURN_USER, credential: TURN_CRED },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
}

// ── Backgrounds the user can pick ────────────────────────────────────────────
const CALL_BACKGROUNDS = [
  { id: 'default',  label: 'Auto',     bg: null },
  { id: 'dark',     label: 'Dark',     bg: 'linear-gradient(160deg,#050c08,#0a0a0a)' },
  { id: 'space',    label: 'Space',    bg: 'linear-gradient(160deg,#020010,#0d0030,#000820)' },
  { id: 'ocean',    label: 'Ocean',    bg: 'linear-gradient(160deg,#001830,#003060,#001020)' },
  { id: 'forest',   label: 'Forest',   bg: 'linear-gradient(160deg,#001a0a,#003318,#000d05)' },
  { id: 'sunset',   label: 'Sunset',   bg: 'linear-gradient(160deg,#1a0010,#3d0030,#0d0020)' },
  { id: 'gold',     label: 'Gold',     bg: 'linear-gradient(160deg,#1a1000,#3d2800,#0d0800)' },
]

const REACTIONS = ['❤️','😂','🔥','👍','😮','🥇','💪','🎮']

function fmtTime(s) {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function nameToColor(name = '') {
  const colors = [
    ['#1a4a2e','#39FF14'],['#1a2a4a','#4A9EFF'],['#3a1a4a','#C084FC'],
    ['#4a1a1a','#F87171'],['#2a3a1a','#86EFAC'],['#3a2a1a','#FBB86A'],
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length
  return colors[h]
}

function vibrate(p) { try { navigator.vibrate?.(p) } catch (e) {} }

// ── Signal bars (connection quality) ─────────────────────────────────────────
function SignalBars({ quality }) {
  // quality: 'excellent' | 'good' | 'fair' | 'poor' | null
  const colors = { excellent: '#22c55e', good: '#86efac', fair: '#f59e0b', poor: '#ef4444' }
  const filled = { excellent: 4, good: 3, fair: 2, poor: 1 }
  const n = filled[quality] ?? 0
  const color = colors[quality] ?? 'rgba(255,255,255,0.2)'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
      {[5, 9, 13, 17].map((h, i) => (
        <div key={i} style={{
          width: 3.5, height: h, borderRadius: 2,
          background: i < n ? color : 'rgba(255,255,255,0.15)',
          transition: 'background .4s',
        }} />
      ))}
    </div>
  )
}

// ── Floating reaction emoji ───────────────────────────────────────────────────
function FloatingReaction({ emoji, id, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [])
  return (
    <div key={id} style={{
      position: 'absolute',
      bottom: 140,
      left: `${20 + Math.random() * 60}%`,
      fontSize: 38,
      pointerEvents: 'none',
      zIndex: 50,
      animation: 'floatUp 2.8s ease-out forwards',
    }}>{emoji}</div>
  )
}

// ── Waveform ─────────────────────────────────────────────────────────────────
function Waveform({ active, color = '#39FF14', bars = 9, height = 40 }) {
  const hs = [0.4, 0.9, 0.6, 1.3, 0.5, 1.1, 0.4, 0.95, 0.65]
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, height }}>
      {hs.slice(0, bars).map((h, i) => (
        <div key={i} style={{
          width: 3.5, borderRadius: 4, background: active ? color : 'rgba(255,255,255,0.18)',
          height: active ? `${h * (height * 0.75)}px` : '4px',
          animation: active ? `wfWave ${0.65 + i * 0.09}s ease-in-out ${i * 0.055}s infinite alternate` : 'none',
          transition: 'height .35s ease, background .35s',
          boxShadow: active ? `0 0 5px ${color}88` : 'none',
        }} />
      ))}
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, avatar_url, size = 120, active, colors }) {
  const [bg, accent] = colors
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {active && (
        <div style={{
          position: 'absolute', inset: -10, borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`,
          animation: 'avPulse 2.2s ease-in-out infinite',
        }} />
      )}
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: avatar_url ? `url(${avatar_url}) center/cover` : `linear-gradient(145deg, ${bg}, #0a0f0d)`,
        border: active ? `3px solid ${accent}90` : '3px solid rgba(255,255,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.34, fontWeight: 800, color: '#fff',
        letterSpacing: '-1px',
        boxShadow: active
          ? `0 0 0 8px ${accent}15, 0 20px 60px rgba(0,0,0,0.6)`
          : '0 20px 60px rgba(0,0,0,0.55)',
        transition: 'border .4s, box-shadow .4s',
        overflow: 'hidden',
      }}>
        {!avatar_url && (name || '?').slice(0, 2).toUpperCase()}
      </div>
    </div>
  )
}

// ── Mini pill when minimized ──────────────────────────────────────────────────
function MiniPill({ name, elapsed, avatar_url, colors, isVideo, quality, onExpand, onHangup }) {
  const [, accent] = colors
  const [bg] = colors
  return (
    <div style={{
      position: 'fixed', top: 10, left: 10, right: 10, zIndex: 300,
      background: 'rgba(8,16,11,0.95)',
      backdropFilter: 'blur(30px)',
      borderRadius: 22,
      border: `1px solid ${accent}35`,
      boxShadow: `0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px ${accent}15`,
      display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px',
      animation: 'slideDown .3s cubic-bezier(.34,1.56,.64,1)',
      cursor: 'pointer',
    }} onClick={onExpand}>
      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: avatar_url ? `url(${avatar_url}) center/cover` : `linear-gradient(135deg, ${bg}, #0a0f0d)`,
        border: `2px solid ${accent}60`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#fff',
        animation: 'avPulse 2s ease-in-out infinite',
        backgroundSize: 'cover',
      }}>
        {!avatar_url && (name || '?').slice(0, 2).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ color: accent, fontSize: 11.5, fontWeight: 500, marginTop: 1 }}>{fmtTime(elapsed)} · {isVideo ? 'Video' : 'Audio'}</div>
      </div>
      <SignalBars quality={quality} />
      <Waveform active bars={3} height={24} color={accent} />
      <button onClick={e => { e.stopPropagation(); vibrate(50); onHangup() }} style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #7f1d1d, #ef4444)',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px #ef444460',
      }}>
        <HangupIcon size={15} />
      </button>
    </div>
  )
}

function HangupIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 2 2 0 0 1-.47-.43"/>
      <path d="M6.37 6.37a16 16 0 0 0-2.6 3.41L5.04 11.05a2 2 0 0 1 .45 2.11c-.339.907-.573 1.85-.7 2.81A2 2 0 0 1 3.08 18H.08A2 2 0 0 1-1.9 15.82a19.79 19.79 0 0 1 3.07-8.63"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CallPage({
  conversationId, myUserId, myUserName,
  contact, callType: initType, isIncoming, incomingOffer, onEnd, onAccept,
}) {
  const [phase, setPhase] = useState(isIncoming ? 'incoming' : 'connecting')
  const [callType] = useState(initType || 'audio')
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  // Audio: video calls default to speaker, audio calls default to earpiece (like WhatsApp)
  const [speaker, setSpeaker] = useState(initType === 'video')
  const [elapsed, setElapsed] = useState(0)
  const [minimized, setMinimized] = useState(false)
  const [visible, setVisible] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)

  // ── New features state ──────────────────────────────────────────────────────
  const [quality, setQuality] = useState(null)          // signal quality
  const [latency, setLatency] = useState(null)          // ms
  const [debugLogs, setDebugLogs] = useState([])
  const [showDebug, setShowDebug] = useState(true)
  const [reactions, setReactions] = useState([])        // floating emojis
  const [showReactions, setShowReactions] = useState(false)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [selectedBg, setSelectedBg] = useState('default')
  const [screenSharing, setScreenSharing] = useState(false)
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false)
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)

  const dbg = useCallback((msg) => {
    const t = new Date().toISOString().slice(11,19)
    setDebugLogs(l => [...l.slice(-30), `${t} ${msg}`])
    console.log('[CALL]', msg)
  }, [])

  const pc = useRef(null)
  const localStream = useRef(null)
  const screenStream = useRef(null)
  const sessionCh = useRef(null)
  const timerRef = useRef(null)
  const qualityRef = useRef(null)
  const connectTimeoutRef = useRef(null)
  const ringTimeoutRef = useRef(null)
  const silentCtxRef = useRef(null)
  const connectedRef = useRef(false)
  const localVid = useRef(null)
  const remoteVid = useRef(null)
  const remoteAudio = useRef(null)
  const remoteStreamRef = useRef(null)  // store stream so we can re-apply after DOM mounts
  const pendingIce = useRef([])
  const sessionChReady = useRef(false)
  const pendingOutIce = useRef([])  // ICE candidates queued until sessionCh is ready
  const touchY0 = useRef(0)

  // Re-apply remote stream after DOM re-renders (race: ontrack fires before video element mounts)
  useEffect(() => {
    if (phase === 'active' && remoteStreamRef.current) {
      const s = remoteStreamRef.current
      if (remoteAudio.current && !remoteAudio.current.srcObject) {
        remoteAudio.current.srcObject = s
        remoteAudio.current.play().catch(() => {})
      }
      if (remoteVid.current && (!remoteVid.current.srcObject || remoteVid.current.srcObject !== s)) {
        remoteVid.current.srcObject = s
        remoteVid.current.play().catch(() => {})
      }
    }
  }, [phase])

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const canScreenShare = !isMobile && typeof navigator.mediaDevices?.getDisplayMedia === 'function'

  const name = contact?.display_name || 'Usuario'
  const avatar_url = contact?.avatar_url || null
  const colors = nameToColor(name)
  const [, accent] = colors
  const isVideo = callType === 'video'
  const bgObj = CALL_BACKGROUNDS.find(b => b.id === selectedBg) || CALL_BACKGROUNDS[0]

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  useEffect(() => {
    sessionCh.current = supabase.channel(`call-session:${conversationId}`, {
      config: { broadcast: { ack: false } },
    })
      .on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
        if (!pc.current) return
        try {
          const desc = typeof payload.answer === 'string'
            ? new RTCSessionDescription(JSON.parse(payload.answer))
            : new RTCSessionDescription(payload.answer)
          await pc.current.setRemoteDescription(desc)
          for (const c of pendingIce.current) {
            try { await pc.current.addIceCandidate(new RTCIceCandidate(c)) } catch (_) {}
          }
          pendingIce.current = []
        } catch (e) { console.error('[call-answer]', e) }
      })
      .on('broadcast', { event: 'call-ice' }, async ({ payload }) => {
        if (payload.from === myUserId) return
        try {
          const cand = new RTCIceCandidate(payload.candidate)
          if (pc.current?.remoteDescription) {
            await pc.current.addIceCandidate(cand)
          } else { pendingIce.current.push(payload.candidate) }
        } catch (_) {}
      })
      .on('broadcast', { event: 'call-end' }, () => hangup(false))
      .on('broadcast', { event: 'call-reject' }, () => { busyTone.start(); setTimeout(() => busyTone.stop(), 3000); hangup(false) })
      .on('broadcast', { event: 'call-screen-share' }, ({ payload }) => {
        if (payload.from === myUserId) return
        setRemoteScreenSharing(payload.active)
        // Force video element to reload the track by briefly nulling srcObject
        if (remoteVid.current && remoteStreamRef.current) {
          remoteVid.current.srcObject = null
          setTimeout(() => {
            if (remoteVid.current && remoteStreamRef.current) {
              remoteVid.current.srcObject = remoteStreamRef.current
              remoteVid.current.play().catch(() => {})
            }
          }, 80)
        }
      })
      .on('broadcast', { event: 'call-reaction' }, ({ payload }) => {
        if (payload.from === myUserId) return
        addReaction(payload.emoji)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          sessionChReady.current = true
          // Flush queued outgoing ICE candidates
          for (const c of pendingOutIce.current) {
            try { await sessionCh.current.send({ type: 'broadcast', event: 'call-ice', payload: { candidate: c, from: myUserId } }) } catch (_) {}
          }
          pendingOutIce.current = []
        }
      })

    if (!isIncoming) {
      startOutgoing(); outgoingRing.start()
      ringTimeoutRef.current = setTimeout(() => {
        if (!connectedRef.current) hangup(true)
      }, 90000)
    } else { ringtone.start(); vibrate([0, 400, 200, 400, 200, 400]) }

    return () => {
      ringtone.stop(); outgoingRing.stop(); busyTone.stop()
      clearInterval(timerRef.current)
      clearInterval(qualityRef.current)
      clearTimeout(connectTimeoutRef.current)
      clearTimeout(ringTimeoutRef.current)
      if (sessionCh.current) supabase.removeChannel(sessionCh.current)
    }
  }, [])

  // ── RTCStats quality polling ──────────────────────────────────────────────
  function startQualityPolling() {
    qualityRef.current = setInterval(async () => {
      if (!pc.current) return
      try {
        const stats = await pc.current.getStats()
        let rtt = null
        stats.forEach(s => {
          if (s.type === 'candidate-pair' && s.state === 'succeeded' && s.currentRoundTripTime != null) {
            rtt = s.currentRoundTripTime * 1000 // convert to ms
          }
        })
        if (rtt !== null) {
          setLatency(Math.round(rtt))
          if (rtt < 80)        setQuality('excellent')
          else if (rtt < 150)  setQuality('good')
          else if (rtt < 300)  setQuality('fair')
          else                  setQuality('poor')
        }
      } catch (_) {}
    }, 3000)
  }

  // ── Reactions ─────────────────────────────────────────────────────────────
  function addReaction(emoji) {
    const id = Date.now() + Math.random()
    setReactions(prev => [...prev, { emoji, id }])
  }

  function sendReaction(emoji) {
    vibrate(30)
    addReaction(emoji)
    sessionCh.current?.send({
      type: 'broadcast', event: 'call-reaction',
      payload: { emoji, from: myUserId },
    })
    setShowReactions(false)
  }

  async function getMedia() {
    if (window.Capacitor?.isNativePlatform?.()) {
      try {
        const { Permissions } = window.Capacitor.Plugins
        if (Permissions?.requestPermissions) {
          await Permissions.requestPermissions({ permissions: ['microphone'] })
        }
      } catch (_) {}
    }
    try {
      const ctx = new AudioContext()
      if (ctx.state === 'suspended') await ctx.resume()
      ctx.close()
    } catch (_) {}

    // Strong echo cancellation prevents feedback when phones are close
    const audioConstraints = {
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: true },
      autoGainControl:  { ideal: true },
      channelCount:     { ideal: 1 },
      sampleRate:       { ideal: 48000 },
      // Chrome/Edge extended constraints
      googEchoCancellation: true,
      googAutoGainControl:  true,
      googNoiseSuppression: true,
      googHighpassFilter:   true,
    }
    let stream
    if (callType === 'video') {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        })
      } catch (videoErr) {
        // Cámara ocupada o sin permiso → fallback audio only
        console.warn('Video unavailable, falling back to audio:', videoErr.message)
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
        setCamOff(true)
      }
    } else {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
      } catch (e1) {
        dbg('getUserMedia err: ' + e1.name + ' — retry simple')
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
    }
    localStream.current = stream
    if (localVid.current) { localVid.current.srcObject = stream; localVid.current.muted = true }
    return stream
  }

  function makePc(stream) {
    dbg('makePc TURN_HOST=' + TURN_HOST)
    let conn
    try { conn = new RTCPeerConnection(ICE_SERVERS); dbg('RTCPeerConnection OK') }
    catch(e) { dbg('RTCPeerConnection ERR: ' + e.message); throw e }
    stream.getTracks().forEach(t => conn.addTrack(t, stream))
    conn.ontrack = e => {
      const s = e.streams[0]
      remoteStreamRef.current = s
      if (remoteAudio.current) { remoteAudio.current.srcObject = s; remoteAudio.current.play().catch(() => {}) }
      if (remoteVid.current) { remoteVid.current.srcObject = s; remoteVid.current.play().catch(() => {}) }
    }
    conn.onicecandidate = e => {
      if (!e.candidate) return
      if (sessionChReady.current) {
        sessionCh.current?.send({ type: 'broadcast', event: 'call-ice', payload: { candidate: e.candidate, from: myUserId } })
      } else {
        pendingOutIce.current.push(e.candidate)
      }
    }
    conn.onconnectionstatechange = () => {
      dbg('conn=' + conn.connectionState)
      if (conn.connectionState === 'connected') {
        clearTimeout(connectTimeoutRef.current)
        goActive()
      }
      if (conn.connectionState === 'failed') hangup(true)
    }
    conn.oniceconnectionstatechange = () => {
      dbg('ice=' + conn.iceConnectionState)
      if (conn.iceConnectionState === 'disconnected') {
        try { conn.restartIce() } catch (_) {}
      }
      if (conn.iceConnectionState === 'failed') hangup(true)
    }
    connectTimeoutRef.current = setTimeout(() => {
      if (pc.current && pc.current.connectionState !== 'connected') hangup(true)
    }, 60000)
    pc.current = conn
    return conn
  }

  async function startOutgoing() {
    dbg('startOutgoing')
    try {
      const stream = await getMedia()
      dbg('getMedia OK tracks=' + stream.getTracks().length)
      const conn = makePc(stream)
      const offer = await conn.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === 'video' })
      dbg('offer created')
      await conn.setLocalDescription(offer)

      // Send offer via dedicated user channel — retry up to 3 times so mobile→PC works even on slow connections
      const offerPayload = { from: myUserId, fromName: myUserName || '', convId: conversationId, callType, offer }
      for (let attempt = 0; attempt < 3; attempt++) {
        const ch = supabase.channel(`user-calls:${contact.id}-${attempt}`, { config: { broadcast: { ack: false } } })
        await new Promise(r => ch.subscribe(s => s === 'SUBSCRIBED' && r()))
        await ch.send({ type: 'broadcast', event: 'call-offer', payload: offerPayload })
        supabase.removeChannel(ch)
        if (attempt < 2) await new Promise(r => setTimeout(r, 800))
      }
      supabase.functions.invoke('send-fcm-notification', {
        body: {
          targetUserId: contact.id,
          type: 'call',
          payload: { from: myUserId, fromName: myUserName || '', convId: conversationId, callType, offer: JSON.stringify(offer) },
        }
      }).catch(() => {})
    } catch (e) { dbg('ERR startOutgoing: ' + e.name + ' ' + e.message); alert(`Error: ${e.message}`); onEnd() }
  }

  async function acceptCall() {
    vibrate([30, 20, 60])
    ringtone.stop()
    setPhase('connecting')
    try {
      const stream = await getMedia()
      const conn = makePc(stream)

      // Offer can arrive as object (Realtime broadcast) or JSON string (push notification)
      const offerDesc = typeof incomingOffer === 'string'
        ? new RTCSessionDescription(JSON.parse(incomingOffer))
        : new RTCSessionDescription(incomingOffer)
      await conn.setRemoteDescription(offerDesc)

      for (const c of pendingIce.current) {
        try { await conn.addIceCandidate(new RTCIceCandidate(c)) } catch (_) {}
      }
      pendingIce.current = []

      const answer = await conn.createAnswer()
      await conn.setLocalDescription(answer)

      // Wait for channel to be ready before sending answer
      if (!sessionChReady.current) {
        await new Promise(resolve => {
          const iv = setInterval(() => { if (sessionChReady.current) { clearInterval(iv); resolve() } }, 100)
          setTimeout(() => { clearInterval(iv); resolve() }, 5000)
        })
      }
      sessionCh.current?.send({ type: 'broadcast', event: 'call-answer', payload: { answer } })
    } catch (e) { console.error('[acceptCall]', e); alert(`Error: ${e.message}`); hangup(true) }
  }

  function goActive() {
    connectedRef.current = true
    clearTimeout(ringTimeoutRef.current)
    outgoingRing.stop()
    setPhase('active')
    sounds.callConnect()
    vibrate([0, 60])
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    startQualityPolling()
    // Apply audio routing immediately on connect (earpiece for audio, speaker for video)
    const useSpeaker = callType === 'video'
    applySpeakerRoute(useSpeaker)
    onAccept?.()
  }

  function rejectCall() {
    vibrate(80)
    ringtone.stop()
    sessionCh.current?.send({ type: 'broadcast', event: 'call-reject', payload: {} })
    hangup(false)
  }

  function hangup(sendSignal = true) {
    vibrate([0, 80])
    ringtone.stop(); outgoingRing.stop(); busyTone.stop()
    clearInterval(timerRef.current)
    clearInterval(qualityRef.current)
    clearTimeout(connectTimeoutRef.current)
    clearTimeout(ringTimeoutRef.current)
    silentCtxRef.current?.close(); silentCtxRef.current = null
    screenStream.current?.getTracks().forEach(t => t.stop())
    sounds.callEnd()
    if (sendSignal) sessionCh.current?.send({ type: 'broadcast', event: 'call-end', payload: {} })
    if (!isIncoming && !connectedRef.current && conversationId && myUserId) {
      const icon = callType === 'video' ? '📹' : '📞'
      supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: myUserId,
        type: 'system',
        content: `${icon} Llamada perdida`,
      }).then(() => {})
    }
    localStream.current?.getTracks().forEach(t => t.stop())
    pc.current?.close()
    setPhase('ended')
    setTimeout(onEnd, 900)
  }

  async function toggleMute() {
    vibrate(25)
    const newMuted = !muted
    setMuted(newMuted)
    const track = localStream.current?.getAudioTracks()[0]
    if (track) track.enabled = !newMuted
    const sender = pc.current?.getSenders().find(s => s.track?.kind === 'audio')
    if (sender && track) {
      try {
        if (newMuted) {
          silentCtxRef.current?.close()
          silentCtxRef.current = new AudioContext()
          const dst = silentCtxRef.current.createMediaStreamDestination()
          await sender.replaceTrack(dst.stream.getAudioTracks()[0])
        } else {
          await sender.replaceTrack(track)
          silentCtxRef.current?.close(); silentCtxRef.current = null
        }
      } catch (_) {}
    }
  }

  async function toggleCam() {
    vibrate(25)
    const t = localStream.current?.getVideoTracks()[0]
    if (t) {
      t.enabled = !t.enabled
      setCamOff(c => !c)
      return
    }
    // No video track yet (call fell back to audio-only) — try to get camera now
    if (!camOff) return
    try {
      const cs = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      const ct = cs.getVideoTracks()[0]
      localStream.current?.addTrack(ct)
      if (localVid.current) localVid.current.srcObject = localStream.current
      const videoSender = pc.current?.getSenders().find(s => s.track?.kind === 'video')
      if (videoSender) {
        await videoSender.replaceTrack(ct).catch(() => {})
      } else {
        pc.current?.addTrack(ct, localStream.current)
      }
      setCamOff(false)
    } catch (e) {
      alert('No se pudo acceder a la cámara: ' + e.message)
    }
  }

  async function applySpeakerRoute(useSpeaker) {
    const el = remoteAudio.current
    if (!el) return
    el.volume = 1.0
    try {
      if (typeof el.setSinkId === 'function') {
        if (useSpeaker) {
          // Route to speaker: find speaker device or use 'default'
          const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
          const spk = devices.find(d => d.kind === 'audiooutput' && /speaker/i.test(d.label))
          await el.setSinkId(spk?.deviceId || 'default').catch(() => {})
        } else {
          // Route to earpiece: empty string = system default (earpiece on mobile)
          await el.setSinkId('').catch(() => {})
        }
      }
    } catch (_) {}
  }

  async function toggleSpeaker() {
    vibrate(25)
    const next = !speaker
    setSpeaker(next)
    await applySpeakerRoute(next)
  }

  // ── Screen share ───────────────────────────────────────────────────────────
  async function toggleScreenShare() {
    vibrate(25)
    if (screenSharing) {
      // Restore camera
      screenStream.current?.getTracks().forEach(t => t.stop())
      screenStream.current = null
      const camTrack = localStream.current?.getVideoTracks()[0]
      if (camTrack) {
        const sender = pc.current?.getSenders().find(s => s.track?.kind === 'video')
        if (sender) await sender.replaceTrack(camTrack).catch(() => {})
        if (localVid.current) { localVid.current.srcObject = localStream.current }
      }
      setScreenSharing(false)
      sessionCh.current?.send({ type: 'broadcast', event: 'call-screen-share', payload: { from: myUserId, active: false } }).catch(() => {})
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        screenStream.current = stream
        const screenTrack = stream.getVideoTracks()[0]
        const sender = pc.current?.getSenders().find(s => s.track?.kind === 'video')
        if (sender) await sender.replaceTrack(screenTrack).catch(() => {})
        if (localVid.current) { localVid.current.srcObject = stream }
        setScreenSharing(true)
        // Auto-stop when user ends via browser UI
        screenTrack.onended = () => toggleScreenShare()
        sessionCh.current?.send({ type: 'broadcast', event: 'call-screen-share', payload: { from: myUserId, active: true } }).catch(() => {})
      } catch (_) { /* user cancelled or not supported */ }
    }
  }

  // Swipe down to minimize
  const onTS = useCallback(e => { touchY0.current = e.touches[0].clientY; setDragging(true) }, [])
  const onTM = useCallback(e => { setDragY(Math.max(0, e.touches[0].clientY - touchY0.current)) }, [])
  const onTE = useCallback(() => {
    setDragging(false)
    if (dragY > 90) { setMinimized(true); setDragY(0) } else { setDragY(0) }
  }, [dragY])

  // ── Minimized pill ─────────────────────────────────────────────────────────
  if (minimized && phase === 'active') {
    return (
      <>
        <audio ref={remoteAudio} autoPlay playsInline style={{ display: 'none' }} />
        <MiniPill
          name={name} elapsed={elapsed} avatar_url={avatar_url}
          colors={colors} isVideo={isVideo} quality={quality}
          onExpand={() => setMinimized(false)}
          onHangup={() => hangup(true)}
        />
        <CallStyles />
      </>
    )
  }

  // ── Incoming call ──────────────────────────────────────────────────────────
  if (phase === 'incoming') {
    return (
      <>
        <audio ref={remoteAudio} autoPlay playsInline style={{ display: 'none' }} onError={() => {}} />
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end',
          animation: 'fadeIn .25s ease',
        }}>
          <div style={{
            width: '100%',
            background: 'linear-gradient(180deg, #0a1410 0%, #060e0a 100%)',
            borderRadius: '28px 28px 0 0',
            padding: '12px 0 0',
            boxShadow: '0 -12px 60px rgba(0,0,0,0.7)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderBottom: 'none',
            animation: 'slideUp .4s cubic-bezier(.34,1.3,.64,1)',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 16 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
            </div>

            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 220, overflow: 'hidden', zIndex: 0 }}>
              {avatar_url
                ? <img src={avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(40px) brightness(0.15) saturate(2)', transform: 'scale(1.3)' }} />
                : <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${accent}30 0%, transparent 70%)` }} />
              }
            </div>

            <div style={{ position: 'relative', zIndex: 1, padding: '0 28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: `${accent}15`, border: `1px solid ${accent}30`,
                borderRadius: 20, padding: '5px 14px',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: accent, animation: 'blink 1.2s ease-in-out infinite' }} />
                <span style={{ color: accent, fontSize: 12, fontWeight: 600 }}>
                  {isVideo ? 'Videollamada entrante' : 'Llamada de voz entrante'}
                </span>
              </div>

              <div style={{ position: 'relative' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    position: 'absolute',
                    inset: -(18 + i * 14), borderRadius: '50%',
                    border: `1.5px solid ${accent}${['40','28','16'][i]}`,
                    animation: `ring 2.2s ease-out ${i * 0.45}s infinite`,
                  }} />
                ))}
                <Avatar name={name} avatar_url={avatar_url} size={110} colors={colors} />
              </div>

              <div style={{ textAlign: 'center' }}>
                <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.5px' }}>{name}</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: 0 }}>
                  {isVideo ? '📹 quiere hacer una videollamada' : '📞 te está llamando'}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 52, paddingTop: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <button onClick={rejectCall} style={{
                    width: 68, height: 68, borderRadius: '50%', border: '1.5px solid rgba(239,68,68,0.35)', cursor: 'pointer',
                    background: 'rgba(239,68,68,0.15)', backdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 24px rgba(239,68,68,0.2)', transition: 'transform .15s',
                  }}
                    onTouchStart={e => e.currentTarget.style.transform = 'scale(0.92)'}
                    onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Rechazar</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <button onClick={acceptCall} style={{
                    width: 68, height: 68, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(145deg, #14532d, #22c55e)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 32px rgba(34,197,94,0.45), 0 0 0 8px rgba(34,197,94,0.1)',
                    animation: 'acceptPulse 1.5s ease-in-out infinite alternate',
                    transition: 'transform .15s',
                  }}
                    onTouchStart={e => e.currentTarget.style.transform = 'scale(0.92)'}
                    onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.8a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </button>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Aceptar</span>
                </div>
              </div>

              <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
            </div>
          </div>
        </div>
        <CallStyles />
      </>
    )
  }

  // ── Full screen (outgoing / active / ended) ───────────────────────────────
  const slideBase = dragging ? {
    transform: `translateY(${dragY * 0.55}px)`,
    opacity: Math.max(0, 1 - dragY / 280),
    transition: 'none',
  } : {
    transform: visible ? 'translateY(0)' : 'translateY(100%)',
    opacity: visible ? 1 : 0,
    transition: 'transform .45s cubic-bezier(.34,1.2,.64,1), opacity .35s ease',
  }

  const isDesktop = window.innerWidth >= 768

  return (
    <>
      <audio ref={remoteAudio} autoPlay playsInline style={{ display: 'none' }} />

      {/* DEBUG OVERLAY — remove after testing */}
      {showDebug && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)', color: '#0f0', fontFamily: 'monospace',
          fontSize: 11, padding: '4px 8px', maxHeight: '40vh', overflowY: 'auto',
          pointerEvents: 'auto',
        }} onClick={() => setShowDebug(false)}>
          <div style={{ color: '#ff0', marginBottom: 2 }}>🐛 DEBUG (tap to hide)</div>
          {debugLogs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {/* Desktop: overlay + centered window */}
      {isDesktop && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 199,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        }} />
      )}

      <div style={{
        position: 'fixed', zIndex: 200,
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        userSelect: 'none', overflow: 'hidden',
        ...(isDesktop ? {
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 380, height: 680,
          borderRadius: 28,
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
        } : {
          inset: 0,
          ...slideBase,
        }),
      }}
        onTouchStart={phase === 'active' ? onTS : undefined}
        onTouchMove={phase === 'active' ? onTM : undefined}
        onTouchEnd={phase === 'active' ? onTE : undefined}
      >
        {/* ── BACKGROUND ── */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
          {bgObj.bg ? (
            <div style={{ position: 'absolute', inset: 0, background: bgObj.bg }} />
          ) : (
            <>
              <div style={{ position: 'absolute', inset: 0, background: '#050c08' }} />
              {avatar_url ? (
                <img src={avatar_url} alt="" style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'cover',
                  filter: 'blur(60px) brightness(0.2) saturate(1.8)',
                  transform: 'scale(1.3)',
                }} />
              ) : (
                <>
                  <div style={{
                    position: 'absolute', top: '-15%', left: '-15%', width: '75%', paddingBottom: '75%',
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${colors[0]}cc 0%, transparent 70%)`,
                    opacity: 0.6, animation: 'orbFloat 9s ease-in-out infinite',
                  }} />
                  <div style={{
                    position: 'absolute', bottom: '-25%', right: '-15%', width: '80%', paddingBottom: '80%',
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`,
                    opacity: 0.5, animation: 'orbFloat 11s ease-in-out 3s infinite reverse',
                  }} />
                </>
              )}
            </>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.52)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)' }} />
        </div>

        {/* Remote video — also shown for screen share even in audio calls */}
        {(isVideo || remoteScreenSharing) && phase === 'active' && (
          <video ref={remoteVid} autoPlay playsInline
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: remoteScreenSharing ? 'contain' : 'cover', zIndex: 1, background: remoteScreenSharing ? '#000' : 'none' }} />
        )}
        {remoteScreenSharing && phase === 'active' && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(0,0,0,0.7)', borderRadius: 20, padding: '4px 14px', fontSize: 12, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🖥️</span> {contact?.display_name} está compartiendo pantalla
          </div>
        )}

        {/* Local PiP */}
        {isVideo && phase === 'active' && (
          <div style={{
            position: 'absolute', top: 60, right: 16, width: 88, height: 132,
            borderRadius: 20, overflow: 'hidden', zIndex: 20,
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            border: `2px solid ${screenSharing ? accent : 'rgba(255,255,255,0.18)'}`,
          }}>
            <video ref={localVid} autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: screenSharing ? 'none' : 'scaleX(-1)' }} />
          </div>
        )}

        {/* ── Floating reactions ── */}
        {reactions.map(r => (
          <FloatingReaction
            key={r.id} emoji={r.emoji} id={r.id}
            onDone={() => setReactions(prev => prev.filter(x => x.id !== r.id))}
          />
        ))}

        {/* ── MAIN CONTENT ── */}
        <div style={{
          position: 'relative', zIndex: 10, height: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>

          {/* Top bar */}
          <div style={{ width: '100%', padding: '54px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {phase === 'active' && (
              <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 38, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
              </div>
            )}

            {/* Quality + HD badges */}
            {phase === 'active' && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Latency pill */}
                {latency !== null && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '4px 10px',
                  }}>
                    <SignalBars quality={quality} />
                    <span style={{ color: quality === 'excellent' ? '#22c55e' : quality === 'poor' ? '#ef4444' : '#f59e0b', fontSize: 11, fontWeight: 600 }}>
                      {latency}ms
                    </span>
                  </div>
                )}
                {/* HD */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '4px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                    {[4, 7, 10, 13].map((h, i) => (
                      <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: i < 3 ? accent : 'rgba(255,255,255,0.2)' }} />
                    ))}
                  </div>
                  <span style={{ color: accent, fontSize: 11, fontWeight: 600 }}>HD</span>
                </div>
              </div>
            )}
          </div>

          {/* Center: avatar + info */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, paddingBottom: 8 }}>
            <div style={{ marginBottom: 30 }}>
              <Avatar name={name} avatar_url={avatar_url} size={128} active={phase === 'active'} colors={colors} />
            </div>

            <h2 style={{
              color: '#fff', fontSize: 30, fontWeight: 700, margin: '0 0 8px',
              letterSpacing: '-0.6px', textShadow: '0 2px 16px rgba(0,0,0,0.5)',
            }}>{name}</h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
              {phase === 'active' && (
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}`, animation: 'blink 2s ease-in-out infinite' }} />
              )}
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 17, letterSpacing: '0.1px' }}>
                {phase === 'connecting' ? 'Llamando...' : phase === 'active' ? fmtTime(elapsed) : 'Llamada finalizada'}
              </span>
            </div>

            {phase === 'active' && !isVideo && <Waveform active={!muted} color={accent} />}

            {phase === 'connecting' && (
              <div style={{ display: 'flex', gap: 8 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: accent, animation: `dot 1.4s ease-in-out ${i * 0.22}s infinite` }} />
                ))}
              </div>
            )}

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 20, padding: '5px 14px',
              background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
            }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>🔐</span>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 500 }}>
                {isVideo ? 'Videollamada' : 'Llamada de voz'} · Cifrada extremo a extremo
              </span>
            </div>

            {phase === 'active' && (
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 10 }}>
                Deslizá hacia abajo para minimizar
              </p>
            )}
          </div>

          {/* ── CONTROLS ── */}
          {phase !== 'ended' && (
            <div style={{ width: '100%', padding: '0 20px 44px' }}>

              {/* Secondary buttons */}
              {phase === 'active' && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
                  {/* Mute */}
                  <RoundBtn
                    icon={muted
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    }
                    label={muted ? 'Mic off' : 'Micrófono'}
                    state={muted ? 'danger' : 'off'}
                    onClick={toggleMute}
                  />
                  {/* Speaker / Earpiece toggle */}
                  <RoundBtn
                    icon={speaker
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                        </svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
                          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
                        </svg>
                    }
                    label={speaker ? 'Altavoz' : 'Auricular'}
                    state={speaker ? 'on' : 'off'}
                    accent={accent}
                    onClick={toggleSpeaker}
                  />
                  {/* Camera (video only) */}
                  {isVideo && (
                    <RoundBtn
                      icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                        {camOff && <line x1="1" y1="1" x2="23" y2="23"/>}
                      </svg>}
                      label={camOff ? 'Cam off' : 'Cámara'}
                      state={camOff ? 'danger' : 'off'}
                      onClick={toggleCam}
                    />
                  )}
                  {/* Screen share (video calls, desktop only — not available on mobile browsers) */}
                  {isVideo && canScreenShare && (
                    <RoundBtn
                      icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                        {screenSharing && <line x1="2" y1="2" x2="22" y2="22"/>}
                      </svg>}
                      label={screenSharing ? 'Compartiendo' : 'Pantalla'}
                      state={screenSharing ? 'on' : 'off'}
                      accent={accent}
                      onClick={toggleScreenShare}
                    />
                  )}
                  {/* Reactions */}
                  <RoundBtn
                    icon={<span style={{ fontSize: 18, lineHeight: 1 }}>😊</span>}
                    label="Reacción"
                    state="off"
                    onClick={() => { setShowReactions(v => !v); setShowBgPicker(false); setShowNote(false) }}
                  />
                  {/* Background picker */}
                  <RoundBtn
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                      <path d="M2 12h20"/>
                    </svg>}
                    label="Fondo"
                    state={selectedBg !== 'default' ? 'on' : 'off'}
                    accent={accent}
                    onClick={() => { setShowBgPicker(v => !v); setShowReactions(false); setShowNote(false) }}
                  />
                  {/* Note */}
                  <RoundBtn
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                    </svg>}
                    label="Nota"
                    state={showNote ? 'on' : 'off'}
                    accent={accent}
                    onClick={() => { setShowNote(v => !v); setShowReactions(false); setShowBgPicker(false) }}
                  />
                </div>
              )}

              {/* ── Reaction picker ── */}
              {showReactions && phase === 'active' && (
                <div style={{
                  display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 16,
                  animation: 'slideUp .25s ease',
                }}>
                  {REACTIONS.map(emoji => (
                    <button key={emoji} onClick={() => sendReaction(emoji)} style={{
                      fontSize: 28, background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '50%', width: 48, height: 48,
                      cursor: 'pointer', backdropFilter: 'blur(12px)',
                      transition: 'transform .1s',
                    }}
                      onTouchStart={e => e.currentTarget.style.transform = 'scale(1.3)'}
                      onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
                    >{emoji}</button>
                  ))}
                </div>
              )}

              {/* ── Background picker ── */}
              {showBgPicker && phase === 'active' && (
                <div style={{
                  display: 'flex', gap: 10, marginBottom: 16, overflowX: 'auto', padding: '4px 0',
                  animation: 'slideUp .25s ease',
                }}>
                  {CALL_BACKGROUNDS.map(bg => (
                    <button key={bg.id} onClick={() => { setSelectedBg(bg.id); setShowBgPicker(false) }} style={{
                      flexShrink: 0, width: 52, height: 52, borderRadius: 14, cursor: 'pointer',
                      background: bg.bg || `linear-gradient(135deg, ${colors[0]}, #050c08)`,
                      border: `2.5px solid ${selectedBg === bg.id ? accent : 'rgba(255,255,255,0.15)'}`,
                      boxShadow: selectedBg === bg.id ? `0 0 14px ${accent}60` : 'none',
                      transition: 'border .15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selectedBg === bg.id && <span style={{ color: '#fff', fontSize: 16 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Note pad ── */}
              {showNote && phase === 'active' && (
                <div style={{ marginBottom: 16, animation: 'slideUp .25s ease' }}>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Anotá algo durante la llamada..."
                    rows={3}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)',
                      border: '1px solid rgba(255,255,255,0.15)', borderRadius: 14,
                      color: '#fff', fontSize: 14, padding: '10px 14px',
                      outline: 'none', resize: 'none', fontFamily: 'inherit',
                    }}
                  />
                </div>
              )}

              {/* Hang up */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => hangup(true)} style={{
                    width: 70, height: 70, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(145deg, #7f1d1d, #ef4444)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 32px rgba(239,68,68,0.45), 0 0 0 8px rgba(239,68,68,0.1)',
                    transition: 'transform .15s',
                  }}
                    onTouchStart={e => e.currentTarget.style.transform = 'scale(0.92)'}
                    onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <HangupIcon size={26} />
                  </button>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 500 }}>Colgar</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <CallStyles />
    </>
  )
}

function RoundBtn({ icon, label, state = 'off', accent = '#39FF14', onClick }) {
  const isOn = state === 'on'
  const isDanger = state === 'danger'
  const color = isDanger ? '#ef4444' : isOn ? accent : 'rgba(255,255,255,0.85)'
  const bg = isDanger ? 'rgba(239,68,68,0.15)' : isOn ? `${accent}18` : 'rgba(255,255,255,0.08)'
  const border = isDanger ? '1.5px solid rgba(239,68,68,0.3)' : isOn ? `1.5px solid ${accent}35` : '1.5px solid rgba(255,255,255,0.1)'
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    }}>
      <div style={{
        width: 54, height: 54, borderRadius: '50%',
        background: bg, border, backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, transition: 'transform .12s, background .2s',
        boxShadow: isOn ? `0 0 20px ${accent}30` : isDanger ? '0 0 16px rgba(239,68,68,0.25)' : 'none',
      }}
        onTouchStart={e => e.currentTarget.style.transform = 'scale(0.9)'}
        onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.07)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {icon}
      </div>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

function CallStyles() {
  return (
    <style>{`
      @keyframes ring        { 0%{transform:scale(1);opacity:.7} 100%{transform:scale(1.7);opacity:0} }
      @keyframes dot         { 0%,80%,100%{transform:scale(.5);opacity:.3} 40%{transform:scale(1);opacity:1} }
      @keyframes blink       { 0%,100%{opacity:1} 50%{opacity:.25} }
      @keyframes wfWave      { 0%{transform:scaleY(.35)} 100%{transform:scaleY(1)} }
      @keyframes orbFloat    { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(3%,5%) scale(1.05)} 70%{transform:translate(-2%,2%) scale(.97)} }
      @keyframes avPulse     { 0%,100%{transform:scale(1);opacity:.7} 50%{transform:scale(1.12);opacity:1} }
      @keyframes slideUp     { from{transform:translateY(100%)} to{transform:translateY(0)} }
      @keyframes slideDown   { from{transform:translateY(-40px);opacity:0} to{transform:translateY(0);opacity:1} }
      @keyframes fadeIn      { from{opacity:0} to{opacity:1} }
      @keyframes acceptPulse { 0%{box-shadow:0 4px 32px rgba(34,197,94,0.45),0 0 0 8px rgba(34,197,94,0.1)} 100%{box-shadow:0 4px 32px rgba(34,197,94,0.65),0 0 0 16px rgba(34,197,94,0.06)} }
      @keyframes floatUp     { 0%{transform:translateY(0) scale(1);opacity:1} 80%{opacity:1} 100%{transform:translateY(-180px) scale(1.4);opacity:0} }
    `}</style>
  )
}
