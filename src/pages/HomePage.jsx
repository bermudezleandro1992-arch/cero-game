import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  inscripcion: { label: 'Inscripción', color: '#22c55e', bg: '#22c55e18' },
  en_curso:    { label: 'En Curso',    color: '#fb8c00', bg: '#fb8c0018' },
  finalizado:  { label: 'Finalizado',  color: '#64748b', bg: '#64748b18' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { label: status, color: C.textDim, bg: C.border }
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, borderRadius: 20,
      padding: '2px 9px', fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
    }}>
      {cfg.label}
    </span>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
      <div style={{ width: 24, height: 24, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )
}

// ── Trophy icon ───────────────────────────────────────────────────────────────
function TrophyIcon({ size = 20, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || C.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
    </svg>
  )
}

// ── Hero section ──────────────────────────────────────────────────────────────
function Hero({ profile, onGoTorneos }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, #0a0a1a 0%, #0d1f14 60%, #0a1510 100%)`,
      padding: '48px 24px 40px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative circles */}
      <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: `${C.green}08`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, borderRadius: '50%', background: `${C.green}06`, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <TrophyIcon size={18} />
          <span style={{ color: C.green, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            NexoTribu
          </span>
        </div>
        <h1 style={{ color: C.text, fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 900, margin: '0 0 10px', lineHeight: 1.15 }}>
          Compite. Organiza.<br />
          <span style={{ color: C.green }}>Domina.</span>
        </h1>
        <p style={{ color: C.textDim, fontSize: 14, margin: '0 0 24px', lineHeight: 1.6, maxWidth: 400 }}>
          {profile
            ? `Hola, ${profile.display_name || 'campeón'}. Tus torneos activos te esperan.`
            : 'La plataforma de torneos y comunidades gaming. Registrate gratis y empieza a competir hoy.'}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={onGoTorneos} style={{
            padding: '11px 24px', background: C.green, color: C.bg, border: 'none',
            borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer',
          }}>
            {profile ? 'Mis Torneos' : 'Comenzar Gratis'}
          </button>
          <button onClick={onGoTorneos} style={{
            padding: '11px 24px', background: 'transparent', color: C.text,
            border: `1px solid ${C.border}`, borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>
            Explorar torneos
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionTitle({ icon, label, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
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

// ── Tournament card ───────────────────────────────────────────────────────────
function TorneoCard({ torneo, onClick }) {
  const game = torneo.game || '🎮'
  const gameIcon = game === 'efootball' ? '⚽' : game.startsWith('fc') ? '⚽' : game === 'cs2' ? '🎯' : game === 'valorant' ? '🎯' : '🎮'

  return (
    <div onClick={onClick} style={{
      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s',
      minWidth: 220,
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = C.green}
    onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 28 }}>{gameIcon}</div>
        <StatusBadge status={torneo.tournament_status || torneo.status} />
      </div>
      <div style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 4, lineHeight: 1.3 }}>
        {torneo.name}
      </div>
      <div style={{ color: C.textDim, fontSize: 11, marginBottom: 12 }}>
        {torneo.tournament_format || torneo.format || '—'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: C.textDim, fontSize: 11 }}>
          👥 {(torneo.members || []).length} / {torneo.max_participants || '∞'}
        </span>
        <span style={{ color: C.green, fontSize: 11, fontWeight: 700 }}>Ver →</span>
      </div>
    </div>
  )
}

// ── Community card ────────────────────────────────────────────────────────────
function ComunidadCard({ comunidad, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: '14px 16px', cursor: 'pointer', minWidth: 200,
      transition: 'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = C.green}
    onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: `${C.green}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          overflow: 'hidden', flexShrink: 0,
        }}>
          {comunidad.avatar_url
            ? <img src={comunidad.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : '👥'}
        </div>
        <div>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{comunidad.name}</div>
          <div style={{ color: C.textDim, fontSize: 11 }}>
            {comunidad.member_count || 0} miembros
          </div>
        </div>
      </div>
      {comunidad.description && (
        <div style={{ color: C.textDim, fontSize: 11, lineHeight: 1.5, marginBottom: 10, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {comunidad.description}
        </div>
      )}
      <button onClick={e => { e.stopPropagation(); onClick() }} style={{
        width: '100%', padding: '7px', background: `${C.green}18`, color: C.green,
        border: `1px solid ${C.green}40`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
      }}>
        Ver comunidad
      </button>
    </div>
  )
}

// ── Ranking row ───────────────────────────────────────────────────────────────
function RankRow({ rank, player }) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ width: 24, textAlign: 'center', fontSize: rank <= 3 ? 16 : 13, color: rank <= 3 ? undefined : C.textDim, fontWeight: 800 }}>
        {rank <= 3 ? medals[rank - 1] : `#${rank}`}
      </span>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', background: C.border, flexShrink: 0,
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
      }}>
        {player.avatar_url ? <img src={player.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.text, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.display_name || 'Anónimo'}
        </div>
        <div style={{ color: C.textDim, fontSize: 10 }}>{player.wins || 0} victorias</div>
      </div>
      <div style={{ color: C.green, fontWeight: 800, fontSize: 14 }}>
        {player.wins || 0}
        <span style={{ color: C.textDim, fontWeight: 400, fontSize: 10, marginLeft: 2 }}>V</span>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HomePage({ onGoTorneos, onGoRanking, onGoExplorar }) {
  const { profile } = useAuthStore()
  const [torneos, setTorneos] = useState([])
  const [comunidades, setComunidades] = useState([])
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: t }, { data: c }, { data: m }] = await Promise.all([
        // Featured tournaments: active, most participants
        supabase
          .from('conversations')
          .select('id, name, game, tournament_format, format, tournament_status, status, max_participants, members:conversation_members(user_id)')
          .in('group_type', ['tournament', 'liga'])
          .in('tournament_status', ['inscripcion', 'en_curso'])
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(8),

        // Popular communities
        supabase
          .from('conversations')
          .select('id, name, description, avatar_url, is_public')
          .eq('group_type', 'community')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(6),

        // Global ranking: top wins from finished matches
        supabase
          .from('tournament_matches')
          .select('winner_id')
          .eq('status', 'finalizado')
          .not('winner_id', 'is', null),
      ])

      setTorneos(t || [])

      // Enrich communities with member counts
      if (c?.length) {
        const ids = c.map(x => x.id)
        const { data: counts } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .in('conversation_id', ids)
        const countMap = {}
        ;(counts || []).forEach(r => { countMap[r.conversation_id] = (countMap[r.conversation_id] || 0) + 1 })
        setComunidades(c.map(x => ({ ...x, member_count: countMap[x.id] || 0 })).sort((a, b) => b.member_count - a.member_count))
      } else {
        setComunidades([])
      }

      // Build ranking from wins
      if (m?.length) {
        const wins = {}
        m.forEach(r => { wins[r.winner_id] = (wins[r.winner_id] || 0) + 1 })
        const top = Object.entries(wins).sort((a, b) => b[1] - a[1]).slice(0, 5)
        const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', top.map(([id]) => id))
        setRanking(top.map(([id, wins], i) => ({
          rank: i + 1, wins,
          ...(profiles?.find(p => p.id === id) || { id }),
        })))
      }

      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: C.bg }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <Hero profile={profile} onGoTorneos={onGoTorneos} />

      <div style={{ padding: '24px 16px', maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Featured tournaments */}
        <section>
          <SectionTitle icon="🏆" label="Torneos Destacados" action="Ver todos" onAction={onGoTorneos} />
          {loading
            ? <Spinner />
            : torneos.length === 0
            ? <div style={{ color: C.textDim, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No hay torneos activos por ahora</div>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {torneos.slice(0, 6).map(t => (
                  <TorneoCard key={t.id} torneo={t} onClick={onGoTorneos} />
                ))}
              </div>
            )
          }
        </section>

        {/* Popular communities */}
        {(comunidades.length > 0 || loading) && (
          <section>
            <SectionTitle icon="👥" label="Comunidades Populares" action="Explorar" onAction={onGoExplorar} />
            {loading
              ? <Spinner />
              : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {comunidades.slice(0, 4).map(c => (
                    <ComunidadCard key={c.id} comunidad={c} onClick={onGoExplorar} />
                  ))}
                </div>
              )
            }
          </section>
        )}

        {/* Global ranking */}
        <section>
          <SectionTitle icon="📊" label="Ranking Global" action="Ver completo" onAction={onGoRanking} />
          {loading
            ? <Spinner />
            : ranking.length === 0
            ? <div style={{ color: C.textDim, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Sin datos de ranking aún</div>
            : (
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '4px 16px' }}>
                {ranking.map(p => <RankRow key={p.id} rank={p.rank} player={p} />)}
              </div>
            )
          }
        </section>

        {/* Stats strip */}
        <section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { icon: '🏆', label: 'Torneos activos', value: torneos.filter(t => t.tournament_status === 'en_curso').length },
              { icon: '👥', label: 'Comunidades', value: comunidades.length },
              { icon: '🥇', label: 'Jugadores rankeados', value: ranking.length },
            ].map(s => (
              <div key={s.label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ color: C.green, fontSize: 22, fontWeight: 900 }}>{s.value}</div>
                <div style={{ color: C.textDim, fontSize: 10, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
