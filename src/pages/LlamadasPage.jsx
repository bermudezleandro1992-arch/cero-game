import { C } from '../theme'

function ActionBtn({ icon, label, comingSoon }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: comingSoon ? 0.5 : 1 }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: C.panel, border: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
        cursor: comingSoon ? 'default' : 'pointer',
      }}>
        {icon}
      </div>
      <div style={{ color: C.textDim, fontSize: 11, textAlign: 'center', lineHeight: 1.3 }}>
        {label}
        {comingSoon && <div style={{ color: C.textDim, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, opacity: 0.6 }}>PRÓXIMAMENTE</div>}
      </div>
    </div>
  )
}

const RECENT_PLACEHOLDER = [
  { name: 'Contacto 1', type: 'Saliente', time: 'Próximamente', avatar: '👤' },
  { name: 'Contacto 2', type: 'Entrante', time: 'Próximamente', avatar: '👤' },
  { name: 'Contacto 3', type: 'Saliente (2)', time: 'Próximamente', avatar: '👤' },
]

export default function LlamadasPage() {
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
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: C.textDim, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 8px', alignSelf: 'center' }}>PRÓXIMAMENTE</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 32 }}>

        {/* Action buttons row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '20px 20px 8px' }}>
          <ActionBtn icon="📞" label="Iniciar llamada" comingSoon />
          <ActionBtn icon="🔗" label="Nuevo enlace de llamada" comingSoon />
          <ActionBtn icon="🔢" label="Llamar a un número" comingSoon />
          <ActionBtn icon="📅" label="Programar llamada" comingSoon />
        </div>

        <div style={{ padding: '6px 20px 12px', color: C.textDim, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🔒</span> Tus llamadas personales están cifradas de extremo a extremo
        </div>

        {/* Favoritos */}
        <div style={{ padding: '8px 20px 4px', color: C.textDim, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
          Favoritos
        </div>
        <div style={{ background: C.panel, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', cursor: 'default', opacity: 0.5 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${C.green}18`, border: `1.5px dashed ${C.green}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              ➕
            </div>
            <div>
              <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>Añadir favorito</div>
              <div style={{ color: C.textDim, fontSize: 11, marginTop: 1 }}>Próximamente</div>
            </div>
          </div>
        </div>

        {/* Recientes */}
        <div style={{ padding: '16px 20px 4px', color: C.textDim, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
          Recientes
        </div>
        <div style={{ background: C.panel, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
          {RECENT_PLACEHOLDER.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
              borderBottom: i < RECENT_PLACEHOLDER.length - 1 ? `1px solid ${C.border}22` : 'none',
              opacity: 0.4, cursor: 'default',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {item.avatar}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{item.name}</div>
                <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>📞 {item.type}</div>
              </div>
              <div style={{ color: C.textDim, fontSize: 11 }}>{item.time}</div>
            </div>
          ))}
        </div>

        {/* Empty state hint */}
        <div style={{ padding: '32px 40px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.4 }}>📞</div>
          <div style={{ color: C.textDim, fontSize: 13, lineHeight: 1.6 }}>
            Las llamadas de audio y video HD<br />estarán disponibles muy pronto.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['📞 Audio HD', '📹 Video', '🔒 Cifrado E2E'].map(f => (
              <span key={f} style={{
                fontSize: 11, color: C.textDim, background: C.panel,
                padding: '5px 12px', borderRadius: 20, border: `1px solid ${C.border}`,
              }}>{f}</span>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
