/**
 * GroupStage — fase de grupos de un torneo.
 *
 * Props:
 *   tournamentId  uuid     — id del torneo (conversations.id)
 *   profile       object   — perfil del usuario actual (id, role)
 *   isAdmin       boolean  — si puede aprobar resultados
 *   onReportMatch fn(match) — callback para abrir modal de reporte externo (opcional)
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import MatchResultFlow from './MatchResultFlow'
import { useSubscription } from '../hooks/useSubscription'

// ── Paleta de colores por grupo ───────────────────────────────────────────────
const GROUP_COLORS = [
  '#22c55e','#3b82f6','#f59e0b','#ef4444',
  '#a78bfa','#06b6d4','#f97316','#ec4899',
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_BADGE = {
  pendiente:  { label: 'Pendiente',  bg: '#1a1a1a', color: '#6b7280' },
  en_juego:   { label: 'En juego',   bg: '#f59e0b18', color: '#f59e0b' },
  finalizado: { label: 'Finalizado', bg: '#22c55e18', color: '#22c55e' },
  cancelado:  { label: 'Cancelado',  bg: '#ef444418', color: '#ef4444' },
}

function avatar(p) {
  return p?.avatar_url
    ? <img src={p.avatar_url} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${C.border}` }} />
    : <div style={{ width: 26, height: 26, borderRadius: '50%', background: C.panel2, border: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: C.textDim }}>
        {(p?.display_name || p?.username || '?')[0].toUpperCase()}
      </div>
}

// ── Fetch de datos ────────────────────────────────────────────────────────────
async function fetchGroupStage(tournamentId) {
  // 1. Grupos del torneo
  const { data: groups, error: gErr } = await supabase
    .from('tournament_groups')
    .select('id, name, color, position, classifies')
    .eq('tournament_id', tournamentId)
    .order('position', { ascending: true })

  if (gErr || !groups?.length) return { groups: [], members: {}, matches: {} }

  const groupIds = groups.map(g => g.id)

  // 2. Miembros de los grupos con perfil de usuario
  const { data: memberRows } = await supabase
    .from('tournament_group_members')
    .select('group_id, user_id, seed')
    .in('group_id', groupIds)

  // Perfiles de los miembros
  const userIds = [...new Set(memberRows?.map(m => m.user_id) ?? [])]
  const { data: profiles } = userIds.length
    ? await supabase.from('users').select('id, display_name, username, avatar_url').in('id', userIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  // 3. Posiciones por grupo desde tournament_standings (si existen)
  const { data: standings } = await supabase
    .from('tournament_standings')
    .select('user_id, pj, pg, pe, pp, gf, gc, puntos, posicion')
    .eq('tournament_id', tournamentId)

  const standingMap = Object.fromEntries((standings ?? []).map(s => [s.user_id, s]))

  // 4. Partidos de fase de grupos (phase = 'groups' OR group_id IS NOT NULL)
  const { data: matchRows } = await supabase
    .from('tournament_matches')
    .select('id, group_id, round_number, match_number, jornada_number, player1_id, player2_id, score1, score2, winner_id, status, photo_url, loser_confirmed, dispute_deadline')
    .eq('tournament_id', tournamentId)
    .or('phase.eq.groups,group_id.in.(' + groupIds.join(',') + ')')
    .order('jornada_number', { ascending: true })
    .order('match_number', { ascending: true })

  // Organizar por grupo
  const membersByGroup = {}
  const matchesByGroup = {}

  groups.forEach(g => {
    membersByGroup[g.id] = []
    matchesByGroup[g.id] = []
  })

  memberRows?.forEach(m => {
    if (membersByGroup[m.group_id]) {
      membersByGroup[m.group_id].push({ ...m, profile: profileMap[m.user_id] })
    }
  })

  matchRows?.forEach(m => {
    if (m.group_id && matchesByGroup[m.group_id]) {
      matchesByGroup[m.group_id].push({
        ...m,
        player1: profileMap[m.player1_id],
        player2: profileMap[m.player2_id],
      })
    }
  })

  // Ordenar standings por grupo
  groups.forEach(g => {
    membersByGroup[g.id].sort((a, b) => {
      const sa = standingMap[a.user_id]
      const sb = standingMap[b.user_id]
      if (!sa && !sb) return 0
      if (!sa) return 1
      if (!sb) return -1
      return (sa.posicion ?? 999) - (sb.posicion ?? 999)
    })
  })

  return { groups, membersByGroup, matchesByGroup, standingMap, profileMap }
}

// ── Tabla de posiciones ───────────────────────────────────────────────────────
function StandingsTable({ members, standingMap, classifies, color }) {
  const rows = members.map(m => ({
    profile: m.profile,
    user_id: m.user_id,
    seed: m.seed,
    ...(standingMap[m.user_id] ?? { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, puntos: 0, posicion: null }),
  })).sort((a, b) => {
    if (a.posicion != null && b.posicion != null) return a.posicion - b.posicion
    return (b.puntos ?? 0) - (a.puntos ?? 0)
  })

  const colStyle = { padding: '8px 6px', textAlign: 'center', fontSize: 11, color: C.textDim }
  const cellStyle = { padding: '8px 6px', textAlign: 'center', fontSize: 12, color: C.text, fontWeight: 600 }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <th style={{ ...colStyle, textAlign: 'left', width: 28 }}>#</th>
            <th style={{ ...colStyle, textAlign: 'left', minWidth: 120 }}>Jugador</th>
            {['PJ','PG','PE','PP','GF','GC','DIF','PTS'].map(h => (
              <th key={h} style={{ ...colStyle, fontWeight: 700, color: h === 'PTS' ? color : C.textDim }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const clasifica = i < classifies
            const dif = (r.gf ?? 0) - (r.gc ?? 0)
            return (
              <tr key={r.user_id} style={{
                borderBottom: `1px solid ${C.border}22`,
                background: clasifica ? `${color}08` : 'transparent',
                transition: 'background .15s',
              }}>
                <td style={{ ...cellStyle, textAlign: 'left', paddingLeft: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {clasifica && (
                      <div style={{ width: 3, height: 20, borderRadius: 2, background: color, flexShrink: 0 }} />
                    )}
                    <span style={{ color: C.textDim, fontSize: 11, minWidth: 14 }}>{i + 1}</span>
                  </div>
                </td>
                <td style={{ ...cellStyle, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {avatar(r.profile)}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
                      {r.profile?.display_name || r.profile?.username || '—'}
                    </span>
                  </div>
                </td>
                <td style={cellStyle}>{r.pj}</td>
                <td style={cellStyle}>{r.pg}</td>
                <td style={cellStyle}>{r.pe}</td>
                <td style={cellStyle}>{r.pp}</td>
                <td style={cellStyle}>{r.gf}</td>
                <td style={cellStyle}>{r.gc}</td>
                <td style={{ ...cellStyle, color: dif > 0 ? '#22c55e' : dif < 0 ? '#ef4444' : C.text2 }}>
                  {dif > 0 ? '+' : ''}{dif}
                </td>
                <td style={{ ...cellStyle, fontWeight: 800, fontSize: 13, color }}>
                  {r.puntos}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Tarjeta de partido ────────────────────────────────────────────────────────
function MatchCard({ match, currentUserId, isAdmin, onReport, onApprove }) {
  const badge    = STATUS_BADGE[match.status] ?? STATUS_BADGE.pendiente
  const isPlayer = currentUserId === match.player1_id || currentUserId === match.player2_id
  const canReport = match.status === 'pendiente' && isPlayer
  const canApprove = match.status === 'en_juego' && isAdmin

  // ¿El resultado fue enviado y está esperando confirmación del perdedor?
  const awaitingConfirm = match.status === 'en_juego' && match.loser_confirmed === null

  return (
    <div style={{
      background: C.panel2,
      border: `1px solid ${C.border}`,
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Status badge + jornada */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {match.jornada_number != null && (
          <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600 }}>J{match.jornada_number}</span>
        )}
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          background: badge.bg, color: badge.color,
        }}>
          {badge.label}
        </span>
      </div>

      {/* Jugadores + marcador */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Jugador 1 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 0 }}>
          {avatar(match.player1)}
          <span style={{
            fontSize: 11, fontWeight: 600, color: C.text,
            textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', width: '100%',
          }}>
            {match.player1?.display_name || match.player1?.username || '?'}
          </span>
          {match.winner_id === match.player1_id && (
            <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 800, letterSpacing: '0.5px' }}>GANÓ</span>
          )}
        </div>

        {/* Marcador */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            minWidth: 38, textAlign: 'center',
            fontSize: match.score1 != null ? 26 : 18,
            fontWeight: 900, color: match.winner_id === match.player1_id ? '#22c55e' : C.text,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {match.score1 ?? '—'}
          </span>
          <span style={{ color: C.border, fontSize: 18, fontWeight: 300 }}>:</span>
          <span style={{
            minWidth: 38, textAlign: 'center',
            fontSize: match.score2 != null ? 26 : 18,
            fontWeight: 900, color: match.winner_id === match.player2_id ? '#22c55e' : C.text,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {match.score2 ?? '—'}
          </span>
        </div>

        {/* Jugador 2 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 0 }}>
          {avatar(match.player2)}
          <span style={{
            fontSize: 11, fontWeight: 600, color: C.text,
            textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', width: '100%',
          }}>
            {match.player2?.display_name || match.player2?.username || '?'}
          </span>
          {match.winner_id === match.player2_id && (
            <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 800, letterSpacing: '0.5px' }}>GANÓ</span>
          )}
        </div>
      </div>

      {/* Foto de evidencia */}
      {match.photo_url && (
        <a href={match.photo_url} target="_blank" rel="noopener noreferrer" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: C.green, textDecoration: 'none', fontWeight: 600,
        }}>
          📸 Ver captura del resultado
        </a>
      )}

      {/* Acciones */}
      {(canReport || canApprove || awaitingConfirm) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canReport && (
            <button onClick={() => onReport?.(match)} style={{
              flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
              background: C.green, color: C.bg, fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}>
              📋 Reportar resultado
            </button>
          )}
          {awaitingConfirm && isPlayer && !isAdmin && (
            <button onClick={() => onReport?.(match, 'confirm')} style={{
              flex: 1, padding: '9px 0', borderRadius: 10, border: `1px solid ${C.green}`,
              background: 'transparent', color: C.green, fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}>
              ✅ Confirmar / Disputar
            </button>
          )}
          {canApprove && (
            <button onClick={() => onApprove?.(match)} style={{
              flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
              background: '#f59e0b', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}>
              ⚡ Aprobar resultado
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function GroupStage({ tournamentId, profile, isAdmin, onReportMatch }) {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [activeGroup, setActiveGroup] = useState(null)
  const [reportMatch, setReportMatch] = useState(null)
  const { isVip, isPro } = useSubscription(profile?.id)
  const hasAdvancedStats = isVip || isPro || isAdmin

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchGroupStage(tournamentId)
      setData(result)
      if (result.groups?.length && !activeGroup) setActiveGroup(result.groups[0].id)
    } catch (e) {
      setError(e?.message ?? 'Error al cargar la fase de grupos')
    } finally {
      setLoading(false)
    }
  }, [tournamentId])

  useEffect(() => { load() }, [load])

  // Subscripción realtime para actualizar marcadores en vivo
  useEffect(() => {
    if (!tournamentId) return
    const ch = supabase
      .channel(`group-stage:${tournamentId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tournament_matches',
        filter: `tournament_id=eq.${tournamentId}`,
      }, () => load())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tournament_standings',
        filter: `tournament_id=eq.${tournamentId}`,
      }, () => load())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [tournamentId, load])

  async function handleApprove(match) {
    const { data: res } = await supabase.rpc('approve_match_result', { p_match_id: match.id })
    if (res?.ok) load()
    else alert(res?.error ?? 'Error al aprobar')
  }

  if (loading) return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1,2,3].map(i => (
        <div key={i} className="skeleton" style={{ height: 120, borderRadius: 14, background: C.panel2 }} />
      ))}
    </div>
  )

  if (error) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <p style={{ color: '#ef4444', fontWeight: 700 }}>{error}</p>
      <button onClick={load} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: C.green, color: C.bg, fontWeight: 700, cursor: 'pointer' }}>
        Reintentar
      </button>
    </div>
  )

  if (!data?.groups?.length) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🎱</div>
      <p style={{ color: C.textDim, fontSize: 14, margin: 0, fontWeight: 600 }}>Sorteo pendiente</p>
      <p style={{ color: C.textDim, fontSize: 12, margin: '6px 0 0' }}>
        Los grupos se mostrarán aquí una vez que el organizador realice el sorteo.
      </p>
    </div>
  )

  const { groups, membersByGroup, matchesByGroup, standingMap } = data
  const currentGroup = groups.find(g => g.id === activeGroup)
  const groupColor   = (i) => GROUP_COLORS[i % GROUP_COLORS.length]

  // Agrupar partidos por jornada
  const matchesOfGroup = matchesByGroup[activeGroup] ?? []
  const jornadaMap = {}
  matchesOfGroup.forEach(m => {
    const j = m.jornada_number ?? 1
    if (!jornadaMap[j]) jornadaMap[j] = []
    jornadaMap[j].push(m)
  })
  const jornadas = Object.entries(jornadaMap).sort(([a], [b]) => Number(a) - Number(b))

  return (
    <>
      {reportMatch && (
        <MatchResultFlow
          match={reportMatch}
          profile={profile}
          isAdmin={isAdmin}
          onClose={() => setReportMatch(null)}
          onUpdate={load}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Tabs de grupos */}
        <div style={{
          display: 'flex', overflowX: 'auto', gap: 6,
          padding: '12px 14px 0', flexShrink: 0,
          borderBottom: `1px solid ${C.border}`,
          scrollbarWidth: 'none',
        }}>
          {groups.map((g, i) => {
            const color   = g.color ?? groupColor(i)
            const active  = g.id === activeGroup
            return (
              <button key={g.id} onClick={() => setActiveGroup(g.id)} style={{
                flexShrink: 0, padding: '7px 16px', borderRadius: '10px 10px 0 0',
                border: `1.5px solid ${active ? color : C.border}`,
                borderBottom: active ? 'none' : `1.5px solid ${C.border}`,
                background: active ? `${color}14` : 'transparent',
                color: active ? color : C.textDim,
                fontWeight: active ? 800 : 500, fontSize: 13, cursor: 'pointer',
                marginBottom: active ? -1 : 0,
                transition: 'all .15s',
              }}>
                Grupo {g.name}
              </button>
            )
          })}
        </div>

        {/* Contenido del grupo activo */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {currentGroup && (() => {
            const gIdx  = groups.indexOf(currentGroup)
            const color = currentGroup.color ?? groupColor(gIdx)
            const members = membersByGroup[currentGroup.id] ?? []

            return (
              <>
                {/* Encabezado del grupo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: color }} />
                  <span style={{ fontWeight: 800, fontSize: 16, color: C.text }}>Grupo {currentGroup.name}</span>
                  <span style={{ fontSize: 11, color: C.textDim, marginLeft: 'auto' }}>
                    Top {currentGroup.classifies} clasifican
                  </span>
                </div>

                {/* Tabla de posiciones */}
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Posiciones
                    </span>
                  </div>
                  <StandingsTable
                    members={members}
                    standingMap={standingMap}
                    classifies={currentGroup.classifies}
                    color={color}
                  />
                </div>

                {/* Partidos por jornada */}
                {jornadas.length > 0 ? jornadas.map(([jornada, matches]) => (
                  <div key={jornada}>
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Jornada {jornada}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                      {matches.map(m => (
                        <MatchCard
                          key={m.id}
                          match={m}
                          currentUserId={profile?.id}
                          isAdmin={isAdmin}
                          onReport={setReportMatch}
                          onApprove={handleApprove}
                        />
                      ))}
                    </div>
                  </div>
                )) : (
                  <div style={{
                    background: C.panel2, border: `1px dashed ${C.border}`,
                    borderRadius: 14, padding: '24px 16px', textAlign: 'center',
                  }}>
                    <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
                      No hay partidos registrados para este grupo todavía.
                    </p>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </div>
    </>
  )
}
