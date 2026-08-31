import { useEffect, useState } from 'react'
import { C } from '../../theme'
import { supabase } from '../../lib/supabase'

const DEFAULT_TEAM = { name: '', pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 }

function gd(t) { return t.gf - t.gc }

function sorted(teams) {
  return [...teams].sort((a, b) =>
    b.pts - a.pts || gd(b) - gd(a) || b.gf - a.gf || a.name.localeCompare(b.name)
  )
}

// ── Phase config ──────────────────────────────────────────────────────────────
const LIGA_PHASES = [
  { id: 'apertura',           label: '⚡ Apertura',         short: 'Apertura',   color: '#22c55e' },
  { id: 'apertura_sorteo',    label: '🎲 Sorteo Apertura',  short: 'Sorteo A',   color: '#a78bfa' },
  { id: 'apertura_playoffs',  label: '🏅 Playoffs A',       short: 'Playoffs A', color: '#f59e0b' },
  { id: 'clausura',           label: '🍂 Clausura',         short: 'Clausura',   color: '#3b82f6' },
  { id: 'clausura_sorteo',    label: '🎲 Sorteo Clausura',  short: 'Sorteo C',   color: '#a78bfa' },
  { id: 'clausura_playoffs',  label: '🏅 Playoffs C',       short: 'Playoffs C', color: '#f59e0b' },
  { id: 'final_tabla',        label: '🏆 Tabla Final',      short: 'Final',      color: '#ef4444' },
]

// round field values used as phase tags in tournament_matches
// 1 = apertura regular, 2 = apertura playoffs, 3 = clausura regular, 4 = clausura playoffs

function computeStandings(matches) {
  const stats = {}
  const finished = matches.filter(m => m.status === 'finalizado' || m.status === 'aprobado')
  finished.forEach(m => {
    if (!m.player1_id || !m.player2_id) return
    if (!stats[m.player1_id]) stats[m.player1_id] = { pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, pts:0 }
    if (!stats[m.player2_id]) stats[m.player2_id] = { pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, pts:0 }
    const s1 = m.score1 ?? 0, s2 = m.score2 ?? 0
    stats[m.player1_id].pj++; stats[m.player2_id].pj++
    stats[m.player1_id].gf += s1; stats[m.player1_id].gc += s2
    stats[m.player2_id].gf += s2; stats[m.player2_id].gc += s1
    if (s1 > s2) { stats[m.player1_id].pg++; stats[m.player1_id].pts += 3; stats[m.player2_id].pp++ }
    else if (s2 > s1) { stats[m.player2_id].pg++; stats[m.player2_id].pts += 3; stats[m.player1_id].pp++ }
    else { stats[m.player1_id].pe++; stats[m.player1_id].pts++; stats[m.player2_id].pe++; stats[m.player2_id].pts++ }
  })
  return Object.entries(stats)
    .map(([uid, s]) => ({ user_id: uid, ...s, gd: s.gf - s.gc }))
    .sort((a,b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
}

// ── Score modal ────────────────────────────────────────────────────────────────
// allowDraw=true for liga regular (round 1/3), false for bracket playoffs (round 2/4)
function ScoreModal({ match, p1Name, p2Name, onClose, onSubmit, onApprove, isOrganizer, submitting, allowDraw }) {
  const [s1, setS1] = useState(match.score1 ?? 0)
  const [s2, setS2] = useState(match.score2 ?? 0)
  const [penWinner, setPenWinner] = useState(null) // null | 'p1' | 'p2' — for bracket tiebreakers
  const done = match.status === 'finalizado' || match.status === 'aprobado'
  const waiting = match.status === 'resultado_cargado' || match.status === 'en_juego'
  const isTied = parseInt(s1) === parseInt(s2)
  const needsPen = !allowDraw && isTied // bracket match tied → need penalty winner

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.panel, borderRadius: 20, padding: 24, maxWidth: 300, width: '100%', border: `1px solid ${C.border}` }}>
        <p style={{ margin: '0 0 4px', fontWeight: 800, color: C.text, fontSize: 15, textAlign: 'center' }}>⚽ {p1Name} vs {p2Name}</p>
        {!allowDraw && <p style={{ margin: '0 0 8px', fontSize: 10, color: '#a78bfa', textAlign: 'center', fontWeight: 600 }}>🏅 Eliminatoria — en empate define penales</p>}
        {done && <p style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 28, fontWeight: 900, color: C.green }}>{match.score1} — {match.score2}</p>}
        {done && match.winner_id && !allowDraw && (
          <p style={{ margin: '0 0 12px', textAlign: 'center', fontSize: 12, color: '#a78bfa' }}>
            🏅 Pasa: {match.winner_id === match.player1_id ? p1Name : p2Name}
          </p>
        )}
        {!done && !waiting && (
          <>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: C.textDim, textAlign: 'center' }}>Cargar resultado</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 12 }}>
              <input type="number" min="0" value={s1} onChange={e => { setS1(e.target.value); setPenWinner(null) }} style={{ width: 56, textAlign: 'center', background: C.panel2, border: `1px solid ${C.green}`, borderRadius: 10, padding: '10px 0', color: C.text, fontSize: 22, fontWeight: 800, outline: 'none' }} />
              <span style={{ fontSize: 18, color: C.textDim, fontWeight: 700 }}>—</span>
              <input type="number" min="0" value={s2} onChange={e => { setS2(e.target.value); setPenWinner(null) }} style={{ width: 56, textAlign: 'center', background: C.panel2, border: `1px solid ${C.green}`, borderRadius: 10, padding: '10px 0', color: C.text, fontSize: 22, fontWeight: 800, outline: 'none' }} />
            </div>
            {needsPen && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: '0 0 8px', fontSize: 11, color: '#f59e0b', textAlign: 'center', fontWeight: 700 }}>Empate — ¿quién ganó en penales?</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setPenWinner('p1')} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: `1px solid ${penWinner==='p1' ? '#a78bfa' : C.border}`, background: penWinner==='p1' ? '#a78bfa30' : C.panel2, color: penWinner==='p1' ? '#a78bfa' : C.text, fontWeight: penWinner==='p1' ? 700 : 400, fontSize: 11, cursor: 'pointer' }}>{p1Name}</button>
                  <button onClick={() => setPenWinner('p2')} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: `1px solid ${penWinner==='p2' ? '#a78bfa' : C.border}`, background: penWinner==='p2' ? '#a78bfa30' : C.panel2, color: penWinner==='p2' ? '#a78bfa' : C.text, fontWeight: penWinner==='p2' ? 700 : 400, fontSize: 11, cursor: 'pointer' }}>{p2Name}</button>
                </div>
              </div>
            )}
          </>
        )}
        {waiting && (
          <p style={{ margin: '0 0 12px', textAlign: 'center', fontSize: 13, color: '#f59e0b' }}>Resultado enviado — pendiente de aprobación</p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontWeight: 700, cursor: 'pointer' }}>Cerrar</button>
          {!done && !waiting && (
            <button
              onClick={() => {
                const winnerId = needsPen ? (penWinner === 'p1' ? match.player1_id : penWinner === 'p2' ? match.player2_id : null) : null
                onSubmit(match.id, parseInt(s1)||0, parseInt(s2)||0, winnerId)
              }}
              disabled={submitting === match.id || (needsPen && !penWinner)}
              style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: C.green, color: C.bg, fontWeight: 700, cursor: 'pointer', opacity: (needsPen && !penWinner) ? 0.5 : 1 }}>
              {submitting === match.id ? '…' : 'Enviar'}
            </button>
          )}
          {waiting && isOrganizer && (
            <button onClick={() => onApprove(match.id)} disabled={submitting === match.id}
              style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: C.green, color: C.bg, fontWeight: 700, cursor: 'pointer' }}>
              {submitting === match.id ? '…' : '✅ Aprobar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Standings table ────────────────────────────────────────────────────────────
function StandingsTable({ rows, userMap, highlightTop, highlightBottom, label }) {
  if (rows.length === 0) return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: C.textDim }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
      <p style={{ margin: 0, fontSize: 13 }}>{label || 'Sin datos aún.'}</p>
    </div>
  )
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: C.panel }}>
            {['#','Jugador','PJ','PG','PE','PP','GF','GC','DG','PTS'].map(h => (
              <th key={h} style={{ padding: '8px 6px', color: C.textDim, fontWeight: 700, textAlign: h === 'Jugador' ? 'left' : 'center', whiteSpace: 'nowrap', borderBottom: `1px solid ${C.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const u = userMap[s.user_id] || {}
            const name = u.name || 'Jugador'
            const diff = s.gd ?? (s.gf - s.gc)
            const isTop = highlightTop && i < highlightTop
            const isBot = highlightBottom && i >= rows.length - highlightBottom
            const rowBg = isTop ? `${C.green}08` : isBot ? '#ef444408' : 'transparent'
            const medal = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
            return (
              <tr key={s.user_id} style={{ borderBottom: `1px solid ${C.border}18`, background: rowBg }}>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: isTop ? C.green : isBot ? '#ef4444' : C.textDim, fontWeight: 700, fontSize: 13 }}>{i+1}</td>
                <td style={{ padding: '8px 6px', color: C.text, fontWeight: i === 0 ? 700 : 400 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {u.avatar
                      ? <img src={u.avatar} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: C.textDim, flexShrink: 0 }}>{name[0]}</div>
                    }
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>{name}</span>
                    {medal && <span style={{ fontSize: 12 }}>{medal}</span>}
                  </div>
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: C.text2 }}>{s.pj}</td>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: C.green }}>{s.pg}</td>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: C.text2 }}>{s.pe}</td>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: '#ef4444' }}>{s.pp}</td>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: C.text2 }}>{s.gf}</td>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: C.text2 }}>{s.gc}</td>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: diff > 0 ? C.green : diff < 0 ? '#ef4444' : C.textDim, fontWeight: 600 }}>{diff > 0 ? '+' : ''}{diff}</td>
                <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, fontSize: 13, color: isTop ? C.green : C.text }}>{s.pts}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {highlightTop && <p style={{ margin: '6px 14px', fontSize: 10, color: C.textDim }}>🟢 Clasifican a playoffs · {highlightBottom ? '🔴 Descienden' : ''}</p>}
    </div>
  )
}

// ── Bracket view ───────────────────────────────────────────────────────────────
function BracketView({ matches, userMap, onMatchClick, isOrganizer }) {
  const rounds = [...new Set(matches.map(m => m.round_number))].sort((a,b) => a-b)
  const totalRounds = Math.max(...rounds, 1)
  const roundLabel = rn => rn === totalRounds ? '🏆 Final' : rn === totalRounds-1 ? 'Semifinal' : rn === totalRounds-2 ? 'Cuartos' : `Ronda ${rn}`

  if (matches.length === 0) return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: C.textDim }}>
      <p>Sin partidos de playoffs aún.</p>
    </div>
  )

  return (
    <div style={{ padding: 14 }}>
      {rounds.map(rn => (
        <div key={rn} style={{ marginBottom: 18 }}>
          <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 800, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
            {roundLabel(rn)}
          </p>
          {matches.filter(m => m.round_number === rn).map(match => {
            const p1 = match.player1_id ? (userMap[match.player1_id]?.name || 'Jugador') : 'BYE'
            const p2 = match.player2_id ? (userMap[match.player2_id]?.name || 'Jugador') : 'BYE'
            const done = match.status === 'finalizado' || match.status === 'aprobado'
            const inDispute = match.status === 'disputa'
            return (
              <button key={match.id} onClick={() => onMatchClick && onMatchClick(match)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                background: C.panel, border: `1px solid ${inDispute ? '#ef4444' : done ? C.green+'44' : C.border}`,
                borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', marginBottom: 6,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: done && match.winner_id === match.player1_id ? 700 : 400, color: done && match.winner_id === match.player1_id ? C.green : C.text }}>{p1}</span>
                    {done && <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{match.score1 ?? '—'}</span>}
                  </div>
                  <div style={{ height: 1, background: C.border+'44', margin: '5px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: done && match.winner_id === match.player2_id ? 700 : 400, color: done && match.winner_id === match.player2_id ? C.green : C.text }}>{p2}</span>
                    {done && <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{match.score2 ?? '—'}</span>}
                  </div>
                </div>
                <div style={{ flexShrink: 0, fontSize: 11, color: inDispute ? '#ef4444' : done ? C.green : C.textDim, fontWeight: 700 }}>
                  {inDispute ? '⚠️ Disputa' : done ? '✓' : 'Pendiente'}
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Live draw (sorteo en vivo) ─────────────────────────────────────────────────
function SorteoModal({ players, clasificaN, onConfirm, onClose, phaseLabel }) {
  const [step, setStep] = useState('config') // config | drawing | result
  const [top, setTop] = useState(Math.min(clasificaN, players.length))
  const [drawn, setDrawn] = useState([])
  const [animIdx, setAnimIdx] = useState(-1)

  async function runDraw() {
    setStep('drawing')
    setDrawn([])
    setAnimIdx(-1)

    const eligible = players.slice(0, top)
    const shuffled = [...eligible]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // Animate one by one
    for (let i = 0; i < shuffled.length; i++) {
      await new Promise(r => setTimeout(r, 500))
      setDrawn(prev => [...prev, shuffled[i]])
      setAnimIdx(i)
    }
    await new Promise(r => setTimeout(r, 600))
    setStep('result')
  }

  const bracketSize = drawn.length > 0 ? Math.pow(2, Math.ceil(Math.log2(drawn.length))) : 0
  const seeded = [...drawn]
  while (seeded.length < bracketSize) seeded.push(null)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000000dd', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: C.panel, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, fontSize: 20 }}>←</button>
        <div>
          <p style={{ margin: 0, fontWeight: 800, color: C.text, fontSize: 15 }}>🎲 Sorteo en Vivo — {phaseLabel}</p>
          <p style={{ margin: 0, fontSize: 11, color: C.textDim }}>Sorteo de brackets para playoffs</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {step === 'config' && (
          <div>
            <div style={{ background: C.panel, borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <p style={{ margin: '0 0 6px', fontWeight: 700, color: C.text }}>Jugadores que clasifican a Playoffs</p>
              <p style={{ margin: '0 0 14px', fontSize: 12, color: C.textDim }}>Seleccioná cuántos equipos (top N de la tabla) pasan a la fase de playoffs.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[4,6,8,10,12,16].filter(n => n <= players.length).map(n => (
                  <button key={n} onClick={() => setTop(n)} style={{
                    padding: '8px 16px', borderRadius: 20,
                    border: `1px solid ${top === n ? C.green : C.border}`,
                    background: top === n ? `${C.green}20` : C.panel2,
                    color: top === n ? C.green : C.text, fontWeight: top === n ? 700 : 400, fontSize: 13, cursor: 'pointer',
                  }}>Top {n}</button>
                ))}
              </div>
            </div>

            <div style={{ background: C.panel, borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <p style={{ margin: '0 0 10px', fontWeight: 700, color: C.text, fontSize: 13 }}>Clasificados (top {top})</p>
              {players.slice(0, top).map((p, i) => (
                <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < top-1 ? `1px solid ${C.border}22` : 'none' }}>
                  <span style={{ fontSize: 13, color: C.green, fontWeight: 700, minWidth: 20 }}>{i+1}</span>
                  <span style={{ fontSize: 14, color: C.text }}>{p.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: C.textDim }}>{p.pts} pts</span>
                </div>
              ))}
            </div>

            <button onClick={runDraw} style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none',
              background: C.green, color: C.bg, fontWeight: 800, fontSize: 16, cursor: 'pointer',
              boxShadow: `0 4px 20px ${C.green}55`,
            }}>🎲 ¡Iniciar Sorteo!</button>
          </div>
        )}

        {step === 'drawing' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 8, animation: 'spin .5s linear infinite' }}>🎲</div>
            <p style={{ color: C.text, fontWeight: 800, fontSize: 18, marginBottom: 20 }}>Sorteando…</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {drawn.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  background: C.panel, borderRadius: 12, border: `1px solid ${C.green}44`,
                  animation: 'fadeInUp .3s ease',
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${C.green}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: C.green }}>{i+1}</div>
                  <span style={{ flex: 1, fontWeight: 600, color: C.text, fontSize: 15 }}>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'result' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 20, color: C.text }}>✅ Sorteo completado</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textDim }}>Bracket de {drawn.length} jugadores ({bracketSize} posiciones)</p>
            </div>

            <div style={{ background: C.panel, borderRadius: 14, padding: 14, marginBottom: 16 }}>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 800, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>Bracket — Ronda 1</p>
              {Array.from({ length: bracketSize / 2 }, (_, i) => {
                const a = seeded[i * 2], b = seeded[i * 2 + 1]
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.panel2, borderRadius: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, color: a ? C.text : C.textDim, fontSize: 13 }}>{a ? a.name : 'BYE'}</p>
                      <div style={{ height: 1, background: C.border, margin: '5px 0' }} />
                      <p style={{ margin: 0, fontWeight: 600, color: b ? C.text : C.textDim, fontSize: 13 }}>{b ? b.name : 'BYE'}</p>
                    </div>
                    {!b && <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>Pasa</span>}
                  </div>
                )
              })}
            </div>

            <button onClick={() => onConfirm(seeded)} style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none',
              background: C.green, color: C.bg, fontWeight: 800, fontSize: 15, cursor: 'pointer',
              marginBottom: 8,
            }}>💾 Confirmar y crear brackets</button>
            <button onClick={() => setStep('config')} style={{
              width: '100%', padding: '11px', borderRadius: 12, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.text2, fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>🔄 Volver a sortear</button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes fadeInUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }`}</style>
    </div>
  )
}

// ── DB-connected mode (liga con tournament_standings) ─────────────────────────
function DBLigaView({ tournamentId, isOrganizer, ligaData, onLigaAction }) {
  const [allMatches, setAllMatches] = useState([])
  const [userMap, setUserMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('tabla')
  const [tableView, setTableView] = useState('apertura') // apertura|clausura|general
  const [scoreModal, setScoreModal] = useState(null)
  const [submitting, setSubmitting] = useState(null)
  const [showSorteo, setShowSorteo] = useState(false)
  const [promoCount, setPromoCount] = useState(2)

  const ligaFase = ligaData?.liga_fase || 'apertura'
  const clasifica = ligaData?.clasifica_copa || 8
  const phase = LIGA_PHASES.find(p => p.id === ligaFase) || LIGA_PHASES[0]
  const phaseIdx = LIGA_PHASES.findIndex(p => p.id === ligaFase)

  const aperturaMatches  = allMatches.filter(m => m.round === 1)
  const aperturaPlayoffs = allMatches.filter(m => m.round === 2)
  const clausuraMatches  = allMatches.filter(m => m.round === 3)
  const clausuraPlayoffs = allMatches.filter(m => m.round === 4)

  const aperturaStandings = computeStandings(aperturaMatches)
  const clausuraStandings = computeStandings(clausuraMatches)
  const generalStandings  = computeStandings([...aperturaMatches, ...clausuraMatches])

  async function load() {
    setLoading(true)
    const { data: mx } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round').order('jornada_number').order('round_number').order('match_number')

    const uids = new Set()
    ;(mx || []).forEach(m => { if (m.player1_id) uids.add(m.player1_id); if (m.player2_id) uids.add(m.player2_id) })

    if (uids.size > 0) {
      const { data: users } = await supabase.from('users').select('id, display_name, username, avatar_url').in('id', [...uids])
      const map = {}
      ;(users || []).forEach(u => { map[u.id] = { name: u.display_name || u.username || 'Jugador', avatar: u.avatar_url } })
      setUserMap(map)
    }
    setAllMatches(mx || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [tournamentId])

  async function submitScore(matchId, s1, s2, forcedWinnerId) {
    setSubmitting(matchId)
    const { data, error } = await supabase.rpc('submit_match_result', { p_match_id: matchId, p_score1: s1, p_score2: s2, p_photo_url: null })
    if (error || data?.ok === false) { alert(data?.error || error?.message || 'Error al cargar resultado'); setSubmitting(null); return }
    // For bracket tiebreakers, persist the forced winner immediately
    if (forcedWinnerId) {
      await supabase.from('tournament_matches').update({ winner_id: forcedWinnerId }).eq('id', matchId)
    }
    setScoreModal(null)
    await load()
    setSubmitting(null)
  }

  async function approveMatch(matchId) {
    setSubmitting(matchId)
    const { data, error } = await supabase.rpc('approve_match_result', { p_match_id: matchId })
    if (error || data?.ok === false) { alert(data?.error || error?.message || 'Error'); setSubmitting(null); return }
    setScoreModal(null)
    // Reload to get fresh match data before checking auto-advance
    const { data: mx } = await supabase.from('tournament_matches').select('*').eq('tournament_id', tournamentId).order('round').order('round_number').order('match_number')
    const freshMatch = (mx || []).find(m => m.id === matchId)
    if (freshMatch && (freshMatch.round === 2 || freshMatch.round === 4)) {
      await maybeAdvanceBracket(freshMatch.round, freshMatch.round_number, mx || [])
    }
    setAllMatches(mx || [])
    setSubmitting(null)
  }

  async function maybeAdvanceBracket(roundTag, roundNum, allMx) {
    const roundMatches = allMx.filter(m => m.round === roundTag && m.round_number === roundNum)
    const allDone = roundMatches.length > 0 && roundMatches.every(m => m.status === 'finalizado' || m.status === 'aprobado')
    if (!allDone) return

    const winners = roundMatches.map(m => m.winner_id).filter(Boolean)
    if (winners.length <= 1) return // champion decided, no next round needed

    const nextRoundNum = roundNum + 1
    // Check if next round already exists
    const nextExists = allMx.some(m => m.round === roundTag && m.round_number === nextRoundNum)
    if (nextExists) return

    const inserts = []
    for (let i = 0; i < winners.length; i += 2) {
      const a = winners[i], b = winners[i + 1]
      inserts.push({
        tournament_id: tournamentId,
        round: roundTag,
        round_number: nextRoundNum,
        match_number: Math.floor(i / 2) + 1,
        player1_id: a || null,
        player2_id: b || null,
        status: !b ? 'aprobado' : 'pendiente',
        winner_id: !b ? a : null,
        score1: !b ? 1 : null,
        score2: !b ? 0 : null,
      })
    }
    if (inserts.length > 0) {
      await supabase.from('tournament_matches').insert(inserts)
      // Reload fresh after inserting new round
      const { data: mx2 } = await supabase.from('tournament_matches').select('*').eq('tournament_id', tournamentId).order('round').order('round_number').order('match_number')
      setAllMatches(mx2 || [])
    }
  }

  async function handleAction(action, payload) {
    if (!onLigaAction) return
    await onLigaAction(action, payload)
    await load()
  }

  async function handleSorteoConfirm(seeded, phaseTag) {
    setShowSorteo(false)
    const matchInserts = []
    const roundNum = phaseTag === 2 ? 2 : 4
    for (let i = 0; i < seeded.length; i += 2) {
      const a = seeded[i], b = seeded[i+1]
      matchInserts.push({
        tournament_id: tournamentId,
        round: roundNum,
        round_number: 1,
        match_number: i/2 + 1,
        player1_id: a?.userId || null,
        player2_id: b?.userId || null,
        status: !b ? 'aprobado' : 'pendiente',
        winner_id: !b ? a?.userId : null,
        score1: !b ? 1 : null,
        score2: !b ? 0 : null,
      })
    }
    await supabase.from('tournament_matches').delete().eq('tournament_id', tournamentId).eq('round', roundNum)
    if (matchInserts.length > 0) await supabase.from('tournament_matches').insert(matchInserts)
    const nextFase = roundNum === 2 ? 'apertura_playoffs' : 'clausura_playoffs'
    await supabase.from('conversations').update({ liga_fase: nextFase }).eq('id', tournamentId)
    if (onLigaAction) await onLigaAction('set_fase', nextFase)
    await load()
  }

  // Determine what section to show in Brackets tab
  const inAperturaPlayoffs = ligaFase === 'apertura_playoffs' || ligaFase === 'clausura' || ligaFase === 'clausura_sorteo' || ligaFase === 'clausura_playoffs' || ligaFase === 'final_tabla'
  const inClausuraPlayoffs = ligaFase === 'clausura_playoffs' || ligaFase === 'final_tabla'

  const currentBracketMatches = (ligaFase === 'apertura_playoffs' || (!inClausuraPlayoffs && inAperturaPlayoffs)) ? aperturaPlayoffs
    : ligaFase === 'clausura_playoffs' || inClausuraPlayoffs ? clausuraPlayoffs
    : []

  // Fixture to show depends on tab context
  const fixtureMatches = tableView === 'clausura' ? clausuraMatches : aperturaMatches
  const fixtureJornadas = [...new Set(fixtureMatches.map(m => m.jornada_number))].sort((a,b)=>a-b)

  // Enriched player list for sorteo
  const sorteoSource = ligaFase === 'apertura_sorteo' ? aperturaStandings : clausuraStandings
  const sorteoPlayers = sorteoSource.map(s => ({ user_id: s.user_id, userId: s.user_id, name: userMap[s.user_id]?.name || 'Jugador', pts: s.pts }))
  const sorteoPhaseTag = ligaFase === 'apertura_sorteo' ? 2 : 4
  const sorteoLabel = ligaFase === 'apertura_sorteo' ? 'Apertura' : 'Clausura'

  // Pending match counter
  const pendingMatches = allMatches.filter(m => m.status === 'pendiente' || m.status === 'en_juego' || m.status === 'resultado_cargado')
  const awaitingApproval = allMatches.filter(m => m.status === 'resultado_cargado' || m.status === 'en_juego')

  // Tabs for current phase
  const showBracketsTab = inAperturaPlayoffs
  const TABS = [
    { id: 'tabla',   label: '📊 Tabla' },
    { id: 'fixture', label: '⚽ Fixture' },
    ...(showBracketsTab ? [{ id: 'brackets', label: '🏆 Brackets' }] : []),
    ...(ligaFase === 'final_tabla' ? [{ id: 'final', label: '🏁 Final' }] : []),
  ]

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.textDim }}>Cargando liga…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Phase progress stepper */}
      <div style={{ padding: '10px 14px', background: C.panel2, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
          {LIGA_PHASES.map((p, i) => {
            const done = i < phaseIdx
            const active = i === phaseIdx
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <div style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: active ? 800 : 500,
                  background: active ? p.color+'30' : done ? C.green+'15' : C.panel,
                  border: `1px solid ${active ? p.color : done ? C.green+'44' : C.border}`,
                  color: active ? p.color : done ? C.green : C.textDim,
                  whiteSpace: 'nowrap',
                }}>
                  {done ? '✓ ' : ''}{p.short}
                </div>
                {i < LIGA_PHASES.length - 1 && <span style={{ color: C.border, fontSize: 10 }}>›</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Pending match stats bar */}
      {allMatches.length > 0 && (
        <div style={{ padding: '6px 14px', background: C.panel, borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 14, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: C.textDim }}>
            ⚽ <strong style={{ color: C.text }}>{allMatches.length}</strong> partidos totales
          </span>
          {pendingMatches.length > 0 && (
            <span style={{ fontSize: 11, color: '#f59e0b' }}>
              ⏳ <strong>{pendingMatches.length}</strong> pendientes
            </span>
          )}
          {awaitingApproval.length > 0 && isOrganizer && (
            <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>
              ✅ <strong>{awaitingApproval.length}</strong> por aprobar
            </span>
          )}
        </div>
      )}

      {/* Organizer action banner */}
      {isOrganizer && (
        <div style={{ padding: '10px 14px', background: `${phase.color}12`, borderBottom: `1px solid ${phase.color}30`, flexShrink: 0 }}>
          {ligaFase === 'apertura' && aperturaMatches.length === 0 && (
            <button onClick={() => handleAction('generar_apertura')} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: C.green, color: C.bg, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              ⚽ Generar Fixture de Apertura
            </button>
          )}
          {ligaFase === 'apertura' && aperturaMatches.length > 0 && (
            <button onClick={() => handleAction('set_fase', 'apertura_sorteo')} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: '#a78bfa', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              🎲 Iniciar Sorteo de Playoffs Apertura
            </button>
          )}
          {ligaFase === 'apertura_sorteo' && (
            <button onClick={() => setShowSorteo(true)} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: '#a78bfa', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              🎲 Abrir Sorteo en Vivo
            </button>
          )}
          {ligaFase === 'apertura_playoffs' && (
            <button onClick={() => handleAction('iniciar_clausura')} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              🍂 Finalizar Playoffs → Iniciar Clausura
            </button>
          )}
          {ligaFase === 'clausura' && clausuraMatches.length === 0 && (
            <button onClick={() => handleAction('generar_clausura')} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              ⚽ Generar Fixture de Clausura (Ida y Vuelta)
            </button>
          )}
          {ligaFase === 'clausura' && clausuraMatches.length > 0 && (
            <button onClick={() => handleAction('set_fase', 'clausura_sorteo')} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: '#a78bfa', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              🎲 Iniciar Sorteo de Playoffs Clausura
            </button>
          )}
          {ligaFase === 'clausura_sorteo' && (
            <button onClick={() => setShowSorteo(true)} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: '#a78bfa', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              🎲 Abrir Sorteo en Vivo
            </button>
          )}
          {ligaFase === 'clausura_playoffs' && (
            <button onClick={() => handleAction('set_fase', 'final_tabla')} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              🏁 Ver Tabla Final / Ascensos y Descensos
            </button>
          )}
          {ligaFase === 'final_tabla' && (
            <button onClick={() => { if(confirm('¿Cerrar la liga definitivamente?')) handleAction('finalizar') }} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              ✅ Cerrar Liga
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
            color: tab === t.id ? C.green : C.textDim,
            borderBottom: `2px solid ${tab === t.id ? C.green : 'transparent'}`,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── TABLA ── */}
        {tab === 'tabla' && (
          <div>
            {/* Phase switcher for table */}
            <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: `1px solid ${C.border}22` }}>
              {[['apertura','⚡ Apertura'],['clausura','🍂 Clausura'],['general','📊 General']].map(([k,l]) => (
                <button key={k} onClick={() => setTableView(k)} style={{
                  padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
                  background: tableView === k ? C.green : C.panel2,
                  color: tableView === k ? C.bg : C.text2, fontWeight: tableView === k ? 700 : 400,
                }}>{l}</button>
              ))}
            </div>
            <StandingsTable
              rows={tableView === 'apertura' ? aperturaStandings : tableView === 'clausura' ? clausuraStandings : generalStandings}
              userMap={userMap}
              highlightTop={clasifica}
              highlightBottom={ligaFase === 'final_tabla' ? promoCount : 0}
              label={tableView === 'apertura' ? 'El fixture de Apertura aún no fue generado.' : tableView === 'clausura' ? 'El fixture de Clausura aún no fue generado.' : 'Sin datos aún.'}
            />
          </div>
        )}

        {/* ── FIXTURE ── */}
        {tab === 'fixture' && (
          <div>
            <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: `1px solid ${C.border}22` }}>
              {[['apertura','⚡ Apertura'],['clausura','🍂 Clausura']].map(([k,l]) => (
                <button key={k} onClick={() => setTableView(k)} style={{
                  padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
                  background: tableView === k ? C.green : C.panel2,
                  color: tableView === k ? C.bg : C.text2, fontWeight: tableView === k ? 700 : 400,
                }}>{l}</button>
              ))}
            </div>
            {fixtureJornadas.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: C.textDim }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
                <p style={{ margin: 0, fontSize: 13 }}>Sin fixture generado para {tableView === 'apertura' ? 'Apertura' : 'Clausura'}.</p>
              </div>
            ) : (
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {fixtureJornadas.map(j => (
                  <div key={j}>
                    <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Jornada {j}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {fixtureMatches.filter(m => m.jornada_number === j).map(match => {
                        const p1 = match.player1_id ? (userMap[match.player1_id]?.name || 'Jugador') : 'BYE'
                        const p2 = match.player2_id ? (userMap[match.player2_id]?.name || 'Jugador') : 'BYE'
                        const done = match.status === 'finalizado' || match.status === 'aprobado'
                        const inPlay = match.status === 'en_juego' || match.status === 'resultado_cargado'
                        return (
                          <button key={match.id} onClick={() => setScoreModal(match)} style={{
                            display: 'block', width: '100%', background: C.panel, border: `1px solid ${done ? C.green+'44' : C.border}`,
                            borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ flex: 1, fontSize: 13, fontWeight: done && match.winner_id === match.player1_id ? 700 : 400, color: done && match.winner_id === match.player1_id ? C.green : C.text, textAlign: 'right' }}>{p1}</span>
                              <span style={{ fontSize: 14, fontWeight: 800, color: C.text, minWidth: 52, textAlign: 'center' }}>
                                {done || inPlay ? `${match.score1 ?? '?'} — ${match.score2 ?? '?'}` : 'vs'}
                              </span>
                              <span style={{ flex: 1, fontSize: 13, fontWeight: done && match.winner_id === match.player2_id ? 700 : 400, color: done && match.winner_id === match.player2_id ? C.green : C.text }}>{p2}</span>
                            </div>
                            <p style={{ margin: '4px 0 0', fontSize: 10, fontWeight: 700, color: done ? C.green : inPlay ? '#f59e0b' : C.textDim, textAlign: 'center', textTransform: 'uppercase' }}>
                              {done ? '✓ Finalizado' : inPlay ? '⏳ Resultado enviado' : '— Pendiente —'}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── BRACKETS ── */}
        {tab === 'brackets' && (
          <div>
            {(inAperturaPlayoffs && !inClausuraPlayoffs) && (
              <div>
                <div style={{ padding: '10px 14px 0', display: 'flex', gap: 6 }}>
                  {[['apertura','Playoffs Apertura'],['clausura','Playoffs Clausura']].map(([k,l]) => (
                    <button key={k} onClick={() => setTableView(k)} style={{
                      padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
                      background: tableView === k ? C.green : C.panel2,
                      color: tableView === k ? C.bg : C.text2, fontWeight: tableView === k ? 700 : 400,
                    }}>{l}</button>
                  ))}
                </div>
                <BracketView
                  matches={tableView === 'clausura' ? clausuraPlayoffs : aperturaPlayoffs}
                  userMap={userMap}
                  onMatchClick={setScoreModal}
                  isOrganizer={isOrganizer}
                />
              </div>
            )}
            {inClausuraPlayoffs && !inAperturaPlayoffs && (
              <BracketView matches={clausuraPlayoffs} userMap={userMap} onMatchClick={setScoreModal} isOrganizer={isOrganizer} />
            )}
            {!inAperturaPlayoffs && !inClausuraPlayoffs && (
              <BracketView matches={[]} userMap={userMap} />
            )}
          </div>
        )}

        {/* ── FINAL TABLE ── */}
        {tab === 'final' && (
          <div style={{ padding: 14 }}>
            <div style={{ background: C.panel, borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <p style={{ margin: '0 0 10px', fontWeight: 800, color: C.text, fontSize: 14 }}>🏁 Tabla General Final</p>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: C.textDim }}>Ascensos y descensos al cierre de la temporada</p>
              {isOrganizer && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, color: C.textDim, fontWeight: 700 }}>Equipos que descienden:</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1,2,3,4].map(n => (
                      <button key={n} onClick={() => setPromoCount(n)} style={{
                        padding: '6px 14px', borderRadius: 20, border: `1px solid ${promoCount === n ? '#ef4444' : C.border}`,
                        background: promoCount === n ? '#ef444420' : C.panel2, color: promoCount === n ? '#ef4444' : C.text,
                        fontWeight: promoCount === n ? 700 : 400, fontSize: 12, cursor: 'pointer',
                      }}>{n} equipo{n>1?'s':''}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <StandingsTable
              rows={generalStandings}
              userMap={userMap}
              highlightTop={0}
              highlightBottom={promoCount}
            />
            <p style={{ margin: '8px 14px', fontSize: 10, color: C.textDim }}>🔴 Zona de descenso ({promoCount} equipo{promoCount>1?'s':''})</p>
          </div>
        )}

      </div>

      {/* Score modal */}
      {scoreModal && (
        <ScoreModal
          match={scoreModal}
          p1Name={scoreModal.player1_id ? (userMap[scoreModal.player1_id]?.name || 'Jugador 1') : 'BYE'}
          p2Name={scoreModal.player2_id ? (userMap[scoreModal.player2_id]?.name || 'Jugador 2') : 'BYE'}
          isOrganizer={isOrganizer}
          submitting={submitting}
          allowDraw={scoreModal.round === 1 || scoreModal.round === 3}
          onClose={() => setScoreModal(null)}
          onSubmit={submitScore}
          onApprove={approveMatch}
        />
      )}

      {/* Live draw modal */}
      {showSorteo && (
        <SorteoModal
          players={sorteoPlayers}
          clasificaN={clasifica}
          phaseLabel={sorteoLabel}
          onClose={() => setShowSorteo(false)}
          onConfirm={seeded => handleSorteoConfirm(seeded, sorteoPhaseTag)}
        />
      )}
    </div>
  )
}

// ── Standalone mode ───────────────────────────────────────────────────────────
export default function TablaPosicionesPage({ onBack, initialTeams = [], tournamentId, isOrganizer, embedded = false, ligaData, onLigaAction }) {
  const [teams, setTeams]           = useState(
    initialTeams.map((name, i) => ({ ...DEFAULT_TEAM, id: Date.now() + i, name }))
  )
  const [newName, setNewName]       = useState('')
  const [r, setR]                   = useState({ home: '', away: '', hg: 0, ag: 0 })
  const [tab, setTab]               = useState('tabla')

  function addTeam() {
    if (!newName.trim()) return
    setTeams(prev => [...prev, { ...DEFAULT_TEAM, id: Date.now(), name: newName.trim() }])
    setNewName('')
  }

  function removeTeam(id) {
    setTeams(prev => prev.filter(t => t.id !== id))
  }

  function applyResult() {
    const hg = parseInt(r.hg) || 0
    const ag = parseInt(r.ag) || 0
    let hPts = 0, aPts = 0
    if (hg > ag) { hPts = 3 }
    else if (hg < ag) { aPts = 3 }
    else { hPts = 1; aPts = 1 }

    setTeams(prev => prev.map(t => {
      if (t.id === r.home) return {
        ...t, pj: t.pj+1, pts: t.pts+hPts, gf: t.gf+hg, gc: t.gc+ag,
        pg: t.pg+(hPts===3?1:0), pe: t.pe+(hPts===1?1:0), pp: t.pp+(hPts===0?1:0),
      }
      if (t.id === r.away) return {
        ...t, pj: t.pj+1, pts: t.pts+aPts, gf: t.gf+ag, gc: t.gc+hg,
        pg: t.pg+(aPts===3?1:0), pe: t.pe+(aPts===1?1:0), pp: t.pp+(aPts===0?1:0),
      }
      return t
    }))
    setR({ home: '', away: '', hg: 0, ag: 0 })
  }

  const table = sorted(teams)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      {!embedded && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>📋 Tabla de Posiciones</h2>
            <p style={{ margin: 0, color: C.textDim, fontSize: 12 }}>{tournamentId ? 'Liga en vivo' : `${teams.length} equipos / jugadores`}</p>
          </div>
        </div>
      )}

      {/* DB-connected mode: delegate to DBLigaView */}
      {tournamentId ? (
        <DBLigaView tournamentId={tournamentId} isOrganizer={isOrganizer} ligaData={ligaData} onLigaAction={onLigaAction} />
      ) : (
        <>
          <div style={{ display: 'flex', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            {[['tabla','📊 Tabla'],['cargar','⚽ Cargar resultado'],['equipos','👥 Equipos']].map(([id, lbl]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                flex: 1, padding: '10px 6px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                color: tab === id ? C.green : C.textDim,
                borderBottom: `2px solid ${tab === id ? C.green : 'transparent'}`,
              }}>{lbl}</button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {tab === 'tabla' && (
              teams.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: C.textDim }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
                  <p style={{ margin: 0, fontSize: 14 }}>Agregá equipos desde la pestaña "Equipos"</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: C.panel }}>
                        {['#','Equipo','PJ','PG','PE','PP','GF','GC','DG','PTS'].map(h => (
                          <th key={h} style={{ padding: '10px 8px', color: C.textDim, fontWeight: 700, textAlign: h === 'Equipo' ? 'left' : 'center', whiteSpace: 'nowrap', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.map((t, i) => (
                        <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}11`, background: i < 4 ? `${C.green}05` : 'transparent' }}>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: i < 4 ? C.green : C.textDim, fontWeight: 700 }}>{i+1}</td>
                          <td style={{ padding: '10px 8px', color: C.text, fontWeight: i === 0 ? 700 : 400 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {i === 0 && <span>🥇</span>}
                              {i === 1 && <span>🥈</span>}
                              {i === 2 && <span>🥉</span>}
                              {t.name}
                            </div>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: C.text2 }}>{t.pj}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: C.green }}>{t.pg}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: C.text2 }}>{t.pe}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#ef4444' }}>{t.pp}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: C.text2 }}>{t.gf}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: C.text2 }}>{t.gc}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: gd(t) > 0 ? C.green : gd(t) < 0 ? '#ef4444' : C.textDim, fontWeight: 600 }}>{gd(t) > 0 ? '+' : ''}{gd(t)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, fontSize: 14, color: i < 4 ? C.green : C.text }}>{t.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ margin: '8px 16px', fontSize: 10, color: C.textDim }}>🟢 Zonas de clasificación · PJ Partidos jugados · DG Diferencia de gol · PTS Puntos</p>
                </div>
              )
            )}

            {tab === 'cargar' && (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {teams.length < 2 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: C.textDim }}>
                    <p>Necesitás al menos 2 equipos. Agregalos en la pestaña "Equipos".</p>
                  </div>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Resultado del partido</p>
                    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <p style={{ margin: '0 0 6px', fontSize: 11, color: C.textDim }}>Local</p>
                        <select value={r.home} onChange={e => setR(prev => ({ ...prev, home: e.target.value }))}
                          style={{ width: '100%', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: r.home ? C.text : C.textDim, fontSize: 14, outline: 'none' }}>
                          <option value="">Seleccionar equipo...</option>
                          {teams.filter(t => t.id !== r.away).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
                        <input type="number" min="0" value={r.hg} onChange={e => setR(p => ({ ...p, hg: e.target.value }))}
                          style={{ width: 64, textAlign: 'center', background: C.panel2, border: `1px solid ${C.green}`, borderRadius: 10, padding: '12px 0', color: C.text, fontSize: 24, fontWeight: 800, outline: 'none' }} />
                        <span style={{ fontSize: 20, color: C.textDim, fontWeight: 700 }}>—</span>
                        <input type="number" min="0" value={r.ag} onChange={e => setR(p => ({ ...p, ag: e.target.value }))}
                          style={{ width: 64, textAlign: 'center', background: C.panel2, border: `1px solid ${C.green}`, borderRadius: 10, padding: '12px 0', color: C.text, fontSize: 24, fontWeight: 800, outline: 'none' }} />
                      </div>
                      <div>
                        <p style={{ margin: '0 0 6px', fontSize: 11, color: C.textDim }}>Visitante</p>
                        <select value={r.away} onChange={e => setR(prev => ({ ...prev, away: e.target.value }))}
                          style={{ width: '100%', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: r.away ? C.text : C.textDim, fontSize: 14, outline: 'none' }}>
                          <option value="">Seleccionar equipo...</option>
                          {teams.filter(t => t.id !== r.home).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <button onClick={applyResult} disabled={!r.home || !r.away}
                        style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: r.home && r.away ? C.green : C.panel2, color: r.home && r.away ? C.bg : C.textDim, fontWeight: 700, fontSize: 14, cursor: r.home && r.away ? 'pointer' : 'default' }}>
                        ⚽ Confirmar resultado
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === 'equipos' && (
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTeam()}
                    placeholder="Nombre del equipo / jugador..."
                    style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none' }} />
                  <button onClick={addTeam} style={{ background: C.green, border: 'none', borderRadius: 10, padding: '0 18px', cursor: 'pointer', color: C.bg, fontWeight: 700, fontSize: 18 }}>+</button>
                </div>
                {teams.length === 0 ? (
                  <p style={{ textAlign: 'center', color: C.textDim, fontSize: 13, padding: '20px 0' }}>Sin equipos aún</p>
                ) : (
                  teams.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 8 }}>
                      <span style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: 600 }}>{t.name}</span>
                      <span style={{ fontSize: 12, color: C.textDim }}>{t.pts} pts</span>
                      <button onClick={() => removeTeam(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: 4 }}>🗑</button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
