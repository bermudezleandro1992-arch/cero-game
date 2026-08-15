import { useState } from 'react'
import { C } from '../../theme'

const TROPHIES = [
  { id: 'champion',  icon: '🏆', label: 'Campeón',        color: '#f59e0b', desc: 'Ganador del torneo' },
  { id: 'runner',    icon: '🥈', label: 'Subcampeón',     color: '#94a3b8', desc: '2do puesto' },
  { id: 'third',     icon: '🥉', label: '3er Lugar',      color: '#b45309', desc: '3er puesto' },
  { id: 'mvp',       icon: '⭐', label: 'MVP',            color: '#a855f7', desc: 'Mejor jugador' },
  { id: 'goleador',  icon: '⚽', label: 'Goleador',       color: '#22c55e', desc: 'Más goles' },
  { id: 'fair',      icon: '🤝', label: 'Fair Play',      color: '#3b82f6', desc: 'Juego limpio' },
  { id: 'streak',    icon: '🔥', label: 'Racha',          color: '#ef4444', desc: 'Mayor racha de victorias' },
  { id: 'debutante', icon: '🌟', label: 'Debutante',      color: '#06b6d4', desc: 'Mejor nuevo jugador' },
]

export default function SistemaPremiosPage({ onBack }) {
  const [players, setPlayers]   = useState([]) // { name, awards: [] }
  const [tab, setTab]           = useState('premios')
  const [newName, setNewName]   = useState('')
  const [dragging, setDragging] = useState(null) // { trophy, from? }
  const [awarded, setAwarded]   = useState({})   // playerId -> trophyId[]
  const [podium, setPodium]     = useState({ 1: '', 2: '', 3: '' })
  const [ceremony, setCeremony] = useState(false)

  function addPlayer() {
    if (!newName.trim()) return
    const id = Date.now()
    setPlayers(prev => [...prev, { id, name: newName.trim() }])
    setAwarded(prev => ({ ...prev, [id]: [] }))
    setNewName('')
  }

  function removePlayer(id) {
    setPlayers(prev => prev.filter(p => p.id !== id))
    setAwarded(prev => { const next = { ...prev }; delete next[id]; return next })
  }

  function toggleAward(playerId, trophyId) {
    setAwarded(prev => {
      const current = prev[playerId] || []
      const has = current.includes(trophyId)
      return { ...prev, [playerId]: has ? current.filter(t => t !== trophyId) : [...current, trophyId] }
    })
  }

  function clearAll() {
    const reset = {}
    players.forEach(p => { reset[p.id] = [] })
    setAwarded(reset)
    setPodium({ 1: '', 2: '', 3: '' })
    setCeremony(false)
  }

  const podiumPlayers = [1, 2, 3].map(pos => {
    const pid = podium[pos]
    return pid ? players.find(p => p.id === parseInt(pid)) : null
  })

  const awardedCount = (pid) => (awarded[pid] || []).length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>🏅 Sistema de Premios</h2>
          <p style={{ margin: 0, color: C.textDim, fontSize: 12 }}>Asigná trofeos y premios a los ganadores</p>
        </div>
        <button onClick={clearAll} style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: C.textDim, fontSize: 12 }}>🔄 Limpiar</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {[['premios','🏅 Premios'],['podio','🏆 Podio'],['jugadores','👥 Jugadores']].map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '10px 6px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 600,
            color: tab === id ? C.green : C.textDim,
            borderBottom: `2px solid ${tab === id ? C.green : 'transparent'}`,
          }}>{lbl}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* PREMIOS — asignar trofeos */}
        {tab === 'premios' && (
          players.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: C.textDim }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>👥</div>
              <p style={{ margin: 0, fontSize: 14 }}>Agregá jugadores primero</p>
              <button onClick={() => setTab('jugadores')} style={{ marginTop: 14, background: C.green, border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: C.bg, fontWeight: 700, fontSize: 13 }}>
                Ir a Jugadores
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Trophy legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TROPHIES.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${t.color}14`, border: `1px solid ${t.color}33`, borderRadius: 20, padding: '3px 10px' }}>
                    <span style={{ fontSize: 12 }}>{t.icon}</span>
                    <span style={{ fontSize: 11, color: t.color, fontWeight: 700 }}>{t.label}</span>
                  </div>
                ))}
              </div>

              {players.map(p => (
                <div key={p.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.panel2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: C.text, flexShrink: 0 }}>
                      {p.name.slice(0,2).toUpperCase()}
                    </div>
                    <p style={{ margin: 0, flex: 1, fontWeight: 700, color: C.text, fontSize: 14 }}>{p.name}</p>
                    {awardedCount(p.id) > 0 && (
                      <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, background: '#f59e0b18', border: '1px solid #f59e0b33', borderRadius: 20, padding: '2px 8px' }}>
                        {awardedCount(p.id)} premio{awardedCount(p.id) !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {TROPHIES.map(t => {
                      const has = (awarded[p.id] || []).includes(t.id)
                      return (
                        <button key={t.id} onClick={() => toggleAward(p.id, t.id)} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          background: has ? `${t.color}20` : C.panel2,
                          border: `1.5px solid ${has ? t.color : C.border}`,
                          borderRadius: 10, padding: '6px 10px', cursor: 'pointer',
                          transition: 'all .15s',
                        }}>
                          <span style={{ fontSize: 14 }}>{t.icon}</span>
                          <span style={{ fontSize: 11, color: has ? t.color : C.textDim, fontWeight: has ? 700 : 400 }}>{t.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  {(awarded[p.id] || []).length > 0 && (
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: C.textDim }}>
                      {(awarded[p.id] || []).map(tid => {
                        const t = TROPHIES.find(x => x.id === tid)
                        return t?.desc
                      }).filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* PODIO */}
        {tab === 'podio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!ceremony ? (
              <>
                {/* Assign podium */}
                {[1, 2, 3].map(pos => {
                  const icons = ['🥇','🥈','🥉']
                  const colors = ['#f59e0b','#94a3b8','#b45309']
                  return (
                    <div key={pos}>
                      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                        {icons[pos-1]} {['1er Lugar','2do Lugar','3er Lugar'][pos-1]}
                      </p>
                      <select value={podium[pos]} onChange={e => setPodium(p => ({ ...p, [pos]: e.target.value }))}
                        style={{ width: '100%', background: C.panel2, border: `2px solid ${podium[pos] ? colors[pos-1] : C.border}`, borderRadius: 10, padding: '10px 14px', color: podium[pos] ? C.text : C.textDim, fontSize: 14, outline: 'none' }}>
                        <option value="">Seleccionar jugador...</option>
                        {players.filter(p => !Object.entries(podium).some(([k, v]) => parseInt(k) !== pos && v === String(p.id))).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}

                <button onClick={() => setCeremony(true)} disabled={!podium[1]} style={{
                  width: '100%', padding: 14, borderRadius: 12, border: 'none',
                  background: podium[1] ? `linear-gradient(135deg, #f59e0b, #d97706)` : C.panel2,
                  color: podium[1] ? '#000' : C.textDim,
                  fontWeight: 800, fontSize: 15, cursor: podium[1] ? 'pointer' : 'default',
                  boxShadow: podium[1] ? '0 4px 20px #f59e0b44' : 'none',
                }}>🎉 ¡Revelar Podio!</button>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
                <p style={{ margin: '0 0 20px', color: C.text, fontWeight: 800, fontSize: 18 }}>¡Resultados finales!</p>

                {/* Podium visual */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 24, height: 160 }}>
                  {/* 2nd */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#94a3b818', border: '2px solid #94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#94a3b8' }}>
                      {podiumPlayers[1] ? podiumPlayers[1].name.slice(0,2).toUpperCase() : '?'}
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: C.text, fontWeight: 700, maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{podiumPlayers[1]?.name || '—'}</p>
                    <div style={{ width: 80, background: '#94a3b8', borderRadius: '6px 6px 0 0', height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🥈</div>
                  </div>
                  {/* 1st */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f59e0b18', border: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>
                      {podiumPlayers[0] ? podiumPlayers[0].name.slice(0,2).toUpperCase() : '?'}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: C.text, fontWeight: 800, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{podiumPlayers[0]?.name || '—'}</p>
                    <div style={{ width: 80, background: '#f59e0b', borderRadius: '6px 6px 0 0', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🥇</div>
                  </div>
                  {/* 3rd */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#b4530918', border: '2px solid #b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#b45309' }}>
                      {podiumPlayers[2] ? podiumPlayers[2].name.slice(0,2).toUpperCase() : '?'}
                    </div>
                    <p style={{ margin: 0, fontSize: 10, color: C.text, fontWeight: 700, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{podiumPlayers[2]?.name || '—'}</p>
                    <div style={{ width: 80, background: '#b45309', borderRadius: '6px 6px 0 0', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🥉</div>
                  </div>
                </div>

                {/* Individual awards */}
                {players.filter(p => (awarded[p.id] || []).length > 0).map(p => (
                  <div key={p.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', marginBottom: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <p style={{ margin: 0, flex: 1, fontWeight: 700, color: C.text, fontSize: 14 }}>{p.name}</p>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(awarded[p.id] || []).map(tid => {
                        const t = TROPHIES.find(x => x.id === tid)
                        return t ? <span key={tid} title={t.label} style={{ fontSize: 18 }}>{t.icon}</span> : null
                      })}
                    </div>
                  </div>
                ))}

                <button onClick={() => setCeremony(false)} style={{ marginTop: 12, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: C.textDim, fontSize: 13 }}>
                  ← Editar podio
                </button>
              </div>
            )}
          </div>
        )}

        {/* JUGADORES */}
        {tab === 'jugadores' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlayer()}
                placeholder="Nombre del jugador..." style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none' }} />
              <button onClick={addPlayer} style={{ background: C.green, border: 'none', borderRadius: 10, padding: '0 18px', cursor: 'pointer', color: C.bg, fontWeight: 700, fontSize: 18 }}>+</button>
            </div>
            {players.length === 0 ? (
              <p style={{ textAlign: 'center', color: C.textDim, fontSize: 13, padding: '20px 0' }}>Sin jugadores aún</p>
            ) : players.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 8 }}>
                <span style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: 600 }}>{p.name}</span>
                {awardedCount(p.id) > 0 && (
                  <span style={{ fontSize: 11, color: '#f59e0b' }}>{awardedCount(p.id)} 🏅</span>
                )}
                <button onClick={() => removePlayer(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: 4 }}>🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
