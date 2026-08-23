import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  inscripcion: { label: 'Inscripción', color: '#22c55e', bg: '#22c55e18' },
  en_curso:    { label: 'En Curso',    color: '#fb8c00', bg: '#fb8c0018' },
  finalizado:  { label: 'Finalizado',  color: '#64748b', bg: '#64748b18' },
}

const GAME_ICON = {
  efootball: '⚽', fc26: '⚽', fc27: '⚽',
  cs2: '🎯', valorant: '🎯', warzone: '🔫',
  pubg: '🔫', clashroyale: '👑', freef: '🔥',
}
function gameIcon(g) { return GAME_ICON[g] || '🎮' }

function timeAgo(ts) {
  const d = (Date.now() - new Date(ts)) / 1000
  if (d < 60)   return 'ahora'
  if (d < 3600)  return `${Math.floor(d/60)}m`
  if (d < 86400) return `${Math.floor(d/3600)}h`
  return `${Math.floor(d/86400)}d`
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
      <div style={{ width: 24, height: 24, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    </div>
  )
}

function Avatar({ url, size = 36, fallback = '👤' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: C.border,
      overflow: 'hidden', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4,
    }}>
      {url ? <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : fallback}
    </div>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero({ profile, onGoTorneos, onGoExplorar }) {
  const hour = new Date().getHours()
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
  const name = profile?.display_name?.split(' ')[0] || 'campeón'

  return (
    <div style={{
      background: `linear-gradient(145deg, #060d0a 0%, #0b1f14 50%, #091810 100%)`,
      padding: '40px 20px 44px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Glow orbs */}
      <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: `${C.green}0a`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: `${C.green}07`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '40%', left: '55%', width: 120, height: 120, borderRadius: '50%', background: `#3b82f608`, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', maxWidth: 560 }}>
        {/* Brand badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${C.green}14`, border: `1px solid ${C.green}30`, borderRadius: 20, padding: '4px 12px', marginBottom: 20 }}>
          <span style={{ fontSize: 14 }}>⚡</span>
          <span style={{ color: C.green, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>NexoTribu</span>
        </div>

        {profile ? (
          <>
            <p style={{ color: '#6ee7b7', fontSize: 13, margin: '0 0 4px', fontWeight: 600 }}>{greeting},</p>
            <h1 style={{ color: '#fff', fontSize: 'clamp(26px, 6vw, 38px)', fontWeight: 900, margin: '0 0 10px', lineHeight: 1.1 }}>
              {name} <span style={{ color: C.green }}>👋</span>
            </h1>
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 26px', lineHeight: 1.6 }}>
              La plataforma definitiva para comunidades<br/>de eFootball y FC. Tus torneos activos te esperan.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ color: '#fff', fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 900, margin: '0 0 10px', lineHeight: 1.1 }}>
              Compite. Organiza.<br/>
              <span style={{ color: C.green }}>Domina.</span>
            </h1>
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 26px', lineHeight: 1.6 }}>
              La plataforma definitiva para comunidades de eFootball y FC.<br/>Registrate gratis y empieza a competir hoy.
            </p>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={onGoTorneos} style={{
            padding: '12px 26px', background: C.green, color: '#000',
            border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer',
            boxShadow: `0 0 20px ${C.green}44`,
          }}>
            {profile ? '🏆 Mis Torneos' : '⚡ Comenzar Gratis'}
          </button>
          <button onClick={onGoExplorar} style={{
            padding: '12px 22px', background: 'rgba(255,255,255,0.06)',
            color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>
            🔭 Explorar torneos
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Section title ─────────────────────────────────────────────────────────────
function SectionTitle({ icon, label, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ color: C.text, fontSize: 15, fontWeight: 800 }}>{label}</span>
      </div>
      {action && (
        <button onClick={onAction} style={{ background: 'none', border: 'none', color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          {action} →
        </button>
      )}
    </div>
  )
}

// ── Tournament card (carrusel) ─────────────────────────────────────────────────
function TorneoCard({ torneo, onClick }) {
  const st = STATUS_CFG[torneo.tournament_status] || STATUS_CFG.inscripcion
  const icon = gameIcon(torneo.game)
  const participantes = torneo.participant_count || 0
  const max = torneo.max_participants || '∞'
  const pct = torneo.max_participants ? Math.round((participantes / torneo.max_participants) * 100) : null

  return (
    <div onClick={onClick} style={{
      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16,
      padding: '16px', cursor: 'pointer', minWidth: 220, maxWidth: 260,
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'border-color .15s, transform .15s',
      flexShrink: 0,
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = C.green; e.currentTarget.style.transform = 'translateY(-2px)' }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'none' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 30 }}>{icon}</span>
        <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 700 }}>{st.label}</span>
      </div>
      <div>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 14, lineHeight: 1.3, marginBottom: 3 }}>{torneo.name}</div>
        <div style={{ color: C.textDim, fontSize: 11 }}>{torneo.tournament_format || '—'}</div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ color: C.textDim, fontSize: 11 }}>👥 {participantes} / {max}</span>
          {pct !== null && <span style={{ color: pct > 80 ? '#ef4444' : C.green, fontSize: 11, fontWeight: 700 }}>{pct}%</span>}
        </div>
        {pct !== null && (
          <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct > 80 ? '#ef4444' : C.green, borderRadius: 2, transition: 'width .4s' }} />
          </div>
        )}
      </div>
      <button onClick={e => { e.stopPropagation(); onClick() }} style={{
        width: '100%', padding: '7px', background: `${C.green}15`, color: C.green,
        border: `1px solid ${C.green}35`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
      }}>
        Ver torneo →
      </button>
    </div>
  )
}

// ── Scrollable carrusel wrapper ────────────────────────────────────────────────
function Carrusel({ children }) {
  const ref = useRef()
  return (
    <div style={{ position: 'relative' }}>
      <div ref={ref} style={{
        display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6,
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        {children}
      </div>
    </div>
  )
}

// ── Community card ────────────────────────────────────────────────────────────
function ComunidadCard({ comunidad, onJoin }) {
  const [joined, setJoined] = useState(false)
  const [joining, setJoining] = useState(false)
  const { profile } = useAuthStore()

  async function handleJoin(e) {
    e.stopPropagation()
    if (!profile?.id || joined) return
    setJoining(true)
    await supabase.from('conversation_members').upsert({ conversation_id: comunidad.id, user_id: profile.id }, { onConflict: 'conversation_id,user_id' })
    setJoined(true)
    setJoining(false)
  }

  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: `${C.green}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, overflow: 'hidden',
        }}>
          {comunidad.avatar_url ? <img src={comunidad.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : '🌐'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comunidad.name}</div>
          <div style={{ color: C.textDim, fontSize: 11 }}>👥 {comunidad.member_count} miembros</div>
        </div>
      </div>
      {comunidad.description && (
        <div style={{ color: C.textDim, fontSize: 11, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {comunidad.description}
        </div>
      )}
      <button onClick={handleJoin} disabled={joined || joining} style={{
        padding: '8px', borderRadius: 8, border: 'none', cursor: joined ? 'default' : 'pointer',
        fontWeight: 700, fontSize: 12,
        background: joined ? `${C.border}` : `${C.green}18`,
        color: joined ? C.textDim : C.green,
        transition: 'all .2s',
      }}>
        {joining ? '...' : joined ? '✓ Unido' : '+ Unirse'}
      </button>
    </div>
  )
}

// ── Ranking row ───────────────────────────────────────────────────────────────
function RankRow({ rank, player, isMe }) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px',
      background: isMe ? `${C.green}10` : 'transparent',
      borderRadius: 10,
      borderLeft: isMe ? `3px solid ${C.green}` : '3px solid transparent',
    }}>
      <span style={{ width: 24, textAlign: 'center', fontSize: rank <= 3 ? 16 : 12, color: rank <= 3 ? undefined : C.textDim, fontWeight: 800, flexShrink: 0 }}>
        {rank <= 3 ? medals[rank - 1] : `#${rank}`}
      </span>
      <Avatar url={player.avatar_url} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: isMe ? C.green : C.text, fontSize: 13, fontWeight: isMe ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.display_name || 'Anónimo'}{isMe && <span style={{ marginLeft: 5, fontSize: 10, color: C.textDim }}>(Yo)</span>}
        </div>
        <div style={{ color: C.textDim, fontSize: 10 }}>{player.played || player.wins} partidos jugados</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ color: C.green, fontWeight: 900, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{player.wins}</div>
        <div style={{ color: C.textDim, fontSize: 10 }}>victorias</div>
      </div>
    </div>
  )
}

// ── Announcement card ─────────────────────────────────────────────────────────
function AnuncioCard({ anuncio }) {
  const author = anuncio.author || {}
  const community = anuncio.community
  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar url={author.avatar_url} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 12 }}>{author.display_name || 'Sistema'}</span>
          {community && <span style={{ color: C.textDim, fontSize: 11 }}> · {community.name}</span>}
        </div>
        <span style={{ color: C.textDim, fontSize: 10, flexShrink: 0 }}>{timeAgo(anuncio.created_at)}</span>
      </div>
      {anuncio.title && <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{anuncio.title}</div>}
      <div style={{ color: C.textDim, fontSize: 12, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
        {anuncio.content}
      </div>
    </div>
  )
}

// ── Stats strip ───────────────────────────────────────────────────────────────
function StatsStrip({ torneos, comunidades, ranking }) {
  const activos = torneos.filter(t => t.tournament_status === 'en_curso').length
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {[
        { icon: '🏆', label: 'Torneos activos', value: activos },
        { icon: '🌐', label: 'Comunidades',     value: comunidades.length },
        { icon: '🥇', label: 'Rankeados',        value: ranking.length },
      ].map(s => (
        <div key={s.label} style={{
          background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: '14px 10px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
          <div style={{ color: C.green, fontSize: 20, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
          <div style={{ color: C.textDim, fontSize: 10, marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HomePage({ onGoTorneos, onGoRanking, onGoExplorar, onGoAnuncios }) {
  const { profile } = useAuthStore()
  const [torneos,    setTorneos]    = useState([])
  const [comunidades, setComunidades] = useState([])
  const [ranking,    setRanking]    = useState([])
  const [anuncios,   setAnuncios]   = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: t }, { data: c }, { data: m }, { data: a }] = await Promise.all([
        // Torneos activos con conteo de participantes
        supabase
          .from('conversations')
          .select('id, name, game, tournament_format, tournament_status, max_participants')
          .in('group_type', ['tournament', 'liga'])
          .in('tournament_status', ['inscripcion', 'en_curso'])
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(10),

        // Comunidades públicas
        supabase
          .from('conversations')
          .select('id, name, description, avatar_url')
          .eq('group_type', 'community')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(8),

        // Matches finalizados para ranking
        supabase
          .from('tournament_matches')
          .select('winner_id')
          .eq('status', 'finalizado')
          .not('winner_id', 'is', null),

        // Últimos anuncios
        supabase
          .from('announcements')
          .select('id, title, content, created_at, author:author_id(id, display_name, avatar_url), community:conversation_id(id, name)')
          .order('created_at', { ascending: false })
          .limit(4),
      ])

      // Torneos: enrich con conteo real de participantes
      if (t?.length) {
        const ids = t.map(x => x.id)
        const { data: members } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .in('conversation_id', ids)
        const countMap = {}
        ;(members || []).forEach(m => { countMap[m.conversation_id] = (countMap[m.conversation_id] || 0) + 1 })
        setTorneos(t.map(x => ({ ...x, participant_count: countMap[x.id] || 0 })))
      }

      // Comunidades: enrich con member count y ordenar por popularidad
      if (c?.length) {
        const ids = c.map(x => x.id)
        const { data: members } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .in('conversation_id', ids)
        const countMap = {}
        ;(members || []).forEach(m => { countMap[m.conversation_id] = (countMap[m.conversation_id] || 0) + 1 })
        setComunidades(c.map(x => ({ ...x, member_count: countMap[x.id] || 0 })).sort((a, b) => b.member_count - a.member_count))
      }

      // Ranking: agregar victorias y obtener perfiles
      if (m?.length) {
        const wins = {}
        m.forEach(r => { wins[r.winner_id] = (wins[r.winner_id] || 0) + 1 })
        const top5 = Object.entries(wins).sort((a, b) => b[1] - a[1]).slice(0, 5)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', top5.map(([id]) => id))
        setRanking(top5.map(([id, w], i) => ({
          rank: i + 1, wins: w,
          ...(profiles?.find(p => p.id === id) || { id }),
        })))
      }

      setAnuncios(a || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: C.bg }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .home-scroll::-webkit-scrollbar { display: none }
      `}</style>

      <Hero profile={profile} onGoTorneos={onGoTorneos} onGoExplorar={onGoExplorar} />

      <div style={{ padding: '24px 16px 40px', maxWidth: 960, margin: '0 auto' }}>
        <style>{`
          .home-grid { display: flex; flex-direction: column; gap: 32px; }
          .home-two-col { display: grid; grid-template-columns: 1fr; gap: 32px; }
          @media (min-width: 760px) {
            .home-two-col { grid-template-columns: 1fr 1fr; }
          }
        `}</style>

        <div className="home-grid">
          {/* Stats */}
          {!loading && <StatsStrip torneos={torneos} comunidades={comunidades} ranking={ranking} />}

          {/* Torneos destacados — full width */}
          <section>
            <SectionTitle icon="🏆" label="Torneos Destacados" action="Ver todos" onAction={onGoTorneos} />
            {loading ? <Spinner /> : torneos.length === 0 ? (
              <div style={{ color: C.textDim, fontSize: 13, textAlign: 'center', padding: '28px 0' }}>No hay torneos activos</div>
            ) : (
              <div className="home-scroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>
                {torneos.map(t => (
                  <TorneoCard key={t.id} torneo={t} onClick={onGoTorneos} />
                ))}
              </div>
            )}
          </section>

          {/* 2-col: Comunidades + Ranking */}
          <div className="home-two-col">
            <section>
              <SectionTitle icon="🌐" label="Comunidades" action="Explorar" onAction={onGoExplorar} />
              {loading ? <Spinner /> : comunidades.length === 0 ? (
                <div style={{ color: C.textDim, fontSize: 13, textAlign: 'center', padding: '28px 0' }}>Sin comunidades aún</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {comunidades.slice(0, 4).map(c => (
                    <ComunidadCard key={c.id} comunidad={c} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionTitle icon="📊" label="Ranking Global" action="Ver completo" onAction={onGoRanking} />
              {loading ? <Spinner /> : ranking.length === 0 ? (
                <div style={{ color: C.textDim, fontSize: 13, textAlign: 'center', padding: '28px 0' }}>Sin datos de ranking aún</div>
              ) : (
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
                  {ranking.map(p => (
                    <RankRow key={p.id} rank={p.rank} player={p} isMe={p.id === profile?.id} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Anuncios */}
          {(anuncios.length > 0 || loading) && (
            <section>
              <SectionTitle icon="📢" label="Últimos Anuncios" action="Ver todos" onAction={onGoAnuncios} />
              {loading ? <Spinner /> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                  {anuncios.map(a => <AnuncioCard key={a.id} anuncio={a} />)}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
