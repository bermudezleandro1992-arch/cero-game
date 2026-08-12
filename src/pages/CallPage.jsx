import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sounds, ringtone, outgoingRing } from '../lib/sounds'

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

function Avatar({ name, size = 80 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(255,255,255,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: '#fff',
    }}>
      {name?.slice(0, 2).toUpperCase() || '?'}
    </div>
  )
}

export default function CallPage({ conversationId, myUserId, contact, callType: initType, isIncoming, incomingOffer, onEnd }) {
  const [phase, setPhase] = useState(isIncoming ? 'incoming' : 'connecting')
  // incoming | connecting | active | ended
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
      // Send offer to callee's personal channel
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
    outgoingRing.stop()
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
    outgoingRing.stop()
    clearInterval(elapsedRef.current)
    sounds.callEnd()
    if (sendSignal) sessionCh.current?.send({ type: 'broadcast', event: 'call-end', payload: {} })
    localStream.current?.getTracks().forEach(t => t.stop())
    pc.current?.close()
    setPhase('ended')
    setTimeout(onEnd, 600)
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
  const isVideo = callType === 'video'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: isVideo ? '#000' : 'linear-gradient(160deg, #1a3a2a 0%, #0d1f17 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
      padding: '48px 24px 40px', userSelect: 'none',
    }}>

      {/* Remote video (background for video calls) */}
      {isVideo && (
        <video ref={remoteVid} autoPlay playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
      )}

      {/* Local video (picture-in-picture) */}
      {isVideo && phase === 'active' && (
        <div style={{ position: 'absolute', top: 16, right: 16, width: 100, height: 140, borderRadius: 12, overflow: 'hidden', zIndex: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', border: '2px solid rgba(255,255,255,0.3)' }}>
          <video ref={localVid} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        </div>
      )}

      {/* Top info */}
      <div style={{ textAlign: 'center', zIndex: 10, position: 'relative' }}>
        <Avatar name={name} size={88} />
        <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: '16px 0 6px' }}>{name}</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, margin: 0 }}>
          {phase === 'incoming' ? (isVideo ? '📹 Videollamada entrante' : '📞 Llamada entrante')
           : phase === 'connecting' ? 'Conectando...'
           : phase === 'active' ? fmtTime(elapsed)
           : 'Llamada finalizada'}
        </p>
        {phase === 'connecting' && !isIncoming && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.6)',
                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Hidden audio for non-video calls */}
      {!isVideo && <audio ref={remoteVid} autoPlay style={{ display: 'none' }} />}

      {/* Controls */}
      <div style={{ zIndex: 10, position: 'relative', width: '100%' }}>
        {phase === 'incoming' ? (
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <CallBtn icon="✕" label="Rechazar" color="#ef4444" size={64} onClick={rejectCall} />
            <CallBtn icon="✓" label="Aceptar" color="#00a884" size={64} onClick={acceptCall} />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
              <CallBtn icon={muted ? '🔇' : '🎙️'} label={muted ? 'Activar' : 'Silenciar'} color={muted ? '#ef4444' : 'rgba(255,255,255,0.15)'} onClick={toggleMute} />
              {isVideo && (
                <CallBtn icon={camOff ? '📵' : '📹'} label={camOff ? 'Activar cam' : 'Apagar cam'} color={camOff ? '#ef4444' : 'rgba(255,255,255,0.15)'} onClick={toggleCam} />
              )}
              <CallBtn icon={speaker ? '🔊' : '🔈'} label="Altavoz" color={speaker ? '#00a884' : 'rgba(255,255,255,0.15)'} onClick={() => setSpeaker(s => !s)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <CallBtn icon="📵" label="Colgar" color="#ef4444" size={64} onClick={() => hangup(true)} />
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:.3; transform:scale(1) } 50% { opacity:1; transform:scale(1.3) } }
      `}</style>
    </div>
  )
}

function CallBtn({ icon, label, color, size = 52, onClick }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer' }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)', transition: 'transform .1s',
      }}>{icon}</div>
      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>{label}</span>
    </button>
  )
}
