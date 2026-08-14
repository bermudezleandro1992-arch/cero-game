import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { sounds, ringtone, outgoingRing } from '../lib/sounds'

const TURN_USER = import.meta.env.VITE_TURN_USERNAME || 'openrelayproject'
const TURN_CRED = import.meta.env.VITE_TURN_CREDENTIAL || 'openrelayproject'
const TURN_HOST = import.meta.env.VITE_TURN_USERNAME ? 'a.relay.metered.ca' : 'a.relay.metered.ca'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    // UDP — fastest path
    { urls: `turn:${TURN_HOST}:80`, username: TURN_USER, credential: TURN_CRED },
    // TCP fallback — penetrates strict firewalls
    { urls: `turn:${TURN_HOST}:80?transport=tcp`, username: TURN_USER, credential: TURN_CRED },
    // TLS — works on networks that block non-HTTPS
    { urls: `turns:${TURN_HOST}:443?transport=tcp`, username: TURN_USER, credential: TURN_CRED },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all', // try P2P first, TURN as fallback
  bundlePolicy: 'max-bundle',
}

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

// Animated waveform bars
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

// Avatar circle
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

// Floating mini pill when minimized
function MiniPill({ name, elapsed, avatar_url, colors, isVideo, onExpand, onHangup }) {
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
      }}>
        {!avatar_url && (name || '?').slice(0, 2).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ color: accent, fontSize: 11.5, fontWeight: 500, marginTop: 1 }}>{fmtTime(elapsed)} · {isVideo ? 'Video' : 'Audio'}</div>
      </div>
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

export default function CallPage({
  conversationId, myUserId, contact,
  callType: initType, isIncoming, incomingOffer, onEnd,
}) {
  const [phase, setPhase] = useState(isIncoming ? 'incoming' : 'connecting')
  const [callType] = useState(initType || 'audio')
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [speaker, setSpeaker] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [minimized, setMinimized] = useState(false)
  const [visible, setVisible] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)

  const pc = useRef(null)
  const localStream = useRef(null)
  const sessionCh = useRef(null)
  const timerRef = useRef(null)
  const connectTimeoutRef = useRef(null)
  const ringTimeoutRef = useRef(null)   // auto-hangup after 90s if not answered
  const silentCtxRef = useRef(null)   // kept alive while muted; closing it kills the silent track
  const connectedRef = useRef(false)  // track whether call was ever connected (for missed call message)
  const localVid = useRef(null)
  const remoteVid = useRef(null)
  const remoteAudio = useRef(null)
  const pendingIce = useRef([])
  const touchY0 = useRef(0)

  const name = contact?.display_name || 'Usuario'
  const avatar_url = contact?.avatar_url || null
  const colors = nameToColor(name)
  const [, accent] = colors
  const isVideo = callType === 'video'

  // Entrance animation
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  useEffect(() => {
    sessionCh.current = supabase.channel(`call-session:${conversationId}`)
      .on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
        if (!pc.current) return
        await pc.current.setRemoteDescription(new RTCSessionDescription(payload.answer))
        for (const c of pendingIce.current) {
          try { await pc.current.addIceCandidate(new RTCIceCandidate(c)) } catch (_) {}
        }
        pendingIce.current = []
      })
      .on('broadcast', { event: 'call-ice' }, async ({ payload }) => {
        if (payload.from === myUserId) return
        const cand = new RTCIceCandidate(payload.candidate)
        if (pc.current?.remoteDescription) {
          try { await pc.current.addIceCandidate(cand) } catch (_) {}
        } else { pendingIce.current.push(payload.candidate) }
      })
      .on('broadcast', { event: 'call-end' }, () => hangup(false))
      .on('broadcast', { event: 'call-reject' }, () => hangup(false))
      .subscribe()

    if (!isIncoming) {
      startOutgoing(); outgoingRing.start()
      // Auto-hangup after 90s if receiver never answers
      ringTimeoutRef.current = setTimeout(() => {
        if (!connectedRef.current) hangup(true)
      }, 90000)
    } else { ringtone.start(); vibrate([0, 400, 200, 400, 200, 400]) }

    return () => {
      ringtone.stop(); outgoingRing.stop()
      clearInterval(timerRef.current)
      clearTimeout(connectTimeoutRef.current)
      clearTimeout(ringTimeoutRef.current)
      if (sessionCh.current) supabase.removeChannel(sessionCh.current)
    }
  }, [])

  async function getMedia() {
    const stream = await navigator.mediaDevices.getUserMedia(
      callType === 'video'
        ? { audio: true, video: { facingMode: 'user', width: 640, height: 480 } }
        : { audio: true }
    )
    localStream.current = stream
    if (localVid.current) { localVid.current.srcObject = stream; localVid.current.muted = true }
    return stream
  }

  function makePc(stream) {
    const conn = new RTCPeerConnection(ICE_SERVERS)
    stream.getTracks().forEach(t => conn.addTrack(t, stream))
    conn.ontrack = e => {
      const s = e.streams[0]
      if (remoteAudio.current) { remoteAudio.current.srcObject = s; remoteAudio.current.play().catch(() => {}) }
      if (remoteVid.current) { remoteVid.current.srcObject = s; remoteVid.current.play().catch(() => {}) }
    }
    conn.onicecandidate = e => {
      if (e.candidate) sessionCh.current?.send({ type: 'broadcast', event: 'call-ice', payload: { candidate: e.candidate, from: myUserId } })
    }
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'connected') {
        clearTimeout(connectTimeoutRef.current)
        goActive()
      }
      if (conn.connectionState === 'failed') hangup(true)
      // 'disconnected' is transient on mobile — don't hang up immediately
    }
    // 60 second timeout if ICE never connects
    connectTimeoutRef.current = setTimeout(() => {
      if (pc.current && pc.current.connectionState !== 'connected') hangup(true)
    }, 60000)
    pc.current = conn
    return conn
  }

  async function startOutgoing() {
    try {
      const stream = await getMedia()
      const conn = makePc(stream)
      const offer = await conn.createOffer()
      await conn.setLocalDescription(offer)
      const ch = supabase.channel(`user-calls:${contact.id}`)
      await new Promise(r => ch.subscribe(s => s === 'SUBSCRIBED' && r()))
      await ch.send({ type: 'broadcast', event: 'call-offer', payload: { from: myUserId, fromName: contact?.display_name || '', convId: conversationId, callType, offer } })
      supabase.removeChannel(ch)
      // Also send FCM push notification so receiver gets it even when app is closed
      supabase.functions.invoke('send-fcm-notification', {
        body: {
          targetUserId: contact.id,
          type: 'call',
          payload: { from: myUserId, fromName: contact?.display_name || '', convId: conversationId, callType, offer: JSON.stringify(offer) },
        }
      }).catch(() => {}) // non-blocking, Supabase broadcast is the primary signal
    } catch (e) { alert(`Error: ${e.message}`); onEnd() }
  }

  async function acceptCall() {
    vibrate([30, 20, 60])
    ringtone.stop()
    setPhase('connecting')
    try {
      const stream = await getMedia()
      const conn = makePc(stream)
      await conn.setRemoteDescription(new RTCSessionDescription(incomingOffer))
      for (const c of pendingIce.current) {
        try { await conn.addIceCandidate(new RTCIceCandidate(c)) } catch (_) {}
      }
      pendingIce.current = []
      const answer = await conn.createAnswer()
      await conn.setLocalDescription(answer)
      sessionCh.current?.send({ type: 'broadcast', event: 'call-answer', payload: { answer } })
    } catch (e) { alert(`Error: ${e.message}`); hangup(true) }
  }

  function goActive() {
    connectedRef.current = true
    clearTimeout(ringTimeoutRef.current)
    outgoingRing.stop()
    setPhase('active')
    sounds.callConnect()
    vibrate([0, 60])
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }

  function rejectCall() {
    vibrate(80)
    ringtone.stop()
    sessionCh.current?.send({ type: 'broadcast', event: 'call-reject', payload: {} })
    hangup(false)
  }

  function hangup(sendSignal = true) {
    vibrate([0, 80])
    ringtone.stop(); outgoingRing.stop()
    clearInterval(timerRef.current)
    clearTimeout(connectTimeoutRef.current)
    clearTimeout(ringTimeoutRef.current)
    silentCtxRef.current?.close(); silentCtxRef.current = null
    sounds.callEnd()
    if (sendSignal) sessionCh.current?.send({ type: 'broadcast', event: 'call-end', payload: {} })
    // If caller hangs up and the call was never answered → insert missed call message
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
      } catch (_) { /* replaceTrack unsupported — track.enabled fallback already applied */ }
    }
  }
  function toggleCam() { vibrate(25); const t = localStream.current?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setCamOff(c => !c) } }
  async function toggleSpeaker() {
    vibrate(25)
    const next = !speaker; setSpeaker(next)
    // Native Android: use Capacitor bridge to switch earpiece/speaker
    if (window.Capacitor?.isNativePlatform?.()) {
      try {
        await window.Capacitor.Plugins.CapacitorSpeaker?.toggleAudioRoute?.({ speaker: next })
      } catch (_) {}
      // Fallback: AudioSession via eval (works on some Capacitor versions)
      try {
        if (next) {
          await window.Capacitor.Plugins.App?.requestAudioFocus?.()
        }
      } catch (_) {}
    }
    // Web fallback: setSinkId
    if (remoteAudio.current) {
      if (typeof remoteAudio.current.setSinkId === 'function') {
        remoteAudio.current.setSinkId(next ? 'default' : '').catch(() => {})
      }
      remoteAudio.current.volume = 1.0
    }
  }

  // Swipe-down-to-minimize
  const onTS = useCallback(e => { touchY0.current = e.touches[0].clientY; setDragging(true) }, [])
  const onTM = useCallback(e => { setDragY(Math.max(0, e.touches[0].clientY - touchY0.current)) }, [])
  const onTE = useCallback(() => {
    setDragging(false)
    if (dragY > 90) { setMinimized(true); setDragY(0) } else { setDragY(0) }
  }, [dragY])

  if (minimized && phase === 'active') {
    return (
      <>
        {/* Audio must stay mounted to keep sound when minimized */}
        <audio ref={remoteAudio} autoPlay playsInline style={{ display: 'none' }} />
        <MiniPill name={name} elapsed={elapsed} avatar_url={avatar_url} colors={colors} isVideo={isVideo} onExpand={() => setMinimized(false)} onHangup={() => hangup(true)} />
        <CallStyles />
      </>
    )
  }

  // ─── Incoming call: WhatsApp-style panel from bottom ───
  if (phase === 'incoming') {
    return (
      <>
        {/* Audio always mounted so ontrack can fire */}
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
            {/* Pull handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 16 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
            </div>

            {/* Blurred background strip */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 220, overflow: 'hidden', zIndex: 0 }}>
              {avatar_url
                ? <img src={avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(40px) brightness(0.15) saturate(2)', transform: 'scale(1.3)' }} />
                : <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${accent}30 0%, transparent 70%)` }} />
              }
            </div>

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 1, padding: '0 28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              {/* Label */}
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

              {/* Avatar */}
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

              {/* Name + subtext */}
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.5px' }}>{name}</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: 0 }}>
                  {isVideo ? '📹 quiere hacer una videollamada' : '📞 te está llamando'}
                </p>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 52, paddingTop: 8 }}>
                {/* Reject */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <button onClick={rejectCall} style={{
                    width: 68, height: 68, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: 'rgba(239,68,68,0.15)',
                    border: '1.5px solid rgba(239,68,68,0.35)',
                    backdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 24px rgba(239,68,68,0.2)',
                    transition: 'transform .15s',
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

                {/* Accept */}
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

              {/* Safe area */}
              <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
            </div>
          </div>
        </div>
        <CallStyles />
      </>
    )
  }

  // ─── Outgoing / Active / Ended: full-screen overlay ───
  const slideBase = dragging ? {
    transform: `translateY(${dragY * 0.55}px)`,
    opacity: Math.max(0, 1 - dragY / 280),
    transition: 'none',
  } : {
    transform: visible ? 'translateY(0)' : 'translateY(100%)',
    opacity: visible ? 1 : 0,
    transition: dragging ? 'none' : 'transform .45s cubic-bezier(.34,1.2,.64,1), opacity .35s ease',
  }

  return (
    <>
      <audio ref={remoteAudio} autoPlay playsInline style={{ display: 'none' }} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        userSelect: 'none', overflow: 'hidden',
        ...slideBase,
      }}
        onTouchStart={phase === 'active' ? onTS : undefined}
        onTouchMove={phase === 'active' ? onTM : undefined}
        onTouchEnd={phase === 'active' ? onTE : undefined}
      >
        {/* ── BACKGROUND ── */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
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
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.52)' }} />
          {/* Subtle vignette */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)' }} />
        </div>

        {/* Remote video (video calls) */}
        {isVideo && phase === 'active' && (
          <video ref={remoteVid} autoPlay playsInline
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }} />
        )}

        {/* Local PiP (video) */}
        {isVideo && phase === 'active' && (
          <div style={{
            position: 'absolute', top: 60, right: 16, width: 88, height: 132,
            borderRadius: 20, overflow: 'hidden', zIndex: 20,
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            border: '2px solid rgba(255,255,255,0.18)',
          }}>
            <video ref={localVid} autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        <div style={{
          position: 'relative', zIndex: 10, height: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>

          {/* Top bar */}
          <div style={{ width: '100%', padding: '54px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Drag handle */}
            {phase === 'active' && (
              <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 38, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
              </div>
            )}

            {/* HD badge */}
            {phase === 'active' && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '4px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                  {[4, 7, 10, 13].map((h, i) => (
                    <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: i < 3 ? accent : 'rgba(255,255,255,0.2)' }} />
                  ))}
                </div>
                <span style={{ color: accent, fontSize: 11, fontWeight: 600 }}>HD</span>
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

            {/* Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
              {phase === 'active' && (
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}`, animation: 'blink 2s ease-in-out infinite' }} />
              )}
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 17, letterSpacing: '0.1px' }}>
                {phase === 'connecting' ? 'Llamando...' : phase === 'active' ? fmtTime(elapsed) : 'Llamada finalizada'}
              </span>
            </div>

            {/* Waveform when active */}
            {phase === 'active' && !isVideo && <Waveform active={!muted} color={accent} />}

            {/* Connecting dots */}
            {phase === 'connecting' && (
              <div style={{ display: 'flex', gap: 8 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: accent, animation: `dot 1.4s ease-in-out ${i * 0.22}s infinite` }} />
                ))}
              </div>
            )}

            {/* Encrypted badge */}
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
              {/* Secondary buttons — only when call is active */}
              {phase === 'active' && (
              <div style={{
                display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 28,
              }}>
                <RoundBtn
                  icon={muted
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  }
                  label={muted ? 'Mic apagado' : 'Micrófono'}
                  state={muted ? 'danger' : 'off'}
                  onClick={toggleMute}
                />
                <RoundBtn
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    {speaker
                      ? <><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
                      : <line x1="23" y1="9" x2="17" y2="15"/>
                    }
                  </svg>}
                  label="Altavoz"
                  state={speaker ? 'on' : 'off'}
                  accent={accent}
                  onClick={toggleSpeaker}
                />
                {isVideo && (
                  <RoundBtn
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                      {camOff && <line x1="1" y1="1" x2="23" y2="23"/>}
                    </svg>}
                    label={camOff ? 'Cam apagada' : 'Cámara'}
                    state={camOff ? 'danger' : 'off'}
                    onClick={toggleCam}
                  />
                )}
              </div>
              )} {/* end phase === active secondary controls */}

              {/* Row 2: hang up — always visible (connecting + active) */}
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
        width: 58, height: 58, borderRadius: '50%',
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
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

function CallStyles() {
  return (
    <style>{`
      @keyframes ring { 0%{transform:scale(1);opacity:.7} 100%{transform:scale(1.7);opacity:0} }
      @keyframes dot { 0%,80%,100%{transform:scale(.5);opacity:.3} 40%{transform:scale(1);opacity:1} }
      @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.25} }
      @keyframes wfWave { 0%{transform:scaleY(.35)} 100%{transform:scaleY(1)} }
      @keyframes orbFloat { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(3%,5%) scale(1.05)} 70%{transform:translate(-2%,2%) scale(.97)} }
      @keyframes avPulse { 0%,100%{transform:scale(1);opacity:.7} 50%{transform:scale(1.12);opacity:1} }
      @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
      @keyframes slideDown { from{transform:translateY(-40px);opacity:0} to{transform:translateY(0);opacity:1} }
      @keyframes fadeIn { from{opacity:0} to{opacity:1} }
      @keyframes acceptPulse { 0%{box-shadow:0 4px 32px rgba(34,197,94,0.45),0 0 0 8px rgba(34,197,94,0.1)} 100%{box-shadow:0 4px 32px rgba(34,197,94,0.65),0 0 0 16px rgba(34,197,94,0.06)} }
    `}</style>
  )
}
