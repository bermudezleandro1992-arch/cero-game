import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { C } from '../theme'

const STATUS = {
  open:        { label: 'Abierto',   color: '#f59e0b', bg: '#f59e0b18' },
  in_progress: { label: 'En curso',  color: '#3b82f6', bg: '#3b82f618' },
  closed:      { label: 'Cerrado',   color: '#6b7280', bg: '#6b728018' },
}

const CAT = {
  technical: { label: 'Técnico',       icon: '🔧' },
  account:   { label: 'Cuenta',        icon: '👤' },
  billing:   { label: 'Pagos',         icon: '💳' },
  other:     { label: 'General',       icon: '💬' },
}

function Avatar({ name, url, size = 36 }) {
  const colors = ['#e91e63','#9c27b0','#1565c0','#00838f','#2e7d32','#e65100']
  let h = 0; if (name) for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  const bg = colors[Math.abs(h) % colors.length]
  return url
    ? <img src={url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.38, flexShrink: 0 }}>{(name || '?').slice(0, 2).toUpperCase()}</div>
}

function timeAgo(ts) {
  if (!ts) return ''
  const d = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (d < 60) return 'ahora'
  if (d < 3600) return `${Math.floor(d/60)}m`
  if (d < 86400) return `${Math.floor(d/3600)}h`
  return `${Math.floor(d/86400)}d`
}

export default function SoporteStaffPage({ onBack }) {
  const { profile } = useAuthStore()
  const [filter, setFilter] = useState('open')
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [closeNote, setCloseNote] = useState('')
  const [quickReplies, setQuickReplies] = useState([])
  const [showQR, setShowQR] = useState(false)
  const [newQR, setNewQR] = useState({ title: '', content: '' })
  const [addingQR, setAddingQR] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const loadTickets = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('support_tickets')
      .select(`*, user:users!support_tickets_user_id_fkey(id,display_name,username,avatar_url,role), agent:users!support_tickets_assigned_to_fkey(id,display_name,username)`)
      .order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setTickets(data || [])
    setLoading(false)
  }, [filter])

  useEffect(() => { loadTickets() }, [loadTickets])

  const loadMessages = useCallback(async (convId) => {
    if (!convId) return
    setMsgLoading(true)
    const { data } = await supabase
      .from('messages')
      .select('*, sender:users!messages_sender_id_fkey(id,display_name,username,avatar_url)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(200)
    setMessages(data || [])
    setMsgLoading(false)
  }, [])

  useEffect(() => {
    if (!selected) return
    loadMessages(selected.conversation_id)

    const ch = supabase.channel(`ticket-msgs-${selected.conversation_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selected.conversation_id}` }, payload => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [selected, loadMessages])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    supabase.from('ticket_quick_replies').select('*').order('created_at').then(({ data }) => setQuickReplies(data || []))
  }, [])

  async function takeTicket() {
    if (!selected) return
    // Direct update — bypasses missing RPC
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: 'in_progress', assigned_to: profile.id })
      .eq('id', selected.id)
    if (error) {
      alert(`Error al tomar el ticket: ${error.message}`)
      return
    }
    // Ensure staff is in the support conversation so they can chat
    if (selected.conversation_id) {
      await supabase.from('conversation_members')
        .upsert({ conversation_id: selected.conversation_id, user_id: profile.id }, { onConflict: 'conversation_id,user_id', ignoreDuplicates: true })
    }
    const updated = { ...selected, status: 'in_progress', assigned_to: profile.id, agent: { id: profile.id, display_name: profile.display_name, username: profile.username } }
    setSelected(updated)
    setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, status: 'in_progress', assigned_to: profile.id } : t))
  }

  async function closeTicket() {
    if (!selected || !closeNote.trim()) return
    // Try RPC first, fall back to direct update
    const { error: rpcErr } = await supabase.rpc('close_support_ticket', { p_ticket_id: selected.id, p_note: closeNote.trim() })
    if (rpcErr) {
      const { error: updateErr } = await supabase
        .from('support_tickets')
        .update({ status: 'closed', staff_note: closeNote.trim() })
        .eq('id', selected.id)
      if (updateErr) { alert(`Error al cerrar el ticket: ${updateErr.message}`); return }
    }
    setSelected(prev => ({ ...prev, status: 'closed', staff_note: closeNote }))
    setShowClose(false)
    setCloseNote('')
    loadTickets()
  }

  async function sendMessage() {
    if (!input.trim() || !selected?.conversation_id || sending) return
    setSending(true)
    const content = input.trim()
    setInput('')
    await supabase.from('messages').insert({ conversation_id: selected.conversation_id, sender_id: profile.id, content, type: 'text' })
    setSending(false)
    inputRef.current?.focus()
  }

  async function addQuickReply() {
    if (!newQR.title.trim() || !newQR.content.trim()) return
    const { data } = await supabase.from('ticket_quick_replies').insert({ title: newQR.title, body: newQR.content, created_by: profile.id }).select().single()
    if (data) { setQuickReplies(prev => [...prev, data]); setNewQR({ title: '', content: '' }); setAddingQR(false) }
  }

  async function deleteQR(id) {
    await supabase.from('ticket_quick_replies').delete().eq('id', id)
    setQuickReplies(prev => prev.filter(r => r.id !== id))
  }

  const filterCounts = { open: tickets.filter(t => t.status==='open').length, in_progress: tickets.filter(t => t.status==='in_progress').length, closed: tickets.filter(t => t.status==='closed').length }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>Panel de Soporte</div>
          <div style={{ color: C.textDim, fontSize: 11 }}>Staff — {profile?.display_name || profile?.username}</div>
        </div>
        <button onClick={loadTickets} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.textDim }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LEFT: Ticket list */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.border}`, overflow: 'hidden', transition: 'all .2s' }}
          className={`soporte-list${selected ? ' soporte-list--hidden' : ''}`}>

          {/* Filter tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            {[['open','Abiertos'], ['in_progress','En curso'], ['closed','Cerrados'], ['all','Todos']].map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} style={{
                flex: 1, padding: '10px 4px', border: 'none', background: 'none', cursor: 'pointer',
                color: filter === id ? C.green : C.textDim, fontWeight: filter === id ? 700 : 400,
                fontSize: 11, borderBottom: `2px solid ${filter === id ? C.green : 'transparent'}`,
                transition: 'all .15s',
              }}>
                {label}
                {id !== 'all' && filterCounts[id] > 0 && <span style={{ marginLeft: 4, background: filter===id ? C.green : C.border, color: filter===id ? '#fff' : C.textDim, borderRadius: 8, padding: '1px 5px', fontSize: 9, fontWeight: 800 }}>{filterCounts[id]}</span>}
              </button>
            ))}
          </div>

          {/* Ticket list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div style={{ width: 24, height: 24, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
              </div>
            ) : tickets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: C.textDim }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Sin tickets {filter !== 'all' ? STATUS[filter]?.label?.toLowerCase() + 's' : ''}</div>
              </div>
            ) : tickets.map(t => {
              const s = STATUS[t.status] || STATUS.open
              const c = CAT[t.category] || CAT.other
              return (
                <div key={t.id} onClick={() => setSelected(t)} style={{
                  padding: '12px 16px', borderBottom: `1px solid ${C.border}22`,
                  cursor: 'pointer', background: selected?.id === t.id ? `${C.green}10` : 'transparent',
                  borderLeft: `3px solid ${selected?.id === t.id ? C.green : 'transparent'}`,
                  transition: 'all .12s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 800, color: C.text, fontSize: 13 }}>{t.ticket_no}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, borderRadius: 6, padding: '2px 7px' }}>{s.label}</span>
                    </div>
                    <span style={{ fontSize: 10, color: C.textDim }}>{timeAgo(t.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Avatar name={t.user?.display_name || t.user?.username} url={t.user?.avatar_url} size={24} />
                    <span style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{t.user?.display_name || t.user?.username || 'Usuario'}</span>
                    <span style={{ fontSize: 11, color: C.textDim }}>{c.icon} {c.label}</span>
                  </div>
                  {t.title && <div style={{ color: C.textDim, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>}
                  {t.agent && <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 4 }}>👤 {t.agent.display_name || t.agent.username}</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: Ticket detail */}
        {selected && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }} className="soporte-detail">
            {/* Ticket header */}
            <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '10px 14px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                </button>
                <span style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>{selected.ticket_no}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: STATUS[selected.status]?.color, background: STATUS[selected.status]?.bg, borderRadius: 6, padding: '2px 8px' }}>{STATUS[selected.status]?.label}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  {selected.status === 'open' && (
                    <button onClick={takeTicket} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      Tomar ticket
                    </button>
                  )}
                  {selected.status !== 'closed' && (
                    <button onClick={() => setShowClose(true)} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid #ef4444`, background: 'transparent', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      Cerrar
                    </button>
                  )}
                </div>
              </div>
              {/* User info row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.panel2, borderRadius: 10, padding: '8px 12px' }}>
                <Avatar name={selected.user?.display_name || selected.user?.username} url={selected.user?.avatar_url} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{selected.user?.display_name || selected.user?.username}</div>
                  <div style={{ color: C.textDim, fontSize: 11 }}>@{selected.user?.username} · {selected.user?.role || 'jugador'}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: C.textDim }}>{CAT[selected.category]?.icon} {CAT[selected.category]?.label}</div>
                  {selected.agent && <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>Agente: {selected.agent.display_name || selected.agent.username}</div>}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
              {msgLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                  <div style={{ width: 20, height: 20, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: C.textDim, fontSize: 13 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                  El usuario aún no inició la conversación.
                </div>
              ) : messages.map(m => {
                const isMe = m.sender_id === profile?.id
                const sender = m.sender
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 8, marginBottom: 10, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                    {!isMe && <Avatar name={sender?.display_name || sender?.username} url={sender?.avatar_url} size={28} />}
                    <div style={{ maxWidth: '75%' }}>
                      {!isMe && <div style={{ fontSize: 10, color: C.textDim, marginBottom: 2, marginLeft: 4 }}>{sender?.display_name || sender?.username}</div>}
                      <div style={{
                        background: isMe ? C.green : C.panel2,
                        color: isMe ? '#fff' : C.text,
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        padding: '8px 12px', fontSize: 13, lineHeight: 1.5,
                        border: isMe ? 'none' : `1px solid ${C.border}`,
                      }}>
                        {m.content}
                      </div>
                      <div style={{ fontSize: 10, color: C.textDim, marginTop: 2, textAlign: isMe ? 'right' : 'left', paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0 }}>
                        {new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )
              })}
              {selected.staff_note && (
                <div style={{ margin: '8px 0', padding: '10px 14px', background: '#6b728018', border: `1px solid #6b728040`, borderRadius: 10, fontSize: 12, color: C.textDim }}>
                  <span style={{ fontWeight: 700, color: C.text }}>Ticket cerrado:</span> {selected.staff_note}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            {selected.status !== 'closed' && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 14px', flexShrink: 0 }}>
                {/* Quick replies */}
                {showQR && (
                  <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 8, maxHeight: 220, overflowY: 'auto' }}>
                    <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: C.text }}>Respuestas rápidas</span>
                      <button onClick={() => setAddingQR(!addingQR)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, fontSize: 12, fontWeight: 700 }}>+ Nueva</button>
                    </div>
                    {addingQR && (
                      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}` }}>
                        <input placeholder="Título (ej: Saludo inicial)" value={newQR.title} onChange={e => setNewQR(p => ({...p, title: e.target.value}))}
                          style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px', color: C.text, fontSize: 12, outline: 'none', marginBottom: 6, boxSizing: 'border-box' }} />
                        <textarea placeholder="Contenido del mensaje..." value={newQR.content} onChange={e => setNewQR(p => ({...p, content: e.target.value}))}
                          style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px', color: C.text, fontSize: 12, outline: 'none', resize: 'none', minHeight: 60, boxSizing: 'border-box', fontFamily: 'inherit' }} />
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <button onClick={addQuickReply} style={{ padding: '5px 14px', borderRadius: 6, background: C.green, border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Guardar</button>
                          <button onClick={() => setAddingQR(false)} style={{ padding: '5px 14px', borderRadius: 6, background: 'none', border: `1px solid ${C.border}`, color: C.textDim, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                        </div>
                      </div>
                    )}
                    {quickReplies.length === 0 && !addingQR && <div style={{ padding: '12px', color: C.textDim, fontSize: 12, textAlign: 'center' }}>No hay respuestas guardadas aún.</div>}
                    {quickReplies.map(r => (
                      <div key={r.id} style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}22`, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { setInput(r.body); setShowQR(false); inputRef.current?.focus() }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: C.text }}>{r.title}</div>
                          <div style={{ fontSize: 11, color: C.textDim, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.body}</div>
                        </div>
                        <button onClick={() => deleteQR(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 14, padding: 0, flexShrink: 0 }}>🗑</button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <button onClick={() => setShowQR(!showQR)} title="Respuestas rápidas" style={{ background: showQR ? `${C.green}18` : 'none', border: `1px solid ${showQR ? C.green : C.border}`, borderRadius: 8, padding: '8px', cursor: 'pointer', color: showQR ? C.green : C.textDim, flexShrink: 0 }}>
                    ⚡
                  </button>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder="Escribí una respuesta... (Enter para enviar)"
                    rows={1}
                    style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', color: C.text, fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}
                  />
                  <button onClick={sendMessage} disabled={!input.trim() || sending} style={{ background: input.trim() ? C.green : C.border, border: 'none', borderRadius: 8, padding: '9px 14px', cursor: input.trim() ? 'pointer' : 'default', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0, transition: 'all .15s' }}>
                    {sending ? '...' : '↑'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Close ticket modal */}
      {showClose && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: C.panel, borderRadius: 16, padding: 24, maxWidth: 420, width: '100%', border: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: C.text, marginBottom: 4 }}>Cerrar ticket {selected?.ticket_no}</div>
            <div style={{ color: C.textDim, fontSize: 13, marginBottom: 16 }}>Agregá una nota de resolución antes de cerrar.</div>
            <textarea
              value={closeNote}
              onChange={e => setCloseNote(e.target.value)}
              placeholder="Ej: Se resolvió el problema de acceso. El usuario pudo ingresar correctamente."
              style={{ width: '100%', minHeight: 90, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: C.text, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setShowClose(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'none', color: C.textDim, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={closeTicket} disabled={!closeNote.trim()} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: closeNote.trim() ? '#ef4444' : C.border, color: '#fff', fontWeight: 700, cursor: closeNote.trim() ? 'pointer' : 'default' }}>
                Cerrar ticket
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Mobile: full width list, hidden when ticket selected */
        .soporte-list { width: 100%; min-width: 100%; }
        .soporte-list--hidden { width: 0; min-width: 0; }
        /* Desktop: fixed sidebar, always visible */
        @media (min-width: 768px) {
          .soporte-list { width: 300px !important; min-width: 300px !important; max-width: 300px !important; }
          .soporte-list--hidden { width: 300px !important; min-width: 300px !important; max-width: 300px !important; }
        }
        @media (min-width: 1100px) {
          .soporte-list { width: 360px !important; min-width: 360px !important; max-width: 360px !important; }
          .soporte-list--hidden { width: 360px !important; min-width: 360px !important; max-width: 360px !important; }
        }
      `}</style>
    </div>
  )
}
