# 🗺 Roadmap — Mi Mensajero

> Última actualización: Agosto 2026
> Estado: MVP en producción en `mimensajero.vercel.app`

---

## ✅ COMPLETADO

### Core de mensajería
- [x] Registro y login con email (Supabase Auth)
- [x] Perfil de usuario: @usuario único, avatar, bio, estadísticas
- [x] Chat privado 1:1 en tiempo real (Supabase Realtime)
- [x] Grupos y comunidades
- [x] Envío de texto, imágenes, archivos, audios
- [x] Responder mensajes, reacciones con emojis
- [x] Editar y eliminar mensajes
- [x] Indicador de escritura (typing)
- [x] Estado de lectura (✓ / ✓✓)
- [x] Mensajes fijados
- [x] Buscar conversaciones
- [x] Lista de chats: filtro por chats/grupos/comunidades, ordenar, limpiar todos
- [x] Notificaciones push PWA (Web Push)
- [x] PWA instalable (mobile-first)
- [x] Layout PC: panel izquierdo responsive (420/520/600px)

### Roles y permisos de plataforma
- [x] Sistema de roles: CEO / Admin / Comunidad / VIP / Organizador / Miembro
- [x] Límites por tier (max participantes, torneos por día, etc.)
- [x] CEO asignado: bermudezleandro1992@gmail.com + mutrueno@live.com.ar
- [x] `src/lib/roles.js` — helper centralizado de roles y permisos
- [x] Migration 022: columna `role` + `plan` en tabla `users`

### Grupos y comunidades avanzadas
- [x] Roles dentro del grupo: Dueño / Admin / Moderador / Organizador / Miembro
- [x] Asignación de roles con jerarquía
- [x] Silenciar miembros (1h / 6h / 24h)
- [x] Expulsar miembros
- [x] Mensajes fijados en grupo
- [x] Enlace de invitación (generar / revocar)
- [x] Foto del grupo (upload a Supabase Storage)
- [x] Privacidad: quién puede enviar / agregar / editar info
- [x] Modo lento (slow mode)
- [x] Auto-borrado de mensajes
- [x] Modo bloqueado (is_locked)
- [x] Privacidad avanzada: no exportar / no auto-guardar archivos
- [x] Modo "Solo avisos" (announcement_only)
- [x] Aprobación requerida para nuevos miembros
- [x] Solicitudes de ingreso: aprobar / rechazar
- [x] Migration 023: join_requests, columnas extendidas, RPCs

### Torneos y ligas
- [x] Crear torneo / liga (público para todos, límites por rol)
- [x] Rankings en tiempo real desde Supabase (no mock)
- [x] Eliminar torneos propios
- [x] Badge de rol en formulario de creación

### Anuncios
- [x] Página de anuncios con control de quién puede publicar
- [x] Anti-spam: solo organizadores+ con grupo propio pueden publicar
- [x] `canPublishAnnouncements()` en roles.js

### Bot API
- [x] Tabla `bot_tokens` con RLS
- [x] Tabla `bot_logs` para auditoría
- [x] Edge Function `bot-api`: POST /send, POST /announce, GET /info, GET /logs
- [x] Auth por Bearer token o body `bot_token`
- [x] Webhook URL por bot (reenvío de eventos)
- [x] BotApiPage completa: crear bots, ver token, configurar webhook, ver logs
- [x] Ejemplos de código: cURL, JavaScript, Python, PHP
- [x] Migration 024: bot_tokens extendida + bot_logs + bot_send_message RPC

---

## 🔄 EN PROGRESO / PRÓXIMO PASO

### Semana actual
- [ ] **Desplegar Edge Function bot-api** en Supabase
  - `supabase functions deploy bot-api`
  - Variables necesarias: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (ya están)
- [ ] **Correr migrations en Supabase SQL Editor**
  - 022: roles + CEO (está corregida, sin `is_verified`)
  - 023: community features (join_requests, RPCs)
  - 024: bot_tokens + bot_logs

---

## 📋 PENDIENTE — Por prioridad

### 🔴 Alta prioridad (bloquea funcionalidad clave)

#### APK Android
- [ ] Build APK con Capacitor v8
  - `npm run build && npx cap sync android`
  - Fix pendiente: `@capacitor/app` reinstalar
  - `npx cap open android` → Build en Android Studio
- [ ] Push notifications en APK (FCM)
  - Edge Function `send-notification` ya existe
  - Falta configurar google-services.json en el APK
- [ ] Publicar en Google Play (o distribuir APK directo por ahora)

#### Mercado Pago (pagos y suscripciones VIP)
- [ ] Desplegar Edge Function `mp-create-preference`
- [ ] Desplegar Edge Function `mp-webhook`
- [ ] Configurar webhook en dashboard de Mercado Pago:
  - URL: `https://TU_PROYECTO.supabase.co/functions/v1/mp-webhook`
  - Eventos: payment
- [ ] Completar dirección de Binance en `VipPage.jsx` (`BINANCE_ADDRESS`)
- [ ] Tabla `payments` para registrar pagos y upgrades de plan
- [ ] Lógica de upgrade automático al pagar (webhook → UPDATE users SET plan)

#### Perfil y privacidad de usuario
- [ ] Editar configuraciones de privacidad (quién puede enviarme DMs, agregarme a grupos)
- [ ] Bloquear / desbloquear usuarios
- [ ] Reportar usuarios y mensajes
- [ ] Visibilidad de "última vez visto"
- [ ] Ocultar foto de perfil a desconocidos

### 🟡 Media prioridad (mejoras importantes)

#### Chat features faltantes
- [ ] Reenviar mensajes (forward)
- [ ] Copiar texto de mensaje
- [ ] Link preview (metadata de URLs)
- [ ] Soporte de video (enviar/reproducir)
- [ ] Buscar dentro de una conversación
- [ ] Historial paginado (ahora carga todos los mensajes)
- [ ] Mensajes temporales (auto-destruir en DMs)

#### Anuncios mejorados
- [ ] Formato enriquecido (markdown básico: **negrita**, _cursiva_, `código`)
- [ ] Reacciones a anuncios
- [ ] Anuncios fijados en comunidad

#### Explorar / Descubrir
- [ ] Página Explorar: grupos y comunidades públicas
- [ ] Directorio de comunidades con buscador
- [ ] Estadísticas de comunidad (para admins)

#### Notificaciones
- [ ] Notificación de mención @usuario
- [ ] Notificación de respuesta a mis mensajes
- [ ] Configuración granular (silenciar por tipo)
- [ ] Notificaciones por email (bienvenida, resumen diario)

#### Encuestas en grupos
- [ ] Crear encuesta (pregunta + opciones)
- [ ] Votar en encuesta
- [ ] Ver resultados en tiempo real

### 🟢 Baja prioridad / Futuro

#### Bot API — próximas iteraciones
- [ ] Comandos de bot (`/comando args`)
- [ ] Bot puede leer mensajes recientes vía API
- [ ] Bot puede moderar (silenciar, expulsar) — solo con permiso
- [ ] Portal de developers con documentación pública
- [ ] SDK oficial Node.js (`npm install mimensajero-bot`)
- [ ] SDK Python (`pip install mimensajero`)
- [ ] Bot Builder visual (sin código) — fase muy avanzada

#### Comunidades — features avanzados
- [ ] Subgrupos dentro de una comunidad (como Telegram: canales)
- [ ] Reglas de la comunidad (texto visible para todos)
- [ ] Eventos dentro de la comunidad (fecha, descripción, RSVP)
- [ ] Comunidades verificadas (badge oficial)
- [ ] Estadísticas: miembros activos, mensajes por día, pico de actividad

#### Torneos y ligas — features avanzados
- [ ] Bracket automático (eliminación directa, round robin)
- [ ] Resultados con foto de comprobante
- [ ] Tabla de posiciones en tiempo real por liga
- [ ] Integración eFootball API (si existe) para verificar resultados
- [ ] Notificación automática de inicio de partido (via bot)
- [ ] Historia de torneos / historial de participaciones

#### Perfil avanzado
- [ ] Estados / stories (desaparece en 24h)
- [ ] Insignias (badge de torneo ganado, antigüedad, etc.)
- [ ] Links / redes sociales en perfil
- [ ] Cambiar @usuario (con cooldown de 30 días)
- [ ] Perfil público vs privado

#### Infraestructura y escala
- [ ] Rate limiting en Edge Functions (protección contra abuso)
- [ ] Logs de seguridad y auditoría (admin panel)
- [ ] Panel de administración para CEO/Admin
  - Ver usuarios, reportes, bloqueos globales
  - Estadísticas de la plataforma
- [ ] Modo mantenimiento (banner de aviso)
- [ ] Backup automático de mensajes
- [ ] CDN para archivos multimedia (Cloudflare R2 o similar)

#### Multimedia
- [ ] Stickers personalizados
- [ ] GIFs animados (integración Tenor/Giphy)
- [ ] Compresión automática de imágenes antes de subir
- [ ] Mayor límite de tamaño en plan VIP/Comunidad
- [ ] Notas de voz con velocidad variable (0.5x, 1x, 1.5x, 2x)

#### Auth y seguridad
- [ ] Login con Google (OAuth)
- [ ] Login con Apple (OAuth) — para APK en iOS futuro
- [ ] Autenticación de dos factores (2FA con TOTP)
- [ ] Registro con número de teléfono + OTP SMS
- [ ] Múltiples dispositivos simultáneos con sincronización

---

## 🗄 Migrations a correr en Supabase (pendiente del usuario)

| # | Archivo | Estado | Descripción |
|---|---------|--------|-------------|
| 022 | `022_roles_and_limits.sql` | ⏳ Pendiente | Columna `role`/`plan` en users, asignar CEO |
| 023 | `023_community_features.sql` | ⏳ Pendiente | join_requests, columnas extendidas en conversations, RPCs |
| 024 | `024_bot_api.sql` | ⏳ Pendiente | bot_tokens, bot_logs, bot_send_message RPC |

**Cómo correrlas**: Supabase Dashboard → SQL Editor → pegar contenido → Run

---

## 🚀 Edge Functions a deployar

| Función | Estado | Comando |
|---------|--------|---------|
| `bot-api` | ⏳ Pendiente deploy | `supabase functions deploy bot-api` |
| `send-notification` | ✅ Existe (verificar) | — |
| `mp-create-preference` | ⏳ Pendiente configurar | `supabase functions deploy mp-create-preference` |
| `mp-webhook` | ⏳ Pendiente configurar | `supabase functions deploy mp-webhook` |

---

## 💡 Ideas a evaluar (backlog)

- Integración con Discord para bots que cruzan ambas plataformas
- Modo "competición": torneos con inscripción paga via MP, premio en USDT
- API pública con portal de developers (estilo Telegram Bot API)
- Soporte iOS (Capacitor + App Store) — después de validar Android
- Versión desktop (Electron) si hay demanda
- Videollamadas grupales — solo si hay recursos y demanda comprobada (NO en V1)

---

*Actualizado con cada sprint. Las fechas son estimadas y pueden cambiar.*
