import { C } from '../theme'

export default function LlamadasPage({ onProfileClick }) {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', background: C.panel,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: '-0.5px' }}>
          Llamadas
        </h1>
      </div>

      {/* Empty state */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 16, padding: '0 40px', textAlign: 'center',
        background: `radial-gradient(ellipse at 50% 60%, ${C.greenDk}14 0%, transparent 65%)`,
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          border: `1.5px solid ${C.green}30`,
          background: `radial-gradient(circle, ${C.green}10 0%, transparent 70%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 34, boxShadow: `0 0 40px ${C.green}18`,
        }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.8a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </div>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: C.text }}>
            Sin llamadas recientes
          </p>
          <p style={{ margin: 0, fontSize: 13, color: C.textDim, lineHeight: 1.6 }}>
            Las llamadas de audio y video{'\n'}aparecerán acá
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
          {['📞 Audio HD', '📹 Video', '🔒 Cifrado'].map(f => (
            <span key={f} style={{
              fontSize: 11, color: C.textDim, background: C.panel,
              padding: '5px 12px', borderRadius: 20, border: `1px solid ${C.border}`,
            }}>{f}</span>
          ))}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: C.textDim }}>
          Iniciá una llamada desde cualquier chat
        </p>
      </div>
    </div>
  )
}
