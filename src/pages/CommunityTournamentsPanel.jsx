import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'
import TablaPosicionesPage from './tools/TablaPosicionesPage'
import CEOPanel from '../components/CEOPanel'

const STATUS_CFG = {
  inscripcion: { label: 'Inscripción', color: '#22c55e', bg: '#22c55e18' },
  en_curso:    { label: 'En Curso',    color: '#fb8c00', bg: '#fb8c0018' },
  finalizado:  { label: 'Finalizado',  color: '#64748b', bg: '#64748b18' },
  cancelado:   { label: 'Cancelado',   color: '#ef4444', bg: '#ef444418' },
}

async function postTournamentAviso(communityId, authorId, title, body, tournamentId = null) {
  if (!communityId || !authorId) return
  await supabase.from('announcements').insert({
    conversation_id: communityId,
    author_id: authorId,
    title,
    body: body || null,
    category: 'torneo',
    is_active: true,
    tournament_id: tournamentId || null,
  })
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

const PLATFORMS = [
  { id: 'crossplay', label: 'Crossplay', icon: '🌐', desc: 'PC / PS5 / PS4 / Xbox' },
  { id: 'ps5',       label: 'PS5',       icon: '🎮', desc: 'PlayStation 5' },
  { id: 'ps4',       label: 'PS4',       icon: '🎮', desc: 'PlayStation 4' },
  { id: 'pc',        label: 'PC',        icon: '🖥️', desc: 'PC' },
  { id: 'xbox',      label: 'Xbox',      icon: '🟢', desc: 'Xbox Series X/S / Xbox One' },
]

const RESULT_MODES = [
  { id: 'jugadores', label: '⚡ Automático', desc: 'Jugadores reportan sus resultados con foto' },
  { id: 'manual',    label: '🎯 Manual',     desc: 'El organizador carga los resultados' },
]

const DISPUTE_TIMES = [2, 5, 10, 15, 30, 60, 120]

// Common countries + global
const COUNTRIES = [
  { code: 'global', label: '🌐 Global (todos los países)' },
  { code: 'AR', label: '🇦🇷 Argentina' },
  { code: 'CL', label: '🇨🇱 Chile' },
  { code: 'MX', label: '🇲🇽 México' },
  { code: 'CO', label: '🇨🇴 Colombia' },
  { code: 'PE', label: '🇵🇪 Perú' },
  { code: 'UY', label: '🇺🇾 Uruguay' },
  { code: 'BR', label: '🇧🇷 Brasil' },
  { code: 'VE', label: '🇻🇪 Venezuela' },
  { code: 'EC', label: '🇪🇨 Ecuador' },
  { code: 'BO', label: '🇧🇴 Bolivia' },
  { code: 'PY', label: '🇵🇾 Paraguay' },
  { code: 'US', label: '🇺🇸 Estados Unidos' },
  { code: 'ES', label: '🇪🇸 España' },
  { code: 'GB', label: '🇬🇧 Reino Unido' },
  { code: 'DE', label: '🇩🇪 Alemania' },
  { code: 'FR', label: '🇫🇷 Francia' },
  { code: 'IT', label: '🇮🇹 Italia' },
  { code: 'LA', label: '🌎 Latinoamérica' },
  { code: 'EU', label: '🇪🇺 Europa' },
]

function getPlanLimits(profile) {
  const role = profile?.role || 'member'
  if (['superadmin', 'admin', 'ceo', 'comunidad'].includes(role)) return { max: 9999, label: 'Sin límite' }
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

  const [type,        setType]        = useState('tournament')
  const [name,        setName]        = useState('')
  const [desc,        setDesc]        = useState('')
  const [game,        setGame]        = useState(communityTags?.[0] || '')
  const [mode,        setMode]        = useState('1vs1')
  const [structure,   setStructure]   = useState('eliminatorias')
  const [maxPl,       setMaxPl]       = useState(Math.min(8, planLimits.max))
  const [resultMode,    setResultMode]    = useState('jugadores')
  const [disputeMin,    setDisputeMin]    = useState(10)
  const [platform,      setPlatform]      = useState('crossplay')
  const [country,       setCountry]       = useState('global')
  const [startDate,     setStartDate]     = useState('')
  const [closeDate,     setCloseDate]     = useState('')
  const [rules,         setRules]         = useState('')
  const [fee,           setFee]           = useState('')
  // Liga-specific
  const [ligaTipo,      setLigaTipo]      = useState('genuino')
  const [temporada,     setTemporada]     = useState(1)
  const [division,      setDivision]      = useState('A')
  const [clasificaCopa, setClasificaCopa] = useState(8)
  const [busy,          setBusy]          = useState(false)
  const [err,           setErr]           = useState('')

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
        result_mode: resultMode,
        dispute_time_min: disputeMin,
        platform: platform,
        country_restriction: country,
        start_date: startDate || null,
        registration_close: closeDate || null,
        rules: rules.trim() || null,
        inscription_fee: fee.trim() || null,
        ...(type === 'liga' ? {
          liga_tipo: ligaTipo,
          temporada: temporada,
          division: division,
          clasifica_copa: clasificaCopa,
        } : {}),
      }).select('id').single()
      if (convErr) throw convErr

      const typeLabel = type === 'liga' ? 'Liga' : 'Torneo'
      const typeIcon  = type === 'liga' ? '⚽' : '🏆'
      await postTournamentAviso(
        communityId,
        profile.id,
        `${typeIcon} ${typeLabel} "${name.trim()}" — ¡Inscripciones ABIERTAS!`,
<<<<<<< HEAD
        maxPl ? `Cupos disponibles: ${maxPl}. ¡Anotate ya!` : '¡Anotate ya!',
        conv.id
=======
        maxPl ? `Cupos disponibles: ${maxPl}. ¡Anotate ya!` : '¡Anotate ya!'
>>>>>>> origin/main
      )
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

      {/* Descripción */}
      <div>
        <span style={lbl}>Descripción</span>
        <textarea style={{ ...inp, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="Descripción opcional del torneo..." value={desc}
          onChange={e => setDesc(e.target.value)} maxLength={400} />
      </div>

      {/* Liga-specific fields */}
      {type === 'liga' && (<>
        <div>
          <span style={lbl}>Tipo de liga</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{id:'genuino',label:'🎮 Genuino',desc:'Equipos reales, jugadores auténticos'},{id:'dreamteam',label:'⭐ DreamTeam',desc:'Equipo propio (Ultimate Team)'}].map(t => (
              <button key={t.id} onClick={() => setLigaTipo(t.id)} style={{
                flex: 1, padding: '8px 6px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${ligaTipo === t.id ? C.green : C.border + '66'}`,
                background: ligaTipo === t.id ? `${C.green}15` : C.panel2,
                color: ligaTipo === t.id ? C.green : C.text2, fontWeight: 700, fontSize: 11, textAlign: 'center',
              }}>
                <div>{t.label}</div>
                <div style={{ fontSize: 10, fontWeight: 400, color: C.textDim, marginTop: 2 }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <span style={lbl}>Temporada</span>
            <input type="number" min={1} style={inp} value={temporada}
              onChange={e => setTemporada(parseInt(e.target.value) || 1)} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={lbl}>División de inicio</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {['A','B','C','D'].map(d => (
                <button key={d} onClick={() => setDivision(d)} style={{
                  flex: 1, padding: '9px 0', borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${division === d ? C.green : C.border + '66'}`,
                  background: division === d ? `${C.green}15` : C.panel2,
                  color: division === d ? C.green : C.text2, fontWeight: 800, fontSize: 13,
                }}>Div {d}</button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <span style={lbl}>Clasifican a Copa</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[4,6,8,12,16].map(n => (
              <button key={n} onClick={() => setClasificaCopa(n)} style={chip(clasificaCopa === n, false)}>
                Top {n}
              </button>
            ))}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textDim }}>Jugadores que clasifican a Copa LFA al final de la temporada</p>
        </div>
      </>)}

      {/* Modo resultado */}
      <div>
        <span style={lbl}>Carga de resultados</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {RESULT_MODES.map(m => (
            <button key={m.id} onClick={() => setResultMode(m.id)} style={{
              flex: 1, padding: '8px 6px', borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${resultMode === m.id ? C.green : C.border + '66'}`,
              background: resultMode === m.id ? `${C.green}15` : C.panel2,
              color: resultMode === m.id ? C.green : C.text2, fontWeight: 700, fontSize: 11, textAlign: 'center',
            }}>
              <div>{m.label}</div>
              <div style={{ fontSize: 10, fontWeight: 400, color: C.textDim, marginTop: 2 }}>{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Tiempo disputa */}
      <div>
        <span style={lbl}>Tiempo de disputa</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {DISPUTE_TIMES.map(t => (
            <button key={t} onClick={() => setDisputeMin(t)} style={chip(disputeMin === t, false)}>
              {t < 60 ? `${t} min` : `${t / 60}h`}
            </button>
          ))}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textDim }}>
          Tiempo que tiene el staff para resolver una disputa de resultado
        </p>
      </div>

      {/* Plataforma */}
      <div>
        <span style={lbl}>Plataforma</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PLATFORMS.map(p => (
            <button key={p.id} onClick={() => setPlatform(p.id)} style={chip(platform === p.id, false)}>
              {p.icon} {p.label}
            </button>
          ))}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textDim }}>
          {PLATFORMS.find(p => p.id === platform)?.desc}
        </p>
      </div>

      {/* Restricción de país */}
      <div>
        <span style={lbl}>Restricción de país</span>
        <select value={country} onChange={e => setCountry(e.target.value)}
          style={{ ...inp, cursor: 'pointer' }}>
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Inscripción fee */}
      <div>
        <span style={lbl}>Inscripción</span>
        <input style={inp} placeholder="Ej: Gratis / USD 5 / 500 LFC" value={fee}
          onChange={e => setFee(e.target.value)} maxLength={60} />
      </div>

      {/* Fechas opcionales */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <span style={lbl}>Cierre de inscripciones</span>
          <input type="datetime-local" style={inp} value={closeDate}
            onChange={e => setCloseDate(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={lbl}>Fecha de inicio</span>
          <input type="datetime-local" style={inp} value={startDate}
            onChange={e => setStartDate(e.target.value)} />
        </div>
      </div>

      {/* Reglamento de sala */}
      <div>
        <span style={lbl}>Reglamento de sala</span>
        <textarea style={{ ...inp, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="Reglas específicas de este torneo (comportamiento, configuración de sala, etc.)"
          value={rules} onChange={e => setRules(e.target.value)} maxLength={2000} />
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
function TournamentCard({ item, onManage, onJoin, onChat, myId, isStaff }) {
  const st = STATUS_CFG[item.tournament_status] || STATUS_CFG.inscripcion
  const ty = TYPE_CFG[item.group_type] || TYPE_CFG.tournament
  const isCreator = item.created_by === myId
  const joined = item.members?.some(m => m.user_id === myId)
  const canManageThis = isStaff || isCreator

  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`,
      borderRadius: 14, overflow: 'hidden', marginBottom: 10,
    }}>
      {/* Banner */}
      {item.banner_url ? (
        <div style={{ position: 'relative', height: 110 }}>
          <img src={item.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, #000000cc 40%, transparent)',
          }} />
          <div style={{ position: 'absolute', bottom: 8, left: 12, right: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{ty.icon}</span>
            <p style={{ margin: 0, fontWeight: 800, color: '#fff', fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.name}
            </p>
            <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, flexShrink: 0 }}>
              {st.label}
            </span>
          </div>
        </div>
      ) : (
        <div style={{
          height: 72, display: 'flex', alignItems: 'center',
          background: `linear-gradient(135deg, ${ty.color}22, ${C.panel2})`,
          padding: '0 14px', gap: 10, position: 'relative',
        }}>
          <span style={{ fontSize: 28 }}>{ty.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, color: C.text, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.name}
            </p>
            {item.description && (
              <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.description}
              </p>
            )}
          </div>
          <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, flexShrink: 0 }}>
            {st.label}
          </span>
        </div>
      )}

      <div style={{ padding: '10px 14px 14px' }}>

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
        {isCreator && (
          <span style={{ fontSize: 11, color: '#f59e0b', background: '#f59e0b18', padding: '3px 8px', borderRadius: 20, fontWeight: 700 }}>
            ⚙️ Organizador
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {canManageThis && (
          <button onClick={() => onManage(item)} style={{
            flex: 1, padding: '8px', borderRadius: 8, border: 'none',
            background: C.green, color: C.bg, fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>
            ⚙️ Gestionar
          </button>
        )}
        {!canManageThis && item.tournament_status === 'inscripcion' && !joined && (
          <button onClick={() => onJoin(item.id)} style={{
            flex: 1, padding: '8px', borderRadius: 8, border: 'none',
            background: C.green, color: C.bg, fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>
            Inscribirme
          </button>
        )}
        {!canManageThis && joined && (
          <button onClick={() => onManage(item)} style={{
            flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: 'none', color: C.text2, fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>
            👁️ Ver
          </button>
        )}
        {!canManageThis && !joined && item.tournament_status !== 'inscripcion' && (
          <button onClick={() => onManage(item)} style={{
            flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: 'none', color: C.text2, fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>
            👁️ Ver
          </button>
        )}
        <button onClick={() => onChat(item)} style={{
          padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
          background: 'none', color: C.text2, fontSize: 12, cursor: 'pointer',
        }}>
          💬 Chat
        </button>
      </div>
      </div>
    </div>
  )
}

// ── Tournament Detail ─────────────────────────────────────────────────────────
function TournamentDetail({ item: initItem, onBack, myId, isStaff }) {
  const [item, setItem] = useState(initItem)
  const [activeTab, setActiveTab] = useState('jugadores')
  const [participants, setParticipants] = useState([])
  const [userMap, setUserMap] = useState({})
  const [busy, setBusy] = useState(false)
  const [drawResult, setDrawResult] = useState(null) // bolillero result
  const [showDraw, setShowDraw] = useState(false)
  const [drawAnimating, setDrawAnimating] = useState(false)
  const [matches, setMatches] = useState([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [disputes, setDisputes] = useState([])

  const isCreator = item.created_by === myId
  const canManage = isStaff || isCreator
  const isLiga = item.group_type === 'liga'
  const status = item.tournament_status
  const joined = participants.some(p => p.user_id === myId)

  const TABS = [
    { id: 'jugadores', label: '👥 Jugadores' },
    { id: 'sorteo',    label: '🎲 Sorteo'    },
    { id: 'brackets',  label: '🏆 Brackets'  },
    ...(isLiga ? [{ id: 'liga', label: '📊 Liga' }] : []),
  ]

  async function loadParticipants() {
    const { data } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', item.id)
    setParticipants(data || [])
    if ((data || []).length > 0) {
      const ids = data.map(r => r.user_id)
      const { data: users } = await supabase.from('users').select('id, display_name, username, avatar_url').in('id', ids)
      const map = {}
      ;(users || []).forEach(u => { map[u.id] = u })
      setUserMap(map)
    }
  }

  async function loadMatches() {
    setLoadingMatches(true)
    const { data } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', item.id)
      .order('round_number').order('match_number')
    setMatches(data || [])
    setLoadingMatches(false)
  }

  async function reloadItem() {
    const { data } = await supabase
      .from('conversations')
      .select('id, name, description, group_type, tournament_status, tournament_format, tournament_mode, game, max_participants, created_by, avatar_url, banner_url, members:conversation_members(user_id)')
      .eq('id', item.id).single()
    if (data) setItem(data)
  }

  useEffect(() => { loadParticipants() }, [item.id])
  useEffect(() => { if (activeTab === 'brackets') loadMatches() }, [activeTab, item.id])

  async function handleJoin() {
    const { data, error } = await supabase.rpc('join_tournament', { p_tournament_id: item.id })
    if (error || data?.ok === false) {
      const msg = data?.error || error?.message || 'Error al inscribirse'
      if (msg === 'inscripciones_cerradas') alert('Las inscripciones están cerradas')
      else if (msg === 'torneo_lleno') alert('El torneo está lleno')
      else alert(msg)
      return
    }
    await loadParticipants()
    await reloadItem()
  }

  async function handleLeave() {
    if (!confirm('¿Salir del torneo?')) return
    await supabase.from('conversation_members').delete().eq('conversation_id', item.id).eq('user_id', myId)
    await loadParticipants()
    await reloadItem()
  }

  async function handleKick(userId) {
    if (!confirm('¿Eliminar este jugador del torneo?')) return
    await supabase.from('conversation_members').delete().eq('conversation_id', item.id).eq('user_id', userId)
    await loadParticipants()
    await reloadItem()
  }

  async function handleStart() {
    if (!confirm(`¿Iniciar el torneo con ${participants.length} jugadores? Se realizará el sorteo automáticamente.`)) return
    setBusy(true)
    // Run automatic draw then start
    await runDraw(true)
    const { error } = await supabase.from('conversations').update({ tournament_status: 'en_curso' }).eq('id', item.id)
    if (error) alert(error.message)
    else await postTournamentAviso(
      item.community_id, myId,
      `🏆 "${item.name}" — ¡El torneo COMENZÓ!`,
      `El sorteo fue realizado. ${participants.length} jugadores compiten. ¡Buena suerte a todos!`
    )
    await reloadItem()
    setBusy(false)
    setActiveTab('brackets')
  }

  async function handleFinish() {
    if (!confirm('¿Finalizar el torneo?')) return
    await supabase.from('conversations').update({ tournament_status: 'finalizado' }).eq('id', item.id)
    await postTournamentAviso(
      item.community_id, myId,
      `🏁 "${item.name}" — ¡Torneo FINALIZADO!`,
      '¡Gracias a todos los participantes!'
    )
    await reloadItem()
  }

  async function handleDelete() {
    const label = isLiga ? 'liga' : 'torneo'
    if (!confirm(`¿Eliminar este ${label} permanentemente? Esta acción no se puede deshacer.`)) return
    setBusy(true)
    const { error } = await supabase.rpc('delete_group_or_community', { p_conversation_id: item.id })
    if (error) {
      await supabase.from('conversations').delete().eq('id', item.id)
    }
    onBack()
  }


  // Bolillero: shuffle participants randomly, assign to bracket positions
  async function runDraw(autoSave = false) {
    setDrawAnimating(true)
    const names = participants.map(p => {
      const u = userMap[p.user_id]
      return { userId: p.user_id, name: u?.display_name || u?.username || 'Jugador' }
    })
    // Fisher-Yates shuffle
    const shuffled = [...names]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    // Animate reveal with 300ms delay per player
    setDrawResult(null)
    await new Promise(r => setTimeout(r, 400))
    setDrawResult(shuffled)
    setDrawAnimating(false)

    if (autoSave && shuffled.length > 0) {
      // Save bracket matches to DB using RPC if available, else insert manually
      const bracketSize = Math.pow(2, Math.ceil(Math.log2(shuffled.length)))
      const seeded = [...shuffled]
      while (seeded.length < bracketSize) seeded.push(null) // BYE slots

      const matchInserts = []
      for (let i = 0; i < seeded.length; i += 2) {
        matchInserts.push({
          tournament_id: item.id,
          round_number: 1,
          match_number: i / 2 + 1,
          player1_id: seeded[i]?.userId || null,
          player2_id: seeded[i + 1]?.userId || null,
          status: seeded[i + 1] === null ? 'bye' : 'pendiente',
          winner_id: seeded[i + 1] === null ? seeded[i]?.userId : null,
        })
      }
      // Clear existing matches first
      await supabase.from('tournament_matches').delete().eq('tournament_id', item.id).eq('round_number', 1)
      if (matchInserts.length > 0) {
        await supabase.from('tournament_matches').insert(matchInserts)
      }
    }
  }

  // Match result upload
  async function handleSubmitScore(matchId, score1, score2, photoUrl) {
    setBusy(true)
    const { error } = await supabase.rpc('submit_match_result', {
      p_match_id: matchId, p_score1: score1, p_score2: score2, p_photo_url: photoUrl || null,
    })
    if (error) alert(error.message)
    await loadMatches()
    setSelectedMatch(null)
    setBusy(false)
  }

  async function handleApproveResult(matchId) {
    setBusy(true)
    const { error } = await supabase.rpc('approve_match_result', { p_match_id: matchId })
    if (error) alert(error.message)
    await loadMatches()
    setSelectedMatch(null)
    setBusy(false)
  }

  async function handleDisputeResult(matchId, reason) {
    setBusy(true)
    await supabase.from('tournament_matches').update({ status: 'disputa', dispute_reason: reason }).eq('id', matchId)
    await loadMatches()
    setSelectedMatch(null)
    setBusy(false)
  }

  async function uploadResultPhoto(file) {
    setUploadingPhoto(true)
    const ext = file.name.split('.').pop()
    const path = `match-results/${item.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    setUploadingPhoto(false)
    if (error) { alert('Error al subir foto'); return null }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  async function uploadBanner(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase().replace('jpeg', 'jpg')
    const path = `tournament-banners/${item.id}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (error) { alert('Error al subir banner'); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = data.publicUrl + '?t=' + Date.now()
    await supabase.from('conversations').update({ banner_url: url }).eq('id', item.id)
    setItem(prev => ({ ...prev, banner_url: url }))
  }

  const st = STATUS_CFG[status] || STATUS_CFG.inscripcion

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: C.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {/* Banner */}
        <div style={{ position: 'relative' }}>
          {item.banner_url ? (
            <div style={{ height: 120, position: 'relative' }}>
              <img src={item.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #000000bb 30%, transparent)' }} />
            </div>
          ) : (
            <div style={{
              height: 80,
              background: `linear-gradient(135deg, ${isLiga ? '#3b82f622' : '#f59e0b22'}, ${C.panel2})`,
            }} />
          )}
          {canManage && (
            <label style={{ position: 'absolute', bottom: 8, right: 10, cursor: 'pointer' }}>
              <div style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: '#000000aa', color: '#fff', backdropFilter: 'blur(4px)',
              }}>
                📷 {item.banner_url ? 'Cambiar banner' : 'Agregar banner'}
              </div>
              <input type="file" accept="image/*" onChange={e => uploadBanner(e.target.files?.[0])} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: '4px 8px 4px 0' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isLiga ? '🥇' : '🏆'} {item.name}
            </p>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
              <span style={{ fontSize: 11, color: C.textDim }}>👥 {participants.length}/{item.max_participants}</span>
            </div>
          </div>
          {canManage && status === 'inscripcion' && (
            <button onClick={handleStart} disabled={busy || participants.length < 2} style={{
              background: participants.length >= 2 ? C.green : C.panel2,
              color: participants.length >= 2 ? C.bg : C.textDim,
              border: 'none', borderRadius: 10, padding: '7px 12px',
              fontWeight: 700, fontSize: 12, cursor: participants.length >= 2 ? 'pointer' : 'default',
            }}>
              🚀 Iniciar ({participants.length})
            </button>
          )}
          {canManage && status === 'en_curso' && (
            <button onClick={handleFinish} style={{
              background: '#ef4444', color: '#fff',
              border: 'none', borderRadius: 10, padding: '7px 12px',
              fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}>
              🏁 Finalizar
            </button>
          )}
          {isCreator && (status === 'inscripcion' || status === 'finalizado' || status === 'cancelado') && (
            <button onClick={handleDelete} disabled={busy} style={{
              background: 'none', border: `1px solid #ef444466`,
              borderRadius: 10, padding: '7px 10px',
              color: '#ef4444', fontSize: 12, cursor: 'pointer',
            }}>
              🗑️
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderTop: `1px solid ${C.border}44` }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              flex: 1, padding: '10px 4px', background: 'none', border: 'none',
              borderBottom: `2.5px solid ${activeTab === t.id ? C.green : 'transparent'}`,
              color: activeTab === t.id ? C.green : C.textDim,
              fontSize: 11, fontWeight: activeTab === t.id ? 700 : 400,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

        {/* ── JUGADORES ── */}
        {activeTab === 'jugadores' && (
          <div>
            {status === 'inscripcion' && !joined && !canManage && (
              <button onClick={handleJoin} style={{
                width: '100%', padding: 12, borderRadius: 12, border: 'none',
                background: C.green, color: C.bg, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 14,
              }}>
                ✅ Inscribirme al torneo
              </button>
            )}
            {status === 'inscripcion' && joined && !canManage && (
              <button onClick={handleLeave} style={{
                width: '100%', padding: 11, borderRadius: 12, border: `1px solid #ef4444`,
                background: 'none', color: '#ef4444', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 14,
              }}>
                🚪 Salir del torneo
              </button>
            )}
            <p style={{ margin: '0 0 10px', fontSize: 12, color: C.textDim, fontWeight: 700 }}>
              {participants.length} participante{participants.length !== 1 ? 's' : ''} inscripto{participants.length !== 1 ? 's' : ''}
            </p>
            {participants.length === 0 ? (
              <p style={{ color: C.textDim, textAlign: 'center', marginTop: 40 }}>Sin inscriptos aún.</p>
            ) : participants.map((p, i) => {
              const u = userMap[p.user_id]
              return (
                <div key={p.user_id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: C.panel, borderRadius: 12, marginBottom: 6,
                }}>
                  <span style={{ fontSize: 13, color: C.textDim, minWidth: 24, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {i + 1}
                  </span>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: C.panel2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 800, color: C.text, overflow: 'hidden', flexShrink: 0,
                  }}>
                    {u?.avatar_url
                      ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (u?.display_name || u?.username || '?')[0].toUpperCase()
                    }
                  </div>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.text }}>
                    {u?.display_name || u?.username || 'Jugador'}
                    {p.user_id === item.created_by && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: '#f59e0b' }}>⚙️ Org.</span>
                    )}
                  </span>
                  {canManage && p.user_id !== myId && status === 'inscripcion' && (
                    <button onClick={() => handleKick(p.user_id)} style={{
                      padding: '4px 10px', borderRadius: 8, border: `1px solid #ef444444`,
                      background: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer',
                    }}>Quitar</button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── SORTEO ── */}
        {activeTab === 'sorteo' && (
          <div>
            <div style={{ background: C.panel, borderRadius: 14, padding: 16, marginBottom: 14 }}>
              <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 14, color: C.text }}>🎲 Bolillero — Sorteo de posiciones</p>
              <p style={{ margin: 0, fontSize: 12, color: C.textDim }}>
                Asigna posiciones aleatorias a los jugadores como en un sorteo profesional.
                {canManage && status === 'inscripcion' && ' Al iniciar el torneo el sorteo se realiza automáticamente.'}
              </p>
            </div>

            {participants.length < 2 ? (
              <p style={{ color: C.textDim, textAlign: 'center', marginTop: 30 }}>Se necesitan al menos 2 jugadores para sortear.</p>
            ) : (
              <>
                {(canManage || status !== 'inscripcion') && (
                  <button onClick={() => { setShowDraw(true); runDraw(false) }} disabled={drawAnimating} style={{
                    width: '100%', padding: 13, borderRadius: 12, border: 'none',
                    background: drawAnimating ? C.panel2 : C.green,
                    color: drawAnimating ? C.textDim : C.bg,
                    fontWeight: 700, fontSize: 14, cursor: drawAnimating ? 'default' : 'pointer',
                    marginBottom: 14,
                  }}>
                    {drawAnimating ? '🎲 Sorteando…' : '🎲 Realizar Sorteo'}
                  </button>
                )}

                {drawAnimating && (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🎲</div>
                    <p style={{ color: C.textDim }}>Mezclando jugadores…</p>
                  </div>
                )}

                {drawResult && !drawAnimating && (
                  <div>
                    <p style={{ margin: '0 0 10px', fontSize: 12, color: C.textDim, fontWeight: 700 }}>Resultado del sorteo:</p>
                    {drawResult.map((player, i) => (
                      <div key={player.userId} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                        background: C.panel, borderRadius: 12, marginBottom: 6,
                        border: `1px solid ${C.border}`,
                        animation: `fadeIn 0.3s ease ${i * 0.08}s both`,
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: `linear-gradient(135deg, ${C.green}88, ${C.panel2})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: 14, color: C.text, flexShrink: 0,
                        }}>
                          {i + 1}
                        </div>
                        <span style={{ flex: 1, fontWeight: 600, color: C.text }}>{player.name}</span>
                        <span style={{ fontSize: 11, color: C.textDim }}>Posición #{i + 1}</span>
                      </div>
                    ))}
                    {canManage && status === 'inscripcion' && (
                      <button onClick={() => runDraw(true)} disabled={busy} style={{
                        width: '100%', marginTop: 10, padding: 11, borderRadius: 12,
                        border: `1px solid ${C.green}`, background: `${C.green}15`,
                        color: C.green, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      }}>
                        💾 Guardar este sorteo en brackets
                      </button>
                    )}
                  </div>
                )}

                {!drawResult && !drawAnimating && (
                  <p style={{ color: C.textDim, textAlign: 'center', marginTop: 20, fontSize: 13 }}>
                    Presioná "Realizar Sorteo" para asignar posiciones aleatoriamente.
                  </p>
                )}
              </>
            )}
            <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }`}</style>
          </div>
        )}

        {/* ── BRACKETS ── */}
        {activeTab === 'brackets' && (
          <div>
            {loadingMatches ? (
              <p style={{ textAlign: 'center', color: C.textDim, marginTop: 40 }}>Cargando…</p>
            ) : matches.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
                <p style={{ color: C.textDim, fontSize: 14 }}>
                  {status === 'inscripcion'
                    ? 'El torneo aún no ha iniciado. Al iniciar se genera el bracket automáticamente.'
                    : 'No hay partidos generados aún.'}
                </p>
              </div>
            ) : (
              <div>
                {/* Group matches by round */}
                {Array.from(new Set(matches.map(m => m.round_number))).sort().map(rn => {
                  const roundMatches = matches.filter(m => m.round_number === rn)
                  const roundNames = ['Fase 1','Octavos','Cuartos','Semifinal','Final']
                  const totalRounds = Math.max(...matches.map(m => m.round_number))
                  const rLabel = rn === totalRounds ? 'Final' : rn === totalRounds - 1 ? 'Semifinal' : rn === totalRounds - 2 ? 'Cuartos' : `Ronda ${rn}`
                  return (
                    <div key={rn} style={{ marginBottom: 20 }}>
                      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        {rLabel}
                      </p>
                      {roundMatches.map(match => {
                        const p1 = userMap[match.player1_id]?.display_name || userMap[match.player1_id]?.username || (match.player1_id ? 'Jugador' : 'BYE')
                        const p2 = userMap[match.player2_id]?.display_name || userMap[match.player2_id]?.username || (match.player2_id ? 'Jugador' : 'BYE')
                        const done = match.status === 'finalizado' || match.status === 'aprobado'
                        const inDispute = match.status === 'disputa'
                        const isMyMatch = match.player1_id === myId || match.player2_id === myId
                        return (
                          <button key={match.id} onClick={() => setSelectedMatch(match)} style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            background: C.panel, border: `1px solid ${inDispute ? '#ef4444' : done ? C.green + '44' : C.border}`,
                            borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                            textAlign: 'left', marginBottom: 6,
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, fontWeight: match.winner_id === match.player1_id && done ? 700 : 400, color: match.winner_id === match.player1_id && done ? C.green : C.text }}>
                                  {p1}
                                </span>
                                {done && <span style={{ fontSize: 16, fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{match.score1 ?? '—'}</span>}
                              </div>
                              <div style={{ height: 1, background: C.border + '44', margin: '6px 0' }} />
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, fontWeight: match.winner_id === match.player2_id && done ? 700 : 400, color: match.winner_id === match.player2_id && done ? C.green : C.text }}>
                                  {p2}
                                </span>
                                {done && <span style={{ fontSize: 16, fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{match.score2 ?? '—'}</span>}
                              </div>
                            </div>
                            <div style={{ flexShrink: 0, textAlign: 'right' }}>
                              {inDispute && <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>⚠️ Disputa</span>}
                              {done && <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>✓</span>}
                              {!done && !inDispute && isMyMatch && <span style={{ fontSize: 11, color: '#f59e0b' }}>Tu partido</span>}
                              {!done && !inDispute && !isMyMatch && <span style={{ fontSize: 11, color: C.textDim }}>Pendiente</span>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── LIGA ── */}
        {activeTab === 'liga' && (
          <TablaPosicionesPage
            tournamentId={item.id}
            tournamentName={item.name}
            embedded={true}
            isOrganizer={canManage}
            ligaData={item}
            onLigaAction={async (action, payload) => {
              if (action === 'set_fase') {
                await supabase.from('conversations').update({ liga_fase: payload }).eq('id', item.id)
                setItem(prev => ({ ...prev, liga_fase: payload }))
              } else if (action === 'finalizar') {
                await supabase.from('conversations').update({ tournament_status: 'finalizado' }).eq('id', item.id)
                setItem(prev => ({ ...prev, tournament_status: 'finalizado' }))
                await postTournamentAviso(item.community_id, myId, `🏁 Liga "${item.name}" — ¡FINALIZADA!`, '¡Gracias a todos los participantes!')
              } else if (action === 'generar_fixture') {
                const pts = participants
                const jornadas = []
                let jornadaNum = 1
                for (let i = 0; i < pts.length; i++) {
                  for (let j = i + 1; j < pts.length; j++) {
                    jornadas.push({ player1_id: pts[i].user_id, player2_id: pts[j].user_id, jornada_number: jornadaNum, match_number: 1 })
                    jornadas.push({ player1_id: pts[j].user_id, player2_id: pts[i].user_id, jornada_number: jornadaNum + Math.ceil(pts.length / 2), match_number: 1 })
                    jornadaNum++
                  }
                }
                const rows = jornadas.map(j => ({ tournament_id: item.id, round: 1, status: 'pendiente', ...j }))
                if (rows.length > 0) await supabase.from('tournament_matches').insert(rows)
                await supabase.from('conversations').update({ tournament_status: 'en_curso' }).eq('id', item.id)
                setItem(prev => ({ ...prev, tournament_status: 'en_curso' }))
                await postTournamentAviso(item.community_id, myId, `⚽ Liga "${item.name}" — ¡Fixture generado!`, `${participants.length} jugadores. ¡Que empiece la competencia!`)
              }
            }}
          />
        )}
      </div>

      {/* Match detail modal */}
      {selectedMatch && (
        <MatchModal
          match={selectedMatch}
          userMap={userMap}
          myId={myId}
          canManage={canManage}
          busy={busy}
          onClose={() => setSelectedMatch(null)}
          onSubmitScore={handleSubmitScore}
          onApprove={handleApproveResult}
          onDispute={handleDisputeResult}
          onUploadPhoto={uploadResultPhoto}
          uploadingPhoto={uploadingPhoto}
        />
      )}
    </div>
  )
}

// ── Match Modal ───────────────────────────────────────────────────────────────
function MatchModal({ match, userMap, myId, canManage, busy, onClose, onSubmitScore, onApprove, onDispute, onUploadPhoto, uploadingPhoto }) {
  const [s1, setS1] = useState(match.score1 ?? '')
  const [s2, setS2] = useState(match.score2 ?? '')
  const [photoUrl, setPhotoUrl] = useState(match.photo_url || '')
  const [disputeReason, setDisputeReason] = useState('')
  const [showDispute, setShowDispute] = useState(false)

  const p1 = userMap[match.player1_id]?.display_name || userMap[match.player1_id]?.username || 'Jugador 1'
  const p2 = userMap[match.player2_id]?.display_name || userMap[match.player2_id]?.username || 'Jugador 2'
  const isPlayer = match.player1_id === myId || match.player2_id === myId
  const done = match.status === 'finalizado' || match.status === 'aprobado'
  const pending = match.status === 'pendiente' || match.status === 'en_curso'
  const inDispute = match.status === 'disputa'
  const waitingApproval = match.status === 'resultado_cargado'

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await onUploadPhoto(file)
    if (url) setPhotoUrl(url)
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 300,
      background: '#000000aa', display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div style={{
        width: '100%', background: C.bg, borderRadius: '20px 20px 0 0',
        padding: '20px 16px 32px', maxHeight: '85vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 16px' }} />

        <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 16, color: C.text, textAlign: 'center' }}>
          {p1} vs {p2}
        </p>
        {match.round_number && (
          <p style={{ margin: '0 0 16px', fontSize: 12, color: C.textDim, textAlign: 'center' }}>
            Ronda {match.round_number} — Partido {match.match_number}
          </p>
        )}

        {/* Scores display */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: C.text, fontWeight: match.winner_id === match.player1_id && done ? 700 : 400 }}>{p1}</p>
            <div style={{ fontSize: 36, fontWeight: 900, color: match.winner_id === match.player1_id && done ? C.green : C.text }}>
              {done || waitingApproval ? (match.score1 ?? '—') : '?'}
            </div>
          </div>
          <div style={{ fontSize: 18, color: C.textDim, fontWeight: 700 }}>VS</div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: C.text, fontWeight: match.winner_id === match.player2_id && done ? 700 : 400 }}>{p2}</p>
            <div style={{ fontSize: 36, fontWeight: 900, color: match.winner_id === match.player2_id && done ? C.green : C.text }}>
              {done || waitingApproval ? (match.score2 ?? '—') : '?'}
            </div>
          </div>
        </div>

        {/* Photo evidence */}
        {(photoUrl || match.photo_url) && (
          <img src={photoUrl || match.photo_url} alt="Resultado" style={{
            width: '100%', borderRadius: 12, marginBottom: 14, maxHeight: 200, objectFit: 'cover',
          }} />
        )}

        {inDispute && match.dispute_reason && (
          <div style={{ background: '#ef444418', border: '1px solid #ef444444', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#ef4444', fontWeight: 700 }}>⚠️ En disputa: {match.dispute_reason}</p>
          </div>
        )}

        {/* Score input for players */}
        {isPlayer && (pending || inDispute) && !waitingApproval && (
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: C.textDim, textAlign: 'center' }}>Cargar resultado</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <input type="number" min="0" value={s1} onChange={e => setS1(e.target.value)}
                style={{ width: 64, textAlign: 'center', background: C.panel2, border: `1px solid ${C.green}`, borderRadius: 10, padding: '10px 0', color: C.text, fontSize: 24, fontWeight: 800, outline: 'none' }} />
              <span style={{ color: C.textDim, fontWeight: 700 }}>—</span>
              <input type="number" min="0" value={s2} onChange={e => setS2(e.target.value)}
                style={{ width: 64, textAlign: 'center', background: C.panel2, border: `1px solid ${C.green}`, borderRadius: 10, padding: '10px 0', color: C.text, fontSize: 24, fontWeight: 800, outline: 'none' }} />
            </div>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={{ padding: 10, borderRadius: 10, border: `1px dashed ${C.border}`, textAlign: 'center', cursor: 'pointer', color: C.textDim, fontSize: 13 }}>
                {uploadingPhoto ? 'Subiendo…' : photoUrl ? '✅ Foto cargada — cambiar' : '📸 Subir foto del resultado (opcional)'}
              </div>
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => onSubmitScore(match.id, parseInt(s1)||0, parseInt(s2)||0, photoUrl)} disabled={busy}
                style={{ flex: 2, padding: 12, borderRadius: 12, border: 'none', background: C.green, color: C.bg, fontWeight: 700, cursor: 'pointer' }}>
                {busy ? '…' : 'Enviar resultado'}
              </button>
            </div>
          </div>
        )}

        {/* Staff actions */}
        {canManage && waitingApproval && (
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: C.textDim, textAlign: 'center' }}>Resultado enviado — pendiente de aprobación</p>
            {!showDispute ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowDispute(true)} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid #ef4444`, background: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>
                  ⚠️ Disputar
                </button>
                <button onClick={() => onApprove(match.id)} disabled={busy} style={{ flex: 2, padding: 12, borderRadius: 12, border: 'none', background: C.green, color: C.bg, fontWeight: 700, cursor: 'pointer' }}>
                  {busy ? '…' : '✅ Aprobar resultado'}
                </button>
              </div>
            ) : (
              <div>
                <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                  placeholder="Motivo de la disputa…"
                  style={{ width: '100%', boxSizing: 'border-box', background: C.panel2, border: `1px solid #ef4444`, borderRadius: 10, padding: 10, color: C.text, fontSize: 13, resize: 'none', marginBottom: 8, outline: 'none' }}
                  rows={3}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowDispute(false)} style={{ flex: 1, padding: 11, borderRadius: 12, border: `1px solid ${C.border}`, background: 'none', color: C.text, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={() => onDispute(match.id, disputeReason)} disabled={busy || !disputeReason.trim()} style={{ flex: 2, padding: 11, borderRadius: 12, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                    Marcar en disputa
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {canManage && inDispute && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onApprove(match.id)} disabled={busy} style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: C.green, color: C.bg, fontWeight: 700, cursor: 'pointer' }}>
              {busy ? '…' : '✅ Resolver — Aprobar resultado'}
            </button>
          </div>
        )}

        {!isPlayer && !canManage && (
          <button onClick={onClose} style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontWeight: 700, cursor: 'pointer' }}>Cerrar</button>
        )}
        {done && (
          <button onClick={onClose} style={{ width: '100%', marginTop: 8, padding: 11, borderRadius: 12, border: `1px solid ${C.border}`, background: 'none', color: C.text2, fontWeight: 700, cursor: 'pointer' }}>Cerrar</button>
        )}
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function CommunityTournamentsPanel({ community, onClose, canManage = false, onOpenChat }) {
  const { profile } = useAuthStore()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [detailItem, setDetailItem] = useState(null)
  const [filter, setFilter] = useState('all')
  const [userPerms, setUserPerms] = useState(null)

  const communityTags = community?.tags || []

  useEffect(() => {
    if (!community?.id || !profile?.id) return
    async function loadPerms() {
      const { data } = await supabase
        .from('community_role_members')
        .select('role:role_id(can_create_tournaments, can_manage_tournaments, can_manage_members, can_publish_announcements)')
        .eq('conversation_id', community.id)
        .eq('user_id', profile.id)
        .maybeSingle()
      setUserPerms(data?.role || null)
    }
    loadPerms()
  }, [community?.id, profile?.id])

  const canCreateTournament = canManage || !!userPerms?.can_create_tournaments
  const isStaff = canManage || !!userPerms?.can_manage_tournaments
  const [showCEOPanel, setShowCEOPanel] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('conversations')
      .select('id, name, description, group_type, tournament_status, tournament_format, tournament_mode, game, max_participants, created_by, avatar_url, banner_url, members:conversation_members(user_id)')
      .or(`community_id.eq.${community.id},and(created_by.eq.${profile?.id},community_id.is.null)`)
      .in('group_type', ['tournament', 'liga'])
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { if (community?.id) load() }, [community?.id])

  async function handleJoin(convId) {
    if (!profile?.id) return
    const { data, error } = await supabase.rpc('join_tournament', { p_tournament_id: convId })
    if (error || data?.ok === false) {
      const msg = data?.error || error?.message || 'Error al inscribirse'
      if (msg === 'inscripciones_cerradas') alert('Las inscripciones están cerradas')
      else if (msg === 'torneo_lleno') alert('El torneo está lleno')
      else alert(msg)
      return
    }
    load()
  }

  function handleChat(item) {
    if (onOpenChat) onOpenChat(item.id)
    else alert('Abrí el chat de ' + item.name + ' desde la sección Chats.')
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.group_type === filter)

  if (showCEOPanel) return (
    <CEOPanel
      community={{ ...community, myRole: isStaff ? 'admin' : 'member' }}
      onBack={() => setShowCEOPanel(false)}
    />
  )

  if (detailItem) return (
    <TournamentDetail
      item={detailItem}
      onBack={() => { setDetailItem(null); load() }}
      myId={profile?.id}
      isStaff={isStaff}
    />
  )

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
        {isStaff && (
          <button onClick={() => setShowCEOPanel(true)} style={{
            background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '7px 10px',
            color: C.textDim, fontWeight: 700, fontSize: 16, cursor: 'pointer',
          }} title="Panel de Organizador">
            ⚙️
          </button>
        )}
        {canCreateTournament && (
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

      {/* Create form — full-screen overlay */}
      {canCreateTournament && showCreate && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: C.bg, display: 'flex', flexDirection: 'column',
        }}>
          {/* Overlay header */}
          <div style={{
            background: C.panel, borderBottom: `1px solid ${C.border}`,
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          }}>
            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
            <span style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>Nuevo Torneo / Liga</span>
          </div>
          {/* Scrollable form */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <CreateForm
              communityId={community.id}
              communityTags={communityTags}
              onCreated={() => { setShowCreate(false); load() }}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        </div>,
        document.body
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
            isStaff={isStaff}
            onJoin={handleJoin}
            onManage={setDetailItem}
            onChat={handleChat}
          />
        ))}
      </div>
    </div>
  )
}
