/**
 * FixtureTab — lista de todos los partidos del torneo con reporte de resultado.
 */
import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

const STATUS_CFG = {
  pendiente:  { label: 'Pendiente',  bg: `${C.border}30`,   color: '#6b7280' },
  en_juego:   { label: 'En juego',   bg: '#f59e0b18', color: '#f59e0b' },
  finalizado: { label: 'Finalizado', bg: '#22c55e18', color: '#22c55e' },
  cancelado:  { label: 'Cancelado',  bg: '#ef444418', color: '#ef4444' },
}

function avatar(p, size = 28) {
  const style = { width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${C.border}`, flexShrink: 0 }
  return p?.avatar_url
    ? <img src={p.avatar_url} alt="" style={style} />
    : <div style={{ ...style, background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, fontWeight: 700, color: C.textDim }}>
        {(p?.display_name || p?.username || '?')[0].toUpperCase()}
      </div>
}

// ── Modal reporte de resultado ────────────────────────────────────────────────
function ReportModal({ match, profile, onClose, onSaved }) {
  const [score1, setScore1] = useState('')
  const [score2, setScore2] = useState('')
  const [file,   setFile]   = useState(null)
  const [busy,   setBusy]   = useState(false)
  const [err,    setErr]    = useState('')

  const isP1 = match.player1?.id === profile?.id
  const isP2 = match.player2?.id === profile?.id

  async function handleSubmit() {
    const s1 = parseInt(score1, 10)
    const s2 = parseInt(score2, 10)
    if (isNaN(s1) || isNaN(s2)) { setErr('Ingresá ambos marcadores.'); return }
    if (s1 < 0 || s2 < 0) { setErr('Los marcadores no pueden ser negativos.'); return }

    setBusy(true); setErr('')
    try {
      let screenshotUrl = null
      if (file) {
        const ext = file.name.split('.').pop()
        const path = `match-results/${match.id}-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('match-screenshots').upload(path, file, { upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('match-screenshots').getPublicUrl(path)
          screenshotUrl = publicUrl
        }
      }

      const winner = s1 > s2
        ? match.player1?.id
        : s2 > s1
          ? match.player2?.id
          : null

      const { error } = await supabase.from('tournament_matches').update({
        score_player1: s1,
        score_player2: s2,
        winner_id: winner,
        status: 'finalizado',
        screenshot_url: screenshotUrl,
        reported_by: profile?.id,
        reported_at: new Date().toISOString(),
      }).eq('id', match.id)

      if (error) throw error
      onSaved()
      onClose()
    } catch (e) {
      setErr(e.message || 'Error al guardar')
      setBusy(false)
    }
  }

  const inp = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 20, fontWeight: 800, textAlign: 'center', width: '100%', boxSizing: 'border-box', outline: 'none' }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: C.bg, borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>📸 Reportar resultado</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Players */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              {avatar(match.player1, 40)}
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.player1?.display_name || 'J1'}</div>
            </div>
            <div style={{ color: C.textDim, fontSize: 12, fontWeight: 700 }}>VS</div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              {avatar(match.player2, 40)}
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.player2?.display_name || 'J2'}</div>
            </div>
          </div>

          {/* Scores */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="number" min="0" max="99" value={score1} onChange={e => setScore1(e.target.value)} placeholder="0" style={inp} />
            <span style={{ color: C.textDim, fontWeight: 800, fontSize: 18 }}>-</span>
            <input type="number" min="0" max="99" value={score2} onChange={e => setScore2(e.target.value)} placeholder="0" style={{ ...inp }} />
          </div>

          {/* Screenshot */}
          <div>
            <label style={{ display: 'block', color: C.textDim, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Captura de pantalla (recomendado)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: C.panel, border: `1px dashed ${C.border}`, borderRadius: 10, cursor: 'pointer' }}>
              <span style={{ fontSize: 20 }}>📷</span>
              <span style={{ color: file ? C.green : C.textDim, fontSize: 13, fontWeight: 600 }}>
                {file ? file.name : 'Seleccioná una imagen'}
              </span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0] || null)} />
            </label>
          </div>

          {err && <div style={{ color: '#ef4444', fontSize: 12, fontWeight: 600 }}>{err}</div>}
        </div>

        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={handleSubmit} disabled={busy} style={{ width: '100%', padding: '13px', background: busy ? C.border : C.green, color: busy ? C.textDim : '#000', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: busy ? 'default' : 'pointer' }}>
            {busy ? 'Enviando...' : '✅ Enviar resultado'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Tarjeta de partido ────────────────────────────────────────────────────────
function MatchCard({ match, profile, isAdmin, onReported, onChat }) {
  const [showReport, setShowReport] = useState(false)

  const isParticipant = profile?.id === match.player1?.id || profile?.id === match.player2?.id
  const cfg = STATUS_CFG[match.status] || STATUS_CFG.pendiente
  const finished = match.status === 'finalizado'
  const w = match.winner_id

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Round / status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: C.textDim, fontSize: 11, fontWeight: 600 }}>
          {match.phase ? `${match.phase} · ` : ''}{match.round_label || `Ronda ${match.round_number}`}
        </span>
        <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 700 }}>
          {cfg.label}
        </span>
      </div>

      {/* Players & score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Player 1 */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {avatar(match.player1)}
          <span style={{
            color: w === match.player1?.id ? C.green : C.text,
            fontWeight: w === match.player1?.id ? 800 : 500,
            fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {match.player1?.display_name || '—'}
          </span>
          {w === match.player1?.id && <span style={{ fontSize: 12 }}>🏆</span>}
        </div>

        {/* Score */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          {finished ? (
            <>
              <span style={{ fontSize: 20, fontWeight: 900, color: w === match.player1?.id ? C.green : C.text }}>{match.score_player1 ?? '?'}</span>
              <span style={{ color: C.textDim, fontWeight: 700 }}>-</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: w === match.player2?.id ? C.green : C.text }}>{match.score_player2 ?? '?'}</span>
            </>
          ) : (
            <span style={{ color: C.textDim, fontSize: 13, fontWeight: 600 }}>vs</span>
          )}
        </div>

        {/* Player 2 */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', minWidth: 0 }}>
          {w === match.player2?.id && <span style={{ fontSize: 12 }}>🏆</span>}
          <span style={{
            color: w === match.player2?.id ? C.green : C.text,
            fontWeight: w === match.player2?.id ? 800 : 500,
            fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {match.player2?.display_name || '—'}
          </span>
          {avatar(match.player2)}
        </div>
      </div>

      {/* Screenshot */}
      {match.screenshot_url && (
        <a href={match.screenshot_url} target="_blank" rel="noreferrer" style={{ display: 'block', background: C.panel2, borderRadius: 8, overflow: 'hidden', maxHeight: 120 }}>
          <img src={match.screenshot_url} alt="Captura" style={{ width: '100%', objectFit: 'cover', maxHeight: 120 }} />
        </a>
      )}

      {/* Actions */}
      {(isParticipant || isAdmin) && !finished && (
        <div style={{ display: 'flex', gap: 8 }}>
          {(isParticipant || isAdmin) && (
            <button onClick={() => setShowReport(true)} style={{ flex: 1, padding: '8px', background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}44`, borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              📸 Reportar resultado
            </button>
          )}
          {isParticipant && onChat && (
            <button onClick={() => onChat(match)} style={{ padding: '8px 12px', background: C.panel2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              💬 Hablar
            </button>
          )}
        </div>
      )}

      {showReport && (
        <ReportModal
          match={match}
          profile={profile}
          onClose={() => setShowReport(false)}
          onSaved={onReported}
        />
      )}
    </div>
  )
}

// ── Fixture principal ─────────────────────────────────────────────────────────
export default function FixtureTab({ tournamentId, profile, isAdmin, onOpenChat }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from('tournament_matches')
      .select('id, round_number, round_label, phase, status, score_player1, score_player2, winner_id, screenshot_url, player1_id, player2_id')
      .eq('tournament_id', tournamentId)
      .order('round_number', { ascending: true })
      .order('created_at', { ascending: true })

    if (!rows?.length) { setMatches([]); setLoading(false); return }

    const userIds = [...new Set(rows.flatMap(r => [r.player1_id, r.player2_id].filter(Boolean)))]
    const { data: profiles } = await supabase.from('users').select('id, display_name, username, avatar_url').in('id', userIds)
    const pm = Object.fromEntries((profiles || []).map(p => [p.id, p]))

    setMatches(rows.map(r => ({
      ...r,
      player1: pm[r.player1_id] || null,
      player2: pm[r.player2_id] || null,
    })))
    setLoading(false)
  }, [tournamentId])

  useEffect(() => { load() }, [load])

  const FILTER_TABS = [
    { id: 'all',        label: 'Todos' },
    { id: 'pendiente',  label: 'Pendientes' },
    { id: 'finalizado', label: 'Finalizados' },
  ]

  const filtered = filter === 'all' ? matches : matches.filter(m => m.status === filter)

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
      {[1,2,3].map(i => <div key={i} style={{ height: 100, background: C.panel, borderRadius: 14 }} />)}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter */}
      <div style={{ padding: '10px 16px', display: 'flex', gap: 6, borderBottom: `1px solid ${C.border}` }}>
        {FILTER_TABS.map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: filter === t.id ? C.green : C.panel,
            color: filter === t.id ? '#000' : C.textDim,
            fontWeight: filter === t.id ? 700 : 500, fontSize: 12,
          }}>{t.label}</button>
        ))}
        <span style={{ marginLeft: 'auto', color: C.textDim, fontSize: 12, alignSelf: 'center' }}>{filtered.length} partidos</span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚽</div>
            <div style={{ color: C.textDim, fontSize: 13 }}>
              {filter === 'all' ? 'No hay partidos generados aún.' : `No hay partidos ${filter === 'pendiente' ? 'pendientes' : 'finalizados'}.`}
            </div>
          </div>
        ) : filtered.map(m => (
          <MatchCard
            key={m.id}
            match={m}
            profile={profile}
            isAdmin={isAdmin}
            onReported={load}
            onChat={onOpenChat}
          />
        ))}
      </div>
    </div>
  )
}
