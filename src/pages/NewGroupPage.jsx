import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'

export default function NewGroupPage({ onBack, onCreated }) {
  const { profile } = useAuthStore()
  const { createGroup } = useChatStore()
  const [step, setStep] = useState(1) // 1=select members, 2=name
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selected, setSelected] = useState([]) // [{id, display_name, username}]
  const [groupName, setGroupName] = useState('')
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
    if (!groupName.trim() || selected.length === 0) return
    setCreating(true)
    const convId = await createGroup(groupName.trim(), selected.map(u => u.id), profile.id)
    setCreating(false)
    onCreated(convId, groupName.trim(), selected)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: '#111b21' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4" style={{ background: '#202c33' }}>
        <button onClick={step === 1 ? onBack : () => setStep(1)} className="text-white p-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div>
          <h2 className="text-white font-semibold text-base">
            {step === 1 ? 'Nuevo grupo' : 'Nombre del grupo'}
          </h2>
          {step === 1 && (
            <p className="text-xs" style={{ color: '#8696a0' }}>
              {selected.length} de {selected.length > 0 ? selected.length : '?'} participantes
            </p>
          )}
        </div>
        {step === 1 && selected.length > 0 && (
          <button onClick={() => setStep(2)}
            className="ml-auto w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: '#00a884' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      {step === 1 && (
        <>
          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ background: '#202c33' }}>
              {selected.map(u => (
                <button key={u.id} onClick={() => toggleUser(u)}
                  className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white"
                      style={{ background: '#2a3942' }}>
                      {u.display_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: '#ef4444' }}>
                      <span className="text-white text-xs font-bold leading-none">✕</span>
                    </div>
                  </div>
                  <span className="text-xs text-white truncate max-w-12">{u.display_name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="px-4 py-2" style={{ background: '#202c33', borderBottom: '1px solid #2a3942' }}>
            <input
              type="text"
              placeholder="Buscar por nombre o @usuario"
              value={search}
              onChange={e => { setSearch(e.target.value); searchUsers(e.target.value) }}
              autoFocus
              className="w-full px-4 py-2 rounded-xl text-white text-sm outline-none"
              style={{ background: '#2a3942' }}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {searching && <p className="text-sm text-center py-4" style={{ color: '#8696a0' }}>Buscando...</p>}
            {!search && !searching && (
              <p className="text-sm text-center py-8" style={{ color: '#8696a0' }}>
                Buscá a las personas para agregar al grupo
              </p>
            )}
            {searchResults.map(u => {
              const isSelected = selected.find(s => s.id === u.id)
              return (
                <button key={u.id} onClick={() => toggleUser(u)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b text-left"
                  style={{ borderColor: '#2a3942', background: '#111b21' }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
                    style={{ background: isSelected ? '#00a884' : '#2a3942' }}>
                    {isSelected
                      ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : u.display_name.slice(0, 2).toUpperCase()
                    }
                  </div>
                  <div>
                    <p className="font-medium text-white text-sm">{u.display_name}</p>
                    <p className="text-xs" style={{ color: '#8696a0' }}>@{u.username}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {step === 2 && (
        <div className="flex flex-col items-center px-6 pt-8 gap-6">
          {/* Group avatar placeholder */}
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white"
            style={{ background: '#2a3942' }}>
            {groupName ? groupName.slice(0, 2).toUpperCase() : '👥'}
          </div>

          <input
            type="text"
            placeholder="Nombre del grupo"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            maxLength={50}
            autoFocus
            className="w-full py-2 text-white text-base outline-none border-b text-center"
            style={{ background: 'transparent', borderColor: '#00a884' }}
          />

          <div className="w-full">
            <p className="text-xs mb-2" style={{ color: '#8696a0' }}>
              Participantes: {profile?.display_name}{selected.map(u => `, ${u.display_name}`).join('')}
            </p>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !groupName.trim()}
            className="w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-50"
            style={{ background: '#00a884' }}>
            {creating
              ? <span className="text-white text-lg">...</span>
              : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            }
          </button>
          <p className="text-xs" style={{ color: '#8696a0' }}>Crear grupo</p>
        </div>
      )}
    </div>
  )
}
