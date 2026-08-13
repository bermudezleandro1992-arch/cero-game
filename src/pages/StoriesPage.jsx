import { useEffect, useRef, useState, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../App'

// Track whether stories table exists — avoid repeated 400s if it doesn't
let storiesTableExists = null // null = unknown, true/false after first check

async function fetchStoriesIfAvailable(query) {
  if (storiesTableExists === false) return { data: null, error: null }
  const result = await query
  if (result.error?.code === '42P01' || result.error?.message?.includes('does not exist') || (result.error && !result.data)) {
    storiesTableExists = false
    return { data: null, error: null }
  }
  storiesTableExists = true
  return result
}

// ── Global story groups context (for avatar rings in chat list) ────────────────
export const StoryCtx = createContext({ usersWithStories: new Set() })

// ── Story viewer ───────────────────────────────────────────────────────────────
function StoryViewer({ groups, startGroup, startIdx, onClose, myUserId, onPin }) {
  const [gIdx, setGIdx] = useState(startGroup || 0)
  const [idx, setIdx] = useState(startIdx || 0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef(null)
  const group = groups[gIdx]
  const story = group?.stories[idx]
  const DURATION = story?.media_type === 'video' ? 15000 : 5000
  const isOwn = story?.user_id === myUserId

  useEffect(() => {
    setProgress(0)
    if (paused) return
    const start = Date.now()
    timerRef.current = setInterval(() => {
      const p = Math.min(100, ((Date.now() - start) / DURATION) * 100)
      setProgress(p)
      if (p >= 100) {
        clearInterval(timerRef.current)
        next()
      }
    }, 50)
    return () => clearInterval(timerRef.current)
  }, [idx, gIdx, paused])

  function next() {
    if (idx < (group?.stories.length || 1) - 1) { setIdx(i => i + 1) }
    else if (gIdx < groups.length - 1) { setGIdx(g => g + 1); setIdx(0) }
    else onClose()
  }
  function prev() {
    if (idx > 0) { setIdx(i => i - 1) }
    else if (gIdx > 0) { setGIdx(g => g - 1); setIdx(0) }
    else onClose()
  }

  if (!story) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* Progress bars */}
      <div style={{ display: 'flex', gap: 3, padding: '12px 12px 8px', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        {group.stories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.35)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2, background: '#fff',
              width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%',
            }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ position: 'absolute', top: 32, left: 0, right: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', border: '2px solid #fff', flexShrink: 0 }}>
          {group.user?.avatar_url
            ? <img src={group.user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#000', fontSize: 14 }}>
                {group.user?.display_name?.slice(0, 2).toUpperCase()}
              </div>
          }
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{group.user?.display_name || group.user?.username}</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>
            {new Date(story.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            {story.is_highlighted && <span style={{ marginLeft: 6, color: '#facc15', fontWeight: 700 }}>★ Destacada</span>}
          </div>
        </div>
        {/* Own story options */}
        {isOwn && (
          <button
            onClick={() => onPin?.(story)}
            title={story.is_highlighted ? 'Quitar de destacadas' : 'Agregar a destacadas'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: story.is_highlighted ? '#facc15' : 'rgba(255,255,255,0.6)', fontSize: 20 }}>
            ★
          </button>
        )}
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Tap zones */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex' }}>
        <div style={{ flex: 1 }} onPointerDown={prev} />
        <div style={{ flex: 1 }} onPointerDown={next} />
      </div>

      {/* Hold to pause */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 6 }}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      />

      {/* Media */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {story.media_type === 'video'
          ? <video src={story.media_url} autoPlay loop playsInline style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          : <img src={story.media_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        }
      </div>

      {/* Caption */}
      {story.caption && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
          padding: '40px 20px 32px', color: '#fff', fontSize: 15, textAlign: 'center',
          zIndex: 7,
        }}>
          {story.caption}
        </div>
      )}
    </div>
  )
}

// ── Story avatar bubble ────────────────────────────────────────────────────────
function StoryBubble({ group, profile, onClick, size = 56 }) {
  const isMe = group.user?.id === profile?.id
  const ringColor = group.stories.some(s => s.is_highlighted) ? '#facc15' : C.green
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0 }}
      onClick={onClick}
    >
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: `conic-gradient(${ringColor} 0%, ${ringColor}aa 60%, ${ringColor} 100%)`,
        padding: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.bg}`, background: C.panel2 }}>
          {group.user?.avatar_url
            ? <img src={group.user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', background: isMe ? C.green : C.panel2, fontSize: Math.round(size * 0.32) }}>
                {(group.user?.display_name || '?').slice(0, 2).toUpperCase()}
              </div>
          }
        </div>
      </div>
      <span style={{ fontSize: 10, color: C.textDim, whiteSpace: 'nowrap', maxWidth: size + 8, overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>
        {isMe ? 'Mi estado' : (group.user?.display_name || group.user?.username)}
      </span>
    </div>
  )
}

// ── Caption input modal ────────────────────────────────────────────────────────
function CaptionModal({ file, onConfirm, onCancel }) {
  const [caption, setCaption] = useState('')
  const preview = file ? URL.createObjectURL(file) : null
  const isVideo = file?.type.startsWith('video/')
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      {isVideo
        ? <video src={preview} autoPlay loop muted playsInline style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 16, objectFit: 'contain' }} />
        : <img src={preview} alt="" style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 16, objectFit: 'contain' }} />
      }
      <input
        value={caption} onChange={e => setCaption(e.target.value)}
        placeholder="Agregar un texto... (opcional)"
        autoFocus
        style={{ width: '100%', maxWidth: 400, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none' }}
      />
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onCancel} style={{ padding: '10px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
        <button onClick={() => onConfirm(caption)} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: C.green, color: C.bg, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>Publicar</button>
      </div>
    </div>
  )
}

// ── Featured Stories section (Historias Destacadas) ───────────────────────────
export function FeaturedStories({ userId, onView }) {
  const [featured, setFeatured] = useState([])

  useEffect(() => {
    if (!userId) return
    supabase.from('stories')
      .select('*, user:users!stories_user_id_fkey(id, display_name, username, avatar_url)')
      .eq('user_id', userId)
      .eq('is_highlighted', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setFeatured(data || []))
  }, [userId])

  if (!featured.length) return null

  return (
    <div style={{ padding: '12px 14px 4px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 10 }}>Destacadas ★</div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {featured.map(s => (
          <div key={s.id} style={{ flexShrink: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
            onClick={() => onView?.([{ user: s.user, stories: [s] }], 0, 0)}>
            <div style={{
              width: 64, height: 64, borderRadius: 12,
              overflow: 'hidden', border: `2px solid #facc15`,
              background: C.panel2,
            }}>
              {s.media_type === 'video'
                ? <video src={s.media_url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <img src={s.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              }
            </div>
            <span style={{ fontSize: 9, color: '#facc15', fontWeight: 700, maxWidth: 64, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.caption || new Date(s.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Stories Bar (shown at top of chat list) ───────────────────────────────────
export function StoriesBar() {
  const { profile } = useAuthStore()
  const [storyGroups, setStoryGroups] = useState([])
  const [viewing, setViewing] = useState(null) // { groups, gIdx, idx }
  const [loading, setLoading] = useState(true)
  const [pendingFile, setPendingFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (!profile?.id) return
    loadStories()
  }, [profile?.id])

  async function loadStories() {
    const { data } = await fetchStoriesIfAvailable(
      supabase.from('stories')
        .select('*, user:users!stories_user_id_fkey(id, display_name, username, avatar_url)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
    )

    setLoading(false)
    if (!data) return

    const map = {}
    data.forEach(s => {
      if (!map[s.user_id]) map[s.user_id] = { user: s.user, stories: [] }
      map[s.user_id].stories.push(s)
    })

    const groups = Object.values(map)
    const myIdx = groups.findIndex(g => g.user?.id === profile.id)
    if (myIdx > 0) { const [mine] = groups.splice(myIdx, 1); groups.unshift(mine) }

    setStoryGroups(groups)
  }

  async function handleFilePick(e) {
    const file = e.target.files?.[0]; if (!file) return
    fileRef.current.value = ''
    if (file.size > 30 * 1024 * 1024) { alert('Máximo 30MB'); return }
    setPendingFile(file)
  }

  async function publishStory(caption) {
    const file = pendingFile
    setPendingFile(null)
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `stories/${profile.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('attachments').upload(path, file)
    if (error) { alert('Error al subir: ' + error.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)
    const type = file.type.startsWith('video/') ? 'video' : 'image'
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { error: insertErr } = await supabase.from('stories').insert({
      user_id: profile.id,
      media_url: urlData.publicUrl,
      media_type: type,
      expires_at: expiresAt,
      caption: caption || null,
    })
    setUploading(false)
    if (insertErr) { alert('Error al publicar: ' + insertErr.message); return }
    loadStories()
  }

  async function toggleHighlight(story) {
    await supabase.from('stories').update({ is_highlighted: !story.is_highlighted }).eq('id', story.id)
    loadStories()
    setViewing(null)
  }

  const myGroup = storyGroups.find(g => g.user?.id === profile.id)
  const others = storyGroups.filter(g => g.user?.id !== profile.id)

  if (loading) return null

  return (
    <>
      {viewing && (
        <StoryViewer
          groups={viewing.groups}
          startGroup={viewing.gIdx}
          startIdx={viewing.idx}
          myUserId={profile?.id}
          onClose={() => { setViewing(null); loadStories() }}
          onPin={toggleHighlight}
        />
      )}
      {pendingFile && (
        <CaptionModal
          file={pendingFile}
          onConfirm={publishStory}
          onCancel={() => setPendingFile(null)}
        />
      )}

      <div style={{
        display: 'flex', gap: 12, padding: '12px 14px',
        overflowX: 'auto', flexShrink: 0,
        borderBottom: `1px solid ${C.border}`,
        scrollbarWidth: 'none',
      }}>
        {/* Add my story */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: uploading ? 'wait' : 'pointer', flexShrink: 0 }}
          onClick={() => !uploading && fileRef.current?.click()}
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
              background: uploading ? C.textDim : C.green, border: `2px solid ${C.bg}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {uploading
                ? <div style={{ width: 8, height: 8, border: `2px solid ${C.bg}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                : <svg width="10" height="10" viewBox="0 0 24 24" fill="#000"><path d="M12 5v14M5 12h14" strokeWidth="3" stroke="#000" strokeLinecap="round"/></svg>
              }
            </div>
          </div>
          <span style={{ fontSize: 10, color: C.textDim, whiteSpace: 'nowrap', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {uploading ? 'Subiendo...' : myGroup ? 'Mi estado' : 'Agregar'}
          </span>
        </div>

        {/* My story (tap to view) — shown after add button if I have stories */}
        {myGroup && (
          <StoryBubble group={myGroup} profile={profile}
            onClick={() => setViewing({ groups: [myGroup, ...others], gIdx: 0, idx: 0 })}
          />
        )}

        {/* Others */}
        {others.map((group, gi) => (
          <StoryBubble key={group.user?.id} group={group} profile={profile}
            onClick={() => setViewing({ groups: [myGroup, ...others].filter(Boolean), gIdx: myGroup ? gi + 1 : gi, idx: 0 })}
          />
        ))}

        <input type="file" accept="image/*,video/*" ref={fileRef} onChange={handleFilePick} style={{ display: 'none' }} />
      </div>
    </>
  )
}

// Export story user IDs so chat list can show rings on contact avatars
export function useStoryUserIds() {
  const { profile } = useAuthStore()
  const [ids, setIds] = useState(new Set())
  useEffect(() => {
    if (!profile?.id) return
    fetchStoriesIfAvailable(
      supabase.from('stories').select('user_id').gt('expires_at', new Date().toISOString())
    ).then(({ data }) => {
      if (data) setIds(new Set(data.map(s => s.user_id)))
    })
  }, [profile?.id])
  return ids
}
