import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { C } from '../App'

const AVATAR_COLORS = ['#e91e63','#9c27b0','#1565c0','#00838f','#2e7d32','#e65100','#c62828']
function avatarColor(id) {
  if (!id) return C.panel2
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export default function NewGroupPage({ onBack, onCreated }) {
  const { profile } = useAuthStore()
  const { createGroup } = useChatStore()
  const [step, setStep] = useState(1)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selected, setSelected] = useState([])
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
            {step === 1 ? 'Nuevo grupo' : 'Nombre del grupo'}
          </h2>
          {step === 1 && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textDim }}>
              {selected.length} participante{selected.length !== 1 ? 's' : ''} seleccionado{selected.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {step === 1 && selected.length > 0 && (
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
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
                <p style={{ color: C.text2, fontSize: 14, margin: '0 0 4px', fontWeight: 600 }}>Agregar participantes</p>
                <p style={{ color: C.textDim, fontSize: 12, margin: 0 }}>Buscá a las personas para agregar al grupo</p>
              </div>
            )}
            {searchResults.map(u => {
              const isSel = selected.find(s => s.id === u.id)
              return (
                <button key={u.id} onClick={() => toggleUser(u)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px', background: isSel ? `${C.green}0C` : 'none',
                  border: 'none', borderBottom: `1px solid ${C.border}22`,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background .15s',
                }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                    background: isSel ? C.green : avatarColor(u.id),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700,
                    color: isSel ? C.bg : '#fff',
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', gap: 24 }}>
          {/* Group avatar preview */}
          <div style={{
            width: 90, height: 90, borderRadius: '50%',
            background: groupName ? `linear-gradient(135deg, ${C.greenDk}88, ${C.panel2})` : C.panel2,
            border: `2px solid ${groupName ? C.green : C.border}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: groupName ? 28 : 36, fontWeight: 800, color: C.text,
            boxShadow: groupName ? `0 0 24px ${C.green}22` : 'none',
            transition: 'all .2s',
          }}>
            {groupName ? groupName.slice(0, 2).toUpperCase() : '👥'}
          </div>

          {/* Name input */}
          <div style={{ width: '100%' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: '1.5px', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
              Nombre del grupo
            </label>
            <input
              type="text" placeholder="Ej: Equipo Relámpago ⚡"
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

          {/* Members preview */}
          <div style={{ width: '100%', background: C.panel, borderRadius: 12, padding: '12px 16px', border: `1px solid ${C.border}` }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: C.textDim, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
              {selected.length + 1} participantes
            </p>
            <p style={{ margin: 0, fontSize: 13, color: C.text2, lineHeight: 1.6 }}>
              {profile?.display_name}{selected.map(u => `, ${u.display_name}`).join('')}
            </p>
          </div>

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={creating || !groupName.trim()}
            style={{
              width: 60, height: 60, borderRadius: '50%', border: 'none',
              background: creating || !groupName.trim() ? C.panel2 : C.green,
              cursor: creating || !groupName.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: !groupName.trim() ? 'none' : `0 4px 20px ${C.green}44`,
              transition: 'all .2s',
            }}>
            {creating
              ? <span style={{ color: C.textDim, fontSize: 20 }}>⏳</span>
              : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={!groupName.trim() ? C.textDim : C.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
            }
          </button>
          <p style={{ margin: '-16px 0 0', fontSize: 12, color: C.textDim }}>Crear grupo</p>
        </div>
      )}
    </div>
  )
}
