import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )
}

function Toast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 2500); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: C.green, color: C.bg, borderRadius: 12, padding: '10px 20px',
      fontSize: 13, fontWeight: 700, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      {msg}
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 12px', textAlign: 'center', flex: 1 }}>
      <div style={{ color: color || C.green, fontSize: 22, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ color: C.textDim, fontSize: 10, marginTop: 3 }}>{label}</div>
    </div>
  )
}

const PLAN_CFG = {
  free:      { label: 'Free',       color: '#64748b', icon: '🆓' },
  vip:       { label: 'VIP',        color: '#f59e0b', icon: '⭐' },
  comunidad: { label: 'PRO',        color: '#8b5cf6', icon: '💎' },
  ceo:       { label: 'CEO',        color: '#00e676', icon: '👑' },
  admin:     { label: 'Admin',      color: '#ef4444', icon: '🛡️' },
}

export default function PerfilPage({ onClose }) {
  const { profile, fetchProfile } = useAuthStore()
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ display_name: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const fileRef = useRef()

  useEffect(() => {
    if (!profile) return
    setForm({ display_name: profile.display_name || '', bio: profile.bio || '' })
    loadStats()
  }, [profile])

  async function loadStats() {
    if (!profile?.id) return
    setLoadingHistory(true)

    const [{ data: w }, { data: played }, { data: hist }] = await Promise.all([
      supabase.from('tournament_matches')
        .select('id', { count: 'exact', head: true })
        .eq('winner_id', profile.id)
        .eq('status', 'finalizado'),

      supabase.from('tournament_matches')
        .select('id', { count: 'exact', head: true })
        .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id}`)
        .eq('status', 'finalizado'),

      supabase.from('tournament_matches')
        .select(`
          id, score1, score2, status, winner_id, created_at,
          player1:player1_id(id, display_name, avatar_url),
          player2:player2_id(id, display_name, avatar_url),
          conversation:tournament_id(id, name)
        `)
        .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id}`)
        .eq('status', 'finalizado')
        .order('created_at', { ascending: false })
        .limit(15),
    ])

    const wins = w || 0
    const total = played || 0
    const losses = total - wins
    setStats({
      wins, losses, total,
      ratio: total > 0 ? Math.round((wins / total) * 100) : 0,
    })
    setHistory(hist || [])
    setLoadingHistory(false)
  }

  async function saveProfile() {
    setSaving(true)
    const { error } = await supabase.from('profiles')
      .update({ display_name: form.display_name.trim(), bio: form.bio.trim() })
      .eq('id', profile.id)
    setSaving(false)
    if (error) { setToast('Error: ' + error.message); return }
    await fetchProfile(profile.id)
    setEditing(false)
    setToast('Perfil actualizado ✓')
  }

  async function uploadAvatar(file) {
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `avatars/${profile.id}.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { setToast('Error al subir imagen'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: publicUrl + '?v=' + Date.now() }).eq('id', profile.id)
    await fetchProfile(profile.id)
    setUploading(false)
    setToast('Foto actualizada ✓')
  }

  if (!profile) return <Spinner />

  const plan = PLAN_CFG[profile.role] || PLAN_CFG.free

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: C.bg }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
        )}
        <span style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>Mi Perfil</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setEditing(e => !e)} style={{
          padding: '6px 14px', background: editing ? C.border : `${C.green}20`,
          color: editing ? C.text : C.green, border: `1px solid ${editing ? C.border : C.green + '40'}`,
          borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>
          {editing ? 'Cancelar' : 'Editar'}
        </button>
      </div>

      <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>

        {/* Avatar + Name section */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', background: C.border, overflow: 'hidden',
              border: `3px solid ${C.green}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
            }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : '👤'
              }
            </div>
            {editing && (
              <>
                <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 26, height: 26, borderRadius: '50%', background: C.green, color: C.bg,
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                  opacity: uploading ? 0.5 : 1,
                }}>
                  {uploading ? '…' : '📷'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadAvatar(e.target.files[0])} />
              </>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="Tu nombre"
                style={{ width: '100%', padding: '8px 12px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 16, fontWeight: 700, marginBottom: 8, boxSizing: 'border-box' }} />
            ) : (
              <div style={{ color: C.text, fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
                {profile.display_name || 'Sin nombre'}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: C.textDim, fontSize: 12 }}>{profile.email || ''}</span>
              <span style={{
                background: `${plan.color}20`, color: plan.color, border: `1px solid ${plan.color}40`,
                borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
              }}>
                {plan.icon} {plan.label}
              </span>
            </div>
            {editing ? (
              <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="Tu bio (opcional)"
                rows={2}
                style={{ width: '100%', padding: '8px 12px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, resize: 'vertical', marginTop: 8, boxSizing: 'border-box' }} />
            ) : profile.bio ? (
              <div style={{ color: C.textDim, fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{profile.bio}</div>
            ) : null}
          </div>
        </div>

        {editing && (
          <button onClick={saveProfile} disabled={saving} style={{
            width: '100%', padding: '12px', background: C.green, color: C.bg,
            border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
            opacity: saving ? 0.7 : 1, marginBottom: 20,
          }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        )}

        {/* Stats */}
        {stats && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            <StatCard label="Partidos" value={stats.total} color={C.textDim} />
            <StatCard label="Victorias" value={stats.wins} color={C.green} />
            <StatCard label="Derrotas" value={stats.losses} color="#ef4444" />
            <StatCard label="Ratio" value={`${stats.ratio}%`} color="#f59e0b" />
          </div>
        )}

        {/* Match history */}
        <div>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 14 }}>
            Historial de partidos
          </div>

          {loadingHistory ? <Spinner /> : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.textDim }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>⚽</div>
              <div>Sin partidos jugados aún</div>
            </div>
          ) : history.map(match => {
            const isP1 = match.player1?.id === profile.id
            const me = isP1 ? match.player1 : match.player2
            const opp = isP1 ? match.player2 : match.player1
            const won = match.winner_id === profile.id
            const myScore = isP1 ? match.score1 : match.score2
            const oppScore = isP1 ? match.score2 : match.score1

            return (
              <div key={match.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                background: C.panel, border: `1px solid ${won ? C.green + '30' : '#ef444430'}`,
                borderRadius: 10, marginBottom: 8,
                borderLeft: `3px solid ${won ? C.green : '#ef4444'}`,
              }}>
                <span style={{ fontSize: 18 }}>{won ? '✅' : '❌'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>
                    vs <span style={{ color: C.textDim }}>{opp?.display_name || '?'}</span>
                  </div>
                  {match.conversation?.name && (
                    <div style={{ color: C.textDim, fontSize: 10, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {match.conversation.name}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: won ? C.green : '#ef4444', fontWeight: 800, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
                    {myScore ?? '?'} — {oppScore ?? '?'}
                  </div>
                  <div style={{ color: C.textDim, fontSize: 10 }}>
                    {new Date(match.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
