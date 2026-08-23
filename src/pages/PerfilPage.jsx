import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'
import { THEMES } from '../lib/theme'
import { useTheme } from '../lib/ThemeContext'

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

// ── Preferencias Tab ─────────────────────────────────────────────────────────
const SOUND_OPTIONS = {
  message:       { label: 'Mensaje de chat',      options: ['msg-default.mp3','msg-soft.mp3','msg-electro.mp3','msg-pop.mp3'] },
  community:     { label: 'Mensaje comunidad',    options: ['comm-default.mp3','comm-soft.mp3','comm-electro.mp3'] },
  torneo:        { label: 'Mensaje torneo',       options: ['torneo-default.mp3','torneo-soft.mp3','torneo-alert.mp3'] },
  ringtone:      { label: 'Llamada entrante',     options: ['ring-default.mp3','ring-classic.mp3','ring-electro.mp3','ring-vintage.mp3'] },
  video_ringtone:{ label: 'Videollamada',         options: ['video-ring-default.mp3','video-ring-classic.mp3','video-ring-electro.mp3'] },
}

const DEFAULT_SOUNDS = { message:'msg-default.mp3', community:'comm-default.mp3', torneo:'torneo-default.mp3', ringtone:'ring-default.mp3', video_ringtone:'video-ring-default.mp3', vibration:true }

function PreferenciasTab({ profile }) {
  const { themeId, setTheme } = useTheme()
  const [sounds, setSounds] = useState(DEFAULT_SOUNDS)
  const [savingSound, setSavingSound] = useState(false)

  useEffect(() => {
    if (profile?.sound_settings) {
      setSounds({ ...DEFAULT_SOUNDS, ...profile.sound_settings })
    }
  }, [profile?.sound_settings])

  async function saveSound(key, val) {
    const updated = { ...sounds, [key]: val }
    setSounds(updated)
    setSavingSound(true)
    await supabase.from('users').update({ sound_settings: updated }).eq('id', profile.id)
    setSavingSound(false)
  }

  async function changeTheme(id) {
    setTheme(id)
    await supabase.from('users').update({ theme: id }).eq('id', profile.id)
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Temas */}
      <section>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 12 }}>🎨 Tema</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
          {Object.values(THEMES).map(t => (
            <button key={t.id} onClick={() => changeTheme(t.id)} style={{
              padding: '12px 8px', borderRadius: 12, border: `2px solid ${themeId === t.id ? t.green : C.border}`,
              background: t.bg, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              boxShadow: themeId === t.id ? `0 0 0 1px ${t.green}` : 'none',
            }}>
              <span style={{ fontSize: 22 }}>{t.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{t.label}</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {[t.bg, t.panel, t.green, t.red].map((c, i) => (
                  <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
                ))}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Sonidos */}
      <section>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
          🔊 Sonidos {savingSound && <span style={{ color: C.textDim, fontSize: 11, fontWeight: 400 }}>Guardando…</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(SOUND_OPTIONS).map(([key, cfg]) => (
            <div key={key} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ color: C.text, fontSize: 13, fontWeight: 600, flex: 1 }}>{cfg.label}</span>
              <select value={sounds[key] || cfg.options[0]} onChange={e => saveSound(key, e.target.value)}
                style={{ padding: '4px 8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 12, cursor: 'pointer', maxWidth: 180 }}>
                {cfg.options.map(o => <option key={o} value={o}>{o.replace('.mp3','').replace(/-/g,' ')}</option>)}
              </select>
            </div>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={sounds.vibration} onChange={e => saveSound('vibration', e.target.checked)} style={{ width: 16, height: 16, accentColor: C.green, cursor: 'pointer' }} />
            <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>📳 Vibración</span>
          </label>
        </div>
      </section>
    </div>
  )
}

// ── Referidos Tab ─────────────────────────────────────────────────────────────
function ReferidosTab({ profile }) {
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const code = profile?.referral_code

  useEffect(() => {
    if (!profile?.id) return
    supabase.from('referrals').select('id, status, created_at, verified_at, referred_id, users!referrals_referred_id_fkey(display_name, avatar_url)')
      .eq('referrer_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setReferrals(data || []); setLoading(false) })
  }, [profile?.id])

  function copyCode() {
    if (!code) return
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const verified = referrals.filter(r => r.status === 'verified').length

  return (
    <div style={{ padding: 16 }}>
      {/* Mi código */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <div style={{ color: C.textDim, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>TU CÓDIGO DE REFERIDO</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace', fontSize: 20, fontWeight: 900, color: C.green, letterSpacing: 4 }}>
            {code || '——'}
          </div>
          <button onClick={copyCode} style={{ padding: '10px 14px', background: copied ? C.green : C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, color: copied ? C.bg : C.text, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
        <div style={{ color: C.textDim, fontSize: 11, marginTop: 8 }}>Compartí tu código para que otros se registren en NexoTribu</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: C.text, fontSize: 22, fontWeight: 900 }}>{referrals.length}</div>
            <div style={{ color: C.textDim, fontSize: 10 }}>Total referidos</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: C.green, fontSize: 22, fontWeight: 900 }}>{verified}</div>
            <div style={{ color: C.textDim, fontSize: 10 }}>Verificados</div>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Mis referidos</div>
      {loading ? <Spinner /> : referrals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: C.textDim }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔗</div>
          <div>Aún no tenés referidos</div>
        </div>
      ) : referrals.map(r => {
        const u = r.users
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {u?.avatar_url ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{u?.display_name || 'Usuario'}</div>
              <div style={{ color: C.textDim, fontSize: 10 }}>{new Date(r.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: r.status === 'verified' ? `${C.green}20` : '#f59e0b20',
              color: r.status === 'verified' ? C.green : '#f59e0b',
            }}>
              {r.status === 'verified' ? '✓ Verificado' : 'Pendiente'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Cuenta Tab ────────────────────────────────────────────────────────────────
function CuentaTab({ profile, onGoVip }) {
  const plan = PLAN_CFG[profile?.role] || PLAN_CFG.free
  const isPro = profile?.role === 'comunidad' || profile?.role === 'ceo'

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Plan actual */}
      <div style={{ background: C.panel, border: `2px solid ${plan.color}40`, borderRadius: 14, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 28 }}>{plan.icon}</span>
          <div>
            <div style={{ color: plan.color, fontWeight: 900, fontSize: 18 }}>Plan {plan.label}</div>
            <div style={{ color: C.textDim, fontSize: 11 }}>
              {profile?.role === 'free' && 'Acceso básico — 1 torneo/día, hasta 8 jugadores'}
              {profile?.role === 'vip' && 'Acceso completo — torneos ilimitados, estadísticas avanzadas'}
              {(profile?.role === 'comunidad' || profile?.role === 'ceo') && 'Creación ilimitada — torneos, ligas, comunidades, API de bots'}
            </div>
          </div>
        </div>
        {profile?.subscription_expires_at && (
          <div style={{ color: C.textDim, fontSize: 11, marginBottom: 10 }}>
            Vence: {new Date(profile.subscription_expires_at).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {profile?.role === 'free' && (
            <button onClick={() => onGoVip?.('vip')} style={{ padding: '8px 16px', background: '#f59e0b', border: 'none', borderRadius: 8, color: '#000', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
              ⭐ Mejorar a VIP — $5/mes
            </button>
          )}
          {(profile?.role === 'free' || profile?.role === 'vip') && (
            <button onClick={() => onGoVip?.('pro')} style={{ padding: '8px 16px', background: '#8b5cf6', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
              💎 Comunidad PRO — $15/mes
            </button>
          )}
        </div>
      </div>

      {/* API de Bots (solo PRO) */}
      {isPro && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 14, marginBottom: 10 }}>🤖 API de Bots</div>
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: C.green, wordBreak: 'break-all', marginBottom: 10 }}>
            {profile?.api_token || 'nxt_' + profile?.id?.replace(/-/g,'').slice(0,24)}
          </div>
          <div style={{ color: C.textDim, fontSize: 11 }}>Usá este token para integrar bots con la API de NexoTribu</div>
        </div>
      )}

      {/* Soporte / donaciones */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 14, marginBottom: 6 }}>❤️ Apoyá el proyecto</div>
        <div style={{ color: C.textDim, fontSize: 12, marginBottom: 12 }}>Tu apoyo nos ayuda a mantener NexoTribu gratuito y en constante mejora.</div>
        <button style={{ padding: '9px 18px', background: `${C.green}20`, border: `1px solid ${C.green}40`, borderRadius: 8, color: C.green, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          💚 Hacer una donación
        </button>
      </div>
    </div>
  )
}

// ── Legal Tab ─────────────────────────────────────────────────────────────────
function LegalTab() {
  const links = [
    { label: 'Términos y Condiciones', icon: '📄' },
    { label: 'Política de Privacidad', icon: '🔒' },
    { label: 'Política de Cookies', icon: '🍪' },
    { label: 'Reglamento de Torneos', icon: '🏆' },
  ]
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {links.map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer' }}>
            <span style={{ fontSize: 18 }}>{l.icon}</span>
            <span style={{ color: C.text, fontSize: 14, fontWeight: 600, flex: 1 }}>{l.label}</span>
            <span style={{ color: C.textDim }}>›</span>
          </div>
        ))}
      </div>
      <div style={{ color: C.textDim, fontSize: 11, textAlign: 'center', marginTop: 20 }}>
        NexoTribu v1.0 · Última actualización: {new Date().toLocaleDateString('es', { month: 'long', year: 'numeric' })}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PerfilPage({ onClose }) {
  const { profile, fetchProfile } = useAuthStore()
  const [tab, setTab] = useState('perfil')
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
    const { error } = await supabase.from('users')
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
    await supabase.from('users').update({ avatar_url: publicUrl + '?v=' + Date.now() }).eq('id', profile.id)
    await fetchProfile(profile.id)
    setUploading(false)
    setToast('Foto actualizada ✓')
  }

  if (!profile) return <Spinner />

  const plan = PLAN_CFG[profile.role] || PLAN_CFG.free
  const TABS = [
    { id: 'perfil', label: 'Perfil', icon: '👤' },
    { id: 'cuenta', label: 'Cuenta', icon: '💳' },
    { id: 'preferencias', label: 'Preferencias', icon: '⚙️' },
    { id: 'referidos', label: 'Referidos', icon: '🔗' },
    { id: 'legal', label: 'Legal', icon: '📋' },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
        )}
        <span style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>Mi Perfil</span>
        <div style={{ flex: 1 }} />
        {tab === 'perfil' && (
          <button onClick={() => setEditing(e => !e)} style={{
            padding: '6px 14px', background: editing ? C.border : `${C.green}20`,
            color: editing ? C.text : C.green, border: `1px solid ${editing ? C.border : C.green + '40'}`,
            borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            {editing ? 'Cancelar' : 'Editar'}
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, minWidth: 60, padding: '9px 4px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: `2px solid ${tab === t.id ? C.green : 'transparent'}`,
            color: tab === t.id ? C.green : C.textDim,
            fontSize: 10, fontWeight: tab === t.id ? 700 : 500, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
      {tab === 'cuenta' && <CuentaTab profile={profile} />}
      {tab === 'preferencias' && <PreferenciasTab profile={profile} />}
      {tab === 'referidos' && <ReferidosTab profile={profile} />}
      {tab === 'legal' && <LegalTab />}
      {tab === 'perfil' && (
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

      )}
      </div>

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
