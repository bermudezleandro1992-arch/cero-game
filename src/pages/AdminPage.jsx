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
  { id: 'miembro',      label: 'Miembro' },
  { id: 'organizador',  label: 'Organizador' },
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

export default function AdminPage({ onBack }) {
  const { profile } = useAuthStore()
  const [tab, setTab] = useState('payments')
  const [payments, setPayments] = useState([])
  const [users, setUsers] = useState([])
  const [searchUser, setSearchUser] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [editPlan, setEditPlan] = useState('free')
  const [editRole, setEditRole] = useState(null)
  const [msg, setMsg] = useState(null)

  // Seguridad: solo CEO/admin
  if (!profile || !['ceo', 'admin'].includes(profile.role)) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
        <Header onBack={onBack} title="Panel Admin" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 48 }}>🔒</span>
          <p style={{ color: C.textDim, fontSize: 14 }}>Acceso restringido</p>
        </div>
      </div>
    )
  }

  useEffect(() => { loadPayments() }, [])

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

  const pendingCount = payments.filter(p => p.status === 'pending').length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <Header onBack={onBack} title="Panel Admin" />

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.panel, borderBottom: `1px solid ${C.border}` }}>
        <Tab label="Pagos" active={tab === 'payments'} count={pendingCount} onClick={() => setTab('payments')} />
        <Tab label="Usuarios" active={tab === 'users'} count={0} onClick={() => setTab('users')} />
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
      </div>
    </div>
  )
}
