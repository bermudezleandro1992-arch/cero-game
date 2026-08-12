import { C } from '../App'

const SECTIONS = [
  {
    title: '📜 Términos de Uso',
    content: [
      'Al usar Mi Mensajero aceptás estos términos. Si no estás de acuerdo, no uses el servicio.',
      'Mi Mensajero es una plataforma de mensajería pensada para comunidades de gaming y esports.',
      'Debés tener al menos 13 años para usar este servicio.',
      'Sos responsable de todo el contenido que publiques. Queda prohibido publicar contenido ilegal, violento, discriminatorio o que viole derechos de terceros.',
      'Nos reservamos el derecho de suspender o eliminar cuentas que violen estos términos.',
      'El servicio se ofrece "tal cual" y puede tener interrupciones. No garantizamos disponibilidad continua.',
    ],
  },
  {
    title: '🔒 Política de Privacidad',
    content: [
      'Tu privacidad es importante. Este documento explica qué datos recopilamos y cómo los usamos.',
      'Recopilamos: nombre de usuario, correo electrónico, foto de perfil (opcional) y mensajes enviados.',
      'Tus mensajes se almacenan en servidores seguros de Supabase (PostgreSQL). No los vendemos ni compartimos con terceros.',
      'Los estados/historias expiran automáticamente a las 24 horas y se eliminan del servidor.',
      'Los mensajes de "única vez" se marcan como vistos y su contenido no se puede recuperar.',
      'Podemos usar tu correo para notificaciones del servicio. Nunca para marketing no solicitado.',
      'Podés eliminar tu cuenta en cualquier momento desde el perfil. Tus datos serán borrados en un plazo de 30 días.',
    ],
  },
  {
    title: '🎮 Comunidades y Grupos',
    content: [
      'Las comunidades públicas son visibles para todos los usuarios.',
      'Los administradores de comunidades son responsables del contenido publicado en ellas.',
      'Nos reservamos el derecho de eliminar comunidades que violen nuestros términos.',
      'Los bots de la plataforma deben respetar los mismos límites de contenido que los usuarios.',
    ],
  },
  {
    title: '📞 Llamadas y Medios',
    content: [
      'Las llamadas de voz se realizan mediante conexión WebRTC peer-to-peer cuando es posible.',
      'No grabamos ni almacenamos el audio de las llamadas.',
      'Las imágenes y audios enviados en chats se almacenan en nuestros servidores.',
      'El contenido de "única vez" tiene vistas limitadas pero puede haber capturas de pantalla por terceros.',
    ],
  },
  {
    title: '⚖️ Limitación de Responsabilidad',
    content: [
      'Mi Mensajero no se responsabiliza por pérdida de datos, interrupciones del servicio ni daños indirectos.',
      'El servicio puede cambiar, pausarse o discontinuarse con aviso previo razonable.',
      'Estos términos pueden actualizarse. Los cambios significativos se notificarán dentro de la app.',
    ],
  },
  {
    title: '📬 Contacto',
    content: [
      'Para consultas legales, privacidad o reportes de abuso, contactanos a través del perfil de la app.',
      'Fecha de última actualización: Agosto 2025.',
    ],
  },
]

export default function LegalPage({ onBack }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        background: C.panel, borderBottom: `1px solid ${C.border}`,
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.text2} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <span style={{ color: C.text, fontWeight: 700, fontSize: 17 }}>Legal y Privacidad</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Intro card */}
        <div style={{
          background: `${C.green}12`, border: `1px solid ${C.green}30`,
          borderRadius: 16, padding: '16px 18px',
        }}>
          <div style={{ color: C.green, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Mi Mensajero</div>
          <div style={{ color: C.textDim, fontSize: 13, lineHeight: 1.6 }}>
            Plataforma de mensajería para comunidades de gaming y esports.
            Construida con privacidad y seguridad como prioridades.
          </div>
        </div>

        {SECTIONS.map((sec, i) => (
          <div key={i} style={{
            background: C.panel, borderRadius: 16,
            border: `1px solid ${C.border}`, overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
              color: C.text, fontWeight: 700, fontSize: 14,
            }}>
              {sec.title}
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sec.content.map((para, j) => (
                <p key={j} style={{ margin: 0, color: C.textDim, fontSize: 13, lineHeight: 1.65 }}>
                  {para}
                </p>
              ))}
            </div>
          </div>
        ))}

        <div style={{ color: C.textDim, fontSize: 11, textAlign: 'center', paddingBottom: 20 }}>
          © 2025 Mi Mensajero · Todos los derechos reservados
        </div>
      </div>
    </div>
  )
}
