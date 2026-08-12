import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sounds, ringtone } from '../lib/sounds'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
}

function fmtTime(s) {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export default function CallPage({ conversationId, myUserId, contact, callType: initType, isIncoming, incomingOffer, onEnd }) {
  const [phase, setPhase] = useState(isIncoming ? 'incoming' : 'connecting')
  const [callType] = useState(initType || 'audio')
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [speaker, setSpeaker] = useState(true)
  const [elapsed, setElapsed] = useState(0)

  const pc = useRef(null)
  const localStream = useRef(null)
  const sessionCh = useRef(null)
  const elapsedRef = useRef(null)
  const localVid = useRef(null)
  const remoteVid = useRef(null)
  const pendingIce = useRef([])

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

    if (!isIncoming) startOutgoing()
    else ringtone.start()

    return () => {
      ringtone.stop()
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
      if (remoteVid.current) remoteVid.current.srcObject = e.streams[0]
    }
    conn.onicecandidate = e => {
      if (e.candidate) {
        sessionCh.current?.send({ type: 'broadcast', event: 'call-ice', payload: { candidate: e.candidate, from: myUserId } })
      }
    }
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'connected') goActive()
      if (['failed', 'disconnected'].includes(conn.connectionState)) hangup(true)
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
    setPhase('active')
    sounds.callConnect()
    elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }

  function rejectCall() {
    ringtone.stop()
    sessionCh.current?.send({ type: 'broadcast', event: 'call-reject', payload: {} })
    hangup(false)
  }

  function hangup(sendSignal = true) {
    ringtone.stop()
    clearInterval(elapsedRef.current)
    sounds.callEnd()
    if (sendSignal) sessionCh.current?.send({ type: 'broadcast', event: 'call-end', payload: {} })
    localStream.current?.getTracks().forEach(t => t.stop())
    pc.current?.close()
    setPhase('ended')
    setTimeout(onEnd, 800)
  }

  function toggleMute() {
    const t = localStream.current?.getAudioTracks()[0]
    if (t) { t.enabled = !t.enabled; setMuted(m => !m) }
  }

  function toggleCam() {
    const t = localStream.current?.getVideoTracks()[0]
    if (t) { t.enabled = !t.enabled; setCamOff(c => !c) }
  }

  const name = contact?.display_name || 'Usuario'
  const initials = name.slice(0, 2).toUpperCase()
  const isVideo = callType === 'video'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: isVideo ? '#000' : 'linear-gradient(160deg, #071510 0%, #0a1f16 40%, #071510 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 0 48px', userSelect: 'none', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>

      {/* Background glow */}
      {!isVideo && (
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, #39FF1408 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Remote video */}
      {isVideo && (
        <video ref={remoteVid} autoPlay playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
      )}

      {/* Local video PiP */}
      {isVideo && phase === 'active' && (
        <div style={{
          position: 'absolute', top: 20, right: 20, width: 100, height: 140,
          borderRadius: 16, overflow: 'hidden', zIndex: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          border: '2px solid rgba(255,255,255,0.2)',
        }}>
          <video ref={localVid} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        </div>
      )}

      {/* ── TOP: Avatar + name + status ── */}
      <div style={{ textAlign: 'center', zIndex: 10, position: 'relative', paddingTop: 64, width: '100%' }}>
        {/* Pulsing ring behind avatar */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 24 }}>
          {(phase === 'incoming' || phase === 'connecting') && (
            <>
              <div style={{
                position: 'absolute', inset: -16, borderRadius: '50%',
                border: '1.5px solid #39FF1430',
                animation: 'ring 2s ease-out infinite',
              }} />
              <div style={{
                position: 'absolute', inset: -32, borderRadius: '50%',
                border: '1px solid #39FF1418',
                animation: 'ring 2s ease-out .5s infinite',
              }} />
            </>
          )}
          {/* Avatar */}
          <div style={{
            width: 110, height: 110, borderRadius: '50%',
            background: 'linear-gradient(145deg, #0B7A2A, #111B21)',
            border: '2.5px solid #39FF1440',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 38, fontWeight: 800, color: '#fff',
            boxShadow: '0 0 40px #39FF1420, inset 0 1px 0 #39FF1430',
            letterSpacing: '-1px',
          }}>
            {initials}
          </div>
          {/* Active green dot */}
          {phase === 'active' && (
            <div style={{
              position: 'absolute', bottom: 4, right: 4,
              width: 18, height: 18, borderRadius: '50%',
              background: '#39FF14', border: '3px solid #071510',
              boxShadow: '0 0 8px #39FF1488',
            }} />
          )}
        </div>

        <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.5px' }}>{name}</h2>

        {/* Status line */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {phase === 'active' && (
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#39FF14', boxShadow: '0 0 6px #39FF1488', animation: 'blink 2s ease-in-out infinite' }} />
          )}
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, margin: 0, letterSpacing: '0.2px' }}>
            {phase === 'incoming' ? (isVideo ? 'Videollamada entrante' : 'Llamada de audio entrante')
             : phase === 'connecting' ? 'Conectando...'
             : phase === 'active' ? fmtTime(elapsed)
             : 'Llamada finalizada'}
          </p>
        </div>

        {/* Dots animation while connecting */}
        {phase === 'connecting' && !isIncoming && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#39FF14',
                animation: `dot 1.4s ease-in-out ${i * 0.22}s infinite`,
              }} />
            ))}
          </div>
        )}

        {/* Type chip */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginTop: 16, padding: '5px 14px',
          background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.2)',
          borderRadius: 20,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#39FF14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isVideo
              ? <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>
              : <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.8a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></>
            }
          </svg>
          <span style={{ color: '#39FF14', fontSize: 12, fontWeight: 600 }}>
            {isVideo ? 'Video HD' : 'Audio HD'} · Cifrado
          </span>
        </div>
      </div>

      {/* Hidden audio */}
      {!isVideo && <audio ref={remoteVid} autoPlay style={{ display: 'none' }} />}

      {/* ── CONTROLS ── */}
      <div style={{ zIndex: 10, position: 'relative', width: '100%', maxWidth: 340, padding: '0 24px' }}>

        {phase === 'incoming' ? (
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <CallBtn
              icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
              label="Rechazar"
              bg="linear-gradient(145deg, #c0392b, #e74c3c)"
              glow="#ef444444"
              size={70}
              onClick={rejectCall}
            />
            <CallBtn
              icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.8a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
              label="Aceptar"
              bg="linear-gradient(145deg, #0B7A2A, #39FF14aa)"
              glow="#39FF1444"
              size={70}
              onClick={acceptCall}
            />
          </div>
        ) : (
          <>
            {/* Secondary controls */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 28 }}>
              <CallBtn
                icon={muted
                  ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                }
                label={muted ? 'Activar mic' : 'Silenciar'}
                bg={muted ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.1)'}
                active={muted}
                activeColor="#ef4444"
                size={56}
                onClick={toggleMute}
              />
              {isVideo && (
                <CallBtn
                  icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>{camOff && <line x1="1" y1="1" x2="23" y2="23"/>}</svg>}
                  label={camOff ? 'Activar cam' : 'Apagar cam'}
                  bg={camOff ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.1)'}
                  active={camOff}
                  activeColor="#ef4444"
                  size={56}
                  onClick={toggleCam}
                />
              )}
              <CallBtn
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>{speaker ? <><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></> : <line x1="23" y1="9" x2="17" y2="15"/>}</svg>}
                label="Altavoz"
                bg={speaker ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.1)'}
                active={speaker}
                activeColor="#39FF14"
                size={56}
                onClick={() => setSpeaker(s => !s)}
              />
            </div>

            {/* Hang up */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <CallBtn
                icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 2 2 0 0 1-.47-.43"/><path d="M6.37 6.37a16 16 0 0 0-2.6 3.41L5.04 11.05a2 2 0 0 1 .45 2.11c-.339.907-.573 1.85-.7 2.81A2 2 0 0 1 3.08 18H.08A2 2 0 0 1-1.9 15.82a19.79 19.79 0 0 1 3.07-8.63"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                label="Colgar"
                bg="linear-gradient(145deg, #c0392b, #e74c3c)"
                glow="#ef444444"
                size={70}
                onClick={() => hangup(true)}
              />
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes ring { 0% { transform: scale(1); opacity: .8 } 100% { transform: scale(1.5); opacity: 0 } }
        @keyframes dot { 0%,80%,100% { transform: scale(0.5); opacity:.3 } 40% { transform: scale(1); opacity:1 } }
        @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:.4 } }
      `}</style>
    </div>
  )
}

function CallBtn({ icon, label, bg, glow, active, activeColor, size = 54, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        background: 'none', border: 'none', cursor: 'pointer',
      }}
    >
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: bg || 'rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: glow ? `0 8px 24px ${glow}` : active ? `0 0 16px ${activeColor}44` : '0 4px 16px rgba(0,0,0,0.4)',
        border: active ? `1.5px solid ${activeColor}60` : '1.5px solid rgba(255,255,255,0.1)',
        transition: 'transform .15s, box-shadow .15s',
        backdropFilter: 'blur(8px)',
      }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {icon}
      </div>
      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 500, letterSpacing: '0.2px' }}>{label}</span>
    </button>
  )
}
