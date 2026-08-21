/**
 * GroupStage — fase de grupos de un torneo.
 *
 * Props:
 *   tournamentId  uuid    — id del torneo (conversations.id)
 *   profile       object  — perfil del usuario autenticado (de useAuthStore)
 *   isAdmin       bool    — si puede aprobar resultados
 *   onReportResult fn(match) — callback para abrir modal de reporte
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

// ── Helpers ───────────────────────────────────────────────────────────────────
const GROUP_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#a78bfa','#06b6d4','#f97316','#ec4899']

const MATCH_STATUS_LABEL = {
  pendiente:  'Pendiente',
  en_juego:   'Por confirmar',
  finalizado: 'Finalizado',
  cancelado:  'Cancelado',
}
const MATCH_STATUS_COLOR = {
  pendiente:  '#6b7280',
  en_juego:   '#f59e0b',
  finalizado: '#22c55e',
  cancelado:  '#ef4444',
}

function avatar(name = '') {
  return name.trim().slice(0, 2).toUpperCase() || '??'
}

// ── Query ─────────────────────────────────────────────────────────────────────
async function fetchGroupStage(tournamentId) {
  // 1. Grupos
  const { data: groups, error: gErr } = await supabase
    .from('tournament_groups')
    .select('id, name, color, position, classifies')
    .eq('tournament_id', tournamentId)
    .order('position', { ascending: true })

  if (gErr) throw gErr
  if (!groups?.length) return { groups: [], members: {}, matches: {} }

  const groupIds = groups.map(g => g.id)

  // 2. Miembros con perfil
  const { data: members, error: mErr } = await supabase
    .from('tournament_group_members')
    .select(`
      id, group_id, user_id, seed,
      users:user_id ( id, display_name, username, avatar_url )
    `)
    .in('group_id', groupIds)
    .order('seed', { ascending: true, nullsFirst: false })

  if (mErr) throw mErr

  // 3. Standings por grupo (filtramos del torneo general)
  const { data: standings } = await supabase
    .from('tournament_standings')
    .select('user_id, pj, pg, pe, pp, gf, gc, puntos, posicion')
    .eq('tournament_id', tournamentId)

  // 4. Partidos de fase de grupos
  const { data: matches, error: matchErr } = await supabase
    .from('tournament_matches')
    .select(`
      id, group_id, round_number, match_number, phase,
      player1_id, player2_id, score1, score2, winner_id,
      status, loser_confirmed, dispute_deadline, played_at,
      p1:player1_id ( id, display_name, username, avatar_url ),
      p2:player2_id ( id, display_name, username, avatar_url )
    `)
    .eq('tournament_id', tournamentId)
    .eq('phase', 'groups')
    .order('round_number', { ascending: true })
    .order('match_number', { ascending: true })

  if (matchErr) throw matchErr

  // Organizar por group_id
  const membersByGroup = {}
  const standingMap    = {}
  const matchesByGroup = {}

  standings?.forEach(s => { standingMap[s.user_id] = s })

  members?.forEach(m => {
    if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = []
    membersByGroup[m.group_id].push({ ...m, standing: standingMap[m.user_id] ?? null })
  })

  matches?.forEach(m => {
    const gid = m.group_id ?? '__no_group'
    if (!matchesByGroup[gid]) matchesByGroup[gid] = []
    matchesByGroup[gid].push(m)
  })

  return { groups, membersByGroup, matchesByGroup }
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Avatar({ user, size = 32 }) {
  const [err, setErr] = useState(false)
  if (user?.avatar_url && !err) {
    return (
      <img
        src={user.avatar_url}
        onError={() => setErr(true)}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `${C.green}22`, border: `1.5px solid ${C.green}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800, color: C.green,
    }}>
      {avatar(user?.display_name || user?.username)}
    </div>
  )
}

function StandingsTable({ members, color, classifies }) {
  // Sort by puntos desc, diff desc, gf desc
  const rows = [...members].sort((a, b) => {
    const sa = a.standing, sb = b.standing
    if (!sa && !sb) return 0
    if (!sa) return 1
    if (!sb) return -1
    if (sb.puntos !== sa.puntos) return sb.puntos - sa.puntos
    const da = sa.gf - sa.gc, db = sb.gf - sb.gc
    if (db !== da) return db - da
    return sb.gf - sa.gf
  })

  const COL = {
    head: { fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '0 6px 8px', textAlign: 'center' },
    cell: { fontSize: 13, color: C.text, padding: '10px 6px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' },
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 340 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <th style={{ ...COL.head, textAlign: 'left', padding: '0 6px 8px 0', minWidth: 160 }}>#  Jugador</th>
            {['PJ','PG','PE','PP','GF','GC','DIF','PTS'].map(h => (
              <th key={h} style={COL.head}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((m, i) => {
            const s    = m.standing
            const user = m.users
            const gf   = s?.gf ?? 0
            const gc   = s?.gc ?? 0
            const classifies_row = i < classifies
            return (
              <tr key={m.user_id} style={{
                borderBottom: `1px solid ${C.border}`,
                background: i === classifies - 1 && classifies < rows.length ? `${color}08` : 'none',
              }}>
                {/* Posición + jugador */}
                <td style={{ padding: '10px 6px 10px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 800, minWidth: 20, textAlign: 'center',
                      color: classifies_row ? color : C.textDim,
                    }}>{i + 1}</span>
                    {classifies_row && (
                      <div style={{ width: 3, height: 24, borderRadius: 2, background: color, flexShrink: 0 }} />
                    )}
                    <Avatar user={user} size={26} />
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: C.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100,
                    }}>
                      {user?.display_name || user?.username || '—'}
                    </span>
                  </div>
                </td>
                <td style={COL.cell}>{s?.pj ?? 0}</td>
                <td style={COL.cell}>{s?.pg ?? 0}</td>
                <td style={COL.cell}>{s?.pe ?? 0}</td>
                <td style={COL.cell}>{s?.pp ?? 0}</td>
                <td style={COL.cell}>{gf}</td>
                <td style={COL.cell}>{gc}</td>
                <td style={{ ...COL.cell, color: gf - gc > 0 ? '#22c55e' : gf - gc < 0 ? '#ef4444' : C.textDim, fontWeight: 700 }}>
                  {gf - gc > 0 ? '+' : ''}{gf - gc}
                </td>
                <td style={{ ...COL.cell, fontWeight: 800, color: classifies_row ? color : C.text }}>{s?.puntos ?? 0}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {classifies < rows.length && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <div style={{ width: 10, height: 3, borderRadius: 2, background: color }} />
          <span style={{ fontSize: 10, color: C.textDim }}>Top {classifies} clasifican a siguiente fase</span>
        </div>
      )}
    </div>
  )
}

function MatchCard({ match, myId, isAdmin, onReport, onApprove }) {
  const p1   = match.p1
  const p2   = match.p2
  const done = match.status === 'finalizado'
  const pending_approval = match.status === 'en_juego'
  const isPlayer = myId && (match.player1_id === myId || match.player2_id === myId)
  const canReport = match.status === 'pendiente' && isPlayer
  const canApprove = pending_approval && isAdmin

  const scoreColor1 = done
    ? match.winner_id === match.player1_id ? C.green : '#ef4444'
    : C.text
  const scoreColor2 = done
    ? match.winner_id === match.player2_id ? C.green : '#ef4444'
    : C.text

  return (
    <div style={{
      background: C.panel2,
      border: `1px solid ${pending_approval ? '#f59e0b44' : C.border}`,
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Estado pill */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          background: `${MATCH_STATUS_COLOR[match.status]}18`,
          color: MATCH_STATUS_COLOR[match.status],
          border: `1px solid ${MATCH_STATUS_COLOR[match.status]}33`,
        }}>
          {MATCH_STATUS_LABEL[match.status]}
        </span>
        {match.played_at && (
          <span style={{ fontSize: 10, color: C.textDim }}>
            {new Date(match.played_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>

      {/* Marcador */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Jugador 1 */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <Avatar user={p1} size={30} />
          <span style={{
            fontSize: 12, fontWeight: 600, color: C.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {p1?.display_name || p1?.username || '—'}
          </span>
        </div>

        {/* Scores */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{
            fontSize: 22, fontWeight: 900, color: scoreColor1,
            minWidth: 28, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
          }}>
            {match.score1 ?? (done ? '?' : '–')}
          </span>
          <span style={{ fontSize: 14, color: C.border, fontWeight: 700 }}>:</span>
          <span style={{
            fontSize: 22, fontWeight: 900, color: scoreColor2,
            minWidth: 28, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
          }}>
            {match.score2 ?? (done ? '?' : '–')}
          </span>
        </div>

        {/* Jugador 2 */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 7, minWidth: 0 }}>
          <span style={{
            fontSize: 12, fontWeight: 600, color: C.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textAlign: 'right',
          }}>
            {p2?.display_name || p2?.username || '—'}
          </span>
          <Avatar user={p2} size={30} />
        </div>
      </div>

      {/* Confirmación pendiente */}
      {pending_approval && match.loser_confirmed === null && (
        <div style={{
          fontSize: 11, color: '#f59e0b', textAlign: 'center',
          background: '#f59e0b10', border: '1px solid #f59e0b30',
          borderRadius: 8, padding: '5px 10px',
        }}>
          ⏳ Esperando confirmación del perdedor
        </div>
      )}
      {match.loser_confirmed === false && (
        <div style={{
          fontSize: 11, color: '#ef4444', textAlign: 'center',
          background: '#ef444410', border: '1px solid #ef444430',
          borderRadius: 8, padding: '5px 10px',
        }}>
          ⚠️ Resultado disputado — en revisión
        </div>
      )}
      {match.loser_confirmed === true && (
        <div style={{
          fontSize: 11, color: '#22c55e', textAlign: 'center',
          background: '#22c55e10', border: '1px solid #22c55e30',
          borderRadius: 8, padding: '5px 10px',
        }}>
          ✓ Confirmado por ambas partes
        </div>
      )}

      {/* Botones */}
      {(canReport || canApprove) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canReport && (
            <button
              onClick={() => onReport?.(match)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
                background: C.green, color: C.bg,
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              📸 Reportar resultado
            </button>
          )}
          {canApprove && (
            <button
              onClick={() => onApprove?.(match)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 10,
                border: `1px solid #f59e0b44`,
                background: '#f59e0b18', color: '#f59e0b',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              ✓ Aprobar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function GroupSection({ group, members, matches, color, myId, isAdmin, onReport, onApprove }) {
  const [tab, setTab] = useState('tabla')

  const matchCount    = matches?.length ?? 0
  const doneCount     = matches?.filter(m => m.status === 'finalizado').length ?? 0
  const pendingCount  = matches?.filter(m => m.status === 'pendiente').length ?? 0

  return (
    <div style={{
      background: C.panel,
      border: `1.5px solid ${color}33`,
      borderRadius: 18, overflow: 'hidden',
    }}>
      {/* Header del grupo */}
      <div style={{
        padding: '14px 16px',
        background: `${color}0d`,
        borderBottom: `1px solid ${color}22`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}22`, border: `1.5px solid ${color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 16, color,
        }}>
          {group.name}
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: C.text }}>Grupo {group.name}</p>
          <p style={{ margin: 0, fontSize: 11, color: C.textDim }}>
            {members?.length ?? 0} jugadores · {doneCount}/{matchCount} partidos
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pendingCount > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
              background: '#f59e0b18', color: '#f59e0b', border: '1px solid #f59e0b33',
            }}>
              {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
        {[{ id: 'tabla', label: '📊 Tabla' }, { id: 'partidos', label: `⚽ Partidos (${matchCount})` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 8px', background: 'none',
            border: 'none', borderBottom: `2.5px solid ${tab === t.id ? color : 'transparent'}`,
            color: tab === t.id ? color : C.textDim,
            fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
            cursor: 'pointer', transition: 'all .15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ padding: 16 }}>
        {tab === 'tabla' ? (
          members?.length
            ? <StandingsTable members={members} color={color} classifies={group.classifies} />
            : <p style={{ color: C.textDim, textAlign: 'center', margin: '24px 0', fontSize: 13 }}>
                Sin jugadores en este grupo
              </p>
        ) : (
          matches?.length
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {matches.map(m => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    myId={myId}
                    isAdmin={isAdmin}
                    onReport={onReport}
                    onApprove={onApprove}
                  />
                ))}
              </div>
            : <p style={{ color: C.textDim, textAlign: 'center', margin: '24px 0', fontSize: 13 }}>
                No hay partidos generados
              </p>
        )}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      {[1, 2].map(i => (
        <div key={i} style={{ borderRadius: 18, overflow: 'hidden', border: `1px solid ${C.border}` }}>
          <div className="skeleton" style={{ height: 64, background: C.panel2 }} />
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(j => (
              <div key={j} className="skeleton" style={{ height: 40, borderRadius: 8, background: C.panel2 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function GroupStage({ tournamentId, profile, isAdmin = false, onReportResult, onApproveResult }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(() => {
    if (!tournamentId) return
    setLoading(true)
    fetchGroupStage(tournamentId)
      .then(setData)
      .catch(e => setError(e?.message ?? 'Error al cargar fase de grupos'))
      .finally(() => setLoading(false))
  }, [tournamentId])

  useEffect(() => { load() }, [load])

  // Realtime — re-fetch cuando cambia un partido del torneo
  useEffect(() => {
    if (!tournamentId) return
    const ch = supabase
      .channel(`group-stage:${tournamentId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tournament_matches',
        filter: `tournament_id=eq.${tournamentId}`,
      }, load)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tournament_standings',
        filter: `tournament_id=eq.${tournamentId}`,
      }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [tournamentId, load])

  if (loading) return <Skeleton />

  if (error) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
      <p style={{ color: '#ef4444', fontWeight: 700, margin: '0 0 16px' }}>{error}</p>
      <button onClick={load} style={{
        padding: '10px 24px', borderRadius: 10, border: 'none',
        background: C.green, color: C.bg, fontWeight: 700, cursor: 'pointer',
      }}>Reintentar</button>
    </div>
  )

  const { groups, membersByGroup, matchesByGroup } = data ?? {}

  if (!groups?.length) return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🎱</div>
      <p style={{ color: C.text, fontWeight: 700, fontSize: 16, margin: '0 0 6px' }}>Sorteo pendiente</p>
      <p style={{ color: C.textDim, fontSize: 13, margin: 0 }}>
        Los grupos aparecerán aquí una vez que el organizador realice el sorteo.
      </p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>

      {/* Resumen global */}
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: '12px 16px',
        display: 'flex', gap: 20, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>🏟️</span>
          <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>{groups.length} grupos</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>👥</span>
          <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>
            {Object.values(membersByGroup).reduce((s, arr) => s + arr.length, 0)} jugadores
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>⚽</span>
          <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>
            {Object.values(matchesByGroup).reduce((s, arr) => s + arr.length, 0)} partidos
          </span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: C.textDim, alignSelf: 'center' }}>
          Actualización en tiempo real
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: C.green, marginLeft: 5, verticalAlign: 'middle', boxShadow: `0 0 6px ${C.green}` }} />
        </div>
      </div>

      {/* Grid responsive de grupos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 480px), 1fr))',
        gap: 16,
        alignItems: 'start',
      }}>
        {groups.map((g, i) => {
          const color = g.color ?? GROUP_COLORS[i % GROUP_COLORS.length]
          return (
            <GroupSection
              key={g.id}
              group={g}
              color={color}
              members={membersByGroup[g.id] ?? []}
              matches={matchesByGroup[g.id] ?? []}
              myId={profile?.id}
              isAdmin={isAdmin}
              onReport={onReportResult}
              onApprove={onApproveResult}
            />
          )
        })}
      </div>

    </div>
  )
}
