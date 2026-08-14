import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'turn:a.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turns:a.relay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  bundlePolicy: 'max-bundle',
}

function fmtTime(s) {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

// One video tile per remote peer
function PeerTile({ stream, name, muted, screenShare }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && stream) { ref.current.srcObject = stream; ref.current.play().catch(() => {}) }
  }, [stream])
  return (
    <div style={{
      position: 'relative', background: '#0a0f0d', borderRadius: 16, overflow: 'hidden',
      border: `1.5px solid ${C.border}`, aspectRatio: screenShare ? 'unset' : '4/3',
      flex: screenShare ? '1 1 100%' : '1 1 140px', minHeight: screenShare ? 220 : 100,
    }}>
      <video ref={ref} autoPlay playsInline muted={muted}
        style={{ width: '100%', height: '100%', objectFit: screenShare ? 'contain' : 'cover', background: '#000' }} />
      <div style={{
        position: 'absolute', bottom: 6, left: 8,
        background: 'rgba(0,0,0,0.55)', borderRadius: 8, padding: '2px 8px',
        fontSize: 12, color: '#fff', fontWeight: 600,
      }}>{screenShare ? '🖥 ' : ''}{name}</div>
    </div>
  )
}

// Local preview tile
function LocalTile({ stream, name, muted, camOff, screenShare }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && stream) { ref.current.srcObject = stream }
  }, [stream])
  return (
    <div style={{
      position: 'relative', background: '#0a0f0d', borderRadius: 16, overflow: 'hidden',
      border: `1.5px solid ${C.green}44`, flex: '1 1 140px', minHeight: 100, aspectRatio: '4/3',
    }}>
      {camOff && !screenShare
        ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🎤</div>
        : <video ref={ref} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
      }
      <div style={{
        position: 'absolute', bottom: 6, left: 8,
        background: 'rgba(0,0,0,0.55)', borderRadius: 8, padding: '2px 8px',
        fontSize: 12, color: C.green, fontWeight: 600,
      }}>{screenShare ? '🖥 Tú' : 'Tú'}{muted ? ' 🔇' : ''}</div>
    </div>
  )
}

export default function GroupCallPage({ conversationId, myUserId, myName, members, onEnd }) {
  const [peers, setPeers] = useState({}) // peerId -> { pc, stream, name, screenShare }
  const [localStream, setLocalStream] = useState(null)
  const [screenStream, setScreenStream] = useState(null)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [joined, setJoined] = useState(false)

  const pcsRef = useRef({}) // peerId -> RTCPeerConnection
  const localRef = useRef(null)
  const screenRef = useRef(null)
  const channelRef = useRef(null)
  const timerRef = useRef(null)
  const pendingIce = useRef({}) // peerId -> []

  const vibrate = p => { try { navigator.vibrate?.(p) } catch (_) {} }

  // ── Signaling channel ──
  useEffect(() => {
    const ch = supabase.channel(`group-call:${conversationId}`)
    channelRef.current = ch

    ch.on('broadcast', { event: 'gc-offer' }, async ({ payload }) => {
      if (payload.to !== myUserId) return
      await handleOffer(payload.from, payload.fromName, payload.offer, payload.screenShare)
    })
    ch.on('broadcast', { event: 'gc-answer' }, async ({ payload }) => {
      if (payload.to !== myUserId) return
      const pc = pcsRef.current[payload.from]
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.answer))
      for (const c of pendingIce.current[payload.from] || []) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch (_) {}
      }
      pendingIce.current[payload.from] = []
    })
    ch.on('broadcast', { event: 'gc-ice' }, async ({ payload }) => {
      if (payload.to !== myUserId) return
      const pc = pcsRef.current[payload.from]
      const cand = new RTCIceCandidate(payload.candidate)
      if (pc?.remoteDescription) {
        try { await pc.addIceCandidate(cand) } catch (_) {}
      } else {
        pendingIce.current[payload.from] = [...(pendingIce.current[payload.from] || []), payload.candidate]
      }
    })
    ch.on('broadcast', { event: 'gc-leave' }, ({ payload }) => {
      removePeer(payload.from)
    })
    ch.on('broadcast', { event: 'gc-join' }, ({ payload }) => {
      if (payload.from === myUserId) return
      // Someone joined — if we're already in, offer them
      if (joined && localRef.current) {
        callPeer(payload.from, payload.name)
      }
    })

    ch.subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [conversationId, myUserId, joined])

  function removePeer(peerId) {
    pcsRef.current[peerId]?.close()
    delete pcsRef.current[peerId]
    setPeers(prev => { const n = { ...prev }; delete n[peerId]; return n })
  }

  function makePc(peerId, peerName, stream, isScreen) {
    const pc = new RTCPeerConnection(ICE)
    pcsRef.current[peerId] = pc

    stream.getTracks().forEach(t => pc.addTrack(t, stream))

    pc.ontrack = e => {
      const s = e.streams[0]
      setPeers(prev => ({ ...prev, [peerId]: { ...prev[peerId], stream: s, name: peerName, screenShare: isScreen } }))
    }
    pc.onicecandidate = e => {
      if (e.candidate) {
        channelRef.current?.send({ type: 'broadcast', event: 'gc-ice', payload: { to: peerId, from: myUserId, candidate: e.candidate } })
      }
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') removePeer(peerId)
    }
    return pc
  }

  async function callPeer(peerId, peerName) {
    const stream = screenRef.current || localRef.current
    if (!stream) return
    const isScreen = !!screenRef.current
    const pc = makePc(peerId, peerName, stream, isScreen)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    channelRef.current?.send({ type: 'broadcast', event: 'gc-offer', payload: { to: peerId, from: myUserId, fromName: myName, offer, screenShare: isScreen } })
  }

  async function handleOffer(fromId, fromName, offer, isScreen) {
    const stream = localRef.current
    if (!stream) return
    const pc = makePc(fromId, fromName, stream, false)
    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    channelRef.current?.send({ type: 'broadcast', event: 'gc-answer', payload: { to: fromId, from: myUserId, answer } })
    setPeers(prev => ({ ...prev, [fromId]: { ...prev[fromId], name: fromName, screenShare: isScreen } }))
  }

  async function join() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      localRef.current = stream
      setLocalStream(stream)
      setJoined(true)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
      vibrate([0, 60])
      // Announce join
      channelRef.current?.send({ type: 'broadcast', event: 'gc-join', payload: { from: myUserId, name: myName } })
    } catch (e) {
      // Try audio only if camera fails
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        localRef.current = stream
        setLocalStream(stream)
        setCamOff(true)
        setJoined(true)
        timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
        channelRef.current?.send({ type: 'broadcast', event: 'gc-join', payload: { from: myUserId, name: myName } })
      } catch (e2) { alert(`No se pudo acceder al micrófono: ${e2.message}`); onEnd() }
    }
  }

  async function toggleScreen() {
    if (sharing) {
      // Stop screen share, restore camera
      screenRef.current?.getTracks().forEach(t => t.stop())
      screenRef.current = null
      setScreenStream(null)
      setSharing(false)
      // Replace track in all peers
      const camTrack = localRef.current?.getVideoTracks()[0]
      if (camTrack) {
        Object.values(pcsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video')
          sender?.replaceTrack(camTrack).catch(() => {})
        })
      }
    } else {
      try {
        const ss = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        screenRef.current = ss
        setScreenStream(ss)
        setSharing(true)
        // Replace video track in all peers
        const screenTrack = ss.getVideoTracks()[0]
        Object.values(pcsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video')
          sender?.replaceTrack(screenTrack).catch(() => {})
        })
        // Auto-stop when user clicks browser's "Stop sharing"
        screenTrack.onended = () => toggleScreen()
      } catch (e) {
        if (e.name !== 'NotAllowedError') alert(`No se pudo compartir pantalla: ${e.message}`)
      }
    }
  }

  function toggleMute() {
    const track = localRef.current?.getAudioTracks()[0]
    if (track) { track.enabled = muted; setMuted(m => !m) }
  }

  function toggleCam() {
    const track = localRef.current?.getVideoTracks()[0]
    if (track) { track.enabled = camOff; setCamOff(c => !c) }
  }

  function leave() {
    vibrate([0, 80])
    channelRef.current?.send({ type: 'broadcast', event: 'gc-leave', payload: { from: myUserId } })
    Object.values(pcsRef.current).forEach(pc => pc.close())
    localRef.current?.getTracks().forEach(t => t.stop())
    screenRef.current?.getTracks().forEach(t => t.stop())
    clearInterval(timerRef.current)
    onEnd()
  }

  // ── Pre-join screen ──
  if (!joined) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200, background: C.bg,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 24, padding: 32,
      }}>
        <div style={{ fontSize: 52 }}>👥</div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: C.text }}>Llamada grupal</p>
          <p style={{ margin: 0, fontSize: 14, color: C.textDim }}>{members?.length || 0} participantes en el grupo</p>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <button onClick={onEnd} style={{
            padding: '12px 28px', borderRadius: 14, background: C.panel,
            border: `1px solid ${C.border}`, color: C.text, fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={join} style={{
            padding: '12px 28px', borderRadius: 14, background: C.green,
            border: 'none', color: C.bg, fontSize: 15, fontWeight: 800, cursor: 'pointer',
            boxShadow: `0 4px 20px ${C.green}44`,
          }}>Unirse</button>
        </div>
      </div>
    )
  }

  const peerList = Object.entries(peers)
  const screenPeer = peerList.find(([, p]) => p.screenShare)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: '#060e0a',
      display: 'flex', flexDirection: 'column', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '52px 20px 12px', flexShrink: 0,
      }}>
        <div>
          <p style={{ margin: 0, color: '#fff', fontWeight: 700, fontSize: 16 }}>Llamada grupal</p>
          <p style={{ margin: 0, color: C.green, fontSize: 13 }}>{fmtTime(elapsed)} · {peerList.length + 1} en llamada</p>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: '4px 12px',
          fontSize: 12, color: 'rgba(255,255,255,0.5)',
        }}>🔐 Cifrado</div>
      </div>

      {/* Video grid */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '8px 12px',
        display: 'flex', flexWrap: 'wrap', gap: 10, alignContent: 'flex-start',
      }}>
        {/* Screen share takes full width if active */}
        {screenPeer && (
          <PeerTile key={screenPeer[0] + '-screen'} stream={screenPeer[1].stream} name={screenPeer[1].name} screenShare />
        )}

        {/* Local tile */}
        <LocalTile stream={screenStream || localStream} name={myName} muted={muted} camOff={camOff} screenShare={sharing} />

        {/* Remote peers (non-screen) */}
        {peerList.filter(([, p]) => !p.screenShare).map(([id, p]) => (
          <PeerTile key={id} stream={p.stream} name={p.name} />
        ))}

        {peerList.length === 0 && (
          <div style={{
            flex: '1 1 100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.5,
          }}>
            <p style={{ color: '#fff', fontSize: 14 }}>Esperando que otros se unan...</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        padding: '16px 20px 40px', flexShrink: 0,
        borderTop: `1px solid rgba(255,255,255,0.07)`,
        display: 'flex', justifyContent: 'center', gap: 16,
      }}>
        <Btn icon={muted ? '🔇' : '🎤'} label={muted ? 'Silenciado' : 'Mic'} active={!muted} onClick={toggleMute} />
        <Btn icon={camOff ? '📷' : '📹'} label={camOff ? 'Cam off' : 'Cámara'} active={!camOff} onClick={toggleCam} />
        <Btn icon="🖥" label={sharing ? 'Detener' : 'Pantalla'} active={sharing} accent={sharing ? '#f59e0b' : undefined} onClick={toggleScreen} />
        <button onClick={leave} style={{
          width: 58, height: 58, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'linear-gradient(145deg, #7f1d1d, #ef4444)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          boxShadow: '0 4px 20px rgba(239,68,68,0.45)',
        }}>📵</button>
      </div>
    </div>
  )
}

function Btn({ icon, label, active, accent, onClick }) {
  const col = accent || (active ? C.green : 'rgba(255,255,255,0.4)')
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    }}>
      <div style={{
        width: 58, height: 58, borderRadius: '50%',
        background: active ? `${col}18` : 'rgba(255,255,255,0.07)',
        border: `1.5px solid ${active ? col + '50' : 'rgba(255,255,255,0.1)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
      }}>{icon}</div>
      <span style={{ fontSize: 11, color: col, fontWeight: 500 }}>{label}</span>
    </button>
  )
}
