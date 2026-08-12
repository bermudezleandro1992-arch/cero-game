import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../App'

// ── Story viewer ───────────────────────────────────────────────────────────────
function StoryViewer({ stories, startIdx, onClose }) {
  const [idx, setIdx] = useState(startIdx || 0)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef(null)
  const story = stories[idx]
  const DURATION = story?.media_type === 'video' ? 15000 : 5000

  useEffect(() => {
    setProgress(0)
    const start = Date.now()
    timerRef.current = setInterval(() => {
      const p = Math.min(100, ((Date.now() - start) / DURATION) * 100)
      setProgress(p)
      if (p >= 100) {
        clearInterval(timerRef.current)
        if (idx < stories.length - 1) setIdx(i => i + 1)
        else onClose()
      }
    }, 50)
    return () => clearInterval(timerRef.current)
  }, [idx])

  if (!story) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, background: '#000',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Progress bars */}
      <div style={{ display: 'flex', gap: 3, padding: '12px 12px 8px', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        {stories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.35)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2, background: '#fff',
              width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%',
              transition: i === idx ? 'none' : undefined,
            }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{
        position: 'absolute', top: 32, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
          border: '2px solid #fff', flexShrink: 0,
        }}>
          {story.user?.avatar_url
            ? <img src={story.user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#000', fontSize: 14 }}>
                {story.user?.display_name?.slice(0, 2).toUpperCase()}
              </div>
          }
        </div>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{story.user?.display_name || story.user?.username}</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>
            {new Date(story.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <button onClick={onClose} style={{
          marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 4,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Media */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={e => {
          const half = window.innerWidth / 2
          if (e.clientX < half) { if (idx > 0) setIdx(i => i - 1); else onClose() }
          else { if (idx < stories.length - 1) setIdx(i => i + 1); else onClose() }
        }}
      >
        {story.media_type === 'video'
          ? <video src={story.media_url} autoPlay loop style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          : <img src={story.media_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        }
      </div>

      {/* Caption */}
      {story.caption && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
          padding: '40px 20px 24px', color: '#fff', fontSize: 15,
          textAlign: 'center',
        }}>
          {story.caption}
        </div>
      )}
    </div>
  )
}

// ── Stories Bar (shown at top of chat list) ───────────────────────────────────
export function StoriesBar({ onAddStory }) {
  const { profile } = useAuthStore()
  const [storyGroups, setStoryGroups] = useState([])
  const [viewing, setViewing] = useState(null) // { stories, idx }
  const [loading, setLoading] = useState(true)
  const fileRef = useRef()

  useEffect(() => {
    if (!profile?.id) return
    loadStories()
  }, [profile?.id])

  async function loadStories() {
    const { data } = await supabase
      .from('stories')
      .select('*, user:users!stories_user_id_fkey(id, display_name, username, avatar_url)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    setLoading(false)
    if (!data) return

    // Group by user
    const map = {}
    data.forEach(s => {
      if (!map[s.user_id]) map[s.user_id] = { user: s.user, stories: [] }
      map[s.user_id].stories.push(s)
    })

    // My stories first
    const groups = Object.values(map)
    const myIdx = groups.findIndex(g => g.user?.id === profile.id)
    if (myIdx > 0) { const [mine] = groups.splice(myIdx, 1); groups.unshift(mine) }

    setStoryGroups(groups)
  }

  async function handleFilePick(e) {
    const file = e.target.files?.[0]; if (!file) return
    fileRef.current.value = ''
    if (file.size > 30 * 1024 * 1024) { alert('Máximo 30MB'); return }
    const ext = file.name.split('.').pop()
    const path = `stories/${profile.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('attachments').upload(path, file)
    if (error) { alert('Error al subir: ' + error.message); return }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)
    const type = file.type.startsWith('video/') ? 'video' : 'image'
    await supabase.from('stories').insert({
      user_id: profile.id,
      media_url: urlData.publicUrl,
      media_type: type,
    })
    loadStories()
  }

  const myGroup = storyGroups.find(g => g.user?.id === profile.id)

  if (loading) return null

  return (
    <>
      {viewing && (
        <StoryViewer
          stories={viewing.stories}
          startIdx={viewing.idx}
          onClose={() => { setViewing(null); loadStories() }}
        />
      )}
      <div style={{
        display: 'flex', gap: 12, padding: '12px 14px',
        overflowX: 'auto', flexShrink: 0,
        borderBottom: `1px solid ${C.border}`,
        scrollbarWidth: 'none',
      }}>
        {/* Add my story */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer' }}
          onClick={() => fileRef.current?.click()}
        >
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: myGroup ? `conic-gradient(${C.green}, #00cc66, ${C.green})` : C.panel2,
              padding: myGroup ? 2.5 : 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: myGroup ? `2px solid ${C.bg}` : 'none', background: C.panel2 }}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', background: C.green, fontSize: 18 }}>
                      {profile?.display_name?.slice(0, 2).toUpperCase()}
                    </div>
                }
              </div>
            </div>
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 20, height: 20, borderRadius: '50%',
              background: C.green, border: `2px solid ${C.bg}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#000"><path d="M12 5v14M5 12h14" strokeWidth="3" stroke="#000" strokeLinecap="round"/></svg>
            </div>
          </div>
          <span style={{ fontSize: 10, color: C.textDim, whiteSpace: 'nowrap', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {myGroup ? 'Mi estado' : 'Agregar'}
          </span>
        </div>

        {/* Other users' stories */}
        {storyGroups.filter(g => g.user?.id !== profile.id).map(group => (
          <div key={group.user?.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer' }}
            onClick={() => setViewing({ stories: group.stories.map(s => ({ ...s, user: group.user })), idx: 0 })}
          >
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: `conic-gradient(${C.green}, #00cc66, ${C.green})`,
              padding: 2.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.bg}`, background: C.panel2 }}>
                {group.user?.avatar_url
                  ? <img src={group.user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', background: C.panel2, fontSize: 18 }}>
                      {group.user?.display_name?.slice(0, 2).toUpperCase()}
                    </div>
                }
              </div>
            </div>
            <span style={{ fontSize: 10, color: C.textDim, whiteSpace: 'nowrap', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {group.user?.display_name || group.user?.username}
            </span>
          </div>
        ))}

        <input type="file" accept="image/*,video/*" ref={fileRef} onChange={handleFilePick} style={{ display: 'none' }} />
      </div>
    </>
  )
}
