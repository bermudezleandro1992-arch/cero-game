import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'
import TournamentDashboard from './TournamentDashboard'

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Header({ onBack, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
      </button>
      <div>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>{title}</div>
        {subtitle && <div style={{ color: C.textDim, fontSize: 11, marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
  )
}

function TabBar({ tabs, active, onSelect }) {
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.panel, flexShrink: 0, overflowX: 'auto' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onSelect(t.id)} style={{
          flex: 1, minWidth: 60, padding: '11px 8px', border: 'none', background: 'none', cursor: 'pointer',
          borderBottom: `2px solid ${active === t.id ? C.green : 'transparent'}`,
          color: active === t.id ? C.green : C.textDim,
          fontSize: 11, fontWeight: active === t.id ? 700 : 500,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 16 }}>{t.icon}</span>
          <span>{t.label}</span>
          {t.badge > 0 && (
            <span style={{ position: 'absolute', marginTop: -20, marginLeft: 20, background: '#ef4444', color: '#fff', borderRadius: 20, padding: '1px 5px', fontSize: 9, fontWeight: 800 }}>
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )
}

function StatCard({ label, value, color, icon }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 26 }}>{icon}</div>
      <div>
        <div style={{ color: color || C.green, fontSize: 22, fontWeight: 800 }}>{value}</div>
        <div style={{ color: C.textDim, fontSize: 11, marginTop: 1 }}>{label}</div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const MAP = {
    inscripcion: { label: 'Inscripción', color: '#22c55e', bg: '#22c55e18' },
    en_curso:    { label: 'En Curso',    color: '#fb8c00', bg: '#fb8c0018' },
    finalizado:  { label: 'Finalizado',  color: '#64748b', bg: '#64748b18' },
    cancelado:   { label: 'Cancelado',   color: '#ef4444', bg: '#ef444418' },
    abierta:     { label: 'Abierta',     color: '#ef4444', bg: '#ef444418' },
    en_revision: { label: 'En Revisión', color: '#fb8c00', bg: '#fb8c0018' },
    resuelta:    { label: 'Resuelta',    color: '#22c55e', bg: '#22c55e18' },
    rechazada:   { label: 'Rechazada',   color: '#64748b', bg: '#64748b18' },
  }
  const cfg = MAP[status] || { label: status, color: C.textDim, bg: C.border }
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
      {cfg.label}
    </span>
  )
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 48, gap: 12, color: C.textDim }}>
      <span style={{ fontSize: 40 }}>{icon}</span>
      <span style={{ fontSize: 14 }}>{text}</span>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: type === 'error' ? '#ef4444' : '#22c55e',
      color: '#fff', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 600,
      zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', maxWidth: '90vw', textAlign: 'center'
    }}>
      {message}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Dashboard Tab
// ══════════════════════════════════════════════════════════════════════════════
function DashboardTab({ communityId, onViewTorneo, onGoTab }) {
  const [stats, setStats] = useState(null)
  const [recentTournaments, setRecentTournaments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: torneos }, { data: members }] = await Promise.all([
        supabase.from('conversations')
          .select('id, name, tournament_status, created_at')
          .eq('community_id', communityId)
          .in('group_type', ['tournament', 'liga'])
          .order('created_at', { ascending: false }),
        supabase.from('conversation_members')
          .select('user_id', { count: 'exact', head: true })
          .eq('conversation_id', communityId),
      ])

      const all = torneos || []
      const ids = all.map(t => t.id)

      let disputes = []
      if (ids.length) {
        const { data } = await supabase.from('tournament_disputes')
          .select('id, status, tournament_id')
          .eq('status', 'abierta')
          .in('tournament_id', ids)
        disputes = data || []
      }

      setStats({
        total: all.length,
        activos: all.filter(t => t.tournament_status === 'en_curso').length,
        inscripcion: all.filter(t => t.tournament_status === 'inscripcion').length,
        finalizados: all.filter(t => t.tournament_status === 'finalizado').length,
        disputas: disputes.length,
        miembros: members || 0,
      })
      setRecentTournaments(all.slice(0, 5))
      setLoading(false)
    }
    load()
  }, [communityId])

  if (loading) return <Spinner />

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <StatCard icon="🏆" label="Total Torneos" value={stats.total} />
        <StatCard icon="⚡" label="En Curso" value={stats.activos} color="#fb8c00" />
        <StatCard icon="📋" label="Inscripción" value={stats.inscripcion} color="#3b82f6" />
        <StatCard icon="⚠️" label="Disputas Abiertas" value={stats.disputas} color="#ef4444" />
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onGoTab('torneos')} style={{
          flex: 1, padding: '12px 8px', background: C.green, color: C.bg, border: 'none',
          borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          + Nuevo Torneo
        </button>
        {stats.disputas > 0 && (
          <button onClick={() => onGoTab('disputas')} style={{
            flex: 1, padding: '12px 8px', background: '#ef444420', color: '#ef4444', border: `1px solid #ef444440`,
            borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            Ver Disputas ({stats.disputas})
          </button>
        )}
      </div>

      {/* Recent tournaments */}
      <div>
        <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Torneos Recientes
        </div>
        {recentTournaments.length === 0
          ? <EmptyState icon="🏆" text="Sin torneos aún" />
          : recentTournaments.map(t => (
            <div key={t.id} onClick={() => onViewTorneo(t)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', background: C.panel, border: `1px solid ${C.border}`,
              borderRadius: 10, marginBottom: 8, cursor: 'pointer',
            }}>
              <div>
                <div style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                <div style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>
                  {new Date(t.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <StatusBadge status={t.tournament_status} />
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Torneos Tab
// ══════════════════════════════════════════════════════════════════════════════
function TorneosTab({ communityId, profile, onViewTorneo, toast }) {
  const [torneos, setTorneos] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('conversations')
      .select('id, name, tournament_status, created_at, max_members, game, tournament_format')
      .eq('community_id', communityId)
      .in('group_type', ['tournament', 'liga'])
      .order('created_at', { ascending: false })
    setTorneos(data || [])
    setLoading(false)
  }, [communityId])

  useEffect(() => { load() }, [load])

  async function handleDelete(t) {
    if (!window.confirm(`¿Eliminar torneo "${t.name}"? Esta acción no se puede deshacer.`)) return
    setDeleting(t.id)
    const { error } = await supabase.from('conversations').delete().eq('id', t.id)
    setDeleting(null)
    if (error) toast('Error al eliminar: ' + error.message, 'error')
    else { toast('Torneo eliminado', 'ok'); load() }
  }

  if (loading) return <Spinner />

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {torneos.length === 0
        ? <EmptyState icon="🏆" text="No hay torneos en esta comunidad" />
        : torneos.map(t => (
          <div key={t.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.name}
                </div>
                <div style={{ color: C.textDim, fontSize: 11, marginTop: 3, display: 'flex', gap: 8 }}>
                  <span>{t.game || '🎮'}</span>
                  <span>·</span>
                  <span>{t.tournament_format || '—'}</span>
                  <span>·</span>
                  <span>{new Date(t.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short' })}</span>
                </div>
              </div>
              <StatusBadge status={t.tournament_status} />
            </div>
            <div style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => onViewTorneo(t)} style={{
                flex: 1, padding: '9px 8px', background: 'none', border: 'none', color: C.green,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', borderRight: `1px solid ${C.border}`,
              }}>
                Ver
              </button>
              <button onClick={() => handleDelete(t)} disabled={deleting === t.id} style={{
                flex: 1, padding: '9px 8px', background: 'none', border: 'none', color: '#ef4444',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                opacity: deleting === t.id ? 0.5 : 1,
              }}>
                {deleting === t.id ? '...' : 'Eliminar'}
              </button>
            </div>
          </div>
        ))
      }
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Disputas Tab
// ══════════════════════════════════════════════════════════════════════════════
function DisputasTab({ communityId, profile, toast }) {
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('abierta')
  const [resolving, setResolving] = useState(null)
  const [form, setForm] = useState({ score1: '', score2: '' })

  const load = useCallback(async () => {
    setLoading(true)
    // Get tournament ids for this community first
    const { data: torneos } = await supabase
      .from('conversations')
      .select('id')
      .eq('community_id', communityId)
      .in('group_type', ['tournament', 'liga'])

    if (!torneos?.length) { setDisputes([]); setLoading(false); return }

    const { data } = await supabase
      .from('tournament_disputes')
      .select(`
        id, status, reason, created_at, tournament_id,
        match_id,
        tournament_matches!inner(
          id, score1, score2, player1_id, player2_id,
          player1:player1_id(id, display_name, avatar_url),
          player2:player2_id(id, display_name, avatar_url)
        )
      `)
      .in('tournament_id', torneos.map(t => t.id))
      .eq('status', filter)
      .order('created_at', { ascending: false })

    setDisputes(data || [])
    setLoading(false)
  }, [communityId, filter])

  useEffect(() => { load() }, [load])

  async function handleResolve(disputeId, resolution) {
    const s1 = parseInt(form.score1)
    const s2 = parseInt(form.score2)
    const { data, error } = await supabase.rpc('resolve_dispute', {
      p_dispute_id:    disputeId,
      p_resolution:    resolution,
      p_final_score1:  isNaN(s1) ? null : s1,
      p_final_score2:  isNaN(s2) ? null : s2,
    })
    if (error || data?.ok === false) {
      toast(error?.message || data?.error || 'Error al resolver', 'error')
    } else {
      toast(resolution === 'rechazada' ? 'Disputa rechazada' : 'Disputa resuelta ✓', 'ok')
      setResolving(null)
      load()
    }
  }

  const FILTERS = [
    { id: 'abierta', label: 'Abiertas' },
    { id: 'en_revision', label: 'En Revisión' },
    { id: 'resuelta', label: 'Resueltas' },
    { id: 'rechazada', label: 'Rechazadas' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: `1px solid ${C.border}`, overflowX: 'auto' }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            background: filter === f.id ? C.green : C.panel,
            color: filter === f.id ? C.bg : C.textDim,
          }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? <Spinner /> : disputes.length === 0
          ? <EmptyState icon="⚖️" text={`Sin disputas ${filter === 'abierta' ? 'abiertas' : filter}`} />
          : disputes.map(d => {
            const match = d.tournament_matches
            const p1 = match?.player1
            const p2 = match?.player2
            const isOpen = resolving === d.id

            return (
              <div key={d.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ color: C.textDim, fontSize: 11 }}>
                      {new Date(d.created_at).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{p1?.display_name || '?'}</span>
                    <span style={{ color: C.textDim, fontSize: 12 }}>
                      {match?.score1 ?? '?'} — {match?.score2 ?? '?'}
                    </span>
                    <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{p2?.display_name || '?'}</span>
                  </div>
                  {d.reason && (
                    <div style={{ background: C.bg, borderRadius: 8, padding: '8px 10px', fontSize: 12, color: C.textDim, fontStyle: 'italic' }}>
                      "{d.reason}"
                    </div>
                  )}
                </div>

                {d.status === 'abierta' && (
                  <div style={{ borderTop: `1px solid ${C.border}` }}>
                    {!isOpen ? (
                      <div style={{ display: 'flex' }}>
                        <button onClick={() => { setResolving(d.id); setForm({ score1: match?.score1 ?? '', score2: match?.score2 ?? '' }) }} style={{
                          flex: 1, padding: '10px 8px', background: 'none', border: 'none',
                          color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          borderRight: `1px solid ${C.border}`,
                        }}>
                          Resolver
                        </button>
                        <button onClick={() => handleResolve(d.id, 'rechazada')} style={{
                          flex: 1, padding: '10px 8px', background: 'none', border: 'none',
                          color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}>
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding: 12 }}>
                        <div style={{ color: C.textDim, fontSize: 11, marginBottom: 8 }}>Marcador final (opcional)</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                          <input type="number" value={form.score1} onChange={e => setForm(f => ({ ...f, score1: e.target.value }))}
                            placeholder={p1?.display_name || 'J1'}
                            style={{ flex: 1, padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 14, textAlign: 'center' }} />
                          <span style={{ color: C.textDim }}>—</span>
                          <input type="number" value={form.score2} onChange={e => setForm(f => ({ ...f, score2: e.target.value }))}
                            placeholder={p2?.display_name || 'J2'}
                            style={{ flex: 1, padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 14, textAlign: 'center' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setResolving(null)} style={{
                            flex: 1, padding: '9px 8px', background: C.border, color: C.text, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}>
                            Cancelar
                          </button>
                          <button onClick={() => handleResolve(d.id, 'resuelta')} style={{
                            flex: 2, padding: '9px 8px', background: C.green, color: C.bg, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          }}>
                            Confirmar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Solicitudes Tab (join requests for private communities)
// ══════════════════════════════════════════════════════════════════════════════
function SolicitudesTab({ communityId, toast }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)
  const [filter, setFilter] = useState('pending')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('community_requests')
      .select('id, status, message, created_at, user_id, users(id, display_name, avatar_url)')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }, [communityId])

  useEffect(() => { load() }, [load])

  async function resolve(requestId, action) {
    setActing(requestId)
    const { data, error } = await supabase.rpc('resolve_community_request', {
      p_request_id: requestId,
      p_action: action,
    })
    setActing(null)
    if (error || !data?.success) {
      toast('Error: ' + (error?.message || data?.error || 'desconocido'), 'error')
    } else {
      toast(action === 'approve' ? 'Solicitud aprobada ✓' : 'Solicitud rechazada', 'ok')
      load()
    }
  }

  const filtered = requests.filter(r => filter === 'all' || r.status === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 6 }}>
        {['pending', 'approved', 'rejected', 'all'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
            background: filter === s ? C.green : C.panel,
            color: filter === s ? C.bg : C.textDim,
          }}>
            {s === 'pending' ? 'Pendientes' : s === 'approved' ? 'Aprobadas' : s === 'rejected' ? 'Rechazadas' : 'Todas'}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {loading ? <Spinner /> : filtered.length === 0
          ? <EmptyState icon="🔔" text="No hay solicitudes" />
          : filtered.map(req => {
            const u = req.users
            return (
              <div key={req.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0',
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, overflow: 'hidden' }}>
                  {u?.avatar_url ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{u?.display_name || 'Usuario'}</div>
                  {req.message && <div style={{ color: C.textDim, fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.message}</div>}
                  <div style={{ color: C.textDim, fontSize: 10, marginTop: 2 }}>
                    {new Date(req.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' · '}
                    <span style={{ color: req.status === 'pending' ? '#f59e0b' : req.status === 'approved' ? C.green : '#ef4444', fontWeight: 700 }}>
                      {req.status === 'pending' ? 'Pendiente' : req.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                    </span>
                  </div>
                </div>
                {req.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      disabled={acting === req.id}
                      onClick={() => resolve(req.id, 'approve')}
                      style={{ padding: '5px 10px', background: C.green, border: 'none', borderRadius: 6, color: C.bg, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      ✓
                    </button>
                    <button
                      disabled={acting === req.id}
                      onClick={() => resolve(req.id, 'reject')}
                      style={{ padding: '5px 10px', background: 'none', border: `1px solid #ef444440`, borderRadius: 6, color: '#ef4444', fontSize: 11, cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Miembros Tab
// ══════════════════════════════════════════════════════════════════════════════
const ROLES_COMMUNITY = [
  { id: 'member',      label: 'Miembro' },
  { id: 'moderador',   label: 'Moderador' },
  { id: 'organizador', label: 'Organizador' },
  { id: 'admin',       label: 'Admin' },
  { id: 'owner',       label: 'Dueño' },
]

function MiembrosTab({ communityId, profile, toast }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState(null)
  const [inviteLink, setInviteLink] = useState(null)
  const [copyOk, setCopyOk] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('conversation_members')
      .select('user_id, role, joined_at, users(id, display_name, avatar_url)')
      .eq('conversation_id', communityId)
      .order('joined_at', { ascending: false })
    setMembers(data || [])
    setLoading(false)
  }, [communityId])

  useEffect(() => { load() }, [load])

  async function changeRole(userId, newRole) {
    setUpdating(userId)
    const { error } = await supabase
      .from('conversation_members')
      .update({ role: newRole })
      .eq('conversation_id', communityId)
      .eq('user_id', userId)
    setUpdating(null)
    if (error) toast('Error al cambiar rol: ' + error.message, 'error')
    else { toast('Rol actualizado ✓', 'ok'); load() }
  }

  async function kickMember(userId, name) {
    if (!window.confirm(`¿Expulsar a ${name}?`)) return
    const { error } = await supabase
      .from('conversation_members')
      .delete()
      .eq('conversation_id', communityId)
      .eq('user_id', userId)
    if (error) toast('Error: ' + error.message, 'error')
    else { toast(`${name} fue expulsado`, 'ok'); load() }
  }

  async function generateInvite() {
    const { data } = await supabase
      .from('conversations')
      .select('invite_code')
      .eq('id', communityId)
      .single()
    if (data?.invite_code) {
      const link = `${window.location.origin}/join/${data.invite_code}`
      setInviteLink(link)
    }
  }

  async function copyInvite() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink).catch(() => {})
    setCopyOk(true)
    setTimeout(() => setCopyOk(false), 2000)
  }

  const filtered = members.filter(m => {
    const p = m.users
    if (roleFilter !== 'all' && m.role !== roleFilter) return false
    if (search && !p?.display_name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search + filter */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar miembro..."
          style={{ padding: '8px 12px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 14 }} />
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {[{ id: 'all', label: 'Todos' }, ...ROLES_COMMUNITY].map(r => (
            <button key={r.id} onClick={() => setRoleFilter(r.id)} style={{
              padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
              background: roleFilter === r.id ? C.green : C.panel,
              color: roleFilter === r.id ? C.bg : C.textDim,
            }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Invite button */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
        {!inviteLink ? (
          <button onClick={generateInvite} style={{
            width: '100%', padding: '9px 16px', background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: 8, color: C.green, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            🔗 Generar enlace de invitación
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 11, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {inviteLink}
            </div>
            <button onClick={copyInvite} style={{
              padding: '8px 14px', background: copyOk ? C.green : C.panel, border: `1px solid ${C.border}`,
              borderRadius: 8, color: copyOk ? C.bg : C.text, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              {copyOk ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {loading ? <Spinner /> : filtered.length === 0
          ? <EmptyState icon="👥" text="No hay miembros" />
          : filtered.map(m => {
            const p = m.users
            const isMe = p?.id === profile?.id
            return (
              <div key={m.user_id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: C.border,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0, overflow: 'hidden',
                }}>
                  {p?.avatar_url ? <img src={p.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.text, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p?.display_name || 'Sin nombre'} {isMe && <span style={{ color: C.textDim, fontWeight: 400, fontSize: 11 }}>(Yo)</span>}
                  </div>
                  <div style={{ color: C.textDim, fontSize: 11 }}>
                    Desde {new Date(m.joined_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                {!isMe && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <select value={m.role || 'member'} disabled={updating === m.user_id}
                      onChange={e => changeRole(m.user_id, e.target.value)}
                      style={{ padding: '4px 6px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 11, cursor: 'pointer' }}>
                      {ROLES_COMMUNITY.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                    <button onClick={() => kickMember(m.user_id, p?.display_name || 'usuario')} style={{
                      padding: '4px 8px', background: 'none', border: `1px solid #ef444440`,
                      borderRadius: 6, color: '#ef4444', fontSize: 11, cursor: 'pointer',
                    }}>
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Estadísticas Tab
// ══════════════════════════════════════════════════════════════════════════════
function EstadisticasTab({ communityId }) {
  const [stats, setStats] = useState(null)
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Tournaments in community
      const { data: torneos } = await supabase
        .from('conversations')
        .select('id, name, tournament_status, created_at')
        .eq('community_id', communityId)
        .in('group_type', ['tournament', 'liga'])

      const ids = (torneos || []).map(t => t.id)

      const [{ count: totalMembers }, { data: matches }] = await Promise.all([
        supabase.from('conversation_members').select('user_id', { count: 'exact', head: true }).eq('conversation_id', communityId),
        ids.length ? supabase.from('tournament_matches').select('winner_id, player1_id, player2_id, status').in('tournament_id', ids).eq('status', 'finalizado') : { data: [] },
      ])

      // Build ranking from match wins
      const wins = {}
      ;(matches || []).forEach(m => {
        if (m.winner_id) wins[m.winner_id] = (wins[m.winner_id] || 0) + 1
      })

      // Fetch display names for top players
      const topIds = Object.entries(wins).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id)
      let rankData = []
      if (topIds.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', topIds)
        rankData = topIds.map((id, i) => ({
          rank: i + 1,
          id,
          wins: wins[id],
          ...(profiles?.find(p => p.id === id) || {}),
        }))
      }

      // Torneos by month (last 6 months)
      const byMonth = {}
      ;(torneos || []).forEach(t => {
        const key = new Date(t.created_at).toLocaleString('es', { month: 'short', year: '2-digit' })
        byMonth[key] = (byMonth[key] || 0) + 1
      })

      setStats({
        totalTorneos: torneos?.length || 0,
        totalMembers: totalMembers || 0,
        totalMatches: matches?.length || 0,
        byMonth,
      })
      setRanking(rankData)
      setLoading(false)
    }
    load()
  }, [communityId])

  if (loading) return <Spinner />

  const months = Object.entries(stats.byMonth)
  const maxTorneos = Math.max(...months.map(([, v]) => v), 1)

  function exportCSV() {
    const rows = [['Posición', 'Jugador', 'Victorias'], ...ranking.map(r => [r.rank, r.display_name || r.id, r.wins])]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'ranking.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Global stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <StatCard icon="🏆" label="Torneos" value={stats.totalTorneos} />
        <StatCard icon="👥" label="Miembros" value={stats.totalMembers} color="#3b82f6" />
        <StatCard icon="⚽" label="Partidos" value={stats.totalMatches} color="#f59e0b" />
      </div>

      {/* Torneos por mes */}
      {months.length > 0 && (
        <div>
          <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Torneos por mes
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80 }}>
            {months.slice(-6).map(([label, count]) => (
              <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', background: C.green, borderRadius: '4px 4px 0 0', height: `${(count / maxTorneos) * 60}px`, minHeight: 4 }} />
                <span style={{ color: C.textDim, fontSize: 9, textAlign: 'center' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ranking */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Top Jugadores
          </div>
          {ranking.length > 0 && (
            <button onClick={exportCSV} style={{
              padding: '4px 10px', background: C.panel, border: `1px solid ${C.border}`,
              borderRadius: 6, color: C.textDim, fontSize: 11, cursor: 'pointer',
            }}>
              Exportar CSV
            </button>
          )}
        </div>
        {ranking.length === 0
          ? <EmptyState icon="📊" text="Sin datos de ranking aún" />
          : ranking.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ width: 22, textAlign: 'center', fontWeight: 800, color: i < 3 ? ['#f59e0b','#94a3b8','#cd7f32'][i] : C.textDim, fontSize: 13 }}>
                {i < 3 ? ['🥇','🥈','🥉'][i] : `#${r.rank}`}
              </span>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.border, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                {r.avatar_url ? <img src={r.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
              </div>
              <div style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: 600 }}>{r.display_name || r.id.slice(0, 8)}</div>
              <span style={{ color: C.green, fontWeight: 800, fontSize: 14 }}>{r.wins}V</span>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Configuración Tab
// ══════════════════════════════════════════════════════════════════════════════
function ConfiguracionTab({ communityId, toast }) {
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('conversations')
        .select('name, description, avatar_url, is_private, dispute_timeout_minutes, max_members')
        .eq('id', communityId)
        .single()
      setCfg(data || {})
      setLoading(false)
    }
    load()
  }, [communityId])

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('conversations')
      .update({
        name: cfg.name,
        description: cfg.description,
        is_private: cfg.is_private,
        dispute_timeout_minutes: cfg.dispute_timeout_minutes,
        max_members: cfg.max_members,
      })
      .eq('id', communityId)
    setSaving(false)
    if (error) toast('Error al guardar: ' + error.message, 'error')
    else toast('Configuración guardada ✓', 'ok')
  }

  if (loading || !cfg) return <Spinner />

  const F = ({ label, children }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )

  const inputStyle = {
    width: '100%', padding: '10px 12px', background: C.panel, border: `1px solid ${C.border}`,
    borderRadius: 8, color: C.text, fontSize: 14, boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: 16 }}>
      <F label="Nombre de la comunidad">
        <input value={cfg.name || ''} onChange={e => setCfg(c => ({ ...c, name: e.target.value }))} style={inputStyle} />
      </F>
      <F label="Descripción">
        <textarea value={cfg.description || ''} onChange={e => setCfg(c => ({ ...c, description: e.target.value }))}
          rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
      </F>
      <F label="Capacidad máxima de miembros">
        <input type="number" value={cfg.max_members || ''} onChange={e => setCfg(c => ({ ...c, max_members: parseInt(e.target.value) || null }))} style={inputStyle} />
      </F>
      <F label="Tiempo límite para disputas (minutos)">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[2, 5, 10, 15, 30, 60, 120].map(m => (
            <button key={m} onClick={() => setCfg(c => ({ ...c, dispute_timeout_minutes: m }))} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: cfg.dispute_timeout_minutes === m ? C.green : C.panel,
              color: cfg.dispute_timeout_minutes === m ? C.bg : C.textDim,
            }}>
              {m < 60 ? `${m}m` : `${m / 60}h`}
            </button>
          ))}
        </div>
      </F>
      <F label="Visibilidad">
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ v: false, label: '🌐 Pública' }, { v: true, label: '🔒 Privada' }].map(opt => (
            <button key={String(opt.v)} onClick={() => setCfg(c => ({ ...c, is_private: opt.v }))} style={{
              flex: 1, padding: '10px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: cfg.is_private === opt.v ? C.green : C.panel,
              color: cfg.is_private === opt.v ? C.bg : C.textDim,
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      </F>
      <button onClick={save} disabled={saving} style={{
        width: '100%', padding: '12px 16px', background: C.green, color: C.bg, border: 'none',
        borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer',
        opacity: saving ? 0.7 : 1, marginTop: 8,
      }}>
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Main CEOPanel
// ══════════════════════════════════════════════════════════════════════════════
export default function CEOPanel({ community, onBack }) {
  const { profile } = useAuthStore()
  const [tab, setTab] = useState('dashboard')
  const [viewTorneo, setViewTorneo] = useState(null)
  const [toast, setToast] = useState(null)
  const [openDisputesCount, setOpenDisputesCount] = useState(0)

  // Role guard
  const isCeo = ['ceo', 'admin'].includes(profile?.role)
  const communityRole = community?.myRole
  const isAdmin = isCeo || ['owner', 'admin'].includes(communityRole)

  const communityId = community?.id

  const showToast = useCallback((message, type = 'ok') => setToast({ message, type }), [])

  // Count open disputes for badge
  useEffect(() => {
    if (!communityId) return
    async function countDisputes() {
      const { data: torneos } = await supabase
        .from('conversations').select('id').eq('community_id', communityId).in('group_type', ['tournament', 'liga'])
      if (!torneos?.length) { setOpenDisputesCount(0); return }
      const { count } = await supabase
        .from('tournament_disputes').select('id', { count: 'exact', head: true })
        .eq('status', 'abierta').in('tournament_id', torneos.map(t => t.id))
      setOpenDisputesCount(count || 0)
    }
    countDisputes()
  }, [communityId])

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
        <Header onBack={onBack} title="Panel de Organizador" />
        <EmptyState icon="🔒" text="Acceso restringido a CEOs y admins" />
      </div>
    )
  }

  // If viewing a specific tournament
  if (viewTorneo) {
    return (
      <TournamentDashboard
        tournamentId={viewTorneo.id}
        profile={profile}
        isAdmin={isAdmin}
        onBack={() => setViewTorneo(null)}
      />
    )
  }

  const TABS = [
    { id: 'dashboard',   icon: '📊', label: 'Dashboard' },
    { id: 'torneos',     icon: '🏆', label: 'Torneos' },
    { id: 'disputas',    icon: '⚖️', label: 'Disputas', badge: openDisputesCount },
    { id: 'solicitudes', icon: '🔔', label: 'Solicitudes' },
    { id: 'miembros',    icon: '👥', label: 'Miembros' },
    { id: 'estadisticas',icon: '📈', label: 'Stats' },
    { id: 'config',      icon: '⚙️', label: 'Config' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, position: 'relative' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <Header onBack={onBack} title={community?.name || 'Panel CEO'} subtitle="Gestión de comunidad" />

      <div style={{ position: 'relative' }}>
        <TabBar tabs={TABS} active={tab} onSelect={setTab} />
        {openDisputesCount > 0 && tab !== 'disputas' && (
          <div style={{
            position: 'absolute', top: 6, left: `${(TABS.findIndex(t => t.id === 'disputas') / TABS.length) * 100 + 100 / TABS.length / 2}%`,
            transform: 'translateX(-50%)', background: '#ef4444', color: '#fff',
            borderRadius: 20, padding: '1px 5px', fontSize: 9, fontWeight: 800, pointerEvents: 'none',
          }}>
            {openDisputesCount}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'dashboard' && (
          <DashboardTab
            communityId={communityId}
            onViewTorneo={setViewTorneo}
            onGoTab={setTab}
          />
        )}
        {tab === 'torneos' && (
          <TorneosTab
            communityId={communityId}
            profile={profile}
            onViewTorneo={setViewTorneo}
            toast={showToast}
          />
        )}
        {tab === 'disputas' && (
          <DisputasTab
            communityId={communityId}
            profile={profile}
            toast={showToast}
          />
        )}
        {tab === 'solicitudes' && (
          <SolicitudesTab
            communityId={communityId}
            toast={showToast}
          />
        )}
        {tab === 'miembros' && (
          <MiembrosTab
            communityId={communityId}
            profile={profile}
            toast={showToast}
          />
        )}
        {tab === 'estadisticas' && (
          <EstadisticasTab communityId={communityId} />
        )}
        {tab === 'config' && (
          <ConfiguracionTab communityId={communityId} toast={showToast} />
        )}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
