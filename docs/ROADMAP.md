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
- [x] Buscar dentro de una conversación (en ChatPage)
- [x] Lista de chats: filtro por chats/grupos/comunidades, ordenar, limpiar todos
- [x] Notificaciones push PWA (Web Push)
- [x] PWA instalable (mobile-first)
- [x] Layout PC: panel izquierdo responsive (420/520/600px)
- [x] Reenviar mensajes (forward)
- [x] Link preview automático en mensajes con URLs
- [x] Soporte de video (enviar/reproducir)
- [x] Mensajes temporales (auto-destruir)
- [x] Encuestas en grupos (crear + votar + resultados)
- [x] Eventos en grupos (crear + RSVP)
- [x] GIFs animados (integración Tenor)
- [x] Stickers en chat
- [x] Notas de voz con waveform y velocidad variable
- [x] Ver-una-vez (imágenes/videos con límite de vistas)

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
- [x] Canales dentro del grupo (topics)

### Privacidad y seguridad de usuarios
- [x] Bloquear / desbloquear usuarios
- [x] Reportar usuarios (5 razones + estado de revisión)
- [x] Visibilidad de "última vez visto" (respeta setting show_last_seen)
- [x] Tabla `blocks` con RLS
- [x] Tabla `reports` con RLS
- [x] Columna `privacy_dm` en users
- [x] Migration 026: blocks + reports + privacidad

### Llamadas de voz y video
- [x] Llamadas 1:1 de audio y video (WebRTC)
- [x] Llamadas grupales (WebRTC mesh)
- [x] ICE / TURN servers para NAT traversal
- [x] Indicador de calidad de señal (RTCStats, barras + latencia ms)
- [x] Reacciones emoji en vivo durante la llamada (broadcast Supabase)
- [x] Compartir pantalla (getDisplayMedia)
- [x] Fondos temáticos (7 opciones)
- [x] Bloc de notas en llamada
- [x] Pastilla minimizada con waveform y señal
- [x] Audio por auricular por defecto (anti-eco como WhatsApp)
- [x] Cancelación de eco mejorada (autoGainControl + constraints avanzados)
- [x] Toggle altavoz/auricular con feedback visual

### Torneos y ligas
- [x] Crear torneo / liga (público para todos, límites por rol)
- [x] Rankings en tiempo real desde Supabase (no mock)
- [x] Eliminar torneos propios
- [x] Badge de rol en formulario de creación
- [x] Herramienta: Sorteo aleatorio
- [x] Herramienta: Brackets de eliminación
- [x] Herramienta: Tabla de posiciones
- [x] Herramienta: Votaciones
- [x] Herramienta: Carga de resultados con foto
- [x] Herramienta: Calendario de eventos
- [x] Herramienta: Sistema de premios y podio

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

### Explorar / Descubrir
- [x] DiscoverPage: grupos y comunidades públicas
- [x] Directorio con buscador

### Suscripciones y pagos
- [x] Tabla `subscriptions` con RLS (migration 020)
- [x] Tabla `payments` con RLS (migration 020)
- [x] RPC `activate_subscription` (migration 020)
- [x] VipPage con planes + Mercado Pago + Binance/USDT
- [x] Edge Function `mp-create-preference` (lista para deploy)
- [x] Edge Function `mp-webhook` (lista para deploy)

### APK Android
- [x] Capacitor v8 configurado
- [x] Build APK debug (`.\gradlew assembleDebug` — BUILD SUCCESSFUL)
- [x] APK distribuible sin Android Studio

---

## 🔄 PENDIENTE DEL USUARIO (acciones manuales)

### Supabase — Migrations a correr
| # | Archivo | Estado | Descripción |
|---|---------|--------|-------------|
| 022 | `022_roles_and_limits.sql` | ⏳ Pendiente | Columna `role`/`plan` en users, asignar CEO |
| 023 | `023_community_features.sql` | ⏳ Pendiente | join_requests, columnas extendidas, RPCs |
| 024 | `024_bot_api.sql` | ⏳ Pendiente | bot_tokens, bot_logs, bot_send_message RPC |
| 025 | `025_polls.sql` | ⏳ Pendiente | polls, poll_votes, match_results + RLS |
| 026 | `026_reports_and_privacy.sql` | ✅ Corrido | blocks, reports, privacy_dm |

### Supabase — Storage buckets
- [ ] `result-photos` bucket público (para CargaResultados)
  ```sql
  INSERT INTO storage.buckets (id, name, public) VALUES ('result-photos', 'result-photos', true) ON CONFLICT DO NOTHING;
  ```

### Edge Functions — Deploy
| Función | Estado | Comando |
|---------|--------|---------|
| `bot-api` | ⏳ Pendiente | `supabase functions deploy bot-api` |
| `send-notification` | ✅ Existe | — |
| `mp-create-preference` | ⏳ Pendiente | `supabase functions deploy mp-create-preference` |
| `mp-webhook` | ⏳ Pendiente | `supabase functions deploy mp-webhook` |

### Mercado Pago
- [ ] Configurar webhook en dashboard MP: `https://TU_PROYECTO.supabase.co/functions/v1/mp-webhook`
- [ ] Completar dirección de Binance en `VipPage.jsx` (`BINANCE_ADDRESS`)

---

## 📋 PENDIENTE — Por prioridad

### 🔴 Alta prioridad

#### Push Notifications en APK (FCM)
- [ ] Configurar `google-services.json` en el APK
- [ ] Publicar en Google Play (o distribuir APK directo)

#### Perfil y privacidad — pendiente de UI
- [ ] Ocultar foto de perfil a desconocidos (toggle en perfil)
- [ ] Configurar `privacy_dm` desde perfil (quién puede escribirme)
- [ ] Agregar redes sociales / links en perfil

### 🟡 Media prioridad

#### Chat mejoras
- [ ] Historial paginado (ahora carga todos los mensajes — puede ser lento en chats largos)
- [ ] Copiar texto de mensaje con botón (ahora solo funciona selección manual)
- [ ] Anuncios: formato enriquecido (negrita, cursiva, código)
- [ ] Anuncios: reacciones y anuncios fijados en comunidad

#### Notificaciones
- [ ] Notificación de mención @usuario
- [ ] Notificación de respuesta a mis mensajes
- [ ] Configuración granular (silenciar por tipo)
- [ ] Notificaciones por email (bienvenida, resumen diario)

### 🟢 Baja prioridad / Futuro

#### Bot API
- [ ] Comandos de bot (`/comando args`)
- [ ] Bot puede leer mensajes recientes vía API
- [ ] Bot puede moderar (silenciar, expulsar)
- [ ] Portal de developers con documentación pública
- [ ] SDK oficial Node.js y Python

#### Perfil avanzado
- [ ] Estados / stories ya está pero mejorar (desaparece en 24h, estadísticas)
- [ ] Insignias (badge de torneo ganado, antigüedad)
- [ ] Cambiar @usuario (con cooldown de 30 días)

#### Infraestructura
- [ ] Rate limiting en Edge Functions
- [ ] Panel de administración CEO/Admin (ver usuarios, reportes, estadísticas)
- [ ] Modo mantenimiento (banner de aviso)
- [ ] CDN para archivos (Cloudflare R2)

#### Auth avanzado
- [ ] Login con Google (OAuth)
- [ ] Autenticación de dos factores (2FA)
- [ ] Múltiples dispositivos simultáneos

---

## 💡 Ideas a evaluar (backlog)

- Integración con Discord para bots cruzados
- Modo "competición": torneos con inscripción paga via MP, premio en USDT
- API pública con portal de developers (estilo Telegram Bot API)
- Soporte iOS (Capacitor + App Store)
- Versión desktop (Electron)
- Videollamadas grupales mejoradas (SFU con mediasoup/livekit)
- Compresión automática de imágenes antes de subir
- Notas de voz con velocidad variable (0.5x, 1x, 1.5x, 2x)

---

*Actualizado con cada sprint. Las fechas son estimadas y pueden cambiar.*
