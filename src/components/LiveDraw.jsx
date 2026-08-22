/**
 * LiveDraw — Sorteo en vivo animado estilo bolillero.
 *
 * Props:
 *   tournamentId   uuid      — id del torneo
 *   profile        object    — perfil del usuario actual
 *   isAdmin        boolean   — si puede iniciar el sorteo
 *   numGroups      number    — cantidad de grupos (default 4)
 *   groupNames     string[]  — nombres de grupos (default ['A','B','C','D'…])
 *   classifies     number    — cuántos clasifican por grupo (default 2)
 *   onDrawComplete fn()      — callback cuando termina el sorteo
 *
 * Integración en TournamentDashboard:
 *   import LiveDraw from '../components/LiveDraw'
 *
 *   {(tournament.status === 'inscripcion' || tournament.status === 'sorteo') && (
 *     <LiveDraw
 *       tournamentId={tournament.id}
 *       profile={profile}
 *       isAdmin={isAdmin}
 *       numGroups={4}
 *       groupNames={['A','B','C','D']}
 *       classifies={2}
 *       onDrawComplete={() => refetchTournament()}
 *     />
 *   )}
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useSubscription } from '../hooks/useSubscription'
import { C } from '../theme'

// ── Constantes ────────────────────────────────────────────────────────────────
const GROUP_COLORS = [
  '#22c55e','#3b82f6','#f59e0b','#ef4444',
  '#a78bfa','#06b6d4','#f97316','#ec4899',
  '#84cc16','#14b8a6',
]

const DELAY_PER_EVENT_MS = 1200   // tiempo entre eventos durante la animación
const BOUNCE_DURATION_MS = 600    // duración del bounce al caer en el grupo

// ── CSS inyectado una sola vez ────────────────────────────────────────────────
const DRAW_CSS = `
@keyframes ld-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes ld-spin-rev {
  from { transform: rotate(0deg); }
  to   { transform: rotate(-360deg); }
}
@keyframes ld-float {
  0%,100% { transform: translateY(0px); }
  50%     { transform: translateY(-6px); }
}
@keyframes ld-shake {
  0%,100% { transform: rotate(0deg); }
  20%     { transform: rotate(-4deg); }
  40%     { transform: rotate(4deg); }
  60%     { transform: rotate(-3deg); }
  80%     { transform: rotate(3deg); }
}
@keyframes ld-pop-in {
  0%   { opacity: 0; transform: scale(0.3) translateY(-20px); }
  60%  { transform: scale(1.15) translateY(2px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes ld-ball-fly {
  0%   { opacity: 1; transform: scale(1) translate(0, 0); }
  40%  { transform: scale(1.2) translate(var(--fly-x), calc(var(--fly-y) * 0.4)); }
  100% { opacity: 0; transform: scale(0.5) translate(var(--fly-x), var(--fly-y)); }
}
@keyframes ld-bounce {
  0%   { transform: scale(0.6) translateY(-16px); opacity: 0; }
  50%  { transform: scale(1.15) translateY(2px); opacity: 1; }
  75%  { transform: scale(0.95) translateY(-2px); }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes ld-glow-pulse {
  0%,100% { box-shadow: 0 0 12px var(--glow-color); }
  50%     { box-shadow: 0 0 28px var(--glow-color), 0 0 48px var(--glow-color)88; }
}
@keyframes ld-completed-in {
  0%  { opacity: 0; transform: scale(0.8) translateY(20px); }
  100%{ opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes ld-orbit {
  from { transform: rotate(0deg) translateX(44px) rotate(0deg); }
  to   { transform: rotate(360deg) translateX(44px) rotate(-360deg); }
}
@keyframes ld-orbit2 {
  from { transform: rotate(120deg) translateX(44px) rotate(-120deg); }
  to   { transform: rotate(480deg) translateX(44px) rotate(-480deg); }
}
@keyframes ld-orbit3 {
  from { transform: rotate(240deg) translateX(44px) rotate(-240deg); }
  to   { transform: rotate(600deg) translateX(44px) rotate(-600deg); }
}
`

// ── Helpers ───────────────────────────────────────────────────────────────────
function Avatar({ profile, size = 28, style = {} }) {
  if (profile?.avatar_url) return (
    <img src={profile.avatar_url} alt=""
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...style }} />
  )
  const letter = (profile?.display_name || profile?.username || '?')[0]?.toUpperCase() ?? '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: C.panel2, border: `1.5px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 800, color: C.textDim,
      flexShrink: 0, ...style,
    }}>{letter}</div>
  )
}

// ── Bolillero (SVG + CSS orbital) ─────────────────────────────────────────────
function Bolillero({ spinning, color }) {
  return (
    <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto' }}>
      {/* Esfera exterior */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        border: `3px solid ${color}44`,
        background: `radial-gradient(circle at 35% 35%, ${color}22, ${C.panel2} 70%)`,
        boxShadow: `0 0 24px ${color}33, inset 0 0 20px ${color}11`,
        '--glow-color': color,
        animation: spinning ? `ld-glow-pulse 1.4s ease-in-out infinite` : 'none',
      }} />

      {/* Líneas del bombo */}
      {[0, 60, 120].map(deg => (
        <div key={deg} style={{
          position: 'absolute', inset: 8, borderRadius: '50%',
          border: `1px dashed ${color}28`,
          animation: spinning ? `ld-spin ${1.8 + deg * 0.01}s linear infinite` : 'none',
          transform: `rotate(${deg}deg)`,
        }} />
      ))}

      {/* Bolas orbitales */}
      {spinning && [
        { anim: 'ld-orbit 1.2s linear infinite',  color: color },
        { anim: 'ld-orbit2 1.5s linear infinite', color: '#fff' },
        { anim: 'ld-orbit3 2.0s linear infinite', color: color },
      ].map((b, i) => (
        <div key={i} style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 12, height: 12, borderRadius: '50%',
          marginTop: -6, marginLeft: -6,
          background: b.color,
          boxShadow: `0 0 8px ${b.color}`,
          animation: b.anim,
        }} />
      ))}

      {/* Número central */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 32 }}>🎱</span>
      </div>
    </div>
  )
}

// ── Bola individual (del sorteo) ──────────────────────────────────────────────
function DrawBall({ profile, color, animate, style = {} }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      animation: animate ? `ld-pop-in ${BOUNCE_DURATION_MS}ms cubic-bezier(.34,1.56,.64,1) both` : 'none',
      ...style,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        border: `2.5px solid ${color}`,
        background: `${color}18`,
        boxShadow: `0 0 12px ${color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <Avatar profile={profile} size={38} />
      </div>
      <span style={{
        fontSize: 9, fontWeight: 700, color,
        maxWidth: 60, textAlign: 'center',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {profile?.display_name || profile?.username || '?'}
      </span>
    </div>
  )
}

// ── Columna de grupo ──────────────────────────────────────────────────────────
function GroupColumn({ group, members, isActive, newMemberId }) {
  const color = group.color ?? GROUP_COLORS[group.position % GROUP_COLORS.length]

  return (
    <div style={{
      flex: '1 1 100px', minWidth: 90, maxWidth: 160,
      background: isActive ? `${color}12` : C.panel2,
      border: `1.5px solid ${isActive ? color : C.border}`,
      borderRadius: 14, padding: '10px 8px',
      transition: 'all .3s',
      boxShadow: isActive ? `0 0 20px ${color}33` : 'none',
    }}>
      {/* Cabecera del grupo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontWeight: 800, fontSize: 13, color: isActive ? color : C.text }}>
          Grupo {group.name}
        </span>
      </div>

      {/* Miembros asignados */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 40 }}>
        {members.map(m => (
          <div key={m.user_id} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            animation: m.user_id === newMemberId
              ? `ld-bounce ${BOUNCE_DURATION_MS}ms cubic-bezier(.34,1.56,.64,1) both`
              : 'none',
          }}>
            <Avatar profile={m.profile} size={22} />
            <span style={{
              fontSize: 10, fontWeight: 600, color: C.text2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1,
            }}>
              {m.profile?.display_name || m.profile?.username || '?'}
            </span>
          </div>
        ))}
        {members.length === 0 && (
          <div style={{ fontSize: 10, color: C.textDim, textAlign: 'center', paddingTop: 4 }}>
            Vacío
          </div>
        )}
      </div>
    </div>
  )
}

// ── Fetch datos del sorteo ────────────────────────────────────────────────────
async function fetchDrawData(tournamentId) {
  // 1. Grupos
  const { data: groups } = await supabase
    .from('tournament_groups')
    .select('id, name, color, position, classifies')
    .eq('tournament_id', tournamentId)
    .order('position')

  // 2. Última sesión de sorteo (draw_session más reciente)
  const { data: sessionRow } = await supabase
    .from('tournament_draw_events')
    .select('draw_session')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!sessionRow) return { groups: groups ?? [], events: [], members: {} }

  // 3. Eventos de esa sesión en orden
  const { data: events } = await supabase
    .from('tournament_draw_events')
    .select('id, event_type, sequence, payload, created_at')
    .eq('tournament_id', tournamentId)
    .eq('draw_session', sessionRow.draw_session)
    .order('sequence')

  // 4. Perfiles de jugadores mencionados en los eventos
  const userIds = [...new Set(
    (events ?? [])
      .filter(e => e.event_type === 'ball_drawn')
      .map(e => e.payload?.user_id)
      .filter(Boolean)
  )]

  const { data: profiles } = userIds.length
    ? await supabase.from('users').select('id, display_name, username, avatar_url').in('id', userIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  return { groups: groups ?? [], events: events ?? [], profileMap }
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function LiveDraw({
  tournamentId,
  profile,
  isAdmin,
  numGroups   = 4,
  groupNames  = ['A','B','C','D','E','F','G','H'],
  classifies  = 2,
  onDrawComplete,
}) {
  const { isPro } = useSubscription(profile?.id)
  const canUseDraw = isPro || isAdmin

  if (!canUseDraw) return (
    <div style={{ textAlign: 'center', padding: '40px 24px' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
      <p style={{ fontWeight: 700, fontSize: 16, color: '#8b5cf6', marginBottom: 6 }}>Sorteo en vivo — Plan PRO</p>
      <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
        El sorteo en vivo animado está disponible para usuarios con plan PRO o administradores de la plataforma.
      </p>
    </div>
  )

  const [phase, setPhase]       = useState('idle')   // idle | starting | spinning | drawing | done | replay
  const [groups, setGroups]     = useState([])
  const [events, setEvents]     = useState([])
  const [profileMap, setProfileMap] = useState({})
  const [groupMembers, setGroupMembers] = useState({})  // groupId → [{user_id, profile}]
  const [activeBall, setActiveBall]   = useState(null)  // { user_id, group_id, profile }
  const [activeGroupId, setActiveGroupId] = useState(null)
  const [lastAddedId, setLastAddedId]     = useState(null)
  const [currentEventIdx, setCurrentEventIdx] = useState(0)
  const [drawErr, setDrawErr]   = useState(null)
  const [running, setRunning]   = useState(false)
  const timerRef = useRef(null)

  // Inyectar CSS una sola vez
  useEffect(() => {
    if (document.getElementById('ld-styles')) return
    const s = document.createElement('style')
    s.id = 'ld-styles'
    s.textContent = DRAW_CSS
    document.head.appendChild(s)
  }, [])

  // Cargar datos existentes (para replay)
  const loadExisting = useCallback(async () => {
    const { groups: g, events: e, profileMap: pm } = await fetchDrawData(tournamentId)
    setGroups(g)
    setEvents(e)
    setProfileMap(pm ?? {})
    // Si ya hay eventos, mostrar resultado final estático
    if (e.length > 0) {
      const finalMembers = {}
      g.forEach(gr => { finalMembers[gr.id] = [] })
      e.filter(ev => ev.event_type === 'ball_drawn').forEach(ev => {
        const gid = ev.payload?.group_id
        const uid = ev.payload?.user_id
        if (gid && finalMembers[gid]) {
          finalMembers[gid].push({ user_id: uid, profile: pm[uid] })
        }
      })
      setGroupMembers(finalMembers)
      const isCompleted = e.some(ev => ev.event_type === 'draw_completed')
      if (isCompleted) setPhase('done')
    }
    return { groups: g, events: e, profileMap: pm ?? {} }
  }, [tournamentId])

  useEffect(() => { loadExisting() }, [loadExisting])

  // ── Iniciar sorteo (llamar RPC) ───────────────────────────────────────────
  async function handleStartDraw() {
    setDrawErr(null)
    setPhase('starting')

    const { data, error } = await supabase.rpc('run_draw', {
      p_tournament_id: tournamentId,
      p_num_groups:    numGroups,
      p_group_names:   groupNames.slice(0, numGroups),
      p_classifies:    classifies,
    })

    if (error || data?.ok === false) {
      setDrawErr(error?.message ?? data?.error ?? 'Error al iniciar el sorteo')
      setPhase('idle')
      return
    }

    // Cargar los eventos recién creados y lanzar animación
    const { groups: g, events: e, profileMap: pm } = await fetchDrawData(tournamentId)
    setGroups(g)
    setEvents(e)
    setProfileMap(pm)
    const initMembers = {}
    g.forEach(gr => { initMembers[gr.id] = [] })
    setGroupMembers(initMembers)
    setCurrentEventIdx(0)
    setPhase('spinning')

    // Pausa de 1.5s con bolillero girando, luego empieza a sacar bolas
    setTimeout(() => startAnimation(e, g, pm, 0), 1500)
  }

  // ── Replay (animar desde cero con eventos existentes) ─────────────────────
  async function handleReplay() {
    clearTimeout(timerRef.current)
    setRunning(false)
    const { groups: g, events: e, profileMap: pm } = await loadExisting()
    const initMembers = {}
    g.forEach(gr => { initMembers[gr.id] = [] })
    setGroupMembers(initMembers)
    setActiveBall(null)
    setActiveGroupId(null)
    setLastAddedId(null)
    setCurrentEventIdx(0)
    setPhase('spinning')
    setTimeout(() => startAnimation(e, g, pm, 0), 1500)
  }

  // ── Motor de animación ────────────────────────────────────────────────────
  function startAnimation(evList, groupList, pm, startIdx) {
    setRunning(true)
    let idx = startIdx

    function step() {
      if (idx >= evList.length) {
        setRunning(false)
        setActiveBall(null)
        setActiveGroupId(null)
        setPhase('done')
        onDrawComplete?.()
        return
      }

      const ev = evList[idx]
      setCurrentEventIdx(idx)

      if (ev.event_type === 'ball_drawn') {
        const uid  = ev.payload?.user_id
        const gid  = ev.payload?.group_id
        const p    = pm[uid]

        // 1. Mostrar bola saliendo del bombo
        setActiveBall({ user_id: uid, group_id: gid, profile: p })
        setActiveGroupId(gid)

        // 2. Después de medio segundo, añadir al grupo
        timerRef.current = setTimeout(() => {
          setGroupMembers(prev => {
            const next = { ...prev }
            if (next[gid]) {
              next[gid] = [...next[gid], { user_id: uid, profile: p }]
            }
            return next
          })
          setLastAddedId(uid)

          // 3. Limpiar highlight y avanzar al siguiente evento
          timerRef.current = setTimeout(() => {
            setActiveBall(null)
            setActiveGroupId(null)
            setLastAddedId(null)
            idx++
            timerRef.current = setTimeout(step, 200)
          }, BOUNCE_DURATION_MS + 100)
        }, DELAY_PER_EVENT_MS * 0.45)

      } else if (ev.event_type === 'draw_completed') {
        setRunning(false)
        setActiveBall(null)
        setActiveGroupId(null)
        setPhase('done')
        onDrawComplete?.()
        return
      } else {
        // draw_started, pot_revealed → avanzar rápido
        idx++
        timerRef.current = setTimeout(step, 300)
      }
    }

    timerRef.current = setTimeout(step, 0)
  }

  // Limpiar timers al desmontar
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const spinning     = phase === 'spinning' || phase === 'starting'
  const accentColor  = C.green
  const ballEvents   = events.filter(e => e.event_type === 'ball_drawn')
  const progress     = ballEvents.length > 0
    ? Math.round((Object.values(groupMembers).flat().length / ballEvents.length) * 100)
    : 0

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '16px 0' }}>

      {/* ── Encabezado ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: C.text }}>🎱 Sorteo en Vivo</p>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: C.textDim }}>
            {phase === 'idle'   && 'Listo para iniciar el sorteo de grupos'}
            {phase === 'starting' && 'Iniciando sorteo…'}
            {phase === 'spinning' && 'El bolillero está girando…'}
            {phase === 'drawing'  && 'Asignando jugadores a grupos…'}
            {phase === 'done'   && '¡Sorteo completado!'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {/* Botón replay — solo si ya hay eventos */}
          {events.length > 0 && phase !== 'spinning' && !running && (
            <button onClick={handleReplay} style={{
              padding: '9px 16px', borderRadius: 10,
              border: `1px solid ${C.border}`, background: C.panel2,
              color: C.text2, fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}>
              ▶ Repetir sorteo
            </button>
          )}

          {/* Botón iniciar — solo admins y si no hay sorteo o está idle */}
          {isAdmin && (phase === 'idle' || (phase === 'done' && !running)) && (
            <button onClick={handleStartDraw} style={{
              padding: '9px 20px', borderRadius: 10, border: 'none',
              background: accentColor, color: C.bg, fontWeight: 800, fontSize: 13, cursor: 'pointer',
              boxShadow: `0 0 16px ${accentColor}44`,
            }}>
              🎱 Iniciar Sorteo
            </button>
          )}
        </div>
      </div>

      {drawErr && (
        <div style={{ background: '#ef444418', border: '1px solid #ef444444', borderRadius: 10, padding: '10px 14px', color: '#ef4444', fontSize: 12 }}>
          ⚠️ {drawErr}
        </div>
      )}

      {/* ── Zona de animación ─────────────────────────────────────────────── */}
      {(spinning || running || phase === 'done') && (
        <div style={{
          background: C.panel,
          border: `1px solid ${spinning ? accentColor + '44' : C.border}`,
          borderRadius: 20, padding: '28px 20px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
          transition: 'border-color .3s',
        }}>

          {/* Bolillero */}
          <div style={{ position: 'relative' }}>
            <Bolillero spinning={spinning || running} color={accentColor} />

            {/* Bola activa saliendo del bombo */}
            {activeBall && (
              <div style={{
                position: 'absolute', top: -10, left: '50%',
                transform: 'translateX(-50%)',
                animation: `ld-float 0.8s ease-in-out infinite`,
                zIndex: 10,
              }}>
                <DrawBall
                  profile={activeBall.profile}
                  color={groups.find(g => g.id === activeBall.group_id)?.color
                    ?? GROUP_COLORS[groups.findIndex(g => g.id === activeBall.group_id) % GROUP_COLORS.length]
                    ?? accentColor}
                  animate
                />
              </div>
            )}
          </div>

          {/* Barra de progreso */}
          {running && ballEvents.length > 0 && (
            <div style={{ width: '100%', maxWidth: 300 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.textDim }}>Progreso del sorteo</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: accentColor }}>{progress}%</span>
              </div>
              <div style={{ height: 6, background: C.panel2, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 6,
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${C.greenDk}, ${C.green})`,
                  transition: 'width .4s',
                  boxShadow: `0 0 8px ${accentColor}66`,
                }} />
              </div>
            </div>
          )}

          {/* Mensaje de completado */}
          {phase === 'done' && !running && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              animation: `ld-completed-in 0.5s cubic-bezier(.34,1.56,.64,1) both`,
            }}>
              <span style={{ fontSize: 36 }}>🏆</span>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: accentColor }}>
                ¡Sorteo completado!
              </p>
              <p style={{ margin: 0, fontSize: 12, color: C.textDim }}>
                {ballEvents.length} jugadores asignados a {groups.length} grupos
              </p>
            </div>
          )}

          {/* Grid de grupos */}
          {groups.length > 0 && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 10,
              width: '100%', justifyContent: 'center',
            }}>
              {groups.map((g, i) => (
                <GroupColumn
                  key={g.id}
                  group={{ ...g, color: g.color ?? GROUP_COLORS[i % GROUP_COLORS.length] }}
                  members={groupMembers[g.id] ?? []}
                  isActive={g.id === activeGroupId}
                  newMemberId={lastAddedId}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Estado idle: sin sorteo previo ────────────────────────────────── */}
      {phase === 'idle' && groups.length === 0 && (
        <div style={{
          background: C.panel2, border: `1px dashed ${C.border}`,
          borderRadius: 16, padding: '36px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12, animation: 'ld-float 2s ease-in-out infinite' }}>🎱</div>
          <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15, color: C.text }}>
            Sorteo pendiente
          </p>
          <p style={{ margin: 0, fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
            {isAdmin
              ? `Cuando todos los jugadores estén inscritos, presioná "Iniciar Sorteo" para asignarlos a los ${numGroups} grupos automáticamente.`
              : 'El organizador iniciará el sorteo en vivo. La asignación a grupos aparecerá aquí.'}
          </p>
        </div>
      )}

      {/* ── Resultado estático (si llegó después del sorteo, sin replay) ─── */}
      {phase === 'done' && !running && groups.length > 0 && Object.values(groupMembers).flat().length > 0 && (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Resultado del sorteo
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {groups.map((g, i) => {
              const color   = g.color ?? GROUP_COLORS[i % GROUP_COLORS.length]
              const members = groupMembers[g.id] ?? []
              return (
                <div key={g.id} style={{
                  flex: '1 1 140px', minWidth: 130, maxWidth: 200,
                  background: C.panel2, border: `1.5px solid ${color}44`,
                  borderRadius: 14, padding: '12px 10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                    <span style={{ fontWeight: 800, fontSize: 13, color }}>Grupo {g.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: C.textDim }}>{members.length} jug.</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {members.map((m, mi) => (
                      <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 10, color: C.textDim, minWidth: 14, textAlign: 'right' }}>{mi + 1}</span>
                        <Avatar profile={m.profile} size={22} />
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: C.text2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                        }}>
                          {m.profile?.display_name || m.profile?.username || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
