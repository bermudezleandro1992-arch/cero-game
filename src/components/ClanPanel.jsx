/**
 * ClanPanel — Gestión de clan del usuario (crear, ver, invitar, salir)
 * Se renderiza dentro de PerfilPage como una sección colapsable.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

const ROLE_LABEL = { leader: '👑 Líder', officer: '⭐ Oficial', member: '👤 Miembro' }

function Avatar({ name, url, size = 36 }) {
  const colors = ['#e91e63','#9c27b0','#1565c0','#00838f','#2e7d32','#e65100']
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length]
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.38, flexShrink: 0 }}>
        {(name || '?')[0].toUpperCase()}
      </div>
}

export default function ClanPanel({ profile }) {
  const [clan, setClan]           = useState(null)
  const [members, setMembers]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteSearch, setInviteSearch] = useState('')
  const [inviteResults, setInviteResults] = useState([])
  const [adding, setAdding]       = useState(null)

  // Create form
  const [cName, setCName]     = useState('')
  const [cTag, setCTag]       = useState('')
  const [cDesc, setCDesc]     = useState('')
  const [creating, setCreating] = useState(false)
  const [err, setErr]         = useState('')

  const isLeader = clan?.leader_id === profile?.id

  useEffect(() => { load() }, [profile?.id])

  async function load() {
    if (!profile?.id) return
    setLoading(true)
    // Find clan where user is member
    const { data: memberships } = await supabase
      .from('clan_members')
      .select('clan_id, role, clans(id, name, tag, description, logo_url, leader_id, is_public)')
      .eq('user_id', profile.id)
      .limit(1)
      .single()

    if (memberships?.clans) {
      setClan(memberships.clans)
      loadMembers(memberships.clans.id)
    } else {
      setClan(null)
      setMembers([])
    }
    setLoading(false)
  }

  async function loadMembers(clanId) {
    const { data } = await supabase
      .from('clan_members')
      .select('role, joined_at, users(id, display_name, username, avatar_url)')
      .eq('clan_id', clanId)
      .order('joined_at', { ascending: true })
    setMembers(data || [])
  }

  async function createClan() {
    if (!cName.trim() || !cTag.trim()) { setErr('Nombre y TAG son obligatorios.'); return }
    if (cTag.length > 5) { setErr('El TAG puede tener máximo 5 caracteres.'); return }
    setCreating(true); setErr('')
    const { data: newClan, error } = await supabase.from('clans').insert({
      name: cName.trim(),
      tag: cTag.trim().toUpperCase(),
      description: cDesc.trim() || null,
      leader_id: profile.id,
    }).select('id').single()

    if (error) { setErr(error.message.includes('unique') ? 'Ese TAG ya está en uso.' : error.message); setCreating(false); return }

    // Add leader as member
    await supabase.from('clan_members').insert({ clan_id: newClan.id, user_id: profile.id, role: 'leader' })
    setCreating(false)
    setShowCreate(false)
    setCName(''); setCTag(''); setCDesc('')
    load()
  }

  async function leaveClan() {
    if (!confirm('¿Seguro que querés salir del clan?')) return
    if (isLeader && members.length > 1) { alert('Transferí el liderazgo antes de salir.'); return }
    await supabase.from('clan_members').delete().eq('clan_id', clan.id).eq('user_id', profile.id)
    if (isLeader) await supabase.from('clans').delete().eq('id', clan.id)
    load()
  }

  async function searchUsers(q) {
    if (!q.trim()) { setInviteResults([]); return }
    const { data } = await supabase.from('users')
      .select('id, display_name, username, avatar_url')
      .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
      .neq('id', profile.id)
      .limit(8)
    // Filter already in clan
    const memberIds = new Set(members.map(m => m.users?.id))
    setInviteResults((data || []).filter(u => !memberIds.has(u.id)))
  }

  async function inviteMember(user) {
    setAdding(user.id)
    const { error } = await supabase.from('clan_members').insert({ clan_id: clan.id, user_id: user.id, role: 'member' })
    if (error) alert(error.message)
    else { loadMembers(clan.id); setInviteResults(r => r.filter(u => u.id !== user.id)) }
    setAdding(null)
  }

  async function removeMember(userId) {
    if (!confirm('¿Expulsar a este miembro?')) return
    await supabase.from('clan_members').delete().eq('clan_id', clan.id).eq('user_id', userId)
    loadMembers(clan.id)
  }

  if (loading) return <div style={{ padding: 20, color: C.textDim, fontSize: 13 }}>Cargando clan…</div>

  if (!clan) return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ textAlign: 'center', padding: '24px 16px', color: C.textDim }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>⚔️</div>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 4 }}>No tenés clan</div>
        <div style={{ fontSize: 12, marginBottom: 16 }}>Creá tu clan para participar en Guerra de Clanes</div>
        <button onClick={() => setShowCreate(true)} style={{
          padding: '10px 24px', borderRadius: 20, border: 'none',
          background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
        }}>⚔️ Crear clan</button>
      </div>

      {showCreate && createPortal(
        <div onClick={() => setShowCreate(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.panel, borderRadius: '20px 20px 0 0', padding: '20px 16px 36px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: C.text }}>⚔️ Crear clan</p>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 20 }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase' }}>Nombre del clan *</label>
                <input value={cName} onChange={e => setCName(e.target.value)} maxLength={30}
                  placeholder="ej: Los Cracks del Sur"
                  style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontSize: 14, outline: 'none' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase' }}>TAG * (máx 5)</label>
                <input value={cTag} onChange={e => setCTag(e.target.value.toUpperCase())} maxLength={5}
                  placeholder="LCS"
                  style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontSize: 14, outline: 'none', textTransform: 'uppercase', letterSpacing: 2 }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase' }}>Descripción (opcional)</label>
              <textarea value={cDesc} onChange={e => setCDesc(e.target.value)} maxLength={120} rows={2}
                placeholder="¿De qué trata tu clan?"
                style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontSize: 14, outline: 'none', resize: 'none' }} />
            </div>

            {err && <p style={{ margin: 0, color: '#ef4444', fontSize: 12 }}>{err}</p>}

            <button onClick={createClan} disabled={creating || !cName.trim() || !cTag.trim()} style={{
              padding: 13, borderRadius: 14, border: 'none',
              background: cName.trim() && cTag.trim() ? '#ef4444' : C.border,
              color: cName.trim() && cTag.trim() ? '#fff' : C.textDim,
              fontWeight: 800, fontSize: 15, cursor: 'pointer',
            }}>
              {creating ? 'Creando…' : '⚔️ Crear clan'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )

  return (
    <div style={{ padding: '0 0 16px' }}>
      {/* Clan header */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#ef444420', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>⚔️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: C.text }}>{clan.name}</div>
            <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, letterSpacing: 2 }}>[{clan.tag}]</div>
            {clan.description && <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{clan.description}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, textAlign: 'center', background: C.panel2, borderRadius: 10, padding: '8px 4px' }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#ef4444' }}>{members.length}</div>
            <div style={{ fontSize: 10, color: C.textDim }}>Miembros</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', background: C.panel2, borderRadius: 10, padding: '8px 4px' }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: C.green }}>0</div>
            <div style={{ fontSize: 10, color: C.textDim }}>Torneos</div>
          </div>
        </div>
      </div>

      {/* Members list */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Integrantes</div>
        {members.map(m => (
          <div key={m.users?.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: C.panel, border: `1px solid ${C.border}`, marginBottom: 6 }}>
            <Avatar name={m.users?.display_name || m.users?.username} url={m.users?.avatar_url} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{m.users?.display_name || m.users?.username}</div>
              <div style={{ fontSize: 11, color: C.textDim }}>{ROLE_LABEL[m.role] || m.role}</div>
            </div>
            {isLeader && m.users?.id !== profile.id && (
              <button onClick={() => removeMember(m.users.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 18, padding: 4 }}>✕</button>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {isLeader && (
          <button onClick={() => { setShowInvite(true); setInviteSearch(''); setInviteResults([]) }} style={{
            flex: 1, padding: '11px', borderRadius: 12, border: 'none',
            background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
          }}>➕ Invitar</button>
        )}
        <button onClick={leaveClan} style={{
          flex: 1, padding: '11px', borderRadius: 12, border: `1px solid ${C.border}`,
          background: C.panel, color: C.textDim, fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>{isLeader ? '🗑 Disolver clan' : '🚪 Salir'}</button>
      </div>

      {/* Invite modal */}
      {showInvite && createPortal(
        <div onClick={() => setShowInvite(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.panel, borderRadius: '20px 20px 0 0', padding: '20px 16px 32px', width: '100%', maxWidth: 480, maxHeight: '70vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: C.text }}>➕ Invitar al clan</p>
              <button onClick={() => setShowInvite(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 20 }}>✕</button>
            </div>
            <input autoFocus value={inviteSearch}
              onChange={e => { setInviteSearch(e.target.value); searchUsers(e.target.value) }}
              placeholder="Buscar por nombre o usuario…"
              style={{ padding: '10px 14px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontSize: 14, outline: 'none' }} />
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {inviteResults.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: C.panel2 }}>
                  <Avatar name={u.display_name || u.username} url={u.avatar_url} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{u.display_name || u.username}</div>
                    {u.username && <div style={{ fontSize: 12, color: C.textDim }}>@{u.username}</div>}
                  </div>
                  <button onClick={() => inviteMember(u)} disabled={adding === u.id}
                    style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: adding === u.id ? 0.5 : 1 }}>
                    {adding === u.id ? '…' : 'Añadir'}
                  </button>
                </div>
              ))}
              {inviteSearch && !inviteResults.length && (
                <p style={{ margin: 0, textAlign: 'center', color: C.textDim, fontSize: 13, padding: 16 }}>No se encontraron usuarios</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
