import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { C } from '../theme'
import CallPage from './CallPage'

function formatLastSeen(ts) {
  if (!ts) return null
  const d = new Date(ts)
  const now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60) return 'visto hace instantes'
  if (diff < 3600) return `visto hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `visto hoy a las ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
  if (diff < 172800) return `visto ayer a las ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
  return `visto el ${d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`
}

export default function ContactPage({ user, onBack, onChat }) {
  const { profile } = useAuthStore()
  const { findOrCreateConversation, setActiveConversation } = useChatStore()
  const [isSaved, setIsSaved] = useState(false)
  const [nickname, setNickname] = useState('')
  const [editingNick, setEditingNick] = useState(false)
  const [saving, setSaving] = useState(false)
  const [call, setCall] = useState(null)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockLoading, setBlockLoading] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportSent, setReportSent] = useState(false)
  const [userData, setUserData] = useState(user)

  useEffect(() => { checkContact(); checkBlock(); loadUserData() }, [user?.id])

  async function loadUserData() {
    if (!user?.id) return
    const { data } = await supabase.from('users')
      .select('id, display_name, username, avatar_url, bio, last_seen_at, show_last_seen, plan, role')
      .eq('id', user.id).single()
    if (data) setUserData(data)
  }

  async function checkContact() {
    if (!user?.id || !profile?.id) return
    const { data } = await supabase.from('contacts').select('nickname')
      .eq('owner_id', profile.id).eq('contact_id', user.id).single()
    if (data) { setIsSaved(true); setNickname(data.nickname || '') }
  }

  async function checkBlock() {
    if (!user?.id || !profile?.id) return
    const { data } = await supabase.from('blocks')
      .select('id').eq('blocker_id', profile.id).eq('blocked_id', user.id).maybeSingle()
    setIsBlocked(!!data)
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

  async function toggleBlock() {
    setBlockLoading(true)
    if (isBlocked) {
      await supabase.from('blocks').delete()
        .eq('blocker_id', profile.id).eq('blocked_id', user.id)
      setIsBlocked(false)
    } else {
      await supabase.from('blocks').insert({ blocker_id: profile.id, blocked_id: user.id })
      setIsBlocked(true)
    }
    setBlockLoading(false)
  }

  async function sendReport() {
    if (!reportReason.trim()) return
    await supabase.from('reports').insert({
      reporter_id: profile.id,
      reported_user_id: user.id,
      reason: reportReason.trim(),
      context: 'profile',
    }).then(() => {})
    setReportSent(true)
    setTimeout(() => { setShowReport(false); setReportSent(false); setReportReason('') }, 2000)
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

  const displayName = nickname || userData?.display_name || 'Usuario'
  const initials = displayName.slice(0, 2).toUpperCase()
  const lastSeenText = userData?.show_last_seen !== false ? formatLastSeen(userData?.last_seen_at) : null

  const PLAN_BADGE = { vip: { label: '⭐ VIP', color: '#f59e0b' }, comunidad: { label: '🏆 Pro', color: '#8b5cf6' } }
  const planBadge = PLAN_BADGE[userData?.plan]

  if (call) {
    return (
      <CallPage
        conversationId={call.convId}
        myUserId={profile.id}
        contact={{ id: user.id, display_name: displayName, avatar_url: userData?.avatar_url }}
        callType={call.type}
        isIncoming={false}
        onEnd={() => setCall(null)}
      />
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <span style={{ color: C.text, fontWeight: 600, fontSize: 16 }}>Info. de contacto</span>
      </div>

      {/* Report modal */}
      {showReport && (
        <div onClick={() => setShowReport(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#141E24', borderRadius: 20, padding: '24px 20px', width: 300, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {reportSent ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 40 }}>✅</div>
                <p style={{ color: C.text, fontWeight: 700, margin: '12px 0 4px' }}>Reporte enviado</p>
                <p style={{ color: C.textDim, fontSize: 13, margin: 0 }}>Revisaremos tu reporte a la brevedad</p>
              </div>
            ) : (
              <>
                <p style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>🚨 Reportar usuario</p>
                <p style={{ margin: 0, color: C.textDim, fontSize: 13 }}>Contanos qué pasó. Tu reporte es anónimo.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {['Spam o publicidad', 'Acoso o amenazas', 'Contenido inapropiado', 'Cuenta falsa', 'Otro'].map(r => (
                    <button key={r} onClick={() => setReportReason(r)}
                      style={{ padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${reportReason === r ? C.green : C.border}`, background: reportReason === r ? `${C.green}18` : C.panel2, color: reportReason === r ? C.green : C.text, fontSize: 14, cursor: 'pointer', textAlign: 'left', fontWeight: reportReason === r ? 700 : 400 }}>
                      {r}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowReport(false)} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={sendReport} disabled={!reportReason} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: reportReason ? '#ef4444' : C.panel2, color: reportReason ? '#fff' : C.textDim, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Enviar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Hero */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '40px 20px 28px',
          background: isBlocked ? 'rgba(239,68,68,0.05)' : `linear-gradient(180deg, ${C.green}14 0%, transparent 100%)`,
          gap: 12,
        }}>
          {/* Avatar */}
          <div style={{
            width: 100, height: 100, borderRadius: '50%', overflow: 'hidden',
            border: `3px solid ${isBlocked ? '#ef444455' : C.green + '55'}`,
            boxShadow: `0 0 0 6px ${isBlocked ? '#ef444410' : C.green + '10'}, 0 8px 32px rgba(0,0,0,0.4)`,
            background: C.panel2, flexShrink: 0,
          }}>
            {userData?.avatar_url
              ? <img src={userData.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isBlocked ? 'grayscale(1)' : 'none' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 34, background: C.green + '30' }}>
                  {initials}
                </div>
            }
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ color: C.text, fontSize: 22, fontWeight: 700 }}>{displayName}</span>
              {planBadge && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${planBadge.color}22`, color: planBadge.color, border: `1px solid ${planBadge.color}44` }}>{planBadge.label}</span>}
            </div>
            {nickname && <div style={{ color: C.textDim, fontSize: 13, marginBottom: 2 }}>{userData?.display_name}</div>}
            <div style={{ color: C.green, fontSize: 13, fontWeight: 500 }}>@{userData?.username}</div>
            {lastSeenText && !isBlocked && (
              <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>🕐 {lastSeenText}</div>
            )}
            {isBlocked && (
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6, fontWeight: 600 }}>🚫 Bloqueaste a este usuario</div>
            )}
          </div>

          {/* Action buttons */}
          {!isBlocked && (
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              {[
                { label: 'Mensaje', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, action: handleChat },
                { label: 'Audio', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.38 2 2 0 0 1 3.6 1.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.79a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>, action: () => startCall('audio') },
                { label: 'Video', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>, action: () => startCall('video') },
              ].map(({ label, icon, action }) => (
                <button key={label} onClick={action} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.panel2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.green, transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.green + '18'}
                    onMouseLeave={e => e.currentTarget.style.background = C.panel2}
                  >{icon}</div>
                  <span style={{ fontSize: 11, color: C.textDim, fontWeight: 500 }}>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info rows */}
        <div style={{ padding: '0 0 24px' }}>
          {userData?.bio && (
            <InfoRow label="Bio">
              <span style={{ color: C.text, fontSize: 14, lineHeight: 1.5 }}>{userData.bio}</span>
            </InfoRow>
          )}

          <InfoRow label="Usuario">
            <span style={{ color: C.text, fontSize: 14 }}>@{userData?.username}</span>
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

          {/* Actions */}
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Add / remove contact */}
            {isSaved ? (
              <button onClick={removeContact} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: `1px solid #ef444444`, background: '#ef444410', color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Eliminar contacto
              </button>
            ) : (
              <button onClick={saveContact} disabled={saving} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: C.green, color: C.bg, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : '+ Agregar a contactos'}
              </button>
            )}

            {/* Block */}
            <button onClick={toggleBlock} disabled={blockLoading} style={{
              width: '100%', padding: '13px 0', borderRadius: 14,
              border: `1px solid ${isBlocked ? C.border : '#ef444444'}`,
              background: isBlocked ? C.panel2 : '#ef444410',
              color: isBlocked ? C.textDim : '#ef4444',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: blockLoading ? 0.6 : 1,
            }}>
              {blockLoading ? '...' : isBlocked ? '✓ Desbloquear usuario' : '🚫 Bloquear usuario'}
            </button>

            {/* Report */}
            <button onClick={() => setShowReport(true)} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: `1px solid #f59e0b44`, background: '#f59e0b10', color: '#f59e0b', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              🚨 Reportar usuario
            </button>
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
