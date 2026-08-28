/**
 * TournamentDashboard — diferencia TORNEO (grupos + bracket) de LIGA (todos vs todos, apertura/clausura).
 */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
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

function torneoPhaseIdx(status) {
  if (!status || status === 'inscripcion') return 0
  if (status === 'en_curso') return 2
  if (status === 'finalizado' || status === 'cancelado') return 3
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
      tournament_format, tournament_mode,
      liga_tipo, liga_fase, temporada, division, group_type,
      registration_deadline, start_date, description, banner_url
    `)
    .eq('id', tournamentId)
    .single()

  if (error || !conv) throw error ?? new Error('No encontrado')
  conv.status = conv.tournament_status

  const { count: participantCount } = await supabase
    .from('conversation_members')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', tournamentId)

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
  { id: 'tabla',     label: 'Tabla',    icon: '🏅' },
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
function TorneoOverview({ data, tournamentId, profile, isAdmin, onDrawComplete, isMember, onJoin }) {
  const fillPct = data.max_participants
    ? Math.round((data.participant_count / data.max_participants) * 100)
    : null
  const phaseIdx = torneoPhaseIdx(data.status)
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
        <StatCard icon="👥" label="Participantes" value={`${data.participant_count}${data.max_participants ? ` / ${data.max_participants}` : ''}`} accent={fillPct >= 90 ? '#f59e0b' : undefined} />
        <StatCard icon="📋" label="Grupos" value={data.groups?.length || '—'} accent={data.groups?.length ? C.green : undefined} />
        {data.open_disputes > 0 && <StatCard icon="⚠️" label="Disputas" value={data.open_disputes} accent="#ef4444" />}
        {data.format && <StatCard icon="🔀" label="Formato" value={data.format} />}
      </div>

      {/* Llenado */}
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
      {canJoin && (
        <button onClick={onJoin} style={{
          width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
          background: `linear-gradient(135deg, ${C.greenDk}, ${C.green})`,
          color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer',
          boxShadow: `0 4px 16px ${C.green}44`,
        }}>
          ✅ Inscribirme al torneo
        </button>
      )}
      {!canJoin && isMember && data.status === 'inscripcion' && (
        <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: C.green, fontWeight: 700 }}>
          ✅ Ya estás inscrito/a en este torneo
        </div>
      )}
    </div>
  )
}

// ── LIGA: OverviewTab ─────────────────────────────────────────────────────────
function LigaOverview({ data }) {
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
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
        <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>
          Cómo funciona
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { icon: '⚽', title: 'Apertura (Ida)', desc: 'Primera vuelta — todos juegan contra todos una vez.' },
            { icon: '🔄', title: 'Clausura (Vuelta)', desc: 'Segunda vuelta — se invierten los locales. Dos veces cada partido.' },
            { icon: '⬆️', title: 'Ascensos', desc: 'Los primeros puestos ascienden a una división superior.' },
            { icon: '⬇️', title: 'Descensos', desc: 'Los últimos descienden a la división inferior.' },
          ].map(item => (
            <div key={item.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: C.text }}>{item.title}</p>
                <p style={{ margin: 0, fontSize: 12, color: C.textDim, marginTop: 2 }}>{item.desc}</p>
              </div>
            </div>
          ))}
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
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TournamentDashboard({ tournamentId, profile, isAdmin, onBack }) {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [isMember, setIsMember]   = useState(false)
  const [joining, setJoining]     = useState(false)

  useEffect(() => {
    if (!tournamentId) return
    setLoading(true)
    setActiveTab('overview')
    fetchDashboard(tournamentId)
      .then(setData)
      .catch(e => setError(e?.message ?? 'Error al cargar'))
      .finally(() => setLoading(false))
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId || !profile?.id) return
    supabase.from('conversation_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('conversation_id', tournamentId)
      .eq('user_id', profile.id)
      .then(({ count }) => setIsMember((count ?? 0) > 0))
  }, [tournamentId, profile?.id])

  async function handleJoin() {
    if (!profile?.id || joining) return
    setJoining(true)
    const { error: e } = await supabase.from('conversation_members')
      .insert({ conversation_id: tournamentId, user_id: profile.id, role: 'participant' })
    if (e) { alert(`Error al inscribirte: ${e.message}`); setJoining(false); return }
    setIsMember(true)
    setData(d => d ? { ...d, participant_count: d.participant_count + 1 } : d)
    setJoining(false)
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
    visibleTabs = ['overview', 'apertura', 'clausura', 'tabla', 'chat']
  } else {
    visibleTabs = ['overview']
    if (hasGroups) visibleTabs.push('groups')
    if (hasBracket) visibleTabs.push('bracket')
    if (hasMatches) visibleTabs.push('fixture')
    visibleTabs.push('chat')
  }

  const tabs = isLiga ? LIGA_TABS : TORNEO_TABS

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>

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
      <div style={{ flex: 1, minHeight: 0, overflowY: activeTab === 'bracket' ? 'hidden' : 'auto', padding: activeTab === 'bracket' ? 0 : 16 }}>

        {activeTab === 'overview' && (
          isLiga
            ? <LigaOverview data={data} />
            : <TorneoOverview
                data={data}
                tournamentId={tournamentId}
                profile={profile}
                isAdmin={isAdmin}
                isMember={isMember}
                onJoin={joining ? null : handleJoin}
              />
        )}

        {activeTab === 'groups' && !isLiga && (
          <GroupStage tournamentId={tournamentId} profile={profile} isAdmin={isAdmin} />
        )}

        {activeTab === 'bracket' && !isLiga && (
          <BracketView tournamentId={tournamentId} profile={profile} isAdmin={isAdmin} />
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
          <LigaTab
            tournamentId={tournamentId}
            profile={profile}
            fase="clausura"
            ascensos={0}
            descensos={0}
            showFixture
          />
        )}

        {activeTab === 'tabla' && isLiga && (
          <LigaTab
            tournamentId={tournamentId}
            profile={profile}
            fase="all"
            ascensos={2}
            descensos={1}
            showFixture={false}
          />
        )}

        {activeTab === 'chat' && (
          <TournamentChat tournamentId={tournamentId} profile={profile} />
        )}

      </div>
    </div>
  )
}
