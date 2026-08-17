import { useState } from 'react'
import { C } from '../../theme'

const DEFAULT_TEAM = { name: '', pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 }

function gd(t) { return t.gf - t.gc }

function sorted(teams) {
  return [...teams].sort((a, b) =>
    b.pts - a.pts || gd(b) - gd(a) || b.gf - a.gf || a.name.localeCompare(b.name)
  )
}

export default function TablaPosicionesPage({ onBack, initialTeams = [] }) {
  const [teams, setTeams]           = useState(
    initialTeams.map((name, i) => ({ ...DEFAULT_TEAM, id: Date.now() + i, name }))
  )
  const [newName, setNewName]       = useState('')
  const [adding, setAdding]         = useState(false)
  const [resultModal, setResultModal] = useState(false)
  const [r, setR]                   = useState({ home: '', away: '', hg: 0, ag: 0 })
  const [tab, setTab]               = useState('tabla') // tabla | cargar

  function addTeam() {
    if (!newName.trim()) return
    setTeams(prev => [...prev, { ...DEFAULT_TEAM, id: Date.now(), name: newName.trim() }])
    setNewName(''); setAdding(false)
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
    setResultModal(false)
  }

  const table = sorted(teams)
  const eligible = teams.filter(t => t.id !== r.home && t.id !== r.away)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>📋 Tabla de Posiciones</h2>
          <p style={{ margin: 0, color: C.textDim, fontSize: 12 }}>{teams.length} equipos / jugadores</p>
        </div>
      </div>

      {/* Tabs */}
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

        {/* TABLA */}
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

        {/* CARGAR RESULTADO */}
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
                  {/* Local */}
                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: C.textDim }}>Local</p>
                    <select value={r.home} onChange={e => setR(prev => ({ ...prev, home: e.target.value }))}
                      style={{ width: '100%', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: r.home ? C.text : C.textDim, fontSize: 14, outline: 'none' }}>
                      <option value="">Seleccionar equipo...</option>
                      {teams.filter(t => t.id !== r.away).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  {/* Score */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
                    <input type="number" min="0" value={r.hg} onChange={e => setR(p => ({ ...p, hg: e.target.value }))}
                      style={{ width: 64, textAlign: 'center', background: C.panel2, border: `1px solid ${C.green}`, borderRadius: 10, padding: '12px 0', color: C.text, fontSize: 24, fontWeight: 800, outline: 'none' }} />
                    <span style={{ fontSize: 20, color: C.textDim, fontWeight: 700 }}>—</span>
                    <input type="number" min="0" value={r.ag} onChange={e => setR(p => ({ ...p, ag: e.target.value }))}
                      style={{ width: 64, textAlign: 'center', background: C.panel2, border: `1px solid ${C.green}`, borderRadius: 10, padding: '12px 0', color: C.text, fontSize: 24, fontWeight: 800, outline: 'none' }} />
                  </div>
                  {/* Visitante */}
                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: C.textDim }}>Visitante</p>
                    <select value={r.away} onChange={e => setR(prev => ({ ...prev, away: e.target.value }))}
                      style={{ width: '100%', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: r.away ? C.text : C.textDim, fontSize: 14, outline: 'none' }}>
                      <option value="">Seleccionar equipo...</option>
                      {teams.filter(t => t.id !== r.home).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={applyResult}
                    disabled={!r.home || !r.away}
                    style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: r.home && r.away ? C.green : C.panel2, color: r.home && r.away ? C.bg : C.textDim, fontWeight: 700, fontSize: 14, cursor: r.home && r.away ? 'pointer' : 'default' }}
                  >⚽ Confirmar resultado</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* EQUIPOS */}
        {tab === 'equipos' && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTeam()}
                placeholder="Nombre del equipo / jugador..."
                style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none' }}
              />
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
    </div>
  )
}
