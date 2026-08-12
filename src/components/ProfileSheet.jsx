import { useState } from 'react'
import { useAuthStore } from '../store/authStore'

export default function ProfileSheet({ onClose }) {
  const { profile, updateProfile } = useAuthStore()
  const [name, setName] = useState(profile?.display_name || '')
  const [username, setUsername] = useState(profile?.username || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    const cleanUser = username.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '')
    const err = await updateProfile(profile.id, {
      display_name: name.trim(),
      username: cleanUser || profile.username,
    })
    if (err) setError(err)
    else {
      setSuccess(true)
      setTimeout(onClose, 800)
    }
    setSaving(false)
  }

  const initials = (profile?.display_name || '?').slice(0, 2).toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#111b21' }}>
      <div className="flex items-center gap-4 px-4 py-4" style={{ background: '#202c33' }}>
        <button onClick={onClose} className="text-white p-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2 className="text-white font-semibold text-base">Editar perfil</h2>
      </div>

      <div className="flex flex-col items-center py-8 gap-2" style={{ background: '#202c33' }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white"
          style={{ background: '#2a3942' }}>
          {initials}
        </div>
        <p className="text-xs" style={{ color: '#8696a0' }}>Foto de perfil próximamente</p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6 px-6 pt-8">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#00a884' }}>
            Tu nombre
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={50}
            autoFocus
            className="w-full py-2 mt-2 text-white text-base outline-none border-b"
            style={{ background: 'transparent', borderColor: '#00a884' }}
          />
          <p className="text-right text-xs mt-1" style={{ color: '#8696a0' }}>{name.length}/50</p>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#00a884' }}>
            Nombre de usuario
          </label>
          <div className="flex items-center border-b mt-2" style={{ borderColor: '#2a3942' }}>
            <span className="text-base" style={{ color: '#8696a0' }}>@</span>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              maxLength={30}
              className="flex-1 px-1 py-2 text-white text-base outline-none"
              style={{ background: 'transparent' }}
            />
          </div>
          <p className="text-xs mt-1" style={{ color: '#8696a0' }}>
            Solo letras minúsculas, números y guión bajo
          </p>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-center text-sm font-medium" style={{ color: '#00a884' }}>
          ¡Perfil actualizado!
        </p>}

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full py-3 rounded-2xl font-semibold text-white disabled:opacity-50 mt-2"
          style={{ background: '#00a884' }}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
