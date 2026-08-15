import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { C } from '../theme'

const AVATAR_COLORS = ['#e91e63','#9c27b0','#1565c0','#00838f','#2e7d32','#e65100','#c62828']
function avatarColor(id) {
  if (!id) return C.panel2
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function Avatar({ name, url, size = 52 }) {
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{
        width: size, height: size, borderRadius: 14, flexShrink: 0,
        background: avatarColor(name),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.36, fontWeight: 800, color: '#fff',
      }}>{name?.slice(0, 2).toUpperCase() || '?'}</div>
}

const CATEGORIES = [
  { id: 'all', label: 'Todo' },
  { id: 'community', label: 'Comunidades' },
  { id: 'group', label: 'Grupos' },
]

export default function DiscoverPage() {
  const { profile } = useAuthStore()
  const { fetchConversations, setActiveConversation } = useChatStore()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [joined, setJoined] = useState(new Set())
  const [joining, setJoining] = useState(null)
  const [myGroups, setMyGroups] = useState(new Set())
  const [hasAccess, setHasAccess] = useState(null)  // null=checking, true/false

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('conversations')
      .select('id, name, description, avatar_url, group_type, member_count, tags, is_group, created_at')
      .eq('is_group', true)
      .eq('is_public', true)
      .order('member_count', { ascending: false })
      .limit(60)

    if (category !== 'all') {
      q = q.eq('group_type', category)
    }
    if (search.trim()) {
      q = q.ilike('name', `%${search.trim()}%`)
    }

    const { data } = await q
    setItems(data || [])
    setLoading(false)
  }, [category, search])

  // Verificar si el usuario tiene rango para ver comunidades (o es admin)
  useEffect(() => {
    if (!profile?.id) return
    Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', profile.id),
      supabase.from('admin_users').select('user_id').eq('user_id', profile.id).maybeSingle(),
    ]).then(([{ data: roles }, { data: adminRow }]) => {
      const isAdmin = !!adminRow
      const ranked = (roles || []).some(r => ['ceo', 'vip', 'community', 'moderator'].includes(r.role))
      setHasAccess(isAdmin || ranked)
    })
  }, [profile?.id])

  // Load my joined groups
  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', profile.id)
      .then(({ data }) => {
        const ids = new Set((data || []).map(r => r.conversation_id))
        setMyGroups(ids)
        setJoined(ids)
      })
  }, [profile?.id])

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  async function joinGroup(group) {
    if (!profile?.id || joining) return
    setJoining(group.id)
    try {
      await supabase.from('conversation_members').upsert(
        { conversation_id: group.id, user_id: profile.id },
        { onConflict: 'conversation_id,user_id' }
      )
      setJoined(prev => new Set([...prev, group.id]))
      fetchConversations(profile.id)
    } catch {}
    setJoining(null)
  }

  async function openGroup(group) {
    setActiveConversation({
      id: group.id,
      name: group.name,
      avatar_url: group.avatar_url,
      isGroup: true,
      isCommunity: group.group_type === 'community',
    })
  }

  const isJoined = (id) => joined.has(id)

  // Sin acceso — mostrar pantalla de espera de rango
  if (hasAccess === false) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.bg, gap: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 56 }}>🔐</div>
        <h2 style={{ margin: 0, color: C.text, fontSize: 20, fontWeight: 800 }}>Acceso con rango</h2>
        <p style={{ margin: 0, color: C.textDim, fontSize: 14, lineHeight: 1.6, maxWidth: 280 }}>
          Las comunidades son privadas. Para acceder necesitás que un administrador te asigne un rango.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[['⭐', 'VIP', '#f59e0b'], ['🌐', 'Comunidad', '#8b5cf6'], ['🛡️', 'Moderador', '#3b82f6']].map(([emoji, label, color]) => (
            <span key={label} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: color + '20', color,
            }}>
              {emoji} {label}
            </span>
          ))}
        </div>
        <p style={{ margin: 0, color: C.textDim, fontSize: 12, maxWidth: 260 }}>
          Contactá a un admin para que te habilite el acceso.
        </p>
      </div>
    )
  }

  if (hasAccess === null) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div style={{ width: 24, height: 24, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0, paddingBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 10px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
          </svg>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px' }}>Explorar</span>
        </div>

        {/* Search */}
        <div style={{ padding: '0 16px 10px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: C.panel2, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '0 12px',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar grupos y comunidades..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: C.text, fontSize: 14, padding: '9px 0',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 0, fontSize: 13 }}>✕</button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', padding: '0 16px' }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setCategory(cat.id)} style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 0', fontSize: 13, fontWeight: 600,
              color: category === cat.id ? C.green : C.textDim,
              borderBottom: `2px solid ${category === cat.id ? C.green : 'transparent'}`,
              transition: 'color .15s, border-color .15s',
            }}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading && (
          <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 32px', gap: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}>🌐</div>
            <p style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>
              {search ? `Sin resultados para "${search}"` : 'No hay comunidades públicas aún'}
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13, lineHeight: 1.5, maxWidth: 260 }}>
              {search
                ? 'Probá con otro nombre'
                : 'Los grupos e comunidades públicas aparecen acá para que cualquiera pueda unirse.'}
            </p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {items.map((group, i) => {
              const isMine = isJoined(group.id)
              const isLoading = joining === group.id
              const typeLabel = group.group_type === 'community' ? 'Comunidad' : 'Grupo'
              const typeColor = group.group_type === 'community' ? '#8b5cf6' : C.green
              const members = group.member_count || 0

              return (
                <div
                  key={group.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 16px',
                    borderBottom: i < items.length - 1 ? `1px solid ${C.border}22` : 'none',
                    transition: 'background .12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.panel}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Avatar */}
                  <button
                    onClick={() => isMine ? openGroup(group) : null}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: isMine ? 'pointer' : 'default', flexShrink: 0 }}
                  >
                    <Avatar name={group.name} url={group.avatar_url} size={52} />
                  </button>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ color: C.text, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                        {group.name}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
                        background: `${typeColor}20`, color: typeColor,
                        flexShrink: 0,
                      }}>
                        {typeLabel}
                      </span>
                    </div>
                    {group.description && (
                      <p style={{ margin: '2px 0 0', color: C.textDim, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {group.description}
                      </p>
                    )}
                    <p style={{ margin: '3px 0 0', color: C.textDim, fontSize: 11 }}>
                      {members > 0 ? `${members.toLocaleString()} miembro${members !== 1 ? 's' : ''}` : 'Sin miembros aún'}
                    </p>
                  </div>

                  {/* Action */}
                  {isMine ? (
                    <button
                      onClick={() => openGroup(group)}
                      style={{
                        padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: `${C.green}20`, color: C.green,
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}
                    >
                      Abrir
                    </button>
                  ) : (
                    <button
                      onClick={() => joinGroup(group)}
                      disabled={!!isLoading}
                      style={{
                        padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: C.green, color: C.bg,
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                        opacity: isLoading ? 0.6 : 1,
                        boxShadow: `0 2px 8px ${C.green}33`,
                        transition: 'opacity .15s',
                      }}
                    >
                      {isLoading ? '...' : 'Unirse'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
