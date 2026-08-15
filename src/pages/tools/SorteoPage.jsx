import { useState, useRef } from 'react'
import { C } from '../../theme'

function confetti(canvas) {
  const ctx = canvas.getContext('2d')
  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight
  const pieces = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    r: Math.random() * 8 + 4,
    color: ['#22c55e','#f59e0b','#3b82f6','#a855f7','#ef4444','#06b6d4'][Math.floor(Math.random()*6)],
    vx: (Math.random() - 0.5) * 2,
    vy: Math.random() * 4 + 2,
    rot: Math.random() * 360,
    vr: (Math.random() - 0.5) * 6,
  }))
  let frame
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    pieces.forEach(p => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180)
      ctx.fillStyle = p.color; ctx.fillRect(-p.r/2, -p.r/2, p.r, p.r); ctx.restore()
      p.x += p.vx; p.y += p.vy; p.rot += p.vr
      if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width }
    })
    frame = requestAnimationFrame(draw)
  }
  draw()
  setTimeout(() => { cancelAnimationFrame(frame); ctx.clearRect(0, 0, canvas.width, canvas.height) }, 3500)
}

export default function SorteoPage({ onBack }) {
  const [input, setInput]       = useState('')
  const [items, setItems]       = useState([])
  const [winner, setWinner]     = useState(null)
  const [spinning, setSpinning] = useState(false)
  const [history, setHistory]   = useState([])
  const [mode, setMode]         = useState('single') // single | multi
  const [multiCount, setMultiCount] = useState(2)
  const canvasRef = useRef(null)

  function addItem() {
    const trimmed = input.trim()
    if (!trimmed) return
    const newItems = trimmed.split('\n').map(s => s.trim()).filter(Boolean)
    setItems(prev => [...prev, ...newItems])
    setInput('')
  }

  function removeItem(i) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  function reset() {
    setWinner(null)
    setItems([])
    setHistory([])
  }

  async function sortear() {
    if (items.length < 2) return
    setSpinning(true)
    setWinner(null)

    // Animación de suspense
    const duration = 2200
    const start = Date.now()
    await new Promise(resolve => {
      const tick = () => {
        const elapsed = Date.now() - start
        if (elapsed < duration) {
          requestAnimationFrame(tick)
        } else {
          resolve()
        }
      }
      tick()
    })

    if (mode === 'single') {
      const idx = Math.floor(Math.random() * items.length)
      const picked = items[idx]
      setWinner(picked)
      setHistory(prev => [{ type: 'single', result: picked, pool: [...items], date: new Date() }, ...prev.slice(0, 9)])
    } else {
      const shuffled = [...items].sort(() => Math.random() - 0.5)
      const picked = shuffled.slice(0, Math.min(multiCount, items.length))
      setWinner(picked)
      setHistory(prev => [{ type: 'multi', result: picked, pool: [...items], date: new Date() }, ...prev.slice(0, 9)])
    }

    setSpinning(false)
    if (canvasRef.current) confetti(canvasRef.current)
  }

  const winnerStr = Array.isArray(winner) ? winner.join(', ') : winner

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', position: 'relative', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, width: '100%', height: '100%' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 16 }}>🎲 Sorteo en Vivo</h2>
          <p style={{ margin: 0, color: C.textDim, fontSize: 12 }}>Sorteá participantes o premios en tiempo real</p>
        </div>
        <button onClick={reset} style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: C.textDim, fontSize: 12 }}>
          🔄 Limpiar
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Modo */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[['single','1 ganador'],['multi','Múltiples']].map(([m, lbl]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '9px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
              border: `2px solid ${mode === m ? C.green : C.border}`,
              background: mode === m ? `${C.green}18` : C.panel2,
              color: mode === m ? C.green : C.textDim,
            }}>{lbl}</button>
          ))}
        </div>

        {mode === 'multi' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10 }}>
            <span style={{ fontSize: 13, color: C.text, flex: 1 }}>Cantidad de ganadores</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setMultiCount(n => Math.max(2, n-1))} style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${C.border}`, background: C.panel2, cursor: 'pointer', color: C.text, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.text, minWidth: 24, textAlign: 'center' }}>{multiCount}</span>
              <button onClick={() => setMultiCount(n => Math.min(items.length || 20, n+1))} style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${C.border}`, background: C.panel2, cursor: 'pointer', color: C.text, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
          </div>
        )}

        {/* Agregar participantes */}
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            Participantes ({items.length})
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addItem() } }}
              placeholder="Un nombre por línea, o uno y Enter&#10;Ej: @jugador1&#10;@jugador2&#10;@jugador3"
              rows={3}
              style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={addItem} style={{ background: C.green, border: 'none', borderRadius: 10, padding: '0 16px', cursor: 'pointer', color: C.bg, fontWeight: 700, fontSize: 20, flexShrink: 0 }}>+</button>
          </div>
        </div>

        {/* Lista de participantes */}
        {items.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {items.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '5px 10px 5px 12px',
              }}>
                <span style={{ fontSize: 12, color: C.text }}>{item}</span>
                <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Botón sortear */}
        <button
          onClick={sortear}
          disabled={items.length < 2 || spinning}
          style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 'none',
            background: items.length < 2 ? C.panel2 : `linear-gradient(135deg, #f59e0b, #d97706)`,
            color: items.length < 2 ? C.textDim : '#000',
            fontWeight: 800, fontSize: 18, cursor: items.length < 2 ? 'default' : 'pointer',
            transition: 'all .2s', boxShadow: items.length >= 2 ? '0 4px 20px #f59e0b44' : 'none',
            letterSpacing: '0.5px',
          }}
        >
          {spinning ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <span style={{ fontSize: 24, animation: 'spin .4s linear infinite', display: 'inline-block' }}>🎲</span>
              Sorteando...
            </span>
          ) : '🎲 ¡SORTEAR!'}
        </button>

        {/* Resultado */}
        {winner && !spinning && (
          <div style={{
            background: `linear-gradient(135deg, ${C.green}22, #f59e0b11)`,
            border: `2px solid ${C.green}`,
            borderRadius: 16, padding: '20px 16px', textAlign: 'center',
            animation: 'popIn .4s ease',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '2px', textTransform: 'uppercase' }}>
              {Array.isArray(winner) ? `${winner.length} ganadores` : 'Ganador'}
            </p>
            {Array.isArray(winner) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {winner.map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.panel, borderRadius: 10, padding: '8px 14px' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b', width: 24 }}>#{i+1}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{w}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: C.text }}>{winner}</p>
            )}
          </div>
        )}

        {/* Historial */}
        {history.length > 0 && (
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Historial</p>
            {history.map((h, i) => (
              <div key={i} style={{ padding: '8px 12px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>
                    {Array.isArray(h.result) ? h.result.join(' · ') : h.result}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: C.textDim }}>
                    {h.date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: C.textDim }}>De: {h.pool.join(', ')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes popIn { from { transform: scale(.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  )
}
