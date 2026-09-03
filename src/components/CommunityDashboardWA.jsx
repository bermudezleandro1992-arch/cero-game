/**
 * CommunityDashboardWA — skin estilo WhatsApp Communities
 * Skin alternativo: no modifica CommunityDashboard.jsx
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { C } from '../theme'
import TournamentDashboard from './TournamentDashboard'

// ── helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#e91e63','#9c27b0','#1565c0','#00838f','#2e7d32','#e65100','#c62828']
function avatarColor(id) {
  if (!id) return '#888'
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function Avatar({ name, url, size = 48, radius = '50%' }) {
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: radius, flexShrink: 0, background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 800, color: '#fff' }}>
        {name?.slice(0, 2).toUpperCase() || '?'}
      </div>
}

function timeAgo(ts) {
  if (!ts) return ''
  const d = (Date.now() - new Date(ts)) / 1000
  if (d < 60)    return 'ahora'
  if (d < 3600)  return `${Math.floor(d / 60)}m`
  if (d < 86400) return `${Math.floor(d / 3600)}h`
  if (d < 86400 * 7) return `${Math.floor(d / 86400)}d`
  return new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

const PLAYER_EMOJIS = ['⚽','🔥','🐐','💙','⚡','🎯','🏅','👑','🦁','🐺','🌟','💪','🔱','🏹','🎮','🕹️']
function playerEmoji(idx) { return PLAYER_EMOJIS[idx % PLAYER_EMOJIS.length] }

const STATUS_CFG = {
  inscripcion: { label: 'Inscripciones abiertas', color: '#22c55e', dot: '🟢', dotColor: '#22c55e' },
  en_curso:    { label: 'En curso',               color: '#f59e0b', dot: '🟡', dotColor: '#f59e0b' },
  finalizado:  { label: 'Finalizado',             color: '#6b7280', dot: '⚫', dotColor: '#6b7280' },
  draw:        { label: 'Sorteo en curso',         color: '#8b5cf6', dot: '🟣', dotColor: '#8b5cf6' },
  cancelado:   { label: 'Cancelado',              color: '#ef4444', dot: '🔴', dotColor: '#ef4444' },
}

// ── Bot Announcement ──────────────────────────────────────────────────────────
// Publica un aviso bot en la comunidad cuando cambia el estado del torneo
export async function postTournamentBotAnnouncement({ supabase, communityId, authorId, tournament, participants = [] }) {
  if (!communityId || !authorId || !tournament) return

  const s = STATUS_CFG[tournament.tournament_status] || STATUS_CFG.inscripcion
  const isTorneo = tournament.group_type !== 'liga'
  const icon = isTorneo ? '🏆' : '🥇'
  const tipo = isTorneo ? 'TORNEO' : 'LIGA'

  // Construir body del bot
  let body = `${icon} ${tipo}: ${tournament.name}\n`
  if (tournament.game) body += `🎮 ${tournament.game}`
  if (tournament.platform) body += ` • ${tournament.platform}`
  body += '\n'
  if (tournament.organizer_name) body += `Organizador: ${tournament.organizer_name}\n`
  body += `${s.dot} ${s.label}\n`

  if (participants.length > 0) {
    body += `\n👥 PARTICIPANTES\n`
    participants.slice(0, 8).forEach((p, i) => {
      body += `${playerEmoji(i)} ${p.display_name || p.username || 'Jugador'}\n`
    })
    if (participants.length > 8) body += `… y ${participants.length - 8} más\n`
  }

  const title = `${icon} ${tournament.name} — ${s.label}`

  await supabase.from('announcements').insert({
    conversation_id: communityId,
    author_id: authorId,
    title,
    body: body.trim(),
    category: isTorneo ? 'torneo' : 'liga',
    is_active: true,
    tournament_id: tournament.id,
  })
}

// Publica fixture de partidos en el chat del torneo
export async function postFixtureBotMessage({ supabase, tournamentChatId, authorId, matches, tournamentName }) {
  if (!tournamentChatId || !authorId || !matches?.length) return

  for (const m of matches) {
    const p1 = m.player1?.display_name || m.player1?.username || '?'
    const p2 = m.player2?.display_name || m.player2?.username || '?'
    const body = `📅 FIXTURE — ${tournamentName || 'Torneo'}\n\n${playerEmoji(0)} ${p1}\n       VS\n${playerEmoji(1)} ${p2}\n\n🕘 Tienen 10 minutos para coordinar.`
    await supabase.from('messages').insert({
      conversation_id: tournamentChatId,
      sender_id: authorId,
      content: body,
      type: 'bot_fixture',
      metadata: { match_id: m.id, round: m.round_number },
    })
  }
}

// ── TournamentBotCard ─────────────────────────────────────────────────────────
function TournamentBotCard({ aviso, onJoin, onViewTournament, accent, tournamentStatus }) {
  const lines = (aviso.body || '').split('\n')
  // Parse participants de las líneas (líneas que empiezan con emoji jugador)
  const participantLines = lines.filter(l => PLAYER_EMOJIS.some(e => l.startsWith(e)))
  const infoLines = lines.filter(l => !PLAYER_EMOJIS.some(e => l.startsWith(e)) && l.trim() && !l.startsWith('👥'))
  const isLiga = aviso.category === 'liga'
  const canJoin = !tournamentStatus || tournamentStatus === 'inscripcion'

  return (
    <div style={{
      background: C.panel,
      border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${accent || '#22c55e'}`,
      borderRadius: '0 12px 12px 0',
      overflow: 'hidden',
      marginBottom: 2,
    }}>
      <div style={{ padding: '10px 14px 8px' }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 6 }}>{aviso.title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {infoLines.map((l, i) => (
            <div key={i} style={{ fontSize: 12, color: C.text2 }}>{l}</div>
          ))}
        </div>
        {participantLines.length > 0 && (
          <div style={{ marginTop: 8, padding: '8px 10px', background: C.panel2, borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 4 }}>👥 PARTICIPANTES</div>
            {participantLines.map((l, i) => (
              <div key={i} style={{ fontSize: 12, color: C.text, padding: '1px 0' }}>{l}</div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 0, borderTop: `1px solid ${C.border}` }}>
        <button onClick={() => canJoin ? onJoin?.(aviso) : onViewTournament?.(aviso)} style={{
          flex: 1, padding: '10px 8px', background: 'none', border: 'none',
          borderRight: `1px solid ${C.border}`, cursor: 'pointer',
          color: canJoin ? '#22c55e' : C.textDim, fontWeight: 700, fontSize: 12,
        }}>
          {canJoin
            ? (isLiga ? '⚽ UNIRME A LA LIGA' : '🏆 UNIRME AL TORNEO')
            : (tournamentStatus === 'finalizado'
                ? (isLiga ? '🏅 Liga finalizada' : '🏅 Torneo finalizado')
                : (isLiga ? '⚽ Liga en curso' : '⚡ Torneo en curso'))}
        </button>
        <button onClick={() => onViewTournament?.(aviso)} style={{
          flex: 1, padding: '10px 8px', background: 'none', border: 'none',
          cursor: 'pointer', color: C.green, fontWeight: 700, fontSize: 12,
        }}>
          👁 VER
        </button>
      </div>
    </div>
  )
}

// ── FixtureBotCard ────────────────────────────────────────────────────────────
function FixtureBotCard({ aviso, onOpenChat }) {
  const lines = (aviso.body || '').split('\n').filter(Boolean)
  return (
    <div style={{
      background: C.panel,
      border: `1px solid ${C.border}`,
      borderLeft: `4px solid #3b82f6`,
      borderRadius: '0 12px 12px 0',
      overflow: 'hidden',
      marginBottom: 2,
    }}>
      <div style={{ padding: '10px 14px 8px' }}>
        {lines.map((l, i) => (
          <div key={i} style={{ fontSize: i === 0 ? 13 : 12, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? C.text : C.text2, marginBottom: 2 }}>{l}</div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        <button onClick={() => onOpenChat?.(aviso)} style={{
          width: '100%', padding: '10px 8px', background: 'none', border: 'none',
          cursor: 'pointer', color: '#3b82f6', fontWeight: 700, fontSize: 12,
        }}>
          💬 CHAT DEL PARTIDO
        </button>
      </div>
    </div>
  )
}

// ── StandingsBotCard ──────────────────────────────────────────────────────────
function StandingsBotCard({ aviso, onViewTournament }) {
  const lines = (aviso.body || '').split('\n').filter(Boolean)
  const headerLines = lines.filter(l => !l.match(/^\d+\./))
  const rankLines = lines.filter(l => l.match(/^\d+\./))
  return (
    <div style={{
      background: C.panel,
      border: `1px solid ${C.border}`,
      borderLeft: `4px solid #8b5cf6`,
      borderRadius: '0 12px 12px 0',
      overflow: 'hidden',
      marginBottom: 2,
    }}>
      <div style={{ padding: '10px 14px 8px' }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: C.text, marginBottom: 6 }}>{aviso.title}</div>
        {headerLines.map((l, i) => (
          <div key={i} style={{ fontSize: 12, color: C.text2, marginBottom: 2 }}>{l}</div>
        ))}
        {rankLines.length > 0 && (
          <div style={{ marginTop: 8, background: C.panel2, borderRadius: 8, padding: '6px 10px' }}>
            {rankLines.map((l, i) => (
              <div key={i} style={{ fontSize: 12, color: i === 0 ? '#f59e0b' : C.text, padding: '2px 0', fontWeight: i === 0 ? 700 : 400 }}>{l}</div>
            ))}
          </div>
        )}
      </div>
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        <button onClick={() => onViewTournament?.(aviso)} style={{
          width: '100%', padding: '10px 8px', background: 'none', border: 'none',
          cursor: 'pointer', color: '#8b5cf6', fontWeight: 700, fontSize: 12,
        }}>
          📊 VER TABLA COMPLETA
        </button>
      </div>
    </div>
  )
}

// ── ResultadoBotCard ──────────────────────────────────────────────────────────
function ResultadoBotCard({ aviso, onViewTournament }) {
  const lines = (aviso.body || '').split('\n').filter(Boolean)
  const isLiga = aviso.category === 'liga'
  const accent = isLiga ? '#38bdf8' : '#f59e0b'
  const scoreLine = lines.find(l => /\d\s*-\s*\d/.test(l)) || ''
  const winnerLine = lines.find(l => l.startsWith('🏆')) || ''
  const roundLine = lines.find(l => l.startsWith('📍')) || ''
  const headerLine = lines[0] || aviso.title || ''

  return (
    <div style={{
      background: C.panel,
      border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${accent}`,
      borderRadius: '0 12px 12px 0',
      overflow: 'hidden',
      marginBottom: 2,
    }}>
      <div style={{ padding: '10px 14px 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '0.5px', marginBottom: 4, textTransform: 'uppercase' }}>
          {isLiga ? '🥇 RESULTADO — LIGA' : '🏆 RESULTADO — TORNEO'}
        </div>
        {scoreLine && (
          <div style={{ fontSize: 18, fontWeight: 900, color: C.text, textAlign: 'center', padding: '8px 0', letterSpacing: '1px' }}>
            {scoreLine.trim()}
          </div>
        )}
        {winnerLine && (
          <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>{winnerLine}</div>
        )}
        {roundLine && (
          <div style={{ fontSize: 11, color: C.textDim, textAlign: 'center' }}>{roundLine}</div>
        )}
      </div>
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        <button onClick={() => onViewTournament?.(aviso)} style={{
          width: '100%', padding: '9px 8px', background: 'none', border: 'none',
          cursor: 'pointer', color: accent, fontWeight: 700, fontSize: 12,
        }}>
          📊 VER BRACKET
        </button>
      </div>
    </div>
  )
}

// ── AvisosChat — pestaña estilo WhatsApp Avisos ───────────────────────────────
function AvisosChat({ community, announcements, loading, isAdmin, profile, torneos, onOpenTournament, onReload }) {
  const { setActiveConversation } = useChatStore()
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [msgTitle, setMsgTitle] = useState('')
  const [lightboxImg, setLightboxImg] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [announcements.length])

  async function sendAviso(e) {
    e.preventDefault()
    if (!msgTitle.trim()) return
    setSending(true)
    await supabase.from('announcements').insert({
      conversation_id: community.id,
      author_id: profile.id,
      title: msgTitle.trim(),
      body: newMsg.trim() || null,
      category: 'general',
      is_active: true,
    })
    setMsgTitle(''); setNewMsg(''); setSending(false); setShowForm(false)
    onReload?.()
  }

  function detectCardType(a) {
    if (a.category === 'fixture' || a.type === 'bot_fixture') return 'fixture'
    if (a.category === 'standings') return 'standings'
    if (a.category === 'torneo' && /RESULTADO/i.test(a.title || '')) return 'resultado'
    if (a.tournament_id || a.category === 'torneo' || a.category === 'liga') return 'tournament'
    return 'text'
  }

  function openTournamentFromAviso(aviso) {
    const t = torneos?.find(x => x.id === aviso.tournament_id)
    if (t) onOpenTournament?.(t)
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
      <div style={{ width: 26, height: 26, border: `3px solid ${C.border}`, borderTopColor: '#25D366', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    </div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {announcements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', color: C.textDim }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>📢</div>
            <div style={{ fontWeight: 700, color: C.text2 }}>Sin avisos aún</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Los avisos de la comunidad aparecerán acá</div>
          </div>
        ) : (
          announcements.map((a, idx) => {
            const type = detectCardType(a)
            const author = a.author?.display_name || a.author?.username || 'Organizador'
            const isBot = a.author?.is_bot || a.metadata?.is_bot
            return (
              <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Author header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isBot
                    ? <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a1a2e', border: '1.5px solid #25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🤖</div>
                    : (a.author?.avatar_url
                        ? <img src={a.author.avatar_url} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                        : <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(a.author_id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>
                            {author.slice(0, 2).toUpperCase()}
                          </div>
                      )
                  }
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isBot ? '#25D366' : C.text }}>
                      {isBot ? '🤖 Bot Anuncio' : author}
                    </span>
                    {isBot && <span style={{ fontSize: 10, color: C.textDim, letterSpacing: '0.3px' }}>Anuncio automático</span>}
                  </div>
                  <span style={{ fontSize: 11, color: C.textDim, marginLeft: 'auto' }}>{timeAgo(a.created_at)}</span>
                </div>

                {/* Card body */}
                {type === 'resultado' && <ResultadoBotCard aviso={a} onViewTournament={() => openTournamentFromAviso(a)} />}
                {type === 'tournament' && (
                  <TournamentBotCard
                    aviso={a}
                    onJoin={() => openTournamentFromAviso(a)}
                    onViewTournament={() => openTournamentFromAviso(a)}
                    accent={a.category === 'liga' ? '#38bdf8' : '#22c55e'}
                    tournamentStatus={torneos?.find(x => x.id === a.tournament_id)?.tournament_status}
                  />
                )}
                {type === 'fixture' && (
                  <FixtureBotCard aviso={a} onOpenChat={() => openTournamentFromAviso(a)} />
                )}
                {type === 'standings' && (
                  <StandingsBotCard aviso={a} onViewTournament={() => openTournamentFromAviso(a)} />
                )}
                {type === 'text' && (
                  <div style={{
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: '0 12px 12px 12px',
                    padding: '10px 14px',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: a.body ? 4 : 0 }}>{a.title}</div>
                    {a.body && <p style={{ margin: 0, color: C.text2, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{a.body}</p>}
                    {a.image_url && (
                      <>
                        <img
                          src={a.image_url} alt="" onClick={() => setLightboxImg(a.image_url)}
                          style={{ width: '100%', borderRadius: 8, marginTop: 8, objectFit: 'cover', maxHeight: 220, cursor: 'pointer' }}
                        />
                        {lightboxImg && (
                          <div onClick={() => setLightboxImg(null)} style={{ position: 'fixed', inset: 0, background: '#000c', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                            <img src={lightboxImg} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {/* Separator */}
                {idx < announcements.length - 1 && (
                  <div style={{ borderTop: `1px solid ${C.border}22`, marginTop: 4 }} />
                )}
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer — solo informativo */}
      <div style={{ borderTop: `1px solid ${C.border}`, background: C.panel }}>
        <div style={{ padding: '10px 14px', fontSize: 12, color: C.textDim, textAlign: 'center', background: C.panel2 }}>
          <span>📢 Solo quienes administran la comunidad pueden enviar avisos</span>
        </div>
      </div>
    </div>
  )
}

// ── ComunidadTab — estructura y grupos ───────────────────────────────────────
function ComunidadTab({ community, torneos, memberCount, isAdmin, profile, onOpenTournament, onChangeToAvisos, onAddMember, onAddGroup, onAddChannel, channelRefreshKey }) {
  const { setActiveConversation } = useChatStore()
  const [channels, setChannels] = useState([])

  useEffect(() => {
    supabase.from('conversations')
      .select('id, name, description, group_type, is_public')
      .eq('community_id', community.id)
      .eq('group_type', 'channel')
      .order('created_at', { ascending: true })
      .then(({ data }) => setChannels(data || []))
  }, [community.id, channelRefreshKey])

  function openChannel(ch) {
    setActiveConversation({
      ...ch, isGroup: true, isCommunity: false,
      group_type: 'channel',
      is_announcement: ch.is_public === true,
      fromCommunityId: community.id,
    })
  }

  const avisos = channels.find(c => c.is_public || c.name === 'Avisos')
  const otros = channels.filter(c => c.id !== avisos?.id && c.name !== 'Avisos')
  const torneoRows = torneos.filter(t => ['inscripcion','en_curso','draw'].includes(t.tournament_status)).slice(0, 5)
  const allTorneos = torneos.filter(t => ['inscripcion','en_curso','draw','finalizado'].includes(t.tournament_status))

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      {/* Description */}
      {community.description && (
        <div style={{ padding: '14px 16px 0' }}>
          <p style={{ margin: 0, color: C.text2, fontSize: 13, lineHeight: 1.7 }}>{community.description}</p>
        </div>
      )}

      {/* Avisos channel row */}
      {avisos && (
        <div style={{ padding: '10px 16px 0' }}>
          <button onClick={onChangeToAvisos} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0',
            borderBottom: `1px solid ${C.border}22`, textAlign: 'left',
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#22c55e22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, border: `1px solid #22c55e33` }}>
              📢
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>Avisos</div>
              <div style={{ color: C.textDim, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Solo admins pueden publicar</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      )}

      {/* Torneos y Ligas section */}
      {(allTorneos.length > 0 || otros.length > 0) && (
        <div>
          {allTorneos.length > 0 && (
            <div style={{ padding: '14px 16px 6px', color: C.textDim, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Torneos y Ligas
            </div>
          )}
          {/* Torneos */}
          {allTorneos.map(t => {
            const s = STATUS_CFG[t.tournament_status] || STATUS_CFG.inscripcion
            return (
              <button key={t.id} onClick={() => onOpenTournament(t)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '12px 16px', borderBottom: `1px solid ${C.border}22`, textAlign: 'left',
              }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: t.group_type === 'liga' ? '#38bdf822' : '#22c55e22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {t.group_type === 'liga' ? '⚽' : '🏆'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                  <div style={{ color: s.color, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dotColor, display: 'inline-block', flexShrink: 0 }} />
                    {s.label}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            )
          })}
          {/* Otros canales (General, Privado, etc.) */}
          {otros.length > 0 && (
            <div style={{ padding: '14px 16px 6px', color: C.textDim, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Canales
            </div>
          )}
          {otros.map(ch => (
            <button key={ch.id} onClick={() => openChannel(ch)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '12px 16px', borderBottom: `1px solid ${C.border}22`, textAlign: 'left',
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                💬
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{ch.name}</div>
                {ch.description && <div style={{ color: C.textDim, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.description}</div>}
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          ))}
        </div>
      )}

      {allTorneos.length === 0 && otros.length === 0 && !avisos && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: C.textDim }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
          <div style={{ fontSize: 13 }}>Los grupos añadidos a la comunidad aparecerán aquí.</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Los miembros de la comunidad pueden unirse a ellos.</div>
        </div>
      )}

      {/* Miembros section */}
      <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}22`, marginTop: 8 }}>
        <div style={{ color: C.textDim, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
          Miembros de la comunidad
        </div>
        <div style={{ color: C.text2, fontSize: 12 }}>
          👥 {memberCount} miembro{memberCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ height: 1, background: C.border, margin: '8px 0 16px' }} />
          <div style={{ color: C.textDim, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Administración</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onAddGroup} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.panel2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👥+</div>
              <span style={{ fontSize: 11, color: C.textDim, textAlign: 'center' }}>Añadir grupos</span>
            </button>
            <button onClick={onAddChannel} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.panel2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>#️⃣</div>
              <span style={{ fontSize: 11, color: C.textDim, textAlign: 'center' }}>Añadir canal</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main CommunityDashboardWA ─────────────────────────────────────────────────
export default function CommunityDashboardWA({ community, onBack }) {
  const { profile } = useAuthStore()
  const [myRole, setMyRole] = useState(community.myRole || null)
  const [tab, setTab] = useState('comunidad')
  const [torneos, setTorneos] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [memberCount, setMemberCount] = useState(0)
  const [annLoading, setAnnLoading] = useState(true)
  const [viewingTournament, setViewingTournament] = useState(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [groupSearch, setGroupSearch] = useState('')
  const [groupResults, setGroupResults] = useState([])
  const [showAddChannel, setShowAddChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelDesc, setNewChannelDesc] = useState('')
  const [newChannelPrivate, setNewChannelPrivate] = useState(false)
  const [creatingChannel, setCreatingChannel] = useState(false)
  const [channelRefreshKey, setChannelRefreshKey] = useState(0)
  const [addingGroupId, setAddingGroupId] = useState(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const [addingMemberId, setAddingMemberId] = useState(null)

  const isAdmin = community.created_by === profile?.id
    || myRole === 'owner' || myRole === 'admin'
    || profile?.role === 'superadmin' || profile?.role === 'admin'

  useEffect(() => {
    if (!profile?.id || !community?.id) return
    supabase.from('conversation_members').select('role')
      .eq('conversation_id', community.id).eq('user_id', profile.id).single()
      .then(({ data }) => { if (data?.role) setMyRole(data.role) })
  }, [profile?.id, community?.id])

  async function searchUsers(q) {
    if (!q.trim()) { setMemberResults([]); return }
    const { data } = await supabase.from('users')
      .select('id, display_name, username, avatar_url')
      .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
      .limit(10)
    setMemberResults(data || [])
  }

  async function searchGroups(q) {
    if (!q.trim()) { setGroupResults([]); return }
    const { data } = await supabase.from('conversations')
      .select('id, name, group_type, banner_url')
      .eq('type', 'group')
      .neq('id', community.id)
      .ilike('name', `%${q}%`)
      .limit(10)
    setGroupResults(data || [])
  }

  async function addGroupToComm(groupId) {
    setAddingGroupId(groupId)
    const { error } = await supabase.from('conversations')
      .update({ community_id: community.id })
      .eq('id', groupId)
    if (error) { alert(`Error al agregar grupo: ${error.message}`) }
    else { loadData(); setGroupResults(r => r.filter(g => g.id !== groupId)) }
    setAddingGroupId(null)
  }

  async function createChannel() {
    if (!newChannelName.trim()) return
    setCreatingChannel(true)
    const { data: conv, error } = await supabase.from('conversations').insert({
      name: newChannelName.trim(),
      description: newChannelDesc.trim() || null,
      group_type: 'channel',
      is_group: true,
      community_id: community.id,
      created_by: profile?.id,
      is_public: !newChannelPrivate,
    }).select('id').single()
    if (error) { alert(`Error: ${error.message}`); setCreatingChannel(false); return }
    // add creator as member/admin
    if (conv?.id) {
      await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: profile.id, role: 'admin' })
    }
    setCreatingChannel(false)
    setShowAddChannel(false)
    setNewChannelName('')
    setNewChannelDesc('')
    setNewChannelPrivate(false)
    setChannelRefreshKey(k => k + 1)
    loadData()
  }

  async function addMemberToComm(userId) {
    setAddingMemberId(userId)
    const { error } = await supabase.rpc('add_community_member', {
      p_conversation_id: community.id,
      p_user_id: userId,
    })
    if (error) { alert(`Error al agregar: ${error.message}`) }
    else { loadData(); setMemberResults(r => r.filter(u => u.id !== userId)) }
    setAddingMemberId(null)
  }

  const loadData = useCallback(async () => {
    if (!community?.id) return
    const [tRes, mRes] = await Promise.all([
      supabase.from('conversations')
        .select('id, name, group_type, tournament_status, max_participants, game, created_by, created_at')
        .eq('community_id', community.id)
        .in('group_type', ['tournament', 'liga'])
        .order('created_at', { ascending: false }),
      supabase.rpc('get_conversation_members', { p_conversation_ids: [community.id] }),
    ])
    // Incluir avisos de la comunidad Y de sus torneos/ligas
    const subIds = (tRes.data || []).map(t => t.id)
    const allIds = [community.id, ...subIds]
    const { data: annData } = await supabase
      .from('announcements')
      .select('*, author:users!announcements_author_id_fkey(id, display_name, username, avatar_url, is_bot)')
      .in('conversation_id', allIds)
      .order('created_at', { ascending: true })
      .limit(100)
    setTorneos(tRes.data || [])
    setAnnouncements(annData || [])
    setMemberCount((mRes.data || []).length)
    setAnnLoading(false)
  }, [community?.id])

  useEffect(() => { loadData() }, [loadData])

  // Realtime: nuevo aviso + cambios de estado en torneos/ligas
  useEffect(() => {
    if (!community?.id) return
    const ch = supabase.channel(`wa-ann-${community.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, () => loadData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations',
          filter: `community_id=eq.${community.id}` }, () => loadData())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [community?.id, loadData])

  if (viewingTournament) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
        {/* Header torneo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={() => { setViewingTournament(null); loadData() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {viewingTournament.name}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <TournamentDashboard
            tournamentId={viewingTournament.id}
            profile={profile}
            isAdmin={isAdmin || viewingTournament.created_by === profile?.id}
            showBotButton={isAdmin || viewingTournament.created_by === profile?.id}
            onBack={() => { setViewingTournament(null); loadData() }}
            communityId={community.id}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>
      {/* Header WhatsApp style */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 8px' }}>
          {onBack && (
            <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
          )}
          {/* Avatar small in header */}
          <Avatar name={community.name} url={community.avatar_url} size={36} radius="50%" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{community.name}</div>
            <div style={{ color: C.textDim, fontSize: 11 }}>Comunidad · {memberCount} miembro{memberCount !== 1 ? 's' : ''}</div>
          </div>
          {/* 3 dots menu placeholder */}
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, fontSize: 18 }}>⋮</button>
        </div>

        {/* Big avatar + name (WhatsApp community header) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 12, gap: 6 }}>
          <Avatar name={community.name} url={community.avatar_url} size={72} radius={16} />
          <div style={{ color: C.text, fontWeight: 900, fontSize: 20, textAlign: 'center', padding: '0 16px' }}>{community.name}</div>
          <div style={{ color: C.textDim, fontSize: 12 }}>Comunidad · {torneos.length} grupo{torneos.length !== 1 ? 's' : ''}</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderTop: `1px solid ${C.border}22` }}>
          {[
            { id: 'comunidad', label: 'Comunidad' },
            { id: 'avisos',    label: 'Avisos' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              padding: '12px 8px', fontSize: 14, fontWeight: 700, color: tab === t.id ? '#25D366' : C.textDim,
              borderBottom: `3px solid ${tab === t.id ? '#25D366' : 'transparent'}`,
              transition: 'all .15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'comunidad' && (
          <ComunidadTab
            community={community}
            torneos={torneos}
            memberCount={memberCount}
            isAdmin={isAdmin}
            profile={profile}
            onOpenTournament={setViewingTournament}
            onChangeToAvisos={() => setTab('avisos')}
            onAddMember={() => { setShowAddMember(true); setMemberSearch(''); setMemberResults([]) }}
            onAddGroup={() => { setShowAddGroup(true); setGroupSearch(''); setGroupResults([]) }}
            onAddChannel={() => { setShowAddChannel(true); setNewChannelName(''); setNewChannelDesc(''); setNewChannelPrivate(false) }}
            channelRefreshKey={channelRefreshKey}
          />
        )}
        {tab === 'avisos' && (
          <AvisosChat
            community={community}
            announcements={announcements}
            loading={annLoading}
            isAdmin={isAdmin}
            profile={profile}
            torneos={torneos}
            onOpenTournament={setViewingTournament}
            onReload={loadData}
          />
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Modal: Añadir miembro */}
      {showAddMember && createPortal(
        <div onClick={() => setShowAddMember(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.panel, borderRadius: '20px 20px 0 0', padding: '20px 16px 32px', width: '100%', maxWidth: 480, maxHeight: '75vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: C.text }}>👤 Añadir miembro</p>
              <button onClick={() => setShowAddMember(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 20 }}>✕</button>
            </div>
            <input
              autoFocus
              value={memberSearch}
              onChange={e => { setMemberSearch(e.target.value); searchUsers(e.target.value) }}
              placeholder="Buscar por nombre o usuario…"
              style={{ padding: '10px 14px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontSize: 14, outline: 'none' }}
            />
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {memberResults.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: C.panel2 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (u.display_name?.[0] || u.username?.[0] || '?').toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.display_name || u.username}</div>
                    {u.username && <div style={{ color: C.textDim, fontSize: 12 }}>@{u.username}</div>}
                  </div>
                  <button
                    onClick={() => addMemberToComm(u.id)}
                    disabled={addingMemberId === u.id}
                    style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: '#25D366', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: addingMemberId === u.id ? 0.5 : 1 }}
                  >
                    {addingMemberId === u.id ? '…' : 'Añadir'}
                  </button>
                </div>
              ))}
              {memberSearch && !memberResults.length && (
                <p style={{ margin: 0, textAlign: 'center', color: C.textDim, fontSize: 13, padding: 16 }}>No se encontraron usuarios</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Añadir grupos */}
      {showAddGroup && createPortal(
        <div onClick={() => setShowAddGroup(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.panel, borderRadius: '20px 20px 0 0', padding: '20px 16px 32px', width: '100%', maxWidth: 480, maxHeight: '75vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: C.text }}>👥 Añadir grupo a la comunidad</p>
              <button onClick={() => setShowAddGroup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 20 }}>✕</button>
            </div>
            <input
              autoFocus
              value={groupSearch}
              onChange={e => { setGroupSearch(e.target.value); searchGroups(e.target.value) }}
              placeholder="Buscar grupo por nombre…"
              style={{ padding: '10px 14px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontSize: 14, outline: 'none' }}
            />
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {groupResults.map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: C.panel2 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: avatarColor(g.id), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {g.banner_url ? <img src={g.banner_url} alt="" style={{ width: '100%', height: '100%', borderRadius: 10, objectFit: 'cover' }} /> : (g.name?.[0] || '?').toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                    <div style={{ color: C.textDim, fontSize: 12 }}>{g.group_type || 'Grupo'}</div>
                  </div>
                  <button
                    onClick={() => addGroupToComm(g.id)}
                    disabled={addingGroupId === g.id}
                    style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: '#25D366', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: addingGroupId === g.id ? 0.5 : 1 }}
                  >
                    {addingGroupId === g.id ? '…' : 'Añadir'}
                  </button>
                </div>
              ))}
              {groupSearch && !groupResults.length && (
                <p style={{ margin: 0, textAlign: 'center', color: C.textDim, fontSize: 13, padding: 16 }}>No se encontraron grupos</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Añadir canal */}
      {showAddChannel && createPortal(
        <div onClick={() => setShowAddChannel(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.panel, borderRadius: '20px 20px 0 0', padding: '20px 16px 32px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: C.text }}>#️⃣ Nuevo canal</p>
              <button onClick={() => setShowAddChannel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 20 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>Nombre del canal</label>
              <input
                autoFocus
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                placeholder="ej: general, anuncios, resultados…"
                maxLength={40}
                style={{ padding: '10px 14px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontSize: 14, outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>Descripción (opcional)</label>
              <input
                value={newChannelDesc}
                onChange={e => setNewChannelDesc(e.target.value)}
                placeholder="Para qué sirve este canal…"
                maxLength={120}
                style={{ padding: '10px 14px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontSize: 14, outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, background: C.panel2, border: `1px solid ${C.border}` }}>
              <div>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>🔒 Canal privado</div>
                <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>Solo admins y organizadores pueden ver este canal</div>
              </div>
              <button
                onClick={() => setNewChannelPrivate(p => !p)}
                style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: newChannelPrivate ? '#25D366' : C.border, transition: 'background 0.2s', position: 'relative', flexShrink: 0 }}
              >
                <span style={{ position: 'absolute', top: 2, left: newChannelPrivate ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
              </button>
            </div>
            <button
              onClick={createChannel}
              disabled={!newChannelName.trim() || creatingChannel}
              style={{ padding: '13px', borderRadius: 14, border: 'none', background: newChannelName.trim() ? '#25D366' : C.border, color: newChannelName.trim() ? '#fff' : C.textDim, fontWeight: 800, fontSize: 15, cursor: newChannelName.trim() ? 'pointer' : 'default', transition: 'background 0.2s' }}
            >
              {creatingChannel ? 'Creando…' : 'Crear canal'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
