import { useState } from 'react'
import { C } from '../../theme'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const TYPE_CFG = {
  partido:  { icon: '⚽', color: '#22c55e' },
  torneo:   { icon: '🏆', color: '#f59e0b' },
  reunion:  { icon: '💬', color: '#3b82f6' },
  sorteo:   { icon: '🎲', color: '#a855f7' },
  otro:     { icon: '📌', color: '#64748b' },
}

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }
function firstDayOfMonth(y, m) { return new Date(y, m, 1).getDay() }

export default function CalendarioPage({ onBack }) {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [events, setEvents] = useState([])
  const [tab, setTab]     = useState('calendario')
  const [selected, setSelected] = useState(null) // date string YYYY-MM-DD
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]   = useState({ title: '', type: 'partido', time: '', desc: '' })

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  function addEvent() {
    if (!form.title.trim() || !selected) return
    const ev = { id: Date.now(), date: selected, ...form, title: form.title.trim() }
    setEvents(prev => [...prev, ev].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)))
    setForm({ title: '', type: 'partido', time: '', desc: '' })
    setShowForm(false)
  }

  function removeEvent(id) {
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const days = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(d)

  function dateStr(d) {
    return `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  function eventsFor(d) {
    return events.filter(e => e.date === dateStr(d))
  }

  const selectedEvents = selected ? events.filter(e => e.date === selected) : []
  const upcomingEvents = events.filter(e => e.date >= today.toISOString().slice(0,10)).slice(0, 20)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>📅 Calendario de Eventos</h2>
          <p style={{ margin: 0, color: C.textDim, fontSize: 12 }}>{events.length} evento{events.length !== 1 ? 's' : ''} programado{events.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {[['calendario','📅 Calendario'],['agenda','📋 Agenda']].map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '10px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            color: tab === id ? C.green : C.textDim,
            borderBottom: `2px solid ${tab === id ? C.green : 'transparent'}`,
          }}>{lbl}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {tab === 'calendario' && (
          <>
            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: C.panel, borderBottom: `1px solid ${C.border}` }}>
              <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 20, padding: '0 8px' }}>‹</button>
              <p style={{ flex: 1, margin: 0, textAlign: 'center', color: C.text, fontWeight: 700, fontSize: 15 }}>{MONTHS[month]} {year}</p>
              <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 20, padding: '0 8px' }}>›</button>
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: C.panel }}>
              {DAYS.map(d => (
                <div key={d} style={{ padding: '6px 0', textAlign: 'center', fontSize: 10, fontWeight: 700, color: C.textDim }}>{d}</div>
              ))}
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: C.border }}>
              {cells.map((d, i) => {
                if (!d) return <div key={`e${i}`} style={{ background: C.bg, minHeight: 58 }} />
                const ds = dateStr(d)
                const evs = eventsFor(d)
                const isToday = ds === today.toISOString().slice(0,10)
                const isSel   = ds === selected
                return (
                  <div key={d} onClick={() => { setSelected(isSel ? null : ds); setShowForm(false) }} style={{
                    background: isSel ? `${C.green}18` : C.bg,
                    border: isToday ? `2px solid ${C.green}` : isSel ? `2px solid ${C.green}55` : '2px solid transparent',
                    minHeight: 58, padding: '4px 4px 2px', cursor: 'pointer',
                    borderRadius: 4,
                  }}>
                    <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: isToday ? 800 : 400, color: isToday ? C.green : C.text, textAlign: 'center' }}>{d}</p>
                    {evs.slice(0, 2).map(ev => {
                      const tc = TYPE_CFG[ev.type] || TYPE_CFG.otro
                      return <div key={ev.id} style={{ background: `${tc.color}22`, borderRadius: 3, padding: '1px 3px', marginBottom: 2, fontSize: 9, color: tc.color, fontWeight: 700, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{tc.icon} {ev.title}</div>
                    })}
                    {evs.length > 2 && <p style={{ margin: 0, fontSize: 9, color: C.textDim, textAlign: 'center' }}>+{evs.length - 2}</p>}
                  </div>
                )
              })}
            </div>

            {/* Selected day panel */}
            {selected && (
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 14 }}>
                    {new Date(selected + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <button onClick={() => setShowForm(v => !v)} style={{
                    background: C.green, border: 'none', borderRadius: 8, padding: '6px 12px',
                    cursor: 'pointer', color: C.bg, fontWeight: 700, fontSize: 12,
                  }}>{showForm ? '✕ Cancelar' : '+ Agregar'}</button>
                </div>

                {showForm && (
                  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="Título del evento..." style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', color: C.text, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                        style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }}>
                        {Object.entries(TYPE_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {k.charAt(0).toUpperCase()+k.slice(1)}</option>)}
                      </select>
                      <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                        style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
                    </div>
                    <input value={form.desc} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))}
                      placeholder="Descripción (opcional)..." style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', color: C.text, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                    <button onClick={addEvent} disabled={!form.title.trim()} style={{
                      background: form.title.trim() ? C.green : C.panel2, border: 'none', borderRadius: 10,
                      color: form.title.trim() ? C.bg : C.textDim, fontWeight: 700, fontSize: 14, padding: 10, cursor: 'pointer',
                    }}>✅ Guardar evento</button>
                  </div>
                )}

                {selectedEvents.length === 0 && !showForm && (
                  <p style={{ color: C.textDim, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Sin eventos · tocá + Agregar</p>
                )}
                {selectedEvents.map(ev => {
                  const tc = TYPE_CFG[ev.type] || TYPE_CFG.otro
                  return (
                    <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${tc.color}18`, border: `1px solid ${tc.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{tc.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</p>
                        {ev.time && <p style={{ margin: '2px 0 0', color: tc.color, fontSize: 12, fontWeight: 600 }}>🕐 {ev.time}</p>}
                        {ev.desc && <p style={{ margin: '2px 0 0', color: C.textDim, fontSize: 11 }}>{ev.desc}</p>}
                      </div>
                      <button onClick={() => removeEvent(ev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: 4 }}>🗑</button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === 'agenda' && (
          <div style={{ padding: 16 }}>
            {upcomingEvents.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: C.textDim }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
                <p style={{ margin: 0, fontSize: 14 }}>No hay eventos próximos</p>
                <p style={{ margin: '6px 0 0', fontSize: 12 }}>Tocá un día en el calendario para agregar uno</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcomingEvents.map(ev => {
                  const tc = TYPE_CFG[ev.type] || TYPE_CFG.otro
                  const dDate = new Date(ev.date + 'T12:00:00')
                  return (
                    <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: `${tc.color}18`, border: `1px solid ${tc.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{tc.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 14 }}>{ev.title}</p>
                        <p style={{ margin: '3px 0 0', color: C.textDim, fontSize: 12 }}>
                          📅 {dDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })}
                          {ev.time && ` · 🕐 ${ev.time}`}
                        </p>
                        {ev.desc && <p style={{ margin: '2px 0 0', color: C.textDim, fontSize: 11 }}>{ev.desc}</p>}
                      </div>
                      <button onClick={() => removeEvent(ev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: 4 }}>🗑</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
