import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )
}

function Avatar({ url, name, size = 40 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: C.border, flexShrink: 0,
      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4,
    }}>
      {url ? <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : '👤'}
    </div>
  )
}

// ── My rank card ──────────────────────────────────────────────────────────────
function MyRankCard({ entry }) {
  if (!entry) return null
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.green}18, ${C.green}08)`,
      border: `1px solid ${C.green}40`,
      borderRadius: 14, padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 14,
      marginBottom: 20,
    }}>
      <div style={{ fontSize: 28 }}>🎯</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
          Tu posición
        </div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>#{entry.rank}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ color: C.green, fontWeight: 900, fontSize: 22 }}>{entry.wins}</div>
        <div style={{ color: C.textDim, fontSize: 10 }}>victorias</div>
      </div>
    </div>
  )
}

// ── Podium ────────────────────────────────────────────────────────────────────
function Podium({ top3 }) {
  if (top3.length < 1) return null
  const order = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3.length === 2 ? [top3[1], top3[0]] : [top3[0]]
  const heights = [110, 140, 90]
  const medals = ['🥈', '🥇', '🥉']
  const orderIdx = top3.length >= 3 ? [1, 0, 2] : top3.length === 2 ? [1, 0] : [0]

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 8, padding: '24px 16px 0', marginBottom: 28 }}>
      {order.map((player, i) => {
        const origIdx = orderIdx[i]
        const h = heights[i]
        const isFirst = origIdx === 0
        return (
          <div key={player.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 20 }}>{medals[i]}</span>
            <Avatar url={player.avatar_url} name={player.display_name} size={isFirst ? 52 : 42} />
            <div style={{ color: C.text, fontWeight: 700, fontSize: isFirst ? 13 : 11, textAlign: 'center', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {player.display_name || 'Anónimo'}
            </div>
            <div style={{ color: C.green, fontWeight: 800, fontSize: isFirst ? 16 : 13 }}>{player.wins}V</div>
            <div style={{
              width: 80, height: h, background: isFirst ? `${C.green}30` : `${C.border}`,
              borderRadius: '6px 6px 0 0', border: isFirst ? `1px solid ${C.green}50` : `1px solid ${C.border}`,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8,
            }}>
              <span style={{ color: isFirst ? C.green : C.textDim, fontWeight: 900, fontSize: 18 }}>
                #{origIdx + 1}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RankingPage() {
  const { profile } = useAuthStore()
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [communities, setCommunities] = useState([])
  const [filterCommunity, setFilterCommunity] = useState('global')
  const PAGE_SIZE = 20

  // Load communities for filter
  useEffect(() => {
    supabase.from('conversations')
      .select('id, name')
      .eq('group_type', 'community')
      .eq('is_public', true)
      .limit(20)
      .then(({ data }) => setCommunities(data || []))
  }, [])

  const load = useCallback(async (pageNum = 0) => {
    setLoading(true)

    // Get finished matches and count wins per player
    let query = supabase
      .from('tournament_matches')
      .select('winner_id, tournament_id')
      .eq('status', 'finalizado')
      .not('winner_id', 'is', null)

    if (filterCommunity !== 'global') {
      // Get tournament ids for the selected community
      const { data: tIds } = await supabase
        .from('conversations')
        .select('id')
        .eq('community_id', filterCommunity)
        .in('group_type', ['tournament', 'liga'])
      if (tIds?.length) {
        query = query.in('tournament_id', tIds.map(t => t.id))
      } else {
        setRanking([]); setLoading(false); setHasMore(false); return
      }
    }

    const { data: matches } = await query

    if (!matches?.length) { setRanking([]); setLoading(false); setHasMore(false); return }

    // Aggregate wins
    const wins = {}
    matches.forEach(m => { wins[m.winner_id] = (wins[m.winner_id] || 0) + 1 })

    const sorted = Object.entries(wins).sort((a, b) => b[1] - a[1])
    const pageSlice = sorted.slice(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE)
    setHasMore(sorted.length > (pageNum + 1) * PAGE_SIZE)

    const ids = pageSlice.map(([id]) => id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', ids)

    // Count matches played
    const { data: played } = await supabase
      .from('tournament_matches')
      .select('player1_id, player2_id')
      .eq('status', 'finalizado')
      .or(ids.map(id => `player1_id.eq.${id},player2_id.eq.${id}`).join(','))

    const matchesPlayed = {}
    ;(played || []).forEach(m => {
      if (ids.includes(m.player1_id)) matchesPlayed[m.player1_id] = (matchesPlayed[m.player1_id] || 0) + 1
      if (ids.includes(m.player2_id)) matchesPlayed[m.player2_id] = (matchesPlayed[m.player2_id] || 0) + 1
    })

    const rows = pageSlice.map(([id, w], i) => {
      const p = profiles?.find(x => x.id === id)
      const played = matchesPlayed[id] || w
      return {
        rank: pageNum * PAGE_SIZE + i + 1,
        id, wins: w,
        played,
        losses: played - w,
        ratio: played > 0 ? Math.round((w / played) * 100) : 0,
        ...(p || {}),
      }
    })

    setRanking(pageNum === 0 ? rows : prev => [...prev, ...rows])
    setLoading(false)
  }, [filterCommunity])

  useEffect(() => { setPage(0); load(0) }, [filterCommunity, load])

  const myEntry = profile ? ranking.find(r => r.id === profile.id) : null
  const top3 = ranking.slice(0, 3)
  const rest = ranking.slice(3)

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: C.bg }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ background: C.panel, padding: '16px', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 18, color: C.text, marginBottom: 12 }}>📊 Ranking Global</div>

        {/* Community filter */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          <button onClick={() => setFilterCommunity('global')} style={{
            padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            background: filterCommunity === 'global' ? C.green : C.bg,
            color: filterCommunity === 'global' ? C.bg : C.textDim,
          }}>
            🌐 Global
          </button>
          {communities.map(c => (
            <button key={c.id} onClick={() => setFilterCommunity(c.id)} style={{
              padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
              background: filterCommunity === c.id ? C.green : C.bg,
              color: filterCommunity === c.id ? C.bg : C.textDim,
            }}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* My position */}
      {myEntry && (
        <div style={{ padding: '16px 16px 0' }}>
          <MyRankCard entry={myEntry} />
        </div>
      )}

      {loading && ranking.length === 0 ? <Spinner /> : (
        <>
          {/* Podium */}
          {top3.length > 0 && <Podium top3={top3} />}

          {/* Table */}
          <div style={{ padding: '0 16px 24px' }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 50px 50px 50px', gap: 8, padding: '8px 12px', marginBottom: 4 }}>
              {['#', 'Jugador', 'V', 'P', '%'].map(h => (
                <div key={h} style={{ color: C.textDim, fontSize: 10, fontWeight: 700, textAlign: h === 'Jugador' ? 'left' : 'center' }}>{h}</div>
              ))}
            </div>

            {rest.map((player, i) => {
              const isMe = player.id === profile?.id
              return (
                <div key={player.id} style={{
                  display: 'grid', gridTemplateColumns: '40px 1fr 50px 50px 50px', gap: 8,
                  padding: '10px 12px', borderRadius: 10, marginBottom: 4, alignItems: 'center',
                  background: isMe ? `${C.green}12` : i % 2 === 0 ? C.panel : 'transparent',
                  border: isMe ? `1px solid ${C.green}40` : '1px solid transparent',
                }}>
                  <div style={{ color: C.textDim, fontWeight: 800, fontSize: 13, textAlign: 'center' }}>
                    {player.rank}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Avatar url={player.avatar_url} name={player.display_name} size={30} />
                    <span style={{ color: isMe ? C.green : C.text, fontSize: 13, fontWeight: isMe ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {player.display_name || 'Anónimo'}
                      {isMe && <span style={{ marginLeft: 4, fontSize: 10 }}>(Yo)</span>}
                    </span>
                  </div>
                  <div style={{ color: C.green, fontWeight: 800, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{player.wins}</div>
                  <div style={{ color: '#ef4444', fontWeight: 600, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{player.losses}</div>
                  <div style={{ color: C.textDim, fontWeight: 600, textAlign: 'center', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{player.ratio}%</div>
                </div>
              )
            })}

            {loading && <Spinner />}

            {hasMore && !loading && (
              <button onClick={() => { const next = page + 1; setPage(next); load(next) }} style={{
                width: '100%', padding: '12px', background: C.panel, border: `1px solid ${C.border}`,
                borderRadius: 10, color: C.green, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginTop: 12,
              }}>
                Cargar más
              </button>
            )}

            {ranking.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: C.textDim }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                <div>Sin datos de ranking {filterCommunity !== 'global' ? 'en esta comunidad' : 'aún'}</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
