import { useEffect, useState } from 'react'
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

function Avatar({ name, url, size = 48 }) {
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
  const { findOrCreateConversation, setActiveConversation, fetchConversations } = useChatStore()
  const [mode, setMode] = useState('lista') // 'lista' | 'buscar'
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState(null)
  const [removingId, setRemovingId] = useState(null)
  const [contactIds, setContactIds] = useState(new Set())
  const [selectedUser, setSelectedUser] = useState(null)

  useEffect(() => {
    if (!profile?.id) return
    loadContacts()
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

  async function searchUsers(q) {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('users')
      .select('id, display_name, username, avatar_url')
      .or(`username.ilike.%${q.replace('@', '')}%,display_name.ilike.%${q}%`)
      .neq('id', profile.id)
      .limit(12)
    setResults(data || [])
    setSearching(false)
  }

  async function addContact(user) {
    setAddingId(user.id)
    await supabase.from('contacts').upsert({ owner_id: profile.id, contact_id: user.id }, { onConflict: 'owner_id,contact_id' })
    setContactIds(prev => new Set([...prev, user.id]))
    await loadContacts()
    setAddingId(null)
  }

  async function removeContact(contactRowId, userId) {
    setRemovingId(userId)
    await supabase.from('contacts').delete().eq('id', contactRowId)
    setContacts(prev => prev.filter(c => c.id !== contactRowId))
    setContactIds(prev => { const s = new Set(prev); s.delete(userId); return s })
    setRemovingId(null)
  }

  async function openChat(userId, user) {
    const convId = await findOrCreateConversation(profile.id, userId)
    setActiveConversation({ id: convId, user, isGroup: false })
    fetchConversations(profile.id)
  }

  // Group contacts alphabetically
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

  if (selectedUser) {
    return (
      <ContactPage
        user={selectedUser}
        onBack={() => setSelectedUser(null)}
        onChat={() => { setSelectedUser(null) }}
      />
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span style={{ color: C.text, fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px' }}>Contactos</span>
          </div>
          <button
            onClick={() => { setMode(mode === 'buscar' ? 'lista' : 'buscar'); setSearch(''); setResults([]) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: mode === 'buscar' ? C.green : C.text2 }}
          >
            {mode === 'buscar'
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            }
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '0 16px' }}>
          {['lista', 'buscar'].map(t => (
            <button key={t} onClick={() => { setMode(t); setSearch(''); setResults([]) }} style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 0', fontSize: 13, fontWeight: 600,
              color: mode === t ? C.green : C.textDim,
              borderBottom: `2px solid ${mode === t ? C.green : 'transparent'}`,
              transition: 'color .15s, border-color .15s',
              textTransform: 'capitalize',
            }}>
              {t === 'lista' ? `Mis contactos (${contacts.length})` : 'Agregar contacto'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── LISTA ── */}
        {mode === 'lista' && (
          <>
            {loading && (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <div style={{ width: 28, height: 28, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto' }} />
              </div>
            )}
            {!loading && contacts.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', gap: 16, textAlign: 'center' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 20,
                  background: C.panel, border: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div>
                  <p style={{ margin: '0 0 6px', color: C.text, fontWeight: 700, fontSize: 16 }}>Sin contactos aún</p>
                  <p style={{ margin: 0, color: C.textDim, fontSize: 13, lineHeight: 1.5 }}>
                    Buscá personas por nombre o @usuario para agregarlas
                  </p>
                </div>
                <button
                  onClick={() => setMode('buscar')}
                  style={{
                    padding: '10px 24px', borderRadius: 10, border: 'none',
                    background: C.green, color: C.bg, fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', boxShadow: `0 2px 12px ${C.green}33`,
                  }}
                >
                  Buscar personas
                </button>
              </div>
            )}
            {!loading && Object.keys(grouped).sort().map(letter => (
              <div key={letter}>
                <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: '1px' }}>
                  {letter}
                </div>
                {grouped[letter].map(c => {
                  const u = c.contact
                  if (!u) return null
                  const name = c.nickname || u.display_name
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedUser(u)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 16px', background: 'none', border: 'none',
                        borderBottom: `1px solid ${C.border}22`, cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = C.panel}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <Avatar name={name} url={u.avatar_url} size={46} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, color: C.text, fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {name}
                        </p>
                        <p style={{ margin: '2px 0 0', color: C.textDim, fontSize: 12 }}>@{u.username}</p>
                      </div>
                      {/* Remove button */}
                      <button
                        onClick={e => { e.stopPropagation(); removeContact(c.id, u.id) }}
                        disabled={removingId === u.id}
                        style={{
                          background: 'none', border: `1px solid ${C.border}`,
                          borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                          color: C.textDim, fontSize: 11, fontWeight: 600, flexShrink: 0,
                        }}
                      >
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
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: C.panel2, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: '0 12px',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
                </svg>
                <input
                  type="text" placeholder="Buscar por nombre o @usuario"
                  value={search} autoFocus
                  onChange={e => { setSearch(e.target.value); searchUsers(e.target.value) }}
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: C.text, fontSize: 14, padding: '10px 0',
                  }}
                />
                {search && (
                  <button onClick={() => { setSearch(''); setResults([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 0 }}>✕</button>
                )}
              </div>
            </div>

            {!search && (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <p style={{ color: C.text2, fontSize: 14, margin: '0 0 4px', fontWeight: 600 }}>Encontrá personas</p>
                <p style={{ color: C.textDim, fontSize: 12, margin: 0 }}>Buscá por nombre o @usuario</p>
              </div>
            )}

            {searching && (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <div style={{ width: 22, height: 22, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto' }} />
              </div>
            )}

            {results.map(u => {
              const isContact = contactIds.has(u.id)
              return (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px', borderBottom: `1px solid ${C.border}22`,
                }}>
                  <button onClick={() => openChat(u.id, u)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <Avatar name={u.display_name} url={u.avatar_url} size={46} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, color: C.text, fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.display_name}</p>
                      <p style={{ margin: '2px 0 0', color: C.textDim, fontSize: 12 }}>@{u.username}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => isContact ? null : addContact(u)}
                    disabled={isContact || addingId === u.id}
                    style={{
                      padding: '7px 14px', borderRadius: 10, border: 'none', cursor: isContact ? 'default' : 'pointer',
                      background: isContact ? `${C.green}20` : C.green,
                      color: isContact ? C.green : C.bg,
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                      transition: 'all .15s',
                    }}
                  >
                    {addingId === u.id ? '...' : isContact ? '✓ Agregado' : '+ Agregar'}
                  </button>
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
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
