import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

const CHANNELS = ['general', 'avisos', 'anuncios']
const CATEGORIES = ['torneos', 'ligas', 'clanes', 'noticias', 'resultados', 'otro']
const CAT_EMOJI = { torneos: '🏆', ligas: '⚽', clanes: '🛡️', noticias: '📰', resultados: '📊', otro: '📢' }
const CHAN_EMOJI = { general: '💬', avisos: '📋', anuncios: '📢' }
const TIPO_LABELS = {
  torneo_nuevo: 'Nuevo torneo',
  torneo_inicio: 'Inicio de torneo',
  cupos: 'Alerta de cupos',
  resultado: 'Resultado publicado',
  liga_jornada: 'Nueva jornada de liga',
  clanes_evento: 'Evento de clanes',
}

function Section({ title, children }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.panel2 }}>
        <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{title}</span>
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  )
}

export default function CommunityBotSettingsPage({ conversation, onBack }) {
  const [bots, setBots] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTpl, setNewTpl] = useState({ channel: 'general', category: 'torneos', message_template: '', name: '', include_link: false, include_prizes: false, alert_thresholds: '' })
  const [saving, setSaving] = useState(false)
  const [editingTpl, setEditingTpl] = useState(null)

  useEffect(() => { load() }, [conversation?.id])

  async function load() {
    setLoading(true)
    const { data: botsData } = await supabase
      .from('bot_tokens')
      .select('id, name, active, last_used_at, token')
      .eq('conversation_id', conversation.id)
    setBots(botsData || [])

    if (botsData?.length > 0) {
      const botIds = botsData.map(b => b.id)
      const { data: tplData } = await supabase
        .from('bot_templates')
        .select('*')
        .in('bot_id', botIds)
        .order('created_at', { ascending: false })
      setTemplates(tplData || [])
    }
    setLoading(false)
  }

  async function saveTemplate() {
    if (!newTpl.name.trim() || !newTpl.message_template.trim() || bots.length === 0) return
    setSaving(true)
    const thresholds = newTpl.alert_thresholds
      ? newTpl.alert_thresholds.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n))
      : null

    if (editingTpl) {
      await supabase.from('bot_templates').update({
        name: newTpl.name.trim(),
        channel: newTpl.channel,
        category: newTpl.category,
        message_template: newTpl.message_template.trim(),
        include_link: newTpl.include_link,
        include_prizes: newTpl.include_prizes,
        alert_thresholds: thresholds,
      }).eq('id', editingTpl.id)
    } else {
      await supabase.from('bot_templates').insert({
        bot_id: bots[0].id,
        name: newTpl.name.trim(),
        channel: newTpl.channel,
        category: newTpl.category,
        message_template: newTpl.message_template.trim(),
        include_link: newTpl.include_link,
        include_prizes: newTpl.include_prizes,
        alert_thresholds: thresholds,
      })
    }
    setSaving(false)
    setNewTpl({ channel: 'general', category: 'torneos', message_template: '', name: '', include_link: false, include_prizes: false, alert_thresholds: '' })
    setEditingTpl(null)
    load()
  }

  async function deleteTpl(id) {
    if (!confirm('¿Eliminar esta plantilla?')) return
    await supabase.from('bot_templates').delete().eq('id', id)
    load()
  }

  async function toggleTpl(id, active) {
    await supabase.from('bot_templates').update({ active: !active }).eq('id', id)
    load()
  }

  function startEdit(tpl) {
    setEditingTpl(tpl)
    setNewTpl({
      name: tpl.name,
      channel: tpl.channel,
      category: tpl.category,
      message_template: tpl.message_template,
      include_link: tpl.include_link,
      include_prizes: tpl.include_prizes,
      alert_thresholds: tpl.alert_thresholds?.join(', ') ?? '',
    })
  }

  const inputStyle = { background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 9, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }
  const labelStyle = { fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 5, display: 'block' }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>⚙️ Bot Settings</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', background: '#f59e0b18', border: '1px solid #f59e0b33', borderRadius: 20, padding: '2px 8px' }}>PRO</span>
          </div>
          <div style={{ color: C.textDim, fontSize: 11, marginTop: 1 }}>{conversation?.name}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {loading ? (
          <p style={{ color: C.textDim, textAlign: 'center', padding: 32 }}>Cargando...</p>
        ) : bots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: C.textDim }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
            <div style={{ fontSize: 14, marginBottom: 8, color: C.text, fontWeight: 600 }}>No hay bots en esta comunidad</div>
            <div style={{ fontSize: 12 }}>Creá un bot desde Ajustes → Bot API y asignalo a esta comunidad.</div>
          </div>
        ) : (
          <>
            {/* Bots activos */}
            <Section title="🤖 Bots activos">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bots.map(bot => (
                  <div key={bot.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.panel2, borderRadius: 10, border: `1px solid ${bot.active ? C.green + '33' : C.border}` }}>
                    <span style={{ fontSize: 22 }}>🤖</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{bot.name}</div>
                      {bot.last_used_at && <div style={{ color: C.textDim, fontSize: 11 }}>Último uso: {new Date(bot.last_used_at).toLocaleDateString('es-AR')}</div>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: bot.active ? C.green : C.textDim, background: bot.active ? `${C.green}18` : C.panel, borderRadius: 20, padding: '3px 9px' }}>
                      {bot.active ? 'Activo' : 'Pausado'}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Plantillas */}
            <Section title="📋 Plantillas de mensajes">
              {templates.length === 0 ? (
                <p style={{ margin: '0 0 12px', color: C.textDim, fontSize: 12, textAlign: 'center' }}>Sin plantillas. Creá la primera abajo.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {templates.map(tpl => (
                    <div key={tpl.id} style={{ background: C.panel2, borderRadius: 10, padding: '10px 12px', border: `1px solid ${tpl.active ? C.green + '33' : C.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 16 }}>{CAT_EMOJI[tpl.category]}</span>
                        <span style={{ flex: 1, color: C.text, fontWeight: 700, fontSize: 13 }}>{tpl.name}</span>
                        <span style={{ fontSize: 10, color: C.textDim, background: C.panel, borderRadius: 5, padding: '2px 7px' }}>{CHAN_EMOJI[tpl.channel]} {tpl.channel}</span>
                        <button onClick={() => startEdit(tpl)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 13 }}>✏️</button>
                        <button onClick={() => toggleTpl(tpl.id, tpl.active)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15 }}>{tpl.active ? '🟢' : '⚫'}</button>
                        <button onClick={() => deleteTpl(tpl.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}>✕</button>
                      </div>
                      <div style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace', background: C.panel, borderRadius: 6, padding: '6px 8px', lineHeight: 1.5, marginBottom: tpl.alert_thresholds ? 6 : 0 }}>
                        {tpl.message_template}
                      </div>
                      {tpl.alert_thresholds?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                          <span style={{ fontSize: 10, color: C.textDim }}>⚡ Alertar cuando falten:</span>
                          {tpl.alert_thresholds.map(n => (
                            <span key={n} style={{ fontSize: 10, color: '#f59e0b', background: '#f59e0b18', borderRadius: 5, padding: '1px 6px', fontWeight: 700 }}>{n} cupo{n !== 1 ? 's' : ''}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: C.textDim, background: C.panel, borderRadius: 5, padding: '2px 7px' }}>{tpl.category}</span>
                        {tpl.include_link && <span style={{ fontSize: 10, color: '#3b82f6', background: '#3b82f618', borderRadius: 5, padding: '2px 7px' }}>🔗 link</span>}
                        {tpl.include_prizes && <span style={{ fontSize: 10, color: '#f59e0b', background: '#f59e0b18', borderRadius: 5, padding: '2px 7px' }}>🏅 premios</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Form */}
              <div style={{ background: C.panel2, borderRadius: 10, padding: 12, border: `1px dashed ${C.border}` }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  {editingTpl ? '✏️ Editando plantilla' : '+ Nueva plantilla'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <div>
                    <label style={labelStyle}>Nombre</label>
                    <input value={newTpl.name} onChange={e => setNewTpl(p => ({ ...p, name: e.target.value }))} placeholder="ej: Nuevo torneo eFootball" style={inputStyle} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Canal</label>
                      <select value={newTpl.channel} onChange={e => setNewTpl(p => ({ ...p, channel: e.target.value }))} style={inputStyle}>
                        {CHANNELS.map(c => <option key={c} value={c}>{CHAN_EMOJI[c]} {c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Categoría</label>
                      <select value={newTpl.category} onChange={e => setNewTpl(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{CAT_EMOJI[c]} {c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Mensaje (usá {'{{variable}}'})</label>
                    <textarea
                      value={newTpl.message_template}
                      onChange={e => setNewTpl(p => ({ ...p, message_template: e.target.value }))}
                      placeholder={'🏆 {{nombre_torneo}}\n📅 Fecha: {{fecha}}\n🎮 {{plataforma}} · {{cupos}} cupos\n🏅 Premio: {{premio}}\n🔗 {{link}}'}
                      rows={5}
                      style={{ ...inputStyle, resize: 'none', fontFamily: 'monospace', lineHeight: 1.6, fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>⚡ Alertas de cupos (opcional)</label>
                    <input
                      value={newTpl.alert_thresholds}
                      onChange={e => setNewTpl(p => ({ ...p, alert_thresholds: e.target.value }))}
                      placeholder="ej: 4, 2, 1  (avisar cuando falten esos cupos)"
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textDim, cursor: 'pointer' }}>
                      <input type="checkbox" checked={newTpl.include_link} onChange={e => setNewTpl(p => ({ ...p, include_link: e.target.checked }))} />
                      🔗 Incluye link
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textDim, cursor: 'pointer' }}>
                      <input type="checkbox" checked={newTpl.include_prizes} onChange={e => setNewTpl(p => ({ ...p, include_prizes: e.target.checked }))} />
                      🏅 Incluye premios
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {editingTpl && (
                      <button onClick={() => { setEditingTpl(null); setNewTpl({ channel: 'general', category: 'torneos', message_template: '', name: '', include_link: false, include_prizes: false, alert_thresholds: '' }) }}
                        style={{ flex: 1, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px', color: C.textDim, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    )}
                    <button
                      onClick={saveTemplate}
                      disabled={saving || !newTpl.name.trim() || !newTpl.message_template.trim()}
                      style={{ flex: 1, background: C.green, border: 'none', borderRadius: 9, padding: '10px', color: C.bg, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!newTpl.name.trim() || !newTpl.message_template.trim()) ? 0.4 : 1 }}
                    >{saving ? 'Guardando...' : editingTpl ? 'Guardar cambios' : 'Crear plantilla'}</button>
                  </div>
                </div>
              </div>
            </Section>

            {/* Variables reference */}
            <Section title="📖 Variables disponibles">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  ['{{nombre_torneo}}', 'Nombre del torneo'],
                  ['{{fecha}}', 'Fecha y hora'],
                  ['{{plataforma}}', 'PS5, PC, cross...'],
                  ['{{cupos}}', 'Cupos disponibles'],
                  ['{{premio}}', 'Premio o recompensa'],
                  ['{{link}}', 'URL de registro'],
                  ['{{organizador}}', 'Nombre del org.'],
                  ['{{descripcion}}', 'Texto libre'],
                ].map(([v, desc]) => (
                  <div key={v} style={{ background: C.panel2, borderRadius: 8, padding: '7px 10px' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.green, fontWeight: 700 }}>{v}</div>
                    <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
