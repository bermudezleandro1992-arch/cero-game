import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'
import TournamentDashboard from './TournamentDashboard'

function Header({ onBack, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
      </button>
      <div>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>{title}</div>
        {subtitle && <div style={{ color: C.textDim, fontSize: 11, marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
  )
}

function TabBar({ tabs, active, onSelect }) {
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.panel, flexShrink: 0, overflowX: 'auto' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onSelect(t.id)} style={{
          flex: 1, minWidth: 60, padding: '11px 8px', border: 'none', background: 'none', cursor: 'pointer',
          borderBottom: `2px solid ${active === t.id ? C.green : 'transparent'}`,
          color: active === t.id ? C.green : C.textDim,
          fontSize: 11, fontWeight: active === t.id ? 700 : 500,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        }}>
          <span style={{ fontSize: 16 }}>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  )
}

// ── Anuncios Tab ──────────────────────────────────────────────────────────────
function AnunciosTab({ community }) {
  const { profile } = useAuthStore()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('announcements')
      .select('*')
      .eq('community_id', community.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => { setAnnouncements(data || []); setLoading(false) })
  }, [community.id])

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    let pinned = isPinned
    if (pinned) {
      const { count } = await supabase.from('announcements')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', community.id).eq('is_pinned', true)
      if (count >= 3) { alert('Máximo 3 anuncios fijados'); pinned = false }
    }
    const { data, error } = await supabase.from('announcements').insert({
      community_id: community.id,
      author_id: profile.id,
      title: title.trim(),
      body: body.trim() || null,
      is_pinned: pinned,
    }).select().single()
    if (!error && data) {
      setAnnouncements(prev => [data, ...prev])
      setTitle(''); setBody(''); setIsPinned(false)
    }
    setSaving(false)
  }

  async function deleteAnnouncement(id) {
    if (!confirm('¿Eliminar este anuncio?')) return
    await supabase.from('announcements').delete().eq('id', id)
    setAnnouncements(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <form onSubmit={submit} style={{ background: C.panel, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>Nuevo anuncio</div>
        <input
          placeholder="Título *"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 10, background: C.panel2, border: `1px solid ${C.border}`, color: C.text, fontSize: 14, outline: 'none' }}
        />
        <textarea
          placeholder="Descripción (opcional)"
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={3}
          style={{ padding: '10px 12px', borderRadius: 10, background: C.panel2, border: `1px solid ${C.border}`, color: C.text, fontSize: 14, resize: 'vertical', outline: 'none' }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 12px', borderRadius: 10, border: `1px solid ${isPinned ? C.green : C.border}`, background: isPinned ? `${C.green}12` : 'transparent' }}>
          <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} style={{ accentColor: C.green }} />
          <span style={{ color: C.textDim, fontSize: 13 }}>📌 Fijar anuncio (máx 3)</span>
        </label>
        <button type="submit" disabled={saving || !title.trim()} style={{
          padding: '11px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: C.green, color: C.bg, fontWeight: 700, fontSize: 14,
        }}>
          {saving ? 'Publicando...' : 'Publicar'}
        </button>
      </form>

      {loading ? (
        <div style={{ textAlign: 'center', color: C.textDim, padding: 24 }}>Cargando...</div>
      ) : announcements.length === 0 ? (
        <div style={{ textAlign: 'center', color: C.textDim, padding: 24 }}>Sin anuncios aún</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {announcements.map(a => (
            <div key={a.id} style={{ background: C.panel, borderRadius: 12, padding: 14, border: `1px solid ${a.is_pinned ? C.green + '44' : C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  {a.is_pinned && <span style={{ fontSize: 10, color: C.green, fontWeight: 700, marginRight: 6 }}>📌 FIJADO</span>}
                  <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{a.title}</span>
                  {a.body && <p style={{ color: C.textDim, fontSize: 13, margin: '6px 0 0', lineHeight: 1.5 }}>{a.body}</p>}
                </div>
                <button onClick={() => deleteAnnouncement(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, fontSize: 16 }}>🗑</button>
              </div>
              <div style={{ color: C.textDim, fontSize: 11, marginTop: 8 }}>{new Date(a.created_at).toLocaleDateString('es-AR')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Miembros Tab (read-only view) ─────────────────────────────────────────────
function MiembrosTab({ community }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('group_roles')
      .select('role, users(id, display_name, avatar_url, elo)')
      .eq('group_id', community.id)
      .then(({ data }) => { setMembers(data || []); setLoading(false) })
  }, [community.id])

  const ROLE_LABEL = { owner: '👑 Dueño', admin: '🛡 Admin', organizador: '🎯 Organizador', moderador: '🔧 Moderador' }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      {loading ? (
        <div style={{ textAlign: 'center', color: C.textDim, padding: 24 }}>Cargando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: C.textDim, fontSize: 12, marginBottom: 4 }}>{members.length} miembro(s) con rol asignado</div>
          {members.map(m => (
            <div key={m.users?.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.panel, borderRadius: 12, padding: '10px 14px', border: `1px solid ${C.border}` }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.panel2, overflow: 'hidden', flexShrink: 0 }}>
                {m.users?.avatar_url
                  ? <img src={m.users.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.green, fontWeight: 700, fontSize: 14 }}>
                      {m.users?.display_name?.[0]?.toUpperCase() || '?'}
                    </div>
                }
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{m.users?.display_name}</div>
                <div style={{ color: C.textDim, fontSize: 11 }}>{ROLE_LABEL[m.role] || m.role} · ELO {m.users?.elo || 1000}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'torneos', icon: '🏆', label: 'Torneos' },
  { id: 'anuncios', icon: '📢', label: 'Anuncios' },
  { id: 'miembros', icon: '👥', label: 'Miembros' },
]

export default function OrganizadorPanel({ community, onBack }) {
  const [tab, setTab] = useState('torneos')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      <Header onBack={onBack} title={community.name} subtitle="Panel de Organizador" />
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />

      {tab === 'torneos' && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <TournamentDashboard community={community} onBack={() => setTab('torneos')} />
        </div>
      )}
      {tab === 'anuncios' && <AnunciosTab community={community} />}
      {tab === 'miembros' && <MiembrosTab community={community} />}
    </div>
  )
}
