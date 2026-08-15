# ✅ TODO — Mi Mensajero
> Seguimiento semana a semana de lo que falta. Actualizar al terminar cada ítem.

---

## 🔥 URGENTE — Hacer YA (antes de mostrar a usuarios)

### SQL en Supabase (el usuario lo corre manualmente)
- [ ] Correr **Migration 022** — columna `role` + CEO *(versión corregida, sin `is_verified`)*
- [ ] Correr **Migration 023** — `join_requests`, columnas extendidas en `conversations`, RPCs
- [ ] Correr **Migration 024** — `bot_tokens` extendida, `bot_logs`, `bot_send_message` RPC

### Edge Functions en Supabase
- [ ] Deployar **`bot-api`** → `supabase functions deploy bot-api`
- [ ] Verificar que **`send-notification`** sigue funcionando
- [ ] Deployar **`mp-create-preference`** (cuando se configure MP)
- [ ] Deployar **`mp-webhook`** (cuando se configure MP)

---

## 📅 SEMANA 1 — Base sólida *(COMPLETADO)*

- [x] Registro y login con email
- [x] Perfil: @usuario, avatar, bio, estadísticas
- [x] Chat privado 1:1 en tiempo real
- [x] Grupos y comunidades básicos
- [x] Envío de texto, imágenes, archivos, audio
- [x] Responder, reaccionar, editar, eliminar mensajes
- [x] Indicador de escritura, doble tilde de lectura
- [x] Lista de chats con filtros y orden
- [x] Notificaciones push PWA
- [x] PWA instalable mobile-first
- [x] Layout PC responsive

---

## 📅 SEMANA 2 — Roles, comunidades y Bot API *(COMPLETADO)*

- [x] Sistema de roles de plataforma: CEO / Admin / Comunidad / VIP / Organizador / Miembro
- [x] `src/lib/roles.js` centralizado con límites por tier
- [x] Rankings en tiempo real (Supabase Realtime, no mock)
- [x] Eliminar torneos propios
- [x] Anuncios anti-spam (solo organizadores+)
- [x] PC layout más ancho (panel izquierdo responsive)
- [x] ProfileSheet mobile fix (stats no bloqueaban contenido)
- [x] ChatList: limpiar todos, filtro sort, tab "Chats"
- [x] Roles dentro del grupo: Dueño / Admin / Moderador / Organizador / Miembro
- [x] Privacidad avanzada: no exportar, no auto-guardar, solo avisos, aprobación
- [x] Solicitudes de ingreso: aprobar / rechazar (GroupInfoPage)
- [x] Bot API completa: Edge Function, tokens, logs, webhook, ejemplos de código
- [x] Documentación en BotApiPage (cURL / JS / Python / PHP)
- [x] Migrations 022, 023, 024 escritas

---

## 📅 SEMANA 3 — APK Android + Pagos

### APK Android
- [ ] Reinstalar `@capacitor/app` correctamente
  ```
  npm install @capacitor/app
  npx cap sync android
  ```
- [ ] Build en Android Studio → generar APK firmado
- [ ] Instalar en dispositivo físico y probar
- [ ] Push notifications en APK (agregar `google-services.json`)
- [ ] Probar que el Realtime (chat en tiempo real) funciona en APK
- [ ] Publicar APK en grupo de prueba (Telegram / WhatsApp)

### Mercado Pago
- [ ] Completar `BINANCE_ADDRESS` en `VipPage.jsx`
- [ ] Deployar `mp-create-preference` y `mp-webhook`
- [ ] Configurar webhook en dashboard de MP:
  - URL: `https://TU_PROYECTO.supabase.co/functions/v1/mp-webhook`
  - Evento: `payment`
- [ ] Tabla `payments` para registrar pagos
- [ ] Cuando se paga → `UPDATE users SET plan = 'vip'` (o `comunidad`)
- [ ] Probar flujo completo: pago → upgrade de plan automático
- [ ] VipPage: mostrar plan actual y beneficios

---

## 📅 SEMANA 4 — Chat features completos + Privacidad de usuario

### Chat features que faltan
- [ ] Reenviar mensajes (forward) con indicación de quién lo originó
- [ ] Copiar texto de un mensaje
- [ ] Link preview: cuando se pega una URL mostrar título / imagen
- [ ] Historial paginado (ahora carga todos — problema a escala)
  - Paginación con cursor, cargar 30 mensajes, botón "cargar más"
- [ ] Buscar dentro de una conversación (barra de búsqueda en chat)
- [ ] Encuestas en grupos (crear / votar / ver resultados en tiempo real)
- [ ] Soporte de video: enviar y reproducir videos (hasta 50MB)

### Privacidad de usuario (faltan las settings)
- [ ] Página Settings → Privacidad:
  - Quién puede enviarme DMs (todos / solo contactos / nadie)
  - Quién puede agregarme a grupos (todos / nadie)
  - Visibilidad de foto de perfil
  - Mostrar / ocultar "última vez visto"
- [ ] Bloquear usuario (desde menú de conversación)
- [ ] Desbloquear usuario (desde Settings → Bloqueados)
- [ ] Reportar usuario / mensaje (con formulario básico)
- [ ] Tabla `user_blocks` y `user_reports` en DB

---

## 📅 SEMANA 5 — Explorar, Notificaciones y Encuestas

### Explorar / Descubrir comunidades
- [ ] Pestaña "Explorar" en ChatListPage
- [ ] Grid de grupos y comunidades públicas (`is_public = true`)
- [ ] Buscador de comunidades por nombre / descripción
- [ ] Botón "Unirse" con flujo:
  - Si `require_approval = false` → entra directo
  - Si `require_approval = true` → envía `join_request`
- [ ] Badge "Miembro" si ya estás dentro

### Notificaciones mejoradas
- [ ] Notificación cuando te mencionan `@usuario`
- [ ] Notificación cuando responden tu mensaje
- [ ] Página "Notificaciones" con historial
- [ ] Configuración por conversación: silenciar / solo menciones / todo
- [ ] Email de bienvenida al registrarse (Supabase Email + template)

### Anuncios mejorados
- [ ] Markdown básico en mensajes de anuncios (**negrita**, _cursiva_, `código`)
- [ ] Reacciones a anuncios (👍 ❤️ 🔥 etc.)
- [ ] Anuncio fijado en la parte superior de la comunidad

---

## 📅 SEMANA 6 — Bot API avanzado + Admin Panel

### Bot API — segunda iteración
- [ ] Endpoint `GET /bot-api/members` — listar miembros del grupo
- [ ] Endpoint `POST /bot-api/pin` — fijar un mensaje via bot
- [ ] Comandos de bot: mensajes que empiecen con `/` se procesan como comando
- [ ] Bot puede silenciar miembros (con permiso `can_moderate`)
- [ ] Rate limiting: máx 30 mensajes/minuto por bot
- [ ] Portal de developers: página pública con docs de la API

### Panel de Administración (para CEO / Admin)
- [ ] Ruta `/admin` accesible solo para CEO y Admin
- [ ] Lista de usuarios con roles, plan, fecha de registro
- [ ] Buscar usuario por @username o email
- [ ] Cambiar rol de usuario manualmente
- [ ] Ver y gestionar reportes enviados
- [ ] Estadísticas globales:
  - Total usuarios, usuarios activos hoy / semana
  - Mensajes enviados hoy
  - Grupos y comunidades creadas
- [ ] Bloqueo global de usuario (baneo de la plataforma)

---

## 📅 SEMANA 7 — Torneos avanzados + Ligas

### Torneos — features deportivos
- [ ] Bracket automático (eliminación directa 8/16/32 jugadores)
- [ ] Cargar resultado con foto de comprobante
- [ ] Admin del torneo valida resultado o lo rechaza
- [ ] Tabla de posiciones en tiempo real para ligas
- [ ] Notificación automática al inicio del torneo (via bot)
- [ ] Sistema de puntos configurable (3 pts victoria, 1 empate, 0 derrota)
- [ ] Historial de torneos participados en perfil

### eFootball específico
- [ ] Integración con notificaciones de partidos (bot publica automáticamente)
- [ ] Stats: victorias, goles a favor/contra, diferencia de gol
- [ ] Clasificaciones por temporada

---

## 📅 SEMANA 8+ — Features premium y escala

### Perfil avanzado
- [ ] Stories / estados (desaparecen en 24h)
- [ ] Insignias: torneo ganado, antigüedad, verificado
- [ ] Links / redes sociales en perfil (Instagram, TikTok, etc.)
- [ ] Cambiar @usuario (1 vez cada 30 días)

### Autenticación avanzada
- [ ] Login con Google (OAuth)
- [ ] Registro con número de teléfono + OTP SMS
- [ ] Autenticación dos factores (2FA)
- [ ] Sesiones múltiples (ver y cerrar sesiones activas)

### Multimedia premium
- [ ] Stickers (packs básicos incluidos, packs premium de pago)
- [ ] GIFs (integración Giphy/Tenor)
- [ ] Compresión automática de imágenes
- [ ] Mayor límite de archivo para VIP/Comunidad (100MB vs 25MB)
- [ ] Notas de voz con velocidad variable

### Infraestructura
- [ ] CDN para archivos (Cloudflare R2 o AWS S3)
- [ ] Rate limiting global en Edge Functions
- [ ] Logs de auditoría y seguridad
- [ ] Modo mantenimiento con banner
- [ ] Backup automático de datos críticos

---

## 🤖 Bot API — SDK oficial (largo plazo)

- [ ] SDK Node.js: `npm install mimensajero-bot`
  ```js
  const bot = new MiMensajeroBot('TOKEN')
  bot.sendMessage('Torneo iniciado!')
  bot.on('message', msg => { ... })
  ```
- [ ] SDK Python: `pip install mimensajero`
- [ ] Portal de developers con docs interactiva (estilo Telegram Bot API)
- [ ] Soporte de comandos `/comando args` con webhook de respuesta
- [ ] Bot Builder visual (sin código) — fase muy avanzada

---

## 📱 iOS — Futuro

- [ ] Evaluar demanda post-lanzamiento Android
- [ ] Capacitor → Xcode → App Store
- [ ] Login con Apple (requerido por App Store si hay login con Google)

---

## 💬 Notas importantes

1. **Vercel** hace deploy automático cuando hay push a `main` ✅
2. **Supabase** las migrations hay que correrlas manualmente en SQL Editor
3. **Edge Functions** se deployán con `supabase functions deploy <nombre>`
4. **APK** hay que buildear manualmente con Android Studio cada vez que hay cambios importantes
5. **Bot API URL** = `https://TU_PROYECTO.supabase.co/functions/v1/bot-api`

---

*Archivo actualizado por Claude Code. Para agregar un ítem: `- [ ] descripción`. Para marcarlo hecho: `- [x] descripción`.*
