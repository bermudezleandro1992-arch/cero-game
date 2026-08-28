import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )
}

export default function ReferidosPanel({ communityId }) {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    async function load() {
      setLoading(true)
      const start = new Date(year, month - 1, 1).toISOString()
      const end = new Date(year, month, 1).toISOString()

      const { data } = await supabase
        .from('referrals')
        .select('referrer_id, status, users!referrals_referrer_id_fkey(id, display_name, avatar_url)')
        .gte('created_at', start)
        .lt('created_at', end)

      if (!data) { setLoading(false); return }

      const map = {}
      for (const r of data) {
        const u = r.users
        if (!u) continue
        if (!map[r.referrer_id]) map[r.referrer_id] = { user: u, total: 0, verified: 0 }
        map[r.referrer_id].total++
        if (r.status === 'verified') map[r.referrer_id].verified++
      }

      const sorted = Object.values(map).sort((a, b) => b.verified - a.verified || b.total - a.total)
      setRanking(sorted)
      setLoading(false)
    }
    load()
  }, [month, year, communityId])

  const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const MEDAL = ['🥇','🥈','🥉']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Period selector */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={month} onChange={e => setMonth(+e.target.value)}
          style={{ padding: '6px 10px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, cursor: 'pointer' }}>
          {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(+e.target.value)}
          style={{ padding: '6px 10px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, cursor: 'pointer' }}>
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ color: C.textDim, fontSize: 12 }}>Ranking mensual de referidos</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? <Spinner /> : ranking.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.textDim }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔗</div>
            <div>Sin referidos este mes</div>
          </div>
        ) : ranking.map((item, i) => (
          <div key={item.user.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', marginBottom: 8,
            background: i === 0 ? `${C.green}12` : C.panel,
            border: `1px solid ${i === 0 ? C.green + '40' : C.border}`,
            borderRadius: 12,
          }}>
            <div style={{ fontSize: i < 3 ? 22 : 16, fontWeight: 900, color: C.textDim, minWidth: 28, textAlign: 'center' }}>
              {i < 3 ? MEDAL[i] : `#${i + 1}`}
            </div>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.border, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {item.user.avatar_url ? <img src={item.user.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{item.user.display_name}</div>
              <div style={{ color: C.textDim, fontSize: 11 }}>{item.total} invitado{item.total !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ color: C.green, fontWeight: 900, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{item.verified}</div>
              <div style={{ color: C.textDim, fontSize: 10 }}>verificados</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
