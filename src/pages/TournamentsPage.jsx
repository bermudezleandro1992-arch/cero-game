import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { C } from '../theme'
import { getMaxParticipants, getRoleCfg } from '../lib/roles'
import BannerAd from '../components/BannerAd'
import SorteoPage from './tools/SorteoPage'
import BracketsPage from './tools/BracketsPage'
import TablaPosicionesPage from './tools/TablaPosicionesPage'
import VotacionesPage from './tools/VotacionesPage'
import CargaResultadosPage from './tools/CargaResultadosPage'
import CalendarioPage from './tools/CalendarioPage'
import SistemaPremiosPage from './tools/SistemaPremiosPage'

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  inscripcion: { label: 'Inscripción', color: '#22c55e', bg: '#22c55e18' },
  en_curso:    { label: 'En Curso',    color: '#fb8c00', bg: '#fb8c0018' },
  finalizado:  { label: 'Finalizado',  color: '#64748b', bg: '#64748b18' },
  cancelado:   { label: 'Cancelado',   color: '#ef4444', bg: '#ef444418' },
}

// ── Game Catalog ──────────────────────────────────────────────────────────────
const GAME_CATALOG = [
  { id: 'fc26',        icon: '⚽', label: 'FC 26',        color: '#10b981', soon: false },
  { id: 'fc27',        icon: '⚽', label: 'FC 27',        color: '#059669', soon: false },
  { id: 'efootball',   icon: '⚽', label: 'eFootball',    color: '#3b82f6', soon: false },
  { id: 'cs2',         icon: '🎯', label: 'CS2',          color: '#f59e0b', soon: true  },
  { id: 'valorant',    icon: '🎯', label: 'Valorant',     color: '#ef4444', soon: true  },
  { id: 'warzone',     icon: '🔫', label: 'Warzone',      color: '#84cc16', soon: true  },
  { id: 'pubg',        icon: '🔫', label: 'PUBG',         color: '#f59e0b', soon: true  },
  { id: 'clashroyale', icon: '👑', label: 'Clash Royale', color: '#a855f7', soon: true  },
  { id: 'freef',       icon: '🔥', label: 'Free Fire',    color: '#ef4444', soon: true  },
]

const GAME_CONFIG = {
  fc27: {
    plataformas: ['PS5', 'PS4', 'Xbox Series X/S', 'Xbox One', 'PC (EA App)'],
    modos: ['Ultimate Team', 'Volta Football', 'Carrera', 'Partido Amistoso', 'Rush'],
    tiempos: ['6 min', '8 min', '10 min', '12 min'],
    dificultades: ['Leyenda', 'Ultimate', 'Mundo', 'Aficionado'],
    extras: [
      { id: 'handicap', label: 'Sin Handicap' },
      { id: 'custom_tactics', label: 'Tácticas libres' },
      { id: 'divisions_only', label: 'Solo modo Divisiones' },
      { id: 'no_sbcs', label: 'Sin cartas SBC/Evolutions' },
    ],
    formatos: ['1vs1', 'Grupos + Playoffs', 'Liga todos vs todos', 'Copa eliminación directa', 'Bracket'],
  },
  fc26: {
    plataformas: ['PS5', 'PS4', 'Xbox Series X/S', 'Xbox One', 'PC (EA App)'],
    modos: ['Ultimate Team', 'Volta Football', 'Carrera', 'Partido Amistoso'],
    tiempos: ['6 min', '8 min', '10 min', '12 min'],
    dificultades: ['Leyenda', 'Ultimate', 'Mundo', 'Aficionado'],
    extras: [
      { id: 'handicap', label: 'Sin Handicap' },
      { id: 'custom_tactics', label: 'Tácticas libres' },
      { id: 'divisions_only', label: 'Solo modo Divisiones' },
    ],
    formatos: ['1vs1', 'Grupos + Playoffs', 'Liga todos vs todos', 'Copa eliminación directa', 'Bracket'],
  },
  fc25: {
    plataformas: ['PS5', 'PS4', 'Xbox Series X/S', 'Xbox One', 'PC (EA App)'],
    modos: ['Ultimate Team', 'Volta Football', 'Carrera', 'Partido Amistoso'],
    tiempos: ['6 min', '8 min', '10 min', '12 min'],
    dificultades: ['Leyenda', 'Ultimate', 'Mundo', 'Aficionado'],
    extras: [
      { id: 'handicap', label: 'Sin Handicap' },
      { id: 'custom_tactics', label: 'Tácticas libres' },
    ],
    formatos: ['1vs1', 'Grupos + Playoffs', 'Liga todos vs todos', 'Copa eliminación directa', 'Bracket'],
  },
  efootball: {
    plataformas: ['PS5', 'PS4', 'Xbox Series X/S', 'Xbox One', 'PC (Steam)', 'Mobile (iOS/Android)'],
    modos: ['Dream Team', 'Club de Fútbol', 'Partido Rápido', 'eFootball Liga'],
    tiempos: ['10 min', '15 min', '20 min'],
    divisiones: ['Sin restricción', 'Div 1', 'Div 2', 'Div 3', 'Div 4+'],
    extras: [
      { id: 'no_OP', label: 'Sin jugadores OP/TOTY' },
      { id: 'balanced_team', label: 'Equipo balanceado' },
      { id: 'same_nation', label: 'Solo jugadores de misma nación' },
      { id: 'squad_cost', label: 'Límite de costo de plantel' },
    ],
    formatos: ['1vs1', 'Grupos + Playoffs', 'Liga todos vs todos', 'Copa eliminación directa', 'Bracket'],
  },
  cs2: {
    plataformas: ['PC (Steam)'],
    mapas: ['Dust2', 'Mirage', 'Inferno', 'Overpass', 'Cache', 'Nuke', 'Train', 'Vertigo', 'Anubis', 'Ancient'],
    rondas: ['MR12 (Competitive)', 'MR15', 'MR24 (Long)'],
    formatos: ['5vs5', '2vs2', '1vs1 (Pistola)', '3vs3'],
    extras: [
      { id: 'knife_round', label: 'Ronda de cuchillo' },
      { id: 'overtime', label: 'Con overtime' },
      { id: 'eco_round', label: 'Ronda económica inicial' },
    ],
  },
  valorant: {
    plataformas: ['PC'],
    mapas: ['Abyss', 'Ascent', 'Bind', 'Fracture', 'Haven', 'Icebox', 'Lotus', 'Pearl', 'Split', 'Sunset'],
    modos: ['Competitivo', 'No Ranked', 'Deathmatch'],
    formatos: ['5vs5', '2vs2 (Retake)', '1vs1'],
    extras: [
      { id: 'agent_ban', label: 'Baneo de agentes' },
      { id: 'map_veto', label: 'Veto de mapa' },
    ],
  },
  warzone: {
    plataformas: ['PS5', 'PS4', 'Xbox', 'PC'],
    modos: ['Battle Royale', 'Resurgimiento', 'Plunder', 'Bunker Royale'],
    formatos: ['Solo', 'Duo', 'Trío', 'Squad (4)'],
    mapas: ['Verdansk', 'Rebirth Island', 'Fortune\'s Keep', 'Urzikstan'],
    extras: [
      { id: 'kill_points', label: 'Puntos por eliminaciones' },
      { id: 'placement_points', label: 'Puntos por posición' },
    ],
  },
  pubg: {
    plataformas: ['PC (Steam)', 'PS4/PS5', 'Xbox', 'Mobile'],
    mapas: ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Karakin', 'Paramo', 'Deston'],
    perspectivas: ['FPP (Primera persona)', 'TPP (Tercera persona)'],
    formatos: ['Solo', 'Duo', 'Squad (4)'],
    extras: [
      { id: 'kill_points', label: 'Puntos por eliminaciones' },
      { id: 'zone_points', label: 'Puntos por zona' },
    ],
  },
  clashroyale: {
    plataformas: ['Mobile (iOS/Android)'],
    nivelesMax: ['Nivel 9', 'Nivel 11', 'Nivel 14 (Evoluciones ON)', 'Nivel 14 (Evoluciones OFF)'],
    formatos: ['1vs1 Normal', '1vs1 Doble Elixir', 'Best of 3', 'Best of 5'],
    extras: [
      { id: 'no_pass', label: 'Sin Pass Royale requerido' },
      { id: 'deck_submit', label: 'Mazo enviado antes' },
      { id: 'card_ban', label: 'Cartas baneadas' },
    ],
  },
  freef: {
    plataformas: ['Mobile (iOS/Android)'],
    modos: ['Battle Royale', 'Clash Squad', 'Lone Wolf'],
    formatos: ['Solo', 'Duo', 'Squad (4)'],
    mapas: ['Bermuda', 'Purgatory', 'Kalahari', 'Alpyne'],
    extras: [
      { id: 'kill_points', label: 'Puntos por eliminaciones' },
    ],
  },
  fortnite: {
    plataformas: ['PC', 'PS5', 'PS4', 'Xbox', 'Switch', 'Mobile'],
    modos: ['Battle Royale', 'Zero Build', 'Creativo', 'LEGO Fortnite'],
    formatos: ['Solo', 'Duo', 'Trío', 'Squad (4)'],
    extras: [
      { id: 'kill_points', label: 'Puntos por eliminaciones' },
      { id: 'placement_points', label: 'Puntos por posición' },
      { id: 'no_build', label: 'Zero Build obligatorio' },
    ],
  },
  rocketleague: {
    plataformas: ['PC (Epic)', 'PS5', 'PS4', 'Xbox', 'Switch'],
    modos: ['Soccar', 'Hoops', 'Rumble', 'Dropshot', 'Snow Day'],
    formatos: ['1vs1', '2vs2', '3vs3'],
    extras: [
      { id: 'no_boost', label: 'Sin boost ilimitado' },
    ],
  },
  otro: {
    plataformas: ['PC', 'PS5', 'PS4', 'Xbox', 'Mobile', 'Switch', 'Multiplataforma'],
    formatos: ['1vs1', '2vs2', 'Equipos', 'Liga', 'Copa', 'Bracket', 'Grupos + Playoffs'],
  },
}

const FORMATS = ['1vs1', '2vs2', 'Equipos', 'Liga', 'Copa', 'Bracket', 'Grupos + Playoffs']

// ── Plan check — community plan free for all during beta ─────────────────────
function usePlan(profile) {
  const plan = profile?.plan || 'community'
  const role = profile?.role || 'member'
  const isCommunity = plan === 'community' || plan === 'vip' || role === 'ceo' || role === 'organizador'
  return { isCommunity, plan, role }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function LockOverlay({ onRequest }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      background: `${C.bg}cc`, backdropFilter: 'blur(6px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
      borderRadius: 16,
    }}>
      <div style={{ fontSize: 36 }}>🔒</div>
      <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: 0, textAlign: 'center' }}>Requiere Plan Comunidad</p>
      <p style={{ color: C.textDim, fontSize: 12, margin: 0, textAlign: 'center', maxWidth: 220 }}>Activá el plan gratis para acceder a todas las herramientas de comunidad.</p>
      <button onClick={onRequest} style={{
        background: C.green, border: 'none', borderRadius: 10,
        color: C.bg, fontWeight: 700, fontSize: 13,
        padding: '10px 20px', cursor: 'pointer',
        boxShadow: `0 4px 16px ${C.green}44`,
      }}>Activar gratis</button>
    </div>
  )
}

function SectionHeader({ icon, title, desc }) {
  return (
    <div style={{ padding: '0 0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div>
          <p style={{ margin: 0, color: C.text, fontWeight: 800, fontSize: 16 }}>{title}</p>
          {desc && <p style={{ margin: '2px 0 0', color: C.textDim, fontSize: 12 }}>{desc}</p>}
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, desc, color = C.green, onClick, comingSoon }) {
  return (
    <button onClick={onClick} disabled={comingSoon} style={{
      background: C.panel, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: '14px 16px',
      cursor: comingSoon ? 'default' : 'pointer',
      textAlign: 'left', width: '100%',
      display: 'flex', alignItems: 'flex-start', gap: 12,
      transition: 'border-color .15s',
      opacity: comingSoon ? 0.6 : 1,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: `${color}18`, border: `1px solid ${color}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{title}</span>
          {comingSoon && <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', background: '#f59e0b18', border: '1px solid #f59e0b44', borderRadius: 6, padding: '1px 6px' }}>PRÓXIMO</span>}
        </div>
        <p style={{ margin: '3px 0 0', color: C.textDim, fontSize: 12, lineHeight: 1.4 }}>{desc}</p>
      </div>
      {!comingSoon && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 4 }}>
          <path d="M9 18l6-6-6-6"/>
        </svg>
      )}
    </button>
  )
}

// ── Rankings (real-time from DB) ──────────────────────────────────────────────
function RankingsSection() {
  const [rankType, setRankType] = useState('general')
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const MEDAL_COLORS = ['#f59e0b', '#94a3b8', '#b45309']

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('users')
        .select('id, display_name, username, avatar_url, stats_wins, stats_victories, stats_matches, stats_goals, stats_tournaments')
        .order('stats_wins', { ascending: false })
        .limit(50)
      setPlayers(data || [])
      setLoading(false)
    }
    load()

    // Realtime subscription
    const channel = supabase.channel('rankings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const ranked = players.filter(p => (p.stats_wins || 0) > 0 || (p.stats_tournaments || 0) > 0)

  const TYPES = [
    { id: 'general', label: '🌍 General' },
    { id: 'victorias', label: '✅ Victorias' },
    { id: 'torneos', label: '🏆 Torneos' },
    { id: 'goles', label: '⚽ Goles' },
  ]

  const sorted = [...ranked].sort((a, b) => {
    if (rankType === 'victorias') return (b.stats_victories || 0) - (a.stats_victories || 0)
    if (rankType === 'torneos')   return (b.stats_tournaments || 0) - (a.stats_tournaments || 0)
    if (rankType === 'goles')     return (b.stats_goals || 0) - (a.stats_goals || 0)
    return (b.stats_wins || 0) - (a.stats_wins || 0)
  })

  function getScore(p) {
    if (rankType === 'victorias') return p.stats_victories || 0
    if (rankType === 'torneos')   return p.stats_tournaments || 0
    if (rankType === 'goles')     return p.stats_goals || 0
    return p.stats_wins || 0
  }

  function getSubline(p) {
    return `🏆 ${p.stats_tournaments || 0} torneos · ✅ ${p.stats_victories || 0} victorias · ⚽ ${p.stats_goals || 0} goles`
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {TYPES.map(t => (
          <button key={t.id} onClick={() => setRankType(t.id)} style={{
            background: rankType === t.id ? `${C.green}20` : C.panel2,
            border: `1px solid ${rankType === t.id ? C.green : C.border}`,
            borderRadius: 20, color: rankType === t.id ? C.green : C.text2,
            fontSize: 12, padding: '5px 12px', cursor: 'pointer',
            fontWeight: rankType === t.id ? 700 : 400,
          }}>{t.label}</button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 62, background: C.panel, borderRadius: 12 }} />)}
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textDim }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
          <p style={{ margin: 0, fontSize: 14 }}>Aún no hay jugadores con estadísticas.</p>
          <p style={{ margin: '4px 0 0', fontSize: 12 }}>Jugá torneos para aparecer en el ranking.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((p, i) => {
          const pos = i + 1
          const color = pos <= 3 ? MEDAL_COLORS[pos - 1] : C.textDim
          const score = getScore(p)
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: pos <= 3 ? `${color}10` : C.panel,
              border: `1px solid ${pos <= 3 ? color + '33' : C.border}`,
              borderRadius: 12, padding: '12px 14px',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: pos <= 3 ? `${color}22` : C.panel2,
                border: `1.5px solid ${pos <= 3 ? color : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 14, color: pos <= 3 ? color : C.textDim,
              }}>{pos <= 3 ? ['🥇','🥈','🥉'][pos-1] : pos}</div>
              {p.avatar_url
                ? <img src={p.avatar_url} alt={p.display_name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: C.panel2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: C.text }}>{(p.display_name || '?').slice(0,2).toUpperCase()}</div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.display_name || p.username}</div>
                <div style={{ color: C.textDim, fontSize: 11, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getSubline(p)}</div>
              </div>
              <div style={{ color: pos <= 3 ? color : C.text, fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{score.toLocaleString()}</div>
            </div>
          )
        })}
      </div>

      {!loading && (
        <p style={{ textAlign: 'center', color: C.textDim, fontSize: 11, margin: '12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block', animation: 'pulse 2s infinite' }} />
          Rankings en tiempo real · {sorted.length} jugadores
        </p>
      )}
    </div>
  )
}

// ── Tournament Management Panel ───────────────────────────────────────────────
function TournamentPanel({ tournament, profile, onClose }) {
  const [tab, setTab] = useState('participantes')
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [tStatus, setTStatus] = useState(tournament.status || 'inscripcion')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('conversation_members')
        .select('user_id, users(display_name, username, avatar_url)')
        .eq('conversation_id', tournament.id)
      setParticipants(data || [])
      setLoading(false)
    }
    load()
  }, [tournament.id])

  async function handleStart() {
    if (participants.length < 2) { alert('Necesitás al menos 2 participantes para iniciar.'); return }
    setStarting(true)
    const { data, error } = await supabase.rpc('start_tournament', { p_tournament_id: tournament.id })
    setStarting(false)
    if (error || data?.ok === false) { alert(data?.error || error?.message || 'Error al iniciar'); return }
    setTStatus('en_curso')
    setTab(tournament.group_type === 'liga' ? 'liga' : 'brackets')
  }

  const isCreator = tournament.created_by === profile?.id
  const isLiga = tournament.group_type === 'liga'
  const playerNames = participants.map(p => p.users?.display_name || p.users?.username || 'Jugador')
  const playerIds = participants.map(p => p.user_id)

  const TABS = [
    { id: 'participantes', icon: '👥', label: 'Jugadores' },
    { id: 'brackets',      icon: '🔱', label: 'Brackets'  },
    { id: 'liga',          icon: '📋', label: 'Liga'      },
    { id: 'sorteo',        icon: '🎲', label: 'Sorteo'    },
  ]

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 600, height: '90vh',
        background: C.bg, borderRadius: '20px 20px 0 0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 0', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, color: C.text, fontWeight: 800, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tournament.name}</p>
              <p style={{ margin: 0, color: C.textDim, fontSize: 11 }}>{tournament.description}</p>
            </div>
          </div>
          {isCreator && tStatus === 'inscripcion' && (
            <button
              onClick={handleStart}
              disabled={starting || participants.length < 2}
              style={{
                width: '100%', marginBottom: 8, padding: '10px',
                background: starting || participants.length < 2 ? C.panel2 : C.green,
                color: starting || participants.length < 2 ? C.textDim : C.bg,
                border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14,
                cursor: starting || participants.length < 2 ? 'default' : 'pointer',
              }}
            >
              {starting ? '⏳ Iniciando...' : `🚀 Iniciar ${isLiga ? 'Liga' : 'Torneo'} (${participants.length} jugadores)`}
            </button>
          )}
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, padding: '9px 4px', background: 'none', border: 'none',
                borderBottom: `2.5px solid ${tab === t.id ? C.green : 'transparent'}`,
                color: tab === t.id ? C.green : C.textDim,
                fontSize: 11, fontWeight: tab === t.id ? 700 : 500,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>{t.icon} {t.label}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Participantes */}
          {tab === 'participantes' && (
            <div style={{ padding: 16 }}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1,2,3].map(i => <div key={i} style={{ height: 56, background: C.panel, borderRadius: 12 }} />)}
                </div>
              ) : participants.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textDim }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
                  <p style={{ margin: 0, fontSize: 14 }}>Sin participantes aún</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12 }}>Los jugadores se inscriben con el botón "⚔️ Inscribirse"</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ margin: '0 0 10px', color: C.textDim, fontSize: 12, fontWeight: 700 }}>
                    {participants.length} participante{participants.length !== 1 ? 's' : ''} inscripto{participants.length !== 1 ? 's' : ''}
                  </p>
                  {participants.map((p, i) => {
                    const u = p.users || {}
                    const name = u.display_name || u.username || 'Jugador'
                    return (
                      <div key={p.user_id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: C.panel, borderRadius: 12,
                        border: `1px solid ${C.border}`, padding: '10px 14px',
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: C.panel2, border: `1px solid ${C.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800, color: C.textDim,
                        }}>{i + 1}</div>
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt={name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          : <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: `${C.green}20`, border: `1px solid ${C.green}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: C.green }}>{name.slice(0,2).toUpperCase()}</div>
                        }
                        <div style={{ flex: 1 }}>
                          <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{name}</div>
                          {u.username && <div style={{ color: C.textDim, fontSize: 11 }}>@{u.username}</div>}
                        </div>
                        {p.user_id === tournament.created_by && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}33` }}>Organizador</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Brackets */}
          {tab === 'brackets' && (
            <BracketsPage
              onBack={() => setTab('participantes')}
              initialPlayers={playerNames}
              tournamentId={tournament.id}
              isOrganizer={isCreator}
            />
          )}

          {/* Liga */}
          {tab === 'liga' && (
            <TablaPosicionesPage
              onBack={() => setTab('participantes')}
              initialTeams={playerNames}
              tournamentId={tournament.id}
              isOrganizer={isCreator}
            />
          )}

          {/* Sorteo */}
          {tab === 'sorteo' && (
            <SorteoPage onBack={() => setTab('participantes')} initialPlayers={playerNames} />
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Confirm Dialog (portal) ───────────────────────────────────────────────────
function ConfirmDialog({ dialog, onClose }) {
  if (!dialog) return null
  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.panel, borderRadius: 20, padding: 24,
        maxWidth: 320, width: '100%', border: `1px solid ${C.border}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <p style={{ color: C.text, fontWeight: 800, fontSize: 16, margin: '0 0 8px' }}>{dialog.title}</p>
        <p style={{ color: C.textDim, fontSize: 13, margin: '0 0 20px', lineHeight: 1.5 }}>{dialog.message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px', borderRadius: 12, border: `1px solid ${C.border}`,
            background: C.panel2, color: C.text, fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={() => { dialog.onConfirm(); onClose() }} style={{
            flex: 1, padding: '11px', borderRadius: 12, border: 'none',
            background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>Eliminar</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Tournaments List ──────────────────────────────────────────────────────────
const TYPE_CFG = {
  tournament: { icon: '🏆', label: 'Torneo' },
  liga:       { icon: '📋', label: 'Liga' },
  clan:       { icon: '⚔️', label: 'Clanes' },
  bracket:    { icon: '🔱', label: 'Bracket' },
}

function TournamentsList({ profile }) {
  const { setActiveConversation } = useChatStore()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [managingTournament, setManagingTournament] = useState(null)

  // Create form state
  const [tType,       setTType]       = useState('tournament')
  const [tGameId,     setTGameId]     = useState('fc26')
  const [tName,       setTName]       = useState('')
  const [tMaxPl,      setTMaxPl]      = useState('16')
  const [tDeadline,   setTDeadline]   = useState('')
  const [tFormat,     setTFormat]     = useState('1vs1')
  const [tPlataforma, setTPlataforma] = useState('')
  const [tModo,       setTModo]       = useState('')
  const [tTiempo,     setTTiempo]     = useState('')
  const [tExtras,     setTExtras]     = useState([])
  const [tMapas,      setTMapas]      = useState([])
  const [tNivelMax,   setTNivelMax]   = useState('')
  const [tDivision,   setTDivision]   = useState('')
  const [tRondas,     setTRondas]     = useState('')
  const [tPerspectiva,setTPerspectiva]= useState('')
  const [tReglas,     setTReglas]     = useState('')

  const gameCfg = GAME_CONFIG[tGameId] || GAME_CONFIG.otro
  const gameInfo = GAME_CATALOG.find(g => g.id === tGameId) || GAME_CATALOG[GAME_CATALOG.length - 1]

  function resetCreate() {
    setTType('tournament'); setTGameId('fc26'); setTName(''); setTMaxPl('16')
    setTDeadline(''); setTFormat('1vs1'); setTPlataforma(''); setTModo('')
    setTTiempo(''); setTExtras([]); setTMapas([]); setTNivelMax('')
    setTDivision(''); setTRondas(''); setTPerspectiva(''); setTReglas('')
  }

  function toggleExtra(id) {
    setTExtras(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleMapa(m) {
    setTMapas(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  useEffect(() => { loadTournaments() }, [profile?.id])

  async function loadTournaments() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('conversations')
      .select('id, name, description, created_at, created_by, group_type, status, game, format, max_participants, is_public')
      .in('group_type', ['tournament', 'liga'])
      .order('created_at', { ascending: false })

    if (rows) {
      // single query for all member counts
      const ids = rows.map(r => r.id)
      const { data: counts } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .in('conversation_id', ids)
      const countMap = {}
      ;(counts || []).forEach(c => { countMap[c.conversation_id] = (countMap[c.conversation_id] || 0) + 1 })
      setTournaments(rows.map(t => ({ ...t, memberCount: countMap[t.id] || 0 })))
    }
    setLoading(false)
  }

  async function handleCreate() {
    if (!tName.trim()) return
    setCreating(true)
    try {
      const typeLabel = TYPE_CFG[tType]?.label || 'Torneo'
      const parts = [
        typeLabel,
        gameInfo.label,
        tFormat,
        tPlataforma,
        tModo,
        tTiempo,
        tNivelMax,
        tDivision,
        tRondas,
        tPerspectiva,
        tMapas.length > 0 ? `Mapas: ${tMapas.join(', ')}` : '',
        tExtras.length > 0 ? tExtras.map(id => gameCfg.extras?.find(e => e.id === id)?.label).filter(Boolean).join(' · ') : '',
        `Hasta ${tMaxPl} jugadores`,
        tDeadline ? `Cierre: ${tDeadline}` : '',
        tReglas ? `Reglamento: ${tReglas}` : '',
      ].filter(Boolean)
      const desc = parts.join(' · ')

      const dbGroupType = tType === 'liga' ? 'liga' : 'tournament'
      const { data: convId, error: rpcErr } = await supabase.rpc('create_group_with_owner', {
        p_name:        tName.trim(),
        p_is_group:    true,
        p_group_type:  dbGroupType,
        p_description: desc,
        p_created_by:  profile.id,
      })
      if (rpcErr) throw rpcErr

      // store structured fields in new columns
      await supabase.from('conversations').update({
        game:             tGameId,
        format:           tFormat,
        max_participants: parseInt(tMaxPl) || null,
        registration_deadline: tDeadline ? new Date(tDeadline).toISOString() : null,
      }).eq('id', convId)

      await supabase.from('topics').insert([
        { conversation_id: convId, name: 'Anuncios',   emoji: '📢', topic_type: 'announcements', position: 0 },
        { conversation_id: convId, name: 'Chat',       emoji: '💬', topic_type: 'chat',          position: 1 },
        { conversation_id: convId, name: 'Resultados', emoji: '📸', topic_type: 'chat',          position: 2 },
      ])

      await supabase.from('messages').insert({
        conversation_id: convId, sender_id: profile.id, type: 'system',
        content: `${TYPE_CFG[tType]?.icon || '🏆'} ${typeLabel} "${tName.trim()}" creado · ${gameInfo.label} · ${tFormat}`,
      })

      await loadTournaments()
      setShowCreate(false)
      resetCreate()
    } catch (e) { alert(`Error al crear: ${e.message}`) }
    setCreating(false)
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    const myTournaments = filtered.filter(t => t.created_by === profile?.id)
    setSelected(new Set(myTournaments.map(t => t.id)))
  }

  async function doDeleteIds(ids) {
    const { error } = await supabase.rpc('delete_tournaments', { tournament_ids: ids })
    console.log('[delete_tournaments]', { ids, error })
    if (error) { alert(`Error: ${error.message}`); return }
    setSelected(new Set())
    setSelectMode(false)
    await loadTournaments()
  }

  function handleDeleteTournament(t) {
    setConfirmDialog({
      title: '¿Eliminar torneo?',
      message: `"${t.name}" será eliminado permanentemente. Esta acción no se puede deshacer.`,
      onConfirm: () => doDeleteIds([t.id]),
    })
  }

  function handleDeleteSelected() {
    const ids = [...selected]
    setConfirmDialog({
      title: `¿Eliminar ${ids.length} torneo${ids.length > 1 ? 's' : ''}?`,
      message: 'Los torneos seleccionados serán eliminados permanentemente.',
      onConfirm: () => doDeleteIds(ids),
    })
  }

  function handleDeleteAll() {
    const myIds = filtered.filter(t => t.created_by === profile?.id).map(t => t.id)
    if (myIds.length === 0) return
    setConfirmDialog({
      title: '¿Eliminar todos?',
      message: `Se eliminarán ${myIds.length} torneo${myIds.length > 1 ? 's' : ''} creados por vos.`,
      onConfirm: () => doDeleteIds(myIds),
    })
  }

  async function joinTournament(id) {
    const already = await supabase.from('conversation_members').select('conversation_id')
      .eq('conversation_id', id).eq('user_id', profile.id).maybeSingle()
    if (already.data) {
      setActiveConversation({ id, isGroup: true, isTournament: true, name: tournaments.find(t => t.id === id)?.name })
      return
    }
    const { data, error } = await supabase.rpc('join_tournament', { p_tournament_id: id })
    if (error || data?.ok === false) {
      alert(data?.error || error?.message || 'Error al inscribirse')
      return
    }
    alert('¡Inscripto!')
    await loadTournaments()
  }

  const filtered = filter === 'all' ? tournaments : tournaments.filter(t => t.status === filter)
  const maxPlayers = getMaxParticipants(profile)
  const inp = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: '10px 12px', outline: 'none', width: '100%', boxSizing: 'border-box' }
  const labelSt = { margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1px', textTransform: 'uppercase' }
  const myTournamentsCount = filtered.filter(t => t.created_by === profile?.id).length

  return (
    <div>
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
      {managingTournament && (
        <TournamentPanel
          tournament={managingTournament}
          profile={profile}
          onClose={() => setManagingTournament(null)}
        />
      )}

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[{ id: 'all', label: 'Todos' }, { id: 'inscripcion', label: '🟢 Abiertos' }, { id: 'en_curso', label: '🟡 En curso' }].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              background: filter === f.id ? `${C.green}20` : C.panel2,
              border: `1px solid ${filter === f.id ? C.green : C.border}`,
              borderRadius: 20, color: filter === f.id ? C.green : C.text2,
              fontSize: 12, padding: '4px 12px', cursor: 'pointer',
              fontWeight: filter === f.id ? 700 : 400,
            }}>{f.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {myTournamentsCount > 0 && !showCreate && (
            <button onClick={() => { setSelectMode(v => !v); setSelected(new Set()) }} style={{
              background: selectMode ? `#ef444418` : C.panel2,
              border: `1px solid ${selectMode ? '#ef4444' : C.border}`,
              borderRadius: 10, color: selectMode ? '#ef4444' : C.textDim,
              fontSize: 13, padding: '8px 10px', cursor: 'pointer',
            }}>☑️</button>
          )}
          {myTournamentsCount > 0 && !showCreate && !selectMode && (
            <button onClick={handleDeleteAll} style={{
              background: '#ef444412', border: '1px solid #ef444430',
              borderRadius: 10, color: '#ef4444',
              fontSize: 12, fontWeight: 700, padding: '8px 12px', cursor: 'pointer',
            }}>🗑️ Todos</button>
          )}
          <button onClick={() => { setShowCreate(v => !v); setSelectMode(false) }} style={{
            background: showCreate ? `${C.green}22` : C.green,
            border: 'none', borderRadius: 10,
            color: showCreate ? C.green : C.bg,
            fontSize: 13, fontWeight: 700, padding: '8px 16px', cursor: 'pointer',
          }}>{showCreate ? '✕ Cancelar' : '+ Crear'}</button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ margin: 0, color: C.green, fontWeight: 800, fontSize: 15 }}>🏆 Nueva competencia</p>
            {(() => { const cfg = getRoleCfg(profile?.role || 'member'); return (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44` }}>
                {cfg.icon} Máx. {maxPlayers} jugadores
              </span>
            )})()}
          </div>

          {/* Tipo */}
          <div>
            <p style={labelSt}>Tipo de competencia</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(TYPE_CFG).map(([key, cfg]) => (
                <button key={key} onClick={() => setTType(key)} type="button" style={{
                  background: tType === key ? `${C.green}20` : C.panel,
                  border: `1.5px solid ${tType === key ? C.green : C.border}`,
                  borderRadius: 10, color: tType === key ? C.green : C.text2,
                  fontSize: 12, fontWeight: 700, padding: '7px 13px', cursor: 'pointer',
                }}>{cfg.icon} {cfg.label}</button>
              ))}
            </div>
          </div>

          {/* Juego */}
          <div>
            <p style={labelSt}>Juego</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))', gap: 7 }}>
              {GAME_CATALOG.map(g => (
                <button key={g.id}
                  disabled={g.soon}
                  onClick={() => { if (!g.soon) { setTGameId(g.id); setTPlataforma(''); setTModo(''); setTTiempo(''); setTExtras([]); setTMapas([]); setTFormat('1vs1') } }}
                  style={{
                    background: tGameId === g.id ? `${g.color}20` : C.panel,
                    border: `1.5px solid ${tGameId === g.id ? g.color : C.border}`,
                    borderRadius: 10, padding: '8px 6px',
                    cursor: g.soon ? 'default' : 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    opacity: g.soon ? 0.55 : 1, position: 'relative',
                  }}>
                  <span style={{ fontSize: 20 }}>{g.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: tGameId === g.id ? g.color : C.textDim, textAlign: 'center', lineHeight: 1.2 }}>{g.label}</span>
                  {g.soon && <span style={{ fontSize: 8, fontWeight: 800, color: '#f59e0b', background: '#f59e0b18', border: '1px solid #f59e0b44', borderRadius: 4, padding: '1px 4px', lineHeight: 1.4 }}>PRONTO</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Nombre */}
          <div>
            <p style={labelSt}>Nombre de la competencia *</p>
            <input value={tName} onChange={e => setTName(e.target.value)}
              placeholder={`Ej: Copa ${gameInfo.label} ${new Date().getFullYear()}`}
              style={inp} />
          </div>

          {/* Plataforma + Formato */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {gameCfg.plataformas && (
              <div>
                <p style={labelSt}>Plataforma</p>
                <select value={tPlataforma} onChange={e => setTPlataforma(e.target.value)} style={inp}>
                  <option value="">Todas</option>
                  {gameCfg.plataformas.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}
            <div>
              <p style={labelSt}>Formato</p>
              <select value={tFormat} onChange={e => setTFormat(e.target.value)} style={inp}>
                {(gameCfg.formatos || FORMATS).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          {/* Modo + Tiempo (FC/eFootball) */}
          {(gameCfg.modos || gameCfg.tiempos) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {gameCfg.modos && (
                <div>
                  <p style={labelSt}>Modo de juego</p>
                  <select value={tModo} onChange={e => setTModo(e.target.value)} style={inp}>
                    <option value="">Cualquier modo</option>
                    {gameCfg.modos.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}
              {gameCfg.tiempos && (
                <div>
                  <p style={labelSt}>Tiempo de partido</p>
                  <select value={tTiempo} onChange={e => setTTiempo(e.target.value)} style={inp}>
                    <option value="">Libre</option>
                    {gameCfg.tiempos.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* División (eFootball) */}
          {gameCfg.divisiones && (
            <div>
              <p style={labelSt}>División mínima requerida</p>
              <select value={tDivision} onChange={e => setTDivision(e.target.value)} style={inp}>
                {gameCfg.divisiones.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          {/* Rondas (CS2) */}
          {gameCfg.rondas && (
            <div>
              <p style={labelSt}>Sistema de rondas</p>
              <select value={tRondas} onChange={e => setTRondas(e.target.value)} style={inp}>
                <option value="">Por defecto</option>
                {gameCfg.rondas.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          {/* Perspectiva (PUBG) */}
          {gameCfg.perspectivas && (
            <div>
              <p style={labelSt}>Perspectiva</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {gameCfg.perspectivas.map(p => (
                  <button key={p} onClick={() => setTPerspectiva(p)} style={{
                    flex: 1, padding: '8px', borderRadius: 10, cursor: 'pointer',
                    background: tPerspectiva === p ? `${C.green}20` : C.panel,
                    border: `1.5px solid ${tPerspectiva === p ? C.green : C.border}`,
                    color: tPerspectiva === p ? C.green : C.textDim, fontSize: 12, fontWeight: 600,
                  }}>{p}</button>
                ))}
              </div>
            </div>
          )}

          {/* Nivel máximo (Clash Royale) */}
          {gameCfg.nivelesMax && (
            <div>
              <p style={labelSt}>Nivel máximo de cartas</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {gameCfg.nivelesMax.map(n => (
                  <button key={n} onClick={() => setTNivelMax(n)} style={{
                    padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
                    background: tNivelMax === n ? `${C.green}20` : C.panel,
                    border: `1.5px solid ${tNivelMax === n ? C.green : C.border}`,
                    color: tNivelMax === n ? C.green : C.textDim, fontSize: 12, fontWeight: 600,
                  }}>{n}</button>
                ))}
              </div>
            </div>
          )}

          {/* Mapas (CS2, Valorant, PUBG, etc.) */}
          {gameCfg.mapas && (
            <div>
              <p style={labelSt}>Mapas habilitados {tMapas.length > 0 && `(${tMapas.length} sel.)`}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {gameCfg.mapas.map(m => (
                  <button key={m} onClick={() => toggleMapa(m)} style={{
                    padding: '5px 11px', borderRadius: 20, cursor: 'pointer',
                    background: tMapas.includes(m) ? `${C.green}20` : C.panel,
                    border: `1.5px solid ${tMapas.includes(m) ? C.green : C.border}`,
                    color: tMapas.includes(m) ? C.green : C.textDim, fontSize: 12,
                  }}>{m}</button>
                ))}
              </div>
            </div>
          )}

          {/* Extras/Reglas especiales */}
          {gameCfg.extras && gameCfg.extras.length > 0 && (
            <div>
              <p style={labelSt}>Reglas especiales</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {gameCfg.extras.map(ex => (
                  <button key={ex.id} onClick={() => toggleExtra(ex.id)} style={{
                    padding: '9px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    background: tExtras.includes(ex.id) ? `${C.green}14` : C.panel,
                    border: `1.5px solid ${tExtras.includes(ex.id) ? C.green : C.border}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      background: tExtras.includes(ex.id) ? C.green : 'transparent',
                      border: `2px solid ${tExtras.includes(ex.id) ? C.green : C.textDim}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {tExtras.includes(ex.id) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <span style={{ color: tExtras.includes(ex.id) ? C.green : C.text, fontSize: 13, fontWeight: 600 }}>{ex.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Jugadores + Fecha */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <p style={labelSt}>Máx. participantes</p>
              <input value={tMaxPl} onChange={e => setTMaxPl(e.target.value)} type="number" min="2" max={maxPlayers} style={inp} />
            </div>
            <div>
              <p style={labelSt}>Fecha de cierre</p>
              <input value={tDeadline} onChange={e => setTDeadline(e.target.value)} type="date" style={inp} />
            </div>
          </div>

          {/* Reglamento */}
          <div>
            <p style={labelSt}>Reglamento / Reglas adicionales</p>
            <textarea value={tReglas} onChange={e => setTReglas(e.target.value)}
              placeholder="Ej: Prohibido el uso de glitches. Los resultados deben enviarse con captura de pantalla dentro de las 24hs. En caso de desconexión se repite el partido. Faltas: 1er aviso → advertencia, 2da → descalificación..."
              rows={4}
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </div>

          {/* Submit */}
          <button onClick={handleCreate} disabled={creating || !tName.trim()} style={{
            background: creating || !tName.trim() ? C.panel2 : C.green, border: 'none',
            borderRadius: 12, color: creating || !tName.trim() ? C.textDim : C.bg,
            fontWeight: 800, fontSize: 15, padding: '14px', cursor: creating || !tName.trim() ? 'default' : 'pointer',
            boxShadow: !creating && tName.trim() ? `0 4px 20px ${C.green}44` : 'none',
          }}>{creating ? 'Creando...' : `${TYPE_CFG[tType]?.icon} Crear ${TYPE_CFG[tType]?.label} de ${gameInfo.label}`}</button>
        </div>
      )}

      {/* List */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 90, background: C.panel, borderRadius: 16 }} />)}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 40, gap: 10 }}>
          <span style={{ fontSize: 44 }}>🏆</span>
          <p style={{ color: C.textDim, fontSize: 14, margin: 0, textAlign: 'center' }}>No hay competencias. ¡Creá la primera!</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(t => {
          const statusCfg = STATUS_CFG[t.status] || STATUS_CFG.inscripcion
          const isCreator = t.created_by === profile?.id
          const isSelected = selected.has(t.id)
          return (
            <div key={t.id} onClick={selectMode && isCreator ? () => toggleSelect(t.id) : undefined}
              style={{
                background: isSelected ? `${C.green}12` : C.panel,
                borderRadius: 16,
                border: `1px solid ${isSelected ? C.green : C.border}`,
                overflow: 'hidden',
                cursor: selectMode && isCreator ? 'pointer' : 'default',
                transition: 'border-color .15s, background .15s',
              }}>
              <div style={{ background: `linear-gradient(135deg, ${C.greenDk}44 0%, transparent 60%)`, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {selectMode && isCreator ? (
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 12,
                    background: isSelected ? C.green : 'transparent',
                    border: `2px solid ${isSelected ? C.green : C.textDim}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: `${C.green}18`, border: `1px solid ${C.green}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏆</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, color: C.text, fontWeight: 800, fontSize: 15 }}>{t.name}</p>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.color}33` }}>{statusCfg.label}</span>
                  </div>
                  {t.description && <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textDim, lineHeight: 1.4 }}>{t.description}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 14, padding: '8px 16px', borderTop: `1px solid ${C.border}22` }}>
                <span style={{ fontSize: 12, color: C.textDim }}>👥 {t.memberCount} participantes</span>
                <span style={{ fontSize: 12, color: C.textDim }}>📅 {new Date(t.created_at).toLocaleDateString('es-AR')}</span>
              </div>
              {!selectMode && (
                <div style={{ display: 'flex', gap: 8, padding: '8px 16px 14px' }}>
                  <button onClick={() => setActiveConversation({ id: t.id, isGroup: true, isTournament: true, name: t.name, description: t.description, members: [] })} style={{
                    flex: 1, padding: '9px', borderRadius: 10,
                    background: `${C.green}18`, border: `1px solid ${C.green}33`,
                    color: C.green, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}>💬 Chat</button>
                  {!isCreator && (
                    <button onClick={() => joinTournament(t.id)} style={{
                      flex: 1, padding: '9px', borderRadius: 10,
                      background: C.green, border: 'none',
                      color: C.bg, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    }}>⚔️ Inscribirse</button>
                  )}
                  {isCreator && (
                    <button onClick={() => setManagingTournament(t)} style={{
                      flex: 1, padding: '9px', borderRadius: 10,
                      background: C.panel2, border: `1px solid ${C.border}`,
                      color: C.text, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    }}>⚙️ Gestionar</button>
                  )}
                  {isCreator && (
                    <button onClick={() => handleDeleteTournament(t)} title="Eliminar" style={{
                      width: 38, padding: '9px', borderRadius: 10, flexShrink: 0,
                      background: '#ef444418', border: '1px solid #ef444430',
                      color: '#ef4444', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    }}>🗑️</button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Select mode bottom bar */}
      {selectMode && (
        <div style={{
          position: 'sticky', bottom: 0, left: 0, right: 0,
          background: C.panel, borderTop: `1px solid ${C.border}`,
          padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center',
          marginTop: 12,
        }}>
          <button onClick={() => { setSelectMode(false); setSelected(new Set()) }} style={{
            padding: '10px 14px', borderRadius: 12, border: `1px solid ${C.border}`,
            background: C.panel2, color: C.text, fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={selectAll} style={{
            flex: 1, padding: '10px', borderRadius: 12, border: `1px solid ${C.border}`,
            background: C.panel2, color: C.text, fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>Sel. todos ({myTournamentsCount})</button>
          <button onClick={handleDeleteSelected} disabled={selected.size === 0} style={{
            flex: 1, padding: '10px', borderRadius: 12, border: 'none',
            background: selected.size > 0 ? '#ef4444' : C.panel2,
            color: selected.size > 0 ? '#fff' : C.textDim,
            fontWeight: 700, fontSize: 13, cursor: selected.size > 0 ? 'pointer' : 'default',
          }}>🗑️ Eliminar {selected.size > 0 ? `(${selected.size})` : ''}</button>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'hub',         icon: '🏠', label: 'Hub'        },
  { id: 'torneos',     icon: '🏆', label: 'Torneos'    },
  { id: 'rankings',    icon: '📊', label: 'Rankings'   },
  { id: 'herramientas',icon: '🛠️', label: 'Herramientas' },
]

const TOOL_COMPONENTS = {
  sorteo:        SorteoPage,
  brackets:      BracketsPage,
  tabla:         TablaPosicionesPage,
  votaciones:    VotacionesPage,
  resultados:    CargaResultadosPage,
  calendario:    CalendarioPage,
  premios:       SistemaPremiosPage,
}

export default function TournamentsPage() {
  const { profile } = useAuthStore()
  const [tab, setTab] = useState('hub')
  const [activeTool, setActiveTool] = useState(null)
  const { isCommunity } = usePlan(profile)

  if (activeTool && TOOL_COMPONENTS[activeTool]) {
    const ToolPage = TOOL_COMPONENTS[activeTool]
    return <ToolPage onBack={() => setActiveTool(null)} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      <style>{`
        .comm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
      `}</style>

      {/* Header */}
      <div style={{ padding: '16px 16px 0', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 24 }}>🏆</span>
          <div>
            <p style={{ margin: 0, color: C.text, fontWeight: 800, fontSize: 18 }}>Torneos & Ligas</p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 11 }}>eFootball · FC 26 · FC 27 · y más</p>
          </div>
          {isCommunity && (
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: `${C.green}14`, color: C.green, border: `1px solid ${C.green}44` }}>
              PRO
            </span>
          )}
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, minWidth: 70, padding: '10px 4px', background: 'none', border: 'none',
              borderBottom: `2.5px solid ${tab === t.id ? C.green : 'transparent'}`,
              color: tab === t.id ? C.green : C.textDim,
              fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
              cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>


      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* ── HUB ── */}
        {tab === 'hub' && (
          <div>

            <SectionHeader icon="🚀" title="Acceso rápido" desc="Tus herramientas de comunidad" />
            <div className="comm-grid" style={{ marginBottom: 20 }}>
              <FeatureCard icon="🏆" title="Crear Torneo" desc="Organizá competencias por eliminación, grupos o liga" color={C.green} onClick={() => setTab('torneos')} />
              <FeatureCard icon="📋" title="Crear Liga" desc="Sistema de puntos con tabla de posiciones" color="#3b82f6" onClick={() => setTab('torneos')} />
              <FeatureCard icon="⚔️" title="Torneo de Clanes" desc="Enfrentá grupos de jugadores organizados en clanes" color="#a855f7" onClick={() => setTab('torneos')} />
              <FeatureCard icon="🎲" title="Sorteo en Vivo" desc="Sorteá enfrentamientos y premios en tiempo real" color="#f59e0b" onClick={() => setActiveTool('sorteo')} />
              <FeatureCard icon="🔱" title="Brackets" desc="Cuadros de eliminación automáticos y visuales" color="#06b6d4" onClick={() => setActiveTool('brackets')} />
              <FeatureCard icon="📊" title="Rankings" desc="Posiciones por zonas, países y plataformas" color={C.green} onClick={() => setTab('rankings')} />
            </div>

            <BannerAd position="torneos" style={{ marginBottom: 16 }} />

            <SectionHeader icon="📢" title="Novedades" desc="Últimas competencias y eventos" />
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '14px 16px' }}>
              <p style={{ color: C.textDim, fontSize: 13, margin: 0, textAlign: 'center' }}>
                Próximamente — feed de actividad de tu comunidad
              </p>
            </div>
          </div>
        )}

        {/* ── TORNEOS ── */}
        {tab === 'torneos' && (
          <div style={{ position: 'relative' }}>
            <SectionHeader icon="🏆" title="Competencias" desc="Torneos, ligas y clanes" />
            <TournamentsList profile={profile} />
          </div>
        )}

        {/* ── RANKINGS ── */}
        {tab === 'rankings' && (
          <div>
            <SectionHeader icon="📊" title="Rankings" desc="Clasificaciones globales y por categoría" />
            <RankingsSection />
          </div>
        )}

        {/* ── HERRAMIENTAS ── */}
        {tab === 'herramientas' && (
          <div>
            {/* Herramientas gratuitas para todos */}
            <SectionHeader icon="🎲" title="Herramientas gratuitas" desc="Disponibles para todos los jugadores" />
            <div className="comm-grid" style={{ marginBottom: 20 }}>
              <FeatureCard icon="🎲" title="Sorteo en Vivo" desc="Sorteá participantes o premios en tiempo real" color="#f59e0b" onClick={() => setActiveTool('sorteo')} />
              <FeatureCard icon="🔱" title="Generador de Brackets" desc="Cuadros de eliminación directa automáticos" color="#06b6d4" onClick={() => setActiveTool('brackets')} />
              <FeatureCard icon="📋" title="Tabla de Posiciones" desc="Seguí el puntaje en tiempo real de tu liga" color="#3b82f6" onClick={() => setActiveTool('tabla')} />
            </div>

            {/* Herramientas avanzadas */}
            <div style={{ position: 'relative' }}>
              <SectionHeader icon="🛠️" title="Herramientas avanzadas" desc="Para organizadores de comunidades" />
              <div className="comm-grid">
                <FeatureCard icon="🗳️" title="Votaciones" desc="Creá encuestas para tu comunidad" color="#a855f7" onClick={() => setActiveTool('votaciones')} />
                <FeatureCard icon="📸" title="Carga de Resultados" desc="Los jugadores suben fotos de sus resultados para validación" color={C.green} onClick={() => setActiveTool('resultados')} />
                <FeatureCard icon="🌍" title="Rankings por Zona" desc="Clasificaciones separadas por país, región o plataforma" color={C.green} onClick={() => setTab('rankings')} />
                <FeatureCard icon="🏅" title="Sistema de Premios" desc="Asigná premios y trofeos a los ganadores de tus torneos" color="#f59e0b" onClick={() => setActiveTool('premios')} />
                <FeatureCard icon="📅" title="Calendario de Eventos" desc="Programá fechas y partidos con recordatorios automáticos" color="#3b82f6" onClick={() => setActiveTool('calendario')} />
              </div>
            </div>

            <div style={{ marginTop: 20, background: `${C.green}10`, border: `1px solid ${C.green}33`, borderRadius: 16, padding: '16px 18px' }}>
              <p style={{ margin: '0 0 4px', color: C.green, fontWeight: 700, fontSize: 14 }}>¿Tenés ideas para nuevas herramientas?</p>
              <p style={{ margin: 0, color: C.textDim, fontSize: 12 }}>Escribinos en el grupo de soporte — estamos construyendo esto con la comunidad.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
