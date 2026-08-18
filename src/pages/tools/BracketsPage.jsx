import { useEffect, useState } from 'react'
import { C } from '../../theme'
import { supabase } from '../../lib/supabase'

function buildBracket(players) {
  let n = 1; while (n < players.length) n *= 2
  const seeded = [...players]
  while (seeded.length < n) seeded.push('BYE')

  const rounds = []
  let currentRound = []
  for (let i = 0; i < seeded.length; i += 2) {
    currentRound.push({ p1: seeded[i], p2: seeded[i+1], winner: seeded[i+1] === 'BYE' ? seeded[i] : null })
  }
  rounds.push(currentRound)

  while (currentRound.length > 1) {
    const nextRound = []
    for (let i = 0; i < currentRound.length; i += 2) {
      nextRound.push({ p1: currentRound[i].winner || '?', p2: currentRound[i+1]?.winner || '?', winner: null })
    }
    rounds.push(nextRound)
    currentRound = nextRound
  }
  return rounds
}

const SIZES = [4, 8, 16, 32]

function roundLabels(total) {
  const labels = ['Final']
  if (total > 1) labels.unshift('Semifinal')
  if (total > 2) labels.unshift('Cuartos')
  if (total > 3) labels.unshift('Octavos')
  while (labels.length < total) labels.unshift(`Ronda ${total - labels.length + 1}`)
  return labels
}

// ── DB-connected mode ──────────────────────────────────────────────────────────
function DBBracketsView({ tournamentId, isOrganizer, onBack }) {
  const [rounds, setRounds] = useState([])
  const [userMap, setUserMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(null)
  const [scoreModal, setScoreModal] = useState(null) // { matchId, p1Name, p2Name }
  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)

  async function load() {
    setLoading(true)
    const { data: matches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_number').order('match_number')

    if (!matches) { setLoading(false); return }

    // collect user ids
    const uids = new Set()
    matches.forEach(m => { if (m.player1_id) uids.add(m.player1_id); if (m.player2_id) uids.add(m.player2_id) })
    const { data: users } = await supabase.from('users').select('id, display_name, username').in('id', [...uids])
    const map = {}
    ;(users || []).forEach(u => { map[u.id] = u.display_name || u.username || 'Jugador' })
    setUserMap(map)

    // group by round
    const maxRound = Math.max(...matches.map(m => m.round_number), 1)
    const grouped = []
    for (let r = 1; r <= maxRound; r++) {
      grouped.push(matches.filter(m => m.round_number === r).sort((a,b) => a.match_number - b.match_number))
    }
    setRounds(grouped)
    setLoading(false)
  }

  useEffect(() => { load() }, [tournamentId])

  async function approveMatch(matchId) {
    setSubmitting(matchId)
    const { data, error } = await supabase.rpc('approve_match_result', { p_match_id: matchId })
    if (error || data?.ok === false) alert(data?.error || error?.message || 'Error')
    await load()
    setSubmitting(null)
  }

  async function submitScore() {
    if (!scoreModal) return
    setSubmitting(scoreModal.matchId)
    const { data, error } = await supabase.rpc('submit_match_result', {
      p_match_id: scoreModal.matchId,
      p_score1: parseInt(score1) || 0,
      p_score2: parseInt(score2) || 0,
      p_photo_url: null,
    })
    setScoreModal(null)
    if (error || data?.ok === false) alert(data?.error || error?.message || 'Error')
    await load()
    setSubmitting(null)
  }

  const labels = roundLabels(rounds.length)
  const champion = (() => {
    const last = rounds[rounds.length - 1]
    const m = last?.[0]
    return m?.winner_id ? userMap[m.winner_id] : null
  })()

  const statusColor = { pendiente: C.textDim, en_juego: '#f59e0b', finalizado: C.green, cancelado: '#ef4444' }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.textDim }}>Cargando bracket...</div>

  if (rounds.length === 0) return (
    <div style={{ padding: '60px 20px', textAlign: 'center', color: C.textDim }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>🔱</div>
      <p>El torneo no ha iniciado todavía.</p>
    </div>
  )

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {champion && (
        <div style={{ background: `linear-gradient(135deg, #f59e0b22, #f59e0b08)`, border: `2px solid #f59e0b`, borderRadius: 16, padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: 32 }}>🏆</div>
          <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 900, color: '#f59e0b' }}>{champion}</p>
        </div>
      )}

      {rounds.map((round, ri) => (
        <div key={ri}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#06b6d4', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{labels[ri]}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {round.map(match => {
              const p1 = match.player1_id ? (userMap[match.player1_id] || 'Jugador') : 'BYE'
              const p2 = match.player2_id ? (userMap[match.player2_id] || 'Jugador') : 'BYE'
              const done = match.status === 'finalizado'
              const pending = match.status === 'pendiente'
              const inPlay = match.status === 'en_juego'
              return (
                <div key={match.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  {[{ name: p1, score: match.score1, uid: match.player1_id }, { name: p2, score: match.score2, uid: match.player2_id }].map((pl, pi) => (
                    <div key={pi} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      borderBottom: pi === 0 ? `1px solid ${C.border}` : 'none',
                      background: done && match.winner_id === pl.uid ? `${C.green}18` : 'transparent',
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: done && match.winner_id === pl.uid ? C.green : C.border }} />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: done && match.winner_id === pl.uid ? 700 : 400, color: pl.name === 'BYE' ? C.textDim : done && match.winner_id === pl.uid ? C.green : C.text }}>
                        {pl.name === 'BYE' ? '— BYE' : pl.name}
                      </span>
                      {(inPlay || done) && pl.score != null && (
                        <span style={{ fontWeight: 800, fontSize: 16, color: done && match.winner_id === pl.uid ? C.green : C.text2, minWidth: 20, textAlign: 'center' }}>{pl.score}</span>
                      )}
                      {done && match.winner_id === pl.uid && <span style={{ fontSize: 14 }}>✓</span>}
                    </div>
                  ))}
                  <div style={{ padding: '8px 14px', display: 'flex', gap: 8, borderTop: `1px solid ${C.border}`, background: C.panel2 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: statusColor[match.status] || C.textDim, textTransform: 'uppercase', flex: 1 }}>{match.status}</span>
                    {pending && match.player1_id && match.player2_id && (
                      <button onClick={() => { setScoreModal({ matchId: match.id, p1Name: p1, p2Name: p2 }); setScore1(0); setScore2(0) }}
                        style={{ background: C.green, border: 'none', borderRadius: 8, color: C.bg, fontSize: 11, fontWeight: 700, padding: '4px 10px', cursor: 'pointer' }}>
                        📝 Cargar
                      </button>
                    )}
                    {inPlay && isOrganizer && (
                      <button onClick={() => approveMatch(match.id)} disabled={submitting === match.id}
                        style={{ background: C.green, border: 'none', borderRadius: 8, color: C.bg, fontSize: 11, fontWeight: 700, padding: '4px 10px', cursor: 'pointer' }}>
                        {submitting === match.id ? '...' : '✅ Aprobar'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Score modal */}
      {scoreModal && (
        <div onClick={() => setScoreModal(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.panel, borderRadius: 20, padding: 24, maxWidth: 300, width: '100%', border: `1px solid ${C.border}` }}>
            <p style={{ margin: '0 0 16px', fontWeight: 800, color: C.text, fontSize: 15 }}>⚽ Cargar resultado</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, color: C.textDim }}>{scoreModal.p1Name}</p>
                <input type="number" min="0" value={score1} onChange={e => setScore1(e.target.value)} style={{ width: 56, textAlign: 'center', background: C.panel2, border: `1px solid ${C.green}`, borderRadius: 10, padding: '10px 0', color: C.text, fontSize: 22, fontWeight: 800, outline: 'none' }} />
              </div>
              <span style={{ fontSize: 18, color: C.textDim, fontWeight: 700 }}>—</span>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, color: C.textDim }}>{scoreModal.p2Name}</p>
                <input type="number" min="0" value={score2} onChange={e => setScore2(e.target.value)} style={{ width: 56, textAlign: 'center', background: C.panel2, border: `1px solid ${C.green}`, borderRadius: 10, padding: '10px 0', color: C.text, fontSize: 22, fontWeight: 800, outline: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setScoreModal(null)} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={submitScore} disabled={!!submitting} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: C.green, color: C.bg, fontWeight: 700, cursor: 'pointer' }}>Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Standalone mode (sin DB) ──────────────────────────────────────────────────
export default function BracketsPage({ onBack, initialPlayers = [], tournamentId, isOrganizer }) {
  const initList = initialPlayers.filter(Boolean)
  const [input, setInput]     = useState(initList.join('\n'))
  const [players, setPlayers] = useState(initList)
  const [generated, setGenerated] = useState(false)
  const [editRounds, setEditRounds] = useState([])

  function generate() {
    if (players.length < 2) return
    const shuffled = [...players].sort(() => Math.random() - 0.5)
    const bracket = buildBracket(shuffled)
    setEditRounds(bracket.map(r => r.map(m => ({ ...m }))))
    setGenerated(true)
  }

  function setWinner(roundIdx, matchIdx, winner) {
    setEditRounds(prev => {
      const next = prev.map(r => r.map(m => ({ ...m })))
      next[roundIdx][matchIdx].winner = winner
      if (roundIdx + 1 < next.length) {
        const nextMatchIdx = Math.floor(matchIdx / 2)
        if (matchIdx % 2 === 0) next[roundIdx+1][nextMatchIdx].p1 = winner
        else next[roundIdx+1][nextMatchIdx].p2 = winner
      }
      return next
    })
  }

  function reset() {
    setGenerated(false)
    setEditRounds([])
    setPlayers([])
    setInput('')
  }

  const labels = roundLabels(editRounds.length)
  const champion = editRounds.length > 0 ? editRounds[editRounds.length - 1][0]?.winner : null

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>🔱 Bracket</h2>
          <p style={{ margin: 0, color: C.textDim, fontSize: 12 }}>{tournamentId ? 'Eliminación directa — en vivo' : 'Eliminación directa automática'}</p>
        </div>
        {generated && !tournamentId && (
          <button onClick={reset} style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: C.textDim, fontSize: 12 }}>🔄 Nuevo</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: tournamentId ? 0 : 16 }}>
        {/* DB-connected mode */}
        {tournamentId ? (
          <DBBracketsView tournamentId={tournamentId} isOrganizer={isOrganizer} onBack={onBack} />
        ) : !generated ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Tamaño rápido</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {SIZES.map(s => (
                  <button key={s} onClick={() => {
                    const p = Array.from({ length: s }, (_, i) => `Jugador ${i+1}`)
                    setPlayers(p); setInput(p.join('\n'))
                  }} style={{
                    flex: 1, padding: '8px 0', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                    border: `1px solid ${players.length === s ? C.green : C.border}`,
                    background: players.length === s ? `${C.green}18` : C.panel2,
                    color: players.length === s ? C.green : C.textDim,
                  }}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Participantes ({players.length})</p>
              <textarea
                value={input}
                onChange={e => { setInput(e.target.value); setPlayers(e.target.value.split('\n').map(s => s.trim()).filter(Boolean)) }}
                placeholder="Un jugador por línea:&#10;@jugador1&#10;@jugador2"
                rows={8}
                style={{ width: '100%', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <button onClick={generate} disabled={players.length < 2} style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none',
              background: players.length >= 2 ? `linear-gradient(135deg, #06b6d4, #0284c7)` : C.panel2,
              color: players.length >= 2 ? '#fff' : C.textDim,
              fontWeight: 800, fontSize: 16, cursor: players.length >= 2 ? 'pointer' : 'default',
            }}>🔱 Generar Bracket</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {champion && champion !== '?' && (
              <div style={{ background: `linear-gradient(135deg, #f59e0b22, #f59e0b08)`, border: `2px solid #f59e0b`, borderRadius: 16, padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: 32 }}>🏆</div>
                <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 900, color: '#f59e0b' }}>{champion}</p>
              </div>
            )}
            {editRounds.map((round, ri) => (
              <div key={ri}>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#06b6d4', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{labels[ri]}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {round.map((match, mi) => (
                    <div key={mi} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                      {[match.p1, match.p2].map((p, pi) => (
                        <div key={pi} onClick={() => p && p !== '?' && p !== 'BYE' && setWinner(ri, mi, p)} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                          borderBottom: pi === 0 ? `1px solid ${C.border}` : 'none',
                          background: match.winner === p && p !== 'BYE' ? `${C.green}18` : 'transparent',
                          cursor: p && p !== '?' && p !== 'BYE' ? 'pointer' : 'default',
                        }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: match.winner === p && p !== 'BYE' ? C.green : C.border }} />
                          <span style={{ flex: 1, fontSize: 13, fontWeight: match.winner === p ? 700 : 400, color: p === 'BYE' ? C.textDim : match.winner === p ? C.green : C.text, fontStyle: p === '?' ? 'italic' : 'normal' }}>
                            {p === 'BYE' ? '— BYE' : p}
                          </span>
                          {match.winner === p && p !== 'BYE' && <span style={{ fontSize: 14 }}>✓</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p style={{ margin: 0, textAlign: 'center', fontSize: 12, color: C.textDim }}>Tocá un jugador para marcarlo como ganador</p>
          </div>
        )}
      </div>
    </div>
  )
}
