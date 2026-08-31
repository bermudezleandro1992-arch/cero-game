import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'
import { THEMES } from '../lib/theme'
import { useTheme } from '../lib/ThemeContext'
import { saveSoundSettings } from '../lib/sounds'
import LegalPage from './LegalPage'
import IdentityVerification from '../components/IdentityVerification'
import BotApiPage from './BotApiPage'
import { setLayoutSkin, getSkin as getSkinLocal } from '../lib/layoutSkin'

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
  superadmin:{ label: 'SuperAdmin',  color: '#00e676', icon: '⚡' },
  admin:     { label: 'Admin',      color: '#ef4444', icon: '🛡️' },
  ceo:       { label: 'CEO',        color: '#a855f7', icon: '👑' },
}

const VIP_EXCLUSIVE_THEMES = new Set(['ocean', 'purple', 'fire', 'nature'])
const VIP_PLANS = new Set(['vip', 'pro', 'superadmin', 'admin', 'ceo'])

// ── Preferencias Tab ─────────────────────────────────────────────────────────
const SOUND_OPTIONS = {
  message:       { label: 'Mensaje de chat',      options: ['msg-default.mp3','msg-soft.mp3','msg-electro.mp3','msg-pop.mp3'] },
  community:     { label: 'Mensaje comunidad',    options: ['comm-default.mp3','comm-soft.mp3','comm-electro.mp3'] },
  torneo:        { label: 'Mensaje torneo',       options: ['torneo-default.mp3','torneo-soft.mp3','torneo-alert.mp3'] },
  ringtone:      { label: 'Llamada entrante',     options: ['ring-default.mp3','ring-classic.mp3','ring-electro.mp3','ring-vintage.mp3'] },
  video_ringtone:{ label: 'Videollamada',         options: ['video-ring-default.mp3','video-ring-classic.mp3','video-ring-electro.mp3'] },
}

const DEFAULT_SOUNDS = { message:'msg-default.mp3', community:'comm-default.mp3', torneo:'torneo-default.mp3', ringtone:'ring-default.mp3', video_ringtone:'video-ring-default.mp3', vibration:true }

const UPLOAD_QUALITY_OPTIONS = [
  { id: 'default', label: 'Estándar', desc: 'Comprimida, más rápida' },
  { id: 'hd',      label: 'HD',       desc: '720p / buena calidad' },
  { id: 'fullhd',  label: 'Full HD',  desc: '1080p / alta calidad' },
  { id: '4k',      label: '4K',       desc: 'Ultra HD — más espacio' },
  { id: '8k',      label: '8K',       desc: 'Máxima calidad posible' },
]

function Toggle({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)} style={{
      width: 44, height: 26, borderRadius: 13, position: 'relative', cursor: 'pointer', flexShrink: 0,
      background: on ? C.green : C.border, transition: 'background .2s',
    }}>
      <div style={{
        position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff',
        transition: 'left .2s', left: on ? 21 : 3,
      }} />
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ color: C.textDim, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', padding: '16px 16px 6px' }}>
      {children}
    </div>
  )
}

function SettingsBlock({ children }) {
  return (
    <div style={{ background: C.panel, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
      {children}
    </div>
  )
}

function Row({ label, desc, right, onClick, noBorder }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 16px', cursor: onClick ? 'pointer' : 'default',
      borderBottom: noBorder ? 'none' : `1px solid ${C.border}22`,
      gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.text, fontSize: 14 }}>{label}</div>
        {desc && <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>{desc}</div>}
      </div>
      {right}
    </div>
  )
}

function PreferenciasTab({ profile, onGoVip }) {
  const { themeId, setTheme } = useTheme()
  const [sounds, setSounds] = useState(DEFAULT_SOUNDS)
  const [savingSound, setSavingSound] = useState(false)
  const [uploadQuality, setUploadQuality] = useState(() => localStorage.getItem('uploadQuality') || 'default')
  const [chatPrefs, setChatPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chatPrefs') || '{}') } catch { return {} }
  })

  useEffect(() => {
    if (profile?.sound_settings) setSounds({ ...DEFAULT_SOUNDS, ...profile.sound_settings })
  }, [profile?.sound_settings])

  async function saveSound(key, val) {
    const updated = { ...sounds, [key]: val }
    setSounds(updated)
    saveSoundSettings(updated)
    setSavingSound(true)
    await supabase.from('users').update({ sound_settings: updated }).eq('id', profile.id)
    setSavingSound(false)
  }

  async function changeTheme(id) {
    setTheme(id)
    await supabase.from('users').update({ theme: id }).eq('id', profile.id)
  }

  function setChatPref(key, val) {
    const updated = { ...chatPrefs, [key]: val }
    setChatPrefs(updated)
    localStorage.setItem('chatPrefs', JSON.stringify(updated))
  }

  function setQuality(id) {
    setUploadQuality(id)
    localStorage.setItem('uploadQuality', id)
  }

  const cp = chatPrefs

  return (
    <div style={{ paddingBottom: 32 }}>

      {/* ── Pantalla ── */}
      <SectionLabel>Pantalla</SectionLabel>
      <SettingsBlock>
        {/* Tema — inline selector oscuro/claro/sistema */}
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${C.border}22` }}>
          <div style={{ color: C.text, fontSize: 14, marginBottom: 10 }}>Estilo</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'system', label: 'Sistema', icon: '🖥' },
              { id: 'dark',   label: 'Oscuro',  icon: '🌙' },
            ].map(opt => {
              // map to actual theme ids
              const themeMap = { system: 'system', dark: 'dark', light: 'light' }
              const isActive = themeId === themeMap[opt.id]
              return (
                <button key={opt.id} onClick={() => changeTheme(themeMap[opt.id])} style={{
                  flex: 1, padding: '10px 6px', borderRadius: 10,
                  border: `2px solid ${isActive ? C.green : C.border}`,
                  background: isActive ? `${C.green}12` : C.panel2,
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ fontSize: 20 }}>{opt.icon}</span>
                  <span style={{ color: isActive ? C.green : C.textDim, fontSize: 11, fontWeight: isActive ? 700 : 500 }}>{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Más temas */}
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${C.border}22` }}>
          <div style={{ color: C.text, fontSize: 14, marginBottom: 10 }}>Color</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
            {Object.values(THEMES).map(t => {
              const isVipOnly = VIP_EXCLUSIVE_THEMES.has(t.id)
              const hasVip = VIP_PLANS.has(profile?.plan) || VIP_PLANS.has(profile?.role)
              const locked = isVipOnly && !hasVip
              const isActive = themeId === t.id
              return (
                <button key={t.id} onClick={() => locked ? onGoVip?.() : changeTheme(t.id)} style={{
                  padding: '10px 6px', borderRadius: 10, border: `2px solid ${isActive ? t.green : C.border}`,
                  background: t.bg, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  position: 'relative', opacity: locked ? 0.8 : 1,
                }}>
                  {locked && (
                    <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                      <span style={{ fontSize: 14 }}>⭐</span>
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#f59e0b' }}>VIP</span>
                    </div>
                  )}
                  <span style={{ fontSize: 18 }}>{t.emoji}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.text }}>{t.label}</span>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[t.bg, t.panel, t.green, t.red].map((c, i) => (
                      <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Fondo del chat */}
        <Row
          label="Fondo"
          desc={cp.chatBg ? 'Personalizado' : 'Predeterminado'}
          noBorder
          right={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {cp.chatBg && (
                <button onClick={() => setChatPref('chatBg', null)} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Quitar</button>
              )}
              <label style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, cursor: 'pointer', background: C.panel2 }}>
                Cambiar
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = ev => { setChatPref('chatBg', ev.target.result); localStorage.setItem('chatBg', ev.target.result) }
                  reader.readAsDataURL(file)
                }} />
              </label>
            </div>
          }
        />
      </SettingsBlock>

      {/* ── Ajustes de chats ── */}
      <SectionLabel>Ajustes de chats</SectionLabel>
      <SettingsBlock>
        {/* Calidad de subida */}
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${C.border}22` }}>
          <div style={{ color: C.text, fontSize: 14, marginBottom: 10 }}>Calidad de subida de archivos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {UPLOAD_QUALITY_OPTIONS.map((opt, i) => (
              <button key={opt.id} onClick={() => setQuality(opt.id)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 10,
                border: `1.5px solid ${uploadQuality === opt.id ? C.green : C.border}`,
                background: uploadQuality === opt.id ? `${C.green}10` : C.panel2,
                cursor: 'pointer', textAlign: 'left',
              }}>
                <div>
                  <span style={{ color: C.text, fontSize: 13, fontWeight: uploadQuality === opt.id ? 700 : 400 }}>{opt.label}</span>
                  <span style={{ color: C.textDim, fontSize: 11, marginLeft: 8 }}>{opt.desc}</span>
                </div>
                {uploadQuality === opt.id && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            ))}
          </div>
        </div>

        <Row label="Corrección ortográfica" desc="Revisa mientras escribís" right={<Toggle on={cp.spellcheck !== false} onChange={v => setChatPref('spellcheck', v)} />} />
        <Row label="Reemplazar texto con emojis" desc="El emoji reemplaza texto específico" right={<Toggle on={!!cp.emojiReplace} onChange={v => setChatPref('emojiReplace', v)} />} />
        <Row label="Enter para enviar" desc="Se enviará al presionar Enter" noBorder right={<Toggle on={cp.enterToSend !== false} onChange={v => setChatPref('enterToSend', v)} />} />
      </SettingsBlock>

      {/* ── Sonidos ── */}
      <SectionLabel>Sonidos</SectionLabel>
      <SettingsBlock>
        {Object.entries(SOUND_OPTIONS).map(([key, cfg], i, arr) => {
          const current = sounds[key] || cfg.options[0]
          const pretty = n => n.replace('.mp3','').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
          return (
            <div key={key} style={{ borderBottom: i < arr.length - 1 ? `1px solid ${C.border}22` : 'none', padding: '12px 16px' }}>
              <div style={{ color: C.text, fontSize: 14, marginBottom: 8 }}>{cfg.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {cfg.options.map(o => {
                  const active = current === o
                  return (
                    <button key={o} onClick={() => saveSound(key, o)} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', borderRadius: 20,
                      border: `1.5px solid ${active ? C.green : C.border}`,
                      background: active ? `${C.green}18` : C.panel2,
                      color: active ? C.green : C.textDim,
                      fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
                    }}>
                      {active && <svg width="10" height="10" viewBox="0 0 24 24" fill={C.green}><polygon points="5,3 19,12 5,21"/></svg>}
                      {pretty(o)}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        <div style={{ padding: '13px 16px' }}>
          <Row label="Vibración" noBorder right={<Toggle on={sounds.vibration !== false} onChange={v => saveSound('vibration', v)} />} />
        </div>
      </SettingsBlock>

      {/* ── Notificaciones ── */}
      <SectionLabel>Notificaciones</SectionLabel>
      <SettingsBlock>
        {[
          ['notif_messages',    'Nuevos mensajes'],
          ['notif_calls',       'Llamadas entrantes'],
          ['notif_torneos',     'Torneos en mis comunidades'],
          ['notif_resultados',  'Resultados de partidos'],
          ['notif_anuncios',    'Anuncios de CEO/Organizador'],
          ['notif_solicitudes', 'Solicitudes de unión'],
          ['notif_partidos',    'Recordatorio de próximo partido'],
        ].map(([key, label], i, arr) => (
          <Row key={key} label={label} noBorder={i === arr.length - 1}
            right={<Toggle on={sounds[key] !== false} onChange={v => saveSound(key, v)} />}
          />
        ))}
      </SettingsBlock>

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
        <div style={{ color: C.textDim, fontSize: 11, marginTop: 8 }}>Compartí tu link para que otros se registren en NexoTribu</div>
        {code && (
          <div style={{ marginTop: 10 }}>
            <div style={{ color: C.textDim, fontSize: 11, fontWeight: 600, marginBottom: 6 }}>TU LINK DE REFERIDO</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px' }}>
              <span style={{ flex: 1, fontSize: 11, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {`${window.location.origin}/?ref=${code}`}
              </span>
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?ref=${code}`).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                style={{ padding: '6px 10px', background: copied ? C.green : C.panel2, border: `1px solid ${C.border}`, borderRadius: 6, color: copied ? C.bg : C.text, fontWeight: 700, fontSize: 11, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {copied ? '✓ Copiado' : '📋 Copiar link'}
              </button>
            </div>
          </div>
        )}
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
const PLAN_LIMITS = {
  free:      { label: 'Gratis',        color: '#64748b', icon: '🆓', desc: 'Gratuito · Sin vencimiento', limits: [['🌐 Comunidades', '1'], ['👥 Miembros por comunidad', '50'], ['🏆 Torneos simultáneos', '1'], ['⚽ Jugadores por torneo', '8']] },
  vip:       { label: 'VIP',           color: '#f59e0b', icon: '⭐', desc: 'Premium · Acceso completo',   limits: [['🌐 Comunidades', '3'], ['👥 Miembros por comunidad', '200'], ['🏆 Torneos simultáneos', '3'], ['⚽ Jugadores por torneo', '64']] },
  comunidad: { label: 'Comunidad PRO', color: '#8b5cf6', icon: '🏆', desc: 'Profesional · Sin límites',  limits: [['🌐 Comunidades', 'Ilimitadas'], ['👥 Miembros', 'Según tier'], ['🏆 Torneos', 'Ilimitados'], ['⚽ Jugadores', '512+']] },
  superadmin:{ label: 'SuperAdmin',     color: '#00e676', icon: '⚡', desc: 'Dueño plataforma · Acceso total', limits: [['🌐 Comunidades', 'Ilimitadas'], ['👥 Miembros', 'Ilimitados'], ['🏆 Torneos', 'Ilimitados'], ['⚽ Jugadores', 'Ilimitados']] },
  ceo:       { label: 'CEO',           color: '#a855f7', icon: '👑', desc: 'CEO de comunidad · Acceso completo', limits: [['🌐 Comunidades', 'Ilimitadas'], ['👥 Miembros', '10.000'], ['🏆 Torneos', 'Ilimitados'], ['⚽ Jugadores', '512+']] },
}

// ── Payment data ──────────────────────────────────────────────────────────────
const PAYPAL_LINKS_PERFIL = {
  vip:         'https://www.paypal.com/ncp/payment/FPCGXDATUR7G6',
  com_starter: 'https://www.paypal.com/ncp/payment/H9W3RWW496T6L',
  com_elite:   'https://www.paypal.com/ncp/payment/MZ5MX9XK88B68',
}

const PAY_METHODS = [
  { id: 'paypal',   label: 'PayPal',                  emoji: '🅿️', desc: 'Tarjeta de crédito/débito o cuenta PayPal — USD', color: '#009CDE', direct: true },
  { id: 'ar',       label: 'Transferencia Argentina', emoji: '🇦🇷', desc: 'Próximamente', color: '#74b9ff', comingSoon: true },
  { id: 'astropay', label: 'AstroPay — LATAM',        emoji: '🌎', desc: 'Próximamente', color: '#a855f7', comingSoon: true },
  { id: 'mxn',      label: 'Pesos Mexicanos (MXN)',   emoji: '🇲🇽', desc: 'Próximamente', color: '#e17055', comingSoon: true },
  { id: 'crypto',   label: 'Crypto — USDT',           emoji: '🟡', desc: 'Próximamente', color: '#F3BA2F', comingSoon: true },
  { id: 'usd_wire', label: 'USD — Wire Transfer',     emoji: '🇺🇸', desc: 'Próximamente', color: '#00b894', comingSoon: true },
  { id: 'mp',       label: 'Mercado Pago (checkout)', emoji: '💳', desc: 'Próximamente', color: '#009EE3', comingSoon: true },
]

const AR_ACCS = [
  { label: 'AstroPay', titular: 'Leandro Bermudez', cvu: '0000177500090225090423', alias: 'somoslfa', banco: 'AstroPay' },
  { label: 'ARQ Dólar', titular: 'Leandro Bermudez', cvu: '0000069703532557685274', alias: 'neles.batazo.arq', banco: 'Garpa S.A.' },
]
const USD_WIRE_DATA = { titular: 'Leandro Bermudez', banco: 'Lead Bank', aba: '101019644', cuenta: '218096984037', tipo: 'Corriente', dir: '1801 Main St, Kansas City, MO 64108, EE.UU.', comision: '3 USD' }
const MXN_DATA = { banco: 'Arcus (ARQ Dólar)', clabe: '706969130679795077', titular: 'Leandro Bermudez', comision: 'Gratis' }
const CRYPTO_WALLETS = [
  { key: 'polygon', label: 'USDT/USDc — Polygon', addr: '0x1e53fFCd7A176A1ec293d5e34a97A81265775FcA', red: 'Polygon', comision: 'Gratis ✅' },
  { key: 'binance', label: 'Binance Pay (ID)',      addr: '359177674',                                  red: 'Binance Pay', comision: 'Gratis ✅' },
  { key: 'trc20',   label: 'USDT — TRC-20',        addr: 'TUGgg59HrePJpNmL2Kvj36CJ318cSZMRjS',        red: 'Tron', comision: '3 USDT' },
]
const ASTROPAY_COUNTRIES = [
  { id: 'co', flag: '🇨🇴', name: 'Colombia',  bank: 'Nequi / Bancolombia' },
  { id: 'cl', flag: '🇨🇱', name: 'Chile',     bank: 'Cuenta RUT / banco' },
  { id: 'br', flag: '🇧🇷', name: 'Brasil',    bank: 'PIX' },
  { id: 'uy', flag: '🇺🇾', name: 'Uruguay',   bank: 'Transferencia' },
  { id: 'pe', flag: '🇵🇪', name: 'Perú',      bank: 'Yape / Plin / banco' },
  { id: 'py', flag: '🇵🇾', name: 'Paraguay',  bank: 'Tigo Money / banco' },
]

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: C.bg, borderRadius: 8, marginBottom: 6 }}>
      <div>
        <div style={{ color: C.textDim, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
        <div style={{ color: C.text, fontSize: 12, fontFamily: 'monospace', marginTop: 2 }}>{value}</div>
      </div>
      <button onClick={() => { navigator.clipboard.writeText(value).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
        style={{ padding: '4px 10px', background: copied ? C.green : C.panel2, border: `1px solid ${C.border}`, borderRadius: 6, color: copied ? '#000' : C.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}>
        {copied ? '✓' : 'Copiar'}
      </button>
    </div>
  )
}

function PaymentFlow({ plan, onBack, profile, onGoIdentidad, onPlanActivated, isSuperAdmin }) {
  const [method, setMethod] = useState(null)
  const [latam, setLatam] = useState(null)
  const [paypalPaid, setPaypalPaid] = useState(false)
  const [txId, setTxId] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState(null)
  const [activated, setActivated] = useState(null)
  const isVerified = profile?.is_verified

  // Gate: si no está verificado, pedir verificación primero
  if (!isVerified) return (
    <div style={{ padding: 16 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, padding: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Volver
      </button>
      <div style={{ background: 'linear-gradient(135deg, #0a1a0a, #050f05)', border: `1.5px solid ${C.green}44`, borderRadius: 18, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🪪</div>
        <div style={{ color: C.text, fontWeight: 900, fontSize: 17, marginBottom: 8 }}>Verificá tu identidad primero</div>
        <div style={{ color: C.textDim, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
          Para activar el plan <strong style={{ color: plan.color }}>{plan.label}</strong> necesitás verificar tu identidad. Esto protege a todos los miembros y permite torneos con premios en dinero.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, textAlign: 'left' }}>
          {['Plan VIP', 'Comunidades PRO', 'Torneos con premios en dinero'].map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.text, fontSize: 13 }}>
              <span style={{ color: C.green }}>✓</span> {item}
            </div>
          ))}
        </div>
        <button onClick={onGoIdentidad} style={{
          width: '100%', padding: '13px', background: C.green, color: '#000',
          border: 'none', borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: 'pointer',
        }}>
          🪪 Verificar mi identidad
        </button>
        <div style={{ color: C.textDim, fontSize: 11, marginTop: 10 }}>Rápido y seguro · Una sola vez</div>
      </div>
    </div>
  )

  async function verifyPaypal() {
    if (!txId.trim()) return
    setVerifying(true)
    setVerifyError(null)
    try {
      const { data, error } = await supabase.functions.invoke('verify-paypal', {
        body: { planKey: plan.key, transactionId: txId.trim() },
      })
      if (error || !data?.ok) {
        setVerifyError(data?.error || 'Error al verificar. Intentá de nuevo.')
      } else {
        setActivated(data)
        if (onPlanActivated) onPlanActivated()
      }
    } catch (e) {
      setVerifyError('Error de conexión. Intentá de nuevo.')
    }
    setVerifying(false)
  }

  function handleMethod(m) {
    if (m.disabled) return
    if (m.direct) {
      window.open(PAYPAL_LINKS_PERFIL[plan.paypalKey], '_blank')
      setPaypalPaid(true)
      return
    }
    setMethod(m)
  }

  if (method && method.id === 'ar') return (
    <div style={{ padding: 16 }}>
      <button onClick={() => setMethod(null)} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Volver
      </button>
      <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 14 }}>🇦🇷 Transferencia Argentina</div>
      {AR_ACCS.map(acc => (
        <div key={acc.label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ color: C.green, fontWeight: 800, fontSize: 13, marginBottom: 10 }}>{acc.banco} · {acc.label}</div>
          <CopyRow label="Titular" value={acc.titular} />
          <CopyRow label="CVU" value={acc.cvu} />
          <CopyRow label="Alias" value={acc.alias} />
        </div>
      ))}
      <div style={{ color: C.textDim, fontSize: 11, marginTop: 8 }}>Luego de transferir, enviá el comprobante a soporte para activar tu plan.</div>
    </div>
  )

  if (method && method.id === 'astropay') {
    if (!latam) return (
      <div style={{ padding: 16 }}>
        <button onClick={() => setMethod(null)} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Volver
        </button>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 14 }}>🌎 Elegí tu país</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ASTROPAY_COUNTRIES.map(c => (
            <button key={c.id} onClick={() => setLatam(c)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 22 }}>{c.flag}</span>
              <div>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                <div style={{ color: C.textDim, fontSize: 11 }}>{c.bank}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
    return (
      <div style={{ padding: 16 }}>
        <button onClick={() => setLatam(null)} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Volver
        </button>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 14 }}>{latam.flag} {latam.name} — {latam.bank}</div>
        {AR_ACCS.map(acc => (
          <div key={acc.label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ color: '#a855f7', fontWeight: 800, fontSize: 13, marginBottom: 10 }}>{acc.banco} · {acc.label}</div>
            <CopyRow label="Titular" value={acc.titular} />
            <CopyRow label="CVU/Alias" value={acc.alias} />
          </div>
        ))}
        <div style={{ color: C.textDim, fontSize: 11, marginTop: 8 }}>Enviá comprobante a soporte para activar tu plan.</div>
      </div>
    )
  }

  if (method && method.id === 'mxn') return (
    <div style={{ padding: 16 }}>
      <button onClick={() => setMethod(null)} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Volver
      </button>
      <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 14 }}>🇲🇽 Pesos Mexicanos (MXN)</div>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
        <CopyRow label="Banco" value={MXN_DATA.banco} />
        <CopyRow label="CLABE" value={MXN_DATA.clabe} />
        <CopyRow label="Titular" value={MXN_DATA.titular} />
      </div>
      <div style={{ color: C.textDim, fontSize: 11, marginTop: 8 }}>Comisión: {MXN_DATA.comision}. Enviá comprobante a soporte para activar.</div>
    </div>
  )

  if (method && method.id === 'usd_wire') return (
    <div style={{ padding: 16 }}>
      <button onClick={() => setMethod(null)} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Volver
      </button>
      <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 14 }}>🇺🇸 USD — Wire Transfer</div>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
        <CopyRow label="Titular" value={USD_WIRE_DATA.titular} />
        <CopyRow label="Banco" value={USD_WIRE_DATA.banco} />
        <CopyRow label="ABA Routing" value={USD_WIRE_DATA.aba} />
        <CopyRow label="Cuenta" value={USD_WIRE_DATA.cuenta} />
        <CopyRow label="Tipo" value={USD_WIRE_DATA.tipo} />
        <CopyRow label="Dirección" value={USD_WIRE_DATA.dir} />
      </div>
      <div style={{ color: C.textDim, fontSize: 11, marginTop: 8 }}>Comisión estimada: {USD_WIRE_DATA.comision}. Enviá comprobante a soporte.</div>
    </div>
  )

  if (method && method.id === 'crypto') return (
    <div style={{ padding: 16 }}>
      <button onClick={() => setMethod(null)} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Volver
      </button>
      <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 14 }}>🟡 Crypto — USDT/USDc</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CRYPTO_WALLETS.map(w => (
          <div key={w.key} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{w.label}</span>
              <span style={{ fontSize: 11, color: w.comision.includes('Gratis') ? C.green : '#ef4444' }}>{w.comision}</span>
            </div>
            <CopyRow label={`Red: ${w.red}`} value={w.addr} />
          </div>
        ))}
      </div>
      <div style={{ color: C.textDim, fontSize: 11, marginTop: 8 }}>Enviá comprobante o TX ID a soporte para activar tu plan.</div>
    </div>
  )

  // Plan activated success screen
  if (activated) return (
    <div style={{ padding: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #001a00, #000f00)', border: `1.5px solid ${C.green}55`, borderRadius: 20, padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
        <div style={{ color: C.green, fontWeight: 900, fontSize: 20, marginBottom: 6 }}>¡Plan activado!</div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{plan.icon} {activated.planLabel}</div>
        <div style={{ color: C.textDim, fontSize: 12, marginBottom: 20 }}>
          Válido hasta: {new Date(activated.expiresAt).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, textAlign: 'left' }}>
          {plan.features?.filter(f => f.ok).slice(0, 4).map(f => (
            <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.text, fontSize: 13 }}>
              <span style={{ color: C.green, flexShrink: 0 }}>✓</span> {f.text}
            </div>
          ))}
        </div>
        <button onClick={onBack} style={{ width: '100%', padding: '13px', background: C.green, color: '#000', border: 'none', borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
          ¡Entendido!
        </button>
      </div>
    </div>
  )

  // PayPal "ya pagué" verification screen
  if (paypalPaid) return (
    <div style={{ padding: 16 }}>
      <button onClick={() => setPaypalPaid(false)} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, padding: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Volver
      </button>
      <div style={{ background: C.panel, border: `1.5px solid #009CDE44`, borderRadius: 18, padding: 22 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🅿️</div>
          <div style={{ color: C.text, fontWeight: 900, fontSize: 16 }}>¿Ya realizaste el pago?</div>
          <div style={{ color: C.textDim, fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
            Ingresá el <strong style={{ color: C.text }}>ID de transacción</strong> de PayPal para activar tu plan automáticamente.
          </div>
          <div style={{ color: C.textDim, fontSize: 11, marginTop: 6 }}>
            Lo encontrás en el email de confirmación de PayPal o en Actividad → detalles de la transacción.
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: C.textDim, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>ID de transacción PayPal</div>
          <input
            value={txId}
            onChange={e => { setTxId(e.target.value); setVerifyError(null) }}
            placeholder="Ej: 5HC96843KS2207541"
            style={{ width: '100%', padding: '12px 14px', background: C.bg, border: `1.5px solid ${verifyError ? '#ef4444' : C.border}`, borderRadius: 10, color: C.text, fontSize: 14, fontFamily: 'monospace', boxSizing: 'border-box', letterSpacing: 1 }}
          />
          {verifyError && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{verifyError}</div>}
        </div>
        <button
          onClick={verifyPaypal}
          disabled={verifying || !txId.trim()}
          style={{ width: '100%', padding: '13px', background: txId.trim() ? '#009CDE' : C.border, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: txId.trim() ? 'pointer' : 'not-allowed', opacity: verifying ? 0.7 : 1 }}
        >
          {verifying ? '⏳ Verificando...' : '✓ Verificar y activar plan'}
        </button>
        <div style={{ color: C.textDim, fontSize: 11, marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
          La verificación es automática e instantánea. Si hay algún problema, contactá a soporte.
        </div>
        <div style={{ marginTop: 14, padding: '10px 12px', background: `${C.green}0a`, border: `1px solid ${C.green}20`, borderRadius: 10 }}>
          <div style={{ color: C.textDim, fontSize: 11 }}>¿No realizaste el pago todavía?</div>
          <button onClick={() => { window.open(PAYPAL_LINKS_PERFIL[plan.paypalKey], '_blank') }} style={{ background: 'none', border: 'none', color: '#009CDE', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: '4px 0 0', display: 'block' }}>
            🅿️ Abrir PayPal nuevamente →
          </button>
        </div>
      </div>
    </div>
  )

  // Method selector
  return (
    <div style={{ padding: 16 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Volver a planes
      </button>

      {/* Plan summary */}
      <div style={{ background: plan.bg || C.panel, border: `1.5px solid ${plan.color}55`, borderRadius: 14, padding: '14px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 28 }}>{plan.icon}</span>
        <div>
          <div style={{ color: plan.color, fontWeight: 900, fontSize: 16 }}>{plan.label}</div>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 18 }}>{plan.price} <span style={{ fontSize: 12, color: C.textDim, fontWeight: 400 }}>por mes</span></div>
        </div>
      </div>

      <div style={{ color: C.textDim, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Método de pago</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PAY_METHODS.filter(m => !m.comingSoon || isSuperAdmin).map(m => (
          <button key={m.id} onClick={() => handleMethod(m)} disabled={m.comingSoon} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px',
            background: C.panel, border: `1px solid ${m.comingSoon ? C.border : C.border}`, borderRadius: 12,
            cursor: m.comingSoon ? 'default' : 'pointer', textAlign: 'left', width: '100%',
            opacity: m.comingSoon ? 0.45 : 1,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${m.color}20`, border: `1px solid ${m.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{m.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{m.label}</div>
              <div style={{ color: C.textDim, fontSize: 11, marginTop: 1 }}>{m.desc}</div>
            </div>
            {m.comingSoon
              ? <span style={{ fontSize: 9, fontWeight: 800, color: C.textDim, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 6px', flexShrink: 0 }}>PRONTO</span>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            }
          </button>
        ))}
      </div>
      <div style={{ marginTop: 16, padding: '10px 12px', background: `${C.green}0a`, border: `1px solid ${C.green}20`, borderRadius: 10, color: C.textDim, fontSize: 11 }}>
        🔒 Pago 100% seguro. PayPal: procesado por PayPal, nunca guardamos tu tarjeta. Transferencias y crypto: verificación manual en menos de 24hs.
      </div>
    </div>
  )
}

const PLANES = [
  {
    key: 'free', icon: '🆓', label: 'Free', price: 'Gratis', priceDesc: 'Para siempre',
    color: '#64748b', bg: 'transparent', border: '#64748b44',
    features: [
      { text: 'Mensajes 1 a 1 ilimitados', ok: true },
      { text: '1 comunidad propia (hasta 50 miembros)', ok: true },
      { text: '1 torneo simultáneo', ok: true },
      { text: 'Llamadas de audio y video', ok: true },
      { text: 'Estadísticas avanzadas', ok: false },
      { text: 'Torneos con premios en dinero', ok: false },
      { text: 'Bots personalizados', ok: false },
    ],
    cta: null,
  },
  {
    key: 'vip', icon: '⭐', label: 'VIP', price: 'US$3.99', priceDesc: 'por mes',
    color: '#f59e0b', bg: 'linear-gradient(160deg, #1a1200 0%, #0f0800 100%)', border: '#f59e0b55',
    paypalKey: 'vip',
    features: [
      { text: 'Todo lo del plan Gratis', ok: true },
      { text: 'Hasta 3 comunidades (200 miembros c/u)', ok: true },
      { text: 'Hasta 3 torneos simultáneos', ok: true },
      { text: 'Estadísticas avanzadas de perfil', ok: true },
      { text: 'Torneos con premios en dinero 💰', ok: true },
      { text: 'Badge VIP ⭐ en tu perfil', ok: true },
      { text: 'Ranking global 🏅', ok: true },
      { text: 'Soporte prioritario 24/7', ok: true },
    ],
    cta: '⭐ Activar VIP',
    highlight: false,
  },
  {
    key: 'com_starter', icon: '🏆', label: 'PRO Starter', price: 'US$15.99', priceDesc: 'por mes · pagado por el CEO',
    color: '#8b5cf6', bg: 'linear-gradient(160deg, #0d0a1a 0%, #080510 100%)', border: '#8b5cf655',
    paypalKey: 'com_starter',
    features: [
      { text: 'Hasta 1.000 miembros (entran GRATIS)', ok: true },
      { text: 'Torneos y ligas ilimitados con premios', ok: true },
      { text: 'Panel CEO completo 🎛️', ok: true },
      { text: 'Bot propio para torneos automáticos', ok: true },
      { text: 'Roles avanzados (CEO, Org, Mod)', ok: true },
      { text: 'Estadísticas en tiempo real', ok: true },
      { text: 'Todo lo del VIP incluido', ok: true },
    ],
    cta: '🏆 Activar PRO Starter',
    highlight: false,
  },
  {
    key: 'com_elite', icon: '💎', label: 'PRO Elite', price: 'US$29.99', priceDesc: 'por mes · pagado por el CEO',
    color: '#6366f1', bg: 'linear-gradient(160deg, #0a0a1a 0%, #050510 100%)', border: '#6366f155',
    paypalKey: 'com_elite',
    features: [
      { text: 'Miembros ilimitados (entran GRATIS)', ok: true },
      { text: 'Todo lo del PRO Starter', ok: true },
      { text: 'Sorteos en vivo 🎰', ok: true },
      { text: 'API completa para bots', ok: true },
      { text: 'Badge especial 💎 en tu perfil', ok: true },
      { text: 'Acceso anticipado a novedades', ok: true },
    ],
    cta: '💎 Activar PRO Elite',
    highlight: true,
  },
]

function PlanesSection({ role, profile, onGoIdentidad, onPlanActivated }) {
  const [payPlan, setPayPlan] = useState(null)
  const isSuperAdmin = profile?.role === 'superadmin'

  if (payPlan) return <PaymentFlow plan={payPlan} onBack={() => setPayPlan(null)} profile={profile} onGoIdentidad={onGoIdentidad} onPlanActivated={onPlanActivated} isSuperAdmin={isSuperAdmin} />

  const roleToKey = { vip: 'vip', comunidad: 'com_elite', superadmin: 'com_elite', admin: 'com_elite', ceo: 'com_starter' }
  const currentKey = roleToKey[role] || 'free'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <span style={{ fontSize: 10, fontWeight: 800, color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase' }}>Planes disponibles</span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PLANES.map(p => {
          const isCurrent = p.key === currentKey
          return (
            <div key={p.key} style={{
              background: p.bg || C.panel,
              border: `1.5px solid ${isCurrent ? p.color : p.border}`,
              borderRadius: 18, overflow: 'hidden', position: 'relative',
            }}>
              {p.highlight && !isCurrent && (
                <div style={{ background: p.color, padding: '4px 0', textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: 1 }}>MÁS POPULAR</div>
              )}
              {isCurrent && (
                <div style={{ background: `${p.color}22`, padding: '4px 0', textAlign: 'center', fontSize: 10, fontWeight: 800, color: p.color, letterSpacing: 1 }}>TU PLAN ACTUAL</div>
              )}
              <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${p.color}22`, border: `1px solid ${p.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{p.icon}</div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 900, fontSize: 15, color: p.color }}>{p.label}</p>
                      <p style={{ margin: 0, fontSize: 10, color: C.textDim }}>{p.priceDesc}</p>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontWeight: 900, fontSize: 18, color: p.key === 'free' ? C.textDim : p.color }}>{p.price}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: p.cta && !isCurrent ? 14 : 0 }}>
                  {p.features.map(f => (
                    <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: f.ok ? p.color : '#ffffff22', flexShrink: 0 }}>{f.ok ? '✓' : '✗'}</span>
                      <span style={{ fontSize: 12, color: f.ok ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)' }}>{f.text}</span>
                    </div>
                  ))}
                </div>
                {p.cta && !isCurrent && (
                  <button onClick={() => setPayPlan(p)} style={{
                    width: '100%', padding: '11px', border: 'none', borderRadius: 10,
                    background: p.color, color: '#fff',
                    fontWeight: 900, fontSize: 13, cursor: 'pointer', marginTop: 4,
                  }}>
                    {p.cta}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CuentaTab({ profile, onGoVip, onGoBots, onGoIdentidad, onPlanActivated }) {
  const role = profile?.role || 'free'
  const plan = PLAN_CFG[role] || PLAN_CFG.free
  const limits = PLAN_LIMITS[role] || PLAN_LIMITS.free
  const isPro = role === 'comunidad' || role === 'ceo' || role === 'vip' || role === 'superadmin' || role === 'admin'

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Mi Suscripción */}
      <div style={{ background: C.panel, border: `2px solid ${plan.color}40`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ background: `${plan.color}18`, padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: `${plan.color}22`, border: `2px solid ${plan.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{plan.icon}</div>
          <div>
            <div style={{ color: plan.color, fontWeight: 900, fontSize: 20 }}>{limits.label}</div>
            <div style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{limits.desc}</div>
          </div>
        </div>
        {profile?.subscription_expires_at && (
          <div style={{ padding: '8px 16px', background: C.panel2, fontSize: 11, color: C.textDim, borderBottom: `1px solid ${C.border}` }}>
            📅 Vence: {new Date(profile.subscription_expires_at).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        )}
        <div style={{ padding: 14 }}>
          <div style={{ color: C.textDim, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>Límites incluidos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {limits.limits.map(([label, val]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: C.text, fontSize: 13 }}>{label}</span>
                <span style={{ color: plan.color, fontWeight: 800, fontSize: 13 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sección Planes */}
      <PlanesSection role={role} profile={profile} onGoIdentidad={onGoIdentidad} onPlanActivated={onPlanActivated} />

      {/* API de Bots — row */}
      {isPro && (
        <button onClick={onGoBots} style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
          cursor: 'pointer', textAlign: 'left', width: '100%',
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${C.green}18`, border: `1px solid ${C.green}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🤖</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>API de Bots</div>
            <div style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>Conectá plataformas externas y bots</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      )}

      {/* Apoyá el proyecto */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1a0d 0%, #080f08 100%)',
        border: `1.5px solid ${C.green}33`, borderRadius: 16, padding: 18, overflow: 'hidden', position: 'relative',
      }}>
        {/* Glow decorativo */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: `${C.green}08`, pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${C.green}18`, border: `1px solid ${C.green}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>❤️</div>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: C.text }}>Apoyá el proyecto</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textDim }}>Nos ayudás a seguir creciendo</p>
          </div>
        </div>

        <p style={{ margin: '0 0 14px', color: C.textDim, fontSize: 12, lineHeight: 1.6 }}>
          NexoTribu es gratis y siempre lo será. Si querés apoyar el proyecto, cualquier monto ayuda muchísimo. ¡Gracias! 🙌
        </p>

        {/* Botón principal PayPal */}
        <a
          href="https://www.paypal.com/ncp/payment/JF3S2VLK75MZS"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '13px 0', borderRadius: 12, boxSizing: 'border-box',
            background: '#0070ba', textDecoration: 'none',
            boxShadow: '0 4px 16px #0070ba44',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.59 3.025-2.566 6.643-8.944 6.643H9.441c-.11 0-.22.01-.328.025L7.698 21.34h4.007l.985-6.275c.083-.518.527-.9 1.051-.9h2.19c4.298 0 7.664-1.748 8.647-6.797.263-1.347.163-2.478-.356-3.45z"/>
          </svg>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Donar con PayPal</span>
        </a>

        <p style={{ margin: '10px 0 0', fontSize: 10, color: C.textDim, textAlign: 'center' }}>
          Seguro · Sin cuenta requerida · Tarjeta o saldo PayPal
        </p>
      </div>
    </div>
  )
}

// ── Legal Tab ─────────────────────────────────────────────────────────────────
function LegalTab() {
  return <LegalPage />
}

// ── Settings item row ─────────────────────────────────────────────────────────
function SettingsRow({ icon, label, desc, onClick, danger, value, noArrow }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 20px', background: 'none', border: 'none', cursor: onClick ? 'pointer' : 'default',
      textAlign: 'left', transition: 'background .12s',
    }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = `${C.border}44` }}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <div style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: danger ? '#ef4444' : C.text, fontWeight: 600, fontSize: 14 }}>{label}</div>
        {desc && <div style={{ color: C.textDim, fontSize: 12, marginTop: 1 }}>{desc}</div>}
      </div>
      {value && <span style={{ color: C.textDim, fontSize: 13, marginRight: 4 }}>{value}</span>}
      {!noArrow && onClick && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      )}
    </button>
  )
}

// ── Contact Picker Sheet ──────────────────────────────────────────────────────
function ContactPickerSheet({ mode, selectedIds, onConfirm, onClose }) {
  const { profile } = useAuthStore()
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState(new Set(selectedIds || []))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Get DM conversations and extract the other participant
      const { data } = await supabase
        .from('conversation_members')
        .select('conversation_id, conversations!inner(id, is_group), user_id')
        .eq('conversations.is_group', false)
      if (!data) { setLoading(false); return }
      const convIds = [...new Set(data.filter(r => r.user_id === profile?.id).map(r => r.conversation_id))]
      if (!convIds.length) { setLoading(false); return }
      const otherUserIds = [...new Set(
        data.filter(r => convIds.includes(r.conversation_id) && r.user_id !== profile?.id).map(r => r.user_id)
      )]
      if (!otherUserIds.length) { setLoading(false); return }
      const { data: users } = await supabase.from('users').select('id, display_name, avatar_url').in('id', otherUserIds)
      setContacts(users || [])
      setLoading(false)
    }
    load()
  }, [profile?.id])

  const filtered = contacts.filter(c => c.display_name?.toLowerCase().includes(search.toLowerCase()))
  const title = mode === 'except' ? 'Mis contactos, excepto…' : 'Solo compartir con…'
  const countLabel = mode === 'except'
    ? `${picked.size} contacto${picked.size !== 1 ? 's' : ''} excluido${picked.size !== 1 ? 's' : ''}`
    : `${picked.size} contacto${picked.size !== 1 ? 's' : ''} seleccionado${picked.size !== 1 ? 's' : ''}`

  function toggle(id) {
    setPicked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden', maxWidth: '100vw' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text, padding: 4, display: 'flex' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 17, color: C.text }}>{title}</div>
        <button onClick={() => onConfirm([...picked])} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          width: 32, height: 32, borderRadius: '50%',
          background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </button>
      </div>
      {/* Search */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.panel2, borderRadius: 24, padding: '8px 14px', border: `1px solid ${C.border}` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar un nombre o número"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 14 }} autoFocus />
        </div>
      </div>
      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={{ padding: 32, textAlign: 'center', color: C.textDim }}>Cargando contactos…</div>}
        {!loading && filtered.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: C.textDim }}>No hay contactos</div>}
        {!loading && filtered.length > 0 && (
          <>
            <div style={{ padding: '8px 16px 4px', color: C.textDim, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Contactos</div>
            {filtered.map(c => {
              const sel = picked.has(c.id)
              return (
                <button key={c.id} onClick={() => toggle(c.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
                  borderBottom: `1px solid ${C.border}22`,
                }}>
                  {c.avatar_url
                    ? <img src={c.avatar_url} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{c.display_name?.slice(0,2).toUpperCase() || '?'}</div>
                  }
                  <div style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: 500 }}>{c.display_name}</div>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, border: `2px solid ${sel ? C.green : C.textDim}`,
                    background: sel ? C.green : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {sel && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                  </div>
                </button>
              )
            })}
          </>
        )}
      </div>
      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ color: C.textDim, fontSize: 13 }}>{countLabel}</span>
        <button onClick={() => onConfirm([...picked])} style={{
          background: C.green, border: 'none', borderRadius: '50%', width: 48, height: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </button>
      </div>
    </div>,
    document.body
  )
}

// ── Privacidad Tab ────────────────────────────────────────────────────────────
const VIP_ROLES = new Set(['vip','ceo','com_starter','com_elite','superadmin','admin','organizador'])

function PrivacidadTab({ profile }) {
  const [priv, setPriv] = useState(() => {
    try { return JSON.parse(localStorage.getItem('privacySettings') || '{}') } catch { return {} }
  })
  const [pickerMode, setPickerMode] = useState(null) // 'except' | 'only' | null

  async function save(key, val) {
    const updated = { ...priv, [key]: val }
    setPriv(updated)
    localStorage.setItem('privacySettings', JSON.stringify(updated))
    // Persist to DB for settings that have a column
    if (key === 'showLastSeen') {
      await supabase.from('users').update({ show_last_seen: val }).eq('id', profile.id)
    }
    if (key === 'estadoPrivacy') {
      try { localStorage.setItem('estado_privacy', val) } catch {}
    }
  }

  const isVip = VIP_ROLES.has(profile?.role) || VIP_PLANS.has(profile?.plan)

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 32 }}>

      <SectionLabel>Mensajes</SectionLabel>
      <SettingsBlock>
        <Row label="Confirmaciones de lectura" desc="Mostrar doble tilde azul al leer" right={<Toggle on={priv.readReceipts !== false} onChange={v => save('readReceipts', v)} />} />
        <div style={{ padding: '13px 16px' }}>
          <div style={{ color: C.text, fontSize: 14, marginBottom: 2 }}>Mensajes temporales</div>
          <div style={{ color: C.textDim, fontSize: 12, marginBottom: 10 }}>Los mensajes se borran automáticamente</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              { v: 'off', label: 'Desactivado' },
              { v: '24h', label: '24 horas' },
              { v: '7d',  label: '7 días' },
              { v: '30d', label: '30 días' },
              { v: '90d', label: '90 días' },
            ].map(opt => {
              const active = (priv.tempMessages || 'off') === opt.v
              return (
                <button key={opt.v} onClick={() => save('tempMessages', opt.v)} style={{
                  padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${active ? C.green : C.border}`,
                  background: active ? `${C.green}18` : C.panel2, color: active ? C.green : C.textDim,
                  fontWeight: active ? 700 : 500, fontSize: 12, cursor: 'pointer',
                }}>{opt.label}</button>
              )
            })}
          </div>
        </div>
      </SettingsBlock>

      <SectionLabel>Perfil</SectionLabel>
      <SettingsBlock>
        <Row label="Hora de última vez" desc="Mostrar cuándo fue tu última conexión" right={<Toggle on={priv.showLastSeen !== false} onChange={v => save('showLastSeen', v)} />} />
        <Row label="En línea" desc="Mostrar cuando estás conectado" noBorder right={<Toggle on={priv.showOnline !== false} onChange={v => save('showOnline', v)} />} />
      </SettingsBlock>

      <SectionLabel>Estados</SectionLabel>
      <SettingsBlock>
        {[
          { id: 'contacts', label: 'Mis contactos', desc: 'Se comparte con todos tus contactos' },
          { id: 'except',   label: 'Mis contactos, excepto…', desc: 'Comparte con tus contactos, excepto los seleccionados' },
          { id: 'only',     label: 'Solo compartir con…', desc: 'Solo comparte con los contactos seleccionados' },
        ].map((opt, i, arr) => {
          const selected = (priv.estadoPrivacy || 'contacts') === opt.id
          const hasPicker = opt.id === 'except' || opt.id === 'only'
          const count = (priv[`estado_${opt.id}_ids`] || []).length
          return (
            <button key={opt.id} onClick={() => {
              save('estadoPrivacy', opt.id)
              if (hasPicker) setPickerMode(opt.id)
            }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 16,
              padding: '13px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
              borderBottom: i < arr.length - 1 ? `1px solid ${C.border}22` : 'none',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${selected ? C.green : C.textDim}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selected && <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.green }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontSize: 14 }}>{opt.label}</div>
                <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>
                  {hasPicker && count > 0 ? `${count} contacto${count !== 1 ? 's' : ''}` : opt.desc}
                </div>
              </div>
              {hasPicker && selected && (
                <span onClick={e => { e.stopPropagation(); setPickerMode(opt.id) }} style={{
                  fontSize: 11, color: C.green, fontWeight: 700, padding: '4px 10px',
                  border: `1px solid ${C.green}40`, borderRadius: 12,
                }}>Editar</span>
              )}
            </button>
          )
        })}
      </SettingsBlock>

      {pickerMode && (
        <ContactPickerSheet
          mode={pickerMode}
          selectedIds={priv[`estado_${pickerMode}_ids`] || []}
          onConfirm={ids => {
            save(`estado_${pickerMode}_ids`, ids)
            setPickerMode(null)
          }}
          onClose={() => setPickerMode(null)}
        />
      )}

      {isVip && (
        <>
          <SectionLabel>VIP — Mensajes borrados</SectionLabel>
          <SettingsBlock>
            <Row label="Ver mensajes eliminados" desc="Podés ver el contenido de mensajes borrados por otros (no de SuperAdmin)" noBorder right={<Toggle on={priv.seeDeleted !== false} onChange={v => save('seeDeleted', v)} />} />
          </SettingsBlock>
        </>
      )}

      <SectionLabel>Opciones avanzadas</SectionLabel>
      <SettingsBlock>
        <Row label="Bloquear mensajes desconocidos" desc="Oculta mensajes en grupos de usuarios con quienes no tenés un chat directo"
          right={<Toggle on={!!priv.blockUnknown} onChange={v => save('blockUnknown', v)} />} />
        <Row label="Proteger IP en llamadas" desc="Las llamadas se enrutan vía servidores NexoTribu · Próximamente"
          right={<Toggle on={!!priv.protectIp} onChange={v => save('protectIp', v)} />} />
        <Row label="Desactivar vista previa de links" desc="No se generarán vistas previas de URLs en tus chats" noBorder
          right={<Toggle on={!!priv.noLinkPreview} onChange={v => save('noLinkPreview', v)} />} />
      </SettingsBlock>

    </div>
  )
}

// ── Notificaciones Tab ────────────────────────────────────────────────────────
function NotificacionesTab({ profile }) {
  const [notif, setNotif] = useState(() => {
    try { return JSON.parse(localStorage.getItem('notifSettings') || '{}') } catch { return {} }
  })

  function save(key, val) {
    const updated = { ...notif, [key]: val }
    setNotif(updated)
    localStorage.setItem('notifSettings', JSON.stringify(updated))
  }

  const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted'

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 32 }}>

      {!granted && (
        <div style={{ margin: 16, background: '#f59e0b14', border: `1px solid #f59e0b40`, borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>⚠️ Notificaciones del sistema</div>
          <div style={{ color: C.textDim, fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>Las notificaciones están desactivadas en tu navegador. Activálas para recibir alertas.</div>
          <button onClick={() => { if (typeof Notification !== 'undefined') Notification.requestPermission().then(() => window.location.reload()) }} style={{ padding: '7px 14px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Activar notificaciones
          </button>
        </div>
      )}

      <SectionLabel>General</SectionLabel>
      <SettingsBlock>
        <Row label="No molestar" desc="Las notificaciones van directo al centro de notificaciones" right={<Toggle on={!!notif.doNotDisturb} onChange={v => save('doNotDisturb', v)} />} />
        <Row label="Mostrar vista previa" desc="Muestra el texto del mensaje en la notificación" noBorder right={<Toggle on={notif.showPreview !== false} onChange={v => save('showPreview', v)} />} />
      </SettingsBlock>

      <SectionLabel>Por tipo</SectionLabel>
      <SettingsBlock>
        {[
          ['notif_messages', 'Mensajes', 'Chats directos y grupos'],
          ['notif_groups',   'Grupos',   'Actividad en grupos y comunidades'],
          ['notif_estados',  'Estados',  'Cuando alguien publica un estado'],
          ['notif_calls',    'Llamadas', 'Llamadas entrantes de audio y video'],
        ].map(([key, label, desc], i, arr) => (
          <Row key={key} label={label} desc={desc} noBorder={i === arr.length - 1}
            right={<Toggle on={notif[key] !== false} onChange={v => save(key, v)} />}
          />
        ))}
      </SettingsBlock>

      <SectionLabel>Comunidades y torneos</SectionLabel>
      <SettingsBlock>
        {[
          ['notif_torneos',     'Torneos en mis comunidades', null],
          ['notif_resultados',  'Resultados de partidos', null],
          ['notif_anuncios',    'Anuncios de CEO/Organizador', null],
          ['notif_solicitudes', 'Solicitudes de unión', 'Solo para admins'],
          ['notif_partidos',    'Recordatorio de partido', 'Aviso antes de tu próximo partido'],
        ].map(([key, label, desc], i, arr) => (
          <Row key={key} label={label} desc={desc} noBorder={i === arr.length - 1}
            right={<Toggle on={notif[key] !== false} onChange={v => save(key, v)} />}
          />
        ))}
      </SettingsBlock>

    </div>
  )
}

// ── Video y Voz Tab ───────────────────────────────────────────────────────────
function VideoVozTab() {
  const [devices, setDevices] = useState({ cameras: [], mics: [], speakers: [] })
  const [permGranted, setPermGranted] = useState(false)
  const [sel, setSel] = useState(() => {
    try { return JSON.parse(localStorage.getItem('avDevices') || '{}') } catch { return {} }
  })

  async function loadDevices() {
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      const hasLabels = list.some(d => d.label)
      if (!hasLabels) return false
      setDevices({
        cameras:  list.filter(d => d.kind === 'videoinput'),
        mics:     list.filter(d => d.kind === 'audioinput'),
        speakers: list.filter(d => d.kind === 'audiooutput'),
      })
      setPermGranted(true)
      return true
    } catch { return false }
  }

  async function requestPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      stream.getTracks().forEach(t => t.stop())
      await loadDevices()
    } catch {
      try {
        const s2 = await navigator.mediaDevices.getUserMedia({ audio: true })
        s2.getTracks().forEach(t => t.stop())
        await loadDevices()
      } catch {}
    }
  }

  useEffect(() => { loadDevices() }, [])

  function pick(key, val) {
    const updated = { ...sel, [key]: val }
    setSel(updated)
    localStorage.setItem('avDevices', JSON.stringify(updated))
  }

  function DeviceRow({ label, list, stateKey, noBorder }) {
    const current = sel[stateKey] || 'default'
    const allOptions = [{ deviceId: 'default', label: 'Predeterminado' }, ...list]
    return (
      <div style={{ padding: '12px 16px', borderBottom: noBorder ? 'none' : `1px solid ${C.border}22` }}>
        <div style={{ color: C.text, fontSize: 14, marginBottom: 8, fontWeight: 500 }}>{label}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {allOptions.map(d => {
            const active = current === d.deviceId
            const name = d.label || (d.deviceId === 'default' ? 'Predeterminado' : `Dispositivo ${d.deviceId.slice(0,6)}`)
            return (
              <button key={d.deviceId} onClick={() => pick(stateKey, d.deviceId)} style={{
                padding: '5px 12px', borderRadius: 20,
                border: `1.5px solid ${active ? C.green : C.border}`,
                background: active ? `${C.green}18` : C.panel2,
                color: active ? C.green : C.textDim,
                fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {active && <svg width="10" height="10" viewBox="0 0 24 24" fill={C.green}><polygon points="5,3 19,12 5,21"/></svg>}
                {name}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 32 }}>
      {!permGranted && (
        <div style={{ margin: '16px', padding: '16px', background: C.panel, borderRadius: 12, border: `1px solid ${C.border}`, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎙️</div>
          <div style={{ color: C.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Permiso de dispositivos</div>
          <div style={{ color: C.textDim, fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>Para ver y seleccionar tu cámara y micrófono, necesitamos acceso a tus dispositivos.</div>
          <button onClick={requestPermission} style={{
            padding: '10px 24px', borderRadius: 24, background: C.green, border: 'none',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>Permitir acceso</button>
        </div>
      )}
      <SectionLabel>Cámara</SectionLabel>
      <SettingsBlock>
        <DeviceRow label="Cámara" list={devices.cameras} stateKey="camera" noBorder />
      </SettingsBlock>
      <SectionLabel>Audio</SectionLabel>
      <SettingsBlock>
        <DeviceRow label="Micrófono" list={devices.mics} stateKey="mic" />
        <DeviceRow label="Altavoces / Auriculares" list={devices.speakers} stateKey="speaker" noBorder />
      </SettingsBlock>
    </div>
  )
}

// ── Ayuda Tab ─────────────────────────────────────────────────────────────────
const FAQ = [
  { q: '¿Cómo creo una comunidad?', a: 'Andá a la pestaña Explorar y tocá el botón "+" o "Crear comunidad". Elegí nombre, imagen y configurá si es pública o privada.' },
  { q: '¿Cómo invito a alguien a mi comunidad?', a: 'Dentro de la comunidad, tocá "Miembros" y luego el botón de invitar. Podés compartir el link o buscar por usuario.' },
  { q: '¿Qué es el Panel CEO?', a: 'Es el panel de administración de tu comunidad. Desde ahí configurás torneos, ligas, anuncios y los roles de los miembros.' },
  { q: '¿Cómo creo un torneo?', a: 'Entrá al Panel CEO de tu comunidad, tocá "Torneos" y luego "Nuevo torneo". Configurá formato, fechas y participantes.' },
  { q: '¿Cómo cambio mi nombre o foto de perfil?', a: 'Andá a Ajustes → Perfil. Tocá tu foto para cambiarla o editá el nombre y bio desde ahí.' },
  { q: '¿Qué planes VIP hay?', a: 'Hay planes VIP, CEO y Organizador. Cada uno desbloquea funciones premium. Los podés ver en Ajustes → Cuenta.' },
  { q: '¿Cómo funciona el ranking ELO?', a: 'El ranking se actualiza automáticamente según tus resultados en torneos y ligas. Más victorias = más ELO.' },
  { q: '¿Puedo recuperar mensajes borrados?', a: 'Los usuarios VIP pueden ver el contenido de mensajes eliminados (excepto los borrados por SuperAdmin).' },
]

const TICKET_STATUS = {
  open:        { label: 'Abierto',   color: '#f59e0b' },
  in_progress: { label: 'En curso',  color: '#3b82f6' },
  closed:      { label: 'Cerrado',   color: '#6b7280' },
}

function TicketChat({ ticket, profile, onBack }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const s = TICKET_STATUS[ticket.status] || TICKET_STATUS.open

  useEffect(() => {
    if (!ticket.conversation_id) { setLoading(false); return }
    supabase
      .from('messages')
      .select('*, sender:users!messages_sender_id_fkey(id,display_name,username,avatar_url)')
      .eq('conversation_id', ticket.conversation_id)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setMessages(data || []); setLoading(false) })

    const ch = supabase.channel(`ticket-user-${ticket.conversation_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${ticket.conversation_id}` }, payload => {
        setMessages(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [ticket.conversation_id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMsg() {
    if (!input.trim() || !ticket.conversation_id || sending) return
    setSending(true)
    const content = input.trim()
    setInput('')
    await supabase.from('messages').insert({ conversation_id: ticket.conversation_id, sender_id: profile.id, content, type: 'text' })
    setSending(false)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{ticket.ticket_no}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: `${s.color}18`, borderRadius: 5, padding: '2px 8px' }}>{s.label}</span>
          </div>
          <div style={{ fontSize: 11, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.title || ticket.category}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <div style={{ width: 20, height: 20, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          </div>
        ) : !ticket.conversation_id ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: C.textDim, fontSize: 13 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⏳</div>
            <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>Ticket en espera</div>
            Un agente revisará tu ticket y abrirá el chat a la brevedad. Podés volver acá para seguir la conversación.
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: C.textDim, fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            El chat está listo. Un agente se comunicará con vos en breve.
          </div>
        ) : messages.map(m => {
          const isMe = m.sender_id === profile?.id
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '75%', background: isMe ? C.green : C.panel2, borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '9px 13px', border: isMe ? 'none' : `1px solid ${C.border}` }}>
                {!isMe && <div style={{ fontSize: 10, fontWeight: 700, color: C.green, marginBottom: 3 }}>{m.sender?.display_name || 'Soporte'}</div>}
                <div style={{ fontSize: 13, color: isMe ? '#fff' : C.text, lineHeight: 1.5 }}>{m.content}</div>
                <div style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,.6)' : C.textDim, textAlign: 'right', marginTop: 3 }}>
                  {new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {ticket.status !== 'closed' && ticket.conversation_id && (
        <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}`, background: C.panel, display: 'flex', gap: 8, flexShrink: 0 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
            placeholder="Escribí tu mensaje..."
            rows={1}
            style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', color: C.text, fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
          <button onClick={sendMsg} disabled={!input.trim() || sending} style={{ background: input.trim() ? C.green : C.border, border: 'none', borderRadius: 8, padding: '9px 14px', cursor: input.trim() ? 'pointer' : 'default', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            {sending ? '…' : '↑'}
          </button>
        </div>
      )}
      {ticket.status === 'closed' && (
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`, background: C.panel, textAlign: 'center', color: C.textDim, fontSize: 12 }}>
          Este ticket está cerrado.
        </div>
      )}
    </div>
  )
}

function MisTickets({ profile }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [openTicket, setOpenTicket] = useState(null)

  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('support_tickets')
      .select('id, ticket_no, title, status, category, created_at, conversation_id')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { setTickets(data || []); setLoading(false) })
  }, [profile?.id])

  if (openTicket) return <TicketChat ticket={openTicket} profile={profile} onBack={() => setOpenTicket(null)} />

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 20, height: 20, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    </div>
  )

  if (tickets.length === 0) return (
    <div style={{ padding: '20px 16px', textAlign: 'center', color: C.textDim, fontSize: 13 }}>
      No tenés tickets abiertos aún.
    </div>
  )

  return (
    <div style={{ background: C.panel, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
      {tickets.map((t, i) => {
        const s = TICKET_STATUS[t.status] || TICKET_STATUS.open
        return (
          <div key={t.id} onClick={() => setOpenTicket(t)} style={{ padding: '11px 16px', borderBottom: i < tickets.length - 1 ? `1px solid ${C.border}22` : 'none', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = C.panel2}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{t.ticket_no}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: `${s.color}18`, borderRadius: 5, padding: '1px 7px' }}>{s.label}</span>
              </div>
              <div style={{ color: C.textDim, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title || t.category}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 11, color: C.textDim }}>
                {new Date(t.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AyudaTab({ profile, onToast, onOpenSupport }) {
  const [openFaq, setOpenFaq] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [stars, setStars] = useState(0)
  const [ratingDone, setRatingDone] = useState(false)

  async function sendFeedback() {
    if (!feedback.trim()) return
    setSending(true)
    try {
      // Get or create support group
      const { data: cfg } = await supabase.from('app_config').select('value').eq('key', 'support_group_id').maybeSingle()
      const supportId = cfg?.value
      if (supportId) {
        await supabase.from('messages').insert({
          conversation_id: supportId,
          sender_id: profile?.id,
          content: `📝 Feedback de ${profile?.display_name || 'usuario'}: ${feedback}`,
          type: 'text',
        })
      }
      setSent(true)
      setFeedback('')
      onToast('¡Gracias! Tu comentario fue enviado al equipo.')
    } catch {
      onToast('Error al enviar. Intentá de nuevo.')
    }
    setSending(false)
  }

  async function handleRating(n) {
    setStars(n)
    await new Promise(r => setTimeout(r, 300))
    setRatingDone(true)
    try {
      const { data: cfg } = await supabase.from('app_config').select('value').eq('key', 'support_group_id').maybeSingle()
      const supportId = cfg?.value
      if (supportId) {
        await supabase.from('messages').insert({
          conversation_id: supportId,
          sender_id: profile?.id,
          content: `⭐ Calificación de ${profile?.display_name || 'usuario'}: ${'★'.repeat(n)}${'☆'.repeat(5-n)} (${n}/5)`,
          type: 'text',
        })
      }
    } catch {}
    onToast(`¡Gracias por tu ${n >= 4 ? '⭐ calificación!' : 'opinión!'}`)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 40 }}>

      {/* Mis tickets */}
      <SectionLabel>Mis tickets</SectionLabel>
      <MisTickets profile={profile} />

      {/* Acciones rápidas */}
      <SectionLabel>Soporte</SectionLabel>
      <SettingsBlock>
        <Row label="Contáctanos" desc="Chateá con el equipo de soporte" onClick={onOpenSupport}
          right={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>} />
        <Row label="Calificar la aplicación" desc="¿Te gusta NexoTribu? ¡Dejanos tu opinión!" noBorder onClick={() => {}}
          right={
            ratingDone
              ? <span style={{ color: C.green, fontSize: 13, fontWeight: 700 }}>{'★'.repeat(stars)} ¡Gracias!</span>
              : <div style={{ display: 'flex', gap: 4 }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={e => { e.stopPropagation(); handleRating(n) }} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                      fontSize: 22, color: n <= stars ? '#f59e0b' : C.textDim, lineHeight: 1,
                    }}>{n <= stars ? '★' : '☆'}</button>
                  ))}
                </div>
          } />
      </SettingsBlock>

      {/* Enviar comentarios */}
      <SectionLabel>Enviar comentarios</SectionLabel>
      <div style={{ background: C.panel, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ padding: 16 }}>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Describí el problema, sugerencia o error que encontraste…"
            rows={4}
            style={{ width: '100%', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: '10px 12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          <button onClick={sendFeedback} disabled={!feedback.trim() || sent} style={{
            marginTop: 10, width: '100%', padding: '11px', background: feedback.trim() ? C.green : C.border,
            color: '#000', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14,
            cursor: feedback.trim() ? 'pointer' : 'not-allowed',
          }}>
            {sent ? '✓ Enviado' : 'Enviar'}
          </button>
        </div>
      </div>

      {/* FAQ */}
      <SectionLabel>Preguntas frecuentes</SectionLabel>
      <div style={{ background: C.panel, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        {FAQ.map((item, i) => (
          <div key={i} style={{ borderBottom: i < FAQ.length - 1 ? `1px solid ${C.border}22` : 'none' }}>
            <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', gap: 12,
            }}>
              <span style={{ color: C.text, fontSize: 14 }}>{item.q}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: openFaq === i ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
            {openFaq === i && (
              <div style={{ padding: '0 16px 14px', color: C.textDim, fontSize: 13, lineHeight: 1.6 }}>
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Version */}
      <div style={{ padding: '24px 16px 0', textAlign: 'center', color: C.textDim, fontSize: 12 }}>
        NexoTribu · Versión 1.0.0
      </div>

    </div>
  )
}

const ATAJOS = [
  { section: 'Chats', items: [
    { keys: ['Ctrl','N'], desc: 'Nuevo chat' },
    { keys: ['Ctrl','Shift','['], desc: 'Chat anterior' },
    { keys: ['Ctrl','Shift',']'], desc: 'Chat siguiente' },
    { keys: ['Ctrl','Shift','U'], desc: 'Marcar como no leído' },
    { keys: ['Ctrl','Shift','M'], desc: 'Silenciar / activar' },
    { keys: ['Ctrl','Backspace'], desc: 'Eliminar chat' },
    { keys: ['Ctrl','Shift','E'], desc: 'Archivar chat' },
    { keys: ['Ctrl','Shift','P'], desc: 'Fijar / desfijar chat' },
    { keys: ['Ctrl','F'], desc: 'Buscar en el chat' },
  ]},
  { section: 'Mensajes', items: [
    { keys: ['Enter'], desc: 'Enviar mensaje' },
    { keys: ['Shift','Enter'], desc: 'Nueva línea' },
    { keys: ['Ctrl','Z'], desc: 'Deshacer' },
    { keys: ['Ctrl','B'], desc: 'Negrita' },
    { keys: ['Ctrl','I'], desc: 'Cursiva' },
    { keys: ['Ctrl','S'], desc: 'Tachado' },
    { keys: ['Ctrl','E'], desc: 'Monoespaciado' },
  ]},
  { section: 'Llamadas', items: [
    { keys: ['Ctrl','Alt','A'], desc: 'Nueva llamada de audio' },
    { keys: ['Ctrl','Alt','V'], desc: 'Nueva videollamada' },
  ]},
  { section: 'Global', items: [
    { keys: ['Ctrl',','], desc: 'Abrir ajustes' },
    { keys: ['Ctrl','Alt','N'], desc: 'Nueva comunidad' },
    { keys: ['Ctrl','Alt','F'], desc: 'Buscar chats y mensajes' },
    { keys: ['Esc'], desc: 'Cerrar panel / modal' },
  ]},
]

function AtajosTab() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 40 }}>
      {ATAJOS.map(sec => (
        <div key={sec.section}>
          <SectionLabel>{sec.section}</SectionLabel>
          <SettingsBlock>
            {sec.items.map((item, i) => (
              <Row key={i} noBorder={i === sec.items.length - 1}
                label={item.desc}
                right={
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {item.keys.map((k, ki) => (
                      <span key={ki} style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: C.textDim, fontFamily: 'monospace' }}>{k}</span>
                    ))}
                  </div>
                }
              />
            ))}
          </SettingsBlock>
        </div>
      ))}
    </div>
  )
}

function GeneralTab() {
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('generalPrefs') || '{}') } catch { return {} }
  })

  function setPref(key, val) {
    const updated = { ...prefs, [key]: val }
    setPrefs(updated)
    localStorage.setItem('generalPrefs', JSON.stringify(updated))
    if (key === 'fontSize') applyFontSize(val)
  }

  const FONT_SIZE_MAP = { 'Pequeño': '13px', 'Normal': '15px', 'Grande': '17px', 'Extra grande': '20px' }

  function applyFontSize(label) {
    document.documentElement.style.setProperty('--app-font-size', FONT_SIZE_MAP[label] || '15px')
  }

  useEffect(() => { applyFontSize(prefs.fontSize || 'Normal') }, [])

  const FONT_SIZES = ['Pequeño', 'Normal', 'Grande', 'Extra grande']
  const LANGUAGES = ['Español', 'English', 'Português']
  const currentFont = prefs.fontSize || 'Normal'
  const currentLang = prefs.language || 'Español'

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 40 }}>
      <SectionLabel>Idioma y apariencia</SectionLabel>
      <SettingsBlock>
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${C.border}22` }}>
          <div style={{ color: C.text, fontSize: 14, marginBottom: 10 }}>Idioma de la interfaz</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {LANGUAGES.map(l => (
              <button key={l} onClick={() => setPref('language', l)} style={{
                padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${currentLang === l ? C.green : C.border}`,
                background: currentLang === l ? `${C.green}15` : C.panel2,
                color: currentLang === l ? C.green : C.textDim, fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: '13px 16px' }}>
          <div style={{ color: C.text, fontSize: 14, marginBottom: 10 }}>Tamaño de letra</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FONT_SIZES.map(s => (
              <button key={s} onClick={() => setPref('fontSize', s)} style={{
                padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${currentFont === s ? C.green : C.border}`,
                background: currentFont === s ? `${C.green}15` : C.panel2,
                color: currentFont === s ? C.green : C.textDim, fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>{s}</button>
            ))}
          </div>
        </div>
      </SettingsBlock>

      <SectionLabel>Sistema</SectionLabel>
      <SettingsBlock>
        <Row label="Abrir al iniciar sesión" desc="Lanzar NexoTribu al encender el equipo"
          right={<Toggle on={!!prefs.openOnStart} onChange={v => setPref('openOnStart', v)} />} />
        <Row label="Minimizar a la bandeja" desc="Al cerrar, queda en segundo plano"
          right={<Toggle on={!!prefs.minimizeToTray} onChange={v => setPref('minimizeToTray', v)} />} noBorder />
      </SettingsBlock>

      <div style={{ padding: '20px 16px 0', textAlign: 'center', color: C.textDim, fontSize: 11 }}>
        Algunas opciones del sistema aplican solo a la app de escritorio.
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PerfilPage({ onClose, onGoVip, initialTab, onOpenSupport }) {
  const { profile, fetchProfile } = useAuthStore()
  const [tab, setTab] = useState(initialTab || 'menu')
  const [showBots, setShowBots] = useState(false)
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ display_name: '', username: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [skin, setSkinState] = useState(getSkinLocal)
  const [hiddenNav, setHiddenNav] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mm_hidden_nav') || '[]') } catch { return [] }
  })
  const fileRef = useRef()

  useEffect(() => {
    const h = () => setSkinState(getSkinLocal())
    window.addEventListener('skinchange', h)
    return () => window.removeEventListener('skinchange', h)
  }, [])

  function toggleNavIcon(id) {
    setHiddenNav(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      localStorage.setItem('mm_hidden_nav', JSON.stringify(next))
      window.dispatchEvent(new Event('navchange'))
      return next
    })
  }

  useEffect(() => {
    if (!profile) return
    setForm({ display_name: profile.display_name || '', username: profile.username || '', bio: profile.bio || '' })
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
    const updates = { display_name: form.display_name.trim(), bio: form.bio.trim() }
    if (form.username.trim()) updates.username = form.username.trim().replace(/^@/, '').toLowerCase()
    const { error } = await supabase.from('users').update(updates).eq('id', profile.id)
    setSaving(false)
    if (error) { setToast('Error: ' + error.message); return }
    await fetchProfile(profile.id)
    setEditing(false)
    setToast('Perfil actualizado ✓')
  }

  async function deleteAccount() {
    if (deleteConfirm.toLowerCase() !== 'eliminar') return
    setDeleting(true)
    await supabase.from('users').update({ deleted_at: new Date().toISOString(), display_name: 'Usuario eliminado', avatar_url: null }).eq('id', profile.id)
    await supabase.auth.signOut()
    setDeleting(false)
  }

  async function suspendAccount() {
    await supabase.from('users').update({ suspended: true }).eq('id', profile.id)
    await supabase.auth.signOut()
  }

  async function uploadAvatar(file) {
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `user-avatars/${profile.id}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('attachments').upload(path, file, { upsert: true })
    if (upErr) { setToast('Error al subir imagen: ' + upErr.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path)
    await supabase.from('users').update({ avatar_url: publicUrl + '?v=' + Date.now() }).eq('id', profile.id)
    await fetchProfile(profile.id)
    setUploading(false)
    setToast('Foto actualizada ✓')
  }

  if (!profile) return <Spinner />

  const plan = PLAN_CFG[profile.role] || PLAN_CFG.free

  function goBack() { setTab('menu'); setEditing(false); setShowBots(false) }

  const SKINS_CFG = [
    { id: 'whatsapp', label: 'Estilo NexoTribu', icon: '💬' },
  ]

  const subHeader = (title) => (
    <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
      <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      </button>
      <span style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>{title}</span>
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Sub-page: Perfil */}
      {tab === 'perfil' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {subHeader('Perfil')}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
                  <div style={{ width: 90, height: 90, borderRadius: '50%', background: C.border, overflow: 'hidden', border: `3px solid ${C.green}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
                    {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : '👤'}
                    {uploading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}><div style={{ width: 22, height: 22, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} /></div>}
                  </div>
                  <div style={{ position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: '50%', background: C.green, color: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, border: `2px solid ${C.bg}`, pointerEvents: 'none' }}>📷</div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadAvatar(e.target.files[0])} />
                </div>
                {editing ? (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Nombre visible" style={{ width: '100%', padding: '10px 12px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 15, fontWeight: 700, boxSizing: 'border-box' }} />
                    <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.replace(/^@/, '') }))} placeholder="@usuario" style={{ width: '100%', padding: '10px 12px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.textDim, fontSize: 14, boxSizing: 'border-box' }} />
                    <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Bio (opcional)" rows={2} style={{ width: '100%', padding: '10px 12px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                    <button onClick={saveProfile} disabled={saving} style={{ width: '100%', padding: '12px', background: C.green, color: C.bg, border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                      {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button onClick={() => setEditing(false)} style={{ width: '100%', padding: '11px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, color: C.textDim, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: C.text, fontSize: 20, fontWeight: 900 }}>{profile.username ? `@${profile.username}` : profile.display_name || 'Sin nombre'}</div>
                    {profile.display_name && profile.username && <div style={{ color: C.textDim, fontSize: 13, marginTop: 2 }}>{profile.display_name}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 }}>
                      <span style={{ background: `${plan.color}20`, color: plan.color, border: `1px solid ${plan.color}40`, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>{plan.icon} {plan.label}</span>
                    </div>
                    {profile.bio && <div style={{ color: C.textDim, fontSize: 12, marginTop: 8, lineHeight: 1.6, maxWidth: 320 }}>{profile.bio}</div>}
                    <button onClick={() => setEditing(true)} style={{ marginTop: 12, padding: '8px 20px', background: `${C.green}18`, border: `1px solid ${C.green}40`, borderRadius: 20, color: C.green, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Editar perfil</button>
                  </div>
                )}
              </div>
              {stats && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                  <StatCard label="Partidos" value={stats.total} color={C.textDim} />
                  <StatCard label="Victorias" value={stats.wins} color={C.green} />
                  <StatCard label="Derrotas" value={stats.losses} color="#ef4444" />
                  <StatCard label="Ratio" value={`${stats.ratio}%`} color="#f59e0b" />
                </div>
              )}
              <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Historial de partidos</div>
              {loadingHistory ? <Spinner /> : history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: C.textDim }}><div style={{ fontSize: 36, marginBottom: 10 }}>⚽</div><div>Sin partidos jugados aún</div></div>
              ) : history.map(match => {
                const isP1 = match.player1?.id === profile.id
                const opp = isP1 ? match.player2 : match.player1
                const won = match.winner_id === profile.id
                const myScore = isP1 ? match.score1 : match.score2
                const oppScore = isP1 ? match.score2 : match.score1
                return (
                  <div key={match.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: C.panel, border: `1px solid ${won ? C.green + '30' : '#ef444430'}`, borderRadius: 10, marginBottom: 8, borderLeft: `3px solid ${won ? C.green : '#ef4444'}` }}>
                    <span style={{ fontSize: 18 }}>{won ? '✅' : '❌'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>vs <span style={{ color: C.textDim }}>{opp?.display_name || '?'}</span></div>
                      {match.conversation?.name && <div style={{ color: C.textDim, fontSize: 10, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.conversation.name}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ color: won ? C.green : '#ef4444', fontWeight: 800, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{myScore ?? '?'} — {oppScore ?? '?'}</div>
                      <div style={{ color: C.textDim, fontSize: 10 }}>{new Date(match.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short' })}</div>
                    </div>
                  </div>
                )
              })}
              <div style={{ marginTop: 24, border: `1px solid #ef444430`, borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ background: '#ef444410', padding: '10px 16px', color: '#ef4444', fontWeight: 800, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' }}>⚠️ Zona de peligro</div>
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={() => setShowDeleteModal('suspend')} style={{ padding: '11px 14px', background: 'none', border: `1px solid #f59e0b40`, borderRadius: 10, color: '#f59e0b', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>⏸ Suspender mi cuenta temporalmente</button>
                  <button onClick={() => setShowDeleteModal('delete')} style={{ padding: '11px 14px', background: 'none', border: `1px solid #ef444440`, borderRadius: 10, color: '#ef4444', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>🗑️ Eliminar mi cuenta permanentemente</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Cuenta */}
      {tab === 'cuenta' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {subHeader('Cuenta')}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {!showBots
              ? <CuentaTab profile={profile} onGoVip={onGoVip} onGoBots={() => setShowBots(true)} onGoIdentidad={() => setTab('identidad')} onPlanActivated={() => fetchProfile(profile.id)} />
              : <BotApiPage onBack={() => setShowBots(false)} />
            }
          </div>
        </div>
      )}

      {/* Sub-page: Chats (Preferencias) */}
      {tab === 'preferencias' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {subHeader('Chats')}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <PreferenciasTab profile={profile} onGoVip={onGoVip} />
          </div>
        </div>
      )}

      {/* Sub-page: Apariencia (skin) */}
      {tab === 'apariencia' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {subHeader('Apariencia')}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <div style={{ color: C.textDim, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Skin de la interfaz</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SKINS_CFG.map(s => {
                const locked = s.id === 'default'
                const active = skin === s.id
                return (
                  <button key={s.id} onClick={() => { if (!locked) { setLayoutSkin(s.id); setSkinState(s.id) } }} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                    background: active ? `${C.green}12` : locked ? `${C.border}30` : C.panel,
                    border: `2px solid ${active ? C.green : C.border}`,
                    borderRadius: 14, cursor: locked ? 'default' : 'pointer', textAlign: 'left', width: '100%',
                    opacity: locked ? 0.5 : 1,
                  }}>
                    <span style={{ fontSize: 28 }}>{s.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: locked ? C.textDim : C.text, fontWeight: 700, fontSize: 14 }}>{s.label}</div>
                      {active && !locked && <div style={{ color: C.green, fontSize: 12, marginTop: 2 }}>✓ Activo</div>}
                      {locked && <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>🔒 No disponible</div>}
                    </div>
                    {active && !locked && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                    {locked && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                  </button>
                )
              })}
            </div>

            {/* Ocultar iconos del menú lateral */}
            <div style={{ marginTop: 28 }}>
              <div style={{ color: C.textDim, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Iconos del menú lateral</div>
              <p style={{ color: C.textDim, fontSize: 12, margin: '0 0 14px', lineHeight: 1.5 }}>Ocultá los iconos que no uses. Siempre podés volver a activarlos.</p>
              {[
                { id: 'inicio', label: 'Inicio', emoji: '🏠' },
                { id: 'comunidades', label: 'Comunidades', emoji: '🌐' },
                { id: 'explorar', label: 'Explorar', emoji: '🔍' },
                { id: 'contactos', label: 'Contactos', emoji: '👥' },
                { id: 'torneos', label: 'Torneos', emoji: '🏆' },
                { id: 'anuncios', label: 'Anuncios', emoji: '📢' },
                { id: 'ranking', label: 'Ranking', emoji: '📊' },
              ].map(item => {
                const hidden = hiddenNav.includes(item.id)
                return (
                  <button key={item.id} onClick={() => toggleNavIcon(item.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    background: hidden ? C.panel2 : C.panel,
                    border: `1px solid ${hidden ? C.border : C.green + '44'}`,
                    borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%',
                    marginBottom: 8, opacity: hidden ? 0.5 : 1,
                  }}>
                    <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{item.emoji}</span>
                    <span style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: 600 }}>{item.label}</span>
                    <span style={{ fontSize: 12, color: hidden ? C.textDim : C.green, fontWeight: 700 }}>
                      {hidden ? 'Oculto' : 'Visible'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Identidad */}
      {tab === 'identidad' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {subHeader('Identidad')}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <IdentityVerification profile={profile} />
          </div>
        </div>
      )}

      {/* Sub-page: Referidos */}
      {tab === 'referidos' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {subHeader('Referidos')}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <ReferidosTab profile={profile} />
          </div>
        </div>
      )}

      {/* Sub-page: Legal */}
      {tab === 'legal' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {subHeader('Legal')}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <LegalPage />
          </div>
        </div>
      )}

      {/* Sub-page: Privacidad */}
      {tab === 'privacidad' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {subHeader('Privacidad')}
          <PrivacidadTab profile={profile} />
        </div>
      )}

      {/* Sub-page: Notificaciones */}
      {tab === 'notificaciones' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {subHeader('Notificaciones')}
          <NotificacionesTab profile={profile} />
        </div>
      )}

      {/* Sub-page: Video y Voz */}
      {tab === 'videovoz' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {subHeader('Video y voz')}
          <VideoVozTab />
        </div>
      )}

      {/* Sub-page: Ayuda */}
      {tab === 'ayuda' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {subHeader('Ayuda y comentarios')}
          <AyudaTab profile={profile} onToast={setToast} onOpenSupport={onOpenSupport} />
        </div>
      )}

      {/* Sub-page: Atajos */}
      {tab === 'atajos' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {subHeader('Atajos del teclado')}
          <AtajosTab />
        </div>
      )}

      {/* Sub-page: General */}
      {tab === 'general' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {subHeader('General')}
          <GeneralTab />
        </div>
      )}

      {/* Main menu — WhatsApp settings style */}
      {tab === 'menu' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '14px 20px', flexShrink: 0 }}>
            <span style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>Ajustes</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* User card */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px',
              borderBottom: `1px solid ${C.border}`, cursor: 'pointer',
            }} onClick={() => setTab('perfil')}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 62, height: 62, borderRadius: '50%', background: C.border, overflow: 'hidden', border: `2px solid ${C.green}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                  {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : '👤'}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontWeight: 800, fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {profile.username ? `@${profile.username}` : profile.display_name || 'Sin nombre'}
                </div>
                <div style={{ color: C.textDim, fontSize: 13, marginTop: 2 }}>{profile.bio || 'Escribe algo sobre vos...'}</div>
                <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, background: `${plan.color}18`, border: `1px solid ${plan.color}35`, borderRadius: 20, padding: '2px 10px' }}>
                  <span style={{ color: plan.color, fontSize: 11, fontWeight: 800 }}>{plan.icon} {plan.label}</span>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </div>

            {/* Settings sections */}
            <div style={{ padding: '8px 0' }}>

              {/* Sección principal */}
              <div style={{ background: C.panel, borderRadius: 0, marginBottom: 8 }}>
                <SettingsRow icon="👤" label="Perfil" desc="Nombre, foto del perfil, bio" onClick={() => setTab('perfil')} />
                <div style={{ height: 1, background: C.border, margin: '0 20px 0 64px' }} />
                <SettingsRow icon="💳" label="Cuenta" desc="Suscripción, seguridad, información" onClick={() => setTab('cuenta')} />
                <div style={{ height: 1, background: C.border, margin: '0 20px 0 64px' }} />
                <SettingsRow icon="🔒" label="Privacidad" desc="Confirmaciones, última vez, mensajes" onClick={() => setTab('privacidad')} />
              </div>

              {/* Sección personalización */}
              <div style={{ background: C.panel, borderRadius: 0, marginBottom: 8 }}>
                <SettingsRow icon="💬" label="Chats" desc="Temas, fondo, sonidos, calidad" onClick={() => setTab('preferencias')} />
                <div style={{ height: 1, background: C.border, margin: '0 20px 0 64px' }} />
                <SettingsRow icon="🔔" label="Notificaciones" desc="Mensajes, grupos, estados, llamadas" onClick={() => setTab('notificaciones')} />
                <div style={{ height: 1, background: C.border, margin: '0 20px 0 64px' }} />
                <SettingsRow icon="📷" label="Video y voz" desc="Cámara, micrófono, altavoces" onClick={() => setTab('videovoz')} />
                <div style={{ height: 1, background: C.border, margin: '0 20px 0 64px' }} />
                <SettingsRow icon="🎨" label="Apariencia" desc="Elige el estilo visual de la app" onClick={() => setTab('apariencia')} value={SKINS_CFG.find(s => s.id === skin)?.label} />
              </div>

              {/* Sección identidad y comunidad */}
              <div style={{ background: C.panel, borderRadius: 0, marginBottom: 8 }}>
                <SettingsRow icon="🪪" label="Identidad" desc="Verificación de identidad" onClick={() => setTab('identidad')} />
                <div style={{ height: 1, background: C.border, margin: '0 20px 0 64px' }} />
                <SettingsRow icon="🔗" label="Referidos" desc="Tu código y beneficios" onClick={() => setTab('referidos')} />
              </div>

              {/* Sección sistema */}
              <div style={{ background: C.panel, borderRadius: 0, marginBottom: 8 }}>
                <SettingsRow icon="⚙️" label="General" desc="Idioma, tamaño de letra, inicio" onClick={() => setTab('general')} />
                <div style={{ height: 1, background: C.border, margin: '0 20px 0 64px' }} />
                <SettingsRow icon="⌨️" label="Atajos del teclado" desc="Todos los atajos disponibles" onClick={() => setTab('atajos')} />
              </div>

              {/* Sección soporte */}
              <div style={{ background: C.panel, borderRadius: 0, marginBottom: 8 }}>
                <SettingsRow icon="❓" label="Ayuda y comentarios" desc="Centro de ayuda, FAQ, contacto" onClick={() => setTab('ayuda')} />
                <div style={{ height: 1, background: C.border, margin: '0 20px 0 64px' }} />
                <SettingsRow icon="📋" label="Legal" desc="Política de privacidad, términos" onClick={() => setTab('legal')} />
              </div>

              {/* Cerrar sesión */}
              <div style={{ background: C.panel, borderRadius: 0, marginBottom: 8 }}>
                <SettingsRow icon="🚪" label="Cerrar sesión" danger onClick={() => supabase.auth.signOut()} noArrow />
              </div>

              {/* ⚡ Panel SuperAdmin — solo visible para el dueño de la plataforma */}
              {profile?.email === 'bermudezleandro1992@gmail.com' && profile?.role !== 'superadmin' && (
                <div style={{ background: '#00e67610', border: '1px solid #00e67640', borderRadius: 0, marginBottom: 8 }}>
                  <button onClick={async () => {
                    await supabase.from('users').update({ role: 'superadmin' }).eq('id', profile.id)
                    window.location.reload()
                  }} style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}>
                    <span style={{ fontSize: 22, width: 28, textAlign: 'center' }}>⚡</span>
                    <div>
                      <div style={{ color: '#00e676', fontWeight: 800, fontSize: 14 }}>Activar SuperAdmin</div>
                      <div style={{ color: '#00e67699', fontSize: 11 }}>Solo para el dueño de la plataforma</div>
                    </div>
                  </button>
                </div>
              )}

              {/* ⚠️ Zona sensible */}
              <div style={{ marginBottom: 6, marginTop: 8, paddingLeft: 20 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', letterSpacing: 1, textTransform: 'uppercase' }}>⚠️ Zona sensible</span>
              </div>
              <div style={{ background: C.panel, borderRadius: 0, marginBottom: 24, border: `1px solid #ef444430` }}>
                <SettingsRow icon="⏸" label="Suspender cuenta" desc="Desactivá tu cuenta temporalmente" danger onClick={() => setShowDeleteModal('suspend')} noArrow />
                <div style={{ height: 1, background: '#ef444425', margin: '0 20px 0 64px' }} />
                <SettingsRow icon="🗑️" label="Eliminar cuenta" desc="Borrá todos tus datos permanentemente" danger onClick={() => setShowDeleteModal('delete')} noArrow />
              </div>

            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {/* Modal eliminar/suspender */}
      {showDeleteModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 24, width: '100%', maxWidth: 380 }}>
            {showDeleteModal === 'suspend' ? (
              <>
                <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>⏸</div>
                <div style={{ color: C.text, fontWeight: 800, fontSize: 17, textAlign: 'center', marginBottom: 8 }}>Suspender cuenta</div>
                <div style={{ color: C.textDim, fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>Tu cuenta quedará inactiva. Podrás reactivarla contactando al soporte.</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowDeleteModal(false)} style={{ flex: 1, padding: '11px', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={suspendAccount} style={{ flex: 1, padding: '11px', background: '#f59e0b', border: 'none', borderRadius: 10, color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Suspender</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>🗑️</div>
                <div style={{ color: '#ef4444', fontWeight: 800, fontSize: 17, textAlign: 'center', marginBottom: 8 }}>Eliminar cuenta</div>
                <div style={{ color: C.textDim, fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 1.6 }}>Esta acción es <strong style={{ color: '#ef4444' }}>permanente e irreversible</strong>.</div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: C.textDim, fontSize: 12, marginBottom: 6 }}>Escribí <strong style={{ color: C.text }}>eliminar</strong> para confirmar:</div>
                  <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="eliminar" style={{ width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid #ef444440`, borderRadius: 10, color: C.text, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }} style={{ flex: 1, padding: '11px', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={deleteAccount} disabled={deleteConfirm.toLowerCase() !== 'eliminar' || deleting} style={{ flex: 1, padding: '11px', background: deleteConfirm.toLowerCase() === 'eliminar' ? '#ef4444' : C.border, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 13, cursor: deleteConfirm.toLowerCase() === 'eliminar' ? 'pointer' : 'not-allowed', opacity: deleting ? 0.6 : 1 }}>
                    {deleting ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      , document.body)}
    </div>
  )
}
