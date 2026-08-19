import { useEffect, useState } from 'react'
import { C } from '../../theme'
import { supabase } from '../../lib/supabase'

// ── Layout constants ──────────────────────────────────────────────────────────
const CARD_W    = 178
const CARD_H    = 74   // 2 rows × 37px
const BASE_SLOT = CARD_H + 14
const CONN_W    = 44

// ── Helpers ───────────────────────────────────────────────────────────────────
const ROUND_NAMES = ['128avos','64avos','32avos','Dieciseisavos','Octavos','Cuartos','Semifinal','Final']

function roundLabels(total) {
  return ROUND_NAMES.slice(ROUND_NAMES.length - total)
}

function buildBracket(names) {
  let n = 1
  while (n < names.length) n *= 2
  const seeded = names.map((name, i) => ({ id: String(i), name }))
  while (seeded.length < n) seeded.push({ id: null, name: 'BYE' })

  const rounds = []
  let cur = []
  for (let i = 0; i < seeded.length; i += 2) {
    const a = seeded[i], b = seeded[i + 1]
    const byeB = b.name === 'BYE'
    cur.push({
      id: `r0m${i / 2}`,
      p1: a.name, p1Id: a.id,
      p2: b.name, p2Id: b.id,
      winner: byeB ? a.name : null, winnerId: byeB ? a.id : null,
      score1: null, score2: null, status: 'pendiente',
    })
  }
  rounds.push(cur)

  while (cur.length > 1) {
    const next = []
    for (let i = 0; i < cur.length; i += 2) {
      const ma = cur[i], mb = cur[i + 1]
      next.push({
        id: `r${rounds.length}m${i / 2}`,
        p1: ma.winner ?? '?', p1Id: ma.winnerId,
        p2: mb?.winner ?? '?', p2Id: mb?.winnerId,
        winner: null, winnerId: null,
        score1: null, score2: null, status: 'pendiente',
      })
    }
    rounds.push(next)
    cur = next
  }
  return rounds
}

// ── MatchCard ─────────────────────────────────────────────────────────────────
function MatchCard({ p1, p2, score1, score2, winner, winnerId, p1Id, p2Id, status, onClick }) {
  const done  = !!winner
  const live  = status === 'en_juego'
  const rows  = [{ name: p1, score: score1, id: p1Id }, { name: p2, score: score2, id: p2Id }]
  const hasScores = score1 != null || score2 != null

  return (
    <div
      onClick={onClick}
      style={{
        width: CARD_W,
        border: `1px solid ${live ? '#f59e0b60' : C.border}`,
        borderRadius: 10,
        overflow: 'hidden',
        background: C.panel,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: live ? '0 0 0 2px #f59e0b28' : 'none',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {rows.map((pl, pi) => {
        const isWin = done && (winnerId ? winnerId === pl.id : winner === pl.name)
        const isBye = pl.name === 'BYE'
        const isTbd = !pl.name || pl.name === '?'
        return (
          <div key={pi} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 10px',
            height: CARD_H / 2,
            background: isWin ? `${C.green}1a` : 'transparent',
            borderBottom: pi === 0 ? `1px solid ${C.border}` : 'none',
            borderLeft: `3px solid ${isWin ? C.green : live ? '#f59e0b' : 'transparent'}`,
            transition: 'background 0.12s',
          }}>
            <span style={{
              flex: 1, fontSize: 12,
              fontWeight: isWin ? 700 : 400,
              color: (isBye || isTbd) ? C.textDim : isWin ? C.green : C.text,
              fontStyle: isTbd ? 'italic' : 'normal',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {isBye ? '— BYE' : pl.name || '?'}
            </span>
            {hasScores && !isBye && !isTbd && (
              <span style={{
                fontSize: 15, fontWeight: 800,
                color: isWin ? C.green : C.textDim,
                minWidth: 20, textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {pl.score ?? '—'}
              </span>
            )}
            {isWin && <span style={{ fontSize: 10, color: C.green }}>✓</span>}
          </div>
        )
      })}
    </div>
  )
}

// ── ConnectorSVG ──────────────────────────────────────────────────────────────
function ConnectorSVG({ fromCount, slotH }) {
  const totalH = fromCount * slotH
  const pairs  = Math.floor(fromCount / 2)

  return (
    <div style={{ color: C.border, flexShrink: 0 }}>
      <svg width={CONN_W} height={totalH} style={{ display: 'block' }}>
        {Array.from({ length: pairs }, (_, i) => {
          const topY = i * 2 * slotH + slotH / 2
          const botY = (i * 2 + 1) * slotH + slotH / 2
          const midY = (topY + botY) / 2
          const mx   = CONN_W / 2
          return (
            <g key={i} stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round">
              <line x1={0}  y1={topY} x2={mx} y2={topY} />
              <line x1={mx} y1={topY} x2={mx} y2={botY} />
              <line x1={0}  y1={botY} x2={mx} y2={botY} />
              <line x1={mx} y1={midY} x2={CONN_W} y2={midY} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── HorizontalBracket ─────────────────────────────────────────────────────────
function HorizontalBracket({ rounds, champion, renderMatch }) {
  const n      = rounds.length
  const labels = roundLabels(n)

  return (
    <div style={{ overflowX: 'auto', overflowY: 'visible', WebkitOverflowScrolling: 'touch', width: '100%' }}>
      <div style={{ display: 'inline-flex', flexDirection: 'column', padding: '0 16px 20px', minWidth: 'max-content' }}>

        {/* Round label headers */}
        <div style={{ display: 'flex', marginBottom: 10 }}>
          {rounds.map((_, ri) => (
            <div key={ri} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: CARD_W, textAlign: 'center',
                fontSize: 10, fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase',
                color: ri === n - 1 ? '#f59e0b' : '#06b6d4',
              }}>
                {labels[ri]}
              </div>
              {ri < n - 1 && <div style={{ width: CONN_W }} />}
            </div>
          ))}
          {champion && <div style={{ width: CONN_W + 80 }} />}
        </div>

        {/* Bracket body */}
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {rounds.map((round, ri) => {
            const slotH  = BASE_SLOT * Math.pow(2, ri)
            const totalH = round.length * slotH
            return (
              <div key={ri} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
                {/* Match column */}
                <div style={{ width: CARD_W, height: totalH, position: 'relative', flexShrink: 0 }}>
                  {round.map((match, mi) => (
                    <div key={mi} style={{
                      position: 'absolute',
                      top: mi * slotH + (slotH - CARD_H) / 2,
                      left: 0,
                    }}>
                      {renderMatch(match, ri, mi)}
                    </div>
                  ))}
                </div>
                {/* Connector to next round */}
                {ri < n - 1 && (
                  <ConnectorSVG fromCount={round.length} slotH={slotH} />
                )}
              </div>
            )
          })}

          {/* Champion box */}
          {champion && (
            <div style={{
              display: 'flex', alignItems: 'center',
              height: rounds[rounds.length - 1].length * BASE_SLOT * Math.pow(2, n - 1),
            }}>
              <div style={{
                marginLeft: CONN_W / 2,
                width: 100, padding: '14px 10px',
                background: 'linear-gradient(135deg, #f59e0b22, #f59e0b08)',
                border: '2px solid #f59e0b',
                borderRadius: 14, textAlign: 'center',
              }}>
                <div style={{ fontSize: 26, marginBottom: 4 }}>🏆</div>
                <div style={{
                  fontSize: 12, fontWeight: 800, color: '#f59e0b',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {champion}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Score / action modal ──────────────────────────────────────────────────────
function MatchModal({ match, userMap, isOrganizer, onClose, onSubmitScore, onApprove, submitting }) {
  const [s1, setS1] = useState(0)
  const [s2, setS2] = useState(0)
  if (!match) return null

  const p1  = match.player1_id ? (userMap[match.player1_id] || 'Jugador') : 'BYE'
  const p2  = match.player2_id ? (userMap[match.player2_id] || 'Jugador') : 'BYE'
  const done  = match.status === 'finalizado'
  const pend  = match.status === 'pendiente'
  const live  = match.status === 'en_juego'
  const canLoad = pend && match.player1_id && match.player2_id
  const canApprove = live && isOrganizer

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.65)', display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center', padding: '0',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.panel, borderRadius: '20px 20px 0 0',
        padding: 24, width: '100%', maxWidth: 480,
        border: `1px solid ${C.border}`, borderBottom: 'none',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 20px' }} />
        <p style={{ margin: '0 0 16px', fontWeight: 800, color: C.text, fontSize: 15 }}>
          {done ? '✅ Resultado' : live ? '⚡ En Juego' : '🎮 Partido'}
        </p>

        {/* Players */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: match.winner_id === match.player1_id && done ? C.green : C.text, marginBottom: 4 }}>
              {p1}
            </div>
            {(done || live) && (
              <div style={{ fontSize: 28, fontWeight: 900, color: match.winner_id === match.player1_id && done ? C.green : C.text }}>
                {match.score1 ?? '—'}
              </div>
            )}
          </div>
          <div style={{ color: C.textDim, fontWeight: 700, fontSize: 18 }}>VS</div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: match.winner_id === match.player2_id && done ? C.green : C.text, marginBottom: 4 }}>
              {p2}
            </div>
            {(done || live) && (
              <div style={{ fontSize: 28, fontWeight: 900, color: match.winner_id === match.player2_id && done ? C.green : C.text }}>
                {match.score2 ?? '—'}
              </div>
            )}
          </div>
        </div>

        {/* Score input */}
        {canLoad && (
          <>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: C.textDim, textAlign: 'center' }}>Cargar resultado</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <input type="number" min="0" value={s1} onChange={e => setS1(e.target.value)}
                style={{ width: 64, textAlign: 'center', background: C.panel2, border: `1px solid ${C.green}`, borderRadius: 10, padding: '10px 0', color: C.text, fontSize: 24, fontWeight: 800, outline: 'none' }} />
              <span style={{ color: C.textDim, fontWeight: 700 }}>—</span>
              <input type="number" min="0" value={s2} onChange={e => setS2(e.target.value)}
                style={{ width: 64, textAlign: 'center', background: C.panel2, border: `1px solid ${C.green}`, borderRadius: 10, padding: '10px 0', color: C.text, fontSize: 24, fontWeight: 800, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => onSubmitScore(match.id, parseInt(s1)||0, parseInt(s2)||0)} disabled={!!submitting}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: C.green, color: C.bg, fontWeight: 700, cursor: 'pointer' }}>
                {submitting ? '...' : 'Enviar'}
              </button>
            </div>
          </>
        )}

        {canApprove && (
          <button onClick={() => onApprove(match.id)} disabled={!!submitting}
            style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: C.green, color: C.bg, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 4 }}>
            {submitting ? '...' : '✅ Aprobar resultado'}
          </button>
        )}

        {!canLoad && !canApprove && (
          <button onClick={onClose} style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>Cerrar</button>
        )}
      </div>
    </div>
  )
}

// ── DB-connected view ─────────────────────────────────────────────────────────
function DBBracketsView({ tournamentId, maxParticipants, isOrganizer }) {
  const [rounds,     setRounds]     = useState([])
  const [userMap,    setUserMap]     = useState({})
  const [loading,    setLoading]     = useState(true)
  const [selected,   setSelected]   = useState(null)
  const [submitting, setSubmitting]  = useState(null)

  async function load() {
    setLoading(true)
    const { data: matches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_number').order('match_number')

    if (!matches) { setLoading(false); return }

    const uids = new Set()
    matches.forEach(m => {
      if (m.player1_id) uids.add(m.player1_id)
      if (m.player2_id) uids.add(m.player2_id)
    })
    if (uids.size > 0) {
      const { data: users } = await supabase.from('users').select('id, display_name, username').in('id', [...uids])
      const map = {}
      ;(users || []).forEach(u => { map[u.id] = u.display_name || u.username || 'Jugador' })
      setUserMap(map)
    }

    const maxR = Math.max(...matches.map(m => m.round_number), 0)
    const grouped = []
    for (let r = 1; r <= maxR; r++) {
      grouped.push(matches.filter(m => m.round_number === r).sort((a, b) => a.match_number - b.match_number))
    }
    setRounds(grouped)
    setLoading(false)
  }

  useEffect(() => { load() }, [tournamentId])

  async function handleSubmitScore(matchId, s1, s2) {
    setSubmitting(matchId)
    const { data, error } = await supabase.rpc('submit_match_result', { p_match_id: matchId, p_score1: s1, p_score2: s2, p_photo_url: null })
    if (error || data?.ok === false) alert(data?.error || error?.message || 'Error')
    setSelected(null)
    await load()
    setSubmitting(null)
  }

  async function handleApprove(matchId) {
    setSubmitting(matchId)
    const { data, error } = await supabase.rpc('approve_match_result', { p_match_id: matchId })
    if (error || data?.ok === false) alert(data?.error || error?.message || 'Error')
    setSelected(null)
    await load()
    setSubmitting(null)
  }

  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center', color: C.textDim }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
      Cargando bracket...
    </div>
  )

  // No matches yet — show placeholder bracket based on max_participants
  if (rounds.length === 0) {
    const size = maxParticipants || 8
    const placeholder = buildBracket(Array.from({ length: size }, (_, i) => `Jugador ${i + 1}`))
    return (
      <>
        <div style={{ padding: '12px 16px 4px', textAlign: 'center', color: C.textDim, fontSize: 12 }}>
          El torneo aún no ha iniciado — vista previa del bracket
        </div>
        <HorizontalBracket
          rounds={placeholder}
          champion={null}
          renderMatch={(match) => (
            <MatchCard
              p1={match.p1} p2={match.p2}
              score1={null} score2={null}
              winner={null} winnerId={null}
              p1Id={null} p2Id={null}
              status="pendiente"
            />
          )}
        />
      </>
    )
  }

  const champion = (() => {
    const last = rounds[rounds.length - 1]?.[0]
    return last?.winner_id ? userMap[last.winner_id] : null
  })()

  const dbRounds = rounds.map(round =>
    round.map(m => ({
      ...m,
      p1: m.player1_id ? (userMap[m.player1_id] || 'Jugador') : 'BYE',
      p2: m.player2_id ? (userMap[m.player2_id] || 'Jugador') : 'BYE',
      winner: m.winner_id ? userMap[m.winner_id] : null,
    }))
  )

  return (
    <>
      <HorizontalBracket
        rounds={dbRounds}
        champion={champion}
        renderMatch={(match) => (
          <MatchCard
            p1={match.p1} p2={match.p2}
            score1={match.score1} score2={match.score2}
            winner={match.winner} winnerId={match.winner_id}
            p1Id={match.player1_id} p2Id={match.player2_id}
            status={match.status}
            onClick={() => setSelected(match)}
          />
        )}
      />
      <MatchModal
        match={selected}
        userMap={userMap}
        isOrganizer={isOrganizer}
        onClose={() => setSelected(null)}
        onSubmitScore={handleSubmitScore}
        onApprove={handleApprove}
        submitting={submitting}
      />
    </>
  )
}

// ── Standalone (sin DB) ────────────────────────────────────────────────────────
const QUICK_SIZES = [4, 8, 16, 32]

function StandaloneBracket() {
  const [input,     setInput]     = useState('')
  const [players,   setPlayers]   = useState([])
  const [rounds,    setRounds]    = useState([])
  const [generated, setGenerated] = useState(false)

  function generate() {
    if (players.length < 2) return
    const shuffled = [...players].sort(() => Math.random() - 0.5)
    setRounds(buildBracket(shuffled))
    setGenerated(true)
  }

  function pickWinner(ri, mi, winnerId, winnerName) {
    setRounds(prev => {
      const next = prev.map(r => r.map(m => ({ ...m })))
      next[ri][mi].winner   = winnerName
      next[ri][mi].winnerId = winnerId
      if (ri + 1 < next.length) {
        const nm = Math.floor(mi / 2)
        if (mi % 2 === 0) { next[ri+1][nm].p1 = winnerName; next[ri+1][nm].p1Id = winnerId }
        else               { next[ri+1][nm].p2 = winnerName; next[ri+1][nm].p2Id = winnerId }
      }
      return next
    })
  }

  const champion = generated ? rounds[rounds.length - 1]?.[0]?.winner : null

  if (!generated) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Tamaño rápido</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {QUICK_SIZES.map(s => (
              <button key={s} onClick={() => {
                const p = Array.from({ length: s }, (_, i) => `Jugador ${i + 1}`)
                setPlayers(p); setInput(p.join('\n'))
              }} style={{
                flex: 1, padding: '9px 0', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14,
                border: `1px solid ${players.length === s ? C.green : C.border}`,
                background: players.length === s ? `${C.green}18` : C.panel2,
                color: players.length === s ? C.green : C.textDim,
              }}>{s}</button>
            ))}
          </div>
        </div>

        <div>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            Participantes ({players.length})
          </p>
          <textarea
            value={input}
            onChange={e => { setInput(e.target.value); setPlayers(e.target.value.split('\n').map(s => s.trim()).filter(Boolean)) }}
            placeholder={'Un jugador por línea:\n@jugador1\n@jugador2'}
            rows={8}
            style={{ width: '100%', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        <button onClick={generate} disabled={players.length < 2} style={{
          width: '100%', padding: 14, borderRadius: 14, border: 'none',
          background: players.length >= 2 ? 'linear-gradient(135deg, #06b6d4, #0284c7)' : C.panel2,
          color: players.length >= 2 ? '#fff' : C.textDim,
          fontWeight: 800, fontSize: 16, cursor: players.length >= 2 ? 'pointer' : 'default',
        }}>
          🔱 Generar Bracket
        </button>
      </div>
    )
  }

  return (
    <>
      {champion && (
        <div style={{ margin: '12px 16px 0', padding: 16, background: 'linear-gradient(135deg, #f59e0b22, #f59e0b08)', border: '2px solid #f59e0b', borderRadius: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 32 }}>🏆</div>
          <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900, color: '#f59e0b' }}>{champion}</p>
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <HorizontalBracket
          rounds={rounds}
          champion={champion}
          renderMatch={(match, ri, mi) => (
            <MatchCard
              p1={match.p1} p2={match.p2}
              score1={null} score2={null}
              winner={match.winner} winnerId={match.winnerId}
              p1Id={match.p1Id} p2Id={match.p2Id}
              status={match.winner ? 'finalizado' : 'pendiente'}
              onClick={() => {
                if (!match.winner && match.p1 !== 'BYE' && match.p2 !== 'BYE' && match.p1 !== '?' && match.p2 !== '?') {
                  const w = window.confirm(`¿Quién ganó?\n\n1 — ${match.p1}\n2 — ${match.p2}`)
                    ? { id: match.p1Id, name: match.p1 }
                    : { id: match.p2Id, name: match.p2 }
                  pickWinner(ri, mi, w.id, w.name)
                }
              }}
            />
          )}
        />
      </div>
      <div style={{ padding: '0 16px 8px', textAlign: 'center' }}>
        <button onClick={() => { setGenerated(false); setRounds([]); setPlayers([]); setInput('') }}
          style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 16px', cursor: 'pointer', color: C.textDim, fontSize: 12 }}>
          🔄 Nuevo bracket
        </button>
      </div>
    </>
  )
}

// ── Entry point ───────────────────────────────────────────────────────────────
export default function BracketsPage({ onBack, tournamentId, tournamentName, isOrganizer, maxParticipants }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: C.text, fontWeight: 800, fontSize: 16 }}>
            🔱 {tournamentName || 'Bracket'}
          </h2>
          <p style={{ margin: 0, color: C.textDim, fontSize: 12 }}>
            {tournamentId ? 'Eliminación directa — en vivo' : 'Bracket manual'}
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {tournamentId
          ? <DBBracketsView tournamentId={tournamentId} maxParticipants={maxParticipants} isOrganizer={isOrganizer} />
          : <StandaloneBracket />
        }
      </div>
    </div>
  )
}
