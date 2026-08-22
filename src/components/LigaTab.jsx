/**
 * LigaTab — tabla global de posiciones para torneos tipo Liga.
 * Muestra: POS, Jugador, PJ, PG, PE, PP, GF, GC, DIF, PTS
 * Indicadores de ascenso (⬆️) y descenso (⬇️) según config del torneo.
 */
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

const GROUP_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#a78bfa','#06b6d4','#f97316','#ec4899']

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
      stats[m.player1_id].pj++
      stats[m.player1_id].gf += s1
      stats[m.player1_id].gc += s2
      if (s1 > s2) stats[m.player1_id].pg++
      else if (s1 === s2) stats[m.player1_id].pe++
      else stats[m.player1_id].pp++
    }
    if (m.player2_id && stats[m.player2_id]) {
      stats[m.player2_id].pj++
      stats[m.player2_id].gf += s2
      stats[m.player2_id].gc += s1
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

export default function LigaTab({ tournamentId, profile, ascensos = 0, descensos = 0 }) {
  const [standings, setStandings] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [groupFilter, setGroupFilter] = useState('all')
  const [groups,    setGroups]    = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    // Miembros del torneo
    const { data: memberRows } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', tournamentId)

    const userIds = (memberRows || []).map(r => r.user_id)
    if (!userIds.length) { setStandings([]); setLoading(false); return }

    const { data: profiles } = await supabase.from('users').select('id, display_name, username, avatar_url').in('id', userIds)
    const pm = Object.fromEntries((profiles || []).map(p => [p.id, p]))

    const members = (memberRows || []).map(r => ({ user_id: r.user_id, profile: pm[r.user_id] }))

    // Partidos finalizados
    const { data: matches } = await supabase
      .from('tournament_matches')
      .select('id, player1_id, player2_id, score_player1, score_player2, status, phase, group_id')
      .eq('tournament_id', tournamentId)
      .eq('status', 'finalizado')

    // Grupos (para filtro)
    const { data: groupRows } = await supabase
      .from('tournament_groups')
      .select('id, name, color')
      .eq('tournament_id', tournamentId)
      .order('position')

    setGroups(groupRows || [])

    const filteredMatches = groupFilter === 'all'
      ? (matches || [])
      : (matches || []).filter(m => m.group_id === groupFilter)

    setStandings(buildStandings(filteredMatches, members))
    setLoading(false)
  }, [tournamentId, groupFilter])

  useEffect(() => { load() }, [load])

  // Zonas de colores por posición
  function zoneColor(pos, total) {
    if (ascensos > 0 && pos <= ascensos) return '#22c55e'       // Ascenso
    if (descensos > 0 && pos > total - descensos) return '#ef4444' // Descenso
    return null
  }

  function posLabel(pos, total) {
    if (ascensos > 0 && pos <= ascensos) return '⬆️'
    if (descensos > 0 && pos > total - descensos) return '⬇️'
    return null
  }

  const COL = { color: C.textDim, fontSize: 11, fontWeight: 700, textAlign: 'center', padding: '8px 6px', whiteSpace: 'nowrap' }
  const CEL = (accent) => ({ color: accent || C.text2, fontSize: 12, fontWeight: accent ? 800 : 500, textAlign: 'center', padding: '10px 6px' })

  if (loading) return (
    <div style={{ padding: 16 }}>
      {[1,2,3,4].map(i => <div key={i} style={{ height: 44, background: C.panel, borderRadius: 8, marginBottom: 8 }} />)}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Group filter */}
      {groups.length > 0 && (
        <div style={{ padding: '10px 16px', display: 'flex', gap: 6, borderBottom: `1px solid ${C.border}`, overflowX: 'auto' }}>
          <button onClick={() => setGroupFilter('all')} style={{
            padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: groupFilter === 'all' ? C.green : C.panel, color: groupFilter === 'all' ? '#000' : C.textDim,
            fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap',
          }}>Global</button>
          {groups.map((g, i) => {
            const gc = g.color || GROUP_COLORS[i % GROUP_COLORS.length]
            return (
              <button key={g.id} onClick={() => setGroupFilter(g.id)} style={{
                padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${gc}50`, cursor: 'pointer',
                background: groupFilter === g.id ? `${gc}25` : C.panel,
                color: groupFilter === g.id ? gc : C.textDim,
                fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap',
              }}>Grupo {g.name}</button>
            )
          })}
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {standings.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏅</div>
            <div style={{ color: C.textDim, fontSize: 13 }}>No hay partidos finalizados aún.</div>
          </div>
        ) : (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
            {/* Leyenda */}
            {(ascensos > 0 || descensos > 0) && (
              <div style={{ display: 'flex', gap: 16, padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
                {ascensos > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#22c55e' }} /><span style={{ color: C.textDim, fontSize: 10 }}>Ascenso (top {ascensos})</span></div>}
                {descensos > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444' }} /><span style={{ color: C.textDim, fontSize: 10 }}>Descenso (últimos {descensos})</span></div>}
              </div>
            )}

            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '28px 36px 1fr 36px 28px 28px 28px 36px 36px 36px 40px', background: C.panel2 }}>
              <div style={{ ...COL }}></div>
              <div style={{ ...COL }}>#</div>
              <div style={{ ...COL, textAlign: 'left', paddingLeft: 8 }}>Jugador</div>
              <div style={{ ...COL }}>PJ</div>
              <div style={{ ...COL }}>PG</div>
              <div style={{ ...COL }}>PE</div>
              <div style={{ ...COL }}>PP</div>
              <div style={{ ...COL }}>GF</div>
              <div style={{ ...COL }}>GC</div>
              <div style={{ ...COL }}>DIF</div>
              <div style={{ ...COL, color: C.green }}>PTS</div>
            </div>

            {/* Rows */}
            {standings.map((s, i) => {
              const pos = i + 1
              const zone = zoneColor(pos, standings.length)
              const icon = posLabel(pos, standings.length)
              const isMe = s.user_id === profile?.id
              return (
                <div key={s.user_id} style={{
                  display: 'grid', gridTemplateColumns: '28px 36px 1fr 36px 28px 28px 28px 36px 36px 36px 40px',
                  borderTop: `1px solid ${C.border}`,
                  background: isMe ? `${C.green}08` : zone ? `${zone}08` : 'transparent',
                  borderLeft: zone ? `3px solid ${zone}` : '3px solid transparent',
                  alignItems: 'center',
                }}>
                  <div style={{ ...CEL(), fontSize: 13 }}>{icon || ''}</div>
                  <div style={{ ...CEL(), color: C.textDim, fontSize: 11 }}>{pos}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px' }}>
                    {avatar(s.profile, 24)}
                    <span style={{ color: isMe ? C.green : C.text, fontWeight: isMe ? 800 : 500, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.profile?.display_name || s.profile?.username || '?'}
                      {isMe && ' (vos)'}
                    </span>
                  </div>
                  <div style={CEL()}>{s.pj}</div>
                  <div style={CEL('#22c55e')}>{s.pg}</div>
                  <div style={CEL()}>{s.pe}</div>
                  <div style={CEL('#ef4444')}>{s.pp}</div>
                  <div style={CEL()}>{s.gf}</div>
                  <div style={CEL()}>{s.gc}</div>
                  <div style={{ ...CEL(s.dif > 0 ? '#22c55e' : s.dif < 0 ? '#ef4444' : null) }}>
                    {s.dif > 0 ? `+${s.dif}` : s.dif}
                  </div>
                  <div style={{ ...CEL(C.green), fontSize: 14, fontWeight: 900 }}>{s.pts}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
