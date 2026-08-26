import { C } from '../theme'

export default function EstadosPage() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 18 }}>Estados</div>
        <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>Actualizaciones de tus contactos</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
        <div style={{ fontSize: 56 }}>👁️</div>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>Estados próximamente</div>
        <div style={{ color: C.textDim, fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
          Pronto podrás compartir actualizaciones de estado con tus contactos, que desaparecen en 24 horas.
        </div>
      </div>
    </div>
  )
}
