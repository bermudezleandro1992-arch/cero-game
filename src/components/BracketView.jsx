/**
 * BracketView — árbol de eliminación visual.
 *
 * Props:
 *   tournamentId   uuid      — id del torneo
 *   profile        object    — perfil del usuario actual (id, role)
 *   isAdmin        boolean   — puede aprobar resultados
 *   onReportMatch  fn(match) — callback externo para reportar (opcional)
 *
 * Integración:
 *   import BracketView from '../components/BracketView'
 *
 *   <BracketView
 *     tournamentId={tournament.id}
 *     profile={profile}
 *     isAdmin={isAdmin}
 *     onReportMatch={(match) => setReportModal(match)}
 *   />
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import MatchResultFlow from './MatchResultFlow'

// ── Constantes de layout (base) ──────────────────────────────────────────────
const PADDING = 24

// Constantes adaptativas según cantidad de rondas y tamaño de pantalla
function getLayoutConstants(numMainRounds, isMobile = false) {
  if (isMobile) {
    if (numMainRounds <= 2) return { CARD_W: 150, CARD_H: 72, COL_GAP: 40, ROW_GAP: 10 }
    if (numMainRounds === 3) return { CARD_W: 136, CARD_H: 66, COL_GAP: 32, ROW_GAP: 8 }
    if (numMainRounds === 4) return { CARD_W: 120, CARD_H: 60, COL_GAP: 28, ROW_GAP: 6 }
    return { CARD_W: 108, CARD_H: 54, COL_GAP: 24, ROW_GAP: 5 }
  }
  if (numMainRounds <= 2) return { CARD_W: 200, CARD_H: 90, COL_GAP: 72, ROW_GAP: 16 }
  if (numMainRounds === 3) return { CARD_W: 180, CARD_H: 84, COL_GAP: 60, ROW_GAP: 14 }
  if (numMainRounds === 4) return { CARD_W: 156, CARD_H: 76, COL_GAP: 48, ROW_GAP: 10 }
  return { CARD_W: 136, CARD_H: 68, COL_GAP: 40, ROW_GAP: 8 }
}

const PHASE_LABELS = {
  bracket: 'Ronda', r16: 'Octavos', qf: 'Cuartos', sf: 'Semis', final: 'Final',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Avatar({ profile, size = 24 }) {
  if (profile?.avatar_url) return (
    <img src={profile.avatar_url} alt=""
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  )
  const l = (profile?.display_name || profile?.username || '?')[0]?.toUpperCase() ?? '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: C.panel2, border: `1.5px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.44, fontWeight: 800, color: C.textDim, flexShrink: 0,
    }}>{l}</div>
  )
}

function isBotProfile(profile) {
  if (!profile) return false
  if (profile.is_bot) return true
  const u = profile.username || ''
  const d = profile.display_name || ''
  return (
    /^bot_[0-9a-f]/.test(u) ||
    /^user_[0-9a-f]{6,}/.test(u) ||
    (d.toLowerCase() === 'usuario' && /^user_/.test(u))
  )
}

function name(profile) {
  if (!profile) return '—'
  if (isBotProfile(profile)) return profile.display_name || '🤖 Bot'
  return profile.display_name || profile.username || '—'
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchBracket(tournamentId) {
  // 1. Brackets guardados
  const { data: brackets } = await supabase
    .from('tournament_brackets')
    .select('id, match_id, phase, round_number, match_number, slot_x, slot_y, parent_slot, side')
    .eq('tournament_id', tournamentId)
    .order('round_number').order('match_number')

  // 2. Partidos del bracket (no de grupos)
  const { data: matches } = await supabase
    .from('tournament_matches')
    .select('id, round_number, match_number, phase, player1_id, player2_id, player1_name, player2_name, score1, score2, winner_id, status, photo_url, loser_confirmed')
    .eq('tournament_id', tournamentId)
    .or('phase.neq.groups,phase.is.null')
    .order('round_number').order('match_number')

  if (!matches?.length) return { brackets: [], matches: [], profileMap: {} }

  // 3. Perfiles
  const userIds = [...new Set(
    matches.flatMap(m => [m.player1_id, m.player2_id]).filter(Boolean)
  )]
  const { data: profiles } = userIds.length
    ? await supabase.from('users').select('id, display_name, username, avatar_url, is_bot').in('id', userIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  // Enriquecer matches con perfiles
  const enriched = matches.map(m => ({
    ...m,
    player1: profileMap[m.player1_id] ?? null,
    player2: profileMap[m.player2_id] ?? null,
  }))

  return { brackets: brackets ?? [], matches: enriched, profileMap }
}

// ── Layout: calcular posiciones de cada tarjeta ───────────────────────────────
function computeLayout(matches, { CARD_W, CARD_H, COL_GAP, ROW_GAP }) {
  if (!matches.length) return { rounds: [], totalW: 0, totalH: 0 }

  // Agrupar por ronda
  const roundMap = {}
  matches.forEach(m => {
    if (!roundMap[m.round_number]) roundMap[m.round_number] = []
    roundMap[m.round_number].push(m)
  })
  const allRoundNums = Object.keys(roundMap).map(Number).sort((a, b) => a - b)

  // Detectar partido de 3°/4° lugar: por phase === 'third_place' o por heurística posicional
  let thirdPlaceRoundNum = null
  const roundNums = [...allRoundNums]

  // Prefer explicit phase tag
  const thirdByPhase = allRoundNums.find(rn => roundMap[rn].some(m => m.phase === 'third_place'))
  if (thirdByPhase != null) {
    thirdPlaceRoundNum = thirdByPhase
    roundNums.splice(roundNums.indexOf(thirdByPhase), 1)
  } else if (roundNums.length >= 2) {
    // Fallback heuristic: last two rounds each have exactly 1 match
    const lastRn = roundNums[roundNums.length - 1]
    const prevRn = roundNums[roundNums.length - 2]
    if (roundMap[lastRn].length === 1 && roundMap[prevRn].length === 1) {
      thirdPlaceRoundNum = lastRn
      roundNums.pop()
    }
  }

  const firstCount = roundMap[roundNums[0]]?.length ?? 1
  const slotH = CARD_H + ROW_GAP * 2

  const rounds = roundNums.map((rn, ri) => {
    const ms   = roundMap[rn]
    const span = Math.pow(2, ri)
    const x    = PADDING + ri * (CARD_W + COL_GAP)

    const cards = ms.map((m, mi) => {
      const centerY = PADDING + span * (mi + 0.5) * slotH
      const y = centerY - CARD_H / 2
      return { match: m, x, y, cellH: span * slotH }
    })

    const phaseKey   = ms[0]?.phase ?? 'bracket'
    const label      = PHASE_LABELS[phaseKey] ?? `Ronda ${rn}`
    const phaseLabel = phaseKey === 'bracket' ? `Ronda ${rn}` : label

    return { roundNum: rn, cards, x, phaseLabel }
  })

  // Agregar partido 3°/4° lugar en la misma columna que la Final, debajo de ella
  let thirdPlaceData = null
  if (thirdPlaceRoundNum !== null) {
    const finalRound = rounds[rounds.length - 1]
    const finalCard  = finalRound?.cards[0]
    const thirdMs    = roundMap[thirdPlaceRoundNum]
    const thirdX = finalCard ? finalCard.x : PADDING + (roundNums.length - 1) * (CARD_W + COL_GAP)
    const thirdY = finalCard ? finalCard.y + CARD_H + ROW_GAP * 4 + 24 : PADDING
    thirdPlaceData = { match: thirdMs[0], x: thirdX, y: thirdY }
  }

  const mainW  = PADDING + roundNums.length * (CARD_W + COL_GAP) - COL_GAP + PADDING
  const totalW = mainW
  const mainH  = PADDING * 2 + firstCount * slotH
  const extraH = thirdPlaceData ? CARD_H + ROW_GAP * 4 + 48 : 0
  const totalH = mainH + extraH

  return { rounds, totalW, totalH, thirdPlaceData }
}

// ── Tarjeta de partido ────────────────────────────────────────────────────────
function MatchCard({ match, x, y, cardW, cardH, scale = 1, onClick }) {
  const isFinal     = match.status === 'finalizado'
  const isPending   = match.status === 'pendiente'
  const hasPlayers  = match.player1 || match.player2
  const winner1     = match.winner_id === match.player1_id
  const winner2     = match.winner_id === match.player2_id

  const borderColor = isFinal ? `${C.green}66` : `${C.border}`
  const fs = (base) => Math.round(base * scale)

  function PlayerRow({ profile, score, isWinner, isEmpty, teamName }) {
    const displayName = teamName || name(profile)
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: scale < 0.9 ? 4 : 6,
        padding: `${scale < 0.9 ? 4 : 5}px 8px`, flex: 1,
        background: isWinner ? `${C.green}14` : 'transparent',
        borderLeft: `2px solid ${isWinner ? C.green : 'transparent'}`,
        borderRadius: isWinner ? '0 4px 4px 0' : 0,
      }}>
        {isEmpty
          ? <span style={{ fontSize: fs(10), color: C.textDim, fontStyle: 'italic' }}>Por definir</span>
          : <>
              {!teamName && <Avatar profile={profile} size={fs(20)} />}
              <span style={{
                flex: 1, fontSize: fs(11), fontWeight: isWinner ? 800 : 600,
                color: isWinner ? C.green : C.text,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {displayName}
              </span>
              {score != null && (
                <span style={{
                  fontSize: fs(13), fontWeight: 900,
                  color: isWinner ? C.green : C.text2,
                  minWidth: 16, textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {score}
                </span>
              )}
            </>
        }
      </div>
    )
  }

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={() => hasPlayers && onClick?.(match)}
      style={{ cursor: hasPlayers ? 'pointer' : 'default' }}
    >
      <rect
        x={0} y={0} width={cardW} height={cardH}
        rx={8} ry={8}
        fill={C.panel}
        stroke={borderColor}
        strokeWidth={1.5}
      />
      <foreignObject x={0} y={0} width={cardW} height={cardH}>
        <div xmlns="http://www.w3.org/1999/xhtml" style={{
          width: cardW, height: cardH,
          display: 'flex', flexDirection: 'column',
          background: 'transparent', borderRadius: 8, overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
          onClick={() => hasPlayers && onClick?.(match)}
        >
          <div style={{
            padding: `2px 8px`,
            background: isFinal ? `${C.green}22` : C.panel2,
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: fs(9), fontWeight: 700, color: C.textDim, letterSpacing: '0.5px' }}>
              {match.round_number && `R${match.round_number}`}
              {match.match_number && ` · P${match.match_number}`}
            </span>
            <span style={{
              fontSize: fs(9), fontWeight: 700, letterSpacing: '0.5px',
              color: isFinal ? C.green : match.status === 'en_juego' ? '#f59e0b' : C.textDim,
            }}>
              {isFinal ? '✓' : match.status === 'en_juego' ? '⏳' : '·'}
            </span>
          </div>

          <PlayerRow profile={match.player1} score={match.score1} isWinner={winner1} isEmpty={!match.player1 && !match.player1_name} teamName={match.player1_name} />
          <div style={{ height: 1, background: C.border, flexShrink: 0 }} />
          <PlayerRow profile={match.player2} score={match.score2} isWinner={winner2} isEmpty={!match.player2 && !match.player2_name} teamName={match.player2_name} />
        </div>
      </foreignObject>
    </g>
  )
}

// ── Líneas de conexión SVG ────────────────────────────────────────────────────
function BracketLines({ rounds, CARD_W, CARD_H, COL_GAP }) {
  const lines = []
  const mainRounds = rounds.filter(r => !r.isThirdPlace)

  for (let ri = 0; ri < mainRounds.length - 1; ri++) {
    const currentRound = mainRounds[ri]
    const nextRound    = mainRounds[ri + 1]

    for (let ci = 0; ci < currentRound.cards.length; ci += 2) {
      const cardA = currentRound.cards[ci]
      const cardB = currentRound.cards[ci + 1]
      if (!cardA) continue

      const nextIdx  = Math.floor(ci / 2)
      const nextCard = nextRound.cards[nextIdx]
      if (!nextCard) continue

      const ax1 = cardA.x + CARD_W
      const ay1 = cardA.y + CARD_H / 2

      const bx1 = cardB ? cardB.x + CARD_W : ax1
      const by1 = cardB ? cardB.y + CARD_H / 2 : ay1

      const nx  = nextCard.x
      const ny  = nextCard.y + CARD_H / 2

      const midX = ax1 + COL_GAP / 2

      const hasWinnerA = cardA.match.winner_id != null
      const hasWinnerB = cardB?.match.winner_id != null
      const strokeA    = hasWinnerA ? C.green : C.border
      const strokeB    = hasWinnerB ? C.green : C.border
      const strokeMain = (hasWinnerA && hasWinnerB) ? C.green : C.border

      const key = `line-${ri}-${ci}`

      lines.push(
        <g key={key}>
          {/* Línea horizontal desde A al eje medio */}
          <path
            d={`M ${ax1} ${ay1} H ${midX}`}
            fill="none" stroke={strokeA} strokeWidth={1.5}
            strokeDasharray={hasWinnerA ? 'none' : '4 3'}
            opacity={0.7}
          />
          {/* Línea horizontal desde B al eje medio */}
          {cardB && (
            <path
              d={`M ${bx1} ${by1} H ${midX}`}
              fill="none" stroke={strokeB} strokeWidth={1.5}
              strokeDasharray={hasWinnerB ? 'none' : '4 3'}
              opacity={0.7}
            />
          )}
          {/* Línea vertical que une A y B en el eje medio */}
          {cardB && (
            <path
              d={`M ${midX} ${ay1} V ${by1}`}
              fill="none" stroke={strokeMain} strokeWidth={1.5}
              opacity={0.6}
            />
          )}
          {/* Línea horizontal al partido siguiente */}
          <path
            d={`M ${midX} ${ny} H ${nx}`}
            fill="none" stroke={strokeMain} strokeWidth={1.5}
            strokeDasharray={hasWinnerA && hasWinnerB ? 'none' : '4 3'}
            opacity={0.7}
          />
          {/* Punto en la bifurcación */}
          <circle cx={midX} cy={ny} r={3} fill={strokeMain} opacity={0.6} />
        </g>
      )
    }
  }

  return <g>{lines}</g>
}

// ── Selector de partido para resetear ────────────────────────────────────────
function SelectMatchToReset({ matches, onSelect }) {
  const [open, setOpen] = useState(false)
  const resetable = matches.filter(m => m.status === 'finalizado' || m.status === 'aprobado' || m.status === 'resultado_cargado')
  if (!resetable.length) return null
  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid #ef444444', background: '#ef444410', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
      ⚙️ Resetear partido
    </button>
  )
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(false)} style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid #ef444444', background: '#ef444418', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
        ⚙️ ¿Cuál partido? ↑
      </button>
      <div style={{ position: 'absolute', right: 0, top: '110%', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, zIndex: 999, minWidth: 220, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        {resetable.map(m => {
          const p1 = m.player1?.display_name || m.player1?.username || `J${m.match_number * 2 - 1}`
          const p2 = m.player2?.display_name || m.player2?.username || `J${m.match_number * 2}`
          return (
            <button key={m.id} onClick={() => { setOpen(false); onSelect(m) }} style={{ width: '100%', display: 'flex', flexDirection: 'column', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: `1px solid ${C.border}22` }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{p1} vs {p2}</span>
              <span style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>R{m.round_number} · P{m.match_number} · {m.status}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Devuelve el nombre de la ronda según posición desde el final
function getRoundLabel(roundNumber, totalRounds, isBye = false) {
  const fromEnd = totalRounds - roundNumber
  let label
  if (fromEnd === 0)      label = '🥇 Final'
  else if (fromEnd === 1) label = '🥈 Semifinal'
  else if (fromEnd === 2) label = '⚔️ Cuartos de Final'
  else if (fromEnd === 3) label = '🎯 Octavos de Final'
  else                    label = `Ronda ${roundNumber}`
  return isBye ? `${label} · Bye automático` : label
}

function buildResultBody({ tournamentName, p1n, p2n, score1, score2, winnerName, roundLabel }) {
  const tn = tournamentName || 'Torneo'
  const s1 = score1 ?? 0
  const s2 = score2 ?? 0
  return `🏆 ${tn}\n\n⚔️  ${p1n}  ${s1} — ${s2}  ${p2n}\n\n🥇 Ganador: ${winnerName}\n📍 ${roundLabel}`
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function BracketView({ tournamentId, communityId, tournamentName, profile, isAdmin, onReportMatch, onFinished }) {
  const [matches, setMatches]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError]       = useState(null)
  const [reportMatch, setReportMatch] = useState(null)
  const [resetModal, setResetModal]   = useState(null) // match to reset
  const [resetReason, setResetReason] = useState('')
  const [resetting, setResetting]     = useState(false)
  const [resetAllConfirm, setResetAllConfirm] = useState(false)
  const [resettingAll, setResettingAll]       = useState(false)
  const [resolvedCommunityId, setResolvedCommunityId] = useState(communityId || null)
  const [champion, setChampion] = useState(null) // { name, matchId } — shown after Final
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)
  const postedAnnouncements = useRef(new Set())
  const scrollRef = useRef(null)

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { matches: m, brackets, profileMap } = await fetchBracket(tournamentId)
      setMatches(m)
    } catch (e) {
      setError(e?.message ?? 'Error al cargar el bracket')
    } finally {
      setLoading(false)
    }
  }, [tournamentId])

  useEffect(() => { load() }, [load])

  // Resolver communityId desde el torneo si no viene como prop
  useEffect(() => {
    if (communityId) { setResolvedCommunityId(communityId); return }
    supabase.from('conversations').select('community_id').eq('id', tournamentId).single()
      .then(({ data }) => { if (data?.community_id) setResolvedCommunityId(data.community_id) })
  }, [tournamentId, communityId])

  // Realtime
  useEffect(() => {
    if (!tournamentId) return
    const ch = supabase.channel(`bracket:${tournamentId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tournament_matches',
        filter: `tournament_id=eq.${tournamentId}`,
      }, load)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tournament_brackets',
        filter: `tournament_id=eq.${tournamentId}`,
      }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [tournamentId, load])

  async function handleGenerate() {
    setGenerating(true)
    const { data, error } = await supabase.rpc('generate_brackets', { p_tournament_id: tournamentId })
    setGenerating(false)
    if (error || data?.ok === false) {
      setError(error?.message ?? data?.error ?? 'Error al generar el bracket')
      return
    }
    await load()
  }

  async function handleByeAll() {
    const botMatches = matches.filter(m =>
      m.status === 'pendiente' &&
      ((isBot(m.player1) && m.player2_id) || (isBot(m.player2) && m.player1_id))
    )
    // Resolve community_id fresh once for all byes
    let commId = null
    if (profile?.id) {
      const { data: cv } = await supabase.from('conversations').select('community_id').eq('id', tournamentId).single()
      commId = cv?.community_id || null
    }
    for (const m of botMatches) {
      const p1IsBot = isBot(m.player1)
      const winnerId = p1IsBot ? m.player2_id : m.player1_id
      if (!winnerId) continue
      const score1 = p1IsBot ? 0 : 1
      const score2 = p1IsBot ? 1 : 0
      await supabase.rpc('bye_match', {
        p_match_id: m.id, p_winner_id: winnerId,
        p_score1: score1, p_score2: score2,
      })
      // Post announcement to community Avisos
      if (profile?.id && !postedAnnouncements.current.has(m.id)) {
        postedAnnouncements.current.add(m.id)
        const totalRounds = Math.max(...matches.map(x => x.round_number))
        const p1n = m.player1?.display_name || m.player1?.username || 'Jugador 1'
        const p2n = m.player2?.display_name || m.player2?.username || 'Jugador 2'
        const winnerName = winnerId === m.player1_id ? p1n : p2n
        const roundLabel = getRoundLabel(m.round_number, totalRounds, true)
        const body = buildResultBody({ tournamentName, p1n, p2n, score1, score2, winnerName, roundLabel })
        const { error: annErr } = await supabase.from('announcements').insert({
          conversation_id: commId || undefined,
          tournament_id: tournamentId,
          author_id: profile.id,
          title: `🏆 ${tournamentName || 'Torneo'} — ${getRoundLabel(m.round_number, totalRounds)}`,
          body,
          category: 'torneo',
          is_active: true,
        })
        if (annErr) console.error('Error posting bye announcement:', annErr)

        // Champion detection for bye completion of Final
        if (m.round_number === totalRounds && !postedAnnouncements.current.has(`champ-${m.id}`)) {
          postedAnnouncements.current.add(`champ-${m.id}`)
          setChampion({ name: winnerName, matchId: m.id })
          if (commId) {
            await supabase.from('announcements').insert({
              conversation_id: commId,
              tournament_id: tournamentId,
              author_id: profile.id,
              title: `🏆 ¡CAMPEÓN! ${tournamentName || 'Torneo'}`,
              body: `🎉🏆 ¡FELICITACIONES CAMPEÓN!\n\n👑 ${winnerName}\n\n¡Ganó ${tournamentName || 'el torneo'}! 🥇🎊`,
              category: 'torneo',
              is_active: true,
            })
          }
        }
      }
    }
    await load()
  }

  async function handleResetAll() {
    setResettingAll(true)
    const { error } = await supabase.rpc('reset_tournament_matches', { p_tournament_id: tournamentId })
    setResettingAll(false)
    setResetAllConfirm(false)
    if (error) { alert('Error al resetear: ' + error.message); return }
    await load()
  }

  // Avanzar ganador al siguiente partido en el bracket (via RPC para bypass RLS)
  async function advanceBracket(finishedMatch) {
    if (!finishedMatch?.winner_id) return
    const { error } = await supabase.rpc('advance_bracket_winner', {
      p_match_id: finishedMatch.id,
    })
    if (error) console.error('advanceBracket RPC error:', error)

    // Propagate team name to next round slot (guerra/coop mode)
    const p1name = finishedMatch.player1_name
    const p2name = finishedMatch.player2_name
    if (!p1name && !p2name) return // individual mode — no propagation needed

    const winnerIsP1 = finishedMatch.winner_id === finishedMatch.player1_id
    const winnerTeamName = winnerIsP1 ? p1name : p2name
    const loserTeamName  = winnerIsP1 ? p2name : p1name

    if (winnerTeamName) {
      const nextRound = finishedMatch.round_number + 1
      const nextMatchNum = Math.ceil(finishedMatch.match_number / 2)
      const isOddMatch = finishedMatch.match_number % 2 === 1
      const updateField = isOddMatch ? 'player1_name' : 'player2_name'
      await supabase
        .from('tournament_matches')
        .update({ [updateField]: winnerTeamName })
        .eq('tournament_id', tournamentId)
        .eq('round_number', nextRound)
        .eq('match_number', nextMatchNum)
    }

    // Propagate loser to 3rd place match (phase = third_place)
    if (loserTeamName) {
      const { data: thirdMatch } = await supabase
        .from('tournament_matches')
        .select('id, player1_name, player2_name')
        .eq('tournament_id', tournamentId)
        .eq('phase', 'third_place')
        .single()
      if (thirdMatch) {
        const slotField = thirdMatch.player1_name ? 'player2_name' : 'player1_name'
        await supabase
          .from('tournament_matches')
          .update({ [slotField]: loserTeamName })
          .eq('id', thirdMatch.id)
      }
    }
  }

  async function handleResetMatch(match, reason) {
    await supabase.from('tournament_matches').update({
      score1: null, score2: null, winner_id: null, status: 'pendiente',
    }).eq('id', match.id)
    // Post bot message about the reset
    if (profile?.id) {
      const p1name = match.player1?.display_name || match.player1?.username || 'Jugador 1'
      const p2name = match.player2?.display_name || match.player2?.username || 'Jugador 2'
      await supabase.from('messages').insert({
        conversation_id: tournamentId,
        sender_id: profile.id,
        content: `⚙️ *Resultado anulado*\n\n${p1name} vs ${p2name}\nMotivo: ${reason}\n\nEl partido fue reiniciado a pendiente.`,
        type: 'text',
      })
    }
    await load()
  }

  function handleCardClick(match) {
    const isPlayer = profile?.id === match.player1_id || profile?.id === match.player2_id
    if (match.status === 'finalizado' && !isAdmin) return
    if (isPlayer || isAdmin) setReportMatch(match)
  }

  if (loading) return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12, background: C.panel2 }} />)}
    </div>
  )

  if (error) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <p style={{ color: '#ef4444', fontWeight: 700 }}>{error}</p>
      <button onClick={load} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: C.green, color: C.bg, fontWeight: 700, cursor: 'pointer' }}>Reintentar</button>
    </div>
  )

  if (!matches.length) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🔱</div>
      <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15, color: C.text }}>Sin bracket generado</p>
      <p style={{ margin: '0 0 20px', fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
        {isAdmin
          ? 'Los partidos del bracket no existen todavía. Primero iniciá el torneo con "Iniciar Torneo" para generar los partidos, luego generá el bracket visual.'
          : 'El bracket se mostrará aquí cuando el organizador lo genere.'}
      </p>
      {isAdmin && (
        <button onClick={handleGenerate} disabled={generating} style={{
          padding: '10px 24px', borderRadius: 12, border: 'none',
          background: generating ? C.panel2 : C.green,
          color: generating ? C.textDim : C.bg, fontWeight: 800, fontSize: 14,
          cursor: generating ? 'default' : 'pointer',
        }}>
          {generating ? 'Generando…' : '🔱 Generar Bracket Visual'}
        </button>
      )}
    </div>
  )

  // Calcular layout con constantes adaptativas
  const numMainRounds = (() => {
    const roundNums = [...new Set(matches.map(m => m.round_number))].sort((a, b) => a - b)
    if (roundNums.length >= 2) {
      const roundMap = {}
      matches.forEach(m => { if (!roundMap[m.round_number]) roundMap[m.round_number] = []; roundMap[m.round_number].push(m) })
      const last = roundNums[roundNums.length - 1]
      const prev = roundNums[roundNums.length - 2]
      if (roundMap[last].length === 1 && roundMap[prev].length === 1) return roundNums.length - 1
    }
    return roundNums.length
  })()
  const LC = getLayoutConstants(numMainRounds, isMobile)
  const cardScale = LC.CARD_H / 90
  const { rounds, totalW, totalH, thirdPlaceData } = computeLayout(matches, LC)

  if (!rounds.length) return null

  function isBot(p) { return isBotProfile(p) }

  async function handleByeAdvance(match) {
    const p1IsBot = isBot(match.player1)
    const winnerId = p1IsBot ? match.player2_id : match.player1_id
    if (!winnerId) return
    const { error } = await supabase.rpc('bye_match', {
      p_match_id: match.id,
      p_winner_id: winnerId,
      p_score1: p1IsBot ? 0 : 1,
      p_score2: p1IsBot ? 1 : 0,
    })
    if (error) console.error('Bye error:', error)
    await load()
  }

  return (
    <>
      {reportMatch && createPortal(
        <MatchResultFlow
          match={reportMatch}
          profile={profile}
          isAdmin={isAdmin}
          onClose={() => setReportMatch(null)}
          onUpdate={async () => {
            const { data: mx } = await supabase
              .from('tournament_matches').select('*').eq('id', reportMatch.id).single()
            if (mx?.winner_id) await advanceBracket(mx)
            await load()
            // Publicar resultado en Avisos de la comunidad (una sola vez por partido)
            const FINAL_STATUSES = ['finalizado', 'aprobado', 'confirmado']
            if (profile?.id && mx?.winner_id && FINAL_STATUSES.includes(mx.status) && !postedAnnouncements.current.has(mx.id)) {
              postedAnnouncements.current.add(mx.id)
              // Siempre resolver community_id fresco desde la DB (evita stale closure)
              const { data: cv } = await supabase.from('conversations').select('community_id').eq('id', tournamentId).single()
              const commId = cv?.community_id || null
              if (!commId) { console.warn('No community_id found for tournament', tournamentId); return }
              const p1IsBot = isBotProfile(reportMatch.player1)
              const p2IsBot = isBotProfile(reportMatch.player2)
              const p1n = p1IsBot ? (reportMatch.player1?.display_name || '🤖 Bot') : (reportMatch.player1?.display_name || reportMatch.player1?.username || 'Jugador 1')
              const p2n = p2IsBot ? (reportMatch.player2?.display_name || '🤖 Bot') : (reportMatch.player2?.display_name || reportMatch.player2?.username || 'Jugador 2')
              const winner = mx.winner_id === mx.player1_id ? p1n : p2n
              const totalRounds = Math.max(...matches.map(x => x.round_number))
              const roundLabel = getRoundLabel(mx.round_number, totalRounds)
              const body = buildResultBody({ tournamentName, p1n, p2n, score1: mx.score1, score2: mx.score2, winnerName: winner, roundLabel })
              const { error: annErr } = await supabase.from('announcements').insert({
                conversation_id: commId || undefined,
                tournament_id: tournamentId,
                author_id: profile.id,
                title: `🏆 ${tournamentName || 'Torneo'} — ${roundLabel}`,
                body,
                category: 'torneo',
                is_active: true,
              })
              if (annErr) console.error('Error posting resultado announcement:', annErr)

              // Champion detection: if this is the Final match, show animation + post champion aviso
              if (mx.round_number === totalRounds && !postedAnnouncements.current.has(`champ-${mx.id}`)) {
                postedAnnouncements.current.add(`champ-${mx.id}`)
                setChampion({ name: winner, matchId: mx.id })
                // Post champion announcement to Avisos
                await supabase.from('announcements').insert({
                  conversation_id: commId || undefined,
                  tournament_id: tournamentId,
                  author_id: profile.id,
                  title: `🏆 ¡CAMPEÓN! ${tournamentName || 'Torneo'}`,
                  body: `🎉🏆 ¡FELICITACIONES CAMPEÓN!\n\n👑 ${winner}\n\n¡Ganó ${tournamentName || 'el torneo'}! 🥇🎊`,
                  category: 'torneo',
                  is_active: true,
                })
                // Auto-finalizar torneo
                await supabase.from('conversations')
                  .update({ tournament_status: 'finalizado' })
                  .eq('id', tournamentId)
                // Redirigir al historial de torneos de la comunidad
                setTimeout(() => onFinished?.(), 3500)
              }
            }
          }}
        />,
        document.body
      )}

      {/* Modal resetear partido específico */}
      {resetModal && createPortal(
        <div onClick={() => { setResetModal(null); setResetReason('') }} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.panel, borderRadius: 20, padding: 24, maxWidth: 340, width: '100%', border: `1px solid ${C.border}` }}>
            <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15, color: '#f59e0b' }}>⚠️ Resetear partido</p>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: C.textDim }}>
              {resetModal.player1?.display_name || 'Jugador 1'} vs {resetModal.player2?.display_name || 'Jugador 2'}
            </p>
            <p style={{ margin: '0 0 6px', fontSize: 12, color: C.text, fontWeight: 600 }}>Motivo (obligatorio)</p>
            <textarea
              value={resetReason}
              onChange={e => setResetReason(e.target.value)}
              placeholder="Ej: Error en el resultado cargado, se jugó mal el partido..."
              rows={3}
              style={{ width: '100%', resize: 'none', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => { setResetModal(null); setResetReason('') }} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button
                disabled={!resetReason.trim() || resetting}
                onClick={async () => {
                  if (!resetReason.trim()) return
                  setResetting(true)
                  await handleResetMatch(resetModal, resetReason.trim())
                  setResetting(false); setResetModal(null); setResetReason('')
                }}
                style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: resetReason.trim() ? '#ef4444' : C.panel2, color: resetReason.trim() ? '#fff' : C.textDim, fontWeight: 700, cursor: resetReason.trim() ? 'pointer' : 'default' }}>
                {resetting ? '…' : 'Resetear'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {resetAllConfirm && createPortal(
        <div onClick={() => setResetAllConfirm(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.panel, borderRadius: 20, padding: 24, maxWidth: 320, width: '100%', border: `1px solid ${C.border}` }}>
            <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 15, color: '#ef4444' }}>🔄 Resetear TODOS los resultados</p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: C.textDim, lineHeight: 1.5 }}>
              Esto borra todos los resultados, ganadores y scores del torneo. Los partidos de ronda 2+ quedan sin jugadores. ¿Confirmar?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setResetAllConfirm(false)} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleResetAll} disabled={resettingAll} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                {resettingAll ? '…' : 'Resetear todo'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minHeight: 0, height: '100%' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', flexShrink: 0, flexWrap: 'wrap', gap: 8,
        }}>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: C.text }}>🔱 Bracket</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textDim }}>
              {rounds.length} ronda{rounds.length > 1 ? 's' : ''} · {matches.length} partido{matches.length !== 1 ? 's' : ''}
            </p>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Bye automático para matches con bot pendientes */}
              {matches.some(m => m.status === 'pendiente' && ((isBot(m.player1) && m.player2_id) || (isBot(m.player2) && m.player1_id))) && (
                <button onClick={handleByeAll} style={{
                  padding: '7px 12px', borderRadius: 10,
                  border: '1px solid #22c55e44', background: '#22c55e14',
                  color: '#22c55e', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                }}>
                  🤖 Bye todos los bots
                </button>
              )}
              <SelectMatchToReset
                matches={matches}
                onSelect={m => setResetModal(m)}
              />
              <button onClick={() => setResetAllConfirm(true)} style={{
                padding: '7px 12px', borderRadius: 10,
                border: '1px solid #ef444444', background: '#ef444410',
                color: '#ef4444', fontWeight: 700, fontSize: 11, cursor: 'pointer',
              }}>
                🔄 Resetear todo
              </button>
            </div>
          )}
        </div>

        {/* SVG del bracket + encabezados — mismo contenedor para sincronizar scroll horizontal */}
        <div
          ref={scrollRef}
          style={{
            overflowX: 'auto', overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            flex: 1,
            minHeight: isMobile ? Math.min(totalH + 48, 380) : Math.min(totalH + 48, 520),
            position: 'relative',
          }}
          onMouseDown={e => {
            if (e.target.closest('button, input, textarea, a')) return
            const el = scrollRef.current
            let startX = e.pageX
            let startSL = el.scrollLeft
            el.style.cursor = 'grabbing'
            const onMove = ev => { el.scrollLeft = startSL - (ev.pageX - startX) }
            const onUp   = () => {
              el.style.cursor = 'grab'
              window.removeEventListener('mousemove', onMove)
              window.removeEventListener('mouseup', onUp)
            }
            window.addEventListener('mousemove', onMove)
            window.addEventListener('mouseup', onUp)
          }}
        >
          {/* Encabezados de ronda — dentro del mismo contenedor, sticky en Y */}
          <div style={{
            display: 'flex', paddingLeft: PADDING, minWidth: totalW,
            position: 'sticky', top: 0, zIndex: 10,
            background: C.bg, paddingTop: 8, paddingBottom: 6,
            borderBottom: `1px solid ${C.border}22`,
          }}>
            {rounds.map(r => (
              <div key={r.roundNum} style={{ width: LC.CARD_W, marginRight: LC.COL_GAP, flexShrink: 0, textAlign: 'center' }}>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.5px',
                  background: r.isThirdPlace ? `#cd7f3222` : r.phaseLabel?.includes('Final') ? `${C.green}22` : C.panel2,
                  color: r.isThirdPlace ? '#cd7f32' : r.phaseLabel?.includes('Final') ? C.green : C.textDim,
                  border: `1px solid ${r.isThirdPlace ? '#cd7f3244' : r.phaseLabel?.includes('Final') ? `${C.green}44` : C.border}`,
                }}>
                  {r.phaseLabel}
                </span>
              </div>
            ))}
          </div>

          <svg
            width={totalW}
            height={Math.max(totalH, 200)}
            viewBox={`0 0 ${totalW} ${Math.max(totalH, 200)}`}
            style={{ display: 'block', userSelect: 'none', minWidth: totalW }}
          >
            <BracketLines rounds={rounds} CARD_W={LC.CARD_W} CARD_H={LC.CARD_H} COL_GAP={LC.COL_GAP} />

            {rounds.flatMap(r =>
              r.cards.map(({ match, x, y }) => (
                <g key={match.id}>
                  <MatchCard
                    match={match}
                    x={x} y={y}
                    cardW={LC.CARD_W} cardH={LC.CARD_H} scale={cardScale}
                    onClick={handleCardClick}
                  />
                </g>
              ))
            )}

            {thirdPlaceData && (() => {
              const { match, x, y } = thirdPlaceData
              return (
                <g key={match.id}>
                  {/* Separador visual */}
                  <line
                    x1={x - 12} y1={y - 14} x2={x + LC.CARD_W + 12} y2={y - 14}
                    stroke="#cd7f3244" strokeWidth={1} strokeDasharray="4 3"
                  />
                  <text
                    x={x + LC.CARD_W / 2} y={y - 4}
                    textAnchor="middle" fontSize={10} fontWeight={700}
                    fill="#cd7f32" letterSpacing="0.8"
                  >
                    🥉 3° / 4° Lugar
                  </text>
                  <MatchCard
                    match={match}
                    x={x} y={y}
                    cardW={LC.CARD_W} cardH={LC.CARD_H} scale={cardScale}
                    onClick={handleCardClick}
                  />
                </g>
              )
            })()}
          </svg>
        </div>

        {/* Leyenda */}
        <div style={{
          display: 'flex', gap: 16, padding: '10px 16px', flexWrap: 'wrap',
          borderTop: `1px solid ${C.border}`,
        }}>
          {[
            { color: C.green,   label: 'Finalizado / Ganador' },
            { color: '#f59e0b', label: 'En juego' },
            { color: C.border,  label: 'Pendiente', dashed: true },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width={24} height={8}>
                <line x1={0} y1={4} x2={24} y2={4}
                  stroke={item.color} strokeWidth={2}
                  strokeDasharray={item.dashed ? '4 3' : 'none'} />
              </svg>
              <span style={{ fontSize: 10, color: C.textDim }}>{item.label}</span>
            </div>
          ))}
          <span style={{ fontSize: 10, color: C.textDim, marginLeft: 'auto' }}>
            ← Arrastrá para navegar el bracket
          </span>
        </div>
      </div>

      {/* Champion overlay — fuegos artificiales + anuncio campeón */}
      {champion && createPortal(
        <div
          onClick={() => setChampion(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: 'rgba(0,0,0,0.85)', cursor: 'pointer' }}
        >
          <style>{`
            @keyframes trophy-pop { 0%{transform:scale(0) rotate(-20deg);opacity:0} 60%{transform:scale(1.2) rotate(5deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
            @keyframes firework { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-80px);opacity:0} }
            @keyframes confetti-fall { 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(120px) rotate(360deg);opacity:0} }
            .fw-particle { position:absolute; width:8px; height:8px; border-radius:50%; animation:firework 0.8s ease-out forwards; }
            .confetti-p { position:absolute; width:6px; height:10px; border-radius:2px; animation:confetti-fall 1.5s ease-in forwards; }
          `}</style>
          {/* Confetti particles */}
          {Array.from({length:30}).map((_,i)=>{
            const colors=['#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#ec4899']
            const left=Math.random()*100
            const delay=Math.random()*1.2
            const color=colors[i%colors.length]
            return <div key={i} className="confetti-p" style={{left:`${left}%`,top:'-10px',background:color,animationDelay:`${delay}s`,animationDuration:`${1.2+Math.random()}s`}} />
          })}
          {/* Firework bursts */}
          {Array.from({length:12}).map((_,i)=>{
            const colors=['#f59e0b','#10b981','#ef4444','#8b5cf6']
            const angle=(i/12)*360
            const dist=60+Math.random()*40
            const x=Math.cos(angle*Math.PI/180)*dist
            const y=Math.sin(angle*Math.PI/180)*dist
            return <div key={i} className="fw-particle" style={{left:'calc(50% - 4px)',top:'calc(30% - 4px)',background:colors[i%colors.length],transform:`translate(${x}px,${y}px)`,animationDelay:`${Math.random()*0.3}s`}} />
          })}
          <div style={{ animation: 'trophy-pop 0.6s cubic-bezier(.34,1.56,.64,1) forwards', textAlign: 'center', padding: '32px 40px', background: 'linear-gradient(135deg,#1a1a2e,#16213e)', borderRadius: 28, border: '2px solid #f59e0b44', boxShadow: '0 0 60px #f59e0b44', maxWidth: 340, width: '90%' }}>
            <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 8 }}>🏆</div>
            <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>¡¡Campeón!!</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 4, lineHeight: 1.2 }}>{champion.name}</div>
            <div style={{ fontSize: 13, color: '#ffffff66', marginBottom: 20 }}>{tournamentName || 'Torneo'}</div>
            <div style={{ fontSize: 11, color: '#ffffff44' }}>Tocá para cerrar</div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
