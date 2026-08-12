import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { sounds, ringtone, outgoingRing } from '../lib/sounds'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: [
        'turn:a.relay.metered.ca:80',
        'turn:a.relay.metered.ca:80?transport=tcp',
        'turn:a.relay.metered.ca:443',
        'turn:a.relay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
}

function fmtTime(s) {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function nameToHue(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

function vibrate(pattern) {
  try { navigator.vibrate?.(pattern) } catch (e) {}
}

// Animated audio waveform
function AudioWave({ active }) {
  const bars = [0.5, 1, 0.7, 1.4, 0.6, 1.2, 0.4, 1, 0.8]
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, height: 44 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 3.5, borderRadius: 4,
          background: active ? '#39FF14' : 'rgba(255,255,255,0.2)',
          height: active ? `${h * 32}px` : '5px',
          animation: active ? `wave ${0.7 + i * 0.08}s ease-in-out ${i * 0.06}s infinite alternate` : 'none',
          transition: 'height .4s ease, background .4s ease',
          boxShadow: active ? '0 0 6px #39FF1488' : 'none',
        }} />
      ))}
    </div>
  )
}

// Minimized floating pill
function MiniCall({ name, elapsed, avatar_url, initials, hue, isVideo, onExpand, onHangup }) {
  return (
    <div style={{
      position: 'fixed', top: 12, left: 12, right: 12, zIndex: 200,
      background: 'rgba(10,20,14,0.92)',
      backdropFilter: 'blur(24px)',
      borderRadius: 20,
      border: '1px solid rgba(57,255,20,0.25)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(57,255,20,0.1)',
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      cursor: 'pointer',
    }} onClick={onExpand}>
      {/* Avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: avatar_url ? `url(${avatar_url}) center/cover` : `hsl(${hue},60%,25%)`,
        border: '2px solid #39FF1460',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#fff',
        boxShadow: '0 0 8px #39FF1440',
        animation: 'miniPulse 2s ease-in-out infinite',
      }}>
        {!avatar_url && initials}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ color: '#39FF14', fontSize: 12, fontWeight: 500 }}>{fmtTime(elapsed)} · {isVideo ? 'Video' : 'Llamada'}</div>
      </div>

      {/* Wave */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
        {[1, 1.5, 0.8].map((h, i) => (
          <div key={i} style={{
            width: 3, borderRadius: 2, background: '#39FF14',
            animation: `wave ${0.8 + i * 0.15}s ease-in-out ${i * 0.1}s infinite alternate`,
            height: `${h * 12}px`,
          }} />
        ))}
      </div>

      {/* Hang up */}
      <button
        onClick={e => { e.stopPropagation(); vibrate(50); onHangup() }}
        style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #c0392b, #e74c3c)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px #ef444460',
        }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 2 2 0 0 1-.47-.43"/>
          <path d="M6.37 6.37a16 16 0 0 0-2.6 3.41L5.04 11.05a2 2 0 0 1 .45 2.11c-.339.907-.573 1.85-.7 2.81A2 2 0 0 1 3.08 18H.08A2 2 0 0 1-1.9 15.82a19.79 19.79 0 0 1 3.07-8.63"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      </button>
    </div>
  )
}

export default function CallPage({ conversationId, myUserId, contact, callType: initType, isIncoming, incomingOffer, onEnd }) {
  const [phase, setPhase] = useState(isIncoming ? 'incoming' : 'connecting')
  const [callType] = useState(initType || 'audio')
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [speaker, setSpeaker] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [minimized, setMinimized] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)

  const pc = useRef(null)
  const localStream = useRef(null)
  const sessionCh = useRef(null)
  const elapsedRef = useRef(null)
  const localVid = useRef(null)
  const remoteVid = useRef(null)
  const remoteAudio = useRef(null)
  const pendingIce = useRef([])
  const touchStartY = useRef(0)
  const containerRef = useRef(null)

  const name = contact?.display_name || 'Usuario'
  const avatar_url = contact?.avatar_url || null
  const initials = name.slice(0, 2).toUpperCase()
  const hue = nameToHue(name)
  const isVideo = callType === 'video'

  useEffect(() => {
    sessionCh.current = supabase.channel(`call-session:${conversationId}`)
      .on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
        if (!pc.current) return
        await pc.current.setRemoteDescription(new RTCSessionDescription(payload.answer))
        for (const c of pendingIce.current) {
          try { await pc.current.addIceCandidate(new RTCIceCandidate(c)) } catch (e) {}
        }
        pendingIce.current = []
      })
      .on('broadcast', { event: 'call-ice' }, async ({ payload }) => {
        if (payload.from === myUserId) return
        const candidate = new RTCIceCandidate(payload.candidate)
        if (pc.current?.remoteDescription) {
          try { await pc.current.addIceCandidate(candidate) } catch (e) {}
        } else {
          pendingIce.current.push(payload.candidate)
        }
      })
      .on('broadcast', { event: 'call-end' }, () => hangup(false))
      .on('broadcast', { event: 'call-reject' }, () => hangup(false))
      .subscribe()

    if (!isIncoming) { startOutgoing(); outgoingRing.start() }
    else ringtone.start()

    return () => {
      ringtone.stop()
      outgoingRing.stop()
      clearInterval(elapsedRef.current)
      if (sessionCh.current) supabase.removeChannel(sessionCh.current)
    }
  }, [])

  async function getMedia() {
    const constraints = callType === 'video'
      ? { audio: true, video: { facingMode: 'user', width: 640, height: 480 } }
      : { audio: true }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    localStream.current = stream
    if (localVid.current) { localVid.current.srcObject = stream; localVid.current.muted = true }
    return stream
  }

  function makePc(stream) {
    const conn = new RTCPeerConnection(ICE_SERVERS)
    stream.getTracks().forEach(t => conn.addTrack(t, stream))
    conn.ontrack = e => {
      const s = e.streams[0]
      if (remoteAudio.current) {
        remoteAudio.current.srcObject = s
        remoteAudio.current.play().catch(() => {})
      }
      if (remoteVid.current) {
        remoteVid.current.srcObject = s
        remoteVid.current.play().catch(() => {})
      }
    }
    conn.onicecandidate = e => {
      if (e.candidate) {
        sessionCh.current?.send({ type: 'broadcast', event: 'call-ice', payload: { candidate: e.candidate, from: myUserId } })
      }
    }
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'connected') goActive()
      if (conn.connectionState === 'failed') hangup(true)
    }
    pc.current = conn
    return conn
  }

  async function startOutgoing() {
    try {
      const stream = await getMedia()
      const conn = makePc(stream)
      const offer = await conn.createOffer()
      await conn.setLocalDescription(offer)
      const callCh = supabase.channel(`user-calls:${contact.id}`)
      await new Promise(r => callCh.subscribe(s => s === 'SUBSCRIBED' && r()))
      await callCh.send({
        type: 'broadcast', event: 'call-offer',
        payload: { from: myUserId, fromName: contact?.display_name || '', convId: conversationId, callType, offer },
      })
      supabase.removeChannel(callCh)
    } catch (e) {
      alert(`Error al iniciar llamada: ${e.message}`)
      onEnd()
    }
  }

  async function acceptCall() {
    vibrate([40, 30, 40])
    ringtone.stop()
    setPhase('connecting')
    try {
      const stream = await getMedia()
      const conn = makePc(stream)
      await conn.setRemoteDescription(new RTCSessionDescription(incomingOffer))
      for (const c of pendingIce.current) {
        try { await conn.addIceCandidate(new RTCIceCandidate(c)) } catch (e) {}
      }
      pendingIce.current = []
      const answer = await conn.createAnswer()
      await conn.setLocalDescription(answer)
      sessionCh.current?.send({ type: 'broadcast', event: 'call-answer', payload: { answer } })
    } catch (e) {
      alert(`Error al aceptar llamada: ${e.message}`)
      hangup(true)
    }
  }

  function goActive() {
    outgoingRing.stop()
    setPhase('active')
    sounds.callConnect()
    vibrate([0, 80])
    elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }

  function rejectCall() {
    vibrate(60)
    ringtone.stop()
    sessionCh.current?.send({ type: 'broadcast', event: 'call-reject', payload: {} })
    hangup(false)
  }

  function hangup(sendSignal = true) {
    vibrate(80)
    ringtone.stop()
    outgoingRing.stop()
    clearInterval(elapsedRef.current)
    sounds.callEnd()
    if (sendSignal) sessionCh.current?.send({ type: 'broadcast', event: 'call-end', payload: {} })
    localStream.current?.getTracks().forEach(t => t.stop())
    pc.current?.close()
    setPhase('ended')
    setTimeout(onEnd, 800)
  }

  function toggleMute() {
    vibrate(30)
    const t = localStream.current?.getAudioTracks()[0]
    if (t) { t.enabled = !t.enabled; setMuted(m => !m) }
  }

  function toggleCam() {
    vibrate(30)
    const t = localStream.current?.getVideoTracks()[0]
    if (t) { t.enabled = !t.enabled; setCamOff(c => !c) }
  }

  function toggleSpeaker() {
    vibrate(30)
    const next = !speaker
    setSpeaker(next)
    const el = remoteAudio.current
    if (!el) return
    if (typeof el.setSinkId === 'function') {
      el.setSinkId(next ? 'default' : '').catch(() => {})
    }
  }

  // Swipe down to minimize
  const onTouchStart = useCallback(e => {
    touchStartY.current = e.touches[0].clientY
    setDragging(true)
  }, [])

  const onTouchMove = useCallback(e => {
    const dy = Math.max(0, e.touches[0].clientY - touchStartY.current)
    setDragY(dy)
  }, [])

  const onTouchEnd = useCallback(() => {
    setDragging(false)
    if (dragY > 80) {
      setMinimized(true)
      setDragY(0)
    } else {
      setDragY(0)
    }
  }, [dragY])

  if (minimized && phase === 'active') {
    return (
      <>
        <MiniCall
          name={name} elapsed={elapsed} avatar_url={avatar_url}
          initials={initials} hue={hue} isVideo={isVideo}
          onExpand={() => setMinimized(false)}
          onHangup={() => hangup(true)}
        />
        <style>{`@keyframes miniPulse { 0%,100%{box-shadow:0 0 8px #39FF1440} 50%{box-shadow:0 0 16px #39FF1480} }`}</style>
      </>
    )
  }

  const slideStyle = dragging && dragY > 0 ? {
    transform: `translateY(${dragY * 0.6}px)`,
    opacity: 1 - dragY / 300,
    transition: 'none',
  } : {
    transform: 'translateY(0)',
    opacity: 1,
    transition: 'transform .3s ease, opacity .3s ease',
  }

  return (
    <div ref={containerRef} style={{
      position: 'fixed', inset: 0, zIndex: 100,
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      userSelect: 'none', overflow: 'hidden',
      ...slideStyle,
    }}
      onTouchStart={phase === 'active' ? onTouchStart : undefined}
      onTouchMove={phase === 'active' ? onTouchMove : undefined}
      onTouchEnd={phase === 'active' ? onTouchEnd : undefined}
    >
      {/* ── BACKGROUND ── */}
      {isVideo && phase === 'active' ? (
        <video ref={remoteVid} autoPlay playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
          {/* Base dark */}
          <div style={{ position: 'absolute', inset: 0, background: '#050c09' }} />
          {/* Avatar color orbs */}
          {avatar_url ? (
            <img src={avatar_url} alt="" style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', filter: 'blur(60px) brightness(0.25) saturate(1.5)',
              transform: 'scale(1.2)',
            }} />
          ) : (
            <>
              <div style={{
                position: 'absolute', top: '-10%', left: '-10%',
                width: '70%', paddingBottom: '70%', borderRadius: '50%',
                background: `radial-gradient(circle, hsl(${hue},70%,30%) 0%, transparent 70%)`,
                opacity: 0.5,
                animation: 'orbFloat 8s ease-in-out infinite',
              }} />
              <div style={{
                position: 'absolute', bottom: '-20%', right: '-15%',
                width: '80%', paddingBottom: '80%', borderRadius: '50%',
                background: `radial-gradient(circle, hsl(${(hue + 40) % 360},60%,20%) 0%, transparent 70%)`,
                opacity: 0.4,
                animation: 'orbFloat 10s ease-in-out 2s infinite reverse',
              }} />
              <div style={{
                position: 'absolute', top: '30%', right: '-20%',
                width: '60%', paddingBottom: '60%', borderRadius: '50%',
                background: `radial-gradient(circle, #39FF1415 0%, transparent 70%)`,
                animation: 'orbFloat 12s ease-in-out 4s infinite',
              }} />
            </>
          )}
          {/* Dark overlay for readability */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          {/* Noise texture */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.03,
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
          }} />
        </div>
      )}

      {/* Local video PiP */}
      {isVideo && phase === 'active' && (
        <div style={{
          position: 'absolute', top: 56, right: 16, width: 90, height: 130,
          borderRadius: 18, overflow: 'hidden', zIndex: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 0 2px rgba(255,255,255,0.15)',
        }}>
          <video ref={localVid} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        </div>
      )}

      {/* ── CONTENT ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center',
      }}>

        {/* ── TOP BAR ── */}
        <div style={{
          width: '100%', display: 'flex', alignItems: 'center',
          padding: '52px 20px 0',
          justifyContent: 'space-between',
        }}>
          {/* Drag handle (visible when active) */}
          {phase === 'active' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', position: 'absolute', top: 12, left: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
            </div>
          )}

          {/* Signal badge */}
          {phase === 'active' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 20, padding: '4px 10px',
              marginLeft: 'auto',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                {[4, 7, 10, 13].map((h, i) => (
                  <div key={i} style={{
                    width: 3, height: h, borderRadius: 2,
                    background: i < 3 ? '#39FF14' : 'rgba(255,255,255,0.2)',
                  }} />
                ))}
              </div>
              <span style={{ color: '#39FF14', fontSize: 11, fontWeight: 600 }}>HD</span>
            </div>
          )}
        </div>

        {/* ── AVATAR + NAME ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 0, paddingBottom: 16,
        }}>
          {/* Avatar */}
          <div style={{ position: 'relative', marginBottom: 28 }}>
            {/* Rings for incoming/connecting */}
            {(phase === 'incoming' || phase === 'connecting') && [0, 1, 2].map(i => (
              <div key={i} style={{
                position: 'absolute',
                inset: -(20 + i * 16),
                borderRadius: '50%',
                border: `1.5px solid rgba(57,255,20,${0.3 - i * 0.08})`,
                animation: `ring 2.4s ease-out ${i * 0.5}s infinite`,
              }} />
            ))}

            {/* Active pulse */}
            {phase === 'active' && (
              <div style={{
                position: 'absolute', inset: -8, borderRadius: '50%',
                background: `radial-gradient(circle, rgba(57,255,20,0.15) 0%, transparent 70%)`,
                animation: 'activePulse 2s ease-in-out infinite',
              }} />
            )}

            {/* Avatar circle */}
            <div style={{
              width: 120, height: 120, borderRadius: '50%',
              background: avatar_url
                ? `url(${avatar_url}) center/cover`
                : `linear-gradient(145deg, hsl(${hue},55%,28%), hsl(${hue},40%,14%))`,
              border: phase === 'active'
                ? '3px solid rgba(57,255,20,0.6)'
                : '3px solid rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 42, fontWeight: 800, color: '#fff',
              letterSpacing: '-1px',
              boxShadow: phase === 'active'
                ? '0 0 0 6px rgba(57,255,20,0.1), 0 24px 48px rgba(0,0,0,0.5)'
                : '0 24px 48px rgba(0,0,0,0.5)',
              transition: 'border .5s, box-shadow .5s',
            }}>
              {!avatar_url && initials}
            </div>

            {/* Ended indicator */}
            {phase === 'ended' && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </div>
            )}
          </div>

          {/* Name */}
          <h2 style={{
            color: '#fff', fontSize: 28, fontWeight: 700,
            margin: '0 0 8px', letterSpacing: '-0.5px',
            textShadow: '0 2px 12px rgba(0,0,0,0.5)',
          }}>{name}</h2>

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            {phase === 'active' && (
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#39FF14',
                boxShadow: '0 0 8px #39FF1499',
                animation: 'blink 2s ease-in-out infinite',
              }} />
            )}
            <span style={{
              color: phase === 'ended' ? '#ef4444' : 'rgba(255,255,255,0.7)',
              fontSize: 16, letterSpacing: '0.1px',
              textShadow: '0 1px 8px rgba(0,0,0,0.5)',
            }}>
              {phase === 'incoming'
                ? (isVideo ? '📹 Videollamada entrante' : '📞 Llamada entrante')
                : phase === 'connecting' ? 'Conectando...'
                : phase === 'active' ? fmtTime(elapsed)
                : 'Llamada finalizada'}
            </span>
          </div>

          {/* Waveform (active audio) or dots (connecting) */}
          {phase === 'active' && !isVideo && (
            <AudioWave active={!muted} />
          )}
          {phase === 'connecting' && (
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#39FF14',
                  animation: `dot 1.4s ease-in-out ${i * 0.22}s infinite`,
                }} />
              ))}
            </div>
          )}

          {/* Type badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginTop: 20, padding: '5px 14px',
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>🔐</span>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 500 }}>
              {isVideo ? 'Videollamada' : 'Llamada de voz'} · Cifrada
            </span>
          </div>

          {/* Minimize hint when active */}
          {phase === 'active' && (
            <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>
              Deslizá hacia abajo para minimizar
            </div>
          )}
        </div>

        {/* ── CONTROLS AREA ── */}
        <div style={{ width: '100%', padding: '0 16px 40px' }}>

          {phase === 'incoming' ? (
            /* Incoming call buttons */
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 56,
            }}>
              {/* Reject */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <button onClick={rejectCall} style={{
                  width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(145deg, #991b1b, #ef4444)',
                  boxShadow: '0 8px 32px rgba(239,68,68,0.45), 0 0 0 8px rgba(239,68,68,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'incomingShake 0.5s ease-in-out infinite alternate',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500 }}>Rechazar</span>
              </div>

              {/* Accept */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <button onClick={acceptCall} style={{
                  width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(145deg, #166534, #22c55e)',
                  boxShadow: '0 8px 32px rgba(34,197,94,0.45), 0 0 0 8px rgba(34,197,94,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'incomingPulse 1s ease-in-out infinite alternate',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.8a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </button>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500 }}>Aceptar</span>
              </div>
            </div>
          ) : phase === 'ended' ? null : (
            /* Active / connecting controls */
            <>
              {/* Secondary row */}
              <div style={{
                display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 24,
              }}>
                <SmallBtn icon={
                  muted
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                } label={muted ? 'Mic off' : 'Micrófono'} active={muted} danger onClick={toggleMute} />

                <SmallBtn icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    {speaker
                      ? <><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
                      : <line x1="23" y1="9" x2="17" y2="15"/>}
                  </svg>
                } label="Altavoz" active={speaker} green onClick={toggleSpeaker} />

                {isVideo && (
                  <SmallBtn icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                      {camOff && <line x1="1" y1="1" x2="23" y2="23"/>}
                    </svg>
                  } label={camOff ? 'Cam off' : 'Cámara'} active={camOff} danger onClick={toggleCam} />
                )}
              </div>

              {/* Hang up — big centered */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => hangup(true)} style={{
                    width: 68, height: 68, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(145deg, #991b1b, #ef4444)',
                    boxShadow: '0 8px 32px rgba(239,68,68,0.4), 0 0 0 6px rgba(239,68,68,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'transform .15s, box-shadow .15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.07)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 2 2 0 0 1-.47-.43"/>
                      <path d="M6.37 6.37a16 16 0 0 0-2.6 3.41L5.04 11.05a2 2 0 0 1 .45 2.11c-.339.907-.573 1.85-.7 2.81A2 2 0 0 1 3.08 18H.08A2 2 0 0 1-1.9 15.82a19.79 19.79 0 0 1 3.07-8.63"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  </button>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 500 }}>Colgar</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hidden audio — always mounted */}
      <audio ref={remoteAudio} autoPlay playsInline style={{ display: 'none' }} />

      <style>{`
        @keyframes ring {
          0% { transform: scale(1); opacity: .7 }
          100% { transform: scale(1.6); opacity: 0 }
        }
        @keyframes dot {
          0%,80%,100% { transform: scale(0.5); opacity: .3 }
          40% { transform: scale(1); opacity: 1 }
        }
        @keyframes blink {
          0%,100% { opacity: 1 }
          50% { opacity: .3 }
        }
        @keyframes wave {
          0% { transform: scaleY(0.4) }
          100% { transform: scaleY(1) }
        }
        @keyframes orbFloat {
          0%,100% { transform: translate(0,0) scale(1) }
          33% { transform: translate(3%,4%) scale(1.04) }
          66% { transform: translate(-2%,2%) scale(0.97) }
        }
        @keyframes activePulse {
          0%,100% { transform: scale(1); opacity: .7 }
          50% { transform: scale(1.15); opacity: 1 }
        }
        @keyframes incomingShake {
          0% { transform: rotate(-4deg) }
          100% { transform: rotate(4deg) }
        }
        @keyframes incomingPulse {
          0% { box-shadow: 0 8px 32px rgba(34,197,94,0.45), 0 0 0 8px rgba(34,197,94,0.12) }
          100% { box-shadow: 0 8px 32px rgba(34,197,94,0.6), 0 0 0 14px rgba(34,197,94,0.06) }
        }
        @keyframes miniPulse {
          0%,100% { box-shadow: 0 0 8px #39FF1440 }
          50% { box-shadow: 0 0 20px #39FF1470 }
        }
      `}</style>
    </div>
  )
}

function SmallBtn({ icon, label, active, danger, green, onClick }) {
  const color = danger && active ? '#ef4444' : green && active ? '#39FF14' : 'rgba(255,255,255,0.85)'
  const bg = danger && active
    ? 'rgba(239,68,68,0.18)'
    : green && active
    ? 'rgba(57,255,20,0.15)'
    : 'rgba(255,255,255,0.08)'
  const border = danger && active
    ? '1.5px solid rgba(239,68,68,0.35)'
    : green && active
    ? '1.5px solid rgba(57,255,20,0.3)'
    : '1.5px solid rgba(255,255,255,0.1)'

  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    }}>
      <div style={{
        width: 58, height: 58, borderRadius: '50%',
        background: bg, border, backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, transition: 'transform .15s, background .2s',
        boxShadow: active && green ? '0 0 16px rgba(57,255,20,0.25)' : active && danger ? '0 0 16px rgba(239,68,68,0.2)' : 'none',
      }}
        onTouchStart={e => e.currentTarget.style.transform = 'scale(0.93)'}
        onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {icon}
      </div>
      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 500 }}>{label}</span>
    </button>
  )
}
