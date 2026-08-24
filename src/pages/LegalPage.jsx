import { useState } from 'react'
import { C } from '../theme'

const LAST_UPDATE = '18 de agosto de 2026'
const CONTACT_EMAIL = 'legal@mimensajero.app'
const APP_NAME = 'NexoTribu'

const SECTIONS = [
  {
    id: 'terminos',
    emoji: '📜',
    title: 'Términos de Uso',
    color: '#3b82f6',
    content: [
      {
        subtitle: '1. Aceptación',
        text: `Al acceder o usar ${APP_NAME} aceptás íntegramente estos Términos de Uso. Si no estás de acuerdo con alguna cláusula, debés dejar de utilizar el servicio de inmediato. El uso continuado de la plataforma implica aceptación de las versiones vigentes y sus actualizaciones.`,
      },
      {
        subtitle: '2. Quiénes pueden usar el servicio',
        text: `Podés usar ${APP_NAME} si tenés al menos 13 años. Los menores de 18 años requieren autorización de un tutor legal. Al registrarte declarás que la información que brindás es veraz, completa y actualizada. Cada persona puede tener una sola cuenta; las cuentas duplicadas o falsas pueden ser eliminadas.`,
      },
      {
        subtitle: '3. Conducta del usuario',
        text: `Está estrictamente prohibido: publicar contenido ilegal, violento, discriminatorio, pornográfico o que incite al odio; suplantar la identidad de otras personas o entidades; realizar spam, phishing o distribución de malware; interferir con la infraestructura técnica de la plataforma; usar bots automatizados sin autorización expresa; recolectar datos de otros usuarios sin consentimiento; promover actividades ilegales o fraudulentas.`,
      },
      {
        subtitle: '4. Membresías y pagos',
        text: `${APP_NAME} ofrece planes de pago opcionales: Plan VIP y Plan Comunidad. Los pagos son procesados manualmente previa verificación de comprobante por el equipo de ${APP_NAME}. Las membresías son por periodo (mensual o anual según se indique) y no se renuevan automáticamente. No se realizan reembolsos una vez activado el plan, salvo en casos de error comprobable de nuestra parte. Los precios pueden cambiar con 15 días de aviso previo. El incumplimiento de estos términos puede resultar en cancelación de la membresía sin reembolso.`,
      },
      {
        subtitle: '5. Torneos, ligas y competencias',
        text: `${APP_NAME} es una plataforma de mensajería y comunidades que incluye herramientas para organizar torneos de videojuegos. Las competencias organizadas en la plataforma son de habilidad (videojuegos competitivos), no de azar. Los organizadores son responsables exclusivos del correcto desarrollo de cada competencia, incluyendo premios, reglas y resolución de disputas. ${APP_NAME} provee la infraestructura tecnológica pero no interviene en conflictos entre participantes ni garantiza premios ofrecidos por terceros. Cualquier premio ofrecido es responsabilidad exclusiva del organizador del evento. La plataforma no recibe ni intermedia dinero entre participantes.`,
      },
      {
        subtitle: '6. Propiedad intelectual',
        text: `El contenido que publicás en ${APP_NAME} (mensajes, imágenes, textos) es tuyo. Al publicarlo nos otorgás una licencia limitada, no exclusiva y revocable para almacenarlo y mostrarlo dentro de la plataforma con el único fin de proveer el servicio. No reclamamos propiedad sobre tu contenido. La marca, logo, diseño e infraestructura de ${APP_NAME} son propiedad de sus creadores y no pueden reproducirse sin autorización.`,
      },
      {
        subtitle: '7. Disponibilidad del servicio',
        text: `El servicio se ofrece "tal cual" (as-is). No garantizamos disponibilidad ininterrumpida. Podemos realizar mantenimientos programados con aviso previo y no programados en casos de urgencia técnica. No somos responsables por pérdidas derivadas de interrupciones del servicio.`,
      },
      {
        subtitle: '8. Modificaciones y terminación',
        text: `Nos reservamos el derecho de modificar, suspender o discontinuar el servicio con aviso razonable. Podemos suspender o eliminar cuentas que violen estos términos sin previo aviso en casos graves. Ante modificaciones sustanciales de los términos, notificaremos dentro de la app con al menos 15 días de anticipación.`,
      },
      {
        subtitle: '9. Ley aplicable',
        text: `Estos términos se rigen por las leyes de la República Argentina. Cualquier disputa se someterá a los tribunales competentes de la Ciudad Autónoma de Buenos Aires, Argentina, salvo que la ley aplicable exija otro fuero.`,
      },
    ],
  },
  {
    id: 'privacidad',
    emoji: '🔒',
    title: 'Política de Privacidad',
    color: '#10b981',
    content: [
      {
        subtitle: '1. Datos que recopilamos',
        text: `Recopilamos: dirección de correo electrónico (requerida para registro); nombre de usuario y nombre para mostrar; foto de perfil (opcional, cargada por vos); mensajes enviados y recibidos; metadatos de uso (fecha/hora de conexión, tipo de dispositivo); comprobantes de pago enviados para verificar membresías (imágenes guardadas en servidores seguros).`,
      },
      {
        subtitle: '2. Cómo usamos tus datos',
        text: `Usamos tus datos para: proveer y mejorar el servicio de mensajería; verificar tu identidad y gestionar tu cuenta; procesar y confirmar pagos de membresías; enviarte notificaciones del servicio (nuevos mensajes, llamadas, alertas del sistema); detectar y prevenir usos fraudulentos o abusivos; cumplir obligaciones legales cuando sea requerido por autoridad competente.`,
      },
      {
        subtitle: '3. Almacenamiento y seguridad',
        text: `Tus datos se almacenan en servidores de Supabase (infraestructura PostgreSQL en la nube). Los mensajes se almacenan cifrados. Las llamadas de voz y video se realizan mediante WebRTC peer-to-peer cuando es posible — no grabamos ni almacenamos el audio ni video de las llamadas. Las imágenes y archivos enviados en chats se guardan en servidores seguros con control de acceso por usuario.`,
      },
      {
        subtitle: '4. Compartir datos con terceros',
        text: `No vendemos, alquilamos ni compartimos tus datos personales con terceros con fines comerciales. Podemos compartir información con: proveedores de infraestructura técnica necesarios para el funcionamiento del servicio (Supabase, Vercel); autoridades legales cuando sea obligatorio por ley o resolución judicial. Nunca usamos tus datos para publicidad de terceros.`,
      },
      {
        subtitle: '5. Retención y eliminación de datos',
        text: `Los mensajes se conservan mientras tu cuenta esté activa. Las historias/estados expiran automáticamente a las 24 horas. Los mensajes de "única vez" son marcados como vistos y su contenido no puede recuperarse. Podés eliminar tu cuenta en cualquier momento desde Ajustes → Cuenta → Eliminar mi cuenta. La eliminación es inmediata e irreversible: se borran tu perfil, mensajes, historial, torneos creados y todos los datos asociados. Esto cumple con lo establecido por la Ley 25.326 (Argentina) y el RGPD (Europa).`,
      },
      {
        subtitle: '6. Tus derechos',
        text: `Tenés derecho a: acceder a tus datos personales; solicitar corrección de datos inexactos; solicitar la eliminación de tu cuenta y datos; oponerte al procesamiento de tus datos; portar tus datos (solicitar una exportación). Para ejercer estos derechos contactanos en ${CONTACT_EMAIL}.`,
      },
      {
        subtitle: '7. Cookies y almacenamiento local',
        text: `${APP_NAME} es una Progressive Web App (PWA). Usamos almacenamiento local del navegador (localStorage) para mantener tu sesión activa y guardar preferencias de la app. No usamos cookies de rastreo ni publicidad.`,
      },
      {
        subtitle: '8. Menores de edad',
        text: `No recopilamos intencionalmente datos de menores de 13 años. Si descubrimos que un menor de 13 años se registró, eliminaremos la cuenta de inmediato. Los padres o tutores que crean que un menor usó el servicio sin autorización pueden contactarnos para gestionar la eliminación de la cuenta.`,
      },
    ],
  },
  {
    id: 'membresias',
    emoji: '⭐',
    title: 'Planes y Membresías',
    color: '#f59e0b',
    content: [
      {
        subtitle: 'Plan Gratuito (Miembro)',
        text: `Todo usuario registrado accede de forma gratuita a: mensajes 1 a 1 ilimitados; llamadas de voz y video; grupos de hasta 50 miembros; Bot API (1 bot); creación de torneos de hasta 16 participantes; historias (1 activa por vez); archivos hasta 10 MB.`,
      },
      {
        subtitle: 'Plan VIP ⭐',
        text: `El Plan VIP es una membresía de pago que desbloquea: grupos de hasta 256 miembros; hasta 5 bots activos simultáneos; torneos de hasta 128 participantes; historial de mensajes extendido; archivos hasta 100 MB; acceso prioritario a nuevas funciones; badge VIP visible en tu perfil; anuncios en comunidades.`,
      },
      {
        subtitle: 'Plan Comunidad 🌐',
        text: `El Plan Comunidad es la membresía premium máxima e incluye todo lo de VIP más: creación y administración de comunidades completas; grupos de hasta 1024 miembros; bots ilimitados; torneos de hasta 512 participantes; archivos hasta 500 MB; herramientas de organización avanzadas (ligas, brackets, rankings); historial ilimitado; soporte prioritario; badge Comunidad en perfil.`,
      },
      {
        subtitle: 'Proceso de pago',
        text: `Los pagos se realizan mediante transferencia bancaria, billeteras digitales o criptomonedas a través de los métodos publicados en la sección VIP de la app. Tras realizar el pago, debés subir el comprobante desde la app. El equipo de ${APP_NAME} verificará manualmente y activará tu plan dentro de las 24 horas hábiles. Ante dudas sobre tu pago contactanos desde la app.`,
      },
      {
        subtitle: 'Política de reembolsos',
        text: `Dada la naturaleza digital e inmediata del servicio, no se realizan reembolsos una vez activado el plan, excepto en los siguientes casos: error comprobable en el cobro (monto incorrecto); falta de activación del plan por error nuestro dentro de las 48 horas de verificación del comprobante. Para solicitar un reembolso en estos casos, contactanos en ${CONTACT_EMAIL} dentro de los 7 días del pago.`,
      },
    ],
  },
  {
    id: 'comunidades',
    emoji: '🌐',
    title: 'Comunidades, Grupos y Torneos',
    color: '#8b5cf6',
    content: [
      {
        subtitle: 'Responsabilidad de administradores',
        text: `Los administradores y organizadores de comunidades, grupos y torneos son responsables del contenido publicado en sus espacios. Deben hacer cumplir las normas de conducta de ${APP_NAME} y pueden ser sancionados si su comunidad reiteradamente viola los términos.`,
      },
      {
        subtitle: 'Organización de torneos y ligas',
        text: `Cualquier usuario puede crear torneos dentro de los límites de su plan. El organizador es responsable exclusivo de: definir y comunicar claramente las reglas; gestionar las inscripciones y disputas entre participantes; cumplir con cualquier premio prometido a los participantes. ${APP_NAME} no participa ni se responsabiliza de las competencias organizadas por usuarios.`,
      },
      {
        subtitle: 'Premios y dinero en competencias',
        text: `${APP_NAME} no intermedia ni garantiza premios económicos en torneos, de la misma forma en que WhatsApp o Telegram no son responsables de acuerdos entre sus usuarios. Si un organizador ofrece premios monetarios, esto es un acuerdo exclusivamente entre el organizador y los participantes. Los torneos en la plataforma son de habilidad en videojuegos, no juegos de azar. Recomendamos a los participantes verificar la seriedad del organizador antes de inscribirse en competencias con premios. ${APP_NAME} no garantiza, avala ni recibe porcentaje de ningún premio organizado por terceros.`,
      },
      {
        subtitle: 'Moderación de contenido',
        text: `Nos reservamos el derecho de eliminar comunidades, grupos o torneos que violen estos términos, inciten al odio, promuevan actividades ilegales o sean usados para spam o fraude, sin previo aviso y sin derecho a reembolso de membresías en caso de violación grave.`,
      },
    ],
  },
  {
    id: 'bots',
    emoji: '🤖',
    title: 'Bot API y Desarrolladores',
    color: '#06b6d4',
    content: [
      {
        subtitle: 'Uso permitido de la Bot API',
        text: `La Bot API de ${APP_NAME} puede usarse para: publicar información automática en grupos o comunidades; moderar contenido; notificaciones de torneos y resultados; integraciones con servicios externos (scores, estadísticas, etc.). Los bots deben identificarse claramente como bots y no suplantar usuarios humanos.`,
      },
      {
        subtitle: 'Uso prohibido de la Bot API',
        text: `Está prohibido usar la Bot API para: spam masivo; recolección de datos de usuarios sin consentimiento; acciones automatizadas que sobrecargen la infraestructura; publicidad no autorizada; cualquier actividad que viole estos términos. Los tokens de acceso son personales e intransferibles. El abuso de la API puede resultar en revocación del acceso.`,
      },
      {
        subtitle: 'Límites por plan',
        text: `Plan Miembro (gratuito): 1 bot activo. Plan VIP: hasta 5 bots activos. Plan Comunidad: bots ilimitados. Cada bot tiene límites de rate-limit para proteger la estabilidad del servicio.`,
      },
    ],
  },
  {
    id: 'playstore',
    emoji: '📱',
    title: 'Aplicación Móvil y Play Store',
    color: '#ef4444',
    content: [
      {
        subtitle: 'Distribución en Google Play Store',
        text: `La aplicación de ${APP_NAME} disponible en Google Play Store cumple con las Políticas del Programa para Desarrolladores de Google Play. La app no contiene: contenido para adultos no declarado; malware o código malicioso; funciones ocultas no descritas en la ficha de Play Store; recolección de datos no declarada en esta política de privacidad.`,
      },
      {
        subtitle: 'Permisos de la aplicación',
        text: `La app solicita los siguientes permisos: Micrófono (para llamadas de voz); Cámara (para videollamadas y envío de fotos); Almacenamiento (para compartir archivos e imágenes); Notificaciones (para avisos de mensajes y llamadas); Internet (necesario para el funcionamiento). Ningún permiso se usa con fines ajenos a las funcionalidades descritas.`,
      },
      {
        subtitle: 'Compras dentro de la app',
        text: `Los planes de pago (VIP y Comunidad) actualmente se contratan fuera del sistema de facturación de Google Play, mediante transferencias directas verificadas manualmente. En el futuro pueden habilitarse compras in-app a través de Google Play Billing, en cuyo caso se notificará a los usuarios con anticipación y aplicarán las políticas de reembolso de Google.`,
      },
      {
        subtitle: 'Actualizaciones de la app',
        text: `Las actualizaciones de la app se distribuyen a través de Google Play Store y/o como APK directo para usuarios que lo prefieran. Recomendamos mantener la app actualizada para recibir correcciones de seguridad y nuevas funcionalidades.`,
      },
    ],
  },
  {
    id: 'responsabilidad',
    emoji: '⚖️',
    title: 'Limitación de Responsabilidad',
    color: '#6b7280',
    content: [
      {
        subtitle: 'Alcance de la responsabilidad',
        text: `${APP_NAME} no se responsabiliza por: pérdida de datos causada por fallas técnicas fuera de nuestro control; daños indirectos, lucro cesante o daño moral derivados del uso o imposibilidad de uso del servicio; contenido publicado por usuarios terceros; disputas entre usuarios, participantes de torneos u organizadores; premios, acuerdos o contratos entre usuarios de la plataforma.`,
      },
      {
        subtitle: 'Fuerza mayor',
        text: `No seremos responsables por interrupciones causadas por: fallos de proveedores de infraestructura (Supabase, Vercel, servicios de red); desastres naturales, conflictos, pandemias u otras causas de fuerza mayor; ataques cibernéticos fuera de nuestro control razonable.`,
      },
      {
        subtitle: 'Indemnización',
        text: `Aceptás indemnizar y mantener indemne a ${APP_NAME} y su equipo frente a cualquier reclamo, daño, costo o gasto (incluyendo honorarios legales razonables) que surja de: tu uso del servicio en violación de estos términos; contenido que publiques en la plataforma; tus interacciones con otros usuarios.`,
      },
    ],
  },
  {
    id: 'contacto',
    emoji: '📬',
    title: 'Contacto y Reportes',
    color: '#22c55e',
    content: [
      {
        subtitle: 'Contacto legal',
        text: `Para consultas sobre estos términos, política de privacidad, solicitudes de eliminación de datos, reclamos de derechos de autor o reportes de abuso podés escribirnos a: ${CONTACT_EMAIL}`,
      },
      {
        subtitle: 'Reportar contenido inapropiado',
        text: `Para reportar contenido inapropiado, cuentas falsas o abuso dentro de la plataforma usá la función "Reportar usuario" disponible en el perfil de cada usuario, o escribinos directamente a ${CONTACT_EMAIL} con el detalle del reporte.`,
      },
      {
        subtitle: 'Tiempo de respuesta',
        text: `Intentamos responder consultas legales y reportes dentro de los 5 días hábiles. Para casos urgentes de seguridad o abuso grave respondemos en 24 horas hábiles.`,
      },
      {
        subtitle: 'Última actualización',
        text: `Estos términos y políticas fueron actualizados el ${LAST_UPDATE}. Podemos actualizarlos periódicamente. Los cambios sustanciales serán notificados dentro de la app con al menos 15 días de anticipación.`,
      },
    ],
  },
]

function Section({ sec, isOpen, onToggle }) {
  return (
    <div style={{
      background: C.panel, borderRadius: 16,
      border: `1px solid ${isOpen ? sec.color + '55' : C.border}`,
      overflow: 'hidden', transition: 'border-color .2s',
    }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: sec.color + '18', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 18,
        }}>{sec.emoji}</div>
        <span style={{ flex: 1, color: C.text, fontWeight: 700, fontSize: 15 }}>{sec.title}</span>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke={C.text2} strokeWidth="2.2" strokeLinecap="round"
          style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {/* Body */}
      {isOpen && (
        <div style={{ borderTop: `1px solid ${C.border}22`, padding: '4px 0 8px' }}>
          {sec.content.map((item, j) => (
            <div key={j} style={{ padding: '14px 20px', borderBottom: j < sec.content.length - 1 ? `1px solid ${C.border}15` : 'none' }}>
              <div style={{ color: sec.color, fontWeight: 700, fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {item.subtitle}
              </div>
              <p style={{ margin: 0, color: C.textDim, fontSize: 13, lineHeight: 1.7 }}>
                {item.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LegalPage({ onBack }) {
  const [openSection, setOpenSection] = useState('terminos')

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        background: C.panel, borderBottom: `1px solid ${C.border}`,
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.text2} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <span style={{ color: C.text, fontWeight: 700, fontSize: 17 }}>Legal y Privacidad</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 40px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Hero */}
          <div style={{
            background: 'linear-gradient(135deg, #0B7A2A18, #065f2118)',
            border: `1px solid #22c55e30`, borderRadius: 18, padding: '20px 22px', marginBottom: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 28 }}>⚡</div>
              <div>
                <div style={{ color: C.text, fontWeight: 800, fontSize: 17 }}>NexoTribu</div>
                <div style={{ color: C.green, fontSize: 12, fontWeight: 600 }}>Plataforma de mensajería y comunidades</div>
              </div>
            </div>
            <p style={{ margin: 0, color: C.textDim, fontSize: 13, lineHeight: 1.7 }}>
              Estos documentos regulan el uso de la plataforma, la protección de tus datos, las membresías y
              las competencias organizadas. Leelos con atención antes de usar el servicio.
              Última actualización: <strong style={{ color: C.text }}>{LAST_UPDATE}</strong>
            </p>
          </div>

          {/* Quick index */}
          <div style={{
            background: C.panel, borderRadius: 14, border: `1px solid ${C.border}`,
            padding: '14px 18px', marginBottom: 4,
          }}>
            <div style={{ color: C.text2, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Índice rápido
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SECTIONS.map(s => (
                <button key={s.id} onClick={() => setOpenSection(openSection === s.id ? null : s.id)} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${openSection === s.id ? s.color : C.border}`,
                  background: openSection === s.id ? s.color + '18' : 'transparent',
                  color: openSection === s.id ? s.color : C.text2,
                  cursor: 'pointer', transition: 'all .15s',
                }}>
                  {s.emoji} {s.title}
                </button>
              ))}
            </div>
          </div>

          {/* Sections */}
          {SECTIONS.map(sec => (
            <Section
              key={sec.id}
              sec={sec}
              isOpen={openSection === sec.id}
              onToggle={() => setOpenSection(openSection === sec.id ? null : sec.id)}
            />
          ))}

          {/* Footer */}
          <div style={{
            textAlign: 'center', paddingTop: 12, color: C.textDim, fontSize: 12, lineHeight: 1.8,
          }}>
            <div>© 2026 NexoTribu · Todos los derechos reservados</div>
            <div>{CONTACT_EMAIL}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
