import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../App'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'

const AVATAR_COLORS = ['#e91e63','#9c27b0','#1565c0','#00838f','#2e7d32','#e65100','#c62828']
function avatarColor(id) {
  if (!id) return C.panel2
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function Avatar({ name, size = 46, color, url }) {
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: color || C.panel2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.34, fontWeight: 700, color: '#fff',
      }}>
        {name?.slice(0, 2).toUpperCase() || '?'}
      </div>
    )
}

export default function GroupInfoPage({ conversation, onBack, onLeft }) {
  const { profile } = useAuthStore()
  const { leaveGroup, pinMessage } = useChatStore()
  const [leavingGroup, setLeavingGroup] = useState(false)
  const [showPinInput, setShowPinInput] = useState(false)
  const [pinText, setPinText] = useState(conversation?.pinned_message || '')
  const [savingPin, setSavingPin] = useState(false)
  const [memberMenu, setMemberMenu] = useState(null) // member id
  const [roles, setRoles] = useState({}) // userId -> role
  const [mutedUntil, setMutedUntil] = useState({}) // userId -> date

  const isAdmin = conversation?.created_by === profile?.id || roles[profile?.id] === 'admin'

  const members = conversation?.members || []
  const allMembers = [
    { id: profile?.id, display_name: profile?.display_name, username: profile?.username, isMe: true },
    ...members.filter(m => m?.id !== profile?.id).map(m => ({ ...m, isMe: false })),
  ]

  async function kickMember(memberId) {
    if (!confirm('¿Expulsar a este usuario del grupo?')) return
    await supabase.from('conversation_members')
      .delete()
      .eq('conversation_id', conversation.id)
      .eq('user_id', memberId)
    setMemberMenu(null)
  }

  async function setRole(memberId, role) {
    await supabase.from('group_roles')
      .upsert({ conversation_id: conversation.id, user_id: memberId, role }, { onConflict: 'conversation_id,user_id' })
    setRoles(prev => ({ ...prev, [memberId]: role }))
    setMemberMenu(null)
  }

  function silenceMember(memberId) {
    const until = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    setMutedUntil(prev => ({ ...prev, [memberId]: until }))
    setMemberMenu(null)
    alert('Usuario silenciado por 24 horas.')
  }

  async function handleLeave() {
    if (!confirm('¿Salir del grupo?')) return
    setLeavingGroup(true)
    await leaveGroup(conversation.id, profile.id)
    onLeft?.()
  }

  async function handleSavePin() {
    if (!pinText.trim()) return
    setSavingPin(true)
    await pinMessage(conversation.id, pinText.trim())
    setSavingPin(false)
    setShowPinInput(false)
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', background: C.panel,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>Info del grupo</h2>
      </div>

      {/* Group hero */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '32px 20px 24px',
        background: `radial-gradient(ellipse at 50% 0%, ${C.greenDk}22 0%, transparent 65%)`,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          width: 88, height: 88, borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.greenDk}88, ${C.panel2})`,
          border: `2px solid ${C.green}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 800, color: C.text,
          boxShadow: `0 0 32px ${C.green}22`,
          marginBottom: 14,
        }}>
          {conversation?.name?.slice(0, 2).toUpperCase() || '👥'}
        </div>
        <p style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: C.text }}>{conversation?.name}</p>
        <p style={{ margin: 0, fontSize: 13, color: C.textDim }}>Grupo · {allMembers.length} participantes</p>
      </div>

      {/* Pinned message section */}
      <div style={{ padding: '16px', borderBottom: `1px solid ${C.border}` }}>
        <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          Mensaje fijado
        </p>
        {!showPinInput ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              flex: 1, padding: '10px 12px', background: C.panel2,
              borderRadius: 10, border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${C.green}`,
            }}>
              <p style={{ margin: 0, fontSize: 13, color: conversation?.pinned_message ? C.text2 : C.textDim, lineHeight: 1.4 }}>
                {conversation?.pinned_message || 'Sin mensaje fijado'}
              </p>
            </div>
            <button onClick={() => setShowPinInput(true)} style={{
              background: `${C.green}15`, border: `1px solid ${C.green}33`,
              borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
              color: C.green, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              📌 Editar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              value={pinText}
              onChange={e => setPinText(e.target.value)}
              placeholder="Mensaje fijado para el grupo..."
              autoFocus
              rows={3}
              style={{
                width: '100%', background: C.panel2, border: `1px solid ${C.green}`,
                borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13,
                resize: 'none', outline: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowPinInput(false)} style={{
                flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: C.panel2, color: C.textDim, cursor: 'pointer', fontSize: 13,
              }}>Cancelar</button>
              <button onClick={handleSavePin} disabled={savingPin || !pinText.trim()} style={{
                flex: 1, padding: '9px', borderRadius: 8, border: 'none',
                background: savingPin || !pinText.trim() ? C.panel2 : C.green,
                color: savingPin || !pinText.trim() ? C.textDim : C.bg,
                cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}>{savingPin ? '...' : 'Guardar'}</button>
            </div>
          </div>
        )}
      </div>

      {/* Members list */}
      <div style={{ padding: '12px 0' }}>
        <p style={{ margin: '0 16px 8px', fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          {allMembers.length} participantes
        </p>
        {allMembers.map(m => {
          const mRole = roles[m.id]
          const isMuted = mutedUntil[m.id] && new Date(mutedUntil[m.id]) > new Date()
          return (
            <div key={m.id} style={{ position: 'relative' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px', borderBottom: `1px solid ${C.border}11`,
              }}>
                <Avatar name={m.display_name} size={44} color={avatarColor(m.id)} url={m.avatar_url} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: m.isMe ? C.green : C.text }}>
                      {m.display_name} {m.isMe && <span style={{ fontSize: 11, color: C.textDim, fontWeight: 400 }}>(Vos)</span>}
                    </p>
                    {mRole === 'admin' && <span style={{ fontSize: 9, fontWeight: 700, color: C.green, background: `${C.green}18`, border: `1px solid ${C.green}33`, borderRadius: 6, padding: '1px 5px' }}>ADMIN</span>}
                    {mRole === 'moderator' && <span style={{ fontSize: 9, fontWeight: 700, color: C.yellow, background: `${C.yellow}18`, border: `1px solid ${C.yellow}33`, borderRadius: 6, padding: '1px 5px' }}>MOD</span>}
                    {isMuted && <span style={{ fontSize: 9, fontWeight: 700, color: C.textDim, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '1px 5px' }}>🔇</span>}
                  </div>
                  {m.username && (
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textDim }}>@{m.username}</p>
                  )}
                </div>
                {isAdmin && !m.isMe && (
                  <button onClick={() => setMemberMenu(memberMenu === m.id ? null : m.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: C.textDim,
                    padding: 6, borderRadius: 8, display: 'flex',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                  </button>
                )}
              </div>
              {/* Moderation menu */}
              {memberMenu === m.id && (
                <div onClick={() => setMemberMenu(null)} style={{
                  position: 'absolute', right: 12, top: '100%', zIndex: 50,
                  background: C.panel, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: '6px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  minWidth: 180, display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  {mRole !== 'admin' && (
                    <ModeBtn label="⭐ Hacer Admin" onClick={() => setRole(m.id, 'admin')} />
                  )}
                  {mRole !== 'moderator' && (
                    <ModeBtn label="🛡️ Hacer Moderador" onClick={() => setRole(m.id, 'moderator')} />
                  )}
                  {mRole && (
                    <ModeBtn label="👤 Quitar rol" onClick={() => setRole(m.id, 'member')} />
                  )}
                  <ModeBtn label={isMuted ? '🔊 Quitar silencio' : '🔇 Silenciar 24h'} onClick={() => {
                    if (isMuted) setMutedUntil(prev => { const n = {...prev}; delete n[m.id]; return n })
                    else silenceMember(m.id)
                    setMemberMenu(null)
                  }} />
                  <div style={{ height: 1, background: C.border, margin: '4px 0' }} />
                  <ModeBtn label="🚫 Expulsar" danger onClick={() => kickMember(m.id)} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Report group */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}` }}>
        <button onClick={() => alert('Reporte enviado. Gracias.')} style={{
          width: '100%', padding: '10px', borderRadius: 10,
          background: 'none', border: `1px solid ${C.border}`,
          color: C.textDim, fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          🚩 Reportar grupo
        </button>
      </div>

      {/* Leave group */}
      <div style={{ padding: '16px', borderTop: `1px solid ${C.border}` }}>
        <button onClick={handleLeave} disabled={leavingGroup} style={{
          width: '100%', padding: '12px', borderRadius: 10,
          background: `${C.red}15`, border: `1px solid ${C.red}33`,
          color: C.red, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {leavingGroup ? 'Saliendo...' : 'Salir del grupo'}
        </button>
      </div>
    </div>
  )
}

function ModeBtn({ label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', padding: '9px 12px',
      background: 'none', border: 'none', borderRadius: 8,
      color: danger ? C.red : C.text, fontSize: 13, cursor: 'pointer',
      transition: 'background .1s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? `${C.red}18` : C.panel2}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >{label}</button>
  )
}
