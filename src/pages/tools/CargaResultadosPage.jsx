import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { C } from '../../theme'

export default function CargaResultadosPage({ onBack }) {
  const { profile } = useAuthStore()
  const fileRef = useRef(null)
  const [tab, setTab] = useState('cargar')
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ local: '', visitante: '', golesL: '', golesV: '', nota: '' })
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploaded, setUploaded] = useState(false)

  async function loadResults() {
    setLoading(true)
    const { data } = await supabase
      .from('match_results')
      .select('*, users!match_results_submitted_by_fkey(display_name, username, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(30)
    setResults(data || [])
    setLoading(false)
  }

  function pickFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setUploaded(false)
  }

  async function submit() {
    if (!form.local.trim() || !form.visitante.trim()) return
    setUploading(true)
    let photoUrl = null

    if (file) {
      const ext = file.name.split('.').pop()
      const path = `results/${profile.id}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('result-photos').upload(path, file, { upsert: true })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('result-photos').getPublicUrl(path)
        photoUrl = urlData.publicUrl
      }
    }

    const { error } = await supabase.from('match_results').insert({
      local: form.local.trim(),
      visitante: form.visitante.trim(),
      goles_local: parseInt(form.golesL) || 0,
      goles_visitante: parseInt(form.golesV) || 0,
      nota: form.nota.trim() || null,
      photo_url: photoUrl,
      submitted_by: profile.id,
      status: 'pendiente',
    })

    setUploading(false)
    if (error) { alert(error.message); return }
    setForm({ local: '', visitante: '', golesL: '', golesV: '', nota: '' })
    setFile(null); setPreview(null); setUploaded(true)
    setTimeout(() => setUploaded(false), 3000)
  }

  const inp = {
    background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10,
    color: C.text, fontSize: 14, padding: '10px 12px', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  }

  const STATUS = {
    pendiente: { label: 'Pendiente', color: '#f59e0b', bg: '#f59e0b18' },
    aprobado:  { label: 'Aprobado',  color: '#22c55e', bg: '#22c55e18' },
    rechazado: { label: 'Rechazado', color: '#ef4444', bg: '#ef444418' },
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>📸 Carga de Resultados</h2>
          <p style={{ margin: 0, color: C.textDim, fontSize: 12 }}>Subí la foto del resultado para validación</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {[['cargar','📸 Cargar'],['historial','📋 Historial']].map(([id, lbl]) => (
          <button key={id} onClick={() => { setTab(id); if (id === 'historial') loadResults() }} style={{
            flex: 1, padding: '10px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            color: tab === id ? C.green : C.textDim,
            borderBottom: `2px solid ${tab === id ? C.green : 'transparent'}`,
          }}>{lbl}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {tab === 'cargar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {uploaded && (
              <div style={{ background: '#22c55e18', border: '1px solid #22c55e44', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>✅</span>
                <p style={{ margin: 0, color: '#22c55e', fontWeight: 700, fontSize: 14 }}>Resultado enviado para validación</p>
              </div>
            )}

            {/* Foto comprobante */}
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Foto del resultado (opcional)</p>
              <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} style={{ display: 'none' }} />
              {preview ? (
                <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
                  <img src={preview} alt="preview" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
                  <button onClick={() => { setFile(null); setPreview(null) }} style={{
                    position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none',
                    borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>×</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} style={{
                  width: '100%', height: 120, background: C.panel, border: `2px dashed ${C.border}`, borderRadius: 14,
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 28 }}>📷</span>
                  <span style={{ color: C.textDim, fontSize: 13 }}>Tocá para subir captura de pantalla</span>
                </button>
              )}
            </div>

            {/* Marcador */}
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Marcador</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input value={form.local} onChange={e => setForm(p => ({ ...p, local: e.target.value }))} placeholder="Equipo local / tú" style={inp} />
                  <input type="number" min="0" value={form.golesL} onChange={e => setForm(p => ({ ...p, golesL: e.target.value }))}
                    placeholder="0" style={{ ...inp, textAlign: 'center', fontSize: 28, fontWeight: 800, padding: '10px 0' }} />
                </div>
                <span style={{ fontSize: 22, color: C.textDim, fontWeight: 700, flexShrink: 0 }}>VS</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input value={form.visitante} onChange={e => setForm(p => ({ ...p, visitante: e.target.value }))} placeholder="Equipo visitante / rival" style={inp} />
                  <input type="number" min="0" value={form.golesV} onChange={e => setForm(p => ({ ...p, golesV: e.target.value }))}
                    placeholder="0" style={{ ...inp, textAlign: 'center', fontSize: 28, fontWeight: 800, padding: '10px 0' }} />
                </div>
              </div>
            </div>

            {/* Nota */}
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Nota adicional (opcional)</p>
              <textarea value={form.nota} onChange={e => setForm(p => ({ ...p, nota: e.target.value }))}
                placeholder="Ej: Torneo de verano, fase de grupos..." rows={2}
                style={{ ...inp, resize: 'none', fontFamily: 'inherit' }} />
            </div>

            <button onClick={submit} disabled={uploading || !form.local.trim() || !form.visitante.trim()} style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none',
              background: !form.local.trim() || !form.visitante.trim() ? C.panel2 : C.green,
              color: !form.local.trim() || !form.visitante.trim() ? C.textDim : C.bg,
              fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}>{uploading ? 'Enviando...' : '📸 Enviar resultado'}</button>

            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ margin: 0, fontSize: 12, color: C.textDim }}>
                📋 Los resultados enviados quedan pendientes de validación por un admin o el organizador del torneo.
              </p>
            </div>
          </div>
        )}

        {tab === 'historial' && (
          loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 24, height: 24, border: `2px solid ${C.border}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: C.textDim }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
              <p style={{ margin: 0, fontSize: 14 }}>No hay resultados cargados aún</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {results.map(r => {
                const st = STATUS[r.status] || STATUS.pendiente
                return (
                  <div key={r.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
                    {r.photo_url && <img src={r.photo_url} alt="resultado" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />}
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color: C.text }}>{r.goles_local}</span>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: 11, color: C.text, fontWeight: 600 }}>{r.local}</p>
                            <p style={{ margin: 0, fontSize: 9, color: C.textDim }}>vs</p>
                            <p style={{ margin: 0, fontSize: 11, color: C.text, fontWeight: 600 }}>{r.visitante}</p>
                          </div>
                          <span style={{ fontSize: 20, fontWeight: 900, color: C.text }}>{r.goles_visitante}</span>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: st.bg, color: st.color, border: `1px solid ${st.color}44` }}>{st.label}</span>
                      </div>
                      {r.nota && <p style={{ margin: '0 0 6px', fontSize: 12, color: C.textDim }}>{r.nota}</p>}
                      <p style={{ margin: 0, fontSize: 10, color: C.textDim }}>
                        Por {r.users?.display_name || r.users?.username || 'desconocido'} · {new Date(r.created_at).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
