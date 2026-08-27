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
function Avatar({ name, url, size = 48, radius = 14 }) {
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: radius, flexShrink: 0, background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 800, color: '#fff' }}>{name?.slice(0,2).toUpperCase() || '?'}</div>
}

const TYPE_CFG = {
  community:  { label: 'Comunidad', color: '#8b5cf6', bg: '#8b5cf618', icon: '🌐' },
  group:      { label: 'Grupo',     color: '#22c55e', bg: '#22c55e18', icon: '👥' },
  tournament: { label: 'Torneo',    color: '#f59e0b', bg: '#f59e0b18', icon: '🏆' },
  liga:       { label: 'Liga',      color: '#38bdf8', bg: '#38bdf818', icon: '🥇' },
}

export default function CommunidadesPage() {
  const { profile } = useAuthStore()
  const { conversations, setActiveConversation } = useChatStore()

  const [tab, setTab] = useState('community')
  const [search, setSearch] = useState('')

  // Use already-loaded conversations from chatStore — no extra query needed
  const communities = conversations.filter(c =>
    c.group_type === 'community' || c.group_type === 'group'
  )
  const participating = conversations.filter(c =>
    c.group_type === 'tournament' || c.group_type === 'liga'
  )
  const loading = false

  function openConv(conv) {
    const isCommunity = conv.group_type === 'community'
    setActiveConversation({ ...conv, isCommunity, isGroup: conv.group_type === 'group' })
  }

  const filtered = (tab === 'community' ? communities : participating).filter(r => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return r.name?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
  })

  const tabs = [
    { id: 'community',    label: 'Comunidad',   emoji: '🌐' },
    { id: 'participando', label: 'Participando', emoji: '🏆' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 0', background: C.panel, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 12 }}>Comunidades</div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', background: C.panel2, borderRadius: 12, padding: '0 12px', marginBottom: 12, gap: 8 }}>
          <span style={{ color: C.textDim, fontSize: 16 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 14, padding: '10px 0' }}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '8px 14px', borderRadius: '12px 12px 0 0', border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
                background: tab === t.id ? C.bg : 'transparent',
                color: tab === t.id ? C.green : C.textDim,
                borderBottom: tab === t.id ? `2px solid ${C.green}` : '2px solid transparent',
                transition: 'all .15s',
              }}
            >{t.emoji} {t.label}</button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: C.textDim, padding: 40, fontSize: 14 }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{tab === 'community' ? '🌐' : '🏆'}</div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
              {search ? 'Sin resultados' : tab === 'community' ? 'No estás en ninguna comunidad' : 'No estás participando en torneos o ligas'}
            </div>
            <div style={{ color: C.textDim, fontSize: 13 }}>
              {search ? 'Intenta con otro término' : tab === 'community' ? 'Explorá comunidades en la sección Explorar' : 'Unite a un torneo o liga desde una comunidad'}
            </div>
          </div>
        ) : tab === 'community' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(item => {
              const cfg = TYPE_CFG[item.group_type] || TYPE_CFG.group
              return (
                <div key={item.id} onClick={() => openConv(item)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: C.panel, borderRadius: 14, padding: '12px 14px',
                  cursor: 'pointer', border: `1px solid ${C.border}`,
                }}>
                  <Avatar name={item.name} url={item.avatar_url} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, borderRadius: 6, padding: '1px 7px', flexShrink: 0 }}>{cfg.label}</span>
                    </div>
                    {item.description && (
                      <div style={{ fontSize: 12, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      {item.torneos_enabled && <span style={{ fontSize: 10, color: '#f59e0b', background: '#f59e0b14', borderRadius: 6, padding: '1px 6px' }}>🏆 Torneos</span>}
                      {item.ligas_enabled && <span style={{ fontSize: 10, color: '#38bdf8', background: '#38bdf814', borderRadius: 6, padding: '1px 6px' }}>🥇 Ligas</span>}
                      {item.myRole === 'owner' && <span style={{ fontSize: 10, color: C.green, background: `${C.green}14`, borderRadius: 6, padding: '1px 6px' }}>Admin</span>}
                    </div>
                  </div>
                  <span style={{ color: C.textDim, fontSize: 18 }}>›</span>
                </div>
              )
            })}
          </div>
        ) : (
          /* Participando — torneos y ligas con detalles */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(item => {
              const cfg = TYPE_CFG[item.group_type] || TYPE_CFG.tournament
              const isLiga = item.group_type === 'liga'
              return (
                <div key={item.id} onClick={() => openConv(item)} style={{
                  background: C.panel, borderRadius: 16, padding: '16px',
                  cursor: 'pointer', border: `1.5px solid ${cfg.color}33`,
                  boxShadow: `0 2px 12px ${cfg.color}11`,
                }}>
                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <Avatar name={item.name} url={item.avatar_url} size={44} radius={12} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, borderRadius: 6, padding: '2px 8px' }}>{cfg.icon} {cfg.label}</span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                  </div>

                  {/* Description */}
                  {item.description && (
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: C.text2, lineHeight: 1.5 }}>{item.description}</p>
                  )}

                  {/* Detail pills */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {item.game && (
                      <span style={{ fontSize: 11, color: C.textDim, background: C.panel2, borderRadius: 8, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        🎮 {item.game}
                      </span>
                    )}
                    {item.myRole && (
                      <span style={{ fontSize: 11, color: cfg.color, background: cfg.bg, borderRadius: 8, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {item.myRole === 'owner' ? '👑 Admin' : item.myRole === 'moderator' ? '🛡️ Mod' : '👤 Participante'}
                      </span>
                    )}
                    {isLiga && (
                      <span style={{ fontSize: 11, color: '#38bdf8', background: '#38bdf814', borderRadius: 8, padding: '4px 10px' }}>
                        📊 Tabla de posiciones
                      </span>
                    )}
                    {!isLiga && (
                      <span style={{ fontSize: 11, color: '#f59e0b', background: '#f59e0b14', borderRadius: 8, padding: '4px 10px' }}>
                        🎯 Bracket / Eliminación
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
