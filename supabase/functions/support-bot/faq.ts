// FAQ knowledge base — soporte Mi Mensajero
// Cada entrada: { patterns: string[], answer: string, escalate?: boolean }

export const FAQ: Array<{
  patterns: string[]
  answer: string
  escalate?: boolean
}> = [
  // ── Registro / Cuenta ─────────────────────────────────────────────────────
  {
    patterns: ['no puedo entrar', 'no puedo iniciar', 'no me deja entrar', 'contraseña incorrecta', 'olvide contraseña', 'olvidé contraseña', 'recuperar contraseña', 'olvidé mi contraseña'],
    answer: `🔑 *Recuperar contraseña*

1. En la pantalla de login, tocá **"Entrar con link por email"**
2. Ingresá tu email registrado
3. Revisá tu bandeja (y la carpeta Spam)
4. Hacé click en el link para entrar sin contraseña

Si el email no te llega en 5 minutos, escribinos de nuevo y un agente te ayuda. 👇`,
  },
  {
    patterns: ['no recibo email', 'no me llega el correo', 'no llega el email', 'no llega confirmacion', 'no llega confirmación'],
    answer: `📧 *Email no llega*

• Revisá la carpeta **Spam / Correo no deseado**
• Asegurate de haber ingresado el email correcto
• Esperá hasta 5 minutos (a veces hay demora)
• Si usás Outlook/Hotmail, revisá la carpeta **Junk**

¿Seguís sin recibirlo? Un agente te ayuda enseguida. 👇`,
  },
  {
    patterns: ['como registro', 'cómo registro', 'crear cuenta', 'registrarme'],
    answer: `✅ *Crear cuenta*

1. Abrí Mi Mensajero → pantalla de login
2. Tocá **"¿No tenés cuenta? Registrate"**
3. Completá nombre, email y contraseña
4. Aceptá los términos y confirmá tu edad
5. Revisá tu email para confirmar la cuenta

¡Y listo! Después iniciás sesión normalmente. 🎮`,
  },

  // ── Torneos / Ligas ───────────────────────────────────────────────────────
  {
    patterns: ['inscribir torneo', 'inscribirme', 'como me anoto', 'cómo me anoto', 'unirme al torneo', 'quiero participar'],
    answer: `🏆 *Inscribirse a un torneo*

1. Entrá a **Comunidad** → buscá el torneo
2. Tocá la tarjeta del torneo
3. Presioná **"Inscribirme"**
4. El organizador confirma tu lugar

Si el torneo ya está lleno o cerrado, el botón no aparece. Consultá al organizador de tu comunidad.`,
  },
  {
    patterns: ['como crear torneo', 'cómo crear torneo', 'crear liga', 'hacer un torneo', 'armar torneo'],
    answer: `🛠️ *Crear un torneo o liga*

1. Andá a **Comunidad** → tab **Herramientas** → icono +
2. Elegí el tipo: Torneo, Copa o Liga
3. Completá los datos (plataforma, formato, cupos, fechas)
4. Publicá y compartí el link con tus jugadores

Límite: **2 por día** para miembros normales. Roles VIP+ tienen más cupo.`,
  },
  {
    patterns: ['tabla posiciones', 'fixture', 'ver partidos', 'ver fixture', 'resultados liga'],
    answer: `📊 *Ver tabla de posiciones y fixture*

1. Entrá a la **Liga** desde tu comunidad
2. Tab **Posiciones** → tabla completa con puntos, GD, etc.
3. Tab **Fixture** → todos los partidos programados

Si el fixture no aparece, el organizador todavía no lo generó.`,
  },

  // ── Llamadas / Video ──────────────────────────────────────────────────────
  {
    patterns: ['llamada no funciona', 'llamada cortada', 'llamada se corta', 'no puedo llamar', 'no conecta llamada', 'audio no funciona', 'microfono', 'micrófono'],
    answer: `📞 *Problemas con llamadas*

Causas más comunes:

1. **Permisos de micrófono** — el navegador/app debe tener permiso para usar el micro
2. **Conexión a internet** — necesitás buena señal en ambos dispositivos
3. **Firewall corporativo** — en redes de trabajo/escuela puede bloquearse

Probá:
• Refrescar la página y volver a llamar
• Usar Chrome o Firefox (más compatibles)
• En móvil: verificar permisos en Ajustes → App

¿Sigue sin funcionar? Un agente lo revisa contigo. 👇`,
  },

  // ── APK / Instalación ─────────────────────────────────────────────────────
  {
    patterns: ['descargar app', 'bajar app', 'apk', 'instalar en android', 'play store'],
    answer: `📱 *Instalar Mi Mensajero en Android*

Desde el navegador en tu celular:
1. Entrá a **mimensajero.vercel.app**
2. Tocá el banner **"Descargar APK Android"**
3. Instalá el .apk (puede pedirte permitir fuentes desconocidas)

Alternativamente, en Chrome Android: menú ⋮ → **"Añadir a pantalla de inicio"** para instalarlo como PWA.

_(No estamos en Play Store aún — próximamente)_`,
  },

  // ── Comunidades ───────────────────────────────────────────────────────────
  {
    patterns: ['como crear comunidad', 'cómo crear comunidad', 'crear grupo', 'nuevo grupo'],
    answer: `🏘️ *Crear una comunidad*

1. Tocá **Comunidad** en el menú inferior
2. Presioná el botón **+** arriba a la derecha
3. Ponele nombre, descripción e imagen
4. Invitá a tus jugadores con el link

Como creador sos el organizador principal con acceso a todas las herramientas.`,
  },
  {
    patterns: ['como invitar', 'cómo invitar', 'link de invitacion', 'link invitación', 'compartir comunidad'],
    answer: `🔗 *Invitar a tu comunidad*

1. Abrí tu comunidad
2. Tocá el ícono de configuración ⚙️ o el menú ⋮
3. Buscá **"Link de invitación"** o **"Compartir"**
4. Copiá el link y mandáselo a tus jugadores

Al abrir el link, se une directamente.`,
  },

  // ── Pagos / Premios ───────────────────────────────────────────────────────
  {
    patterns: ['pagar', 'mercado pago', 'cobrar premio', 'premio', 'recompensa'],
    answer: `💰 *Pagos y premios*

Los pagos de inscripción y premios son **gestionados por el organizador** de cada comunidad/torneo, no por Mi Mensajero directamente.

Contactá al organizador de tu torneo para coordinar el pago o cobro del premio. Si hay un problema con un organizador, podés reportarlo acá y lo revisamos. 👇`,
  },

  // ── Cuenta / Perfil ───────────────────────────────────────────────────────
  {
    patterns: ['cambiar nombre', 'editar perfil', 'cambiar foto', 'avatar', 'foto de perfil'],
    answer: `👤 *Editar tu perfil*

1. Tocá tu **avatar** arriba a la izquierda (o el ícono de usuario)
2. Entrá a **Ajustes** o **Mi perfil**
3. Editá tu nombre de usuario y foto

Los cambios se reflejan en todos tus chats y torneos.`,
  },

  // ── Reporte / Problema técnico ────────────────────────────────────────────
  {
    patterns: ['bug', 'error', 'falla', 'no carga', 'pantalla blanca', 'se congela', 'reportar problema'],
    answer: `🐛 *Reportar un problema técnico*

Para ayudarte mejor, contanos:
1. ¿Qué estabas haciendo cuando pasó?
2. ¿En qué dispositivo y navegador?
3. ¿Aparece algún mensaje de error?

Un agente de soporte te va a responder en breve. 🔧`,
    escalate: true,
  },
]

// Normaliza texto para matching (minúsculas, sin tildes, sin puntuación extra)
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchFAQ(userMessage: string): { answer: string; escalate: boolean } | null {
  const norm = normalize(userMessage)
  for (const entry of FAQ) {
    for (const pattern of entry.patterns) {
      if (norm.includes(normalize(pattern))) {
        return { answer: entry.answer, escalate: entry.escalate ?? false }
      }
    }
  }
  return null
}
