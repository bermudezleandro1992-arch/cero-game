import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { C } from '../theme'

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  inscripcion: { label: 'Inscripción', color: C.green,     bg: `${C.green}18`  },
  en_curso:    { label: 'En Curso',    color: '#fb8c00',   bg: '#fb8c0018'     },
  finalizado:  { label: 'Finalizado',  color: C.textDim,   bg: C.panel2        },
  cancelado:   { label: 'Cancelado',   color: C.red,       bg: `${C.red}18`    },
}

const GAMES  = ['FC 26', 'FC 25', 'eFootball', 'FIFA', 'Warzone', 'Otro']
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

// ── Rankings ──────────────────────────────────────────────────────────────────
function RankingsSection() {
  const [rankType, setRankType] = useState('general')
  const TYPES = [
    { id: 'general', label: '🌍 General' },
    { id: 'pais', label: '🇦🇷 País' },
    { id: 'zona', label: '🗺️ Zona' },
    { id: 'plataforma', label: '🎮 Plataforma' },
  ]

  const mockRanking = [
    { pos: 1, name: 'ElCrack99', pts: 2840, pais: '🇦🇷', plat: 'PS5', wins: 28, color: '#f59e0b' },
    { pos: 2, name: 'Xavi_Pro',  pts: 2610, pais: '🇪🇸', plat: 'PC',  wins: 24, color: '#94a3b8' },
    { pos: 3, name: 'Draka_FUT', pts: 2390, pais: '🇲🇽', plat: 'PS5', wins: 21, color: '#b45309' },
    { pos: 4, name: 'Leo_Goal',  pts: 2100, pais: '🇦🇷', plat: 'PC',  wins: 19, color: C.textDim },
    { pos: 5, name: 'TikiTaka',  pts: 1980, pais: '🇧🇷', plat: 'Xbox',wins: 17, color: C.textDim },
  ]

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mockRanking.map(r => (
          <div key={r.pos} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: r.pos <= 3 ? `${r.color}10` : C.panel,
            border: `1px solid ${r.pos <= 3 ? r.color + '33' : C.border}`,
            borderRadius: 12, padding: '12px 14px',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: r.pos <= 3 ? `${r.color}22` : C.panel2,
              border: `1.5px solid ${r.pos <= 3 ? r.color : C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 14, color: r.pos <= 3 ? r.color : C.textDim,
            }}>{r.pos <= 3 ? ['🥇','🥈','🥉'][r.pos-1] : r.pos}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{r.name}</div>
              <div style={{ color: C.textDim, fontSize: 11, marginTop: 1 }}>{r.pais} · {r.plat} · {r.wins} victorias</div>
            </div>
            <div style={{ color: r.pos <= 3 ? r.color : C.text, fontWeight: 800, fontSize: 15 }}>{r.pts.toLocaleString()}</div>
          </div>
        ))}
        <p style={{ textAlign: 'center', color: C.textDim, fontSize: 11, margin: '4px 0 0' }}>
          Rankings en tiempo real — próximamente conectados a torneos reales
        </p>
      </div>
    </div>
  )
}

// ── Tournaments List ──────────────────────────────────────────────────────────
function TournamentsList({ profile }) {
  const { setActiveConversation } = useChatStore()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState('all')
  const [tName, setTName] = useState('')
  const [tGame, setTGame] = useState('FC 26')
  const [tFormat, setTFormat] = useState('1vs1')
  const [tMaxPl, setTMaxPl] = useState('16')
  const [tDeadline, setTDeadline] = useState('')
  const [tType, setTType] = useState('tournament')
  const [creating, setCreating] = useState(false)

  const TYPE_CFG = {
    tournament: { icon: '🏆', label: 'Torneo' },
    liga:       { icon: '📋', label: 'Liga' },
    clan:       { icon: '⚔️', label: 'Clanes' },
    bracket:    { icon: '🔱', label: 'Bracket' },
  }

  useEffect(() => { loadTournaments() }, [profile?.id])

  async function loadTournaments() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('conversations')
      .select('id, name, description, created_at, created_by, group_type, status')
      .eq('group_type', 'tournament')
      .order('created_at', { ascending: false })

    if (rows) {
      const enriched = await Promise.all(rows.map(async (t) => {
        const { count } = await supabase.from('conversation_members')
          .select('*', { count: 'exact', head: true }).eq('conversation_id', t.id)
        return { ...t, memberCount: count || 0 }
      }))
      setTournaments(enriched)
    }
    setLoading(false)
  }

  async function handleCreate() {
    if (!tName.trim()) return
    setCreating(true)
    try {
      const typeLabel = TYPE_CFG[tType]?.label || 'Torneo'
      const desc = `${typeLabel} · ${tGame} · ${tFormat} · Hasta ${tMaxPl} jugadores${tDeadline ? ` · Cierre: ${tDeadline}` : ''}`
      const { data: conv } = await supabase.from('conversations')
        .insert({ name: tName.trim(), is_group: true, group_type: 'tournament', description: desc, created_by: profile.id })
        .select().single()
      if (conv) {
        await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: profile.id })
        await supabase.from('topics').insert([
          { conversation_id: conv.id, name: 'Anuncios',   emoji: '📢', topic_type: 'announcements', position: 0 },
          { conversation_id: conv.id, name: 'Chat',       emoji: '💬', topic_type: 'chat',          position: 1 },
          { conversation_id: conv.id, name: 'Resultados', emoji: '📸', topic_type: 'chat',          position: 2 },
        ])
        await supabase.from('messages').insert({
          conversation_id: conv.id, sender_id: profile.id, type: 'system',
          content: `${TYPE_CFG[tType]?.icon || '🏆'} ${typeLabel} "${tName.trim()}" creado · ${tGame} ${tFormat}`,
        })
        await loadTournaments()
        setShowCreate(false)
        setTName(''); setTGame('FC 26'); setTFormat('1vs1'); setTMaxPl('16'); setTDeadline('')
      }
    } catch (e) { alert(`Error: ${e.message}`) }
    setCreating(false)
  }

  async function joinTournament(id) {
    const already = await supabase.from('conversation_members').select('conversation_id')
      .eq('conversation_id', id).eq('user_id', profile.id).maybeSingle()
    if (already.data) {
      setActiveConversation({ id, isGroup: true, isTournament: true, name: tournaments.find(t => t.id === id)?.name })
      return
    }
    await supabase.from('conversation_members').insert({ conversation_id: id, user_id: profile.id })
    alert('¡Inscripto!')
    await loadTournaments()
  }

  const filtered = filter === 'all' ? tournaments : tournaments.filter(t => t.status === filter)
  const inp = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: '10px 12px', outline: 'none', width: '100%', boxSizing: 'border-box' }

  return (
    <div>
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
        <button onClick={() => setShowCreate(v => !v)} style={{
          background: showCreate ? `${C.green}22` : C.green,
          border: 'none', borderRadius: 10,
          color: showCreate ? C.green : C.bg,
          fontSize: 13, fontWeight: 700, padding: '8px 16px', cursor: 'pointer',
        }}>{showCreate ? '✕ Cancelar' : '+ Crear'}</button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, color: C.green, fontWeight: 700, fontSize: 14 }}>🏆 Crear competencia</p>
          {/* Type */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(TYPE_CFG).map(([key, cfg]) => (
              <button key={key} onClick={() => setTType(key)} type="button" style={{
                background: tType === key ? `${C.green}20` : C.panel,
                border: `1.5px solid ${tType === key ? C.green : C.border}`,
                borderRadius: 10, color: tType === key ? C.green : C.text2,
                fontSize: 13, fontWeight: 700, padding: '6px 12px', cursor: 'pointer',
              }}>{cfg.icon} {cfg.label}</button>
            ))}
          </div>
          <input value={tName} onChange={e => setTName(e.target.value)} placeholder={`Nombre del ${TYPE_CFG[tType]?.label || 'torneo'} *`} style={inp} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <select value={tGame} onChange={e => setTGame(e.target.value)} style={inp}>
              {GAMES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={tFormat} onChange={e => setTFormat(e.target.value)} style={inp}>
              {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input value={tMaxPl} onChange={e => setTMaxPl(e.target.value)} placeholder="Máx. participantes" type="number" style={inp} />
            <input value={tDeadline} onChange={e => setTDeadline(e.target.value)} type="date" style={inp} />
          </div>
          <button onClick={handleCreate} disabled={creating || !tName.trim()} style={{
            background: creating || !tName.trim() ? C.panel : C.green, border: 'none',
            borderRadius: 10, color: C.bg, fontWeight: 700, fontSize: 14,
            padding: '12px', cursor: 'pointer',
          }}>{creating ? 'Creando...' : `${TYPE_CFG[tType]?.icon} Crear ${TYPE_CFG[tType]?.label}`}</button>
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
          return (
            <div key={t.id} style={{ background: C.panel, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <div style={{ background: `linear-gradient(135deg, ${C.greenDk}44 0%, transparent 60%)`, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: `${C.green}18`, border: `1px solid ${C.green}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏆</div>
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
              </div>
            </div>
          )
        })}
      </div>
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

export default function TournamentsPage() {
  const { profile } = useAuthStore()
  const [tab, setTab] = useState('hub')
  const [showPlanModal, setShowPlanModal] = useState(false)
  const { isCommunity } = usePlan(profile)

  function requirePlan(fn) {
    if (!isCommunity) { setShowPlanModal(true); return }
    fn()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      <style>{`
        .comm-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
        @media (min-width: 500px) { .comm-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 800px) { .comm-grid { grid-template-columns: 1fr 1fr 1fr; } }
      `}</style>

      {/* Header */}
      <div style={{ padding: '16px 16px 0', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 24 }}>🌐</span>
          <div>
            <p style={{ margin: 0, color: C.text, fontWeight: 800, fontSize: 18 }}>Comunidad</p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 11 }}>Centro de organización y competencias</p>
          </div>
          {isCommunity && (
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: '#3b82f614', color: '#3b82f6', border: '1px solid #3b82f644' }}>
              🌐 Plan Comunidad
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

      {/* Plan modal */}
      {showPlanModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }} onClick={() => setShowPlanModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.panel, borderRadius: 20, padding: 28, maxWidth: 340, width: '100%',
            border: `1px solid ${C.green}33`,
          }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 48 }}>🌐</span>
              <h3 style={{ color: C.text, margin: '8px 0 4px', fontWeight: 800 }}>Plan Comunidad</h3>
              <p style={{ color: C.textDim, fontSize: 13, margin: 0 }}>Activá el plan gratis para crear y organizar comunidades</p>
            </div>
            {['Crear torneos y ligas', 'Brackets automáticos', 'Sorteos en vivo', 'Rankings por zonas y países', 'Gestión de clanes', 'Estadísticas avanzadas'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{ color: C.text, fontSize: 13 }}>{f}</span>
              </div>
            ))}
            <button onClick={() => setShowPlanModal(false)} style={{
              width: '100%', marginTop: 16, padding: '13px', borderRadius: 12, border: 'none',
              background: C.green, color: C.bg, fontWeight: 800, fontSize: 15,
              cursor: 'pointer', boxShadow: `0 4px 20px ${C.green}44`,
            }}>Activar gratis — durante beta</button>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* ── HUB ── */}
        {tab === 'hub' && (
          <div>
            {/* Banner plan */}
            {!isCommunity && (
              <div style={{
                background: 'linear-gradient(135deg, #3b82f614, #a855f708)',
                border: '1.5px solid #3b82f644',
                borderRadius: 16, padding: '16px 18px', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <span style={{ fontSize: 32 }}>🌐</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, color: '#3b82f6', fontWeight: 800, fontSize: 14 }}>Plan Comunidad — Gratis</p>
                  <p style={{ margin: '2px 0 0', color: C.textDim, fontSize: 12 }}>Activá tu acceso para organizar torneos, ligas y clanes</p>
                </div>
                <button onClick={() => setShowPlanModal(true)} style={{
                  background: '#3b82f6', border: 'none', borderRadius: 10,
                  color: '#fff', fontWeight: 700, fontSize: 12,
                  padding: '8px 14px', cursor: 'pointer', flexShrink: 0,
                }}>Activar</button>
              </div>
            )}

            <SectionHeader icon="🚀" title="Acceso rápido" desc="Tus herramientas de comunidad" />
            <div className="comm-grid" style={{ marginBottom: 20 }}>
              <FeatureCard icon="🏆" title="Crear Torneo" desc="Organizá competencias por eliminación, grupos o liga" color={C.green} onClick={() => { requirePlan(() => setTab('torneos')) }} />
              <FeatureCard icon="📋" title="Crear Liga" desc="Sistema de puntos con tabla de posiciones" color="#3b82f6" onClick={() => requirePlan(() => setTab('torneos'))} />
              <FeatureCard icon="⚔️" title="Torneo de Clanes" desc="Enfrentá grupos de jugadores organizados en clanes" color="#a855f7" onClick={() => requirePlan(() => setTab('torneos'))} />
              <FeatureCard icon="🎲" title="Sorteo en Vivo" desc="Sorteá enfrentamientos y premios en tiempo real" color="#f59e0b" comingSoon />
              <FeatureCard icon="🔱" title="Brackets" desc="Cuadros de eliminación automáticos y visuales" color="#06b6d4" comingSoon />
              <FeatureCard icon="📊" title="Rankings" desc="Posiciones por zonas, países y plataformas" color={C.green} onClick={() => setTab('rankings')} />
            </div>

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
            {!isCommunity && <LockOverlay onRequest={() => setShowPlanModal(true)} />}
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
          <div style={{ position: 'relative' }}>
            {!isCommunity && <LockOverlay onRequest={() => setShowPlanModal(true)} />}
            <SectionHeader icon="🛠️" title="Herramientas de Organización" desc="Todo para gestionar tu comunidad" />
            <div className="comm-grid">
              <FeatureCard icon="🎲" title="Sorteo en Vivo" desc="Sorteá participantes o premios en tiempo real frente a tu comunidad" color="#f59e0b" comingSoon />
              <FeatureCard icon="🔱" title="Generador de Brackets" desc="Cuadros de eliminación directa o doble eliminación automáticos" color="#06b6d4" comingSoon />
              <FeatureCard icon="📋" title="Tabla de Posiciones" desc="Seguí el puntaje en tiempo real de tu liga" color="#3b82f6" comingSoon />
              <FeatureCard icon="🗳️" title="Votaciones" desc="Creá encuestas para tu comunidad" color="#a855f7" comingSoon />
              <FeatureCard icon="📸" title="Carga de Resultados" desc="Los jugadores suben fotos de sus resultados para validación" color={C.green} comingSoon />
              <FeatureCard icon="🤖" title="Bot de Torneos" desc="Automatizá anuncios, resultados y recordatorios vía bot" color="#f59e0b" comingSoon />
              <FeatureCard icon="🌍" title="Rankings por Zona" desc="Clasificaciones separadas por país, región o plataforma" color={C.green} onClick={() => setTab('rankings')} />
              <FeatureCard icon="🏅" title="Sistema de Premios" desc="Asigná premios y trofeos a los ganadores de tus torneos" color="#f59e0b" comingSoon />
              <FeatureCard icon="📅" title="Calendario de Eventos" desc="Programá fechas y partidos con recordatorios automáticos" color="#3b82f6" comingSoon />
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
