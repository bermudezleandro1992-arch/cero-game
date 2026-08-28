import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'

const K = 32
const INITIAL_ELO = 1000

// ELO computation from match history
function computeElo(matches) {
  const elo = {}
  const sorted = [...matches].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  sorted.forEach(m => {
    if (!m.winner_id || !m.player1_id || !m.player2_id) return
    const w = m.winner_id
    const l = w === m.player1_id ? m.player2_id : m.player1_id
    if (!elo[w]) elo[w] = INITIAL_ELO
    if (!elo[l]) elo[l] = INITIAL_ELO
    const eW = 1 / (1 + Math.pow(10, (elo[l] - elo[w]) / 400))
    elo[w] = Math.round(elo[w] + K * (1 - eW))
    elo[l] = Math.round(elo[l] + K * (0 - (1 - eW)))
  })
  return elo
}

function eloTier(elo) {
  if (elo >= 1800) return { label: 'Legend',   color: '#f59e0b', icon: '👑' }
  if (elo >= 1600) return { label: 'Master',   color: '#a855f7', icon: '💎' }
  if (elo >= 1400) return { label: 'Diamond',  color: '#06b6d4', icon: '🔷' }
  if (elo >= 1200) return { label: 'Platinum', color: '#22c55e', icon: '🥈' }
  if (elo >= 1100) return { label: 'Gold',     color: '#fbbf24', icon: '🥇' }
  return                  { label: 'Silver',   color: '#94a3b8', icon: '🪙' }
}

// Country code → flag emoji
function countryFlag(code) {
  if (!code || code.length !== 2) return ''
  const offset = 0x1F1E6 - 65
  return String.fromCodePoint(code.toUpperCase().charCodeAt(0) + offset) +
         String.fromCodePoint(code.toUpperCase().charCodeAt(1) + offset)
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )
}

function Avatar({ url, name, size = 40 }) {
  const colors = ['#e91e63','#9c27b0','#1565c0','#00838f','#2e7d32','#e65100']
  let h = 0; for (const c of (name || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  const bg = colors[Math.abs(h) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, flexShrink: 0,
      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800, color: '#fff',
    }}>
      {url ? <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : (name?.slice(0,2).toUpperCase() || '?')}
    </div>
  )
}

function EloBar({ elo }) {
  const pct = Math.max(0, Math.min(100, ((elo - 800) / (2000 - 800)) * 100))
  const tier = eloTier(elo)
  return (
    <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: 'hidden', width: '100%', marginTop: 4 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: tier.color, borderRadius: 2, transition: 'width .5s' }} />
    </div>
  )
}

function MyRankCard({ entry, isGlobal }) {
  if (!entry) return null
  const tier = eloTier(entry.elo || INITIAL_ELO)
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.green}18, ${C.green}06)`,
      border: `1px solid ${C.green}40`,
      borderRadius: 14, padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 14,
      marginBottom: 20,
    }}>
      <div style={{ position: 'relative' }}>
        <Avatar url={entry.avatar_url} name={entry.display_name} size={48} />
        {entry.country && (
          <span style={{ position: 'absolute', bottom: -4, right: -6, fontSize: 16, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.4))' }}>
            {countryFlag(entry.country)}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.textDim, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tu posición</div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginTop: 2 }}>#{entry.rank} · {entry.display_name || 'Vos'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 12 }}>{tier.icon}</span>
          <span style={{ color: tier.color, fontSize: 11, fontWeight: 700 }}>{tier.label}</span>
        </div>
        <EloBar elo={entry.elo || INITIAL_ELO} />
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ color: C.green, fontWeight: 900, fontSize: 24, fontVariantNumeric: 'tabular-nums' }}>{entry.elo || INITIAL_ELO}</div>
        <div style={{ color: C.textDim, fontSize: 10 }}>ELO</div>
        {isGlobal && (
          <div style={{ color: C.textDim, fontSize: 11, fontWeight: 600, marginTop: 4 }}>
            👥 {entry.referidos || 0} ref.
          </div>
        )}
      </div>
    </div>
  )
}

function Podium({ top3, isGlobal }) {
  if (top3.length < 1) return null
  const order = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3.length === 2 ? [top3[1], top3[0]] : [top3[0]]
  const heights = [110, 150, 90]
  const medals = ['🥈', '🥇', '🥉']
  const orderIdx = top3.length >= 3 ? [1, 0, 2] : top3.length === 2 ? [1, 0] : [0]

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 10, padding: '28px 16px 0', marginBottom: 28 }}>
      {order.map((player, i) => {
        const origIdx = orderIdx[i]
        const isFirst = origIdx === 0
        const tier = eloTier(player.elo || INITIAL_ELO)
        return (
          <div key={player.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: isFirst ? 1.2 : 1 }}>
            <span style={{ fontSize: isFirst ? 24 : 18 }}>{medals[i]}</span>
            <div style={{ position: 'relative' }}>
              <Avatar url={player.avatar_url} name={player.display_name} size={isFirst ? 58 : 46} />
              <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: 14, background: C.bg, borderRadius: '50%', padding: 1 }}>
                {tier.icon}
              </span>
              {player.country && (
                <span style={{ position: 'absolute', top: -6, left: -6, fontSize: 14, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.4))' }}>
                  {countryFlag(player.country)}
                </span>
              )}
            </div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: isFirst ? 13 : 11, textAlign: 'center', maxWidth: 76, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {player.display_name || 'Anónimo'}
            </div>
            <div style={{ color: tier.color, fontWeight: 900, fontSize: isFirst ? 15 : 12 }}>{player.elo || INITIAL_ELO} ELO</div>
            {isGlobal && (
              <div style={{ color: C.textDim, fontSize: 10, fontWeight: 600 }}>👥 {player.referidos || 0}</div>
            )}
            <div style={{
              width: '100%', minWidth: 80, height: heights[i],
              background: isFirst ? `${C.green}22` : `${C.border}88`,
              borderRadius: '8px 8px 0 0',
              border: isFirst ? `1px solid ${C.green}50` : `1px solid ${C.border}`,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10,
              boxShadow: isFirst ? `0 0 24px ${C.green}18` : 'none',
            }}>
              <span style={{ color: isFirst ? C.green : C.textDim, fontWeight: 900, fontSize: 20 }}>
                #{origIdx + 1}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function RankingPage() {
  const { profile } = useAuthStore()
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [communities, setCommunities] = useState([])
  const [filterCommunity, setFilterCommunity] = useState('global')
  const PAGE_SIZE = 25

  useEffect(() => {
    supabase.from('conversations')
      .select('id, name')
      .eq('group_type', 'community')
      .eq('is_public', true)
      .order('name')
      .limit(30)
      .then(({ data }) => setCommunities(data || []))
  }, [])

  const load = useCallback(async (pageNum = 0) => {
    setLoading(true)
    const isGlobal = filterCommunity === 'global'

    // Build match query
    let matchQuery = supabase
      .from('tournament_matches')
      .select('player1_id, player2_id, winner_id, tournament_id, created_at')
      .eq('status', 'finalizado')
      .not('winner_id', 'is', null)

    if (!isGlobal) {
      const { data: tIds } = await supabase
        .from('conversations')
        .select('id')
        .eq('community_id', filterCommunity)
        .in('group_type', ['tournament', 'liga'])
      if (tIds?.length) {
        matchQuery = matchQuery.in('tournament_id', tIds.map(t => t.id))
      } else {
        setRanking([]); setLoading(false); setHasMore(false); return
      }
    }

    const { data: matches } = await matchQuery
    if (!matches?.length) { setRanking([]); setLoading(false); setHasMore(false); return }

    const eloMap = computeElo(matches)

    const allIds = [...new Set([
      ...matches.map(m => m.player1_id),
      ...matches.map(m => m.player2_id),
    ].filter(Boolean))]

    let players = allIds.map(id => ({ id, elo: eloMap[id] || INITIAL_ELO }))
    players.sort((a, b) => b.elo - a.elo)

    const total = players.length
    const pageSlice = players.slice(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE)
    setHasMore(total > (pageNum + 1) * PAGE_SIZE)

    const ids = pageSlice.map(p => p.id)

    // Fetch profiles — try to get country field (graceful if missing)
    const { data: profiles } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, country_code')
      .in('id', ids)

    // Fetch referral counts for these users (global only)
    let refMap = {}
    if (isGlobal) {
      const { data: refs } = await supabase
        .from('referrals')
        .select('referrer_id')
        .in('referrer_id', ids)
      if (refs) {
        refs.forEach(r => { refMap[r.referrer_id] = (refMap[r.referrer_id] || 0) + 1 })
      }
    }

    const rows = pageSlice.map((p, i) => {
      const prof = profiles?.find(x => x.id === p.id) || {}
      return {
        rank: pageNum * PAGE_SIZE + i + 1,
        ...p,
        display_name: prof.display_name,
        avatar_url: prof.avatar_url,
        country: prof.country_code || null,
        referidos: refMap[p.id] || 0,
      }
    })

    setRanking(pageNum === 0 ? rows : prev => [...prev, ...rows])
    setLoading(false)
  }, [filterCommunity])

  useEffect(() => { setPage(0); load(0) }, [filterCommunity, load])

  const isGlobal = filterCommunity === 'global'
  const myEntry = profile ? ranking.find(r => r.id === profile.id) : null
  const top3 = ranking.slice(0, 3)
  const rest = ranking.slice(3)

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: C.bg }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ background: C.panel, padding: '16px', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 18, color: C.text, marginBottom: 12 }}>📊 Ranking</div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
          <button onClick={() => setFilterCommunity('global')} style={{
            padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
            background: filterCommunity === 'global' ? C.green : C.bg,
            color: filterCommunity === 'global' ? '#000' : C.textDim,
          }}>🌐 Global</button>
          {communities.map(c => (
            <button key={c.id} onClick={() => setFilterCommunity(c.id)} style={{
              padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
              background: filterCommunity === c.id ? C.green : C.bg,
              color: filterCommunity === c.id ? '#000' : C.textDim,
            }}>{c.name}</button>
          ))}
        </div>
      </div>

      {/* My position card */}
      {myEntry && (
        <div style={{ padding: '16px 16px 0' }}>
          <MyRankCard entry={myEntry} isGlobal={isGlobal} />
        </div>
      )}

      {loading && ranking.length === 0 ? <Spinner /> : (
        <>
          {top3.length > 0 && <Podium top3={top3} isGlobal={isGlobal} />}

          <div style={{ padding: '0 12px 32px' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: `40px 1fr 64px ${isGlobal ? '64px' : '80px'}`, gap: 4, padding: '6px 10px', marginBottom: 4 }}>
              {['#', 'Jugador', 'ELO', isGlobal ? 'Referidos' : 'Tier'].map((h, i) => (
                <div key={h} style={{ color: C.textDim, fontSize: 10, fontWeight: 700, textAlign: i <= 1 ? 'left' : 'center' }}>{h}</div>
              ))}
            </div>

            {rest.map((player, i) => {
              const isMe = player.id === profile?.id
              const tier = eloTier(player.elo || INITIAL_ELO)
              return (
                <div key={player.id} style={{
                  display: 'grid', gridTemplateColumns: `40px 1fr 64px ${isGlobal ? '64px' : '80px'}`,
                  gap: 4, padding: '10px 10px', borderRadius: 10, marginBottom: 3, alignItems: 'center',
                  background: isMe ? `${C.green}12` : i % 2 === 0 ? C.panel : 'transparent',
                  border: isMe ? `1px solid ${C.green}40` : '1px solid transparent',
                }}>
                  <div style={{ color: C.textDim, fontWeight: 800, fontSize: 12, textAlign: 'center' }}>
                    {player.rank}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar url={player.avatar_url} name={player.display_name} size={30} />
                      {player.country && (
                        <span style={{ position: 'absolute', bottom: -4, right: -6, fontSize: 12, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.4))' }}>
                          {countryFlag(player.country)}
                        </span>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: isMe ? C.green : C.text, fontSize: 12, fontWeight: isMe ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {player.display_name || 'Anónimo'}{isMe && <span style={{ marginLeft: 4, fontSize: 9, color: C.textDim }}>(Yo)</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                        <span style={{ fontSize: 9 }}>{tier.icon}</span>
                        <span style={{ color: tier.color, fontSize: 9, fontWeight: 700 }}>{tier.label}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ color: C.green, fontWeight: 900, textAlign: 'center', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                    {player.elo || INITIAL_ELO}
                  </div>
                  {isGlobal ? (
                    <div style={{ color: C.textDim, fontWeight: 600, textAlign: 'center', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                      👥 {player.referidos}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <span style={{ background: tier.color + '22', color: tier.color, borderRadius: 6, padding: '2px 7px', fontSize: 9, fontWeight: 700 }}>
                        {tier.icon} {tier.label}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}

            {loading && <Spinner />}

            {hasMore && !loading && (
              <button onClick={() => { const n = page + 1; setPage(n); load(n) }} style={{
                width: '100%', padding: '12px', background: C.panel, border: `1px solid ${C.border}`,
                borderRadius: 10, color: C.green, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginTop: 12,
              }}>Cargar más</button>
            )}

            {ranking.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: C.textDim }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                <div>Sin datos de ranking{!isGlobal ? ' en esta comunidad' : ''} aún</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
