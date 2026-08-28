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

const FASES = [
  { id: 'apertura', label: '⚡ Apertura', color: '#22c55e' },
  { id: 'clausura', label: '🍂 Clausura', color: '#f59e0b' },
  { id: 'copa',     label: '🏆 Copa LFA', color: '#8b5cf6' },
]

// ── DB-connected mode (liga con tournament_standings) ─────────────────────────
function DBLigaView({ tournamentId, isOrganizer, ligaData, onLigaAction }) {
  const [standings, setStandings] = useState([])
  const [matches, setMatches] = useState([])
  const [userMap, setUserMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('tabla')
  const [scoreModal, setScoreModal] = useState(null)
  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)
  const [submitting, setSubmitting] = useState(null)

  async function load() {
    setLoading(true)
    const [{ data: st }, { data: mx }] = await Promise.all([
      supabase.from('tournament_standings').select('*').eq('tournament_id', tournamentId).order('posicion'),
      supabase.from('tournament_matches').select('*').eq('tournament_id', tournamentId).order('jornada_number').order('match_number'),
    ])

    const uids = new Set()
    ;(st || []).forEach(s => uids.add(s.user_id))
    ;(mx || []).forEach(m => { if (m.player1_id) uids.add(m.player1_id); if (m.player2_id) uids.add(m.player2_id) })

    const { data: users } = await supabase.from('users').select('id, display_name, username, avatar_url').in('id', [...uids])
    const map = {}
    ;(users || []).forEach(u => { map[u.id] = { name: u.display_name || u.username || 'Jugador', avatar: u.avatar_url } })

    setUserMap(map)
    setStandings(st || [])
    setMatches(mx || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [tournamentId])

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

  async function approveMatch(matchId) {
    setSubmitting(matchId)
    const { data, error } = await supabase.rpc('approve_match_result', { p_match_id: matchId })
    if (error || data?.ok === false) alert(data?.error || error?.message || 'Error')
    await load()
    setSubmitting(null)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.textDim }}>Cargando liga...</div>

  const jornadas = [...new Set(matches.map(m => m.jornada_number))].sort((a,b) => a-b)
  const statusColor = { pendiente: C.textDim, en_juego: '#f59e0b', finalizado: C.green }
  const ligaFase = ligaData?.liga_fase
  const clasifica = ligaData?.clasifica_copa || 8

  async function handleFase(faseId) {
    if (!onLigaAction) return
    await onLigaAction('set_fase', faseId)
  }

  async function handleFinalizarLiga() {
    if (!onLigaAction) return
    if (!confirm('¿Finalizar la liga permanentemente?')) return
    await onLigaAction('finalizar')
  }

  async function handleGenerarFixture() {
    if (!onLigaAction) return
    await onLigaAction('generar_fixture')
    await load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Fases — visible para todos */}
      {ligaData && (
        <div style={{ padding: '10px 14px', background: C.panel2, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 800, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Fase y estado</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {FASES.map(f => {
              const active = ligaFase === f.id
              return (
                <button key={f.id} onClick={() => isOrganizer && handleFase(f.id)} style={{
                  padding: '6px 14px', borderRadius: 20, border: `1px solid ${active ? f.color : C.border}`,
                  background: active ? f.color + '25' : C.panel, color: active ? f.color : C.textDim,
                  fontWeight: active ? 800 : 500, fontSize: 12,
                  cursor: isOrganizer ? 'pointer' : 'default',
                }}>{f.label}</button>
              )
            })}
            {isOrganizer && (
              <button onClick={handleFinalizarLiga} style={{
                padding: '6px 14px', borderRadius: 20, border: `1px solid #ef444466`,
                background: '#ef444412', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>✓ Finalizar liga</button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {[['tabla','📊 Tabla'],['partidos','⚽ Fixture']].map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '10px 6px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 600,
            color: tab === id ? C.green : C.textDim,
            borderBottom: `2px solid ${tab === id ? C.green : 'transparent'}`,
          }}>{lbl}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'tabla' && (
          standings.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: C.textDim }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
              <p style={{ margin: 0 }}>La liga no ha iniciado todavía.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.panel }}>
                    {['#','Jugador','PJ','PG','PE','PP','GF','GC','DG','PTS'].map(h => (
                      <th key={h} style={{ padding: '10px 8px', color: C.textDim, fontWeight: 700, textAlign: h === 'Jugador' ? 'left' : 'center', whiteSpace: 'nowrap', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => {
                    const uInfo = userMap[s.user_id] || {}
                    const name = uInfo.name || 'Jugador'
                    const avatar = uInfo.avatar
                    const diff = s.gf - s.gc
                    const inZone = i < clasifica
                    const medal = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
                    return (
                      <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}22`, background: inZone ? `${C.green}06` : 'transparent' }}>
                        <td style={{ padding: '10px 6px', textAlign: 'center', color: inZone ? C.green : C.textDim, fontWeight: 700, fontSize: 13 }}>{i+1}</td>
                        <td style={{ padding: '10px 6px', color: C.text, fontWeight: i === 0 ? 700 : 400 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            {avatar
                              ? <img src={avatar} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                              : <div style={{ width: 24, height: 24, borderRadius: '50%', background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.textDim, flexShrink: 0 }}>{name[0]}</div>
                            }
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>{name}</span>
                            {medal && <span style={{ fontSize: 14 }}>{medal}</span>}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: C.text2 }}>{s.pj}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: C.green }}>{s.pg}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: C.text2 }}>{s.pe}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: '#ef4444' }}>{s.pp}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: C.text2 }}>{s.gf}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: C.text2 }}>{s.gc}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: diff > 0 ? C.green : diff < 0 ? '#ef4444' : C.textDim, fontWeight: 600 }}>{diff > 0 ? '+' : ''}{diff}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, fontSize: 14, color: i < 4 ? C.green : C.text }}>{s.puntos}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p style={{ margin: '8px 16px', fontSize: 10, color: C.textDim }}>🟢 Zonas de clasificación · PJ Partidos jugados · DG Diferencia de gol · PTS Puntos</p>
            </div>
          )
        )}

        {tab === 'partidos' && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {jornadas.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: C.textDim }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
                <p style={{ margin: '0 0 6px' }}>Sin fixture generado.</p>
                <p style={{ margin: '0 0 20px', fontSize: 12 }}>Se generará un todos contra todos con Ida (Apertura) y Vuelta (Clausura). Necesitás al menos 2 jugadores.</p>
                {isOrganizer && (
                  <button onClick={handleGenerarFixture} style={{
                    padding: '12px 24px', borderRadius: 12, border: 'none',
                    background: C.green, color: C.bg, fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  }}>⚽ Generar Fixture Automático</button>
                )}
              </div>
            ) : (
              jornadas.map(j => (
                <div key={j}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Jornada {j}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {matches.filter(m => m.jornada_number === j).map(match => {
                      const p1 = match.player1_id ? (userMap[match.player1_id]?.name || 'Jugador') : 'BYE'
                      const p2 = match.player2_id ? (userMap[match.player2_id]?.name || 'Jugador') : 'BYE'
                      const done = match.status === 'finalizado'
                      const inPlay = match.status === 'en_juego'
                      return (
                        <div key={match.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: done && match.winner_id === match.player1_id ? 700 : 400, color: done && match.winner_id === match.player1_id ? C.green : C.text, textAlign: 'right' }}>{p1}</span>
                            <span style={{ fontSize: 15, fontWeight: 800, color: C.text, minWidth: 50, textAlign: 'center' }}>
                              {(inPlay || done) && match.score1 != null ? `${match.score1} — ${match.score2}` : '— vs —'}
                            </span>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: done && match.winner_id === match.player2_id ? 700 : 400, color: done && match.winner_id === match.player2_id ? C.green : C.text }}>{p2}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: statusColor[match.status] || C.textDim, textTransform: 'uppercase' }}>{match.status}</span>
                            {match.status === 'pendiente' && match.player1_id && match.player2_id && (
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
              ))
            )}
          </div>
        )}
      </div>

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
