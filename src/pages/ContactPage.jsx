import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'

export default function ContactPage({ user, onBack, onChat }) {
  const { profile } = useAuthStore()
  const { findOrCreateConversation, setActiveConversation } = useChatStore()
  const [isSaved, setIsSaved] = useState(false)
  const [nickname, setNickname] = useState('')
  const [editingNick, setEditingNick] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    checkContact()
  }, [user?.id])

  async function checkContact() {
    if (!user?.id || !profile?.id) return
    const { data } = await supabase
      .from('contacts')
      .select('nickname')
      .eq('owner_id', profile.id)
      .eq('contact_id', user.id)
      .single()
    if (data) {
      setIsSaved(true)
      setNickname(data.nickname || '')
    }
  }

  async function saveContact() {
    setSaving(true)
    await supabase.from('contacts').upsert({
      owner_id: profile.id,
      contact_id: user.id,
      nickname: nickname.trim() || null,
    }, { onConflict: 'owner_id,contact_id' })
    setIsSaved(true)
    setSaving(false)
    setEditingNick(false)
  }

  async function removeContact() {
    await supabase.from('contacts')
      .delete()
      .eq('owner_id', profile.id)
      .eq('contact_id', user.id)
    setIsSaved(false)
    setNickname('')
  }

  async function handleChat() {
    const convId = await findOrCreateConversation(profile.id, user.id)
    setActiveConversation({ id: convId, user, isGroup: false })
    onChat()
  }

  const displayName = nickname || user?.display_name || 'Usuario'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#111b21' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4" style={{ background: '#202c33' }}>
        <button onClick={onBack} className="text-white p-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2 className="text-white font-semibold text-base">Info. de contacto</h2>
      </div>

      {/* Avatar y nombre */}
      <div className="flex flex-col items-center py-8 gap-3" style={{ background: '#202c33' }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white"
          style={{ background: '#2a3942' }}>
          {user?.avatar_url
            ? <img src={user.avatar_url} className="rounded-full w-full h-full object-cover" alt="" />
            : initials}
        </div>
        <div className="text-center">
          <p className="text-white text-xl font-semibold">{displayName}</p>
          {nickname && <p className="text-sm" style={{ color: '#8696a0' }}>{user?.display_name}</p>}
          <p className="text-sm" style={{ color: '#8696a0' }}>@{user?.username}</p>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="flex justify-center gap-8 py-5" style={{ background: '#202c33', borderBottom: '1px solid #2a3942' }}>
        <ActionBtn icon="💬" label="Mensaje" onClick={handleChat} />
        <ActionBtn icon="🎙️" label="Audio" onClick={() => alert('Próximamente')} disabled />
        <ActionBtn icon="📹" label="Video" onClick={() => alert('Próximamente')} disabled />
      </div>

      {/* Info */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4 border-b" style={{ borderColor: '#2a3942' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: '#8696a0' }}>USUARIO</p>
          <p className="text-white">@{user?.username}</p>
        </div>

        {user?.bio && (
          <div className="px-6 py-4 border-b" style={{ borderColor: '#2a3942' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: '#8696a0' }}>BIO</p>
            <p className="text-white text-sm">{user.bio}</p>
          </div>
        )}

        {/* Nickname personalizado */}
        <div className="px-6 py-4 border-b" style={{ borderColor: '#2a3942' }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold" style={{ color: '#8696a0' }}>APODO (solo vos ves esto)</p>
            <button onClick={() => setEditingNick(v => !v)} className="text-xs" style={{ color: '#00a884' }}>
              {editingNick ? 'Cancelar' : 'Editar'}
            </button>
          </div>
          {editingNick ? (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="Ponele un apodo..."
                maxLength={30}
                autoFocus
                className="flex-1 px-3 py-2 rounded-lg text-white text-sm outline-none"
                style={{ background: '#2a3942' }}
              />
              <button onClick={saveContact} disabled={saving}
                className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                style={{ background: '#00a884' }}>
                {saving ? '...' : 'OK'}
              </button>
            </div>
          ) : (
            <p className="text-sm mt-1" style={{ color: nickname ? 'white' : '#8696a0' }}>
              {nickname || 'Sin apodo'}
            </p>
          )}
        </div>

        {/* Guardar / eliminar contacto */}
        <div className="px-6 py-6">
          {isSaved ? (
            <button onClick={removeContact}
              className="w-full py-3 rounded-2xl font-semibold text-sm"
              style={{ background: '#2a3942', color: '#ef4444' }}>
              Eliminar contacto
            </button>
          ) : (
            <button onClick={saveContact} disabled={saving}
              className="w-full py-3 rounded-2xl font-semibold text-sm text-white disabled:opacity-50"
              style={{ background: '#00a884' }}>
              {saving ? 'Guardando...' : '+ Agregar a contactos'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ icon, label, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex flex-col items-center gap-1 disabled:opacity-40">
      <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
        style={{ background: '#2a3942' }}>
        {icon}
      </div>
      <span className="text-xs" style={{ color: '#8696a0' }}>{label}</span>
    </button>
  )
}
