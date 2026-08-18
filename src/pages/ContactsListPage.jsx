import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import ContactPage from './ContactPage'

const AVATAR_COLORS = ['#e91e63','#9c27b0','#1565c0','#00838f','#2e7d32','#e65100','#c62828']
function avatarColor(id) {
  if (!id) return C.panel2
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function Avatar({ name, url, size = 46 }) {
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: avatarColor(name),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.34, fontWeight: 700, color: '#fff',
        border: `1.5px solid ${C.border}`,
      }}>{name?.slice(0, 2).toUpperCase() || '?'}</div>
}

export default function ContactsListPage() {
  const { profile } = useAuthStore()
  const { setActiveConversation, fetchConversations } = useChatStore()
  const [mode, setMode] = useState('lista') // 'lista' | 'buscar' | 'invitaciones'
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [invitations, setInvitations] = useState([])
  const [invLoading, setInvLoading] = useState(false)
  const [sentInvMap, setSentInvMap] = useState({}) // userId → invitation_id
  const [contactIds, setContactIds] = useState(new Set())
  const [selectedUser, setSelectedUser] = useState(null)
  const [actionId, setActionId] = useState(null)
  const [removingId, setRemovingId] = useState(null)

  useEffect(() => {
    if (!profile?.id) return
    loadContacts()
    loadSentInvitations()
    loadReceivedInvitations()
  }, [profile?.id])

  async function loadContacts() {
    setLoading(true)
    const { data } = await supabase
      .from('contacts')
      .select('id, nickname, contact:users!contacts_contact_id_fkey(id, display_name, username, avatar_url, last_seen_at)')
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: false })
    const list = data || []
    setContacts(list)
    setContactIds(new Set(list.map(c => c.contact?.id).filter(Boolean)))
    setLoading(false)
  }

  async function loadSentInvitations() {
    const { data } = await supabase
      .from('chat_invitations')
      .select('id, to_user_id')
      .eq('from_user_id', profile.id)
      .eq('status', 'pending')
    const map = {}
    ;(data || []).forEach(inv => { map[inv.to_user_id] = inv.id })
    setSentInvMap(map)
  }

  async function loadReceivedInvitations() {
    setInvLoading(true)
    const { data } = await supabase
      .from('chat_invitations')
      .select('id, message, created_at, from_user:users!chat_invitations_from_user_id_fkey(id, display_name, username, avatar_url, plan, role)')
      .eq('to_user_id', profile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setInvitations(data || [])
    setInvLoading(false)
  }

  async function searchUsers(q) {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('users')
      .select('id, display_name, username, avatar_url, plan, role')
      .or(`username.ilike.%${q.replace('@', '')}%,display_name.ilike.%${q}%`)
      .neq('id', profile.id)
      .limit(12)
    setResults(data || [])
    setSearching(false)
  }

  async function sendInvitation(user) {
    setActionId(user.id)
    const { data, error } = await supabase
      .from('chat_invitations')
      .insert({ from_user_id: profile.id, to_user_id: user.id })
      .select('id')
      .single()
    if (!error && data) {
      setSentInvMap(prev => ({ ...prev, [user.id]: data.id }))
    }
    setActionId(null)
  }

  async function cancelInvitation(userId) {
    const invId = sentInvMap[userId]
    if (!invId) return
    setActionId(userId)
    await supabase.from('chat_invitations').update({ status: 'cancelled' }).eq('id', invId)
    setSentInvMap(prev => { const n = { ...prev }; delete n[userId]; return n })
    setActionId(null)
  }

  async function acceptInvitation(invId) {
    setActionId(invId)
    const { data, error } = await supabase.rpc('accept_chat_invitation', { p_invitation_id: invId })
    if (!error && data?.ok) {
      setInvitations(prev => prev.filter(i => i.id !== invId))
      await loadContacts()
      if (data.conversation_id) {
        setActiveConversation({ id: data.conversation_id, isGroup: false })
        fetchConversations(profile.id)
      }
    }
    setActionId(null)
  }

  async function rejectInvitation(invId) {
    setActionId(invId)
    await supabase.from('chat_invitations').update({ status: 'rejected', responded_at: new Date().toISOString() }).eq('id', invId)
    setInvitations(prev => prev.filter(i => i.id !== invId))
    setActionId(null)
  }

  async function removeContact(contactRowId, userId) {
    setRemovingId(userId)
    await supabase.from('contacts').delete().eq('id', contactRowId)
    setContacts(prev => prev.filter(c => c.id !== contactRowId))
    setContactIds(prev => { const s = new Set(prev); s.delete(userId); return s })
    setRemovingId(null)
  }

  const sorted = [...contacts].sort((a, b) => {
    const na = (a.nickname || a.contact?.display_name || '').toLowerCase()
    const nb = (b.nickname || b.contact?.display_name || '').toLowerCase()
    return na.localeCompare(nb)
  })
  const grouped = {}
  sorted.forEach(c => {
    const letter = (c.nickname || c.contact?.display_name || '?')[0].toUpperCase()
    if (!grouped[letter]) grouped[letter] = []
    grouped[letter].push(c)
  })

  const PLAN_BADGE = { vip: '⭐ VIP', comunidad: '🏆 PRO' }
  const ROLE_BADGE = { ceo: '👑 CEO', admin: '🛡️ Admin', organizador: '🎯 Org' }

  if (selectedUser) {
    return (
      <ContactPage
        user={selectedUser}
        onBack={() => setSelectedUser(null)}
        onChat={() => setSelectedUser(null)}
      />
    )
  }

  const tabs = [
    { id: 'lista', label: `Mis contactos (${contacts.length})` },
    { id: 'buscar', label: 'Agregar contacto' },
    { id: 'invitaciones', label: invitations.length > 0 ? `Invitaciones (${invitations.length})` : 'Invitaciones' },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px 10px', gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px' }}>Contactos</span>
          {invitations.length > 0 && (
            <span style={{ marginLeft: 'auto', background: C.green, color: C.bg, borderRadius: 20, fontSize: 11, fontWeight: 800, padding: '2px 8px' }}>
              {invitations.length}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '0 4px', overflowX: 'auto' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setMode(t.id); setSearch(''); setResults([]) }} style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 6px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
              color: mode === t.id ? C.green : C.textDim,
              borderBottom: `2px solid ${mode === t.id ? C.green : 'transparent'}`,
              transition: 'color .15s, border-color .15s',
              position: 'relative',
            }}>
              {t.label}
              {t.id === 'invitaciones' && invitations.length > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 2,
                  width: 7, height: 7, borderRadius: '50%',
                  background: C.green,
                }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── LISTA ── */}
        {mode === 'lista' && (
          <>
            {loading && <Spinner />}
            {!loading && contacts.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', gap: 16, textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: C.panel, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div>
                  <p style={{ margin: '0 0 6px', color: C.text, fontWeight: 700, fontSize: 16 }}>Sin contactos aún</p>
                  <p style={{ margin: 0, color: C.textDim, fontSize: 13, lineHeight: 1.5 }}>
                    Buscá personas e invitalas a chatear
                  </p>
                </div>
                <button onClick={() => setMode('buscar')} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: C.green, color: C.bg, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Buscar personas
                </button>
              </div>
            )}
            {!loading && Object.keys(grouped).sort().map(letter => (
              <div key={letter}>
                <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: '1px' }}>{letter}</div>
                {grouped[letter].map(c => {
                  const u = c.contact
                  if (!u) return null
                  const name = c.nickname || u.display_name
                  return (
                    <button key={c.id} onClick={() => setSelectedUser(u)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 16px', background: 'none', border: 'none',
                      borderBottom: `1px solid ${C.border}22`, cursor: 'pointer', textAlign: 'left',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = C.panel}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <Avatar name={name} url={u.avatar_url} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, color: C.text, fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                        <p style={{ margin: '2px 0 0', color: C.textDim, fontSize: 12 }}>@{u.username}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); removeContact(c.id, u.id) }} disabled={removingId === u.id} style={{
                        background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
                        padding: '5px 10px', cursor: 'pointer', color: C.textDim, fontSize: 11, fontWeight: 600, flexShrink: 0,
                      }}>
                        {removingId === u.id ? '...' : 'Quitar'}
                      </button>
                    </button>
                  )
                })}
              </div>
            ))}
          </>
        )}

        {/* ── BUSCAR ── */}
        {mode === 'buscar' && (
          <>
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0 12px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>
                <input
                  type="text" placeholder="Buscar por nombre o @usuario"
                  value={search} autoFocus
                  onChange={e => { setSearch(e.target.value); searchUsers(e.target.value) }}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 14, padding: '10px 0' }}
                />
                {search && <button onClick={() => { setSearch(''); setResults([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 0 }}>✕</button>}
              </div>
            </div>

            {!search && (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <p style={{ color: C.text2, fontSize: 14, margin: '0 0 4px', fontWeight: 600 }}>Encontrá personas</p>
                <p style={{ color: C.textDim, fontSize: 12, margin: 0 }}>Buscá por nombre o @usuario y enviales una invitación para chatear</p>
              </div>
            )}

            {searching && <Spinner />}

            {results.map(u => {
              const isContact = contactIds.has(u.id)
              const hasSent = !!sentInvMap[u.id]
              const busy = actionId === u.id

              return (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.border}22` }}>
                  <button onClick={() => setSelectedUser(u)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <Avatar name={u.display_name} url={u.avatar_url} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <p style={{ margin: 0, color: C.text, fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.display_name}</p>
                        {PLAN_BADGE[u.plan] && <span style={{ fontSize: 10, color: C.textDim }}>{PLAN_BADGE[u.plan]}</span>}
                        {ROLE_BADGE[u.role] && <span style={{ fontSize: 10, color: C.textDim }}>{ROLE_BADGE[u.role]}</span>}
                      </div>
                      <p style={{ margin: '2px 0 0', color: C.textDim, fontSize: 12 }}>@{u.username}</p>
                    </div>
                  </button>

                  {isContact ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.green, flexShrink: 0 }}>✓ Contacto</span>
                  ) : hasSent ? (
                    <button onClick={() => cancelInvitation(u.id)} disabled={busy} style={{
                      padding: '7px 12px', borderRadius: 10, border: `1px solid ${C.border}`,
                      background: 'none', color: C.textDim, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                    }}>
                      {busy ? '...' : '⏳ Pendiente'}
                    </button>
                  ) : (
                    <button onClick={() => sendInvitation(u)} disabled={busy} style={{
                      padding: '7px 12px', borderRadius: 10, border: 'none',
                      background: C.green, color: C.bg, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                      boxShadow: `0 2px 8px ${C.green}44`,
                    }}>
                      {busy ? '...' : '💬 Invitar'}
                    </button>
                  )}
                </div>
              )
            })}

            {search && !searching && results.length === 0 && (
              <p style={{ textAlign: 'center', padding: '32px 24px', color: C.textDim, fontSize: 13 }}>
                No se encontraron usuarios para "{search}"
              </p>
            )}
          </>
        )}

        {/* ── INVITACIONES RECIBIDAS ── */}
        {mode === 'invitaciones' && (
          <>
            {invLoading && <Spinner />}
            {!invLoading && invitations.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', gap: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 48 }}>💬</div>
                <p style={{ margin: '0 0 4px', color: C.text, fontWeight: 700, fontSize: 16 }}>Sin invitaciones</p>
                <p style={{ margin: 0, color: C.textDim, fontSize: 13, lineHeight: 1.5 }}>
                  Cuando alguien te invite a chatear, aparecerá acá
                </p>
              </div>
            )}
            {invitations.map(inv => {
              const u = inv.from_user
              const busy = actionId === inv.id
              return (
                <div key={inv.id} style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}22` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <button onClick={() => setSelectedUser(u)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <Avatar name={u.display_name} url={u.avatar_url} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <p style={{ margin: 0, color: C.text, fontWeight: 600, fontSize: 14 }}>{u.display_name}</p>
                          {PLAN_BADGE[u.plan] && <span style={{ fontSize: 10, color: C.textDim }}>{PLAN_BADGE[u.plan]}</span>}
                          {ROLE_BADGE[u.role] && <span style={{ fontSize: 10, color: C.textDim }}>{ROLE_BADGE[u.role]}</span>}
                        </div>
                        <p style={{ margin: '2px 0 0', color: C.textDim, fontSize: 12 }}>@{u.username}</p>
                      </div>
                    </button>
                  </div>

                  {inv.message && (
                    <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
                      <p style={{ margin: 0, color: C.text, fontSize: 13, fontStyle: 'italic' }}>"{inv.message}"</p>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => rejectInvitation(inv.id)} disabled={busy} style={{
                      flex: 1, padding: '10px 0', borderRadius: 12,
                      border: `1px solid ${C.border}`, background: 'none',
                      color: C.textDim, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    }}>
                      {busy ? '...' : 'Rechazar'}
                    </button>
                    <button onClick={() => acceptInvitation(inv.id)} disabled={busy} style={{
                      flex: 2, padding: '10px 0', borderRadius: 12,
                      border: 'none', background: C.green,
                      color: C.bg, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      boxShadow: `0 2px 12px ${C.green}44`,
                    }}>
                      {busy ? '...' : '✓ Aceptar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ padding: '40px 0', textAlign: 'center' }}>
      <div style={{ width: 28, height: 28, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto' }} />
    </div>
  )
}
