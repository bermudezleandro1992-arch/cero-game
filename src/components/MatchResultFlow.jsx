/**
 * MatchResultFlow — flujo completo de reporte y confirmación de resultados.
 *
 * Estados del partido:
 *   pendiente  → cualquiera de los dos puede reportar resultado
 *   en_juego   → el ganador reportó, el perdedor tiene X min para confirmar/disputar
 *   finalizado → confirmado (o auto-confirmado por tiempo)
 *   + disputa  → el perdedor abrió disputa, el admin la resuelve
 *
 * Props:
 *   match    — objeto del partido (id, player1_id, player2_id, winner_id, score1,
 *              score2, status, loser_confirmed, dispute_deadline, result_photo_url,
 *              tournament_id, player1, player2)
 *   profile  — perfil del usuario actual { id, username, avatar_url }
 *   isAdmin  — boolean
 *   onClose  — fn cuando se cierra el modal
 *   onUpdate — fn(matchId) cuando el estado cambia
 */

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeLeft(deadline) {
  if (!deadline) return null
  const ms = new Date(deadline) - Date.now()
  if (ms <= 0) return '00:00'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function Avatar({ user, size = 32 }) {
  if (user?.avatar_url) return (
    <img src={user.avatar_url} alt={user.username}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  )
  const letter = (user?.username?.[0] ?? '?').toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: C.panel2, border: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: C.textDim,
    }}>
      {letter}
    </div>
  )
}

// ── Upload foto a Supabase Storage ────────────────────────────────────────────
async function uploadPhoto(file, matchId) {
  const ext  = file.name.split('.').pop()
  const path = `matches/${matchId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('match-evidence')
    .upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('match-evidence').getPublicUrl(path)
  return data.publicUrl
}

// ── Sección: Reportar resultado (ganador) ─────────────────────────────────────
function ReportForm({ match, profile, onDone }) {
  const [score1, setScore1]     = useState('')
  const [score2, setScore2]     = useState('')
  const [winnerId, setWinnerId] = useState('')
  const [photo, setPhoto]       = useState(null)
  const [preview, setPreview]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [err, setErr]           = useState(null)
  const fileRef = useRef()

  const s1 = parseInt(score1) || 0
  const s2 = parseInt(score2) || 0

  // Auto-detectar ganador cuando el marcador cambia
  useEffect(() => {
    if (s1 > s2) setWinnerId(match.player1_id)
    else if (s2 > s1) setWinnerId(match.player2_id)
    else setWinnerId('')
  }, [score1, score2])

  function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setPhoto(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleSubmit() {
    if (!score1 || !score2) return setErr('Ingresá el marcador completo')
    if (s1 === s2) return setErr('No puede haber empate — indicá un ganador')
    if (!winnerId) return setErr('Seleccioná el ganador')
    setLoading(true); setErr(null)
    try {
      let photoUrl = match.result_photo_url ?? null
      if (photo) photoUrl = await uploadPhoto(photo, match.id)

      const { data, error } = await supabase.rpc('submit_match_result', {
        p_match_id:   match.id,
        p_score1:     s1,
        p_score2:     s2,
        p_winner_id:  winnerId,
        p_photo_url:  photoUrl,
      })
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'Error')
      onDone()
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  const isP1 = profile?.id === match.player1_id
  const isP2 = profile?.id === match.player2_id
  const p1 = match.player1
  const p2 = match.player2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <p style={{ margin: 0, fontSize: 13, color: C.textDim }}>
        Reportá el resultado del partido. El rival tendrá tiempo para confirmar.
      </p>

      {/* Marcador */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Jugador 1 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Avatar user={p1} size={40} />
          <span style={{ fontSize: 12, color: C.text2, fontWeight: 600, textAlign: 'center', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p1?.username ?? '—'}
          </span>
          <input
            type="number" min="0" max="99" value={score1}
            onChange={e => setScore1(e.target.value)}
            style={{
              width: 64, textAlign: 'center', fontSize: 28, fontWeight: 900,
              background: C.panel2, border: `2px solid ${winnerId === match.player1_id ? C.green : C.border}`,
              borderRadius: 12, color: C.text, padding: '8px 0',
              outline: 'none', transition: 'border-color .15s',
            }}
          />
        </div>

        <span style={{ fontSize: 20, fontWeight: 700, color: C.textDim, flexShrink: 0 }}>vs</span>

        {/* Jugador 2 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Avatar user={p2} size={40} />
          <span style={{ fontSize: 12, color: C.text2, fontWeight: 600, textAlign: 'center', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p2?.username ?? '—'}
          </span>
          <input
            type="number" min="0" max="99" value={score2}
            onChange={e => setScore2(e.target.value)}
            style={{
              width: 64, textAlign: 'center', fontSize: 28, fontWeight: 900,
              background: C.panel2, border: `2px solid ${winnerId === match.player2_id ? C.green : C.border}`,
              borderRadius: 12, color: C.text, padding: '8px 0',
              outline: 'none', transition: 'border-color .15s',
            }}
          />
        </div>
      </div>

      {/* Selección manual de ganador si queda en empate por error */}
      {score1 && score2 && s1 === s2 && (
        <div style={{ background: `#f59e0b15`, border: `1px solid #f59e0b44`, borderRadius: 12, padding: 12 }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>Marcador empatado — seleccioná el ganador manualmente:</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ id: match.player1_id, u: p1 }, { id: match.player2_id, u: p2 }].map(({ id, u }) => (
              <button key={id} onClick={() => setWinnerId(id)} style={{
                flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${winnerId === id ? C.green : C.border}`,
                background: winnerId === id ? `${C.green}15` : C.panel2,
                color: winnerId === id ? C.green : C.text2, fontWeight: 700, fontSize: 13,
              }}>
                🏆 {u?.username ?? id.slice(0,8)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Foto */}
      <div>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Captura de pantalla <span style={{ color: C.textDim, fontWeight: 400 }}>(recomendada)</span>
        </p>
        {preview ? (
          <div style={{ position: 'relative' }}>
            <img src={preview} alt="captura" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12, border: `1px solid ${C.border}` }} />
            <button onClick={() => { setPhoto(null); setPreview(null) }} style={{
              position: 'absolute', top: 8, right: 8, background: '#00000088',
              border: 'none', borderRadius: '50%', width: 28, height: 28,
              color: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1,
            }}>×</button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} style={{
            width: '100%', padding: '20px 0', background: C.panel2,
            border: `2px dashed ${C.border}`, borderRadius: 12,
            color: C.textDim, fontSize: 13, cursor: 'pointer',
          }}>
            📷 Subir captura
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      </div>

      {err && <p style={{ margin: 0, color: '#ef4444', fontSize: 13 }}>{err}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading || !score1 || !score2 || !winnerId}
        style={{
          padding: '14px 0', borderRadius: 12, border: 'none',
          background: loading || !score1 || !score2 || !winnerId ? C.panel2 : C.green,
          color: loading || !score1 || !score2 || !winnerId ? C.textDim : C.bg,
          fontWeight: 800, fontSize: 15, cursor: loading ? 'wait' : 'pointer',
          transition: 'background .15s',
        }}
      >
        {loading ? 'Enviando…' : 'Enviar resultado'}
      </button>
    </div>
  )
}

// ── Sección: Countdown + estado "esperando confirmación" ──────────────────────
function AwaitingConfirmation({ match, profile, isAdmin, onDone }) {
  const [remaining, setRemaining] = useState(timeLeft(match.dispute_deadline))
  const [dispute, setDispute]     = useState(null)
  const [loading, setLoading]     = useState(false)

  // Temporizador
  useEffect(() => {
    const t = setInterval(() => setRemaining(timeLeft(match.dispute_deadline)), 1000)
    return () => clearInterval(t)
  }, [match.dispute_deadline])

  // Cargar disputa si existe
  useEffect(() => {
    supabase
      .from('tournament_disputes')
      .select('*')
      .eq('match_id', match.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setDispute(data))
  }, [match.id])

  const isWinner = profile?.id === match.winner_id
  const isLoser  = profile?.id !== match.winner_id &&
    (profile?.id === match.player1_id || profile?.id === match.player2_id)

  const p1 = match.player1
  const p2 = match.player2
  const isExpired = match.dispute_deadline && new Date(match.dispute_deadline) < new Date()

  async function handleConfirm() {
    setLoading(true)
    if (isAdmin) {
      // Admin confirma directamente sin pasar por el RPC del perdedor
      const { error } = await supabase.from('tournament_matches').update({
        status: 'finalizado',
        loser_confirmed: true,
      }).eq('id', match.id)
      if (!error) onDone()
    } else {
      const { data, error } = await supabase.rpc('confirm_match_result', {
        p_match_id: match.id,
        p_confirm:  true,
      })
      if (!error && data?.ok) onDone()
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Marcador reportado */}
      <div style={{
        background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <Avatar user={p1} size={36} />
          <span style={{ fontSize: 11, color: C.text2, fontWeight: 600 }}>{p1?.username}</span>
          <span style={{
            fontSize: 32, fontWeight: 900,
            color: match.winner_id === match.player1_id ? C.green : C.textDim,
          }}>{match.score1 ?? '—'}</span>
        </div>
        <span style={{ fontSize: 18, color: C.textDim, fontWeight: 700 }}>–</span>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <Avatar user={p2} size={36} />
          <span style={{ fontSize: 11, color: C.text2, fontWeight: 600 }}>{p2?.username}</span>
          <span style={{
            fontSize: 32, fontWeight: 900,
            color: match.winner_id === match.player2_id ? C.green : C.textDim,
          }}>{match.score2 ?? '—'}</span>
        </div>
      </div>

      {/* Captura del ganador */}
      {match.result_photo_url && (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>Captura enviada por el ganador</p>
          <img src={match.result_photo_url} alt="resultado"
            style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, border: `1px solid ${C.border}` }} />
        </div>
      )}

      {/* Countdown */}
      {!isExpired && match.dispute_deadline && (
        <div style={{
          background: `#f59e0b15`, border: `1px solid #f59e0b44`,
          borderRadius: 12, padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>
            {isLoser ? 'Tiempo para confirmar o disputar' : 'El rival tiene hasta'}
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 900, color: '#f59e0b' }}>
            {remaining}
          </span>
        </div>
      )}

      {isExpired && (
        <div style={{ background: `${C.green}15`, border: `1px solid ${C.green}44`, borderRadius: 12, padding: '10px 14px' }}>
          <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>⏱ Tiempo agotado — se confirmará automáticamente</span>
        </div>
      )}

      {/* Disputa en curso */}
      {dispute && (
        <DisputeStatus dispute={dispute} isAdmin={isAdmin} matchId={match.id} onResolved={onDone} />
      )}

      {/* Acciones del perdedor */}
      {isLoser && !dispute && !isExpired && (
        <LoserActions match={match} profile={profile} onDone={onDone} onDispute={setDispute} />
      )}

      {/* Admin puede confirmar o auto-trigger */}
      {isAdmin && !dispute && (
        <button onClick={handleConfirm} disabled={loading} style={{
          padding: '12px 0', borderRadius: 12, border: `1px solid ${C.green}`,
          background: 'none', color: C.green, fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}>
          {loading ? 'Confirmando…' : '✓ Confirmar resultado (admin)'}
        </button>
      )}

      {isWinner && !dispute && (
        <p style={{ margin: 0, fontSize: 13, color: C.textDim, textAlign: 'center' }}>
          ⏳ Esperando confirmación del rival…
        </p>
      )}
    </div>
  )
}

// ── Acciones del perdedor: confirmar o disputar ───────────────────────────────
function LoserActions({ match, profile, onDone, onDispute }) {
  const [view, setView]           = useState('choice')  // 'choice' | 'dispute'
  const [reason, setReason]       = useState('')
  const [evidence, setEvidence]   = useState([])
  const [previews, setPreviews]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [err, setErr]             = useState(null)
  const fileRef = useRef()

  async function handleConfirm() {
    setLoading(true)
    const { data, error } = await supabase.rpc('confirm_match_result', {
      p_match_id: match.id,
      p_confirm:  true,
    })
    if (!error && data?.ok) onDone()
    else setErr(data?.error || error?.message)
    setLoading(false)
  }

  function handleEvidenceFiles(e) {
    const files = Array.from(e.target.files ?? [])
    setEvidence(prev => [...prev, ...files])
    setPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
  }

  async function handleDispute() {
    if (!reason.trim()) return setErr('Describí el motivo de la disputa')
    setLoading(true); setErr(null)
    try {
      const urls = await Promise.all(evidence.map(f => uploadPhoto(f, match.id)))
      const { data, error } = await supabase.rpc('confirm_match_result', {
        p_match_id:      match.id,
        p_confirm:       false,
        p_reason:        reason.trim(),
        p_evidence_urls: urls,
      })
      if (error || !data?.ok) throw new Error(data?.error || error?.message)
      // Cargar la disputa creada
      const { data: dis } = await supabase
        .from('tournament_disputes')
        .select('*')
        .eq('match_id', match.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      onDispute(dis)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (view === 'choice') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text, textAlign: 'center' }}>
        ¿El resultado es correcto?
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={handleConfirm} disabled={loading} style={{
          flex: 1, padding: '14px 0', borderRadius: 12, border: 'none',
          background: C.green, color: C.bg, fontWeight: 800, fontSize: 14, cursor: 'pointer',
        }}>
          ✓ Confirmar
        </button>
        <button onClick={() => setView('dispute')} style={{
          flex: 1, padding: '14px 0', borderRadius: 12,
          border: '1.5px solid #ef4444', background: 'none',
          color: '#ef4444', fontWeight: 800, fontSize: 14, cursor: 'pointer',
        }}>
          ⚠ Disputar
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setView('choice')} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 18, padding: 0 }}>←</button>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#ef4444' }}>Abrir disputa</p>
      </div>

      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Describí por qué el resultado es incorrecto…"
        rows={4}
        style={{
          background: C.panel2, border: `1.5px solid ${C.border}`, borderRadius: 12,
          color: C.text, fontSize: 13, padding: 12, resize: 'vertical',
          outline: 'none', fontFamily: 'inherit',
        }}
      />

      {/* Evidencias */}
      <div>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Evidencias (capturas, videos)
        </p>
        {previews.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {previews.map((src, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={src} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}` }} />
                <button onClick={() => {
                  setEvidence(prev => prev.filter((_, j) => j !== i))
                  setPreviews(prev => prev.filter((_, j) => j !== i))
                }} style={{
                  position: 'absolute', top: 2, right: 2, background: '#00000099',
                  border: 'none', borderRadius: '50%', width: 18, height: 18,
                  color: '#fff', cursor: 'pointer', fontSize: 11, lineHeight: 1,
                }}>×</button>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => fileRef.current?.click()} style={{
          padding: '10px 16px', borderRadius: 10,
          border: `1px dashed ${C.border}`, background: C.panel2,
          color: C.textDim, fontSize: 12, cursor: 'pointer',
        }}>
          + Agregar imagen
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleEvidenceFiles} style={{ display: 'none' }} />
      </div>

      {err && <p style={{ margin: 0, color: '#ef4444', fontSize: 13 }}>{err}</p>}

      <button onClick={handleDispute} disabled={loading} style={{
        padding: '14px 0', borderRadius: 12, border: 'none',
        background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
      }}>
        {loading ? 'Enviando…' : 'Enviar disputa'}
      </button>
    </div>
  )
}

// ── Estado de la disputa + panel de resolución admin ─────────────────────────
function DisputeStatus({ dispute, isAdmin, matchId, onResolved }) {
  const [view, setView]    = useState('status')
  const [res, setRes]      = useState('')
  const [s1, setS1]        = useState('')
  const [s2, setS2]        = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr]      = useState(null)

  const COLORS = { abierta: '#f59e0b', en_revision: '#3b82f6', resuelta: '#22c55e', rechazada: '#ef4444' }
  const color = COLORS[dispute.status] ?? C.textDim

  async function handleResolve(status) {
    if (!res.trim()) return setErr('Escribí la resolución')
    setLoading(true); setErr(null)
    try {
      const { data, error } = await supabase.rpc('resolve_dispute', {
        p_dispute_id:   dispute.id,
        p_resolution:   res.trim(),
        p_status:       status,
        p_final_score1: s1 ? parseInt(s1) : null,
        p_final_score2: s2 ? parseInt(s2) : null,
      })
      if (error || !data?.ok) throw new Error(data?.error || error?.message)
      onResolved()
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: `${color}10`, border: `1.5px solid ${color}44`,
      borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color }}>
          {dispute.status === 'abierta'     && '⚠ Disputa abierta'}
          {dispute.status === 'en_revision' && '🔍 En revisión'}
          {dispute.status === 'resuelta'    && '✓ Disputa resuelta'}
          {dispute.status === 'rechazada'   && '✕ Disputa rechazada'}
        </span>
        {isAdmin && dispute.status === 'abierta' && (
          <button onClick={() => setView(view === 'resolve' ? 'status' : 'resolve')} style={{
            background: 'none', border: `1px solid ${color}`, borderRadius: 8,
            color, fontSize: 11, fontWeight: 700, padding: '4px 10px', cursor: 'pointer',
          }}>
            {view === 'resolve' ? 'Cancelar' : 'Resolver'}
          </button>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 13, color: C.text2, lineHeight: 1.5 }}>{dispute.reason}</p>

      {/* Evidencias de la disputa */}
      {dispute.evidence_urls?.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {dispute.evidence_urls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer">
              <img src={url} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}` }} />
            </a>
          ))}
        </div>
      )}

      {/* Resolución ya tomada */}
      {dispute.resolution && (
        <div style={{ background: C.panel2, borderRadius: 10, padding: 10 }}>
          <p style={{ margin: '0 0 4px', fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>Resolución del admin</p>
          <p style={{ margin: 0, fontSize: 13, color: C.text2 }}>{dispute.resolution}</p>
        </div>
      )}

      {/* Panel de resolución (admin) */}
      {isAdmin && view === 'resolve' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Resolución
          </p>
          <textarea
            value={res} onChange={e => setRes(e.target.value)}
            placeholder="Describí la decisión tomada…"
            rows={3}
            style={{
              background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10,
              color: C.text, fontSize: 13, padding: 10, resize: 'vertical',
              outline: 'none', fontFamily: 'inherit',
            }}
          />

          {/* Marcador final opcional */}
          <p style={{ margin: 0, fontSize: 12, color: C.textDim, fontWeight: 600 }}>Marcador final (opcional — deja en blanco para mantener el reportado)</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="number" min="0" max="99" value={s1} onChange={e => setS1(e.target.value)} placeholder="—"
              style={{ flex: 1, textAlign: 'center', padding: '8px 0', fontSize: 20, fontWeight: 900, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: 'none' }} />
            <span style={{ color: C.textDim, fontWeight: 700 }}>–</span>
            <input type="number" min="0" max="99" value={s2} onChange={e => setS2(e.target.value)} placeholder="—"
              style={{ flex: 1, textAlign: 'center', padding: '8px 0', fontSize: 20, fontWeight: 900, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: 'none' }} />
          </div>

          {err && <p style={{ margin: 0, color: '#ef4444', fontSize: 13 }}>{err}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => handleResolve('resuelta')} disabled={loading} style={{
              flex: 1, padding: '12px 0', borderRadius: 10, border: 'none',
              background: C.green, color: C.bg, fontWeight: 800, fontSize: 13, cursor: 'pointer',
            }}>
              ✓ Resolver
            </button>
            <button onClick={() => handleResolve('rechazada')} disabled={loading} style={{
              flex: 1, padding: '12px 0', borderRadius: 10,
              border: '1.5px solid #ef4444', background: 'none',
              color: '#ef4444', fontWeight: 800, fontSize: 13, cursor: 'pointer',
            }}>
              ✕ Rechazar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Resultado finalizado ──────────────────────────────────────────────────────
function FinishedResult({ match }) {
  const p1 = match.player1
  const p2 = match.player2
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
      <div style={{ fontSize: 40 }}>🏆</div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.green }}>
        Resultado confirmado
      </p>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20,
        width: '100%',
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Avatar user={p1} size={40} />
          <span style={{ fontSize: 11, color: match.winner_id === match.player1_id ? C.green : C.textDim, fontWeight: 700 }}>
            {p1?.username}
          </span>
          <span style={{ fontSize: 36, fontWeight: 900, color: match.winner_id === match.player1_id ? C.green : C.textDim }}>
            {match.score1 ?? '—'}
          </span>
          {match.winner_id === match.player1_id && <span style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>GANADOR</span>}
        </div>
        <span style={{ fontSize: 20, color: C.textDim, fontWeight: 700 }}>–</span>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Avatar user={p2} size={40} />
          <span style={{ fontSize: 11, color: match.winner_id === match.player2_id ? C.green : C.textDim, fontWeight: 700 }}>
            {p2?.username}
          </span>
          <span style={{ fontSize: 36, fontWeight: 900, color: match.winner_id === match.player2_id ? C.green : C.textDim }}>
            {match.score2 ?? '—'}
          </span>
          {match.winner_id === match.player2_id && <span style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>GANADOR</span>}
        </div>
      </div>
      {match.result_photo_url && (
        <img src={match.result_photo_url} alt="captura"
          style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12, border: `1px solid ${C.border}` }} />
      )}
      {match.notes?.includes('[auto-confirmado') && (
        <p style={{ margin: 0, fontSize: 11, color: C.textDim }}>⏱ Auto-confirmado por vencimiento de tiempo</p>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function MatchResultFlow({ match: initialMatch, profile, isAdmin, onClose, onUpdate }) {
  const [match, setMatch]     = useState(initialMatch)
  const [loading, setLoading] = useState(false)

  // Suscripción realtime al partido
  useEffect(() => {
    const ch = supabase
      .channel(`match-result-${match.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tournament_matches', filter: `id=eq.${match.id}` },
        ({ new: updated }) => {
          setMatch(prev => ({ ...prev, ...updated }))
          onUpdate?.(match.id)
        }
      )
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [match.id])

  function handleDone() {
    onUpdate?.(match.id)
    onClose?.()
  }

  const canReport =
    match.status === 'pendiente' &&
    (profile?.id === match.player1_id || profile?.id === match.player2_id || isAdmin)

  const isParticipant = profile?.id === match.player1_id || profile?.id === match.player2_id

  // Título según estado
  const TITLE = {
    pendiente:  'Reportar resultado',
    en_juego:   'Confirmación pendiente',
    finalizado: 'Resultado',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#00000088', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div style={{
        width: '100%', maxWidth: 480, margin: '0 auto',
        background: C.bg, borderRadius: '20px 20px 0 0',
        maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 40px #00000044',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 4, background: C.border }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: C.text, flex: 1 }}>
            {TITLE[match.status] ?? 'Resultado'}
          </p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0 }}>
            ×
          </button>
        </div>

        {/* Contenido scrollable */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20 }}>
          {match.status === 'pendiente' && canReport && (
            <ReportForm match={match} profile={profile} onDone={() => onUpdate?.(match.id)} />
          )}
          {match.status === 'pendiente' && !canReport && (
            <p style={{ textAlign: 'center', color: C.textDim, marginTop: 32 }}>
              Esperando que los jugadores reporten el resultado…
            </p>
          )}
          {match.status === 'en_juego' && (
            <AwaitingConfirmation
              match={match}
              profile={profile}
              isAdmin={isAdmin}
              onDone={handleDone}
            />
          )}
          {match.status === 'finalizado' && (
            <FinishedResult match={match} />
          )}

          {/* Admin override — visible en cualquier estado cuando isAdmin */}
          {isAdmin && (
            <AdminOverride match={match} onDone={handleDone} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Admin Override ────────────────────────────────────────────────────────────
function AdminOverride({ match, onDone }) {
  const [open, setOpen]     = useState(false)
  const [winner, setWinner] = useState('')
  const [s1, setS1]         = useState(String(match.score1 ?? 0))
  const [s2, setS2]         = useState(String(match.score2 ?? 0))
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr]       = useState(null)

  const p1 = match.player1
  const p2 = match.player2

  async function handleSubmit() {
    if (!winner) return setErr('Seleccioná el ganador')
    if (!reason.trim()) return setErr('El motivo es obligatorio')
    setLoading(true); setErr(null)
    try {
      // Direct update bypassing admin_override_match RPC (which references updated_at that doesn't exist)
      const { error } = await supabase.from('tournament_matches').update({
        score1: parseInt(s1) || 0,
        score2: parseInt(s2) || 0,
        winner_id: winner,
        status: 'aprobado',
      }).eq('id', match.id)
      if (error) throw new Error(error.message)
      onDone()
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return (
    <div style={{ marginTop: 16, borderTop: `1px dashed ${C.border}`, paddingTop: 12 }}>
      <button onClick={() => setOpen(true)} style={{
        width: '100%', padding: '10px 0', borderRadius: 10,
        border: `1px solid #f59e0b44`, background: '#f59e0b10',
        color: '#f59e0b', fontWeight: 700, fontSize: 13, cursor: 'pointer',
      }}>
        ⚖️ Corregir resultado (CEO/Organizador)
      </button>
    </div>
  )

  return (
    <div style={{ marginTop: 16, borderTop: `1px dashed ${C.border}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>⚖️ Corrección de resultado</p>

      {/* Marcador */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="number" min="0" max="99" value={s1} onChange={e => setS1(e.target.value)}
          style={{ flex: 1, textAlign: 'center', padding: '8px', fontSize: 18, fontWeight: 900, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: 'none' }} />
        <span style={{ color: C.textDim, fontWeight: 700 }}>–</span>
        <input type="number" min="0" max="99" value={s2} onChange={e => setS2(e.target.value)}
          style={{ flex: 1, textAlign: 'center', padding: '8px', fontSize: 18, fontWeight: 900, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: 'none' }} />
      </div>

      {/* Ganador */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[{ id: match.player1_id, label: p1?.display_name || p1?.username || 'J1' },
          { id: match.player2_id, label: p2?.display_name || p2?.username || 'J2' }].map(p => (
          <button key={p.id} onClick={() => setWinner(p.id)} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            border: `1.5px solid ${winner === p.id ? C.green : C.border}`,
            background: winner === p.id ? `${C.green}18` : C.panel2,
            color: winner === p.id ? C.green : C.text2,
          }}>
            {winner === p.id ? '✓ ' : ''}{p.label}
          </button>
        ))}
      </div>

      {/* Motivo */}
      <textarea
        placeholder="Motivo de la corrección (obligatorio) — ej: 'Disputa resuelta: el jugador envió captura incorrecta'"
        value={reason} onChange={e => setReason(e.target.value)}
        rows={3}
        style={{ padding: '10px 12px', borderRadius: 10, background: C.panel2, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, resize: 'vertical', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
      />

      {err && <p style={{ margin: 0, color: '#ef4444', fontSize: 12 }}>{err}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setOpen(false)} style={{
          flex: 1, padding: '11px 0', borderRadius: 10, border: `1px solid ${C.border}`,
          background: 'none', color: C.text2, cursor: 'pointer', fontSize: 13,
        }}>Cancelar</button>
        <button onClick={handleSubmit} disabled={loading} style={{
          flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
          background: loading ? C.panel2 : '#f59e0b', color: loading ? C.textDim : '#000',
          fontWeight: 800, fontSize: 13, cursor: loading ? 'default' : 'pointer',
        }}>
          {loading ? 'Guardando…' : '⚖️ Aplicar corrección'}
        </button>
      </div>
    </div>
  )
}
