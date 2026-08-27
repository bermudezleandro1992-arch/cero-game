import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { C } from '../theme'
import NewGroupPage from './NewGroupPage'

const AVATAR_COLORS = ['#e91e63','#9c27b0','#1565c0','#00838f','#2e7d32','#e65100','#c62828']
function avatarColor(id) {
  if (!id) return C.panel2
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function CommunityAvatar({ name, url, size = 48 }) {
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1.5px solid ${C.border}` }} />
    : <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: avatarColor(name),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.36, fontWeight: 800, color: '#fff',
        border: `1.5px solid ${C.border}`,
      }}>{name?.slice(0, 2).toUpperCase() || '?'}</div>
}

function formatCount(n) {
  if (!n) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + ' M'
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + ' K'
  return String(n)
}

export default function DiscoverPage() {
  const { profile } = useAuthStore()
  const { fetchConversations, setActiveConversation } = useChatStore()

  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [joined, setJoined] = useState(new Set())
  const [pending, setPending] = useState(new Set())
  const [joining, setJoining] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)

    // My memberships
    if (profile?.id) {
      const { data: mems } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', profile.id)
      setJoined(new Set((mems || []).map(m => m.conversation_id)))

      // Pending requests
      const { data: reqs } = await supabase
        .from('community_requests')
        .select('community_id')
        .eq('user_id', profile.id)
        .eq('status', 'pending')
      setPending(new Set((reqs || []).map(r => r.community_id)))
    }

    // Public communities
    let q = supabase
      .from('conversations')
      .select('id, name, description, avatar_url, member_count, requires_approval, is_public, created_at')
      .eq('group_type', 'community')
      .eq('is_public', true)
      .order('member_count', { ascending: false, nullsFirst: false })
      .limit(80)

    if (search.trim()) q = q.ilike('name', `%${search.trim()}%`)

    const { data } = await q
    const rows = data || []

    // Fill missing member_count from conversation_members
    const missingIds = rows.filter(r => !r.member_count).map(r => r.id)
    let countMap = {}
    if (missingIds.length) {
      const { data: mRows } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .in('conversation_id', missingIds)
      ;(mRows || []).forEach(r => { countMap[r.conversation_id] = (countMap[r.conversation_id] || 0) + 1 })
    }
    setCommunities(rows.map(r => ({ ...r, member_count: r.member_count || countMap[r.id] || 0 })))
    setLoading(false)
  }, [profile?.id, search])

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0)
    return () => clearTimeout(t)
  }, [load])

  async function joinCommunity(c) {
    if (!profile?.id || joining) return
    setJoining(c.id)
    try {
      const { data, error } = await supabase.rpc('request_join_community', {
        p_community_id: c.id,
        p_message: null,
      })
      if (error || !data) {
        // Fallback: direct insert
        await supabase.from('conversation_members').upsert(
          { conversation_id: c.id, user_id: profile.id },
          { onConflict: 'conversation_id,user_id' }
        )
        setJoined(prev => new Set([...prev, c.id]))
        fetchConversations(profile.id)
      } else if (data.joined) {
        setJoined(prev => new Set([...prev, c.id]))
        fetchConversations(profile.id)
      } else if (data.pending) {
        setPending(prev => new Set([...prev, c.id]))
      } else if (data.error === 'Ya sos miembro') {
        setJoined(prev => new Set([...prev, c.id]))
      }
    } catch {}
    setJoining(null)
  }

  if (showCreate) {
    return <NewGroupPage initialType="community" onBack={() => setShowCreate(false)} onCreated={(convId, name) => {
      setShowCreate(false)
      load()
      if (convId) setActiveConversation({ id: convId, name, group_type: 'community', isCommunity: true })
    }} />
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px' }}>Explorar</span>
          <button onClick={() => setShowCreate(true)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: C.green,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: C.panel2, border: `1px solid ${C.border}`,
            borderRadius: 24, padding: '0 14px',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar comunidades..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 14, padding: '10px 0' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 0, fontSize: 14 }}>✕</button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          </div>
        )}

        {!loading && communities.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 32px', gap: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 52 }}>🌐</div>
            <p style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>
              {search ? `Sin resultados para "${search}"` : 'No hay comunidades públicas aún'}
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13, lineHeight: 1.5, maxWidth: 260 }}>
              Sé el primero en crear una comunidad.
            </p>
          </div>
        )}

        {!loading && communities.length > 0 && (
          <div style={{ padding: '8px 0' }}>
            {communities.map((c, i) => {
              const isJoined = joined.has(c.id)
              const isPending = pending.has(c.id)
              const isLoading = joining === c.id
              const isPrivate = c.requires_approval === true

              return (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '10px 16px',
                  borderBottom: i < communities.length - 1 ? `1px solid ${C.border}22` : 'none',
                }}>
                  <CommunityAvatar name={c.name} url={c.avatar_url} size={50} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>
                      {formatCount(c.member_count)} {c.member_count === 1 ? 'miembro' : 'miembros'}
                      {isPrivate && <span style={{ marginLeft: 6, color: C.textDim }}>· 🔒 Privada</span>}
                    </div>
                    {c.description && (
                      <div style={{ color: C.textDim, fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.description}</div>
                    )}
                  </div>

                  {isJoined ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.textDim, flexShrink: 0 }}>Unido ✓</span>
                  ) : isPending ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.yellow, flexShrink: 0 }}>Pendiente</span>
                  ) : (
                    <button
                      onClick={() => joinCommunity(c)}
                      disabled={!!isLoading}
                      style={{
                        padding: '7px 16px', borderRadius: 20, border: `1.5px solid ${C.green}`,
                        background: 'transparent', color: C.green,
                        fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0,
                        opacity: isLoading ? 0.6 : 1, transition: 'all .15s',
                      }}
                    >
                      {isLoading ? '...' : isPrivate ? 'Solicitar' : 'Unirse'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Footer: crear comunidad */}
        {!loading && (
          <div style={{ padding: '8px 16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 1, background: C.border }} />
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '13px', borderRadius: 12,
                border: `1.5px solid ${C.border}`, background: 'transparent',
                color: C.green, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                transition: 'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = `${C.green}10`}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Crear comunidad
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
