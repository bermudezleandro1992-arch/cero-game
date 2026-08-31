import { useEffect, useState } from 'react'
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

const GROUP_TYPE_LABELS = {
  community: { label: 'Comunidad', icon: '🌐', color: '#8b5cf6' },
  group:     { label: 'Grupo',     icon: '👥', color: '#10b981' },
  tournament:{ label: 'Torneo',    icon: '🏆', color: '#f59e0b' },
  liga:      { label: 'Liga',      icon: '📋', color: '#3b82f6' },
}

export default function InviteJoinPage({ token, onBack }) {
  const { profile } = useAuthStore()
  const { fetchConversations, setActiveConversation } = useChatStore()
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [conv, setConv] = useState(null)
  const [creator, setCreator] = useState(null)
  const [memberCount, setMemberCount] = useState(0)
  const [alreadyMember, setAlreadyMember] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Buscar conversación por token de invite_link
      const { data: rows } = await supabase
        .from('conversations')
        .select('id, name, description, avatar_url, group_type, created_by, member_count, game, tags')
        .eq('invite_link', token)
        .limit(1)

      if (!rows?.length) {
        localStorage.removeItem('mm_pending_invite')
        setError('El link de invitación no existe o fue revocado.')
        setLoading(false)
        return
      }

      const c = rows[0]
      setConv(c)

      // Cargar info del creador
      if (c.created_by) {
        const { data: u } = await supabase
          .from('users')
          .select('id, display_name, username, avatar_url')
          .eq('id', c.created_by)
          .single()
        setCreator(u)
      }

      // Contar miembros
      const { count } = await supabase
        .from('conversation_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('conversation_id', c.id)
      setMemberCount(count || 0)

      // Ver si ya es miembro
      if (profile?.id) {
        const { data: mem } = await supabase
          .from('conversation_members')
          .select('user_id')
          .eq('conversation_id', c.id)
          .eq('user_id', profile.id)
          .maybeSingle()
        setAlreadyMember(!!mem)
      }

      setLoading(false)
    }
    load()
  }, [token, profile?.id])

  // Auto-redirect if already a member (handles F5 on invite URL)
  useEffect(() => {
    if (!alreadyMember || !conv) return
    localStorage.removeItem('mm_pending_invite')
    setActiveConversation({ id: conv.id, name: conv.name, isGroup: true, isCommunity: conv.group_type === 'community' })
    onBack?.()
  }, [alreadyMember, conv])

  async function handleJoin() {
    if (!profile?.id || !conv) return
    setJoining(true)
    try {
      if (conv.group_type === 'community') {
        const { data, error } = await supabase.rpc('join_community', { p_conversation_id: conv.id })
        if (error || !data?.ok) {
          alert(data?.error === 'capacity_reached' ? 'Esta comunidad llegó al límite de miembros.' : 'No se pudo unir.')
          setJoining(false)
          return
        }
      } else {
        await supabase.from('conversation_members').upsert(
          { conversation_id: conv.id, user_id: profile.id },
          { onConflict: 'conversation_id,user_id' }
        )
      }

      // Registrar referido: solo si no tiene uno ya asignado
      if (conv.created_by && conv.created_by !== profile.id) {
        await supabase
          .from('users')
          .update({ invited_by: conv.created_by, invite_source: token })
          .eq('id', profile.id)
          .is('invited_by', null)
      }

      // Mensaje de bienvenida en el canal General de la comunidad
      if (conv.group_type === 'community') {
        const { data: generalCh } = await supabase
          .from('conversations')
          .select('id')
          .eq('community_id', conv.id)
          .eq('name', 'General')
          .single()
        if (generalCh?.id) {
          const displayName = profile.display_name || profile.username || 'Nuevo miembro'
          await supabase.from('messages').insert({
            conversation_id: generalCh.id,
            sender_id: profile.id,
            content: `👋 ¡${displayName} se unió a la comunidad! Bienvenido/a 🎉`,
            type: 'system',
          })
        }
      }

      // Limpiar token pendiente
      localStorage.removeItem('mm_pending_invite')
      setAlreadyMember(true)
      await fetchConversations(profile.id)
      setActiveConversation({ id: conv.id, name: conv.name, isGroup: true, isCommunity: conv.group_type === 'community' })
      onBack?.()
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setJoining(false)
  }

  const cfg = GROUP_TYPE_LABELS[conv?.group_type] || GROUP_TYPE_LABELS.group
  const gameLabel = conv?.game ? conv.game.replace('efootball', 'eFootball').replace('fc26', 'FC 26').replace('fc27', 'FC 27') : null

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: C.panel,
        borderRadius: 20, overflow: 'hidden', border: `1px solid ${C.border}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Header band */}
        <div style={{
          background: conv ? `${cfg.color}22` : C.panel2,
          borderBottom: `1px solid ${C.border}`,
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>🔗</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: conv ? cfg.color : C.textDim }}>
            Invitación a {conv ? cfg.label : '…'}
          </span>
        </div>

        <div style={{ padding: 24 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.textDim }}>
              <div style={{ width: 28, height: 28, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ margin: 0, fontSize: 14 }}>Cargando invitación…</p>
            </div>
          )}

          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
              <p style={{ margin: '0 0 6px', color: C.text, fontWeight: 700, fontSize: 15 }}>Link inválido</p>
              <p style={{ margin: '0 0 20px', color: C.textDim, fontSize: 13 }}>{error}</p>
              <button onClick={() => { localStorage.removeItem('mm_pending_invite'); onBack?.() }} style={{
                padding: '10px 24px', borderRadius: 12, border: `1px solid ${C.border}`,
                background: C.panel2, color: C.text, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>Ir al inicio</button>
            </div>
          )}

          {!loading && conv && (
            <>
              {/* Avatar + nombre */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                {conv.avatar_url
                  ? <img src={conv.avatar_url} alt={conv.name} style={{ width: 80, height: 80, borderRadius: 20, objectFit: 'cover', border: `2px solid ${cfg.color}44` }} />
                  : (
                    <div style={{
                      width: 80, height: 80, borderRadius: 20, flexShrink: 0,
                      background: `${cfg.color}22`, border: `2px solid ${cfg.color}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
                    }}>{cfg.icon}</div>
                  )
                }
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', color: C.text, fontWeight: 800, fontSize: 20 }}>{conv.name}</p>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: `${cfg.color}20`, color: cfg.color }}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>
              </div>

              {/* Info chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: C.textDim, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 10px' }}>
                  👥 {memberCount.toLocaleString()} miembro{memberCount !== 1 ? 's' : ''}
                </span>
                {gameLabel && (
                  <span style={{ fontSize: 12, color: C.green, background: `${C.green}15`, border: `1px solid ${C.green}30`, borderRadius: 8, padding: '4px 10px', fontWeight: 700 }}>
                    ⚽ {gameLabel}
                  </span>
                )}
              </div>

              {/* Descripción */}
              {conv.description && (
                <p style={{ margin: '0 0 16px', color: C.textDim, fontSize: 13, lineHeight: 1.5, textAlign: 'center' }}>
                  {conv.description.split(' · ').slice(0, 3).join(' · ')}
                </p>
              )}

              {/* Referido por */}
              {creator && (
                <div style={{
                  background: C.panel2, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: '10px 14px', marginBottom: 20,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  {creator.avatar_url
                    ? <img src={creator.avatar_url} alt={creator.display_name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: avatarColor(creator.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>{(creator.display_name || '?').slice(0, 2).toUpperCase()}</div>
                  }
                  <div>
                    <p style={{ margin: 0, color: C.textDim, fontSize: 11 }}>De parte de</p>
                    <p style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 13 }}>
                      {creator.display_name || creator.username}
                      {creator.username && <span style={{ color: C.textDim, fontWeight: 400 }}> · @{creator.username}</span>}
                    </p>
                  </div>
                </div>
              )}

              {/* Botón acción */}
              {alreadyMember ? (
                <button onClick={() => {
                  setActiveConversation({ id: conv.id, name: conv.name, isGroup: true, isCommunity: conv.group_type === 'community' })
                  onBack?.()
                }} style={{
                  width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                  background: `${C.green}20`, color: C.green,
                  fontWeight: 800, fontSize: 15, cursor: 'pointer',
                }}>
                  ✅ Ya sos miembro — Abrir {cfg.label}
                </button>
              ) : (
                <button onClick={handleJoin} disabled={joining} style={{
                  width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                  background: joining ? C.panel2 : C.green,
                  color: joining ? C.textDim : C.bg,
                  fontWeight: 800, fontSize: 15, cursor: joining ? 'default' : 'pointer',
                  boxShadow: joining ? 'none' : `0 4px 20px ${C.green}44`,
                }}>
                  {joining ? '⏳ Uniéndose…' : `${cfg.icon} Unirse a ${cfg.label}`}
                </button>
              )}

              <button onClick={onBack} style={{
                width: '100%', marginTop: 10, padding: '10px',
                borderRadius: 12, border: `1px solid ${C.border}`,
                background: 'transparent', color: C.textDim,
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>Cancelar</button>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
