import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { getLimits, getRoleCfg } from '../lib/roles'
import { C } from '../theme'

const AVATAR_COLORS = ['#e91e63','#9c27b0','#1565c0','#00838f','#2e7d32','#e65100','#c62828']
function avatarColor(id) {
  if (!id) return C.panel2
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

const CATEGORIES = [
  { id: 'efootball', label: 'eFootball', icon: '⚽' },
  { id: 'fc',        label: 'FC / FIFA',  icon: '🎮' },
  { id: 'gaming',    label: 'Gaming',     icon: '🎯' },
  { id: 'deportes',  label: 'Deportes',   icon: '🏅' },
  { id: 'general',   label: 'General',    icon: '💬' },
]

const DEFAULT_CHANNELS = [
  { name: 'general',   description: 'Canal principal',       who_can_send: 'everyone' },
  { name: 'anuncios',  description: 'Solo anuncios oficiales', who_can_send: 'admins'   },
  { name: 'torneos',   description: 'Torneos y ligas',       who_can_send: 'everyone' },
  { name: 'resultados',description: 'Resultados de partidos', who_can_send: 'everyone' },
  { name: 'sorteos',   description: 'Sorteos en vivo',       who_can_send: 'admins'   },
]

const GAMES = [
  { id: 'efootball', label: 'eFootball', icon: '⚽' },
  { id: 'fc26',      label: 'FC 26',     icon: '⚽' },
  { id: 'fc27',      label: 'FC 27',     icon: '⚽' },
  { id: 'valorant',  label: 'Valorant',  icon: '🎯' },
  { id: 'cs2',       label: 'CS2',       icon: '🎯' },
  { id: 'warzone',   label: 'Warzone',   icon: '🔫' },
  { id: 'freef',     label: 'Free Fire', icon: '🔥' },
  { id: 'clashroyale',label: 'Clash Royale', icon: '👑' },
]

function planLabel(role) {
  if (!role || role === 'member') return 'Gratis'
  if (role === 'ceo')        return 'CEO'
  if (role === 'admin')      return 'Admin'
  if (role === 'comunidad')  return 'Comunidad PRO'
  if (role === 'vip')        return 'VIP'
  if (role === 'moderador')  return 'Moderador'
  if (role === 'organizador')return 'Organizador'
  return role
}

export default function NewGroupPage({ onBack, onCreated, initialType }) {
  const { profile } = useAuthStore()
  const { createGroup } = useChatStore()
  const limits = getLimits(profile)

  const [step, setStep] = useState(initialType === 'community' ? 2 : 1)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selected, setSelected] = useState([])
  const [groupName, setGroupName] = useState('')
  const [groupType, setGroupType] = useState(initialType || 'group')
  const [description, setDescription] = useState('')
  const [joinMode, setJoinMode] = useState('public')
  const [category, setCategory] = useState('general')
  const [rules, setRules] = useState('')
  const [permissions, setPermissions] = useState({
    who_can_send: 'everyone',
    who_can_create_tournaments: 'admins',
    who_can_invite: 'admins',
    who_can_kick: 'admins',
  })
  const [selectedGames, setSelectedGames] = useState([])
  const [torneosEnabled, setTorneosEnabled]   = useState(true)
  const [ligasEnabled,   setLigasEnabled]     = useState(true)
  const [clanesEnabled,  setClanesEnabled]    = useState(false)
  const [defaultMaxPl,   setDefaultMaxPl]     = useState(8)
  const [isPublic, setIsPublic] = useState(true)
  const [creating, setCreating] = useState(false)
  const [searching, setSearching] = useState(false)

  async function searchUsers(q) {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('users')
      .select('id, display_name, username, avatar_url')
      .or(`username.ilike.%${q.replace('@', '')}%,display_name.ilike.%${q}%`)
      .neq('id', profile.id)
      .limit(10)
    setSearchResults(data || [])
    setSearching(false)
  }

  function toggleUser(user) {
    setSelected(prev => {
      const exists = prev.find(u => u.id === user.id)
      return exists ? prev.filter(u => u.id !== user.id) : [...prev, user]
    })
  }

  async function handleCreate() {
    if (!groupName.trim()) return
    if (groupType === 'group' && selected.length === 0) return
    setCreating(true)
    const memberIds = selected.map(u => u.id)
    const convId = await createGroup(
      groupName.trim(),
      memberIds,
      profile.id,
      groupType,
      description.trim(),
      joinMode === 'public'
    )
    if (convId && groupType === 'community') {
      await supabase.from('conversations').update({
        tags:             selectedGames,
        torneos_enabled:  torneosEnabled,
        ligas_enabled:    ligasEnabled,
        clanes_enabled:   clanesEnabled,
        max_participants: defaultMaxPl,
        category,
        rules:            rules.trim() || null,
        join_mode:        joinMode,
        permissions,
      }).eq('id', convId)

      // Crear canales por defecto
      for (const ch of DEFAULT_CHANNELS) {
        const { data: channel } = await supabase.from('conversations').insert({
          name:        ch.name,
          type:        'channel',
          community_id: convId,
          created_by:  profile.id,
          description: ch.description,
          permissions: { ...permissions, who_can_send: ch.who_can_send },
        }).select('id').single()
        if (channel) {
          await supabase.from('conversation_members').insert({
            conversation_id: channel.id,
            user_id: profile.id,
            role: 'owner',
          })
        }
      }
    }
    setCreating(false)
    onCreated(convId, groupName.trim(), selected)
  }

  function toggleGame(gameId) {
    setSelectedGames(prev =>
      prev.includes(gameId) ? prev.filter(g => g !== gameId) : [...prev, gameId]
    )
  }

  const isCommunity = groupType === 'community'
  const canProceedStep1 = isCommunity || selected.length > 0

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', background: C.panel,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <button onClick={step === 1 ? onBack : () => setStep(1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.text2, padding: 4, display: 'flex',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>
            {step === 1 ? 'Nuevo grupo / comunidad' : isCommunity ? 'Nueva comunidad' : 'Nuevo grupo'}
          </h2>
          {step === 1 && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textDim }}>
              {selected.length} participante{selected.length !== 1 ? 's' : ''} seleccionado{selected.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {step === 1 && canProceedStep1 && (
          <button onClick={() => setStep(2)} style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: C.green, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 2px 12px ${C.green}44`,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        )}
      </div>

      {step === 1 && (
        <>
          {/* Type selector at top of step 1 */}
          <div style={{ padding: '12px 16px', background: C.panel2, borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8, flexShrink: 0 }}>
            {[
              { value: 'group', label: 'Grupo', icon: '👥' },
              { value: 'community', label: 'Comunidad', icon: '🌐' },
            ].map(opt => (
              <button key={opt.value} onClick={() => setGroupType(opt.value)} style={{
                flex: 1, padding: '8px 10px', borderRadius: 10, border: `1.5px solid`,
                borderColor: groupType === opt.value ? C.green : C.border,
                background: groupType === opt.value ? `${C.green}14` : C.panel,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, fontSize: 13, fontWeight: 600,
                color: groupType === opt.value ? C.green : C.text2,
                transition: 'all .15s',
              }}>
                <span>{opt.icon}</span> {opt.label}
              </button>
            ))}
          </div>

          {/* Community tip */}
          {isCommunity && (
            <div style={{ padding: '10px 16px', background: `${C.green}0A`, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: C.green }}>
                🌐 Las comunidades pueden empezar vacías. Podés agregar miembros ahora o después.
              </p>
            </div>
          )}

          {/* Selected chips */}
          {selected.length > 0 && (
            <div style={{
              display: 'flex', gap: 10, padding: '12px 16px', overflowX: 'auto',
              background: C.panel2, borderBottom: `1px solid ${C.border}`, flexShrink: 0,
            }}>
              {selected.map(u => (
                <button key={u.id} onClick={() => toggleUser(u)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 4, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: '50%',
                      background: avatarColor(u.id),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, color: '#fff',
                    }}>
                      {u.display_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{
                      position: 'absolute', top: -2, right: -2,
                      width: 18, height: 18, borderRadius: '50%',
                      background: C.red, border: `2px solid ${C.bg}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#fff', fontWeight: 800,
                    }}>✕</div>
                  </div>
                  <span style={{ fontSize: 10, color: C.text2, maxWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.display_name.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div style={{ padding: '10px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
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
                value={search}
                onChange={e => { setSearch(e.target.value); searchUsers(e.target.value) }}
                autoFocus
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: C.text, fontSize: 14, padding: '10px 0',
                }}
              />
            </div>
          </div>

          {/* Results */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {searching && (
              <p style={{ textAlign: 'center', padding: '20px', color: C.textDim, fontSize: 13 }}>Buscando...</p>
            )}
            {!search && !searching && (
              <div style={{ textAlign: 'center', padding: '40px 24px' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>{isCommunity ? '🌐' : '👥'}</div>
                <p style={{ color: C.text2, fontSize: 14, margin: '0 0 4px', fontWeight: 600 }}>
                  {isCommunity ? 'Agregar miembros (opcional)' : 'Agregar participantes'}
                </p>
                <p style={{ color: C.textDim, fontSize: 12, margin: '0 0 16px' }}>
                  {isCommunity
                    ? 'Buscá usuarios para invitar, o continuá sin agregar ninguno'
                    : 'Buscá a las personas para agregar al grupo'
                  }
                </p>
                {isCommunity && (
                  <button onClick={() => setStep(2)} style={{
                    padding: '10px 24px', borderRadius: 20, border: 'none',
                    background: C.green, color: C.bg, fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', boxShadow: `0 2px 12px ${C.green}44`,
                  }}>
                    Continuar sin agregar →
                  </button>
                )}
              </div>
            )}
            {searchResults.map(u => {
              const isSel = selected.find(s => s.id === u.id)
              return (
                <button key={u.id} onClick={() => toggleUser(u)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px', background: isSel ? `${C.green}0C` : 'none',
                  border: 'none', borderBottom: `1px solid ${C.border}22`,
                  cursor: 'pointer', textAlign: 'left', transition: 'background .15s',
                }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                    background: isSel ? C.green : avatarColor(u.id),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: isSel ? C.bg : '#fff',
                    transition: 'background .15s',
                  }}>
                    {isSel
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      : u.display_name.slice(0, 2).toUpperCase()
                    }
                  </div>
                  <div>
                    <p style={{ margin: 0, color: C.text, fontWeight: 600, fontSize: 14 }}>{u.display_name}</p>
                    <p style={{ margin: '2px 0 0', color: C.textDim, fontSize: 12 }}>@{u.username}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {step === 2 && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 24px', gap: 22 }}>

          {/* Plan info card */}
          {isCommunity && (() => {
            const role = profile?.role || 'member'
            const roleCfg = getRoleCfg(role)
            const plan = planLabel(role)
            const isFreeMember = !role || role === 'member'
            return (
              <div style={{
                width: '100%', background: C.panel, borderRadius: 14,
                border: `1px solid ${isFreeMember ? C.border : roleCfg.color + '44'}`,
                overflow: 'hidden',
              }}>
                {/* Plan header */}
                <div style={{
                  background: isFreeMember ? C.panel2 : `${roleCfg.color}18`,
                  padding: '10px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: isFreeMember ? C.textDim : roleCfg.color, letterSpacing: '.5px' }}>
                    {roleCfg.icon} Tu plan — {plan}
                  </span>
                  {isFreeMember && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: '#f59e0b18', border: '1px solid #f59e0b44', borderRadius: 8, padding: '2px 8px' }}>
                      Límites básicos
                    </span>
                  )}
                </div>
                {/* Limit rows */}
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: C.textDim }}>👥 Miembros en la comunidad</span>
                    <strong style={{ color: C.text }}>{limits.maxCommunityMembers >= 9999 ? '∞' : limits.maxCommunityMembers.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: C.textDim }}>🏆 Torneos que podés crear/día</span>
                    <strong style={{ color: C.text }}>{limits.maxTournamentsPerDay >= 999 ? '∞' : limits.maxTournamentsPerDay}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: C.textDim }}>👤 Jugadores por torneo/liga</span>
                    <strong style={{ color: C.text }}>{limits.maxParticipants >= 9999 ? '∞' : limits.maxParticipants}</strong>
                  </div>
                  {isFreeMember && (
                    <div style={{ marginTop: 4, padding: '8px 10px', background: '#f59e0b10', borderRadius: 8, border: '1px solid #f59e0b30' }}>
                      <p style={{ margin: 0, fontSize: 11, color: '#f59e0b', lineHeight: 1.5 }}>
                        ⭐ <strong>VIP</strong>: hasta 128 jugadores, 10 torneos/día<br/>
                        🌐 <strong>Comunidad PRO</strong>: sin límites prácticos, herramientas avanzadas
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Avatar preview */}
          <div style={{
            width: 90, height: 90,
            borderRadius: isCommunity ? 24 : '50%',
            background: groupName ? `linear-gradient(135deg, ${C.greenDk}88, ${C.panel2})` : C.panel2,
            border: `2px solid ${groupName ? C.green : C.border}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: groupName ? 28 : 32, fontWeight: 800, color: C.text,
            boxShadow: groupName ? `0 0 24px ${C.green}22` : 'none',
            transition: 'all .2s',
          }}>
            {groupName ? groupName.slice(0, 2).toUpperCase() : (isCommunity ? '🌐' : '👥')}
          </div>

          {/* Name */}
          <div style={{ width: '100%' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: '1.5px', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
              {isCommunity ? 'Nombre de la comunidad' : 'Nombre del grupo'}
            </label>
            <input
              type="text"
              placeholder={isCommunity ? 'Ej: eFootball Argentina' : 'Ej: Equipo Relámpago ⚡'}
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              maxLength={50} autoFocus
              style={{
                width: '100%', background: 'transparent',
                border: 'none', borderBottom: `1.5px solid ${C.green}`,
                color: C.text, fontSize: 18, padding: '6px 0 10px',
                outline: 'none', textAlign: 'center', boxSizing: 'border-box',
              }}
            />
            <p style={{ textAlign: 'right', fontSize: 11, color: C.textDim, margin: '4px 0 0' }}>{groupName.length}/50</p>
          </div>

          {/* Description */}
          <div style={{ width: '100%' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.text2, letterSpacing: '1.5px', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
              Descripción (opcional)
            </label>
            <textarea
              placeholder={isCommunity ? 'De qué trata esta comunidad...' : 'Descripción del grupo...'}
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={200}
              rows={3}
              style={{
                width: '100%', background: C.panel, border: `1px solid ${C.border}`,
                borderRadius: 10, color: C.text, fontSize: 14, padding: '10px 12px',
                outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: 1.5,
              }}
            />
            <p style={{ textAlign: 'right', fontSize: 11, color: C.textDim, margin: '4px 0 0' }}>{description.length}/200</p>
          </div>

          {/* Game selector — communities only */}
          {isCommunity && (
            <div style={{ width: '100%' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.text2, letterSpacing: '1.5px', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
                🎮 Juegos de la comunidad
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {GAMES.map(g => {
                  const sel = selectedGames.includes(g.id)
                  return (
                    <button key={g.id} onClick={() => toggleGame(g.id)} style={{
                      padding: '7px 14px', borderRadius: 20,
                      border: `1.5px solid ${sel ? C.green : C.border}`,
                      background: sel ? `${C.green}18` : C.panel,
                      color: sel ? C.green : C.text2,
                      fontSize: 13, fontWeight: sel ? 700 : 500,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                      transition: 'all .15s',
                    }}>
                      <span>{g.icon}</span> {g.label}
                      {sel && <span style={{ fontSize: 10, fontWeight: 800 }}>✓</span>}
                    </button>
                  )
                })}
              </div>
              {selectedGames.length > 0 && (
                <p style={{ margin: '8px 0 0', fontSize: 11, color: C.textDim }}>
                  Los torneos y ligas de esta comunidad se organizarán para: {selectedGames.map(id => GAMES.find(g => g.id === id)?.label).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Competition types — communities only */}
          {isCommunity && (
            <div style={{ width: '100%' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.text2, letterSpacing: '1.5px', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
                🏆 Competencias habilitadas
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  [torneosEnabled, setTorneosEnabled, '🏆', 'Torneos', 'Eliminación directa, brackets, grupos'],
                  [ligasEnabled,   setLigasEnabled,   '🥇', 'Ligas',   'Todos vs todos, tabla de posiciones'],
                  [clanesEnabled,  setClanesEnabled,  '⚔️', 'Torneos de Clanes', 'Equipos o clanes compiten entre sí'],
                ].map(([val, setter, icon, lbl, desc]) => (
                  <div key={lbl} onClick={() => setter(!val)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: val ? `${C.green}0D` : C.panel,
                    border: `1.5px solid ${val ? C.green + '55' : C.border}`,
                    borderRadius: 12, padding: '11px 14px', cursor: 'pointer',
                    transition: 'all .15s',
                  }}>
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: val ? C.green : C.text }}>{lbl}</p>
                      <p style={{ margin: '1px 0 0', fontSize: 11, color: C.textDim }}>{desc}</p>
                    </div>
                    <div style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none',
                      background: val ? C.green : C.panel2,
                      outline: `1px solid ${val ? C.green : C.border}`,
                      position: 'relative', flexShrink: 0,
                    }}>
                      <div style={{
                        position: 'absolute', top: 2, left: val ? 22 : 2,
                        width: 20, height: 20, borderRadius: '50%', background: '#fff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'left .2s',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Max participants per tournament — communities only */}
          {isCommunity && (torneosEnabled || ligasEnabled || clanesEnabled) && (() => {
            const ALL_SIZES = [2, 4, 8, 12, 16, 32, 64, 128]
            const maxAllowed = limits.maxParticipants
            const available = ALL_SIZES.filter(n => n <= maxAllowed)
            const locked    = ALL_SIZES.filter(n => n > maxAllowed)
            return (
              <div style={{ width: '100%' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.text2, letterSpacing: '1.5px', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  👥 Jugadores por torneo / liga
                </label>
                <p style={{ margin: '0 0 10px', fontSize: 11, color: C.textDim }}>
                  {(() => {
                    const role = profile?.role || 'member'
                    if (['ceo','admin','comunidad'].includes(role)) return <><strong style={{ color: C.green }}>Sin límite</strong> — {planLabel(role)}</>
                    if (role === 'vip')         return <>Plan <strong style={{ color: '#f59e0b' }}>VIP</strong>: hasta <strong style={{ color: C.text }}>128</strong> jugadores por torneo</>
                    if (role === 'moderador')   return <>Plan <strong style={{ color: '#06b6d4' }}>Moderador</strong>: hasta <strong style={{ color: C.text }}>64</strong> jugadores por torneo</>
                    if (role === 'organizador') return <>Plan <strong style={{ color: '#10b981' }}>Organizador</strong>: hasta <strong style={{ color: C.text }}>32</strong> jugadores por torneo</>
                    return <>Plan <strong style={{ color: '#f59e0b' }}>Gratis</strong>: máximo <strong style={{ color: C.text }}>8</strong> jugadores — <span style={{ color: '#f59e0b' }}>upgradeá para más</span></>
                  })()}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {available.map(n => (
                    <button key={n} onClick={() => setDefaultMaxPl(n)} style={{
                      width: 52, height: 44, borderRadius: 10, border: `1.5px solid`,
                      borderColor: defaultMaxPl === n ? C.green : C.border,
                      background: defaultMaxPl === n ? `${C.green}18` : C.panel,
                      color: defaultMaxPl === n ? C.green : C.text,
                      fontWeight: defaultMaxPl === n ? 800 : 500, fontSize: 14,
                      cursor: 'pointer', transition: 'all .15s',
                    }}>{n}</button>
                  ))}
                  {locked.map(n => (
                    <div key={n} title={`Requiere plan superior`} style={{
                      width: 52, height: 44, borderRadius: 10, border: `1.5px solid ${C.border}`,
                      background: C.panel2, color: C.textDim, fontSize: 14,
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: 0, opacity: 0.5,
                    }}>
                      <span style={{ fontSize: 12 }}>{n}</span>
                      <span style={{ fontSize: 9 }}>🔒</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Torneos inside community — info box */}
          {isCommunity && (
            <div style={{
              width: '100%', background: `${C.green}0A`,
              border: `1px solid ${C.green}30`, borderRadius: 12, padding: '12px 16px',
            }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: C.green }}>🏆 Torneos y Ligas dentro de la Comunidad</p>
              <p style={{ margin: 0, fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
                Una vez creada la comunidad, podés organizar torneos y ligas <strong>desde adentro</strong>. Los miembros se inscriben, juegan, cargan resultados y ven las tablas de posiciones — todo en un solo lugar.
              </p>
            </div>
          )}

          {/* Category — communities only */}
          {isCommunity && (
            <div style={{ width: '100%' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.text2, letterSpacing: '1.5px', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
                Categoría
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIES.map(cat => {
                  const sel = category === cat.id
                  return (
                    <button key={cat.id} onClick={() => setCategory(cat.id)} style={{
                      padding: '7px 14px', borderRadius: 20,
                      border: `1.5px solid ${sel ? C.green : C.border}`,
                      background: sel ? `${C.green}18` : C.panel,
                      color: sel ? C.green : C.text2,
                      fontSize: 13, fontWeight: sel ? 700 : 500,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                      transition: 'all .15s',
                    }}>
                      {cat.icon} {cat.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Rules — communities only */}
          {isCommunity && (
            <div style={{ width: '100%' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.text2, letterSpacing: '1.5px', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
                Reglas de la comunidad (opcional)
              </label>
              <textarea
                placeholder={'Ej: Respeto entre miembros. No spam. Resultados en 24hs...'}
                value={rules}
                onChange={e => setRules(e.target.value)}
                maxLength={500}
                rows={3}
                style={{
                  width: '100%', background: C.panel, border: `1px solid ${C.border}`,
                  borderRadius: 10, color: C.text, fontSize: 14, padding: '10px 12px',
                  outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: 1.5,
                }}
              />
              <p style={{ textAlign: 'right', fontSize: 11, color: C.textDim, margin: '4px 0 0' }}>{rules.length}/500</p>
            </div>
          )}

          {/* Privacy / join_mode — communities only */}
          {isCommunity && (
            <div style={{ width: '100%' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.text2, letterSpacing: '1.5px', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
                Privacidad
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { value: 'public',      icon: '🌐', label: 'Pública',    desc: 'Cualquiera puede unirse' },
                  { value: 'approval',    icon: '✋', label: 'Aprobación', desc: 'Admin aprueba solicitudes' },
                  { value: 'invite_only', icon: '🔒', label: 'Invitación', desc: 'Solo con link privado' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setJoinMode(opt.value)} style={{
                    flex: 1, padding: '10px 6px', borderRadius: 12, border: `2px solid`,
                    borderColor: joinMode === opt.value ? C.green : C.border,
                    background: joinMode === opt.value ? `${C.green}0D` : C.panel,
                    cursor: 'pointer', textAlign: 'center', transition: 'all .15s',
                  }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.icon}</div>
                    <p style={{ margin: '0 0 2px', color: joinMode === opt.value ? C.green : C.text, fontWeight: 700, fontSize: 12 }}>{opt.label}</p>
                    <p style={{ margin: 0, color: C.textDim, fontSize: 10 }}>{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Permissions — communities only */}
          {isCommunity && (
            <div style={{ width: '100%' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.text2, letterSpacing: '1.5px', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
                Permisos
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'who_can_send',               label: '💬 Quién puede enviar mensajes' },
                  { key: 'who_can_create_tournaments',  label: '🏆 Quién puede crear torneos' },
                  { key: 'who_can_invite',              label: '📨 Quién puede invitar miembros' },
                  { key: 'who_can_kick',                label: '🚫 Quién puede expulsar' },
                ].map(({ key, label }) => (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px',
                  }}>
                    <span style={{ fontSize: 13, color: C.text }}>{label}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {['everyone', 'admins'].map(val => (
                        <button key={val} onClick={() => setPermissions(p => ({ ...p, [key]: val }))} style={{
                          padding: '4px 10px', borderRadius: 8, border: `1.5px solid`,
                          borderColor: permissions[key] === val ? C.green : C.border,
                          background: permissions[key] === val ? `${C.green}18` : C.panel2,
                          color: permissions[key] === val ? C.green : C.textDim,
                          fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                        }}>
                          {val === 'everyone' ? 'Todos' : 'Admins'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: C.textDim }}>
                🏷️ Canales por defecto que se crearán: #general, #anuncios, #torneos, #resultados, #sorteos
              </p>
            </div>
          )}

          {/* Members preview */}
          <div style={{ width: '100%', background: C.panel, borderRadius: 12, padding: '12px 16px', border: `1px solid ${C.border}` }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: C.textDim, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
              {selected.length + 1} {isCommunity ? 'miembro' : 'participante'}{selected.length + 1 !== 1 ? 's' : ''}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: C.text2, lineHeight: 1.6 }}>
              {profile?.display_name}{selected.map(u => `, ${u.display_name}`).join('')}
              {isCommunity && selected.length === 0 && <span style={{ color: C.textDim }}> (podés agregar más después)</span>}
            </p>
          </div>

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={creating || !groupName.trim() || (groupType === 'group' && selected.length === 0)}
            style={{
              width: 60, height: 60, borderRadius: '50%', border: 'none',
              background: (creating || !groupName.trim() || (groupType === 'group' && selected.length === 0)) ? C.panel2 : C.green,
              cursor: (creating || !groupName.trim() || (groupType === 'group' && selected.length === 0)) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: !groupName.trim() ? 'none' : `0 4px 20px ${C.green}44`,
              transition: 'all .2s',
            }}>
            {creating
              ? <div style={{ width: 20, height: 20, border: `2px solid ${C.bg}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
              : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={!groupName.trim() ? C.textDim : C.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
            }
          </button>
          <p style={{ margin: '-16px 0 0', fontSize: 12, color: C.textDim }}>
            {isCommunity ? 'Crear comunidad' : 'Crear grupo'}
          </p>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
