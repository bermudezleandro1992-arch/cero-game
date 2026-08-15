import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useChatStore } from '../../store/chatStore'
import { C } from '../../theme'

export default function VotacionesPage({ onBack }) {
  const { profile } = useAuthStore()
  const { conversations } = useChatStore()
  const [polls, setPolls]         = useState([])
  const [tab, setTab]             = useState('lista')
  const [creating, setCreating]   = useState(false)
  const [form, setForm]           = useState({ question: '', options: ['', ''], convId: '', multi: false, endDate: '' })
  const [votes, setVotes]         = useState({}) // pollId -> optionIdx[]
  const [loading, setLoading]     = useState(false)

  const groups = conversations.filter(c => c.isGroup || c.isCommunity)

  useEffect(() => { loadPolls() }, [profile?.id])

  async function loadPolls() {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('polls')
      .select('*, poll_votes(user_id, option_index)')
      .order('created_at', { ascending: false })
      .limit(30)
    setPolls(data || [])
    setLoading(false)
  }

  async function createPoll() {
    const opts = form.options.filter(o => o.trim())
    if (!form.question.trim() || opts.length < 2 || !form.convId) return
    setCreating(true)
    const { error } = await supabase.from('polls').insert({
      question: form.question.trim(),
      options: opts,
      conversation_id: form.convId,
      created_by: profile.id,
      multi_choice: form.multi,
      ends_at: form.endDate || null,
    })
    setCreating(false)
    if (error) { alert(error.message); return }
    setForm({ question: '', options: ['', ''], convId: '', multi: false, endDate: '' })
    setTab('lista')
    loadPolls()
  }

  async function vote(pollId, optionIdx) {
    await supabase.from('poll_votes').upsert(
      { poll_id: pollId, user_id: profile.id, option_index: optionIdx },
      { onConflict: 'poll_id,user_id,option_index' }
    )
    loadPolls()
  }

  async function deletePoll(id) {
    if (!confirm('¿Eliminar encuesta?')) return
    await supabase.from('polls').delete().eq('id', id)
    setPolls(prev => prev.filter(p => p.id !== id))
  }

  function addOption() {
    if (form.options.length >= 8) return
    setForm(prev => ({ ...prev, options: [...prev.options, ''] }))
  }

  function setOption(i, val) {
    setForm(prev => {
      const opts = [...prev.options]; opts[i] = val; return { ...prev, options: opts }
    })
  }

  function removeOption(i) {
    if (form.options.length <= 2) return
    setForm(prev => ({ ...prev, options: prev.options.filter((_, idx) => idx !== i) }))
  }

  function getVoteCounts(poll) {
    const counts = Array(poll.options.length).fill(0)
    ;(poll.poll_votes || []).forEach(v => { if (counts[v.option_index] !== undefined) counts[v.option_index]++ })
    return counts
  }

  function myVotes(poll) {
    return (poll.poll_votes || []).filter(v => v.user_id === profile.id).map(v => v.option_index)
  }

  const total = (poll) => (poll.poll_votes || []).length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>🗳️ Votaciones</h2>
          <p style={{ margin: 0, color: C.textDim, fontSize: 12 }}>Encuestas para tu comunidad</p>
        </div>
        <button onClick={() => setTab('crear')} style={{ background: `${C.green}18`, border: `1px solid ${C.green}33`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: C.green, fontSize: 12, fontWeight: 700 }}>
          + Nueva
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {[['lista','📊 Encuestas'],['crear','➕ Crear']].map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '10px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            color: tab === id ? C.green : C.textDim,
            borderBottom: `2px solid ${tab === id ? C.green : 'transparent'}`,
          }}>{lbl}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* LISTA */}
        {tab === 'lista' && (
          loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 24, height: 24, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            </div>
          ) : polls.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: C.textDim }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🗳️</div>
              <p style={{ margin: 0, fontSize: 14 }}>No hay encuestas aún</p>
              <button onClick={() => setTab('crear')} style={{ marginTop: 14, background: C.green, border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: C.bg, fontWeight: 700, fontSize: 13 }}>
                Crear primera encuesta
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {polls.map(poll => {
                const counts = getVoteCounts(poll)
                const totalVotes = total(poll)
                const myV = myVotes(poll)
                const voted = myV.length > 0
                const ended = poll.ends_at && new Date(poll.ends_at) < new Date()
                return (
                  <div key={poll.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text, flex: 1 }}>{poll.question}</p>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {ended && <span style={{ fontSize: 9, fontWeight: 800, color: '#ef4444', background: '#ef444418', border: '1px solid #ef444433', borderRadius: 6, padding: '1px 6px' }}>CERRADA</span>}
                        {poll.created_by === profile.id && (
                          <button onClick={() => deletePoll(poll.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: 0 }}>🗑</button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {poll.options.map((opt, i) => {
                        const cnt = counts[i] || 0
                        const pct = totalVotes > 0 ? Math.round(cnt / totalVotes * 100) : 0
                        const isMyVote = myV.includes(i)
                        return (
                          <div
                            key={i}
                            onClick={() => !ended && !voted && vote(poll.id, i)}
                            style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', cursor: !ended && !voted ? 'pointer' : 'default', border: `1px solid ${isMyVote ? C.green : C.border}` }}
                          >
                            <div style={{ position: 'absolute', inset: 0, width: `${voted || ended ? pct : 0}%`, background: isMyVote ? `${C.green}22` : `${C.panel2}`, transition: 'width .5s ease', borderRadius: 10 }} />
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '10px 12px', gap: 8 }}>
                              {isMyVote && <span style={{ fontSize: 12, color: C.green }}>✓</span>}
                              <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: isMyVote ? 700 : 400 }}>{opt}</span>
                              {(voted || ended) && <span style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>{pct}% ({cnt})</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <p style={{ margin: '10px 0 0', fontSize: 11, color: C.textDim }}>
                      {totalVotes} voto{totalVotes !== 1 ? 's' : ''}
                      {poll.ends_at && !ended && ` · Cierra ${new Date(poll.ends_at).toLocaleDateString('es-AR')}`}
                      {!voted && !ended && <span style={{ color: C.green }}> · Tocá una opción para votar</span>}
                    </p>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* CREAR */}
        {tab === 'crear' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Pregunta</p>
              <input
                value={form.question}
                onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
                placeholder="¿Cuál es tu jugador favorito de eFootball?"
                style={{ width: '100%', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Opciones</p>
              {form.options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input
                    value={opt}
                    onChange={e => setOption(i, e.target.value)}
                    placeholder={`Opción ${i+1}`}
                    style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }}
                  />
                  {form.options.length > 2 && (
                    <button onClick={() => removeOption(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 18, padding: '0 4px' }}>×</button>
                  )}
                </div>
              ))}
              {form.options.length < 8 && (
                <button onClick={addOption} style={{ background: 'none', border: `1px dashed ${C.border}`, borderRadius: 10, padding: '8px 14px', cursor: 'pointer', color: C.textDim, fontSize: 12, width: '100%' }}>
                  + Agregar opción
                </button>
              )}
            </div>

            <div>
              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Grupo / Comunidad</p>
              <select
                value={form.convId}
                onChange={e => setForm(p => ({ ...p, convId: e.target.value }))}
                style={{ width: '100%', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: form.convId ? C.text : C.textDim, fontSize: 14, outline: 'none' }}
              >
                <option value="">Seleccionar grupo...</option>
                {groups.map(c => <option key={c.id} value={c.id}>{c.isCommunity ? '🌐 ' : '👥 '}{c.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10 }}>
              <span style={{ flex: 1, fontSize: 13, color: C.text }}>Permitir múltiples respuestas</span>
              <button onClick={() => setForm(p => ({ ...p, multi: !p.multi }))} style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: form.multi ? C.green : C.panel2, outline: `1px solid ${form.multi ? C.green : C.border}`,
                position: 'relative', transition: 'background .2s',
              }}>
                <div style={{ position: 'absolute', top: 2, left: form.multi ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
              </button>
            </div>

            <div>
              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Fecha de cierre (opcional)</p>
              <input
                type="date"
                value={form.endDate}
                onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                style={{ width: '100%', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <button
              onClick={createPoll}
              disabled={creating || !form.question.trim() || form.options.filter(o => o.trim()).length < 2 || !form.convId}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                background: !form.question.trim() || !form.convId ? C.panel2 : `#a855f7`,
                color: !form.question.trim() || !form.convId ? C.textDim : '#fff',
                fontWeight: 700, fontSize: 15, cursor: 'pointer',
              }}
            >{creating ? 'Creando...' : '🗳️ Publicar encuesta'}</button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
