/**
 * TournamentDashboard — dashboard visual de un torneo específico.
 *
 * Props:
 *   tournamentId  uuid   — id de la conversación (torneo)
 *   onBack        fn     — callback para volver
 *
 * Query SQL equivalente (para referencia / uso en Edge Functions):
 *
 *   SELECT
 *     c.id, c.name, c.status, c.format, c.game, c.max_participants,
 *     c.tournament_format, c.tournament_mode, c.liga_tipo, c.liga_fase,
 *     c.temporada, c.division, c.registration_deadline, c.start_date,
 *     c.description, c.banner_url, c.group_type,
 *     (SELECT COUNT(*) FROM conversation_members cm WHERE cm.conversation_id = c.id) AS participant_count,
 *     (
 *       SELECT json_agg(g ORDER BY g.position)
 *       FROM (
 *         SELECT
 *           tg.id, tg.name, tg.color, tg.position, tg.classifies,
 *           (SELECT COUNT(*) FROM tournament_group_members tgm WHERE tgm.group_id = tg.id) AS member_count
 *         FROM tournament_groups tg
 *         WHERE tg.tournament_id = c.id
 *       ) g
 *     ) AS groups,
 *     (
 *       SELECT COUNT(*) FROM tournament_disputes td
 *       JOIN tournament_matches tm ON tm.id = td.match_id
 *       WHERE tm.tournament_id = c.id AND td.status = 'abierta'
 *     ) AS open_disputes
 *   FROM conversations c
 *   WHERE c.id = '<tournament_id>';
 */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

// ── Fases del torneo en orden ─────────────────────────────────────────────────
const PHASES = [
  { id: 'inscripcion', label: 'Inscripción', icon: '📋' },
  { id: 'sorteo',      label: 'Sorteo',      icon: '🎱' },
  { id: 'en_curso',    label: 'En curso',    icon: '⚡' },
  { id: 'finalizado',  label: 'Finalizado',  icon: '🏆' },
]

// Mapeo de status DB → fase visual
function statusToPhaseIndex(status) {
  if (!status || status === 'inscripcion') return 0
  // Si tiene grupos creados podría estar en sorteo — se resuelve externamente
  if (status === 'en_curso') return 2
  if (status === 'finalizado' || status === 'cancelado') return 3
  return 0
}

// ── Colores de estado ─────────────────────────────────────────────────────────
const STATUS_COLOR = {
  inscripcion: '#22c55e',
  en_curso:    '#f59e0b',
  finalizado:  '#6b7280',
  cancelado:   '#ef4444',
}
const STATUS_LABEL = {
  inscripcion: 'Abierto',
  en_curso:    'En curso',
  finalizado:  'Finalizado',
  cancelado:   'Cancelado',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const GROUP_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#a78bfa','#06b6d4','#f97316','#ec4899']

function fmtDate(ts) {
  if (!ts) return null
  const d = new Date(ts)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Query a Supabase ──────────────────────────────────────────────────────────
async function fetchDashboard(tournamentId) {
  // 1. Torneo principal
  const { data: conv, error } = await supabase
    .from('conversations')
    .select(`
      id, name, status, format, game, max_participants,
      tournament_format, tournament_mode,
      liga_tipo, liga_fase, temporada, division,
      registration_deadline, start_date, description, banner_url, group_type
    `)
    .eq('id', tournamentId)
    .single()

  if (error || !conv) throw error ?? new Error('Torneo no encontrado')

  // 2. Participantes
  const { count: participantCount } = await supabase
    .from('conversation_members')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', tournamentId)

  // 3. Grupos + conteo de miembros por grupo
  const { data: groups } = await supabase
    .from('tournament_groups')
    .select('id, name, color, position, classifies')
    .eq('tournament_id', tournamentId)
    .order('position', { ascending: true })

  let groupsWithCount = []
  if (groups?.length) {
    const groupIds = groups.map(g => g.id)
    const { data: members } = await supabase
      .from('tournament_group_members')
      .select('group_id')
      .in('group_id', groupIds)

    const countMap = {}
    members?.forEach(m => { countMap[m.group_id] = (countMap[m.group_id] || 0) + 1 })
    groupsWithCount = groups.map(g => ({ ...g, member_count: countMap[g.id] || 0 }))
  }

  // 4. Disputas abiertas
  const { count: openDisputes } = await supabase
    .from('tournament_disputes')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .eq('status', 'abierta')

  // 5. Partidos resumen
  const { data: matchStats } = await supabase
    .from('tournament_matches')
    .select('status')
    .eq('tournament_id', tournamentId)

  const total      = matchStats?.length ?? 0
  const finalizados = matchStats?.filter(m => m.status === 'finalizado').length ?? 0
  const pendientes  = matchStats?.filter(m => m.status === 'pendiente').length ?? 0
  const enJuego     = matchStats?.filter(m => m.status === 'en_juego').length ?? 0

  return {
    ...conv,
    participant_count: participantCount ?? 0,
    groups: groupsWithCount,
    open_disputes: openDisputes ?? 0,
    matches: { total, finalizados, pendientes, enJuego },
  }
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Stepper({ status, hasGroups }) {
  // Si tiene grupos y está en inscripcion, inferimos que puede haber sorteo
  const phaseIdx = statusToPhaseIndex(status)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 4px' }}>
      {PHASES.map((phase, i) => {
        const done    = i < phaseIdx
        const active  = i === phaseIdx
        const pending = i > phaseIdx
        const color   = active ? C.green : done ? C.green2 : C.border

        return (
          <div key={phase.id} style={{ display: 'flex', alignItems: 'center', flex: i < PHASES.length - 1 ? 1 : 'none' }}>
            {/* Círculo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: active ? `${C.green}20` : done ? `${C.green2}15` : C.panel2,
                border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16,
                boxShadow: active ? `0 0 12px ${C.green}44` : 'none',
                transition: 'all .2s',
              }}>
                {done ? '✓' : phase.icon}
              </div>
              <span style={{
                fontSize: 10, fontWeight: active ? 700 : 500,
                color: active ? C.green : done ? C.text2 : C.textDim,
                textAlign: 'center', whiteSpace: 'nowrap',
              }}>
                {phase.label}
              </span>
            </div>
            {/* Línea conectora */}
            {i < PHASES.length - 1 && (
              <div style={{
                flex: 1, height: 2, marginBottom: 22,
                background: done
                  ? `linear-gradient(90deg, ${C.green2}, ${i + 1 <= phaseIdx ? C.green2 : C.border})`
                  : C.panel2,
                transition: 'background .3s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div style={{
      background: C.panel2, border: `1px solid ${accent ? `${accent}44` : C.border}`,
      borderRadius: 14, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 22, fontWeight: 800, color: accent ?? C.text, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 11, color: C.textDim, fontWeight: 500 }}>{label}</span>
    </div>
  )
}

function GroupGrid({ groups }) {
  if (!groups?.length) return (
    <div style={{
      background: C.panel2, border: `1px dashed ${C.border}`,
      borderRadius: 14, padding: '28px 16px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🎱</div>
      <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>Sorteo pendiente — aún no hay grupos asignados</p>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
      {groups.map((g, i) => {
        const color = g.color ?? GROUP_COLORS[i % GROUP_COLORS.length]
        const pct   = g.member_count ? Math.round((g.member_count / (g.member_count + 1)) * 100) : 0
        return (
          <div key={g.id} style={{
            background: `${color}0d`,
            border: `1.5px solid ${color}44`,
            borderRadius: 14, padding: '14px 12px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {/* Nombre del grupo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontWeight: 800, fontSize: 13, color: C.text }}>Grupo {g.name}</span>
            </div>
            {/* Jugadores */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: C.textDim }}>Jugadores</span>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{g.member_count}</span>
              </div>
              <div style={{ height: 4, background: C.panel, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width .4s' }} />
              </div>
            </div>
            {/* Clasifican */}
            <div style={{
              fontSize: 10, color, fontWeight: 700,
              background: `${color}18`, border: `1px solid ${color}33`,
              borderRadius: 6, padding: '3px 7px', alignSelf: 'flex-start',
            }}>
              Top {g.classifies} clasifican
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MatchProgress({ matches }) {
  if (!matches?.total) return null
  const pct = matches.total > 0 ? Math.round((matches.finalizados / matches.total) * 100) : 0
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Progreso de partidos</span>
        <span style={{ fontSize: 12, color: C.green, fontWeight: 800 }}>{pct}%</span>
      </div>
      <div style={{ height: 8, background: C.panel, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{
          height: '100%', borderRadius: 8, transition: 'width .5s',
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${C.greenDk}, ${C.green})`,
          boxShadow: `0 0 8px ${C.green}44`,
        }} />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Finalizados', count: matches.finalizados, color: C.green2 },
          { label: 'En juego',    count: matches.enJuego,     color: '#f59e0b' },
          { label: 'Pendientes',  count: matches.pendientes,  color: C.textDim },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
            <span style={{ fontSize: 11, color: C.textDim }}>{s.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.count}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
          <span style={{ fontSize: 11, color: C.textDim }}>Total</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{matches.total}</span>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TournamentDashboard({ tournamentId, onBack }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (!tournamentId) return
    setLoading(true)
    fetchDashboard(tournamentId)
      .then(setData)
      .catch(e => setError(e?.message ?? 'Error al cargar'))
      .finally(() => setLoading(false))
  }, [tournamentId])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16 }}>
      {[80, 120, 200, 160].map((h, i) => (
        <div key={i} className="skeleton" style={{ height: h, borderRadius: 14, background: C.panel2 }} />
      ))}
    </div>
  )

  if (error) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
      <p style={{ color: '#ef4444', fontWeight: 700 }}>{error}</p>
      <button onClick={onBack} style={{ marginTop: 12, padding: '10px 24px', borderRadius: 10, border: 'none', background: C.green, color: C.bg, fontWeight: 700, cursor: 'pointer' }}>
        Volver
      </button>
    </div>
  )

  if (!data) return null

  const statusColor = STATUS_COLOR[data.status] ?? C.textDim
  const fillPct     = data.max_participants
    ? Math.round((data.participant_count / data.max_participants) * 100)
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>

      {/* Header */}
      <div style={{
        flexShrink: 0,
        background: C.panel,
        borderBottom: `1px solid ${C.border}`,
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {onBack && (
          <button onClick={onBack} style={{
            background: 'none', border: 'none', color: C.textDim,
            cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}44`,
            }}>
              {STATUS_LABEL[data.status] ?? data.status}
            </span>
            {data.game && (
              <span style={{ fontSize: 11, color: C.textDim }}>{data.game}</span>
            )}
            {data.group_type === 'liga' && data.division && (
              <span style={{ fontSize: 11, color: C.textDim }}>División {data.division}</span>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Stepper */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          <p style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Estado de la competencia
          </p>
          <Stepper status={data.status} hasGroups={data.groups?.length > 0} />
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
          <StatCard
            icon="👥"
            label="Participantes"
            value={`${data.participant_count}${data.max_participants ? ` / ${data.max_participants}` : ''}`}
            accent={fillPct >= 90 ? '#f59e0b' : undefined}
          />
          <StatCard
            icon="🎯"
            label="Grupos"
            value={data.groups?.length || '—'}
            accent={data.groups?.length ? C.green : undefined}
          />
          {data.open_disputes > 0 && (
            <StatCard icon="⚠️" label="Disputas abiertas" value={data.open_disputes} accent="#ef4444" />
          )}
          {data.group_type === 'liga' && data.temporada != null && (
            <StatCard icon="📅" label="Temporada" value={`T${data.temporada}`} />
          )}
          {data.format && (
            <StatCard icon="🔀" label="Formato" value={data.format} />
          )}
        </div>

        {/* Capacidad — barra de llenado */}
        {fillPct !== null && (
          <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>Llenado del torneo</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: fillPct >= 90 ? '#f59e0b' : C.green }}>
                {fillPct}% ({data.participant_count}/{data.max_participants})
              </span>
            </div>
            <div style={{ height: 8, background: C.panel, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 8,
                width: `${Math.min(fillPct, 100)}%`,
                background: fillPct >= 90
                  ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                  : `linear-gradient(90deg, ${C.greenDk}, ${C.green})`,
                transition: 'width .5s',
              }} />
            </div>
          </div>
        )}

        {/* Fechas */}
        {(data.start_date || data.registration_deadline) && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {data.registration_deadline && (
              <div style={{ flex: 1, minWidth: 140, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>Cierre inscripciones</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{fmtDate(data.registration_deadline)}</p>
              </div>
            )}
            {data.start_date && (
              <div style={{ flex: 1, minWidth: 140, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>Inicio del torneo</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{fmtDate(data.start_date)}</p>
              </div>
            )}
          </div>
        )}

        {/* Progreso de partidos */}
        {data.matches?.total > 0 && <MatchProgress matches={data.matches} />}

        {/* Grupos */}
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Grupos / Fase de grupos
          </p>
          <GroupGrid groups={data.groups} />
        </div>

        {/* Descripción */}
        {data.description && (
          <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
            <p style={{ margin: '0 0 6px', fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>Descripción / Reglas</p>
            <p style={{ margin: 0, fontSize: 13, color: C.text2, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{data.description}</p>
          </div>
        )}

      </div>
    </div>
  )
}
