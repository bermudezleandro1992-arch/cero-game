import { useState, useEffect } from 'react'
import { C } from '../theme'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

const PLAN_OPTIONS = [
  { id: 'free',      label: 'Gratis',        emoji: '🆓', color: '#6b7280' },
  { id: 'vip',       label: 'VIP',           emoji: '⭐', color: '#f59e0b' },
  { id: 'comunidad', label: 'Comunidad Pro',  emoji: '🏆', color: '#8b5cf6' },
]

const ROLE_OPTIONS = [
  { id: 'member',       label: 'Miembro' },
  { id: 'organizador',  label: 'Organizador' },
  { id: 'moderador',    label: 'Moderador' },
  { id: 'vip',          label: 'VIP' },
  { id: 'comunidad',    label: 'Comunidad' },
  { id: 'admin',        label: 'Admin' },
  { id: 'ceo',          label: 'CEO' },
]

function Header({ onBack, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
      </button>
      <span style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>{title}</span>
    </div>
  )
}

function Tab({ label, active, count, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '10px 4px', border: 'none', background: 'none', cursor: 'pointer',
      borderBottom: `2px solid ${active ? C.green : 'transparent'}`,
      color: active ? C.green : C.textDim, fontSize: 12, fontWeight: active ? 700 : 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    }}>
      {label}
      {count > 0 && (
        <span style={{ background: active ? C.green : C.textDim, color: C.bg, borderRadius: 20, padding: '1px 6px', fontSize: 10, fontWeight: 800 }}>
          {count}
        </span>
      )}
    </button>
  )
}

const TICKET_PRIORITY = { low: { label: 'Baja', color: '#6b7280' }, normal: { label: 'Normal', color: '#3b82f6' }, high: { label: 'Alta', color: '#f59e0b' }, urgent: { label: 'Urgente', color: '#ef4444' } }
const DISPUTE_STATUS  = { open: { label: 'Abierta', color: '#f59e0b' }, reviewing: { label: 'En revisión', color: '#3b82f6' }, resolved: { label: 'Resuelta', color: '#22c55e' }, dismissed: { label: 'Desestimada', color: '#6b7280' } }

export default function AdminPage({ onBack }) {
  const { profile } = useAuthStore()
  const [tab, setTab] = useState('payments')
  const [referrals, setReferrals] = useState([])
  const [payments, setPayments] = useState([])
  const [users, setUsers] = useState([])
  const [banners, setBanners] = useState([])
  const [bannerForm, setBannerForm] = useState(null)
  const [tickets, setTickets] = useState([])
  const [disputes, setDisputes] = useState([])
  const [searchUser, setSearchUser] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [selectedDispute, setSelectedDispute] = useState(null)
  const [ticketNote, setTicketNote] = useState('')
  const [disputeResolution, setDisputeResolution] = useState('')
  const [editPlan, setEditPlan] = useState('free')
  const [editRole, setEditRole] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => { loadPayments(); loadTickets(); loadDisputes() }, [])

  async function loadPayments() {
    setLoading(true)
    const { data } = await supabase
      .from('payments')
      .select('*, users:user_id(id, username, avatar_url, email, plan, role)')
      .order('created_at', { ascending: false })
      .limit(50)
    setPayments(data || [])
    setLoading(false)
  }

  async function searchUsers(q) {
    if (!q.trim()) { setUsers([]); return }
    const { data } = await supabase
      .from('users')
      .select('id, username, avatar_url, email, plan, role, created_at')
      .or(`username.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(20)
    setUsers(data || [])
  }

  async function applyPlan(userId, plan, role) {
    setLoading(true)
    setMsg(null)
    try {
      const { data, error } = await supabase.rpc('admin_set_user_plan', {
        target_user_id: userId,
        new_plan: plan,
        new_role: role || null,
      })
      if (error) throw error
      setMsg({ type: 'ok', text: `Plan actualizado a ${plan.toUpperCase()}` })
      await loadPayments()
      setSelectedPayment(null)
      setSelectedUser(null)
      // Refrescar lista de usuarios si está activa
      if (searchUser) searchUsers(searchUser)
    } catch (e) {
      setMsg({ type: 'err', text: e.message || 'Error al actualizar' })
    }
    setLoading(false)
  }

  async function loadTickets() {
    const { data } = await supabase
      .from('support_tickets')
      .select('*, users:user_id(id, username, avatar_url, email)')
      .order('created_at', { ascending: false })
      .limit(60)
    setTickets(data || [])
  }

  async function updateTicket(id, updates) {
    await supabase.from('support_tickets').update({ ...updates, assigned_to: profile.id }).eq('id', id)
    loadTickets()
    setSelectedTicket(t => t?.id === id ? { ...t, ...updates } : t)
    setMsg({ type: 'ok', text: 'Ticket actualizado' })
  }

  async function loadDisputes() {
    const { data } = await supabase
      .from('disputes')
      .select('*, reporter:reporter_id(id, username, avatar_url), accused:accused_id(id, username, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(60)
    setDisputes(data || [])
  }

  async function updateDispute(id, updates) {
    await supabase.from('disputes').update({ ...updates, resolved_by: profile.id, updated_at: new Date().toISOString() }).eq('id', id)
    loadDisputes()
    setSelectedDispute(null)
    setMsg({ type: 'ok', text: 'Disputa actualizada' })
  }

  const pendingCount = payments.filter(p => p.status === 'pending').length

  async function loadReferrals() {
    const { data } = await supabase.from('referral_stats').select('*').limit(50)
    setReferrals(data || [])
  }

  async function loadBanners() {
    const { data } = await supabase.from('banners').select('*').order('priority', { ascending: false })
    setBanners(data || [])
  }

  async function saveBanner(b) {
    if (b.id) {
      await supabase.from('banners').update(b).eq('id', b.id)
    } else {
      await supabase.from('banners').insert(b)
    }
    setBannerForm(null)
    loadBanners()
  }

  async function deleteBanner(id) {
    await supabase.from('banners').delete().eq('id', id)
    loadBanners()
  }

  async function toggleBanner(id, active) {
    await supabase.from('banners').update({ active }).eq('id', id)
    loadBanners()
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <Header onBack={onBack} title="Panel Admin" />

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.panel, borderBottom: `1px solid ${C.border}`, overflowX: 'auto' }}>
        <Tab label="Pagos"     active={tab === 'payments'}  count={pendingCount} onClick={() => setTab('payments')} />
        <Tab label="Tickets"   active={tab === 'tickets'}   count={tickets.filter(t => t.status === 'open').length} onClick={() => setTab('tickets')} />
        <Tab label="Disputas"  active={tab === 'disputes'}  count={disputes.filter(d => d.status === 'open').length} onClick={() => setTab('disputes')} />
        <Tab label="Usuarios"  active={tab === 'users'}     count={0} onClick={() => setTab('users')} />
        <Tab label="Banners"   active={tab === 'banners'}   count={0} onClick={() => { setTab('banners'); loadBanners() }} />
        <Tab label="Referidos" active={tab === 'referrals'} count={0} onClick={() => { setTab('referrals'); loadReferrals() }} />
      </div>

      {/* Mensaje de feedback */}
      {msg && (
        <div style={{
          margin: '10px 16px 0', padding: '10px 14px', borderRadius: 10,
          background: msg.type === 'ok' ? `${C.green}18` : '#ef444418',
          border: `1px solid ${msg.type === 'ok' ? C.green : '#ef4444'}44`,
          color: msg.type === 'ok' ? C.green : '#ef4444', fontSize: 13, fontWeight: 600,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {msg.type === 'ok' ? '✅' : '❌'} {msg.text}
          <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16 }}>×</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

        {/* ── TAB PAGOS ── */}
        {tab === 'payments' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''} · {payments.length} total
              </p>
              <button onClick={loadPayments} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: C.textDim, fontSize: 11 }}>
                🔄 Actualizar
              </button>
            </div>

            {payments.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: C.textDim, fontSize: 13 }}>Sin pagos registrados</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {payments.map(p => {
                const u = p.users
                const isPending = p.status === 'pending'
                const proof = p.raw_data?.proof_url
                const isExpanded = selectedPayment?.id === p.id

                return (
                  <div key={p.id} style={{
                    background: C.panel, borderRadius: 14,
                    border: `1.5px solid ${isPending ? '#f59e0b44' : isExpanded ? C.green + '44' : C.border}`,
                    overflow: 'hidden',
                  }}>
                    {/* Header del pago */}
                    <div
                      onClick={() => setSelectedPayment(isExpanded ? null : p)}
                      style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        background: C.panel2, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {u?.avatar_url
                          ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 18 }}>👤</span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>@{u?.username || 'desconocido'}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20,
                            background: isPending ? '#f59e0b22' : p.status === 'approved' ? `${C.green}22` : '#6b728022',
                            color: isPending ? '#f59e0b' : p.status === 'approved' ? C.green : C.textDim,
                          }}>
                            {isPending ? '⏳ PENDIENTE' : p.status === 'approved' ? '✅ APROBADO' : '❌ RECHAZADO'}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                          {p.method?.toUpperCase()} · {p.plan?.toUpperCase()} · ${p.amount_usd} USD · {new Date(p.created_at).toLocaleDateString('es-AR')}
                        </div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: '.2s', flexShrink: 0 }}>
                        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>

                    {/* Detalle expandido */}
                    {isExpanded && (
                      <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px' }}>

                        {/* Comprobante imagen */}
                        {proof && (
                          <div style={{ marginBottom: 14 }}>
                            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>Comprobante</p>
                            <a href={proof} target="_blank" rel="noreferrer">
                              <img src={proof} alt="comprobante" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 10, border: `1px solid ${C.border}`, background: C.panel2 }} />
                            </a>
                            <p style={{ margin: '6px 0 0', fontSize: 11, color: C.textDim }}>Tocá la imagen para verla completa</p>
                          </div>
                        )}

                        {/* TX Hash */}
                        {p.tx_hash && (
                          <div style={{ marginBottom: 10 }}>
                            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>N° operación</p>
                            <p style={{ margin: 0, fontSize: 12, fontFamily: 'monospace', color: C.text, wordBreak: 'break-all', background: C.panel2, padding: '8px 10px', borderRadius: 8 }}>{p.tx_hash}</p>
                          </div>
                        )}

                        {/* Nota */}
                        {p.raw_data?.note && (
                          <div style={{ marginBottom: 14 }}>
                            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>Nota</p>
                            <p style={{ margin: 0, fontSize: 12, color: C.text2 }}>{p.raw_data.note}</p>
                          </div>
                        )}

                        {/* Sin comprobante */}
                        {!proof && !p.tx_hash && (
                          <p style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>⚠️ Sin comprobante adjunto</p>
                        )}

                        {/* Acción: asignar plan */}
                        {isPending && (
                          <div style={{ background: C.panel2, borderRadius: 12, padding: '12px' }}>
                            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: C.text }}>Asignar plan a @{u?.username}</p>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                              {PLAN_OPTIONS.map(opt => (
                                <button key={opt.id} onClick={() => setEditPlan(opt.id)} style={{
                                  padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${editPlan === opt.id ? opt.color : C.border}`,
                                  background: editPlan === opt.id ? `${opt.color}20` : 'transparent',
                                  color: editPlan === opt.id ? opt.color : C.textDim,
                                  cursor: 'pointer', fontSize: 12, fontWeight: 700,
                                }}>
                                  {opt.emoji} {opt.label}
                                </button>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => applyPlan(u?.id, editPlan, null)}
                                disabled={loading}
                                style={{
                                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                                  background: C.green, color: C.bg, fontWeight: 800, fontSize: 13, cursor: 'pointer',
                                }}
                              >
                                {loading ? 'Guardando...' : `✅ Aprobar · ${editPlan.toUpperCase()}`}
                              </button>
                              <button
                                onClick={async () => {
                                  await supabase.from('payments').update({ status: 'dismissed', reviewed_by: profile.id, updated_at: new Date().toISOString() }).eq('id', p.id)
                                  setMsg({ type: 'err', text: 'Pago rechazado' })
                                  loadPayments()
                                  setSelectedPayment(null)
                                }}
                                style={{
                                  padding: '10px 14px', borderRadius: 10, border: `1px solid #ef444444`,
                                  background: '#ef444418', color: '#ef4444', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                }}
                              >
                                ❌
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── TAB TICKETS ── */}
        {tab === 'tickets' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                {tickets.filter(t => t.status === 'open').length} abiertos · {tickets.length} total
              </p>
              <button onClick={loadTickets} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: C.textDim, fontSize: 11 }}>🔄</button>
            </div>
            {tickets.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: C.textDim, fontSize: 13 }}>Sin tickets</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tickets.map(t => {
                const isOpen = t.status === 'open'
                const isExp  = selectedTicket?.id === t.id
                const pri    = TICKET_PRIORITY[t.priority] || TICKET_PRIORITY.normal
                return (
                  <div key={t.id} style={{ background: C.panel, borderRadius: 14, border: `1.5px solid ${isOpen ? pri.color + '44' : C.border}`, overflow: 'hidden' }}>
                    <div onClick={() => { setSelectedTicket(isExp ? null : t); setTicketNote(t.staff_note || '') }}
                      style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: C.panel2, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {t.users?.avatar_url ? <img src={t.users.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 18 }}>👤</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{t.ticket_no || `#${t.id}`}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: `${pri.color}22`, color: pri.color }}>{pri.label}</span>
                          <span style={{ fontSize: 10, color: isOpen ? '#f59e0b' : t.status === 'resolved' ? C.green : C.textDim }}>{isOpen ? '⏳ ABIERTO' : t.status === 'in_progress' ? '🔵 EN PROCESO' : '✅ RESUELTO'}</span>
                        </div>
                        <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                          @{t.users?.username || '—'} · {new Date(t.created_at).toLocaleDateString('es-AR')}
                          {t.title && <span> · {t.title}</span>}
                        </div>
                      </div>
                    </div>
                    {isExp && (
                      <div style={{ borderTop: `1px solid ${C.border}`, padding: 14 }}>
                        {t.body && <p style={{ margin: '0 0 12px', fontSize: 13, color: C.text, lineHeight: 1.6 }}>{t.body}</p>}
                        <p style={{ margin: '0 0 6px', fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Nota interna</p>
                        <textarea value={ticketNote} onChange={e => setTicketNote(e.target.value)}
                          placeholder="Notas del equipo (internas, no visibles al usuario)..."
                          rows={3} style={{ width: '100%', boxSizing: 'border-box', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13, resize: 'vertical', marginBottom: 10, outline: 'none' }} />
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {['open','in_progress','resolved'].map(s => (
                            <button key={s} onClick={() => updateTicket(t.id, { status: s, staff_note: ticketNote })} style={{
                              flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                              background: s === 'resolved' ? C.green : s === 'in_progress' ? '#3b82f6' : C.panel2,
                              color: s === 'open' ? C.textDim : C.bg,
                            }}>
                              {s === 'open' ? '↩ Reabrir' : s === 'in_progress' ? '🔵 En proceso' : '✅ Resolver'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── TAB DISPUTAS ── */}
        {tab === 'disputes' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                {disputes.filter(d => d.status === 'open').length} abiertas · {disputes.length} total
              </p>
              <button onClick={loadDisputes} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: C.textDim, fontSize: 11 }}>🔄</button>
            </div>
            {disputes.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: C.textDim, fontSize: 13 }}><div style={{ fontSize: 36, marginBottom: 8 }}>⚖️</div>Sin disputas registradas</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {disputes.map(d => {
                const st   = DISPUTE_STATUS[d.status] || DISPUTE_STATUS.open
                const isExp = selectedDispute?.id === d.id
                const typeLabels = { result: '🏆 Resultado', conduct: '⚠️ Conducta', cheating: '🚫 Trampa', other: '📋 Otro' }
                return (
                  <div key={d.id} style={{ background: C.panel, borderRadius: 14, border: `1.5px solid ${d.status === 'open' ? '#f59e0b44' : C.border}`, overflow: 'hidden' }}>
                    <div onClick={() => { setSelectedDispute(isExp ? null : d); setDisputeResolution(d.resolution || '') }}
                      style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 28, flexShrink: 0 }}>⚖️</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{typeLabels[d.type] || d.type}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: `${st.color}22`, color: st.color }}>{st.label.toUpperCase()}</span>
                        </div>
                        <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                          @{d.reporter?.username} vs @{d.accused?.username || '—'} · {new Date(d.created_at).toLocaleDateString('es-AR')}
                        </div>
                      </div>
                    </div>
                    {isExp && (
                      <div style={{ borderTop: `1px solid ${C.border}`, padding: 14 }}>
                        <p style={{ margin: '0 0 10px', fontSize: 13, color: C.text, lineHeight: 1.6, background: C.panel2, padding: '10px 12px', borderRadius: 10 }}>{d.description}</p>
                        {d.evidence_urls?.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <p style={{ margin: '0 0 8px', fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Evidencia</p>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {d.evidence_urls.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noreferrer">
                                  <img src={url} alt="" onError={e => { e.target.style.display = 'none' }} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}` }} />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        <p style={{ margin: '0 0 6px', fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Resolución</p>
                        <textarea value={disputeResolution} onChange={e => setDisputeResolution(e.target.value)}
                          placeholder="Describí la decisión tomada..."
                          rows={3} style={{ width: '100%', boxSizing: 'border-box', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13, resize: 'vertical', marginBottom: 10, outline: 'none' }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => updateDispute(d.id, { status: 'reviewing', resolution: disputeResolution })} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', background: '#3b82f620', color: '#3b82f6' }}>🔵 En revisión</button>
                          <button onClick={() => updateDispute(d.id, { status: 'resolved', resolution: disputeResolution })} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', background: `${C.green}20`, color: C.green }}>✅ Resolver</button>
                          <button onClick={() => updateDispute(d.id, { status: 'dismissed', resolution: disputeResolution })} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', background: '#6b728020', color: C.textDim }}>✕ Desestimar</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── TAB USUARIOS ── */}
        {tab === 'users' && (
          <>
            <input
              value={searchUser}
              onChange={e => { setSearchUser(e.target.value); searchUsers(e.target.value) }}
              placeholder="Buscar por @usuario o email..."
              style={{
                width: '100%', boxSizing: 'border-box',
                background: C.panel2, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '11px 14px', color: C.text, fontSize: 13,
                outline: 'none', marginBottom: 14,
              }}
            />

            {users.length === 0 && searchUser.length > 1 && (
              <p style={{ textAlign: 'center', color: C.textDim, fontSize: 13, marginTop: 24 }}>Sin resultados</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {users.map(u => {
                const isSelected = selectedUser?.id === u.id
                return (
                  <div key={u.id} style={{ background: C.panel, borderRadius: 14, border: `1.5px solid ${isSelected ? C.green + '44' : C.border}`, overflow: 'hidden' }}>
                    <div onClick={() => { setSelectedUser(isSelected ? null : u); setEditPlan(u.plan || 'free'); setEditRole(u.role || 'miembro') }}
                      style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: C.panel2, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {u.avatar_url ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 18 }}>👤</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>@{u.username}</div>
                        <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                          {u.email} · Plan: <strong style={{ color: C.text }}>{u.plan || 'free'}</strong> · Rol: <strong style={{ color: C.text }}>{u.role || 'miembro'}</strong>
                        </div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" style={{ transform: isSelected ? 'rotate(90deg)' : 'none', transition: '.2s', flexShrink: 0 }}>
                        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>

                    {isSelected && (
                      <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px' }}>
                        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: C.text }}>Plan</p>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                          {PLAN_OPTIONS.map(opt => (
                            <button key={opt.id} onClick={() => setEditPlan(opt.id)} style={{
                              padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${editPlan === opt.id ? opt.color : C.border}`,
                              background: editPlan === opt.id ? `${opt.color}20` : 'transparent',
                              color: editPlan === opt.id ? opt.color : C.textDim,
                              cursor: 'pointer', fontSize: 12, fontWeight: 700,
                            }}>
                              {opt.emoji} {opt.label}
                            </button>
                          ))}
                        </div>

                        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: C.text }}>Rol de plataforma</p>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                          {ROLE_OPTIONS.filter(r => profile.role === 'ceo' || r.id !== 'ceo').map(r => (
                            <button key={r.id} onClick={() => setEditRole(r.id)} style={{
                              padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${editRole === r.id ? C.green : C.border}`,
                              background: editRole === r.id ? `${C.green}18` : 'transparent',
                              color: editRole === r.id ? C.green : C.textDim,
                              cursor: 'pointer', fontSize: 11, fontWeight: 700,
                            }}>
                              {r.label}
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={() => applyPlan(u.id, editPlan, editRole)}
                          disabled={loading}
                          style={{
                            width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
                            background: C.green, color: C.bg, fontWeight: 800, fontSize: 13, cursor: 'pointer',
                          }}
                        >
                          {loading ? 'Guardando...' : `💾 Guardar — ${editPlan.toUpperCase()} / ${editRole}`}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── BANNERS ── */}
        {tab === 'banners' && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 15 }}>Banners / Sponsors</p>
              <button onClick={() => setBannerForm({ title: '', subtitle: '', emoji: '🎮', bg_color: '#0f172a', accent_color: '#22c55e', position: 'all', priority: 0, active: true, link_url: '' })} style={{ background: C.green, border: 'none', borderRadius: 8, color: C.bg, fontWeight: 700, fontSize: 12, padding: '7px 14px', cursor: 'pointer' }}>
                + Nuevo Banner
              </button>
            </div>

            {bannerForm && (
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <p style={{ margin: '0 0 12px', fontWeight: 700, color: C.green, fontSize: 13 }}>{bannerForm.id ? 'Editar Banner' : 'Nuevo Banner'}</p>
                {[
                  ['Título *', 'title', 'text'],
                  ['Subtítulo', 'subtitle', 'text'],
                  ['Emoji', 'emoji', 'text'],
                  ['URL imagen', 'image_url', 'text'],
                  ['URL destino (link)', 'link_url', 'text'],
                  ['Color fondo (hex)', 'bg_color', 'text'],
                  ['Color acento (hex)', 'accent_color', 'text'],
                  ['Prioridad (número)', 'priority', 'number'],
                ].map(([label, key, type]) => (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</p>
                    <input
                      type={type}
                      value={bannerForm[key] || ''}
                      onChange={e => setBannerForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }}
                    />
                  </div>
                ))}
                <div style={{ marginBottom: 12 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Posición</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['all','chats','explorar','torneos'].map(p => (
                      <button key={p} onClick={() => setBannerForm(f => ({ ...f, position: p }))} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${bannerForm.position === p ? C.green : C.border}`, background: bannerForm.position === p ? `${C.green}20` : C.panel2, color: bannerForm.position === p ? C.green : C.textDim, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setBannerForm(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={() => saveBanner(bannerForm)} disabled={!bannerForm.title} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: bannerForm.title ? C.green : C.panel2, color: bannerForm.title ? C.bg : C.textDim, fontWeight: 700, fontSize: 13, cursor: bannerForm.title ? 'pointer' : 'default' }}>
                    💾 Guardar
                  </button>
                </div>
              </div>
            )}

            {banners.length === 0 && !bannerForm && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textDim }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📢</div>
                <p style={{ margin: 0, fontSize: 13 }}>Sin banners activos. Tocá "+ Nuevo Banner" para agregar uno.</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {banners.map(b => (
                <div key={b.id} style={{ background: C.panel, border: `1px solid ${b.active ? b.accent_color + '44' : C.border}`, borderRadius: 12, padding: '12px 14px', opacity: b.active ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: b.bg_color, border: `1px solid ${b.accent_color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{b.emoji || '🎮'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: C.text }}>{b.title}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textDim }}>{b.position} · prioridad {b.priority}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => toggleBanner(b.id, !b.active)} style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: b.active ? `${C.green}20` : C.panel2, color: b.active ? C.green : C.textDim, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        {b.active ? '✅ ON' : '⏸ OFF'}
                      </button>
                      <button onClick={() => setBannerForm({ ...b })} style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.panel2, color: C.textDim, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✏️</button>
                      <button onClick={() => deleteBanner(b.id)} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #ef444433', background: '#ef444410', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── REFERIDOS ── */}
        {tab === 'referrals' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Top referidores del mes
              </p>
              <button onClick={loadReferrals} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: C.textDim, fontSize: 11 }}>
                🔄 Actualizar
              </button>
            </div>

            {referrals.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: C.textDim, fontSize: 13 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🔗</div>
                <p style={{ margin: 0 }}>Aún no hay referidos registrados este mes.</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {referrals.map((r, idx) => (
                <div key={r.referrer_id} style={{
                  background: C.panel, borderRadius: 12,
                  border: `1.5px solid ${idx === 0 ? '#f59e0b44' : C.border}`,
                  padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: idx === 0 ? '#f59e0b22' : C.panel2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 13,
                    color: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#cd7f32' : C.textDim,
                  }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </div>
                  {r.referrer_avatar
                    ? <img src={r.referrer_avatar} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👤</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>
                      {r.referrer_name || r.referrer_username}
                      {r.referrer_username && <span style={{ color: C.textDim, fontWeight: 400, fontSize: 11 }}> · @{r.referrer_username}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                      {r.total_referrals} total · <strong style={{ color: C.green }}>{r.referrals_this_month} este mes</strong>
                    </div>
                  </div>
                  <div style={{
                    background: `${C.green}18`, border: `1px solid ${C.green}33`,
                    borderRadius: 10, padding: '4px 12px', textAlign: 'center', flexShrink: 0,
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: C.green, fontVariantNumeric: 'tabular-nums' }}>
                      {r.referrals_this_month}
                    </div>
                    <div style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.5px' }}>este mes</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
