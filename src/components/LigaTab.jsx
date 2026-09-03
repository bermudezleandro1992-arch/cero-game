/**
 * LigaTab — tabla de posiciones y fixture para ligas.
 * fase: 'apertura' | 'clausura' | 'all'
 * showFixture: muestra los partidos de la jornada
 */
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

function avatar(p, size = 28) {
  const style = { width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${C.border}`, flexShrink: 0 }
  return p?.avatar_url
    ? <img src={p.avatar_url} alt="" style={style} />
    : <div style={{ ...style, background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, fontWeight: 700, color: C.textDim }}>
        {(p?.display_name || p?.username || '?')[0].toUpperCase()}
      </div>
}

function buildStandings(matches, members) {
  const stats = {}
  members.forEach(m => {
    stats[m.user_id] = { profile: m.profile, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 }
  })
  matches.filter(m => m.status === 'finalizado').forEach(m => {
    const s1 = m.score_player1 ?? 0
    const s2 = m.score_player2 ?? 0
    if (m.player1_id && stats[m.player1_id]) {
      stats[m.player1_id].pj++; stats[m.player1_id].gf += s1; stats[m.player1_id].gc += s2
      if (s1 > s2) stats[m.player1_id].pg++
      else if (s1 === s2) stats[m.player1_id].pe++
      else stats[m.player1_id].pp++
    }
    if (m.player2_id && stats[m.player2_id]) {
      stats[m.player2_id].pj++; stats[m.player2_id].gf += s2; stats[m.player2_id].gc += s1
      if (s2 > s1) stats[m.player2_id].pg++
      else if (s2 === s1) stats[m.player2_id].pe++
      else stats[m.player2_id].pp++
    }
  })
  return Object.entries(stats).map(([uid, s]) => ({
    user_id: uid,
    profile: s.profile,
    pj: s.pj, pg: s.pg, pe: s.pe, pp: s.pp,
    gf: s.gf, gc: s.gc,
    dif: s.gf - s.gc,
    pts: s.pg * 3 + s.pe,
  })).sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf)
}

// Agrupa partidos en jornadas por round_number o created_at
function groupByJornada(matches) {
  const map = {}
  matches.forEach(m => {
    const j = m.round_number ?? 1
    if (!map[j]) map[j] = []
    map[j].push(m)
  })
  return Object.entries(map)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([jornada, items]) => ({ jornada: Number(jornada), items }))
}

// ── Tabla de posiciones ───────────────────────────────────────────────────────
function StandingsTable({ standings, ascensos, descensos, profile }) {
  function zoneColor(pos, total) {
    if (ascensos > 0 && pos <= ascensos) return '#22c55e'
    if (descensos > 0 && pos > total - descensos) return '#ef4444'
    return null
  }
  function posIcon(pos, total) {
    if (ascensos > 0 && pos <= ascensos) return '⬆️'
    if (descensos > 0 && pos > total - descensos) return '⬇️'
    return null
  }

  const COL = { color: C.textDim, fontSize: 11, fontWeight: 700, textAlign: 'center', padding: '8px 6px', whiteSpace: 'nowrap' }
  const CEL = (accent) => ({ color: accent || C.text2, fontSize: 12, fontWeight: accent ? 800 : 500, textAlign: 'center', padding: '10px 5px' })

  if (!standings.length) return (
    <div style={{ textAlign: 'center', paddingTop: 48 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🏅</div>
      <div style={{ color: C.textDim, fontSize: 13 }}>No hay partidos finalizados aún.</div>
    </div>
  )

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
      {/* Leyenda zonas */}
      {(ascensos > 0 || descensos > 0) && (
        <div style={{ display: 'flex', gap: 16, padding: '10px 16px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
          {ascensos > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#22c55e' }} />
              <span style={{ color: C.textDim, fontSize: 10, fontWeight: 600 }}>Ascenso (top {ascensos})</span>
            </div>
          )}
          {descensos > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444' }} />
              <span style={{ color: C.textDim, fontSize: 10, fontWeight: 600 }}>Descenso (últimos {descensos})</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: `${C.green}50` }} />
            <span style={{ color: C.textDim, fontSize: 10, fontWeight: 600 }}>Tu posición</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '22px 30px 1fr 32px 26px 26px 26px 32px 32px 32px 38px', background: C.panel2 }}>
        <div style={COL}></div>
        <div style={COL}>#</div>
        <div style={{ ...COL, textAlign: 'left', paddingLeft: 8 }}>Jugador</div>
        <div style={COL}>PJ</div>
        <div style={COL}>PG</div>
        <div style={COL}>PE</div>
        <div style={COL}>PP</div>
        <div style={COL}>GF</div>
        <div style={COL}>GC</div>
        <div style={COL}>DIF</div>
        <div style={{ ...COL, color: C.green }}>PTS</div>
      </div>

      {/* Rows */}
      {standings.map((s, i) => {
        const pos  = i + 1
        const zone = zoneColor(pos, standings.length)
        const icon = posIcon(pos, standings.length)
        const isMe = s.user_id === profile?.id
        return (
          <div key={s.user_id} style={{
            display: 'grid', gridTemplateColumns: '22px 30px 1fr 32px 26px 26px 26px 32px 32px 32px 38px',
            borderTop: `1px solid ${C.border}`,
            background: isMe ? `${C.green}08` : zone ? `${zone}06` : 'transparent',
            borderLeft: zone ? `3px solid ${zone}` : isMe ? `3px solid ${C.green}` : '3px solid transparent',
            alignItems: 'center',
          }}>
            <div style={{ ...CEL(), fontSize: 12, paddingLeft: 2 }}>{icon || ''}</div>
            <div style={{ ...CEL(), color: C.textDim, fontSize: 11 }}>{pos}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 8px' }}>
              {avatar(s.profile, 22)}
              <span style={{ color: isMe ? C.green : C.text, fontWeight: isMe ? 800 : 500, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.profile?.display_name || s.profile?.username || '?'}{isMe && ' (vos)'}
              </span>
            </div>
            <div style={CEL()}>{s.pj}</div>
            <div style={CEL('#22c55e')}>{s.pg}</div>
            <div style={CEL()}>{s.pe}</div>
            <div style={CEL('#ef4444')}>{s.pp}</div>
            <div style={CEL()}>{s.gf}</div>
            <div style={CEL()}>{s.gc}</div>
            <div style={CEL(s.dif > 0 ? '#22c55e' : s.dif < 0 ? '#ef4444' : null)}>
              {s.dif > 0 ? `+${s.dif}` : s.dif}
            </div>
            <div style={{ ...CEL(C.green), fontSize: 14, fontWeight: 900 }}>{s.pts}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Fixture por jornadas ──────────────────────────────────────────────────────
function FixtureView({ matches, profilesMap, profile, fase }) {
  const [jornadaOpen, setJornadaOpen] = useState(null)
  const jornadas = groupByJornada(matches)

  if (!jornadas.length) return (
    <div style={{ textAlign: 'center', paddingTop: 48 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{fase === 'clausura' ? '🔄' : '⚽'}</div>
      <div style={{ color: C.textDim, fontSize: 13 }}>
        {fase === 'clausura' ? 'Los partidos de vuelta se generarán al finalizar la Apertura.' : 'No hay partidos generados aún para esta fase.'}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {jornadas.map(({ jornada, items }) => {
        const isOpen = jornadaOpen === jornada
        const done   = items.filter(m => m.status === 'finalizado').length
        const total  = items.length
        const pct    = total ? Math.round((done / total) * 100) : 0

        return (
          <div key={jornada} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
            {/* Header jornada */}
            <button
              onClick={() => setJornadaOpen(isOpen ? null : jornada)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: isOpen ? `1px solid ${C.border}` : 'none',
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: pct === 100 ? `${C.green}20` : C.panel2,
                border: `1.5px solid ${pct === 100 ? C.green : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 800, color: pct === 100 ? C.green : C.textDim,
              }}>
                {jornada}
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: C.text }}>Jornada {jornada}</p>
                <p style={{ margin: 0, fontSize: 11, color: C.textDim }}>{done}/{total} partidos jugados</p>
              </div>
              {pct === 100 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: `${C.green}20`, color: C.green }}>
                  ✓ Completa
                </span>
              )}
              {pct > 0 && pct < 100 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: '#f59e0b20', color: '#f59e0b' }}>
                  En juego
                </span>
              )}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {/* Partidos de la jornada */}
            {isOpen && (
              <div style={{ padding: '8px 12px 12px' }}>
                {items.map(m => {
                  const p1 = profilesMap[m.player1_id]
                  const p2 = profilesMap[m.player2_id]
                  const done = m.status === 'finalizado'
                  return (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 8px', borderBottom: `1px solid ${C.border}`,
                    }}>
                      {/* Jugador 1 */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: m.player1_id === profile?.id ? C.green : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>
                          {p1?.display_name || p1?.username || '?'}
                        </span>
                        {avatar(p1, 26)}
                      </div>

                      {/* Score / VS */}
                      <div style={{
                        minWidth: 64, textAlign: 'center', padding: '4px 10px',
                        background: done ? C.panel2 : C.panel,
                        border: `1px solid ${done ? C.border : C.border}`,
                        borderRadius: 8,
                      }}>
                        {done ? (
                          <span style={{ fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: 2 }}>
                            {m.score_player1} - {m.score_player2}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim }}>vs</span>
                        )}
                      </div>

                      {/* Jugador 2 */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7 }}>
                        {avatar(p2, 26)}
                        <span style={{ fontSize: 12, fontWeight: 600, color: m.player2_id === profile?.id ? C.green : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>
                          {p2?.display_name || p2?.username || '?'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function LigaTab({ tournamentId, profile, fase = 'all', ascensos = 0, descensos = 0, showFixture = false }) {
  const [allMatches, setAllMatches]     = useState([])
  const [members, setMembers]           = useState([])
  const [profilesMap, setProfilesMap]   = useState({})
  const [loading, setLoading]           = useState(true)
  const [innerTab, setInnerTab]         = useState(showFixture ? 'fixture' : 'tabla')

  const load = useCallback(async () => {
    setLoading(true)

    // Miembros
    const { data: memberRows } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', tournamentId)

    const userIds = (memberRows || []).map(r => r.user_id)
    if (!userIds.length) { setMembers([]); setAllMatches([]); setLoading(false); return }

    const { data: profiles } = await supabase.from('users').select('id, display_name, username, avatar_url').in('id', userIds)
    const pm = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    setProfilesMap(pm)

    const mems = (memberRows || []).map(r => ({ user_id: r.user_id, profile: pm[r.user_id] }))
    setMembers(mems)

    // Partidos
    const { data: matches } = await supabase
      .from('tournament_matches')
      .select('id, player1_id, player2_id, score_player1, score_player2, status, phase, round_number, scheduled_at')
      .eq('tournament_id', tournamentId)
      .order('round_number', { ascending: true })

    setAllMatches(matches || [])
    setLoading(false)
  }, [tournamentId])

  useEffect(() => { load() }, [load])

  // Filtrar por fase
  const filteredMatches = fase === 'all'
    ? allMatches
    : allMatches.filter(m => {
        if (!m.phase) return fase === 'apertura'
        return m.phase === fase || m.phase === (fase === 'apertura' ? 'ida' : 'vuelta')
      })

  const standings = buildStandings(filteredMatches, members)

  if (loading) return (
    <div style={{ padding: 16 }}>
      {[1,2,3,4,5].map(i => <div key={i} style={{ height: 44, background: C.panel, borderRadius: 8, marginBottom: 8 }} />)}
    </div>
  )

  // Si showFixture, mostramos sub-tabs Partidos / Tabla / Brackets
  if (showFixture) {
    const allDone = filteredMatches.length > 0 && filteredMatches.every(m => m.status === 'finalizado')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Sub-tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {[
            { id: 'fixture',  label: '📅 Partidos' },
            { id: 'tabla',    label: '📊 Tabla' },
            { id: 'brackets', label: '🏆 Brackets' },
          ].map(t => (
            <button key={t.id} onClick={() => setInnerTab(t.id)} style={{
              flex: 1, padding: '11px 0',
              background: 'none', border: 'none', cursor: 'pointer',
              color: innerTab === t.id ? C.green : C.textDim,
              fontWeight: innerTab === t.id ? 700 : 500, fontSize: 12,
              borderBottom: `2px solid ${innerTab === t.id ? C.green : 'transparent'}`,
              transition: 'color .15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {innerTab === 'fixture' && (
            <FixtureView matches={filteredMatches} profilesMap={profilesMap} profile={profile} fase={fase} />
          )}
          {innerTab === 'tabla' && (
            <StandingsTable standings={standings} ascensos={ascensos} descensos={descensos} profile={profile} />
          )}
          {innerTab === 'brackets' && (
            allDone
              ? <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 6 }}>¡Fase de grupos terminada!</div>
                  <div style={{ fontSize: 12, color: C.textDim }}>El organizador iniciará el bracket con los clasificados.</div>
                </div>
              : <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 6 }}>Esperando finalizar los partidos</div>
                  <div style={{ fontSize: 12, color: C.textDim }}>
                    {filteredMatches.length === 0
                      ? 'Los partidos se generarán cuando el organizador inicie esta fase.'
                      : `Quedan ${filteredMatches.filter(m => m.status !== 'finalizado').length} partidos por jugar.`}
                  </div>
                  <div style={{ marginTop: 16, display: 'inline-block', padding: '8px 18px', borderRadius: 20, background: `${C.green}15`, border: `1px solid ${C.green}33`, fontSize: 12, color: C.green, fontWeight: 700 }}>
                    El bracket se habilita al terminar todos los partidos
                  </div>
                </div>
          )}
        </div>
      </div>
    )
  }

  // Solo tabla (tab "Tabla general")
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      <StandingsTable standings={standings} ascensos={ascensos} descensos={descensos} profile={profile} />
    </div>
  )
}
