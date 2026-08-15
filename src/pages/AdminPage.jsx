import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'

const TABS = [
  { id: 'reports', label: '🚨 Reportes' },
  { id: 'sanctions', label: '⛔ Sanciones' },
  { id: 'roles', label: '🏅 Rangos' },
  { id: 'manual', label: '🔨 Manual' },
]

const ROLES = [
  { id: 'ceo',       label: 'CEO',       color: '#f43f5e', bg: '#f43f5e20', emoji: '👑' },
  { id: 'vip',       label: 'VIP',       color: '#f59e0b', bg: '#f59e0b20', emoji: '⭐' },
  { id: 'community', label: 'Comunidad', color: '#8b5cf6', bg: '#8b5cf620', emoji: '🌐' },
  { id: 'moderator', label: 'Moderador', color: '#3b82f6', bg: '#3b82f620', emoji: '🛡️' },
]

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtExpiry(d) {
  if (!d) return 'Permanente'
  const diff = new Date(d) - new Date()
  if (diff <= 0) return 'Vencida'
  const h = Math.ceil(diff / 3600000)
  if (h < 24) return `${h}h restantes`
  return `${Math.ceil(h / 24)}d restantes`
}

function Badge({ type }) {
  const map = {
    mute:          { label: 'Silenciado',  bg: '#f59e0b22', color: '#f59e0b' },
    ban:           { label: 'Suspendido',  bg: '#ef444422', color: '#ef4444' },
    permanent_ban: { label: 'Permanente',  bg: '#7f1d1d',   color: '#fca5a5' },
    pending:       { label: 'Pendiente',   bg: '#f59e0b22', color: '#f59e0b' },
    actioned:      { label: 'Accionado',   bg: '#22c55e22', color: '#22c55e' },
    dismissed:     { label: 'Descartado',  bg: '#6b728022', color: '#9ca3af' },
  }
  const s = map[type] || { label: type, bg: C.panel2, color: C.textDim }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

// ── Reportes ─────────────────────────────────────────────────
function ReportsTab() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('spam_reports')
      .select(`
        id, reason, content_snapshot, status, created_at,
        reporter:reporter_id(display_name, username),
        reported:reported_user_id(id, display_name, username)
      `)
      .order('created_at', { ascending: false })
      .limit(50)
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setReports(data || [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function action(reportId, reportedUserId, status, sanctionReason) {
    if (status === 'actioned' && sanctionReason) {
      await supabase.rpc('auto_apply_sanction', {
        target_user_id: reportedUserId,
        p_reason: sanctionReason,
      })
    }
    await supabase.from('spam_reports').update({ status }).eq('id', reportId)
    load()
  }

  return (
    <div>
      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
        {['all', 'pending', 'actioned', 'dismissed'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: filter === f ? C.green : C.panel2,
            color: filter === f ? C.bg : C.textDim,
          }}>
            {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : f === 'actioned' ? 'Accionados' : 'Descartados'}
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: 32, textAlign: 'center', color: C.textDim }}>Cargando...</div>}

      {!loading && reports.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', color: C.textDim, fontSize: 14 }}>
          {filter === 'pending' ? '✅ Sin reportes pendientes' : 'Sin resultados'}
        </div>
      )}

      {reports.map(r => (
        <div key={r.id} style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}22` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                  @{r.reported?.username || '?'}
                </span>
                <Badge type={r.status} />
                <span style={{ color: C.textDim, fontSize: 11 }}>{fmtDate(r.created_at)}</span>
              </div>
              <div style={{ color: C.textDim, fontSize: 12, marginTop: 3 }}>
                Reportado por @{r.reporter?.username || '?'} · Motivo: {r.reason}
              </div>
              {r.content_snapshot && (
                <div style={{
                  marginTop: 8, padding: '8px 12px',
                  background: C.panel2, borderRadius: 10,
                  color: C.text, fontSize: 12,
                  borderLeft: `3px solid ${C.border}`,
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                }}>
                  {r.content_snapshot.slice(0, 200)}{r.content_snapshot.length > 200 ? '…' : ''}
                </div>
              )}
            </div>
          </div>

          {r.status === 'pending' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => action(r.id, r.reported?.id, 'actioned', r.content_snapshot ? `Spam detectado: ${r.reason}` : null)} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#ef444420', color: '#ef4444', fontSize: 12, fontWeight: 700,
              }}>
                ⛔ Sancionar
              </button>
              <button onClick={() => action(r.id, r.reported?.id, 'dismissed', null)} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: C.panel2, color: C.textDim, fontSize: 12, fontWeight: 700,
              }}>
                Descartar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Sanciones activas ─────────────────────────────────────────
function SanctionsTab() {
  const [sanctions, setSanctions] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sanctions')
      .select(`
        id, reason, sanction_type, offense_count, expires_at, is_active, created_at, device_fingerprint,
        user:user_id(id, display_name, username, avatar_url)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(100)
    setSanctions(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function lift(sanctionId) {
    await supabase.from('sanctions').update({ is_active: false }).eq('id', sanctionId)
    load()
  }

  return (
    <div>
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: C.textDim, fontSize: 13 }}>{sanctions.length} sanciones activas</span>
        <button onClick={load} style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer', fontSize: 13 }}>Actualizar</button>
      </div>

      {loading && <div style={{ padding: 32, textAlign: 'center', color: C.textDim }}>Cargando...</div>}

      {!loading && sanctions.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', color: C.textDim, fontSize: 14 }}>
          ✅ Sin sanciones activas
        </div>
      )}

      {sanctions.map(s => (
        <div key={s.id} style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}22` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>
                  @{s.user?.username || s.user?.display_name || '?'}
                </span>
                <Badge type={s.sanction_type} />
                <span style={{ color: C.textDim, fontSize: 11 }}>
                  Infracción #{s.offense_count}
                </span>
              </div>
              <div style={{ color: C.textDim, fontSize: 12, marginTop: 3 }}>{s.reason}</div>
              <div style={{ color: s.sanction_type === 'permanent_ban' ? '#ef4444' : C.green, fontSize: 11, marginTop: 2, fontWeight: 600 }}>
                {fmtExpiry(s.expires_at)}
              </div>
            </div>
            <button onClick={() => lift(s.id)} style={{
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: `${C.green}20`, color: C.green, fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>
              Levantar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Rangos ────────────────────────────────────────────────────
function RolesTab() {
  const { profile } = useAuthStore()
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState([])
  const [searching, setSearching] = useState(false)
  const [roleUsers, setRoleUsers] = useState([])  // usuarios con algún rango
  const [loadingRoles, setLoadingRoles] = useState(true)

  const loadRoleUsers = useCallback(async () => {
    setLoadingRoles(true)
    const { data } = await supabase
      .from('user_roles')
      .select(`
        id, role, notes, created_at,
        user:user_id(id, display_name, username, avatar_url),
        granted_by_user:granted_by(display_name, username)
      `)
      .order('created_at', { ascending: false })
    setRoleUsers(data || [])
    setLoadingRoles(false)
  }, [])

  useEffect(() => { loadRoleUsers() }, [loadRoleUsers])

  async function doSearch() {
    if (!search.trim()) return
    setSearching(true)
    const { data } = await supabase
      .from('users')
      .select('id, display_name, username, avatar_url')
      .or(`username.ilike.%${search.trim()}%,display_name.ilike.%${search.trim()}%`)
      .limit(8)
    setUsers(data || [])
    setSearching(false)
  }

  async function grantRole(userId, role) {
    await supabase.from('user_roles').upsert(
      { user_id: userId, role, granted_by: profile.id },
      { onConflict: 'user_id,role' }
    )
    loadRoleUsers()
  }

  async function revokeRole(roleId) {
    await supabase.from('user_roles').delete().eq('id', roleId)
    loadRoleUsers()
  }

  const userHasRole = (userId, role) => roleUsers.some(r => r.user?.id === userId && r.role === role)

  return (
    <div>
      {/* Buscador */}
      <div style={{ padding: 16, borderBottom: `1px solid ${C.border}` }}>
        <p style={{ margin: '0 0 10px', color: C.textDim, fontSize: 13 }}>
          Buscá un usuario para asignarle un rango
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="@username o nombre..."
            style={{
              flex: 1, background: C.panel2, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '9px 14px', color: C.text, fontSize: 14, outline: 'none',
            }}
          />
          <button onClick={doSearch} style={{
            padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: C.green, color: C.bg, fontSize: 13, fontWeight: 700,
          }}>
            Buscar
          </button>
        </div>

        {/* Resultados de búsqueda */}
        {searching && <div style={{ color: C.textDim, fontSize: 13, padding: '8px 0' }}>Buscando...</div>}
        {users.map(u => (
          <div key={u.id} style={{
            marginTop: 10, padding: '10px 14px', background: C.panel2, borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
              background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: C.text,
            }}>
              {u.avatar_url
                ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (u.display_name || '?').slice(0, 2).toUpperCase()
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{u.display_name}</div>
              <div style={{ color: C.textDim, fontSize: 11 }}>@{u.username}</div>
            </div>
            {/* Botones de rangos */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {ROLES.map(r => {
                const has = userHasRole(u.id, r.id)
                const existing = roleUsers.find(x => x.user?.id === u.id && x.role === r.id)
                return (
                  <button key={r.id}
                    onClick={() => has ? revokeRole(existing.id) : grantRole(u.id, r.id)}
                    style={{
                      padding: '5px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 700,
                      background: has ? r.bg : C.panel,
                      color: has ? r.color : C.textDim,
                      border: `1px solid ${has ? r.color + '40' : C.border}`,
                    }}
                  >
                    {r.emoji} {r.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Lista de usuarios con rangos */}
      <div style={{ padding: '10px 16px 4px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: C.textDim, fontSize: 13, fontWeight: 600 }}>Usuarios con rangos</span>
        <span style={{ color: C.textDim, fontSize: 12 }}>{roleUsers.length} total</span>
      </div>

      {loadingRoles && <div style={{ padding: 24, textAlign: 'center', color: C.textDim }}>Cargando...</div>}

      {!loadingRoles && roleUsers.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: C.textDim, fontSize: 13 }}>
          Sin usuarios con rango asignado aún
        </div>
      )}

      {roleUsers.map(r => {
        const role = ROLES.find(x => x.id === r.role) || { label: r.role, color: C.textDim, bg: C.panel2, emoji: '•' }
        return (
          <div key={r.id} style={{
            padding: '10px 16px', borderBottom: `1px solid ${C.border}22`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>
                  @{r.user?.username || r.user?.display_name || '?'}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: role.bg, color: role.color,
                }}>
                  {role.emoji} {role.label}
                </span>
              </div>
              {r.granted_by_user && (
                <div style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>
                  Asignado por @{r.granted_by_user.username || r.granted_by_user.display_name}
                </div>
              )}
            </div>
            <button onClick={() => revokeRole(r.id)} style={{
              padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#ef444415', color: '#ef4444', fontSize: 11, fontWeight: 700,
            }}>
              Quitar
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Sanción manual ────────────────────────────────────────────
function ManualTab() {
  const [username, setUsername] = useState('')
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState('24')
  const [type, setType] = useState('mute')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const { profile } = useAuthStore()

  async function applyManual() {
    if (!username.trim() || !reason.trim()) return
    setLoading(true)
    setResult(null)

    // Buscar usuario
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, username')
      .or(`username.eq.${username.trim()},display_name.ilike.${username.trim()}`)
      .limit(1)

    if (!users?.length) {
      setResult({ error: 'Usuario no encontrado' })
      setLoading(false)
      return
    }

    const target = users[0]
    const durationH = type === 'permanent_ban' ? null : parseInt(duration)
    const expiresAt = durationH ? new Date(Date.now() + durationH * 3600000).toISOString() : null

    // Desactivar sanción anterior
    await supabase.from('sanctions').update({ is_active: false })
      .eq('user_id', target.id).eq('is_active', true)

    // Contar ofensas
    const { count } = await supabase.from('sanctions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', target.id)

    await supabase.from('sanctions').insert({
      user_id:        target.id,
      admin_id:       profile.id,
      reason:         reason.trim(),
      offense_count:  (count || 0) + 1,
      sanction_type:  type,
      duration_hours: durationH,
      expires_at:     expiresAt,
    })

    setResult({ success: true, user: target, type, duration: durationH })
    setUsername(''); setReason('')
    setLoading(false)
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>
        Sancioná manualmente un usuario por nombre de usuario o nombre de perfil.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Usuario</label>
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="@username o nombre"
          style={{
            background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Tipo de sanción</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['mute', '🔇 Silencio'], ['ban', '⛔ Suspensión'], ['permanent_ban', '🚫 Permanente']].map(([v, label]) => (
            <button key={v} onClick={() => setType(v)} style={{
              flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700,
              background: type === v ? (v === 'permanent_ban' ? '#7f1d1d' : v === 'ban' ? '#ef444420' : `${C.green}20`) : C.panel2,
              color: type === v ? (v === 'permanent_ban' ? '#fca5a5' : v === 'ban' ? '#ef4444' : C.green) : C.textDim,
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {type !== 'permanent_ban' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Duración</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[['1', '1h'], ['6', '6h'], ['24', '24h'], ['168', '7 días'], ['720', '30 días']].map(([v, label]) => (
              <button key={v} onClick={() => setDuration(v)} style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: duration === v ? C.green : C.panel2,
                color: duration === v ? C.bg : C.textDim,
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Motivo</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Explica la razón de la sanción..."
          rows={3}
          style={{
            background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none',
            resize: 'none', fontFamily: 'inherit',
          }}
        />
      </div>

      <button
        onClick={applyManual}
        disabled={loading || !username.trim() || !reason.trim()}
        style={{
          padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: type === 'permanent_ban' ? '#ef4444' : C.green,
          color: C.bg, fontSize: 14, fontWeight: 700,
          opacity: loading || !username.trim() || !reason.trim() ? 0.5 : 1,
        }}
      >
        {loading ? 'Aplicando...' : 'Aplicar sanción'}
      </button>

      {result?.error && (
        <div style={{ padding: 12, borderRadius: 10, background: '#ef444420', color: '#ef4444', fontSize: 13 }}>
          ❌ {result.error}
        </div>
      )}
      {result?.success && (
        <div style={{ padding: 12, borderRadius: 10, background: `${C.green}20`, color: C.green, fontSize: 13 }}>
          ✅ Sanción aplicada a @{result.user.username || result.user.display_name}
          {result.duration ? ` por ${result.duration}h` : ' permanentemente'}
        </div>
      )}
    </div>
  )
}

// ── Panel principal ───────────────────────────────────────────
export default function AdminPage() {
  const { profile } = useAuthStore()
  const [tab, setTab] = useState('reports')
  const [isAdmin, setIsAdmin] = useState(null)

  useEffect(() => {
    if (!profile?.id) return
    supabase.from('admin_users').select('user_id').eq('user_id', profile.id).maybeSingle()
      .then(({ data }) => setIsAdmin(!!data))
  }, [profile?.id])

  if (isAdmin === null) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div style={{ width: 24, height: 24, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.bg, gap: 12 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <p style={{ color: C.text, fontWeight: 700, fontSize: 16, margin: 0 }}>Acceso restringido</p>
        <p style={{ color: C.textDim, fontSize: 13, margin: 0 }}>Solo administradores</p>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🛡️</span>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 17 }}>Panel Admin</span>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', padding: '8px 16px 0' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 4px', fontSize: 12, fontWeight: 700,
              color: tab === t.id ? C.green : C.textDim,
              borderBottom: `2px solid ${tab === t.id ? C.green : 'transparent'}`,
              transition: 'color .15s, border-color .15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'reports'   && <ReportsTab />}
        {tab === 'sanctions' && <SanctionsTab />}
        {tab === 'roles'     && <RolesTab />}
        {tab === 'manual'    && <ManualTab />}
      </div>
    </div>
  )
}
