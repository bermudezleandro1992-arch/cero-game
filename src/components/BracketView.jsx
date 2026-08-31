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
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import MatchResultFlow from './MatchResultFlow'

// ── Constantes de layout ──────────────────────────────────────────────────────
const CARD_W     = 200   // ancho de cada tarjeta de partido (px)
const CARD_H     = 90    // alto de cada tarjeta
const COL_GAP    = 72    // espacio horizontal entre columnas
const ROW_GAP    = 16    // espacio mínimo entre tarjetas en la misma columna
const PADDING    = 24    // padding del contenedor SVG

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

function name(profile) {
  return profile?.display_name || profile?.username || '—'
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
    .select('id, round_number, match_number, phase, player1_id, player2_id, score1, score2, winner_id, status, photo_url, loser_confirmed')
    .eq('tournament_id', tournamentId)
    .or('phase.neq.groups,phase.is.null')
    .order('round_number').order('match_number')

  if (!matches?.length) return { brackets: [], matches: [], profileMap: {} }

  // 3. Perfiles
  const userIds = [...new Set(
    matches.flatMap(m => [m.player1_id, m.player2_id]).filter(Boolean)
  )]
  const { data: profiles } = userIds.length
    ? await supabase.from('users').select('id, display_name, username, avatar_url').in('id', userIds)
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
function computeLayout(matches) {
  if (!matches.length) return { rounds: [], totalW: 0, totalH: 0 }

  // Agrupar por ronda
  const roundMap = {}
  matches.forEach(m => {
    if (!roundMap[m.round_number]) roundMap[m.round_number] = []
    roundMap[m.round_number].push(m)
  })
  const roundNums  = Object.keys(roundMap).map(Number).sort((a, b) => a - b)
  const maxRound   = Math.max(...roundNums)
  const firstCount = roundMap[roundNums[0]]?.length ?? 1

  // Altura de celda por ronda: se duplica en cada ronda siguiente
  // Ronda 1: cellH = CARD_H + ROW_GAP
  // Ronda N: cellH = cellH_r1 * 2^(N-1)
  const baseCellH = CARD_H + ROW_GAP * 2

  // Posición de cada tarjeta
  const rounds = roundNums.map((rn, ri) => {
    const ms    = roundMap[rn]
    const cellH = baseCellH * Math.pow(2, rn - roundNums[0])
    const x     = PADDING + ri * (CARD_W + COL_GAP)

    const cards = ms.map((m, mi) => {
      const y = PADDING + mi * cellH + (cellH - CARD_H) / 2
      return { match: m, x, y, cellH }
    })

    // Nombre de la fase
    const phaseKey = ms[0]?.phase ?? 'bracket'
    const label = PHASE_LABELS[phaseKey] ?? `Ronda ${rn}`
    const phaseLabel = phaseKey === 'bracket' ? `Ronda ${rn}` : label

    return { roundNum: rn, cards, x, phaseLabel }
  })

  const totalW = PADDING + roundNums.length * (CARD_W + COL_GAP) - COL_GAP + PADDING
  const totalH = PADDING + firstCount * baseCellH + PADDING

  return { rounds, totalW, totalH }
}

// ── Tarjeta de partido ────────────────────────────────────────────────────────
function MatchCard({ match, x, y, onClick }) {
  const isFinal     = match.status === 'finalizado'
  const isPending   = match.status === 'pendiente'
  const hasPlayers  = match.player1 || match.player2
  const winner1     = match.winner_id === match.player1_id
  const winner2     = match.winner_id === match.player2_id

  const borderColor = isFinal ? `${C.green}66` : isPending && !hasPlayers ? C.border : `${C.border}`

  function PlayerRow({ profile, pid, score, isWinner, isEmpty }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 8px', flex: 1,
        background: isWinner ? `${C.green}14` : 'transparent',
        borderLeft: `2px solid ${isWinner ? C.green : 'transparent'}`,
        borderRadius: isWinner ? '0 4px 4px 0' : 0,
        transition: 'background .2s',
      }}>
        {isEmpty
          ? <span style={{ fontSize: 11, color: C.textDim, fontStyle: 'italic' }}>Por definir</span>
          : <>
              <Avatar profile={profile} size={20} />
              <span style={{
                flex: 1, fontSize: 11, fontWeight: isWinner ? 800 : 600,
                color: isWinner ? C.green : C.text,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {name(profile)}
              </span>
              {score != null && (
                <span style={{
                  fontSize: 14, fontWeight: 900,
                  color: isWinner ? C.green : C.text2,
                  minWidth: 18, textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {score}
                </span>
              )}
              {score == null && isFinal && (
                <span style={{ fontSize: 12, color: C.textDim }}>—</span>
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
      {/* Sombra / fondo */}
      <rect
        x={0} y={0} width={CARD_W} height={CARD_H}
        rx={10} ry={10}
        fill={isPending && !hasPlayers ? C.panel : C.panel}
        stroke={borderColor}
        strokeWidth={1.5}
      />
      {/* Render inner content via foreignObject */}
      <foreignObject x={0} y={0} width={CARD_W} height={CARD_H}>
        <div xmlns="http://www.w3.org/1999/xhtml" style={{
          width: CARD_W, height: CARD_H,
          display: 'flex', flexDirection: 'column',
          background: 'transparent', borderRadius: 10, overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
          onClick={() => hasPlayers && onClick?.(match)}
        >
          {/* Divider superior: badge de estado */}
          <div style={{
            padding: '3px 8px',
            background: isFinal ? `${C.green}22` : C.panel2,
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px' }}>
              {match.round_number && `R${match.round_number}`}
              {match.match_number && ` · P${match.match_number}`}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
              color: isFinal ? C.green : match.status === 'en_juego' ? '#f59e0b' : C.textDim,
            }}>
              {isFinal ? '✓ Finalizado' : match.status === 'en_juego' ? '⏳ En juego' : '· Pendiente'}
            </span>
          </div>

          {/* Jugador 1 */}
          <PlayerRow
            profile={match.player1}
            pid={match.player1_id}
            score={match.score1}
            isWinner={winner1}
            isEmpty={!match.player1}
          />

          {/* Separador */}
          <div style={{ height: 1, background: C.border, flexShrink: 0 }} />

          {/* Jugador 2 */}
          <PlayerRow
            profile={match.player2}
            pid={match.player2_id}
            score={match.score2}
            isWinner={winner2}
            isEmpty={!match.player2}
          />
        </div>
      </foreignObject>
    </g>
  )
}

// ── Líneas de conexión SVG ────────────────────────────────────────────────────
function BracketLines({ rounds }) {
  const lines = []

  for (let ri = 0; ri < rounds.length - 1; ri++) {
    const currentRound = rounds[ri]
    const nextRound    = rounds[ri + 1]

    // Agrupar de a pares en la ronda actual
    for (let ci = 0; ci < currentRound.cards.length; ci += 2) {
      const cardA = currentRound.cards[ci]
      const cardB = currentRound.cards[ci + 1]
      if (!cardA) continue

      const nextIdx  = Math.floor(ci / 2)
      const nextCard = nextRound.cards[nextIdx]
      if (!nextCard) continue

      // Punto de salida de card A (derecha, centro)
      const ax1 = cardA.x + CARD_W
      const ay1 = cardA.y + CARD_H / 2

      // Punto de salida de card B (derecha, centro)
      const bx1 = cardB ? cardB.x + CARD_W : ax1
      const by1 = cardB ? cardB.y + CARD_H / 2 : ay1

      // Punto de entrada del siguiente partido (izquierda, centro)
      const nx  = nextCard.x
      const ny  = nextCard.y + CARD_H / 2

      // Punto de unión horizontal (mitad del gap)
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

// ── Componente principal ──────────────────────────────────────────────────────
export default function BracketView({ tournamentId, profile, isAdmin, onReportMatch }) {
  const [matches, setMatches]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError]       = useState(null)
  const [reportMatch, setReportMatch] = useState(null)
  const [resetModal, setResetModal]   = useState(null) // match to reset
  const [resetReason, setResetReason] = useState('')
  const [resetting, setResetting]     = useState(false)
  const scrollRef = useRef(null)

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

  // Calcular layout
  const { rounds, totalW, totalH } = computeLayout(matches)

  if (!rounds.length) return null

  return (
    <>
      {reportMatch && (
        <MatchResultFlow
          match={reportMatch}
          profile={profile}
          isAdmin={isAdmin}
          onClose={() => setReportMatch(null)}
          onUpdate={async () => {
            await load()
            // Bot: publicar resultado en el chat del torneo
            if (profile?.id) {
              const { data: mx } = await supabase.from('tournament_matches').select('*').eq('tournament_id', tournamentId)
              const m = (mx || []).find(x => x.id === reportMatch.id)
              if (m && (m.status === 'finalizado' || m.status === 'aprobado') && m.winner_id) {
                const p1n = reportMatch.player1?.display_name || reportMatch.player1?.username || 'Jugador 1'
                const p2n = reportMatch.player2?.display_name || reportMatch.player2?.username || 'Jugador 2'
                const winner = m.winner_id === m.player1_id ? p1n : p2n
                await supabase.from('messages').insert({
                  conversation_id: tournamentId,
                  sender_id: profile.id,
                  content: `🏆 *Resultado confirmado*\n\n${p1n} ${m.score1} — ${m.score2} ${p2n}\n\n✅ Avanza: *${winner}*`,
                  type: 'text',
                })
              }
            }
          }}
        />
      )}

      {/* Modal resetear partido específico */}
      {resetModal && (
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
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minHeight: 0 }}>

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
            <SelectMatchToReset
              matches={matches}
              onSelect={m => setResetModal(m)}
            />
          )}
        </div>

        {/* Encabezados de ronda */}
        <div style={{
          overflowX: 'auto', flexShrink: 0,
          scrollbarWidth: 'none',
        }}>
          <div style={{ display: 'flex', paddingLeft: PADDING, minWidth: totalW }}>
            {rounds.map(r => (
              <div key={r.roundNum} style={{
                width: CARD_W, marginRight: COL_GAP, flexShrink: 0,
                textAlign: 'center',
              }}>
                <span style={{
                  display: 'inline-block', padding: '3px 12px', borderRadius: 20,
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.5px',
                  background: r.phaseLabel === 'Final' ? `${C.green}22` : C.panel2,
                  color: r.phaseLabel === 'Final' ? C.green : C.textDim,
                  border: `1px solid ${r.phaseLabel === 'Final' ? `${C.green}44` : C.border}`,
                }}>
                  {r.phaseLabel}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* SVG del bracket — scroll horizontal en mobile, escala en desktop */}
        <div
          ref={scrollRef}
          style={{
            overflowX: 'auto', overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            cursor: 'grab',
            flex: 1,
          }}
          onMouseDown={e => {
            const el = scrollRef.current
            let x = e.pageX - el.offsetLeft
            let sL = el.scrollLeft
            const onMove = ev => { el.scrollLeft = sL - (ev.pageX - el.offsetLeft - x) }
            const onUp   = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
            window.addEventListener('mousemove', onMove)
            window.addEventListener('mouseup', onUp)
          }}
        >
          <svg
            width={totalW}
            height={Math.max(totalH, 200)}
            viewBox={`0 0 ${totalW} ${Math.max(totalH, 200)}`}
            style={{ display: 'block', userSelect: 'none', minWidth: totalW }}
          >
            {/* Líneas de conexión (debajo de las tarjetas) */}
            <BracketLines rounds={rounds} />

            {/* Tarjetas de partido */}
            {rounds.flatMap(r =>
              r.cards.map(({ match, x, y }) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  x={x} y={y}
                  onClick={handleCardClick}
                />
              ))
            )}
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
    </>
  )
}
