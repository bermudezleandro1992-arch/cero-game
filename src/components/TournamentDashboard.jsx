/**
 * TournamentDashboard — diferencia TORNEO (grupos + bracket) de LIGA (todos vs todos, apertura/clausura).
 */

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import { postTournamentBotAnnouncement } from './CommunityDashboardWA'

const PLAYER_EMOJIS_TD = ['⚽','🔥','🐐','💙','⚡','🎯','🏅','👑','🦁','🐺','🌟','💪','🔱','🏹','🎮','🕹️']
function pEmoji(i) { return PLAYER_EMOJIS_TD[i % PLAYER_EMOJIS_TD.length] }
import GroupStage      from './GroupStage'
import BracketView     from './BracketView'
import FixtureTab      from './FixtureTab'
import LigaTab         from './LigaTab'
import TournamentChat  from './TournamentChat'

// ── Status ────────────────────────────────────────────────────────────────────
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

// ── Stepper para TORNEO ───────────────────────────────────────────────────────
const TORNEO_PHASES = [
  { id: 'inscripcion', label: 'Inscripción', icon: '📋' },
  { id: 'sorteo',      label: 'Sorteo',      icon: '🎱' },
  { id: 'en_curso',    label: 'En curso',    icon: '⚡' },
  { id: 'finalizado',  label: 'Final',       icon: '🏆' },
]

// ── Stepper para LIGA ─────────────────────────────────────────────────────────
const LIGA_PHASES = [
  { id: 'inscripcion', label: 'Inscripción', icon: '📋' },
  { id: 'apertura',    label: 'Apertura',    icon: '⚽' },
  { id: 'clausura',    label: 'Clausura',    icon: '🔄' },
  { id: 'finalizado',  label: 'Final',       icon: '🏆' },
]

function torneoPhaseIdx(status, matches) {
  if (!status || status === 'inscripcion') return 0
  if (status === 'finalizado' || status === 'cancelado') return 3
  if (status === 'en_curso') {
    // Si solo queda 1 partido (la final), avanzar el stepper a "Final"
    if (matches && matches.total > 0 && matches.pendientes <= 1 && matches.enJuego === 0) return 3
    return 2
  }
  return 0
}

function ligaPhaseIdx(status, ligaFase) {
  if (!status || status === 'inscripcion') return 0
  if (status === 'en_curso') return ligaFase === 'clausura' ? 2 : 1
  if (status === 'finalizado' || status === 'cancelado') return 3
  return 0
}

function fmtDate(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const GROUP_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#a78bfa','#06b6d4','#f97316','#ec4899']

// ── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchDashboard(tournamentId) {
  const { data: conv, error } = await supabase
    .from('conversations')
    .select(`
      id, name, tournament_status, format, game, max_participants,
      tournament_format, tournament_mode, auto_start_on_full, auto_start_delay_seconds, sorteo_starts_at,
      liga_tipo, liga_fase, temporada, division, group_type, community_id,
      registration_deadline, start_date, description, banner_url, team_size
    `)
    .eq('id', tournamentId)
    .single()

  if (error || !conv) throw error ?? new Error('No encontrado')
  conv.status = conv.tournament_status

  const { data: countData } = await supabase
    .rpc('get_tournament_participant_count', { p_tournament_id: tournamentId })
  const participantCount = countData ?? 0

  const { data: groups } = await supabase
    .from('tournament_groups')
    .select('id, name, color, position, classifies')
    .eq('tournament_id', tournamentId)
    .order('position', { ascending: true })

  let groupsWithCount = []
  if (groups?.length) {
    const { data: members } = await supabase
      .from('tournament_group_members')
      .select('group_id')
      .in('group_id', groups.map(g => g.id))
    const countMap = {}
    members?.forEach(m => { countMap[m.group_id] = (countMap[m.group_id] || 0) + 1 })
    groupsWithCount = groups.map(g => ({ ...g, member_count: countMap[g.id] || 0 }))
  }

  const { count: openDisputes } = await supabase
    .from('tournament_disputes')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .eq('status', 'abierta')

  const { data: matchStats } = await supabase
    .from('tournament_matches')
    .select('status, phase')
    .eq('tournament_id', tournamentId)

  const total       = matchStats?.length ?? 0
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

// ── Shared UI ──────────────────────────────────────────────────────────────────
function Stepper({ phases, phaseIdx }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 4px' }}>
      {phases.map((phase, i) => {
        const done   = i < phaseIdx
        const active = i === phaseIdx
        const color  = active ? C.green : done ? C.green2 : C.border
        return (
          <div key={phase.id} style={{ display: 'flex', alignItems: 'center', flex: i < phases.length - 1 ? 1 : 'none' }}>
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
            {i < phases.length - 1 && (
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

function MatchProgress({ matches }) {
  if (!matches?.total) return null
  const pct = Math.round((matches.finalizados / matches.total) * 100)
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
      </div>
    </div>
  )
}

// ── TORNEO: Tabs ──────────────────────────────────────────────────────────────
const TORNEO_TABS = [
  { id: 'overview', label: 'Resumen',  icon: '📊' },
  { id: 'groups',   label: 'Grupos',   icon: '📋' },
  { id: 'bracket',  label: 'Bracket',  icon: '🏆' },
  { id: 'fixture',  label: 'Fixture',  icon: '⚽' },
  { id: 'chat',     label: 'Chat',     icon: '💬' },
]

// ── LIGA: Tabs ────────────────────────────────────────────────────────────────
const LIGA_TABS = [
  { id: 'overview',  label: 'Resumen',  icon: '📊' },
  { id: 'apertura',  label: 'Apertura', icon: '⚽' },
  { id: 'clausura',  label: 'Clausura', icon: '🔄' },
  { id: 'chat',      label: 'Chat',     icon: '💬' },
]

function TabBar({ tabs, active, onChange, visible }) {
  const shown = tabs.filter(t => visible.includes(t.id))
  return (
    <div style={{
      display: 'flex', background: C.panel,
      borderBottom: `1px solid ${C.border}`,
      overflowX: 'auto', flexShrink: 0,
    }}>
      {shown.map(tab => {
        const isActive = tab.id === active
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)} style={{
            flex: '0 0 auto', padding: '12px 16px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: isActive ? C.green : C.textDim,
            fontWeight: isActive ? 700 : 500, fontSize: 13,
            borderBottom: `2px solid ${isActive ? C.green : 'transparent'}`,
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'color .15s, border-color .15s',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: 14 }}>{tab.icon}</span>
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

// ── TORNEO: OverviewTab ───────────────────────────────────────────────────────
function TorneoOverview({ data, tournamentId, profile, isAdmin, onDrawComplete, isMember, onJoin, onFillBots, onStartSorteo, onRandomTeams, userClan, onNeedClan }) {

  const fillPct = data.max_participants
    ? Math.round((data.participant_count / data.max_participants) * 100)
    : null
  const phaseIdx = torneoPhaseIdx(data.status, data.matches)
  const isGuerraMode = (data.team_size || 1) > 1
  const canJoin = data.status === 'inscripcion' && profile && !isMember && (!data.max_participants || data.participant_count < data.max_participants)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stepper */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
        <p style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>
          Estado del torneo
        </p>
        <Stepper phases={TORNEO_PHASES} phaseIdx={phaseIdx} />
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
        {(data.team_size || 1) > 1 ? (
          <>
            <StatCard icon="⚔️" label="Equipos" value={`${data.participant_count}${data.max_participants ? ` / ${data.max_participants}` : ''}`} accent={fillPct >= 90 ? '#f59e0b' : undefined} />
            <StatCard icon="👥" label="Jugadores" value={`${data.participant_count * data.team_size} / ${(data.max_participants || 0) * data.team_size}`} accent={C.green} />
          </>
        ) : (
          <StatCard icon="👥" label="Participantes" value={`${data.participant_count}${data.max_participants ? ` / ${data.max_participants}` : ''}`} accent={fillPct >= 90 ? '#f59e0b' : undefined} />
        )}
        {(data.groups?.length ?? 0) > 0 && <StatCard icon="📋" label="Grupos" value={data.groups.length} accent={C.green} />}
        {data.open_disputes > 0 && <StatCard icon="⚠️" label="Disputas" value={data.open_disputes} accent="#ef4444" />}
        {data.format && <StatCard icon="🔀" label="Formato" value={data.format} />}
      </div>

      {/* Llenado */}
      {fillPct !== null && (
        <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>Llenado del torneo</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: fillPct >= 90 ? '#f59e0b' : C.green }}>
              {fillPct}% ({data.participant_count}/{data.max_participants} {(data.team_size || 1) > 1 ? 'equipos' : 'jugadores'})
            </span>
          </div>
          <div style={{ height: 8, background: C.panel, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 8, width: `${Math.min(fillPct, 100)}%`,
              background: fillPct >= 90 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : `linear-gradient(90deg, ${C.greenDk}, ${C.green})`,
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
              <p style={{ margin: '0 0 4px', fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>Inicio</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{fmtDate(data.start_date)}</p>
            </div>
          )}
        </div>
      )}

      {/* Progreso partidos */}
      {data.matches?.total > 0 && <MatchProgress matches={data.matches} />}

      {/* Grupos (solo si ya existen) */}
      {data.groups?.length > 0 && (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Grupos / Fase de grupos
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            {data.groups.map((g, i) => {
              const color = g.color ?? GROUP_COLORS[i % GROUP_COLORS.length]
              return (
                <div key={g.id} style={{ background: `${color}0d`, border: `1.5px solid ${color}44`, borderRadius: 14, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 800, fontSize: 13, color: C.text }}>Grupo {g.name}</span>
                  </div>
                  <span style={{ fontSize: 11, color: C.textDim }}>👥 {g.member_count} jugadores</span>
                  <div style={{ fontSize: 10, color, fontWeight: 700, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: 6, padding: '3px 7px', alignSelf: 'flex-start' }}>
                    Top {g.classifies} clasifican
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Desc */}
      {data.description && (
        <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
          <p style={{ margin: '0 0 6px', fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>Descripción / Reglas</p>
          <p style={{ margin: 0, fontSize: 13, color: C.text2, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{data.description}</p>
        </div>
      )}

      {/* Botón inscribirse */}
      {canJoin && !isGuerraMode && (
        <button onClick={onJoin} style={{
          width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
          background: `linear-gradient(135deg, ${C.greenDk}, ${C.green})`,
          color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer',
          boxShadow: `0 4px 16px ${C.green}44`,
        }}>
          ✅ Inscribirme al torneo
        </button>
      )}
      {canJoin && isGuerraMode && userClan && (
        <button onClick={onJoin} style={{
          width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
          background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
          color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
          boxShadow: '0 4px 16px #ef444444',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>⚔️</span>
          Inscribir mi clan [{userClan.tag}]
        </button>
      )}
      {canJoin && isGuerraMode && !userClan && (
        <div style={{ background: '#ef444411', border: '1.5px solid #ef444433', borderRadius: 14, padding: 16, textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: C.text, fontWeight: 600 }}>
            ⚔️ Este torneo requiere un clan para inscribirse
          </p>
          <button onClick={onNeedClan} style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: '#ef4444', color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            Crear mi clan →
          </button>
        </div>
      )}
      {!canJoin && isMember && data.status === 'inscripcion' && (
        <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: C.green, fontWeight: 700 }}>
          ✅ {isGuerraMode && userClan ? `Clan [${userClan.tag}] inscrito` : 'Ya estás inscrito/a en este torneo'}
        </div>
      )}

      {onFillBots && data.status === 'inscripcion' && data.max_participants && data.participant_count < data.max_participants && (
        <button onClick={onFillBots} style={{
          width: '100%', padding: '12px 0', borderRadius: 14,
          border: `1.5px dashed ${C.border}`,
          background: 'transparent', color: C.textDim,
          fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          🤖 Completar con bots ({data.max_participants - data.participant_count} lugares)
        </button>
      )}

      {onRandomTeams && isAdmin && data.status === 'inscripcion' && (data.team_size || 1) > 1 && data.participant_count >= 2 && (
        <button onClick={onRandomTeams} style={{
          width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
          background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
          color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>⚔️</span>
          Sorteo de parejas al azar ({data.team_size}vs{data.team_size})
        </button>
      )}

      {onStartSorteo && data.status === 'inscripcion' && data.participant_count >= data.max_participants && (
        <button onClick={onStartSorteo} style={{
          width: '100%', padding: '14px 0', borderRadius: 14,
          border: 'none',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: '#000', fontWeight: 800, fontSize: 14, cursor: 'pointer',
          boxShadow: '0 4px 20px #f59e0b44',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>🎱</span>
          Iniciar sorteo en vivo
        </button>
      )}

      {isAdmin && (
        <ThirdPlaceToggle tournamentId={tournamentId} value={!!data.has_third_place} onToggle={onDrawComplete} />
      )}
    </div>
  )
}

function ThirdPlaceToggle({ tournamentId, value, onToggle }) {
  const [saving, setSaving] = useState(false)
  async function toggle() {
    setSaving(true)
    await supabase.from('conversations').update({ has_third_place: !value }).eq('id', tournamentId)
    setSaving(false)
    onToggle?.()
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px',
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>🥉 Partido 3er/4to lugar</div>
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Habilitar partido por el tercer puesto</div>
      </div>
      <button onClick={toggle} disabled={saving} style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: value ? C.green : C.border, transition: 'background 0.2s',
        position: 'relative', flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute', top: 3, left: value ? 22 : 3,
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', display: 'block',
        }} />
      </button>
    </div>
  )
}

// ── LIGA: OverviewTab ─────────────────────────────────────────────────────────
function LigaOverview({ data, isMember, onJoin, joining }) {
  const phaseIdx = ligaPhaseIdx(data.status, data.liga_fase)
  const fillPct = data.max_participants
    ? Math.round((data.participant_count / data.max_participants) * 100)
    : null

  // Fase actual de la liga
  const faseActual = data.liga_fase === 'clausura' ? 'Clausura (vuelta)' : data.status === 'en_curso' ? 'Apertura (ida)' : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Banner de fase */}
      {faseActual && (
        <div style={{
          background: `linear-gradient(135deg, ${C.green}18, ${C.greenDk}18)`,
          border: `1.5px solid ${C.green}44`,
          borderRadius: 16, padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 28 }}>{data.liga_fase === 'clausura' ? '🔄' : '⚽'}</span>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: C.green }}>{faseActual}</p>
            <p style={{ margin: 0, fontSize: 12, color: C.textDim }}>
              {data.liga_fase === 'clausura' ? 'Segunda mitad de temporada — partidos de vuelta' : 'Primera mitad de temporada — partidos de ida'}
            </p>
          </div>
        </div>
      )}

      {/* Stepper */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
        <p style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>
          Temporada {data.temporada != null ? `— T${data.temporada}` : ''}
        </p>
        <Stepper phases={LIGA_PHASES} phaseIdx={phaseIdx} />
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
        <StatCard icon="👥" label="Equipos" value={`${data.participant_count}${data.max_participants ? ` / ${data.max_participants}` : ''}`} />
        {data.temporada != null && <StatCard icon="📅" label="Temporada" value={`T${data.temporada}`} accent={C.green} />}
        {data.division && <StatCard icon="🏟️" label="División" value={data.division} />}
        {data.open_disputes > 0 && <StatCard icon="⚠️" label="Disputas" value={data.open_disputes} accent="#ef4444" />}
      </div>

      {/* Cómo funciona esta liga */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px 0', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>📖</span>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Cómo funciona
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[
            { icon: '⚽', color: '#22c55e', title: 'Apertura — Fase de grupos (IDA)', desc: 'Todos juegan contra todos una vez. Al terminar, los mejores clasifican para el bracket de playoffs.' },
            { icon: '🏆', color: '#f59e0b', title: 'Brackets Apertura', desc: 'Eliminación directa entre los clasificados. Partido único. El ganador recibe la copa de la Apertura.' },
            { icon: '🔄', color: '#3b82f6', title: 'Clausura — Fase de grupos (IDA y VUELTA)', desc: 'Segunda mitad de temporada. Todos juegan contra todos dos veces (local y visitante).' },
            { icon: '🥇', color: '#a78bfa', title: 'Brackets Clausura', desc: 'Eliminación directa entre los clasificados. El campeón de la Clausura obtiene el título de la temporada.' },
            { icon: '⬆️', color: '#22c55e', title: 'Ascensos', desc: 'Los mejores puestos de la tabla acumulada ascienden a una división superior la próxima temporada.' },
            { icon: '⬇️', color: '#ef4444', title: 'Descensos', desc: 'Los últimos puestos descienden a una división inferior la próxima temporada.' },
          ].map((item, i, arr) => (
            <div key={item.title} style={{
              display: 'flex', gap: 14, padding: '13px 18px',
              borderTop: i > 0 ? `1px solid ${C.border}` : 'none',
              alignItems: 'flex-start',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: `${item.color}18`, border: `1.5px solid ${item.color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
              }}>{item.icon}</div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: C.text }}>{item.title}</p>
                <p style={{ margin: 0, fontSize: 12, color: C.textDim, marginTop: 3, lineHeight: 1.5 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Reglas de partido */}
        <div style={{ margin: '0 14px 14px', background: C.panel2, borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.8px' }}>⚙️ Reglas del partido</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: '⏱ Duración', value: '10 min por partido' },
              { label: '⚡ Tiempo extra', value: 'Sí (2 × 5 min)' },
              { label: '🥅 Penales', value: 'Sí, si hay empate en TG' },
              { label: '📋 Formato', value: 'Todos vs todos + Bracket' },
            ].map(r => (
              <div key={r.label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600, marginBottom: 2 }}>{r.label}</div>
                <div style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progreso partidos */}
      {data.matches?.total > 0 && <MatchProgress matches={data.matches} />}

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
              <p style={{ margin: '0 0 4px', fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>Inicio</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{fmtDate(data.start_date)}</p>
            </div>
          )}
        </div>
      )}

      {/* Desc */}
      {data.description && (
        <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
          <p style={{ margin: '0 0 6px', fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>Descripción / Reglamento</p>
          <p style={{ margin: 0, fontSize: 13, color: C.text2, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{data.description}</p>
        </div>
      )}

      {/* Inscripción */}
      {data.status === 'inscripcion' && !isMember && onJoin && (
        <button onClick={onJoin} disabled={joining} style={{
          width: '100%', padding: '14px 0', borderRadius: 14,
          border: 'none', background: `linear-gradient(135deg, ${C.green}, ${C.greenDk})`,
          color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
          opacity: joining ? 0.6 : 1,
        }}>
          {joining ? '⏳ Inscribiendo…' : '✅ Inscribirme a la liga'}
        </button>
      )}
      {data.status === 'inscripcion' && isMember && (
        <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: C.green, fontWeight: 700 }}>
          ✅ Ya estás inscrito/a en esta liga
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
const cleanUUID = id => {
  if (!id) return id
  const s = String(id)
  const m = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  return m ? m[0] : s.replace(/[^0-9a-f-]/gi, '').slice(0, 36)
}

export default function TournamentDashboard({ tournamentId: rawTournamentId, profile, isAdmin, onBack, showBotButton, communityId: communityIdProp }) {
  const tournamentId = cleanUUID(rawTournamentId)
  const [data, setData]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [activeTab, setActiveTab]   = useState('overview')
  const [isMember, setIsMember]     = useState(false)
  const [joining, setJoining]       = useState(false)
  const [countdown, setCountdown]   = useState(null) // null | number
  const [userClan, setUserClan]     = useState(null) // clan the user leads or belongs to
  const countdownRef                = useRef(null)

  const refresh = () => {
    if (!tournamentId) return
    fetchDashboard(tournamentId).then(setData).catch(() => {})
  }

  useEffect(() => {
    if (!tournamentId) return
    setLoading(true)
    setActiveTab('overview')
    fetchDashboard(tournamentId)
      .then(setData)
      .catch(e => setError(e?.message ?? 'Error al cargar'))
      .finally(() => setLoading(false))
  }, [tournamentId])

  // Realtime: re-fetch when tournament row or members change
  useEffect(() => {
    if (!tournamentId) return
    const ch = supabase.channel(`td-rt-${tournamentId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'conversations',
        filter: `id=eq.${tournamentId}`,
      }, () => refresh())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'conversation_members',
        filter: `conversation_id=eq.${tournamentId}`,
      }, () => refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tournamentId])

  // Sorteo countdown from DB field (synced across all viewers)
  useEffect(() => {
    if (!data?.sorteo_starts_at) { setCountdown(null); return }
    const tick = () => {
      const secs = Math.round((new Date(data.sorteo_starts_at) - Date.now()) / 1000)
      if (secs <= 0) {
        clearInterval(countdownRef.current)
        setCountdown(null)
        // Any viewer triggers start if not already started
        if (data.status === 'inscripcion' || data.status === 'sorteo_pendiente') {
          supabase.rpc('start_tournament', { p_tournament_id: tournamentId }).then(({ error: e }) => {
            if (!e) refresh()
          })
        }
      } else {
        setCountdown(secs)
      }
    }
    tick()
    clearInterval(countdownRef.current)
    countdownRef.current = setInterval(tick, 1000)
    return () => clearInterval(countdownRef.current)
  }, [data?.sorteo_starts_at])

  useEffect(() => {
    if (!tournamentId || !profile?.id) return
    supabase.from('conversation_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('conversation_id', tournamentId)
      .eq('user_id', profile.id)
      .then(({ count }) => setIsMember((count ?? 0) > 0))
  }, [tournamentId, profile?.id])

  useEffect(() => {
    if (!profile?.id) return
    supabase.from('clan_members')
      .select('clan_id, clans(id, name, tag)')
      .eq('user_id', profile.id)
      .limit(1)
      .single()
      .then(({ data: cm }) => setUserClan(cm?.clans ?? null))
      .catch(() => {})
  }, [profile?.id])

  async function postAviso(title, body, extraFields = {}) {
    const communityId = data?.community_id
    if (!communityId || !profile?.id) return
    await supabase.from('announcements').insert({
      conversation_id: communityId,
      author_id: profile.id,
      title,
      body: body || null,
      category: data?.group_type === 'liga' ? 'liga' : 'torneo',
      is_active: true,
      tournament_id: tournamentId,
      ...extraFields,
    })
  }

  async function postBotCard(tournament, participants = []) {
    const communityId = tournament?.community_id || data?.community_id
    if (!communityId || !profile?.id) return
    await postTournamentBotAnnouncement({
      supabase,
      communityId,
      authorId: profile.id,
      tournament: tournament || data,
      participants,
    })
  }

  async function fetchParticipants() {
    const { data: rows } = await supabase
      .from('tournament_participants')
      .select('user_id, users!inner(id, display_name, username, is_bot)')
      .eq('tournament_id', tournamentId)
      .limit(16)
    return (rows || []).map(r => r.users).filter(u => u && !u.is_bot)
  }

  async function triggerAutoStart(tournamentData) {
    const delay = tournamentData.auto_start_delay_seconds ?? 0
    if (delay <= 0) {
      const { data: rpcResult, error: e } = await supabase.rpc('start_tournament', { p_tournament_id: tournamentId })
      if (e) {
        console.error('start_tournament RPC error:', e)
        alert(`Error al iniciar torneo: ${e.message}`)
        return
      }
      if (rpcResult && !rpcResult.ok) {
        alert(`Error: ${rpcResult.error || 'No se pudo iniciar el torneo'}`)
        return
      }
      await postAviso(
        `🏆 "${tournamentData.name}" — ¡El torneo COMENZÓ!`,
        `Sorteo realizado. ${tournamentData.participant_count ?? ''} jugadores en competencia. ¡Buena suerte!`
      )
      refresh()
      return
    }
    // Write sorteo_starts_at to DB so ALL viewers see the same countdown
    const startsAt = new Date(Date.now() + delay * 1000).toISOString()
    const { error: upErr } = await supabase.from('conversations')
      .update({ sorteo_starts_at: startsAt })
      .eq('id', tournamentId)
    if (upErr) {
      alert(`Error al iniciar sorteo: ${upErr.message}`)
      return
    }
    // Optimistically show the draw locally while realtime propagates
    setData(d => d ? { ...d, sorteo_starts_at: startsAt } : d)
  }

  async function handleJoin() {
    if (!profile?.id || joining) return
    setJoining(true)
    const isGuerraMode = (data?.team_size || 1) > 1

    if (isGuerraMode && userClan) {
      // Inscribe all clan members into the tournament
      const { data: clanMems } = await supabase.from('clan_members')
        .select('user_id')
        .eq('clan_id', userClan.id)
      if (!clanMems?.length) { alert('El clan no tiene miembros.'); setJoining(false); return }
      const rows = clanMems.map(m => ({ conversation_id: tournamentId, user_id: m.user_id }))
      const { error: e } = await supabase.from('conversation_members').insert(rows)
      if (e && !e.message.includes('duplicate')) { alert(`Error al inscribir clan: ${e.message}`); setJoining(false); return }
      setIsMember(true)
      const newCount = (data?.participant_count ?? 0) + 1
      setData(d => d ? { ...d, participant_count: newCount } : d)
      setJoining(false)
      const participants = await fetchParticipants()
      await postBotCard(data, participants)
      if (data?.max_participants && newCount >= data.max_participants && data.status === 'inscripcion') {
        await postAviso(`🔒 "${data.name}" — ¡Inscripciones CERRADAS!`, `Se completaron todos los cupos (${data.max_participants}/${data.max_participants}).`)
        if (data.auto_start_on_full) triggerAutoStart(data)
      }
      return
    }

    const { error: e } = await supabase.from('conversation_members')
      .insert({ conversation_id: tournamentId, user_id: profile.id })
    if (e) { alert(`Error al inscribirte: ${e.message}`); setJoining(false); return }
    setIsMember(true)
    const newCount = (data?.participant_count ?? 0) + 1
    setData(d => d ? { ...d, participant_count: newCount } : d)
    setJoining(false)

    // Postear card bot con participantes actualizados
    const participants = await fetchParticipants()
    await postBotCard(data, participants)

    // Auto-start si se completaron los cupos
    if (data?.max_participants && newCount >= data.max_participants && data.status === 'inscripcion') {
      await postAviso(
        `🔒 "${data.name}" — ¡Inscripciones CERRADAS!`,
        `Se completaron todos los cupos (${data.max_participants}/${data.max_participants}).`
      )
      if (data.auto_start_on_full) triggerAutoStart(data)
    }
  }

  async function handleFillBots() {
    if (!data || !isAdmin) return
    const slots = (data.max_participants ?? 0) - (data.participant_count ?? 0)
    if (slots <= 0) { alert('El torneo ya está completo.'); return }
    if (!window.confirm(`¿Agregar ${slots} bots para completar el torneo?`)) return

    const { error } = await supabase.rpc('fill_tournament_bots', {
      p_tournament_id: tournamentId,
      p_slots: slots,
    })
    if (error) { alert(`Error creando bots: ${error.message}`); return }

    // Fetch fresh state from DB
    const fresh = await fetchDashboard(tournamentId).catch(() => null)
    if (fresh) setData(fresh)

    await postAviso(
      `🔒 "${data.name}" — ¡Inscripciones CERRADAS!`,
      `Se completaron todos los cupos (${data.max_participants}/${data.max_participants}).`
    )
    // Always trigger sorteo after filling — organizer already confirmed
    await triggerAutoStart(fresh ?? data)
  }

  async function handleStartSorteo() {
    if (!isAdmin || !data) return
    await triggerAutoStart(data)
  }

  async function handleRandomTeams() {
    if (!isAdmin || !data) return
    const teamSize = data.team_size || 2

    const { data: members } = await supabase
      .from('conversation_members')
      .select('user_id, users(display_name, username)')
      .eq('conversation_id', tournamentId)
      .neq('role', 'owner')
    if (!members?.length) { alert('No hay participantes inscriptos.'); return }

    // Form random teams
    const shuffled = [...members].sort(() => Math.random() - 0.5)
    const teams = []
    for (let i = 0; i < shuffled.length; i += teamSize) {
      teams.push(shuffled.slice(i, i + teamSize))
    }

    const teamCount = teams.length
    // Find next power of 2 >= teamCount
    let slots = 1
    while (slots < teamCount) slots *= 2
    const rounds = Math.log2(slots)

    // Build round-1 matches (team vs team), byes get null opponent
    const matches = []
    let matchNum = 1
    for (let i = 0; i < slots; i += 2) {
      const t1 = teams[i]
      const t2 = teams[i + 1] // may be undefined (bye)
      const name1 = t1 ? t1.map(m => m.users?.display_name || m.users?.username || 'Jugador').join(' + ') : null
      const name2 = t2 ? t2.map(m => m.users?.display_name || m.users?.username || 'Jugador').join(' + ') : null
      matches.push({
        tournament_id: tournamentId,
        round_number: 1,
        match_number: matchNum++,
        player1_id: t1?.[0]?.user_id ?? null,
        player2_id: t2?.[0]?.user_id ?? null,
        player1_name: name1,
        player2_name: name2,
        status: 'pending',
      })
    }

    // Placeholder matches for subsequent rounds
    for (let r = 2; r <= rounds; r++) {
      const matchesInRound = slots / Math.pow(2, r)
      for (let m = 1; m <= matchesInRound; m++) {
        matches.push({
          tournament_id: tournamentId,
          round_number: r,
          match_number: m,
          player1_id: null,
          player2_id: null,
          player1_name: null,
          player2_name: null,
          status: 'pending',
        })
      }
    }

    // 3rd/4th place match in a separate round (rounds + 1, match 1)
    if (data.has_third_place) {
      matches.push({
        tournament_id: tournamentId,
        round_number: rounds + 1,
        match_number: 1,
        player1_id: null,
        player2_id: null,
        player1_name: null,
        player2_name: null,
        status: 'pending',
        phase: 'third_place',
      })
    }

    // Delete existing bracket matches and insert new ones
    await supabase.from('tournament_matches').delete().eq('tournament_id', tournamentId)
    const { error: insErr } = await supabase.from('tournament_matches').insert(matches)
    if (insErr) { alert('Error creando el bracket: ' + insErr.message); return }

    // Update tournament status to en_curso
    await supabase.from('conversations').update({ status: 'en_curso' }).eq('id', tournamentId)

    // Post bot message with team assignments
    let msg = `⚔️ SORTEO DE PAREJAS — ${data.name}\n\n`
    teams.forEach((team, i) => {
      const names = team.map(m => m.users?.display_name || m.users?.username || 'Jugador').join(' + ')
      msg += `🏅 Equipo ${i + 1}: ${names}\n`
    })
    msg += `\n👥 ${teams.length} equipos · ${rounds} rondas · ${matches.length} partidos`

    await supabase.from('messages').insert({
      conversation_id: tournamentId,
      sender_id: profile.id,
      content: msg,
      type: 'bot_fixture',
    })

    alert(`✅ Bracket creado: ${teams.length} equipos, ${rounds} rondas`)
    onDrawComplete?.()
  }

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
      <button onClick={onBack} style={{ marginTop: 12, padding: '10px 24px', borderRadius: 10, border: 'none', background: C.green, color: '#000', fontWeight: 700, cursor: 'pointer' }}>
        Volver
      </button>
    </div>
  )

  if (!data) return null

  const isLiga    = data.group_type === 'liga'
  const hasGroups  = (data.groups?.length ?? 0) > 0
  const hasBracket = !isLiga && (data.status === 'en_curso' || data.status === 'finalizado')
  const hasMatches = data.matches?.total > 0
  const statusColor = STATUS_COLOR[data.status] ?? C.textDim

  // Determine visible tabs
  let visibleTabs
  if (isLiga) {
    visibleTabs = ['overview', 'apertura', 'clausura', 'chat']
  } else {
    visibleTabs = ['overview']
    if (hasGroups) visibleTabs.push('groups')
    if (hasBracket) visibleTabs.push('bracket')
    if (hasMatches && !hasBracket) visibleTabs.push('fixture')
    visibleTabs.push('chat')
  }

  const tabs = isLiga ? LIGA_TABS : TORNEO_TABS

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, position: 'relative' }}>

      {/* Countdown overlay — visible for ALL viewers (synced via DB) */}
      {countdown !== null && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 72, lineHeight: 1, animation: 'pulse 1s ease-in-out infinite' }}>🎱</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '3px' }}>
            ¡Sorteo en vivo!
          </div>
          <div style={{
            fontSize: 96, fontWeight: 900, color: '#fff', lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 40px #f59e0b88`,
          }}>
            {countdown}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#ffffff99' }}>El sorteo comienza en...</div>
          <div style={{ fontSize: 12, color: '#ffffff44', marginTop: 8 }}>Todos los participantes verán este contador</div>
          {isAdmin && (
            <button
              onClick={async () => {
                clearInterval(countdownRef.current)
                setCountdown(null)
                await supabase.from('conversations').update({ sorteo_starts_at: null }).eq('id', tournamentId)
              }}
              style={{ marginTop: 4, padding: '8px 20px', borderRadius: 10, border: `1px solid #ffffff22`, background: 'transparent', color: '#ffffff44', fontSize: 12, cursor: 'pointer' }}
            >
              Cancelar sorteo
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div style={{
        flexShrink: 0,
        background: C.panel, borderBottom: `1px solid ${C.border}`,
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: isLiga ? 16 : 14 }}>{isLiga ? '🏅' : '🏆'}</span>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data.name}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}44`,
            }}>
              {STATUS_LABEL[data.status] ?? data.status}
            </span>
            {isLiga && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${C.green}15`, color: C.green, border: `1px solid ${C.green}33` }}>
                Liga
              </span>
            )}
            {data.game && <span style={{ fontSize: 11, color: C.textDim }}>{data.game}</span>}
            {isLiga && data.division && <span style={{ fontSize: 11, color: C.textDim }}>Div. {data.division}</span>}
            {isLiga && data.temporada != null && <span style={{ fontSize: 11, color: C.textDim }}>T{data.temporada}</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} visible={visibleTabs} />

      {/* Contenido */}
      <div style={{ flex: 1, minHeight: 0, overflowY: activeTab === 'bracket' ? 'hidden' : 'auto', overflowX: 'hidden', padding: activeTab === 'bracket' ? 0 : 16, display: activeTab === 'bracket' ? 'flex' : 'block', flexDirection: 'column' }}>

        {activeTab === 'overview' && (
          isLiga
            ? <LigaOverview data={data} isMember={isMember} onJoin={joining ? null : handleJoin} joining={joining} />
            : <TorneoOverview
                data={data}
                tournamentId={tournamentId}
                profile={profile}
                isAdmin={isAdmin}
                isMember={isMember}
                onJoin={joining ? null : handleJoin}
                onFillBots={showBotButton ? handleFillBots : null}
                onStartSorteo={isAdmin && data?.status === 'inscripcion' && data?.participant_count >= data?.max_participants ? handleStartSorteo : null}
                onRandomTeams={isAdmin && (data?.team_size || 1) > 1 ? handleRandomTeams : null}
                userClan={userClan}
                onNeedClan={() => { if (onBack) onBack(); window.location.hash = '#perfil-clan' }}
              />
        )}

        {activeTab === 'groups' && !isLiga && (
          <GroupStage tournamentId={tournamentId} profile={profile} isAdmin={isAdmin} />
        )}

        {activeTab === 'bracket' && !isLiga && (
          <BracketView tournamentId={tournamentId} communityId={data?.community_id} tournamentName={data?.name} profile={profile} isAdmin={isAdmin} onFinished={onBack} />
        )}

        {activeTab === 'fixture' && !isLiga && (
          <FixtureTab tournamentId={tournamentId} profile={profile} isAdmin={isAdmin} />
        )}

        {/* LIGA tabs */}
        {activeTab === 'apertura' && isLiga && (
          <LigaTab
            tournamentId={tournamentId}
            profile={profile}
            fase="apertura"
            ascensos={0}
            descensos={0}
            showFixture
          />
        )}

        {activeTab === 'clausura' && isLiga && (
          data?.liga_fase === 'clausura' || data?.status === 'finalizado'
            ? <LigaTab tournamentId={tournamentId} profile={profile} fase="clausura" ascensos={0} descensos={0} showFixture />
            : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: 16 }}>
                <div style={{ fontSize: 56 }}>🔒</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.text, textAlign: 'center' }}>Clausura bloqueada</div>
                <div style={{ fontSize: 13, color: C.textDim, textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
                  Esta fase se habilitará cuando termine la <strong style={{ color: C.green }}>Apertura</strong> y el organizador inicie la segunda mitad de la temporada.
                </div>
                <div style={{ padding: '10px 20px', borderRadius: 20, background: `${C.green}12`, border: `1px solid ${C.green}33`, fontSize: 12, color: C.green, fontWeight: 700 }}>
                  ⚽ Apertura en curso
                </div>
              </div>
        )}

        {activeTab === 'chat' && (
          <TournamentChat tournamentId={tournamentId} profile={profile} isAdmin={isAdmin} tournamentStatus={data?.status} />
        )}

      </div>
    </div>
  )
}
