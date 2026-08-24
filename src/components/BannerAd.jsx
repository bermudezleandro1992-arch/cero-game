import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'

// Cache global para no re-fetchear en cada render
let _cache = null
let _cacheTs = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 min

async function fetchBanners() {
  const now = Date.now()
  if (_cache && now - _cacheTs < CACHE_TTL) return _cache
  const { data } = await supabase
    .from('banners')
    .select('*')
    .eq('active', true)
    .order('priority', { ascending: false })
  _cache = data || []
  _cacheTs = now
  return _cache
}

// position: 'chats' | 'explorar' | 'torneos'
export default function BannerAd({ position = 'chats', style }) {
  const { profile } = useAuthStore()
  const [banner, setBanner] = useState(null)
  const [visible] = useState(true)
  const [idx, setIdx] = useState(0)
  const intervalRef = useRef(null)

  // VIP y Comunidad no ven banners
  const noBanners = ['vip', 'comunidad'].includes(profile?.plan) ||
                    ['vip', 'comunidad', 'admin', 'superadmin'].includes(profile?.role)

  useEffect(() => {
    if (noBanners) return
    fetchBanners().then(all => {
      const filtered = all.filter(b => b.position === position || b.position === 'all')
      if (!filtered.length) return
      setBanner(filtered[0])
      if (filtered.length > 1) {
        intervalRef.current = setInterval(() => {
          setIdx(i => {
            const next = (i + 1) % filtered.length
            setBanner(filtered[next])
            return next
          })
        }, 8000)
      }
    })
    return () => clearInterval(intervalRef.current)
  }, [position, noBanners])

  if (noBanners || !banner || !visible) return null

  return (
    <div style={{
      margin: '4px 12px',
      borderRadius: 14,
      overflow: 'hidden',
      border: `1px solid ${banner.accent_color}33`,
      background: banner.bg_color || C.panel,
      position: 'relative',
      cursor: banner.link_url ? 'pointer' : 'default',
      flexShrink: 0,
      ...style,
    }}
      onClick={() => { if (banner.link_url) window.open(banner.link_url, '_blank', 'noopener') }}
    >
      {/* Sponsored label */}
      <div style={{ padding: '6px 10px 0' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          Patrocinado
        </span>
      </div>

      {/* Content */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px 12px' }}>
        {/* Icon / image */}
        {banner.image_url
          ? <img src={banner.image_url} alt={banner.title} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: `${banner.accent_color}22`,
              border: `1px solid ${banner.accent_color}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24,
            }}>{banner.emoji || '🎮'}</div>
        }
        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 13, color: '#fff', lineHeight: 1.2 }}>{banner.title}</p>
          {banner.subtitle && (
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.3 }}>{banner.subtitle}</p>
          )}
        </div>
        {/* CTA arrow */}
        {banner.link_url && (
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: banner.accent_color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>
        )}
      </div>

      {/* Accent bottom bar */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${banner.accent_color}00, ${banner.accent_color}, ${banner.accent_color}00)` }} />
    </div>
  )
}
