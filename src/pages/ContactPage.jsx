import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { C } from '../theme'
import CallPage from './CallPage'

export default function ContactPage({ user, onBack, onChat }) {
  const { profile } = useAuthStore()
  const { findOrCreateConversation, setActiveConversation } = useChatStore()
  const [isSaved, setIsSaved] = useState(false)
  const [nickname, setNickname] = useState('')
  const [editingNick, setEditingNick] = useState(false)
  const [saving, setSaving] = useState(false)
  const [call, setCall] = useState(null)

  useEffect(() => { checkContact() }, [user?.id])

  async function checkContact() {
    if (!user?.id || !profile?.id) return
    const { data } = await supabase.from('contacts').select('nickname')
      .eq('owner_id', profile.id).eq('contact_id', user.id).single()
    if (data) { setIsSaved(true); setNickname(data.nickname || '') }
  }

  async function saveContact() {
    setSaving(true)
    await supabase.from('contacts').upsert(
      { owner_id: profile.id, contact_id: user.id, nickname: nickname.trim() || null },
      { onConflict: 'owner_id,contact_id' }
    )
    setIsSaved(true); setSaving(false); setEditingNick(false)
  }

  async function removeContact() {
    await supabase.from('contacts').delete().eq('owner_id', profile.id).eq('contact_id', user.id)
    setIsSaved(false); setNickname('')
  }

  async function handleChat() {
    const convId = await findOrCreateConversation(profile.id, user.id)
    setActiveConversation({ id: convId, user, isGroup: false })
    onChat()
  }

  async function startCall(type) {
    const convId = await findOrCreateConversation(profile.id, user.id)
    setCall({ type, convId })
  }

  const displayName = nickname || user?.display_name || 'Usuario'
  const initials = displayName.slice(0, 2).toUpperCase()

  if (call) {
    return (
      <CallPage
        conversationId={call.convId}
        myUserId={profile.id}
        contact={{ id: user.id, display_name: displayName, avatar_url: user?.avatar_url }}
        callType={call.type}
        isIncoming={false}
        onEnd={() => setCall(null)}
      />
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <span style={{ color: C.text, fontWeight: 600, fontSize: 16 }}>Info. de contacto</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Hero */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '40px 20px 28px',
          background: `linear-gradient(180deg, ${C.green}14 0%, transparent 100%)`,
          gap: 12,
        }}>
          {/* Avatar */}
          <div style={{
            width: 100, height: 100, borderRadius: '50%', overflow: 'hidden',
            border: `3px solid ${C.green}55`,
            boxShadow: `0 0 0 6px ${C.green}10, 0 8px 32px rgba(0,0,0,0.4)`,
            background: C.panel2, flexShrink: 0,
          }}>
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 34, background: C.green + '30' }}>
                  {initials}
                </div>
            }
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ color: C.text, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{displayName}</div>
            {nickname && <div style={{ color: C.textDim, fontSize: 13, marginBottom: 2 }}>{user?.display_name}</div>}
            <div style={{ color: C.green, fontSize: 13, fontWeight: 500 }}>@{user?.username}</div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            {[
              { label: 'Mensaje', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, action: handleChat },
              { label: 'Audio', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.38 2 2 0 0 1 3.6 1.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.79a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>, action: () => startCall('audio') },
              { label: 'Video', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>, action: () => startCall('video') },
            ].map(({ label, icon, action }) => (
              <button key={label} onClick={action} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: C.panel2, border: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.green, transition: 'background .15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = C.green + '18'}
                  onMouseLeave={e => e.currentTarget.style.background = C.panel2}
                >{icon}</div>
                <span style={{ fontSize: 11, color: C.textDim, fontWeight: 500 }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Info rows */}
        <div style={{ padding: '0 0 24px' }}>
          {user?.bio && (
            <InfoRow label="Bio">
              <span style={{ color: C.text, fontSize: 14, lineHeight: 1.5 }}>{user.bio}</span>
            </InfoRow>
          )}

          <InfoRow label="Usuario">
            <span style={{ color: C.text, fontSize: 14 }}>@{user?.username}</span>
          </InfoRow>

          {/* Apodo */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '.5px', textTransform: 'uppercase' }}>Apodo (solo vos ves esto)</span>
              <button onClick={() => setEditingNick(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, fontSize: 13, fontWeight: 600, padding: 0 }}>
                {editingNick ? 'Cancelar' : 'Editar'}
              </button>
            </div>
            {editingNick ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <input value={nickname} onChange={e => setNickname(e.target.value)}
                  placeholder="Poné un apodo..." maxLength={30} autoFocus
                  style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', color: C.text, fontSize: 14, outline: 'none' }} />
                <button onClick={saveContact} disabled={saving}
                  style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: C.green, color: C.bg, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? '...' : 'OK'}
                </button>
              </div>
            ) : (
              <span style={{ fontSize: 14, color: nickname ? C.text : C.textDim }}>{nickname || 'Sin apodo'}</span>
            )}
          </div>

          {/* Add / remove contact */}
          <div style={{ padding: '20px 20px 0' }}>
            {isSaved ? (
              <button onClick={removeContact} style={{
                width: '100%', padding: '13px 0', borderRadius: 14,
                border: `1px solid #ef444444`, background: '#ef444410',
                color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>Eliminar contacto</button>
            ) : (
              <button onClick={saveContact} disabled={saving} style={{
                width: '100%', padding: '13px 0', borderRadius: 14,
                border: 'none', background: C.green, color: C.bg,
                fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1,
              }}>{saving ? 'Guardando...' : '+ Agregar a contactos'}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, children }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}
