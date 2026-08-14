import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { C } from '../theme'

function Avatar({ name, size = 46, color, url }) {
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: color || C.panel2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.36, fontWeight: 700, color: '#fff',
      }}>
        {name?.slice(0, 2).toUpperCase() || '🏆'}
      </div>
    )
}

const STATUS_CFG = {
  inscripcion: { label: 'Inscripción', color: C.green,  bg: `${C.green}18`  },
  en_curso:    { label: 'En Curso',    color: '#fb8c00', bg: '#fb8c0018'     },
  finalizado:  { label: 'Finalizado',  color: C.textDim, bg: C.panel2        },
  cancelado:   { label: 'Cancelado',   color: C.red,     bg: `${C.red}18`    },
}

export default function TournamentsPage() {
  const { profile } = useAuthStore()
  const { conversations, setActiveConversation, createGroup } = useChatStore()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState('all')

  // Form state
  const [tName, setTName]       = useState('')
  const [tGame, setTGame]       = useState('FC 26')
  const [tFormat, setTFormat]   = useState('1vs1')
  const [tMaxPl, setTMaxPl]     = useState('16')
  const [tDeadline, setTDeadline] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadTournaments()
  }, [profile?.id])

  async function loadTournaments() {
    setLoading(true)
    // Tournaments are community-type conversations with group_type = 'tournament'
    // OR we read from a tournaments table if it exists
    const tournamentConvs = conversations.filter(c => c.group_type === 'tournament' || c.isTournament)

    // Also try dedicated tournaments table
    const { data: rows } = await supabase
      .from('conversations')
      .select('id, name, description, created_at, created_by, group_type')
      .eq('group_type', 'tournament')
      .order('created_at', { ascending: false })

    if (rows) {
      // Enrich with member count
      const enriched = await Promise.all(rows.map(async (t) => {
        const { count } = await supabase
          .from('conversation_members')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', t.id)
        return { ...t, memberCount: count || 0 }
      }))
      setTournaments(enriched)
    }
    setLoading(false)
  }

  async function handleCreate() {
    if (!tName.trim()) return
    setCreating(true)
    try {
      const desc = `${tGame} · ${tFormat} · Hasta ${tMaxPl} jugadores${tDeadline ? ` · Cierre: ${tDeadline}` : ''}`
      // Create as a community-type conversation tagged as tournament
      const { data: conv } = await supabase
        .from('conversations')
        .insert({
          name: tName.trim(),
          is_group: true,
          group_type: 'tournament',
          description: desc,
          created_by: profile.id,
        })
        .select()
        .single()

      if (conv) {
        // Add creator as member
        await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: profile.id })
        // Create default topics
        await supabase.from('topics').insert([
          { conversation_id: conv.id, name: 'Anuncios',    emoji: '📢', topic_type: 'announcements', position: 0 },
          { conversation_id: conv.id, name: 'Chat',        emoji: '💬', topic_type: 'chat',          position: 1 },
          { conversation_id: conv.id, name: 'Resultados',  emoji: '📸', topic_type: 'chat',          position: 2 },
        ])
        // System message
        await supabase.from('messages').insert({
          conversation_id: conv.id, sender_id: profile.id, type: 'system',
          content: `🏆 Torneo "${tName.trim()}" creado · ${tGame} ${tFormat}`,
        })
        await loadTournaments()
        setShowCreate(false)
        setTName(''); setTGame('FC 26'); setTFormat('1vs1'); setTMaxPl('16'); setTDeadline('')
      }
    } catch (e) { alert(`Error: ${e.message}`) }
    setCreating(false)
  }

  async function joinTournament(tournamentId) {
    const already = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('conversation_id', tournamentId)
      .eq('user_id', profile.id)
      .maybeSingle()
    if (already.data) {
      // Already joined — open chat
      const conv = { id: tournamentId, isGroup: true, isTournament: true, name: tournaments.find(t => t.id === tournamentId)?.name }
      setActiveConversation(conv)
      return
    }
    await supabase.from('conversation_members').insert({ conversation_id: tournamentId, user_id: profile.id })
    alert('¡Inscripto! Ahora tenés acceso al torneo.')
    await loadTournaments()
  }

  function openTournamentChat(t) {
    setActiveConversation({
      id: t.id, isGroup: true, isTournament: true, name: t.name,
      description: t.description, members: [],
    })
  }

  const GAMES = ['FC 26', 'FC 25', 'eFootball', 'FIFA', 'Otro']
  const FORMATS = ['1vs1', '2vs2', 'Equipos', 'Liga', 'Copa']

  const filtered = filter === 'all' ? tournaments : tournaments.filter(t => t.status === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px', background: C.panel,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🏆</span>
            <span style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>Torneos</span>
          </div>
          <button onClick={() => setShowCreate(v => !v)} style={{
            background: showCreate ? `${C.green}22` : C.green,
            border: 'none', borderRadius: 10, color: showCreate ? C.green : C.bg,
            fontSize: 13, fontWeight: 700, padding: '8px 14px', cursor: 'pointer',
          }}>
            {showCreate ? '✕ Cancelar' : '+ Crear'}
          </button>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ id: 'all', label: 'Todos' }, { id: 'inscripcion', label: '🟢 Abiertos' }, { id: 'en_curso', label: '🟡 En curso' }].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              background: filter === f.id ? `${C.green}20` : C.panel2,
              border: `1px solid ${filter === f.id ? C.green : C.border}`,
              borderRadius: 20, color: filter === f.id ? C.green : C.text2,
              fontSize: 12, padding: '4px 12px', cursor: 'pointer',
              fontWeight: filter === f.id ? 700 : 400, transition: 'all .15s',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{
          background: C.panel2, borderBottom: `1px solid ${C.border}`,
          padding: '16px', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <p style={{ margin: 0, color: C.green, fontWeight: 700, fontSize: 14 }}>🏆 Nuevo torneo</p>
          <input value={tName} onChange={e => setTName(e.target.value)} placeholder="Nombre del torneo *"
            style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: '10px 12px', outline: 'none' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <select value={tGame} onChange={e => setTGame(e.target.value)} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, padding: '10px 12px', outline: 'none' }}>
              {GAMES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={tFormat} onChange={e => setTFormat(e.target.value)} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, padding: '10px 12px', outline: 'none' }}>
              {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input value={tMaxPl} onChange={e => setTMaxPl(e.target.value)} placeholder="Máx. jugadores" type="number"
              style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, padding: '10px 12px', outline: 'none' }} />
            <input value={tDeadline} onChange={e => setTDeadline(e.target.value)} type="date"
              style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, padding: '10px 12px', outline: 'none' }} />
          </div>
          <button onClick={handleCreate} disabled={creating || !tName.trim()} style={{
            background: creating || !tName.trim() ? C.panel : C.green, border: 'none',
            borderRadius: 10, color: C.bg, fontWeight: 700, fontSize: 14,
            padding: '12px', cursor: 'pointer',
          }}>{creating ? 'Creando...' : '🏆 Crear torneo'}</button>
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ height: 90, background: C.panel, borderRadius: 16 }} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 }}>
            <span style={{ fontSize: 48 }}>🏆</span>
            <p style={{ color: C.textDim, fontSize: 14, margin: 0, textAlign: 'center' }}>
              No hay torneos. ¡Creá el primero!
            </p>
          </div>
        )}

        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(t => {
            const statusCfg = STATUS_CFG[t.status] || STATUS_CFG.inscripcion
            const isCreator = t.created_by === profile?.id
            return (
              <div key={t.id} style={{
                background: C.panel, borderRadius: 16, overflow: 'hidden',
                border: `1px solid ${C.border}`,
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}>
                {/* Top bar */}
                <div style={{
                  background: `linear-gradient(135deg, ${C.greenDk}44 0%, transparent 60%)`,
                  padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                    background: `${C.green}18`, border: `1px solid ${C.green}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                  }}>🏆</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ margin: 0, color: C.text, fontWeight: 800, fontSize: 15 }}>{t.name}</p>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                        background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.color}33`,
                      }}>{statusCfg.label}</span>
                    </div>
                    {t.description && (
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: C.textDim, lineHeight: 1.4 }}>{t.description}</p>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{
                  display: 'flex', gap: 16, padding: '8px 16px',
                  borderTop: `1px solid ${C.border}22`,
                }}>
                  <span style={{ fontSize: 12, color: C.textDim }}>👥 {t.memberCount} jugadores</span>
                  {t.created_at && <span style={{ fontSize: 12, color: C.textDim }}>📅 {new Date(t.created_at).toLocaleDateString('es-AR')}</span>}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, padding: '8px 16px 14px' }}>
                  <button onClick={() => openTournamentChat(t)} style={{
                    flex: 1, padding: '9px', borderRadius: 10,
                    background: `${C.green}18`, border: `1px solid ${C.green}33`,
                    color: C.green, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}>💬 Abrir chat</button>
                  {!isCreator && (
                    <button onClick={() => joinTournament(t.id)} style={{
                      flex: 1, padding: '9px', borderRadius: 10,
                      background: C.green, border: 'none',
                      color: C.bg, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    }}>⚔️ Inscribirse</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
