import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'
import TournamentDashboard from './TournamentDashboard'
import ReferidosPanel from './ReferidosPanel'
import { CreateTorneoModal } from '../pages/TorneosPage'

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
function DashboardTab({ communityId, onViewTorneo, onGoTab, onNewTorneo }) {
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
        <button onClick={() => onNewTorneo()} style={{
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

// ── Confirm Delete Modal ──────────────────────────────────────────────────────
function ConfirmDeleteModal({ torneo, onConfirm, onCancel, deleting }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.panel, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480,
        padding: '24px 20px 36px', display: 'flex', flexDirection: 'column', gap: 16,
        borderTop: '3px solid #ef4444',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>🗑️</div>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 17, marginBottom: 6 }}>
            Eliminar torneo
          </div>
          <div style={{
            color: C.green, fontWeight: 700, fontSize: 15,
            background: `${C.green}12`, borderRadius: 10, padding: '6px 14px', display: 'inline-block',
          }}>
            {torneo.name}
          </div>
        </div>

        <div style={{ background: '#ef444410', border: '1px solid #ef444430', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>⚠️ Se eliminarán permanentemente</div>
          <div style={{ color: C.textDim, fontSize: 12, lineHeight: 1.7 }}>
            • Partidos, brackets y grupos<br/>
            • Tabla de posiciones y sorteos<br/>
            • Disputas y mensajes del canal<br/>
            • Todos los participantes inscriptos
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={deleting} style={{
            flex: 1, padding: '13px', background: C.panel2, border: `1px solid ${C.border}`,
            borderRadius: 12, color: C.textDim, fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={deleting} style={{
            flex: 1.3, padding: '13px', background: deleting ? C.border : '#ef4444',
            border: 'none', borderRadius: 12, color: deleting ? C.textDim : '#fff',
            fontWeight: 800, fontSize: 14, cursor: deleting ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {deleting ? (
              <>
                <div style={{ width: 14, height: 14, border: '2px solid #ffffff40', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                Eliminando…
              </>
            ) : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Torneos Tab
// ══════════════════════════════════════════════════════════════════════════════
function TorneosTab({ communityId, profile, onViewTorneo, toast, showCreate, onHideCreate }) {
  const [torneos, setTorneos] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [confirmTorneo, setConfirmTorneo] = useState(null)
  const [localCreate, setLocalCreate] = useState(false)
  const isCreating = showCreate || localCreate
  function closeCreate() { onHideCreate?.(); setLocalCreate(false) }

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

  async function doDelete() {
    const t = confirmTorneo
    if (!t) return
    setDeleting(t.id)
    const id = t.id
    const tryDel = (table, col) => supabase.from(table).delete().eq(col, id).then(() => {})
    try {
      // Delete all child data (best-effort — RLS may block some, that's ok)
      await tryDel('tournament_disputes', 'tournament_id')
      await tryDel('tournament_draw_events', 'tournament_id')
      await tryDel('tournament_group_members', 'tournament_id')
      await tryDel('tournament_standings', 'tournament_id')
      await tryDel('tournament_brackets', 'tournament_id')
      const { data: matchRows } = await supabase.from('tournament_matches').select('id').eq('tournament_id', id)
      if (matchRows?.length) {
        await supabase.from('match_results').delete().in('match_id', matchRows.map(m => m.id))
      }
      await tryDel('tournament_matches', 'tournament_id')
      await tryDel('tournament_groups', 'tournament_id')
      await supabase.from('announcements').update({ tournament_id: null }).eq('tournament_id', id)
      await tryDel('conversation_members', 'conversation_id')
      await tryDel('messages', 'conversation_id')

      // Try hard delete first; fall back to soft-delete (status='eliminado') if RLS blocks it
      await supabase.from('conversations').delete().eq('id', id)
      const { data: stillThere } = await supabase.from('conversations').select('id').eq('id', id).maybeSingle()
      if (stillThere) {
        // RLS blocked hard delete — detach from community so it disappears from all lists
        const { error: updErr } = await supabase.from('conversations').update({ community_id: null }).eq('id', id)
        if (updErr) throw new Error('Sin permisos para eliminar este torneo.')
      }

      setTorneos(prev => prev.filter(x => x.id !== id))
      setConfirmTorneo(null)
      toast('Torneo eliminado ✓', 'ok')
    } catch (e) {
      toast('Error al eliminar: ' + e.message, 'error')
    }
    setDeleting(null)
  }

  if (loading) return <Spinner />

  return (
    <>
    {confirmTorneo && (
      <ConfirmDeleteModal
        torneo={confirmTorneo}
        onConfirm={doDelete}
        onCancel={() => { if (!deleting) setConfirmTorneo(null) }}
        deleting={!!deleting}
      />
    )}
    {isCreating && (
      <CreateTorneoModal
        defaultCommunityId={communityId}
        onClose={closeCreate}
        onCreated={() => { closeCreate(); load() }}
      />
    )}
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button onClick={() => setLocalCreate(true)} style={{
        width: '100%', padding: '11px 8px', background: C.green, color: C.bg, border: 'none',
        borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
      }}>+ Nuevo Torneo / Liga</button>
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
              <button onClick={() => setConfirmTorneo(t)} disabled={deleting === t.id} style={{
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
    </>
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

const ROLE_HIERARCHY = [
  {
    id: 'owner',
    label: 'Dueño / CEO',
    color: '#f59e0b',
    icon: '👑',
    perms: ['Panel CEO completo', 'Crear torneos ilimitados', 'Gestionar admins', 'Eliminar comunidad', 'Editar configuración', 'Ver estadísticas', 'Expulsar cualquier miembro'],
  },
  {
    id: 'admin',
    label: 'Admin',
    color: '#8b5cf6',
    icon: '⭐',
    perms: ['Panel Organizador', 'Crear torneos', 'Gestionar partidos', 'Anuncios', 'Moderar disputas', 'Invitar miembros', 'Expulsar miembros'],
  },
  {
    id: 'organizador',
    label: 'Organizador',
    color: '#22c55e',
    icon: '🎯',
    perms: ['Crear torneos', 'Gestionar partidos propios', 'Registrar resultados', 'Ver estadísticas del torneo'],
  },
  {
    id: 'moderador',
    label: 'Moderador',
    color: '#3b82f6',
    icon: '🛡️',
    perms: ['Moderar chat', 'Eliminar mensajes', 'Silenciar miembros', 'Ver reportes'],
  },
  {
    id: 'member',
    label: 'Miembro',
    color: '#6b7280',
    icon: '👤',
    perms: ['Participar en torneos', 'Enviar mensajes', 'Ver anuncios', 'Acceso a canales públicos'],
  },
]

function RolesTab({ communityId, profile, toast }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // role id being viewed
  const [assigning, setAssigning] = useState(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    // Use SECURITY DEFINER RPC to bypass RLS and read all members + roles
    const { data: memberRows } = await supabase
      .rpc('get_conversation_members', { p_conversation_ids: [communityId] })
    const rows = memberRows || []
    if (rows.length) {
      const ids = rows.map(r => r.user_id)
      const { data: userRows } = await supabase.from('users').select('id, display_name, avatar_url, username').in('id', ids)
      const userMap = Object.fromEntries((userRows || []).map(u => [u.id, u]))
      setMembers(rows.map(r => ({ user_id: r.user_id, role: r.role || 'member', joined_at: r.joined_at, users: userMap[r.user_id] || null })).filter(m => m.users))
    } else {
      setMembers([])
    }
    setLoading(false)
  }, [communityId])

  useEffect(() => { load() }, [load])

  async function changeRole(userId, newRole) {
    setAssigning(userId)
    const { error } = await supabase.rpc('set_community_member_role', {
      p_conversation_id: communityId,
      p_user_id: userId,
      p_role: newRole,
    })
    setAssigning(null)
    if (error) toast('Error: ' + error.message, 'error')
    else { toast('Rol actualizado ✓'); load() }
  }

  const roleMembers = selected
    ? members.filter(m => (m.role || 'member') === selected)
    : members

  const filtered = roleMembers.filter(m =>
    !search || m.users?.display_name?.toLowerCase().includes(search.toLowerCase()) || m.users?.username?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Role cards */}
      <div style={{ padding: '12px 16px 8px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ color: C.textDim, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>Jerarquía de roles</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ROLE_HIERARCHY.map(r => {
            const count = members.filter(m => (m.role || 'member') === r.id).length
            const isSelected = selected === r.id
            return (
              <button key={r.id} onClick={() => setSelected(isSelected ? null : r.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                background: isSelected ? `${r.color}18` : C.panel,
                border: `1px solid ${isSelected ? r.color : C.border}`,
                borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ fontSize: 18 }}>{r.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: r.color, fontWeight: 700, fontSize: 13 }}>{r.label}</div>
                  <div style={{ color: C.textDim, fontSize: 10, marginTop: 1 }}>{r.perms.slice(0, 2).join(' · ')}{r.perms.length > 2 ? ' · ...' : ''}</div>
                </div>
                <div style={{ color: C.textDim, fontSize: 11, fontWeight: 600, background: C.bg, borderRadius: 20, padding: '2px 8px', border: `1px solid ${C.border}` }}>
                  {count}
                </div>
              </button>
            )
          })}
        </div>
        {selected && (
          <div style={{ marginTop: 8, padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <div style={{ color: C.textDim, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>
              Permisos de {ROLE_HIERARCHY.find(r => r.id === selected)?.label}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {ROLE_HIERARCHY.find(r => r.id === selected)?.perms.map(p => (
                <span key={p} style={{ fontSize: 10, padding: '2px 7px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, color: C.text }}>
                  ✓ {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Members with role selector */}
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.border}` }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={selected ? `Buscar en ${ROLE_HIERARCHY.find(r => r.id === selected)?.label}...` : 'Buscar miembro...'}
          style={{ width: '100%', padding: '7px 10px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, boxSizing: 'border-box' }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px' }}>
        {loading ? <Spinner /> : filtered.length === 0
          ? <EmptyState icon="👥" text={selected ? `Sin ${ROLE_HIERARCHY.find(r => r.id === selected)?.label}s` : 'Sin miembros'} />
          : filtered.map(m => {
            const u = m.users
            const isMe = u?.id === profile?.id
            const roleCfg = ROLE_HIERARCHY.find(r => r.id === (m.role || 'member')) || ROLE_HIERARCHY[4]
            return (
              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, overflow: 'hidden' }}>
                  {u?.avatar_url ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.text, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u?.display_name || 'Sin nombre'} {isMe && <span style={{ color: C.textDim, fontSize: 10 }}>(Yo)</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                    <span style={{ fontSize: 10 }}>{roleCfg.icon}</span>
                    <span style={{ color: roleCfg.color, fontSize: 10, fontWeight: 600 }}>{roleCfg.label}</span>
                  </div>
                </div>
                {!isMe && (
                  <select value={m.role || 'member'} disabled={assigning === m.user_id}
                    onChange={e => changeRole(m.user_id, e.target.value)}
                    style={{ padding: '4px 6px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 11, cursor: 'pointer' }}>
                    {ROLES_COMMUNITY.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                )}
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

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
    // get_conversation_members is SECURITY DEFINER — bypasses RLS and includes role + joined_at
    const { data: memberRows } = await supabase
      .rpc('get_conversation_members', { p_conversation_ids: [communityId] })
    const rows = memberRows || []
    if (rows.length) {
      const ids = rows.map(r => r.user_id)
      const { data: userRows } = await supabase.from('users').select('id, display_name, username, avatar_url').in('id', ids)
      const userMap = Object.fromEntries((userRows || []).map(u => [u.id, u]))
      setMembers(rows.map(r => ({
        user_id: r.user_id,
        role: r.role || 'member',
        joined_at: r.joined_at,
        users: userMap[r.user_id] || null,
      })).filter(m => m.users))
    } else {
      setMembers([])
    }
    setLoading(false)
  }, [communityId])

  useEffect(() => { load() }, [load])

  async function changeRole(userId, newRole) {
    setUpdating(userId)
    const { error } = await supabase.rpc('set_community_member_role', {
      p_conversation_id: communityId,
      p_user_id: userId,
      p_role: newRole,
    })
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
                    {m.joined_at ? `Desde ${new Date(m.joined_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Miembro'}
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

  // Build a fixed 6-month window ending today
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    const key = d.toLocaleString('es', { month: 'short', year: '2-digit' })
    return [key, stats.byMonth[key] || 0]
  })
  const maxTorneos = Math.max(...last6Months.map(([, v]) => v), 1)

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
      <div>
        <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Torneos por mes
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80 }}>
          {last6Months.map(([label, count]) => (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%', borderRadius: '4px 4px 0 0',
                background: count > 0 ? C.green : C.border,
                height: `${Math.max((count / maxTorneos) * 60, count > 0 ? 4 : 2)}px`,
              }} />
              <span style={{ color: C.textDim, fontSize: 9, textAlign: 'center' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

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
function CfgField({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}
const cfgInputStyle = {
  width: '100%', padding: '10px 12px', background: C.panel, border: `1px solid ${C.border}`,
  borderRadius: 8, color: C.text, fontSize: 14, boxSizing: 'border-box',
}

function ConfiguracionTab({ communityId, communityName, toast, onCommunityDeleted, onGoVip }) {
  const { profile } = useAuthStore()
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [deletingCommunity, setDeletingCommunity] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('conversations')
        .select('name, description, avatar_url, is_public, plan, rules, show_members')
        .eq('id', communityId)
        .single()
      setCfg(data || {})
      setLoading(false)
    }
    load()
  }, [communityId])

  const PLAN_LIMITS = {
    free:    { label: 'Gratis',        members: 100 },
    starter: { label: 'PRO Starter',   members: 500 },
    elite:   { label: 'PRO Elite',     members: 2000 },
    pro:     { label: 'PRO',           members: 1000 },
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast('La imagen no debe superar 2MB', 'error'); return }
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `community-avatars/${communityId}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('attachments')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) {
      toast('Error al subir foto: ' + (upErr.message || JSON.stringify(upErr)), 'error')
      setUploadingAvatar(false)
      return
    }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)
    const publicUrl = urlData.publicUrl + '?v=' + Date.now()
    const { error: dbErr } = await supabase.from('conversations').update({ avatar_url: publicUrl }).eq('id', communityId)
    if (dbErr) { toast('Error al guardar: ' + dbErr.message, 'error') }
    else { setCfg(c => ({ ...c, avatar_url: publicUrl })); toast('Foto actualizada ✓', 'ok') }
    setUploadingAvatar(false)
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('conversations')
      .update({
        name: cfg.name,
        description: cfg.description,
        is_public: cfg.is_public,
        show_members: cfg.show_members ?? true,
        rules: cfg.rules || null,
      })
      .eq('id', communityId)
    setSaving(false)
    if (error) toast('Error al guardar: ' + error.message, 'error')
    else toast('Configuración guardada ✓', 'ok')
  }

  if (loading || !cfg) return <Spinner />

  return (
    <div style={{ padding: 16 }}>
      {/* Community avatar */}
      <CfgField label="Foto de la comunidad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {cfg.avatar_url
              ? <img src={cfg.avatar_url} alt="" style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover', border: `2px solid ${C.border}` }} />
              : <div style={{ width: 72, height: 72, borderRadius: 18, background: 'linear-gradient(135deg,#00f5d4,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>🌐</div>
            }
            {uploadingAvatar && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 20, height: 20, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              </div>
            )}
          </div>
          <div>
            <label style={{ display: 'inline-block', padding: '8px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, color: C.text, fontWeight: 600 }}>
              {uploadingAvatar ? 'Subiendo...' : '📷 Cambiar foto'}
              <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} disabled={uploadingAvatar} />
            </label>
            <div style={{ color: C.textDim, fontSize: 11, marginTop: 6 }}>JPG, PNG o WebP · Máx. 2MB</div>
          </div>
        </div>
      </CfgField>
      <CfgField label="Nombre de la comunidad">
        <input value={cfg.name || ''} onChange={e => setCfg(c => ({ ...c, name: e.target.value }))} style={cfgInputStyle} />
      </CfgField>
      <CfgField label="Descripción">
        <textarea value={cfg.description || ''} onChange={e => setCfg(c => ({ ...c, description: e.target.value }))}
          rows={3} style={{ ...cfgInputStyle, resize: 'vertical' }} />
      </CfgField>
      <CfgField label="Plan de comunidad">
        {(() => {
          const role = profile?.role || 'member'
          const planKey = ['superadmin','admin','ceo'].includes(role) ? 'elite'
            : ['comunidad'].includes(role) ? 'elite'
            : ['vip'].includes(role) ? 'pro'
            : cfg?.plan || 'free'
          const pCfg = PLAN_LIMITS[planKey] || PLAN_LIMITS.free
          const isFree = planKey === 'free'
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.panel, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <div>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{pCfg.label}</div>
                <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>Capacidad: hasta {pCfg.members} miembros</div>
              </div>
              {isFree
                ? <button onClick={() => { window.location.hash = '#/perfil/vip' }} style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: C.green, color: '#000', border: 'none', cursor: 'pointer' }}>
                    ⭐ Actualizar
                  </button>
                : <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: `${C.green}20`, color: C.green }}>✓ Activo</span>
              }
            </div>
          )
        })()}
      </CfgField>
      <CfgField label="Reglas de la comunidad">
        <textarea
          value={cfg.rules || ''}
          onChange={e => setCfg(c => ({ ...c, rules: e.target.value }))}
          rows={4}
          placeholder="Ej: 1. Respeto entre miembros&#10;2. No spam ni publicidad&#10;3. Resultados deben enviarse con captura&#10;4. Fair play siempre"
          style={{ ...cfgInputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
        />
        <div style={{ textAlign: 'right', fontSize: 11, color: C.textDim, marginTop: 4 }}>{(cfg.rules || '').length}/1000</div>
      </CfgField>
      <CfgField label="Visibilidad">
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ v: true, label: '🌐 Pública', desc: 'Aparece en Explorar' }, { v: false, label: '🔒 Privada', desc: 'Solo por invitación' }].map(opt => (
            <button key={String(opt.v)} onClick={() => setCfg(c => ({ ...c, is_public: opt.v }))} style={{
              flex: 1, padding: '10px 8px', borderRadius: 8, border: `1px solid ${cfg.is_public === opt.v ? C.green : C.border}`,
              cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: cfg.is_public === opt.v ? `${C.green}22` : C.panel,
              color: cfg.is_public === opt.v ? C.green : C.textDim,
            }}>
              <div>{opt.label}</div>
              <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </CfgField>
      <CfgField label="Lista de miembros" desc="Elegí si los miembros pueden ver la lista de integrantes de la comunidad">
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ v: true, label: '👥 Visible', desc: 'Cualquier miembro puede ver la lista' }, { v: false, label: '🔒 Solo CEO', desc: 'Solo admins ven los miembros' }].map(opt => (
            <button key={String(opt.v)} onClick={() => setCfg(c => ({ ...c, show_members: opt.v }))} style={{
              flex: 1, padding: '10px 8px', borderRadius: 8, border: `1px solid ${(cfg.show_members ?? true) === opt.v ? C.green : C.border}`,
              cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: (cfg.show_members ?? true) === opt.v ? `${C.green}22` : C.panel,
              color: (cfg.show_members ?? true) === opt.v ? C.green : C.textDim,
            }}>
              <div>{opt.label}</div>
              <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </CfgField>
      <button onClick={save} disabled={saving} style={{
        width: '100%', padding: '12px 16px', background: C.green, color: C.bg, border: 'none',
        borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer',
        opacity: saving ? 0.7 : 1, marginTop: 8,
      }}>
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>

      {/* ── Zona de peligro ── */}
      <div style={{ marginTop: 24, borderTop: `1px solid #ef444430`, paddingTop: 20 }}>
        <div style={{ color: '#ef4444', fontWeight: 800, fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          ⚠️ Zona de peligro
        </div>

        <div style={{ background: '#ef444408', border: '1px solid #ef444430', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🗑️ Eliminar comunidad</div>
            <div style={{ color: C.textDim, fontSize: 12, lineHeight: 1.6 }}>
              Se eliminarán <strong style={{ color: C.text }}>permanentemente</strong> todos los canales, mensajes, torneos, ligas, grupos, partidos, anuncios y miembros de <strong style={{ color: '#ef4444' }}>{communityName || 'esta comunidad'}</strong>.
            </div>
          </div>
          <div>
            <div style={{ color: C.textDim, fontSize: 11, marginBottom: 6 }}>
              Escribí <strong style={{ color: C.text }}>{communityName || '…'}</strong> para confirmar:
            </div>
            <input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={communityName || 'Nombre de la comunidad'}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: C.bg, border: `1px solid ${deleteConfirmText === communityName && communityName ? '#ef4444' : C.border}`,
                borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none',
              }}
            />
          </div>
            <button
              disabled={!communityName || deleteConfirmText !== communityName || deletingCommunity}
              onClick={async () => {
                if (!communityName || deleteConfirmText !== communityName) return
                setDeletingCommunity(true)
                try {
                  // Best-effort delete helper — RLS policies on some tables cause 500s, we skip and continue
                  const tryDel = (table, col, val) =>
                    supabase.from(table).delete().eq(col, val).then(() => {})

                  // Get all sub-conversations (channels, tournaments, ligas)
                  const { data: subChans } = await supabase.from('conversations').select('id').eq('community_id', communityId)
                  const subIds = (subChans || []).map(c => c.id)

                  // Cascade-delete tournament data for every tournament/liga
                  const torneoIds = subIds // all sub-convs; tournament-only tables will just no-op on non-tournament ids
                  for (const tid of torneoIds) {
                    await tryDel('tournament_disputes', 'tournament_id', tid)
                    await tryDel('tournament_draw_events', 'tournament_id', tid)
                    await tryDel('tournament_group_members', 'tournament_id', tid)
                    await tryDel('tournament_standings', 'tournament_id', tid)
                    await tryDel('tournament_brackets', 'tournament_id', tid)
                    const { data: mIds } = await supabase.from('tournament_matches').select('id').eq('tournament_id', tid)
                    if (mIds?.length) await supabase.from('match_results').delete().in('match_id', mIds.map(m => m.id))
                    await tryDel('tournament_matches', 'tournament_id', tid)
                    await tryDel('tournament_groups', 'tournament_id', tid)
                  }

                  // Delete all sub-channel members/messages/conversations
                  for (const sid of subIds) {
                    await tryDel('conversation_members', 'conversation_id', sid)
                    await tryDel('messages', 'conversation_id', sid)
                    await tryDel('conversations', 'id', sid)
                  }

                  // Delete community-level data (best-effort each)
                  // First get announcement IDs so we can delete likes by announcement_id
                  const { data: annRows } = await supabase.from('announcements').select('id').eq('conversation_id', communityId)
                  if (annRows?.length) {
                    const annIds = annRows.map(a => a.id)
                    await supabase.from('announcement_likes').delete().in('announcement_id', annIds).then(() => {})
                  }
                  await tryDel('announcements', 'conversation_id', communityId)
                  await tryDel('community_requests', 'community_id', communityId)
                  await tryDel('conversation_members', 'conversation_id', communityId)
                  await tryDel('messages', 'conversation_id', communityId)

                  // Final: delete the community conversation itself
                  await supabase.from('conversations').delete().eq('id', communityId)
                  // If RLS blocks hard delete, soft-delete so it disappears from all lists
                  const { data: stillExists } = await supabase.from('conversations').select('id').eq('id', communityId).maybeSingle()
                  if (stillExists) {
                    const { error: softErr } = await supabase.from('conversations').update({
                      name: '[eliminado]', group_type: 'deleted', community_id: null, is_public: false,
                    }).eq('id', communityId)
                    if (softErr) throw new Error('Sin permisos para eliminar esta comunidad.')
                  }

                  onCommunityDeleted?.()
                } catch (e) {
                  toast('Error al eliminar: ' + e.message, 'error')
                  setDeletingCommunity(false)
                }
              }}
              style={{
                padding: '11px', background: communityName && deleteConfirmText === communityName && !deletingCommunity ? '#ef4444' : C.border,
                color: communityName && deleteConfirmText === communityName && !deletingCommunity ? '#fff' : C.textDim,
                border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: communityName && deleteConfirmText === communityName ? 'pointer' : 'default',
                transition: 'all .15s',
              }}
            >
              {deletingCommunity ? 'Eliminando...' : '🗑️ Eliminar comunidad para siempre'}
            </button>
          </div>
        </div>
      </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Anuncios Tab
// ══════════════════════════════════════════════════════════════════════════════
const GAMES_LIST = ['eFootball', 'FC 26', 'FC 25', 'FIFA', 'Warzone', 'Fortnite', 'Free Fire', 'Otro']

function AnunciosTab({ communityId, profile, toast }) {
  const [anuncios, setAnuncios] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [myTournaments, setMyTournaments] = useState([])
  const fileRef = useRef()

  // Form state
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [game, setGame] = useState('')
  const [category, setCategory] = useState('torneo')
  const [selectedTournament, setSelectedTournament] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [isPinned, setIsPinned] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('announcements')
      .select('*, author:users!announcements_author_id_fkey(id, display_name, avatar_url), tournament:conversations!announcements_tournament_id_fkey(id, name, tournament_status, group_type, max_participants)')
      .eq('conversation_id', communityId)
      .eq('is_active', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setAnuncios(data || [])
    setLoading(false)
  }, [communityId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    supabase.from('conversations')
      .select('id, name, group_type, tournament_status, max_participants')
      .in('group_type', ['tournament', 'liga'])
      .eq('community_id', communityId)
      .in('tournament_status', ['inscripcion', 'draw', 'en_curso'])
      .order('created_at', { ascending: false })
      .then(({ data }) => setMyTournaments(data || []))
  }, [communityId])

  function resetForm() {
    setTitle(''); setBody(''); setGame(''); setCategory('torneo')
    setSelectedTournament(''); setLinkUrl(''); setLinkLabel('')
    setImageFile(null); setImagePreview(null); setIsPinned(false)
  }

  function pickImage(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target?.result)
    reader.readAsDataURL(f)
  }

  async function handlePublish() {
    if (!title.trim()) { toast('Escribí un título', 'error'); return }
    setSaving(true)
    try {
      let image_url = null
      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const path = `announcements/${communityId}-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('attachments').upload(path, imageFile, { upsert: true, contentType: imageFile.type })
        if (!upErr) {
          const { data: ud } = supabase.storage.from('attachments').getPublicUrl(path)
          image_url = ud.publicUrl
        }
      }
      const { error } = await supabase.from('announcements').insert({
        author_id: profile.id,
        conversation_id: communityId,
        title: title.trim(),
        body: body.trim() || null,
        image_url,
        game: game || null,
        category,
        is_pinned: isPinned,
        link_url: linkUrl.trim() || null,
        link_label: linkUrl.trim() ? (linkLabel.trim() || 'Ver más') : null,
        tournament_id: selectedTournament || null,
      })
      if (error) throw error
      toast('Anuncio publicado ✓', 'ok')
      resetForm()
      setShowForm(false)
      load()
    } catch (e) {
      toast('Error: ' + e.message, 'error')
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este anuncio?')) return
    await supabase.from('announcements').delete().eq('id', id)
    setAnuncios(prev => prev.filter(a => a.id !== id))
    toast('Anuncio eliminado', 'ok')
  }

  const inp = {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '10px 12px', color: C.text, fontSize: 13,
    width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
  }
  const lbl = { display: 'block', color: C.textDim, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }

  if (loading) return <Spinner />

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>
          {anuncios.length} anuncio{anuncios.length !== 1 ? 's' : ''} publicado{anuncios.length !== 1 ? 's' : ''}
        </div>
        <button onClick={() => setShowForm(s => !s)} style={{
          padding: '8px 16px', background: showForm ? C.border : C.green, color: showForm ? C.text : '#000',
          border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          {showForm ? '✕ Cancelar' : '+ Nuevo anuncio'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>📢 Nuevo anuncio</div>

          {/* Flyer */}
          <div>
            <label style={lbl}>Flyer / Imagen (opcional)</label>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickImage} />
            {imagePreview ? (
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden' }}>
                <img src={imagePreview} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }} style={{
                  position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.65)',
                  border: 'none', borderRadius: '50%', width: 26, height: 26,
                  color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} style={{
                width: '100%', padding: '20px 0', borderRadius: 10,
                border: `2px dashed ${C.border}`, background: C.bg, cursor: 'pointer',
                color: C.textDim, fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              }}>
                <span style={{ fontSize: 24 }}>🖼️</span>
                <span>Subir flyer</span>
              </button>
            )}
          </div>

          {/* Título */}
          <div>
            <label style={lbl}>Título *</label>
            <input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Torneo Relámpago — 16 cupos" maxLength={80} />
          </div>

          {/* Descripción */}
          <div>
            <label style={lbl}>Descripción</label>
            <textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder="Premios, fechas, reglas, requisitos..." />
          </div>

          {/* Categoría + Juego */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Categoría</label>
              <select style={{ ...inp, appearance: 'none', cursor: 'pointer' }} value={category} onChange={e => setCategory(e.target.value)}>
                <option value="torneo">🏆 Torneo</option>
                <option value="liga">⚽ Liga</option>
                <option value="evento">🎮 Evento</option>
                <option value="noticia">📰 Noticia</option>
                <option value="general">💬 General</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Juego</label>
              <select style={{ ...inp, appearance: 'none', cursor: 'pointer' }} value={game} onChange={e => setGame(e.target.value)}>
                <option value="">Sin especificar</option>
                {GAMES_LIST.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          {/* Vincular torneo/liga */}
          {myTournaments.length > 0 && (
            <div>
              <label style={lbl}>Vincular torneo/liga (botón "Inscribirse")</label>
              <select style={{ ...inp, appearance: 'none', cursor: 'pointer' }} value={selectedTournament} onChange={e => setSelectedTournament(e.target.value)}>
                <option value="">Sin vincular</option>
                {myTournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.group_type === 'liga' ? '⚽' : '🏆'} {t.name} ({t.tournament_status === 'inscripcion' ? 'Inscripción abierta' : 'En curso'})</option>
                ))}
              </select>
              {selectedTournament && <div style={{ color: C.green, fontSize: 11, marginTop: 4 }}>✓ Aparecerá botón "Inscribirse →" en el anuncio</div>}
            </div>
          )}

          {/* Link externo */}
          <div>
            <label style={lbl}>Link externo (opcional)</label>
            <input style={inp} value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." />
            {linkUrl && <input style={{ ...inp, marginTop: 6 }} value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder='Etiqueta ("Inscribirse", "Ver bracket")' />}
          </div>

          {/* Fijar */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', background: C.bg, borderRadius: 10, border: `1px solid ${isPinned ? C.green : C.border}` }}>
            <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} style={{ accentColor: C.green, width: 15, height: 15 }} />
            <div>
              <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>📌 Fijar anuncio</div>
              <div style={{ color: C.textDim, fontSize: 11 }}>Aparece primero en el feed global</div>
            </div>
          </label>

          <button onClick={handlePublish} disabled={saving || !title.trim()} style={{
            padding: '12px', background: saving || !title.trim() ? C.border : C.green,
            color: saving || !title.trim() ? C.textDim : '#000',
            border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: saving ? 'default' : 'pointer',
          }}>
            {saving ? 'Publicando...' : '📢 Publicar anuncio'}
          </button>
        </div>
      )}

      {/* List */}
      {anuncios.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textDim, fontSize: 13 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📢</div>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>Sin anuncios aún</div>
          <div>Publicá torneos, ligas o noticias de tu comunidad.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {anuncios.map(ann => {
            const catColors = { torneo: '#f59e0b', liga: '#10b981', evento: '#6366f1', noticia: '#3b82f6', general: '#6b7280' }
            const catColor = catColors[ann.category] || '#6b7280'
            return (
              <div key={ann.id} style={{
                background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden',
                boxShadow: ann.is_pinned ? `0 0 0 2px ${C.green}44` : 'none',
              }}>
                {ann.is_pinned && (
                  <div style={{ background: `${C.green}15`, padding: '5px 12px', borderBottom: `1px solid ${C.green}22`, fontSize: 11, fontWeight: 700, color: C.green }}>
                    📌 FIJADO
                  </div>
                )}
                {ann.image_url && (
                  <img src={ann.image_url} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                )}
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: `${catColor}20`, color: catColor, borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 700 }}>
                      {ann.category?.toUpperCase()}
                    </span>
                    {ann.game && <span style={{ color: C.textDim, fontSize: 11 }}>🎮 {ann.game}</span>}
                    {ann.is_pinned && <span style={{ marginLeft: 'auto', color: C.textDim, fontSize: 10 }}>📌</span>}
                  </div>
                  <div style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>{ann.title}</div>
                  {ann.body && <div style={{ color: C.textDim, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{ann.body}</div>}

                  {/* CTAs */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {ann.tournament_id && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 16px', borderRadius: 9, background: C.green, color: '#000',
                        fontSize: 13, fontWeight: 800,
                      }}>
                        {ann.category === 'liga' ? '⚽' : '🏆'} Inscribirse →
                      </div>
                    )}
                    {ann.link_url && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '8px 14px', borderRadius: 9,
                        background: C.bg, border: `1px solid ${C.border}`,
                        color: C.text, fontSize: 13, fontWeight: 700,
                      }}>
                        🔗 {ann.link_label || 'Ver más'}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                    <span style={{ color: C.textDim, fontSize: 11 }}>
                      {new Date(ann.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <button onClick={() => handleDelete(ann.id)} style={{
                      background: 'none', border: `1px solid ${C.border}`, borderRadius: 20,
                      padding: '4px 10px', cursor: 'pointer', color: '#ef4444', fontSize: 12,
                    }}>
                      🗑 Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Main CEOPanel
// ══════════════════════════════════════════════════════════════════════════════
export default function CEOPanel({ community, onBack, onCommunityDeleted, onGoVip }) {
  const { profile } = useAuthStore()
  const [tab, setTab] = useState('dashboard')
  const [showCreateTorneo, setShowCreateTorneo] = useState(false)
  const [viewTorneo, setViewTorneo] = useState(null)
  const [toast, setToast] = useState(null)
  const [openDisputesCount, setOpenDisputesCount] = useState(0)

  // Role guard
  const isCeo = ['superadmin', 'admin'].includes(profile?.role)
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
        showBotButton
      />
    )
  }

  const TABS = [
    { id: 'dashboard',   icon: '📊', label: 'Dashboard' },
    { id: 'torneos',     icon: '🏆', label: 'Torneos' },
    { id: 'anuncios',    icon: '📢', label: 'Anuncios' },
    { id: 'disputas',    icon: '⚖️', label: 'Disputas', badge: openDisputesCount },
    { id: 'solicitudes', icon: '🔔', label: 'Solicitudes' },
    { id: 'miembros',    icon: '👥', label: 'Miembros' },
    { id: 'roles',       icon: '🎖️', label: 'Roles' },
    { id: 'estadisticas',icon: '📈', label: 'Stats' },
    { id: 'referidos',   icon: '🔗', label: 'Referidos' },
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
            onNewTorneo={() => { setTab('torneos'); setShowCreateTorneo(true) }}
          />
        )}
        {tab === 'torneos' && (
          <TorneosTab
            communityId={communityId}
            profile={profile}
            onViewTorneo={setViewTorneo}
            toast={showToast}
            showCreate={showCreateTorneo}
            onHideCreate={() => setShowCreateTorneo(false)}
          />
        )}
        {tab === 'anuncios' && (
          <AnunciosTab
            communityId={communityId}
            profile={profile}
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
        {tab === 'roles' && (
          <RolesTab communityId={communityId} profile={profile} toast={showToast} />
        )}
        {tab === 'estadisticas' && (
          <EstadisticasTab communityId={communityId} />
        )}
        {tab === 'referidos' && (
          <ReferidosPanel communityId={communityId} />
        )}
        {tab === 'config' && (
          <ConfiguracionTab
            communityId={communityId}
            communityName={community?.name || ''}
            toast={showToast}
            onCommunityDeleted={onCommunityDeleted || onBack}
            onGoVip={onGoVip}
          />
        )}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
