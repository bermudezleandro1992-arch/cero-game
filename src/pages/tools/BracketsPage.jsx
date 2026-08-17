import { useState } from 'react'
import { C } from '../../theme'

function buildBracket(players) {
  // Pad to next power of 2 with BYEs
  let n = 1; while (n < players.length) n *= 2
  const seeded = [...players]
  while (seeded.length < n) seeded.push('BYE')

  // Build rounds
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

export default function BracketsPage({ onBack, initialPlayers = [] }) {
  const initList = initialPlayers.filter(Boolean)
  const [input, setInput]     = useState(initList.join('\n'))
  const [players, setPlayers] = useState(initList)
  const [rounds, setRounds]   = useState([])
  const [generated, setGenerated] = useState(false)
  const [editRounds, setEditRounds] = useState([])

  function generate() {
    if (players.length < 2) return
    const shuffled = [...players].sort(() => Math.random() - 0.5)
    const bracket = buildBracket(shuffled)
    setRounds(bracket)
    setEditRounds(bracket.map(r => r.map(m => ({ ...m }))))
    setGenerated(true)
  }

  function setWinner(roundIdx, matchIdx, winner) {
    setEditRounds(prev => {
      const next = prev.map(r => r.map(m => ({ ...m })))
      next[roundIdx][matchIdx].winner = winner
      // Propagate to next round
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
    setRounds([])
    setEditRounds([])
    setPlayers([])
    setInput('')
  }

  const roundLabels = (total) => {
    const labels = ['Final']
    if (total > 1) labels.unshift('Semifinal')
    if (total > 2) labels.unshift('Cuartos')
    if (total > 3) labels.unshift('Octavos')
    while (labels.length < total) labels.unshift(`Ronda ${total - labels.length + 1}`)
    return labels
  }

  const champion = editRounds.length > 0 ? editRounds[editRounds.length - 1][0]?.winner : null
  const labels = roundLabels(editRounds.length)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>🔱 Generador de Brackets</h2>
          <p style={{ margin: 0, color: C.textDim, fontSize: 12 }}>Eliminación directa automática</p>
        </div>
        {generated && (
          <button onClick={reset} style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: C.textDim, fontSize: 12 }}>
            🔄 Nuevo
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {!generated ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Quick fill por tamaño */}
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

            {/* Input */}
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                Participantes ({players.length})
              </p>
              <textarea
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  setPlayers(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))
                }}
                placeholder="Un jugador por línea:&#10;@jugador1&#10;@jugador2&#10;@jugador3&#10;@jugador4"
                rows={8}
                style={{ width: '100%', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            <button
              onClick={generate}
              disabled={players.length < 2}
              style={{
                width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                background: players.length >= 2 ? `linear-gradient(135deg, #06b6d4, #0284c7)` : C.panel2,
                color: players.length >= 2 ? '#fff' : C.textDim,
                fontWeight: 800, fontSize: 16, cursor: players.length >= 2 ? 'pointer' : 'default',
                boxShadow: players.length >= 2 ? '0 4px 20px #06b6d444' : 'none',
              }}
            >🔱 Generar Bracket</button>

            {players.length > 0 && players.length < 2 && (
              <p style={{ margin: 0, textAlign: 'center', color: '#f59e0b', fontSize: 13 }}>Necesitás al menos 2 participantes</p>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Campeón */}
            {champion && champion !== '?' && (
              <div style={{ background: `linear-gradient(135deg, #f59e0b22, #f59e0b08)`, border: `2px solid #f59e0b`, borderRadius: 16, padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: 32 }}>🏆</div>
                <p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '2px', textTransform: 'uppercase' }}>Campeón</p>
                <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 900, color: '#f59e0b' }}>{champion}</p>
              </div>
            )}

            {/* Bracket por rondas */}
            {editRounds.map((round, ri) => (
              <div key={ri}>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#06b6d4', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  {labels[ri]}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {round.map((match, mi) => (
                    <div key={mi} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                      {[match.p1, match.p2].map((p, pi) => (
                        <div
                          key={pi}
                          onClick={() => p && p !== '?' && p !== 'BYE' && setWinner(ri, mi, p)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px',
                            borderBottom: pi === 0 ? `1px solid ${C.border}` : 'none',
                            background: match.winner === p && p !== 'BYE' ? `${C.green}18` : 'transparent',
                            cursor: p && p !== '?' && p !== 'BYE' ? 'pointer' : 'default',
                            transition: 'background .15s',
                          }}
                        >
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            background: match.winner === p && p !== 'BYE' ? C.green : C.border,
                          }} />
                          <span style={{
                            flex: 1, fontSize: 13,
                            fontWeight: match.winner === p ? 700 : 400,
                            color: p === 'BYE' ? C.textDim : match.winner === p ? C.green : C.text,
                            fontStyle: p === '?' ? 'italic' : 'normal',
                          }}>{p === 'BYE' ? '— BYE' : p}</span>
                          {match.winner === p && p !== 'BYE' && (
                            <span style={{ fontSize: 14 }}>✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <p style={{ margin: 0, textAlign: 'center', fontSize: 12, color: C.textDim }}>
              Tocá un jugador para marcarlo como ganador
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
