import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'
import TournamentDashboard from '../components/TournamentDashboard'
import { useSubscription } from '../hooks/useSubscription'

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  inscripcion: { label: 'Inscripción', color: '#22c55e', bg: '#22c55e18', dot: '#22c55e' },
  en_curso:    { label: 'En Curso',    color: '#fb8c00', bg: '#fb8c0018', dot: '#fb8c00' },
  finalizado:  { label: 'Finalizado',  color: '#64748b', bg: '#64748b18', dot: '#64748b' },
  cancelado:   { label: 'Cancelado',   color: '#ef4444', bg: '#ef444418', dot: '#ef4444' },
}

const FORMAT_LABELS = {
  eliminatorias:    'Eliminación directa',
  bracket:          'Bracket completo',
  grupos:           'Fase de grupos',
  grupos_playoffs:  'Grupos + Playoffs',
  copa:             'Copa',
  todos_todos:      'Liga todos vs todos',
}

const GAME_ICONS = {
  efootball: '⚽', fc26: '⚽', fc27: '⚽',
  cs2: '🎯', valorant: '🎯', warzone: '🔫',
  pubg: '🔫', clashroyale: '👑', freef: '🔥',
}
function gameIcon(g) { return GAME_ICONS[g] || '🎮' }

const FILTER_TABS = [
  { id: 'all',        label: 'Todos' },
  { id: 'active',     label: 'Activos' },
  { id: 'espera',     label: 'En espera' },
  { id: 'finalizado', label: 'Finalizados' },
]

const TYPE_CFG = {
  tournament: { label: 'Torneo',          icon: '🏆', color: '#f59e0b' },
  liga:       { label: 'Liga',            icon: '📋', color: '#3b82f6' },
  guerra:     { label: 'Guerra de Clanes', icon: '⚔️', color: '#ef4444' },
}

const FORMATS_TORNEO = [
  { id: 'eliminatorias',   label: 'Eliminación directa' },
  { id: 'bracket',         label: 'Bracket completo' },
  { id: 'grupos',          label: 'Fase de grupos' },
  { id: 'grupos_playoffs', label: 'Grupos + Playoffs' },
  { id: 'copa',            label: 'Copa (eliminatoria)' },
  { id: 'suizo',           label: 'Sistema Suizo' },
]

const FORMATS_LIGA = [
  { id: 'todos_todos',  label: 'Todos contra todos (1 vuelta)' },
  { id: 'ida_vuelta',   label: 'Ida y vuelta (2 vueltas)' },
  { id: 'liga_playoffs',label: 'Liga + Playoffs finales' },
]

const FORMATS_GUERRA = [
  { id: 'eliminatorias', label: 'Eliminación directa' },
  { id: 'grupos_final',  label: 'Grupos + Final' },
  { id: 'liga_clanes',   label: 'Liga de clanes' },
]

// Keep old FORMATS for backward compat in cards
const FORMATS = FORMATS_TORNEO

const SIZES = [4, 8, 16, 32, 64]

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.inscripcion
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: cfg.bg, color: cfg.color,
      borderRadius: 20, padding: '3px 10px',
      fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
      {cfg.label}
    </span>
  )
}

// ── Tournament card ───────────────────────────────────────────────────────────
function TorneoCard({ torneo, myId, onVer, onDelete }) {
  const isCreator = torneo.created_by === myId
  const typeCfg = TYPE_CFG[torneo.group_type] || TYPE_CFG.tournament
  const fmt = FORMAT_LABELS[torneo.tournament_format] || torneo.tournament_format || '—'
  const icon = gameIcon(torneo.game)
  const pct = torneo.max_participants ? Math.round((torneo.participant_count / torneo.max_participants) * 100) : null

  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16,
      padding: '16px', display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'border-color .15s, box-shadow .15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = C.green; e.currentTarget.style.boxShadow = `0 0 0 1px ${C.green}20` }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 28 }}>{icon}</span>
          <span style={{
            background: `${typeCfg.color}18`, color: typeCfg.color,
            borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700,
          }}>{typeCfg.icon} {typeCfg.label}</span>
        </div>
        <StatusBadge status={torneo.tournament_status} />
      </div>

      {/* Name */}
      <div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 15, lineHeight: 1.3, marginBottom: 3 }}>
          {torneo.name}
        </div>
        <div style={{ color: C.textDim, fontSize: 11 }}>{fmt}</div>
      </div>

      {/* Participants bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ color: C.textDim, fontSize: 11 }}>
            👥 {torneo.participant_count} / {torneo.max_participants || '∞'} jugadores
          </span>
          {torneo._role === 'owner' || isCreator
            ? <span style={{ color: '#f59e0b', fontSize: 10, fontWeight: 700 }}>🛡 Organizo</span>
            : <span style={{ color: C.green, fontSize: 10, fontWeight: 700 }}>✅ Participo</span>
          }
        </div>
        {pct !== null && (
          <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
            <div style={{
              height: '100%', width: `${Math.min(pct, 100)}%`,
              background: pct >= 100 ? '#ef4444' : pct > 75 ? '#fb8c00' : C.green,
              borderRadius: 2, transition: 'width .4s',
            }} />
          </div>
        )}
      </div>

      {/* Meta */}
      <div style={{ color: C.textDim, fontSize: 10 }}>
        {torneo.platform && <span style={{ marginRight: 10 }}>🎮 {torneo.platform}</span>}
        <span>📅 {new Date(torneo.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onVer(torneo)} style={{
          flex: 1, padding: '9px', background: C.green, color: '#000',
          border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          Ver torneo →
        </button>
        {isCreator && (
          <button onClick={() => onDelete(torneo)} style={{
            padding: '9px 12px', background: '#ef444412', color: '#ef4444',
            border: '1px solid #ef444430', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            🗑
          </button>
        )}
      </div>
    </div>
  )
}

// ── Plan badge ────────────────────────────────────────────────────────────────
const PLAN_CFG = {
  free: { label: 'FREE',  color: '#6b7280', bg: '#6b728020' },
  vip:  { label: 'VIP ⭐', color: '#f59e0b', bg: '#f59e0b20' },
  pro:  { label: 'PRO 💎', color: '#8b5cf6', bg: '#8b5cf620' },
}

function PlanBadge({ plan }) {
  const cfg = PLAN_CFG[plan] || PLAN_CFG.free
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      borderRadius: 6, padding: '2px 8px',
      fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
    }}>{cfg.label}</span>
  )
}

// ── Upgrade notice ────────────────────────────────────────────────────────────
function UpgradeNotice({ reason, onViewPlans }) {
  return (
    <div style={{
      background: '#ef444412', border: '1px solid #ef444430',
      borderRadius: 12, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>⚠️ {reason}</div>
      <button onClick={onViewPlans} style={{
        padding: '8px 14px', background: '#f59e0b', color: '#000',
        border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer', alignSelf: 'flex-start',
      }}>Ver planes →</button>
    </div>
  )
}

// ── Create modal ──────────────────────────────────────────────────────────────
export function CreateTorneoModal({ onClose, onCreated, defaultCommunityId, onViewPlans = () => window.dispatchEvent(new CustomEvent('open-vip-page')) }) {
  return <CreateModal onClose={onClose} onCreated={onCreated} onViewPlans={onViewPlans} defaultCommunityId={defaultCommunityId} />
}

function CreateModal({ onClose, onCreated, defaultCommunityId, onViewPlans = () => window.dispatchEvent(new CustomEvent('open-vip-page')) }) {
  const { profile } = useAuthStore()
  const sub = useSubscription(profile?.id)
  const [name,        setName]        = useState('')
  const [type,        setType]        = useState('tournament')
  const [format,      setFormat]      = useState('eliminatorias')
  const [maxPl,       setMaxPl]       = useState(Math.min(8, sub.limits.jugadores))
  const [communityId, setCommunityId] = useState(defaultCommunityId || '')
  const [isPublic,    setIsPublic]    = useState(true)
  const [game,        setGame]        = useState('')
  const [communities, setCommunities] = useState([])
  const [busy,        setBusy]        = useState(false)
  const [err,         setErr]         = useState('')
  const [upgradeReason, setUpgradeReason] = useState(null)
  const [joinAsPlayer,  setJoinAsPlayer]  = useState(false)
  const [autoStartOnFull, setAutoStartOnFull] = useState(false)
  const [autoStartDelay,  setAutoStartDelay]  = useState(60)
  // Liga extras
  const [ligaJornadas,    setLigaJornadas]    = useState('')
  const [ligaAscensos,    setLigaAscensos]    = useState(false)
  const [ligaTemporada,   setLigaTemporada]   = useState('')
  // Guerra extras
  const [guerraMode,      setGuerraMode]      = useState('3vs3')

  // Sync maxPl with plan limits when plan loads
  useEffect(() => {
    setMaxPl(prev => Math.min(prev, sub.limits.jugadores))
  }, [sub.limits.jugadores])

  // Reset format when type changes
  useEffect(() => {
    if (type === 'liga')    setFormat('todos_todos')
    else if (type === 'guerra') setFormat('eliminatorias')
    else                   setFormat('eliminatorias')
  }, [type])

  // Load only communities where the user is admin/owner/ceo
  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('conversation_members')
      .select('conversation_id, role, conversations(id, name, group_type)')
      .eq('user_id', profile.id)
      .in('role', ['owner', 'ceo', 'admin'])
      .then(({ data }) => {
        const comms = (data || []).map(r => r.conversations).filter(c => c && c.group_type === 'community')
        const seen = new Set()
        setCommunities(comms.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true }))
      })
  }, [profile?.id])

  const availableSizes = SIZES.filter(n => n <= sub.limits.jugadores)

  async function handleCreate() {
    if (!name.trim()) { setErr('Escribí un nombre.'); return }
    const check = sub.canCreateTournament(maxPl)
    if (!check.allowed) { setUpgradeReason(check.reason); return }
    setBusy(true); setErr(''); setUpgradeReason(null)
    try {
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          name: name.trim(),
          is_group: true,
          group_type: type === 'guerra' ? 'tournament' : type,
          tournament_status: 'inscripcion',
          tournament_format: format,
          max_participants: maxPl,
          is_public: isPublic,
          created_by: profile.id,
          game: game || null,
          auto_start_on_full: autoStartOnFull,
          auto_start_delay_seconds: autoStartOnFull ? (parseInt(autoStartDelay) || 0) : 0,
          ...(type === 'guerra' ? { team_size: parseInt(guerraMode.split('vs')[0]) || 2, description: `Guerra de Clanes ${guerraMode}` } : {}),
          ...(communityId ? { community_id: communityId } : {}),
          ...(type === 'liga' && ligaTemporada ? { description: `Temporada: ${ligaTemporada}` } : {}),
        })
        .select('id')
        .single()
      if (convErr) throw convErr

      // Insert creator as owner — only if they want to play as participant
      if (joinAsPlayer) {
        await supabase.from('conversation_members').insert({
          conversation_id: conv.id,
          user_id: profile.id,
          role: 'owner',
        })
      }

      sub.refresh()
      onCreated(conv.id?.match?.(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? conv.id)
    } catch (e) {
      setErr(e.message || 'Error al crear')
      setBusy(false)
    }
  }

  const inp = {
    background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '10px 12px', color: C.text, fontSize: 14,
    width: '100%', boxSizing: 'border-box', outline: 'none',
  }
  const lbl = { display: 'block', color: C.textDim, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }

  const { limits, torneos_hoy, torneos_activos, plan } = sub

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 560,
        background: C.bg, borderRadius: '20px 20px 0 0',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        animation: 'drawerUp .22s cubic-bezier(.4,0,.2,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 16, flex: 1 }}>Crear torneo / liga</span>
          <PlanBadge plan={plan} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Plan info banner */}
          <div style={{
            background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 12, marginBottom: 2 }}>📊 Tu plan: <PlanBadge plan={plan} /></div>
              <div style={{ color: C.textDim, fontSize: 11, marginTop: 4 }}>
                Torneos hoy: <strong style={{ color: torneos_hoy >= limits.torneos_dia ? '#ef4444' : C.text }}>{torneos_hoy}/{limits.torneos_dia}</strong>
                {' · '}Activos: <strong style={{ color: torneos_activos >= limits.torneos_activos ? '#ef4444' : C.text }}>{torneos_activos}/{limits.torneos_activos}</strong>
                {' · '}Máx. jugadores: <strong style={{ color: C.text }}>{limits.jugadores >= 9999 ? '∞' : limits.jugadores}</strong>
              </div>
            </div>
            {plan !== 'pro' && (
              <button onClick={onViewPlans} style={{
                padding: '6px 12px', background: 'transparent',
                color: '#f59e0b', border: '1px solid #f59e0b50',
                borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>Ver planes →</button>
            )}
          </div>

          {upgradeReason && <UpgradeNotice reason={upgradeReason} onViewPlans={onViewPlans} />}

          {/* Tipo */}
          <div style={{ display: 'flex', gap: 6, background: C.panel, borderRadius: 12, padding: 4 }}>
            {Object.entries(TYPE_CFG).map(([k, v]) => (
              <button key={k} onClick={() => setType(k)} style={{
                flex: 1, padding: '8px', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: type === k ? C.green : 'transparent',
                color: type === k ? '#000' : C.textDim, fontWeight: 700, fontSize: 13,
              }}>{v.icon} {v.label}</button>
            ))}
          </div>

          {/* Nombre */}
          <div>
            <label style={lbl}>Nombre *</label>
            <input style={inp} placeholder="Ej: Copa Latinoamérica #1" value={name} onChange={e => setName(e.target.value)} maxLength={60} />
          </div>

          {/* Formato — varía según tipo */}
          {type !== 'liga' && (
            <div>
              <label style={lbl}>Formato</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(type === 'guerra' ? FORMATS_GUERRA : FORMATS_TORNEO).map(f => (
                  <button key={f.id} onClick={() => setFormat(f.id)} style={{
                    padding: '10px 14px', borderRadius: 10, border: `1px solid ${format === f.id ? C.green : C.border}`,
                    background: format === f.id ? `${C.green}15` : C.panel,
                    color: format === f.id ? C.green : C.text,
                    fontWeight: format === f.id ? 700 : 500, fontSize: 13,
                    cursor: 'pointer', textAlign: 'left',
                  }}>{format === f.id ? '✓ ' : ''}{f.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Liga: sistema de competencia */}
          {type === 'liga' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>Sistema de competencia</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {FORMATS_LIGA.map(f => (
                    <button key={f.id} onClick={() => setFormat(f.id)} style={{
                      padding: '10px 14px', borderRadius: 10, border: `1px solid ${format === f.id ? '#3b82f6' : C.border}`,
                      background: format === f.id ? '#3b82f615' : C.panel,
                      color: format === f.id ? '#3b82f6' : C.text,
                      fontWeight: format === f.id ? 700 : 500, fontSize: 13,
                      cursor: 'pointer', textAlign: 'left',
                    }}>{format === f.id ? '✓ ' : ''}{f.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Temporada (opcional)</label>
                  <input style={inp} placeholder="Ej: 2025/01" value={ligaTemporada} onChange={e => setLigaTemporada(e.target.value)} maxLength={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Jornadas</label>
                  <input style={inp} type="number" placeholder="Ej: 10" value={ligaJornadas} onChange={e => setLigaJornadas(e.target.value)} min={1} max={99} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: C.panel, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>Ascensos / Descensos</div>
                  <div style={{ color: C.textDim, fontSize: 11 }}>Activá si hay divisiones con ascenso y descenso</div>
                </div>
                <button onClick={() => setLigaAscensos(a => !a)} style={{
                  width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: ligaAscensos ? '#3b82f6' : C.border, position: 'relative', transition: 'background .2s', flexShrink: 0,
                }}>
                  <span style={{ position: 'absolute', top: 3, left: ligaAscensos ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', display: 'block' }} />
                </button>
              </div>
            </div>
          )}

          {/* Guerra: modo */}
          {type === 'guerra' && (
            <div>
              <label style={lbl}>Modo de guerra</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['2vs2','3vs3','4vs4','5vs5'].map(m => (
                  <button key={m} onClick={() => setGuerraMode(m)} style={{
                    padding: '8px 16px', borderRadius: 20,
                    border: `1px solid ${guerraMode === m ? '#ef4444' : C.border}`,
                    background: guerraMode === m ? '#ef444415' : C.panel,
                    color: guerraMode === m ? '#ef4444' : C.textDim,
                    fontWeight: guerraMode === m ? 700 : 500, fontSize: 13, cursor: 'pointer',
                  }}>{m}</button>
                ))}
              </div>
            </div>
          )}

          {/* Tamaño */}
          <div>
            <label style={lbl}>Máximo de participantes</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SIZES.map(n => {
                const locked = n > limits.jugadores
                return (
                  <button key={n} onClick={() => !locked && setMaxPl(n)} style={{
                    padding: '7px 14px', borderRadius: 20,
                    border: `1px solid ${maxPl === n ? C.green : locked ? C.border : C.border}`,
                    background: maxPl === n ? `${C.green}18` : locked ? `${C.border}30` : C.panel,
                    color: maxPl === n ? C.green : locked ? C.textDim : C.textDim,
                    fontWeight: maxPl === n ? 700 : 500, fontSize: 13,
                    cursor: locked ? 'not-allowed' : 'pointer',
                    opacity: locked ? 0.45 : 1,
                    position: 'relative',
                  }}>
                    {n}{locked && <span style={{ marginLeft: 4, fontSize: 9 }}>🔒</span>}
                  </button>
                )
              })}
            </div>
            {availableSizes.length < SIZES.length && (
              <div style={{ color: C.textDim, fontSize: 11, marginTop: 6 }}>
                🔒 Opciones bloqueadas. <button onClick={onViewPlans} style={{ background: 'none', border: 'none', color: '#f59e0b', fontWeight: 700, fontSize: 11, cursor: 'pointer', padding: 0 }}>Mejorá tu plan →</button>
              </div>
            )}
          </div>

          {/* Comunidad */}
          {communities.length > 0 && (
            <div>
              <label style={lbl}>Comunidad (opcional)</label>
              <select style={{ ...inp, appearance: 'none' }} value={communityId} onChange={e => setCommunityId(e.target.value)}>
                <option value="">Sin comunidad</option>
                {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Público */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: C.panel, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div>
              <div style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>¿{type === 'liga' ? 'Liga' : 'Torneo'} público?</div>
              <div style={{ color: C.textDim, fontSize: 11 }}>Cualquiera puede encontrarlo y unirse desde Explorar</div>
            </div>
            <button onClick={() => setIsPublic(p => !p)} style={{
              width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
              background: isPublic ? C.green : C.border,
              position: 'relative', transition: 'background .2s', flexShrink: 0,
            }}>
              <span style={{
                position: 'absolute', top: 3, left: isPublic ? 23 : 3,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left .2s', display: 'block',
              }} />
            </button>
          </div>

          {/* Auto-start on full */}
          <div onClick={() => setAutoStartOnFull(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
            background: C.panel, borderRadius: 10, border: `1px solid ${autoStartOnFull ? '#f59e0b' : C.border}`,
            cursor: 'pointer', userSelect: 'none',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 4, border: `2px solid ${autoStartOnFull ? '#f59e0b' : C.textDim}`,
              background: autoStartOnFull ? '#f59e0b' : 'transparent', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {autoStartOnFull && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
            </div>
            <div>
              <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>⚡ Iniciar sorteo automáticamente al completarse</div>
              <div style={{ color: C.textDim, fontSize: 11 }}>Cuando se llenen todos los cupos, el torneo arranca solo. Si está desactivado, el organizador inicia el sorteo manualmente.</div>
            </div>
          </div>

          {autoStartOnFull && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.panel, borderRadius: 10, border: `1px solid #f59e0b44` }}>
              <span style={{ fontSize: 18 }}>⏱️</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Espera antes de iniciar (segundos)</div>
                <div style={{ color: C.textDim, fontSize: 11 }}>Tiempo de cuenta regresiva antes del sorteo. 0 = inmediato.</div>
              </div>
              <input
                type="number" min="0" max="300" value={autoStartDelay}
                onChange={e => setAutoStartDelay(e.target.value)}
                onClick={e => e.stopPropagation()}
                style={{ width: 64, padding: '6px 8px', borderRadius: 8, border: `1px solid #f59e0b88`, background: C.panel2, color: C.text, fontSize: 14, fontWeight: 700, textAlign: 'center' }}
              />
            </div>
          )}

          {err && <div style={{ color: '#ef4444', fontSize: 12, fontWeight: 600 }}>{err}</div>}

          {/* Join as player option */}
          <div onClick={() => setJoinAsPlayer(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
            background: C.panel, borderRadius: 10, border: `1px solid ${joinAsPlayer ? C.green : C.border}`,
            cursor: 'pointer', userSelect: 'none',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 4, border: `2px solid ${joinAsPlayer ? C.green : C.textDim}`,
              background: joinAsPlayer ? C.green : 'transparent', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {joinAsPlayer && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
            </div>
            <div>
              <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Participar como jugador</div>
              <div style={{ color: C.textDim, fontSize: 11 }}>Te agregás como participante del torneo</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={handleCreate} disabled={busy || sub.loading} style={{
            width: '100%', padding: '13px', background: busy ? C.border : C.green,
            color: busy ? C.textDim : '#000', border: 'none', borderRadius: 10,
            fontWeight: 800, fontSize: 15, cursor: busy ? 'default' : 'pointer',
            transition: 'background .2s',
          }}>
            {busy ? 'Creando...' : `⚡ Crear ${type === 'liga' ? 'liga' : 'torneo'}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Confirm delete dialog ─────────────────────────────────────────────────────
function ConfirmDelete({ torneo, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false)
  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: '24px 20px', maxWidth: 380, width: '100%', textAlign: 'center',
      }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 8 }}>¿Eliminar torneo?</div>
        <div style={{ color: C.textDim, fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
          Vas a eliminar <strong style={{ color: C.text }}>{torneo.name}</strong>. Esta acción no se puede deshacer.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '11px', background: C.border, color: C.text,
            border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={async () => { setBusy(true); await onConfirm(); }} disabled={busy} style={{
            flex: 1, padding: '11px', background: '#ef4444', color: '#fff',
            border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer',
            opacity: busy ? 0.7 : 1,
          }}>{busy ? 'Eliminando...' : 'Eliminar'}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TorneosPage({ onNavigate }) {
  const { profile } = useAuthStore()
  const [torneos,     setTorneos]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState('all')
  const [showCreate,  setShowCreate]  = useState(false)
  const [viewing,     setViewing]     = useState(null)   // tournament obj
  const [deleting,    setDeleting]    = useState(null)   // tournament obj

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)

    // Query 1: tournaments the user created
    const { data: createdRows } = await supabase
      .from('conversations')
      .select('id, name, group_type, tournament_status, tournament_format, max_participants, game, platform, created_by, created_at, community_id')
      .in('group_type', ['tournament', 'liga'])
      .eq('created_by', profile.id)
      .order('created_at', { ascending: false })

    // Query 2: all tournament IDs the user is a member of
    const { data: memberRows } = await supabase
      .from('conversation_members')
      .select('conversation_id, role')
      .eq('user_id', profile.id)

    const createdIds = new Set((createdRows || []).map(r => r.id))
    const memberMap = {}
    ;(memberRows || []).forEach(r => { memberMap[r.conversation_id] = r.role })
    const joinedIds = Object.keys(memberMap).filter(id => !createdIds.has(id))

    let joinedRows = []
    if (joinedIds.length) {
      const { data } = await supabase
        .from('conversations')
        .select('id, name, group_type, tournament_status, tournament_format, max_participants, game, platform, created_by, created_at, community_id')
        .in('group_type', ['tournament', 'liga'])
        .in('id', joinedIds.slice(0, 200))
        .order('created_at', { ascending: false })
      joinedRows = data || []
    }

    // Merge: created (as organizer) + joined (as participant)
    const allRows = [
      ...(createdRows || []).map(r => ({ ...r, _role: memberMap[r.id] || 'owner' })),
      ...joinedRows.map(r => ({ ...r, _role: memberMap[r.id] || 'member' })),
    ]
    if (!allRows.length) { setTorneos([]); setLoading(false); return }

    const torneoRows = allRows

    // Count participants per tournament
    const torneoIds = torneoRows.map(t => t.id)
    const { data: memberCounts } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .in('conversation_id', torneoIds)

    const countMap = {}
    ;(memberCounts || []).forEach(r => {
      countMap[r.conversation_id] = (countMap[r.conversation_id] || 0) + 1
    })

    setTorneos(torneoRows.map(t => ({ ...t, participant_count: countMap[t.id] || 0 })))
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  // Realtime: reload when conversations or members change
  useEffect(() => {
    if (!profile?.id) return
    const ch = supabase.channel('torneos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile?.id, load])

  async function handleDelete(torneo) {
    // Delete members first, then the conversation
    await supabase.from('conversation_members').delete().eq('conversation_id', torneo.id)
    await supabase.from('conversations').delete().eq('id', torneo.id)
    setDeleting(null)
    load()
  }

  // Filter
  const filtered = torneos.filter(t => {
    if (filter === 'active')     return ['en_curso', 'inscripcion'].includes(t.tournament_status)
    if (filter === 'espera')     return t.tournament_status === 'inscripcion'
    if (filter === 'finalizado') return ['finalizado', 'cancelado'].includes(t.tournament_status)
    return true
  })

  // Detail view
  if (viewing) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
        <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={() => setViewing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{viewing.name}</div>
            <div style={{ color: C.textDim, fontSize: 11 }}>{FORMAT_LABELS[viewing.tournament_format] || viewing.tournament_format}</div>
          </div>
          <StatusBadge status={viewing.tournament_status} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <TournamentDashboard
            tournamentId={viewing.id}
            profile={profile}
            isAdmin={viewing.created_by === profile?.id || profile?.role === 'superadmin' || profile?.role === 'admin'}
            onBack={() => { setViewing(null); load() }}
          />
        </div>
      </div>
    )
  }

  const activosCount = torneos.filter(t => ['en_curso', 'inscripcion'].includes(t.tournament_status)).length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes drawerUp { from { transform: translateY(60px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '14px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ color: C.text, fontWeight: 900, fontSize: 18 }}>🏆 Mis Torneos</div>
            <div style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>
              {torneos.length} torneo{torneos.length !== 1 ? 's' : ''}{activosCount > 0 ? ` · ${activosCount} activo${activosCount !== 1 ? 's' : ''}` : ''}
            </div>
          </div>
          <button onClick={() => setShowCreate(true)} style={{
            padding: '9px 16px', background: C.green, color: '#000',
            border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: `0 0 16px ${C.green}33`,
          }}>
            <span style={{ fontSize: 16 }}>+</span> Crear
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTER_TABS.map(t => {
            const count = t.id === 'all' ? torneos.length
              : t.id === 'active' ? torneos.filter(x => ['en_curso','inscripcion'].includes(x.tournament_status)).length
              : t.id === 'espera' ? torneos.filter(x => x.tournament_status === 'inscripcion').length
              : torneos.filter(x => ['finalizado','cancelado'].includes(x.tournament_status)).length
            return (
              <button key={t.id} onClick={() => setFilter(t.id)} style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: filter === t.id ? C.green : C.bg,
                color: filter === t.id ? '#000' : C.textDim,
                fontWeight: filter === t.id ? 700 : 500, fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {t.label}
                {count > 0 && (
                  <span style={{
                    background: filter === t.id ? 'rgba(0,0,0,0.2)' : C.border,
                    color: filter === t.id ? '#000' : C.textDim,
                    borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 800,
                  }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🏆</div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
              {filter === 'all' ? 'Sin torneos aún' : `Sin torneos ${FILTER_TABS.find(t => t.id === filter)?.label.toLowerCase()}`}
            </div>
            <div style={{ color: C.textDim, fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
              {filter === 'all' ? 'Creá tu primer torneo o unite a uno desde Explorar.' : 'Probá con otro filtro.'}
            </div>
            {filter === 'all' && (
              <button onClick={() => setShowCreate(true)} style={{
                padding: '12px 28px', background: C.green, color: '#000',
                border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer',
              }}>
                + Crear torneo
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 14,
          }}>
            {filtered.map(t => (
              <TorneoCard
                key={t.id}
                torneo={t}
                myId={profile?.id}
                onVer={setViewing}
                onDelete={setDeleting}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onViewPlans={() => { setShowCreate(false); onNavigate?.('vip') }}
          onCreated={(id) => {
            setShowCreate(false)
            load()
            setViewing({ id, name: '...', tournament_status: 'inscripcion', created_by: profile?.id })
          }}
        />
      )}
      {deleting && (
        <ConfirmDelete
          torneo={deleting}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
