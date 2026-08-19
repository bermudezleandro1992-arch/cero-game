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

const MODES = [
  { id: '1vs1',   label: '1 vs 1',  icon: '👤' },
  { id: '2vs2',   label: '2 vs 2',  icon: '👥' },
  { id: 'equipos',label: 'Equipos', icon: '⚔️' },
]

// Estructuras disponibles según modo y tipo (torneo vs liga)
function getStructures(mode, type) {
  if (type === 'liga') {
    return [
      { id: 'todos_todos',  label: 'Todos vs Todos',     icon: '🔄', desc: 'Cada uno juega contra todos' },
      { id: 'grupos',       label: 'Grupos + Playoffs',  icon: '🏅', desc: 'Fase de grupos y eliminatorias' },
    ]
  }
  return [
    { id: 'eliminatorias',  label: 'Eliminatorias',      icon: '⚡', desc: 'Perder = eliminado' },
    { id: 'bracket',        label: 'Bracket completo',   icon: '🌳', desc: 'Cuadro con todas las rondas' },
    { id: 'grupos',         label: 'Fase de grupos',     icon: '🔲', desc: 'Grupos + clasificación a playoffs' },
    { id: 'grupos_playoffs',label: 'Grupos + Playoffs',  icon: '🏅', desc: 'Doble fase combinada' },
    { id: 'copa',           label: 'Copa',               icon: '🏆', desc: 'Formato copa, con repechaje' },
  ]
}

const ALL_SIZES = [2, 4, 8, 12, 16, 32, 64, 128]

function getPlanLimits(profile) {
  const role = profile?.role || 'member'
  if (['ceo', 'admin', 'comunidad'].includes(role)) return { max: 9999, label: 'Sin límite' }
  if (role === 'vip')        return { max: 128, label: 'VIP — hasta 128 jugadores' }
  if (role === 'moderador')  return { max: 64,  label: 'Moderador — hasta 64 jugadores' }
  if (role === 'organizador')return { max: 32,  label: 'Organizador — hasta 32 jugadores' }
  return { max: 8, label: 'Gratis — máximo 8 jugadores' }
}

function gameLabel(id) {
  return GAME_CATALOG.find(g => g.id === id)?.label || id || '—'
}

function gameIcon(id) {
  return GAME_CATALOG.find(g => g.id === id)?.icon || '🎮'
}

// ── Create form ───────────────────────────────────────────────────────────────
function CreateForm({ communityId, communityTags, onCreated, onCancel }) {
  const { profile } = useAuthStore()
  const planLimits = getPlanLimits(profile)
  const isFree = planLimits.max <= 8

  const [type,      setType]      = useState('tournament')
  const [name,      setName]      = useState('')
  const [desc,      setDesc]      = useState('')
  const [game,      setGame]      = useState(communityTags?.[0] || '')
  const [mode,      setMode]      = useState('1vs1')
  const [structure, setStructure] = useState('eliminatorias')
  const [maxPl,     setMaxPl]     = useState(Math.min(8, planLimits.max))
  const [busy,      setBusy]      = useState(false)
  const [err,       setErr]       = useState('')

  const structures = getStructures(mode, type)
  // Reset structure if current not valid for new type/mode
  const validStruct = structures.find(s => s.id === structure) ? structure : structures[0].id

  async function handleCreate() {
    if (!name.trim()) { setErr('Ponele un nombre.'); return }
    if (maxPl > planLimits.max) {
      setErr(`Tu plan permite máximo ${planLimits.max} jugadores.`)
      return
    }
    setBusy(true); setErr('')
    try {
      const { data: val } = await supabase.rpc('validate_tournament_creation', { p_max_participants: maxPl })
      if (val && !val.ok) {
        if (val.error === 'daily_limit_reached') {
          setErr(`Límite diario alcanzado (${val.daily_limit} por día).`)
        } else {
          setErr(`Máximo ${val.max_participants} jugadores para tu plan.`)
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
        max_participants: maxPl,
        tournament_mode: mode,
        tournament_format: validStruct,
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

  const lbl = { margin: '0 0 6px', fontSize: 10, fontWeight: 800, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block' }
  const chip = (selected, locked) => ({
    padding: '6px 13px', borderRadius: 20, border: `1px solid ${selected ? C.green : locked ? C.border + '44' : C.border}`,
    background: selected ? C.green : locked ? `${C.panel2}88` : C.panel2,
    color: selected ? C.bg : locked ? C.textDim : C.text2,
    fontWeight: selected ? 700 : 500, fontSize: 12, cursor: locked ? 'not-allowed' : 'pointer',
    opacity: locked ? 0.4 : 1,
  })

  // Only show games the community has set up, or all if none configured
  const gameOptions = communityTags?.length
    ? GAME_CATALOG.filter(g => communityTags.includes(g.id))
    : GAME_CATALOG

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Type toggle */}
      <div style={{ display: 'flex', gap: 6, background: C.panel2, borderRadius: 12, padding: 4 }}>
        {Object.entries(TYPE_CFG).map(([k, v]) => (
          <button key={k} onClick={() => setType(k)} style={{
            flex: 1, padding: '8px', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: type === k ? C.green : 'transparent',
            color: type === k ? C.bg : C.text2, fontWeight: 700, fontSize: 13,
            transition: 'background .15s',
          }}>{v.icon} {v.label}</button>
        ))}
      </div>

      <input style={{
        background: C.panel2, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 14,
        width: '100%', boxSizing: 'border-box', outline: 'none',
      }} placeholder="Nombre del torneo *" value={name} onChange={e => setName(e.target.value)} maxLength={60} />

      {/* Juego — solo los de la comunidad */}
      {gameOptions.length > 0 && (
        <div>
          <span style={lbl}>Juego</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {gameOptions.map(g => (
              <button key={g.id} onClick={() => setGame(g.id)} style={chip(game === g.id, false)}>
                {g.icon} {g.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modo */}
      <div>
        <span style={lbl}>Modo</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              flex: 1, padding: '8px 4px', borderRadius: 10,
              border: `2px solid ${mode === m.id ? C.green : C.border + '66'}`,
              background: mode === m.id ? `${C.green}15` : C.panel2, cursor: 'pointer',
              color: mode === m.id ? C.green : C.text2, fontWeight: 700, fontSize: 12,
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {/* Estructura como chips */}
      <div>
        <span style={lbl}>Estructura</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {structures.map(s => (
            <button key={s.id} onClick={() => setStructure(s.id)} style={chip(validStruct === s.id, false)}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
        <p style={{ margin: '5px 0 0', fontSize: 11, color: C.textDim }}>
          {structures.find(s => s.id === validStruct)?.desc}
        </p>
      </div>

      {/* Jugadores */}
      <div>
        <span style={lbl}>Jugadores</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 5 }}>
          {ALL_SIZES.map(n => {
            const locked = n > planLimits.max
            const selected = maxPl === n
            return (
              <button key={n} onClick={() => !locked && setMaxPl(n)} style={{
                ...chip(selected, locked),
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                {locked && <span style={{ fontSize: 10 }}>🔒</span>}
                {n}
              </button>
            )
          })}
        </div>
        <p style={{ margin: 0, fontSize: 11, color: isFree ? '#f59e0b' : C.textDim }}>
          {isFree ? '⚠️ Plan Gratis — máximo 8 jugadores. Subí de plan para más.' : `✓ ${planLimits.label}`}
        </p>
      </div>

      {err && <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>{err}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${C.border}`,
          background: 'none', color: C.text2, cursor: 'pointer', fontSize: 14,
        }}>Cancelar</button>
        <button onClick={handleCreate} disabled={busy} style={{
          flex: 2, padding: '11px', borderRadius: 10, border: 'none',
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
export default function CommunityTournamentsPanel({ community, onClose, canManage = false }) {
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
        {canManage && (
          <button onClick={() => setShowCreate(true)} style={{
            background: C.green, border: 'none', borderRadius: 10, padding: '7px 14px',
            color: C.bg, fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            + Crear
          </button>
        )}
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

      {/* Create form — admin only */}
      {canManage && showCreate && (
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
            <p style={{ color: C.text2, fontSize: 14, fontWeight: 600, margin: 0 }}>
              {filter === 'all' ? 'No hay torneos ni ligas aún' : filter === 'tournament' ? 'No hay torneos aún' : 'No hay ligas aún'}
            </p>
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
