import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { getLimits } from '../lib/roles'
import { C } from '../theme'
import BracketsPage from './tools/BracketsPage'
import TablaPosicionesPage from './tools/TablaPosicionesPage'

const STATUS_CFG = {
  inscripcion: { label: 'Inscripción', color: '#22c55e', bg: '#22c55e18' },
  en_curso:    { label: 'En Curso',    color: '#fb8c00', bg: '#fb8c0018' },
  finalizado:  { label: 'Finalizado',  color: '#64748b', bg: '#64748b18' },
  cancelado:   { label: 'Cancelado',   color: '#ef4444', bg: '#ef444418' },
}

const TYPE_CFG = {
  tournament: { label: 'Torneo', icon: '🏆', color: '#f59e0b' },
  liga:       { label: 'Liga',   icon: '🥇', color: '#3b82f6' },
}

const GAME_CATALOG = [
  { id: 'fc26',        icon: '⚽', label: 'FC 26' },
  { id: 'fc27',        icon: '⚽', label: 'FC 27' },
  { id: 'efootball',   icon: '⚽', label: 'eFootball' },
  { id: 'cs2',         icon: '🎯', label: 'CS2' },
  { id: 'valorant',    icon: '🎯', label: 'Valorant' },
  { id: 'warzone',     icon: '🔫', label: 'Warzone' },
  { id: 'pubg',        icon: '🔫', label: 'PUBG' },
  { id: 'clashroyale', icon: '👑', label: 'Clash Royale' },
  { id: 'freef',       icon: '🔥', label: 'Free Fire' },
  { id: 'otro',        icon: '🎮', label: 'Otro' },
]

const FORMATS = ['1vs1', '2vs2', 'Equipos', 'Liga', 'Copa', 'Bracket', 'Grupos + Playoffs']

function gameLabel(id) {
  return GAME_CATALOG.find(g => g.id === id)?.label || id || '—'
}

function gameIcon(id) {
  return GAME_CATALOG.find(g => g.id === id)?.icon || '🎮'
}

// ── Create form ───────────────────────────────────────────────────────────────
function CreateForm({ communityId, communityTags, onCreated, onCancel }) {
  const { profile } = useAuthStore()
  const limits = getLimits(profile)

  const [type, setType] = useState('tournament')
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [game, setGame] = useState(communityTags?.[0] || '')
  const [maxPl, setMaxPl] = useState(String(Math.min(8, limits.maxParticipants)))
  const [format, setFormat] = useState(FORMATS[0])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function handleCreate() {
    if (!name.trim()) { setErr('Ponele un nombre.'); return }
    const reqMax = parseInt(maxPl) || 2
    if (reqMax > limits.maxParticipants) {
      setErr(`Tu rol permite máximo ${limits.maxParticipants} participantes.`)
      return
    }
    setBusy(true); setErr('')
    try {
      // Backend validation
      const { data: val } = await supabase.rpc('validate_tournament_creation', { p_max_participants: reqMax })
      if (val && !val.ok) {
        if (val.error === 'daily_limit_reached') {
          setErr(`Límite diario alcanzado (${val.daily_limit} por día).`)
        } else if (val.error === 'participant_limit_exceeded') {
          setErr(`Máximo ${val.max_participants} participantes para tu rol.`)
        } else {
          setErr('No se pudo crear. Revisá tu plan.')
        }
        setBusy(false); return
      }

      const { data: conv, error: convErr } = await supabase.from('conversations').insert({
        name: name.trim(),
        description: desc.trim() || null,
        is_group: true,
        group_type: type,
        community_id: communityId,
        created_by: profile.id,
        game: game || null,
        max_participants: reqMax,
        tournament_format: format,
        tournament_status: 'inscripcion',
      }).select('id').single()
      if (convErr) throw convErr

      await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: profile.id })
      onCreated()
    } catch (e) {
      setErr(e.message || 'Error al crear.')
      setBusy(false)
    }
  }

  const inp = {
    background: C.panel2, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '9px 12px', color: C.text, fontSize: 14,
    width: '100%', boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: C.text }}>Nuevo {TYPE_CFG[type].label}</p>

      {/* Type toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        {Object.entries(TYPE_CFG).map(([k, v]) => (
          <button key={k} onClick={() => setType(k)} style={{
            flex: 1, padding: '8px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: type === k ? C.green : C.panel2,
            color: type === k ? C.bg : C.text2, fontWeight: 600, fontSize: 13,
          }}>
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      <input style={inp} placeholder="Nombre *" value={name} onChange={e => setName(e.target.value)} maxLength={60} />
      <textarea style={{ ...inp, resize: 'vertical', minHeight: 60 }} placeholder="Descripción (opcional)" value={desc} onChange={e => setDesc(e.target.value)} maxLength={300} />

      {/* Game */}
      <div>
        <p style={{ margin: '0 0 6px', fontSize: 12, color: C.textDim }}>Juego</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {GAME_CATALOG.map(g => (
            <button key={g.id} onClick={() => setGame(g.id)} style={{
              padding: '5px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
              background: game === g.id ? C.green : C.panel2,
              color: game === g.id ? C.bg : C.text2, fontWeight: game === g.id ? 700 : 400,
            }}>
              {g.icon} {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Max participants */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: C.textDim }}>Máx. participantes (hasta {limits.maxParticipants})</p>
          <input style={inp} type="number" min={2} max={limits.maxParticipants} value={maxPl} onChange={e => setMaxPl(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: C.textDim }}>Formato</p>
          <select style={{ ...inp, appearance: 'none' }} value={format} onChange={e => setFormat(e.target.value)}>
            {FORMATS.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {err && <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>{err}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${C.border}`,
          background: 'none', color: C.text2, cursor: 'pointer', fontSize: 14,
        }}>Cancelar</button>
        <button onClick={handleCreate} disabled={busy} style={{
          flex: 2, padding: '10px', borderRadius: 10, border: 'none',
          background: busy ? C.panel2 : C.green, color: busy ? C.textDim : C.bg,
          fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontSize: 14,
        }}>
          {busy ? 'Creando…' : `Crear ${TYPE_CFG[type].label}`}
        </button>
      </div>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function TournamentCard({ item, onOpenBracket, onOpenStandings, onJoin, myId }) {
  const st = STATUS_CFG[item.tournament_status] || STATUS_CFG.inscripcion
  const ty = TYPE_CFG[item.group_type] || TYPE_CFG.tournament
  const joined = item.members?.some(m => m.user_id === myId)

  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: '14px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>{ty.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
          </p>
          {item.description && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.description}
            </p>
          )}
        </div>
        <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, flexShrink: 0 }}>
          {st.label}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {item.game && (
          <span style={{ fontSize: 11, color: C.textDim, background: C.panel2, padding: '3px 8px', borderRadius: 20 }}>
            {gameIcon(item.game)} {gameLabel(item.game)}
          </span>
        )}
        {item.tournament_format && (
          <span style={{ fontSize: 11, color: C.textDim, background: C.panel2, padding: '3px 8px', borderRadius: 20 }}>
            {item.tournament_format}
          </span>
        )}
        <span style={{ fontSize: 11, color: C.textDim, background: C.panel2, padding: '3px 8px', borderRadius: 20 }}>
          👥 {item.members?.length || 0}/{item.max_participants || '?'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {item.tournament_status === 'inscripcion' && !joined && (
          <button onClick={() => onJoin(item.id)} style={{
            flex: 1, padding: '7px', borderRadius: 8, border: 'none',
            background: C.green, color: C.bg, fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>
            Inscribirme
          </button>
        )}
        {joined && (
          <span style={{ flex: 1, textAlign: 'center', fontSize: 12, color: C.green, fontWeight: 700, padding: '7px' }}>
            ✓ Inscripto
          </span>
        )}
        <button onClick={() => onOpenBracket(item)} style={{
          padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
          background: 'none', color: C.text2, fontSize: 12, cursor: 'pointer',
        }}>
          🏆 Bracket
        </button>
        <button onClick={() => onOpenStandings(item)} style={{
          padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
          background: 'none', color: C.text2, fontSize: 12, cursor: 'pointer',
        }}>
          📊 Tabla
        </button>
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function CommunityTournamentsPanel({ community, onClose }) {
  const { profile } = useAuthStore()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [bracketItem, setBracketItem] = useState(null)
  const [standingsItem, setStandingsItem] = useState(null)
  const [filter, setFilter] = useState('all') // all | tournament | liga

  const communityTags = community?.tags || []

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('conversations')
      .select('id, name, description, group_type, tournament_status, tournament_format, game, max_participants, members:conversation_members(user_id)')
      .eq('community_id', community.id)
      .in('group_type', ['tournament', 'liga'])
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { if (community?.id) load() }, [community?.id])

  async function handleJoin(convId) {
    if (!profile?.id) return
    await supabase.from('conversation_members').upsert({ conversation_id: convId, user_id: profile.id }, { onConflict: 'conversation_id,user_id' })
    load()
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.group_type === filter)

  if (bracketItem) return <BracketsPage tournamentId={bracketItem.id} tournamentName={bracketItem.name} onBack={() => setBracketItem(null)} />
  if (standingsItem) return <TablaPosicionesPage tournamentId={standingsItem.id} tournamentName={standingsItem.name} onBack={() => setStandingsItem(null)} />

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: C.bg, display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: C.panel, padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: '4px 8px 4px 0' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: C.text }}>🏆 Torneos & Ligas</p>
          <p style={{ margin: 0, fontSize: 11, color: C.textDim }}>{community?.name}</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          background: C.green, border: 'none', borderRadius: 10, padding: '7px 14px',
          color: C.bg, fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          + Crear
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 14px 0', flexShrink: 0 }}>
        {[['all','Todos'],['tournament','Torneos'],['liga','Ligas']].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
            background: filter === k ? C.green : C.panel2,
            color: filter === k ? C.bg : C.text2, fontWeight: filter === k ? 700 : 400,
          }}>
            {l}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <CreateForm
            communityId={community.id}
            communityTags={communityTags}
            onCreated={() => { setShowCreate(false); load() }}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {loading ? (
          <p style={{ color: C.textDim, textAlign: 'center', fontSize: 13, marginTop: 40 }}>Cargando…</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            <p style={{ color: C.textDim, fontSize: 14, margin: 0 }}>No hay {filter === 'all' ? 'torneos ni ligas' : filter === 'tournament' ? 'torneos' : 'ligas'} aún.</p>
            <p style={{ color: C.textDim, fontSize: 12, margin: '4px 0 0' }}>Creá el primero con el botón + Crear.</p>
          </div>
        ) : filtered.map(item => (
          <TournamentCard
            key={item.id}
            item={item}
            myId={profile?.id}
            onJoin={handleJoin}
            onOpenBracket={setBracketItem}
            onOpenStandings={setStandingsItem}
          />
        ))}
      </div>
    </div>
  )
}
