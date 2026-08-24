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
    saveSoundSettings(updated)
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
        {/* Seguir sistema */}
        <button onClick={() => changeTheme('system')} style={{
          width: '100%', padding: '12px 16px', borderRadius: 12, marginBottom: 10,
          border: `2px solid ${themeId === 'system' ? C.green : C.border}`,
          background: themeId === 'system' ? `${C.green}12` : C.panel,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: themeId === 'system' ? `0 0 0 1px ${C.green}` : 'none',
        }}>
          <span style={{ fontSize: 22 }}>🖥</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>Seguir tema del sistema</div>
            <div style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>Cambia automáticamente según tu OS</div>
          </div>
          {themeId === 'system' && <span style={{ marginLeft: 'auto', color: C.green, fontSize: 18 }}>✓</span>}
        </button>
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

      {/* Notificaciones */}
      <section>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 12 }}>🔔 Notificaciones</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            ['notif_messages',    '💬 Nuevos mensajes'],
            ['notif_calls',       '📞 Llamadas entrantes'],
            ['notif_torneos',     '🏆 Torneos en mis comunidades'],
            ['notif_resultados',  '⚽ Resultados de partidos'],
            ['notif_anuncios',    '📢 Anuncios de CEO/Organizador'],
            ['notif_solicitudes', '🔔 Solicitudes de unión (admins)'],
            ['notif_partidos',    '⏰ Recordatorio de próximo partido'],
          ].map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer' }}>
              <span style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>{label}</span>
              <div onClick={() => saveSound(key, sounds[key] === false ? true : false)} style={{
                width: 42, height: 24, borderRadius: 12, position: 'relative', cursor: 'pointer', flexShrink: 0,
                background: sounds[key] === false ? C.border : C.green, transition: 'background .2s',
              }}>
                <div style={{
                  position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s',
                  left: sounds[key] === false ? 2 : 18,
                }} />
              </div>
            </label>
          ))}
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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PerfilPage({ onClose, onGoVip }) {
  const { profile, fetchProfile } = useAuthStore()
  const [tab, setTab] = useState('perfil')
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
  const fileRef = useRef()

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
    { id: 'identidad', label: 'Identidad', icon: '🪪' },
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
      {tab === 'cuenta' && !showBots && <CuentaTab profile={profile} onGoVip={onGoVip} onGoBots={() => setShowBots(true)} onGoIdentidad={() => setTab('identidad')} onPlanActivated={() => fetchProfile(profile.id)} />}
      {tab === 'cuenta' && showBots && (
        <BotApiPage onBack={() => setShowBots(false)} />
      )}
      {tab === 'preferencias' && <PreferenciasTab profile={profile} />}
      {tab === 'identidad' && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <IdentityVerification profile={profile} />
        </div>
      )}
      {tab === 'referidos' && <ReferidosTab profile={profile} />}
      {tab === 'legal' && <LegalTab />}
      {tab === 'perfil' && (
      <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>

        {/* Avatar + Name section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          {/* Foto — siempre tappable */}
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
            <div style={{
              width: 90, height: 90, borderRadius: '50%', background: C.border, overflow: 'hidden',
              border: `3px solid ${C.green}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
            }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : '👤'
              }
              {uploading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                  <div style={{ width: 22, height: 22, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                </div>
              )}
            </div>
            <div style={{
              position: 'absolute', bottom: 2, right: 2,
              width: 28, height: 28, borderRadius: '50%', background: C.green, color: C.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              border: `2px solid ${C.bg}`, pointerEvents: 'none',
            }}>📷</div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadAvatar(e.target.files[0])} />
          </div>

          {/* Nombre y badge */}
          {editing ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="Nombre visible"
                style={{ width: '100%', padding: '10px 12px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 15, fontWeight: 700, boxSizing: 'border-box' }} />
              <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.replace(/^@/, '') }))}
                placeholder="@usuario"
                style={{ width: '100%', padding: '10px 12px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.textDim, fontSize: 14, boxSizing: 'border-box' }} />
              <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="Bio (opcional)"
                rows={2}
                style={{ width: '100%', padding: '10px 12px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: C.text, fontSize: 20, fontWeight: 900 }}>{profile.display_name || 'Sin nombre'}</div>
              {profile.username && <div style={{ color: C.textDim, fontSize: 13, marginTop: 2 }}>@{profile.username}</div>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ background: `${plan.color}20`, color: plan.color, border: `1px solid ${plan.color}40`, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {plan.icon} {plan.label}
                  {profile.is_verified && ['vip','comunidad','ceo','superadmin','admin','organizador'].includes(profile.role) && (
                    <span title="Identidad verificada" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: '#00b0ff', color: '#fff', fontSize: 10, fontWeight: 900, marginLeft: 2 }}>✓</span>
                  )}
                </span>
              </div>
              {profile.bio && <div style={{ color: C.textDim, fontSize: 12, marginTop: 8, lineHeight: 1.6, maxWidth: 320 }}>{profile.bio}</div>}
            </div>
          )}
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

        {/* Zona de peligro */}
        <div style={{ marginTop: 24, border: `1px solid #ef444430`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ background: '#ef444410', padding: '10px 16px', color: '#ef4444', fontWeight: 800, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' }}>⚠️ Zona de peligro</div>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => setShowDeleteModal('suspend')} style={{ padding: '11px 14px', background: 'none', border: `1px solid #f59e0b40`, borderRadius: 10, color: '#f59e0b', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
              ⏸ Suspender mi cuenta temporalmente
            </button>
            <button onClick={() => setShowDeleteModal('delete')} style={{ padding: '11px 14px', background: 'none', border: `1px solid #ef444440`, borderRadius: 10, color: '#ef4444', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
              🗑️ Eliminar mi cuenta permanentemente
            </button>
          </div>
        </div>

      </div>
      )}
      </div>

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {/* Modal eliminar/suspender */}
      {showDeleteModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 24, width: '100%', maxWidth: 380 }}>
            {showDeleteModal === 'suspend' ? (
              <>
                <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>⏸</div>
                <div style={{ color: C.text, fontWeight: 800, fontSize: 17, textAlign: 'center', marginBottom: 8 }}>Suspender cuenta</div>
                <div style={{ color: C.textDim, fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>
                  Tu cuenta quedará inactiva. Podrás reactivarla contactando al soporte. Tus datos y comunidades se conservan.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowDeleteModal(false)} style={{ flex: 1, padding: '11px', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={suspendAccount} style={{ flex: 1, padding: '11px', background: '#f59e0b', border: 'none', borderRadius: 10, color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Suspender</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>🗑️</div>
                <div style={{ color: '#ef4444', fontWeight: 800, fontSize: 17, textAlign: 'center', marginBottom: 8 }}>Eliminar cuenta</div>
                <div style={{ color: C.textDim, fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 1.6 }}>
                  Esta acción es <strong style={{ color: '#ef4444' }}>permanente e irreversible</strong>. Todos tus datos, comunidades y torneos serán eliminados.
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: C.textDim, fontSize: 12, marginBottom: 6 }}>Escribí <strong style={{ color: C.text }}>eliminar</strong> para confirmar:</div>
                  <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder="eliminar"
                    style={{ width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid #ef444440`, borderRadius: 10, color: C.text, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }} style={{ flex: 1, padding: '11px', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={deleteAccount} disabled={deleteConfirm.toLowerCase() !== 'eliminar' || deleting}
                    style={{ flex: 1, padding: '11px', background: deleteConfirm.toLowerCase() === 'eliminar' ? '#ef4444' : C.border, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 13, cursor: deleteConfirm.toLowerCase() === 'eliminar' ? 'pointer' : 'not-allowed', opacity: deleting ? 0.6 : 1 }}>
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
