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
- [x] Envío de texto, imágenes, archivos, audios, videos
- [x] Responder mensajes, reacciones con emojis
- [x] Editar y eliminar mensajes
- [x] Indicador de escritura (typing)
- [x] Estado de lectura (✓ / ✓✓)
- [x] Mensajes fijados
- [x] Buscar conversaciones (lista de chats)
- [x] Buscar dentro de una conversación (barra de búsqueda en ChatPage)
- [x] Lista de chats: filtro por chats/grupos/comunidades, ordenar, limpiar todos
- [x] Notificaciones push PWA (Web Push)
- [x] PWA instalable (mobile-first)
- [x] Layout PC: panel izquierdo responsive (420/520/600px)
- [x] Reenviar mensajes (forward)
- [x] Link preview automático en mensajes con URLs (YouTube, Twitter, Instagram, Twitch, otros)
- [x] Soporte de video (enviar/reproducir en chat)
- [x] Mensajes temporales (auto-destruir, configuración por chat)
- [x] Ver-una-vez (imágenes/videos con límite de vistas: 1x, 2x, 3x, ilimitado)
- [x] GIFs animados (integración Tenor)
- [x] Stickers en chat
- [x] Notas de voz con waveform animado
- [x] Encuestas en grupos (crear + votar + resultados en tiempo real)
- [x] Eventos en grupos (crear + RSVP + lista de asistentes)
- [x] Canales dentro de grupos (topics)
- [x] Menciones @usuario con highlight
- [x] Nudge / "sacudir" al contacto

### Roles y permisos de plataforma
- [x] Sistema de roles: CEO / Admin / Comunidad / VIP / Organizador / Miembro
- [x] Límites por tier (max participantes, torneos por día, etc.)
- [x] CEO asignado: bermudezleandro1992@gmail.com + mutrueno@live.com.ar
- [x] `src/lib/roles.js` — helper centralizado de roles y permisos
- [x] Migration 022: columna `role` + `plan` en tabla `users` ✅ corrida

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
- [x] Migration 023: join_requests, columnas extendidas, RPCs ✅ corrida

### Privacidad y seguridad de usuarios
- [x] Bloquear / desbloquear usuarios (tabla `blocks` + UI en ContactPage)
- [x] Reportar usuarios (5 razones + estado de revisión, tabla `reports`)
- [x] Visibilidad de "última vez visto" (respeta setting `show_last_seen`)
- [x] Badge de plan VIP/Pro visible en perfil de contacto
- [x] Columna `privacy_dm` en users (quién puede escribirme)
- [x] Migration 026: blocks + reports + privacidad ✅ corrida

### Llamadas de voz y video
- [x] Llamadas 1:1 de audio y video (WebRTC)
- [x] Llamadas grupales (WebRTC mesh)
- [x] ICE / TURN servers para NAT traversal
- [x] Indicador de calidad de señal (RTCStats, barras + latencia ms)
- [x] Reacciones emoji en vivo durante la llamada (broadcast Supabase)
- [x] Compartir pantalla (getDisplayMedia, solo video calls)
- [x] Fondos temáticos (7 opciones: dark, space, ocean, forest, sunset, gold)
- [x] Bloc de notas en llamada
- [x] Pastilla minimizada con waveform, señal y colgar
- [x] Audio por auricular por defecto en llamadas de voz (anti-eco, como WhatsApp)
- [x] Video calls → altavoz por defecto
- [x] Toggle altavoz/auricular con ícono y label dinámico
- [x] Cancelación de eco mejorada (autoGainControl + googEchoCancellation + channelCount 1)
- [x] Enrutamiento automático al conectar (sin acción del usuario)
- [x] Anillo de espera, sonido de conexión, sonido de fin de llamada
- [x] Mensaje automático de "llamada perdida" en el chat

### Torneos y ligas
- [x] Crear torneo / liga (público para todos, límites por rol)
- [x] Rankings en tiempo real desde Supabase
- [x] Eliminar torneos propios
- [x] Badge de rol en formulario de creación
- [x] **Herramienta: Sorteo aleatorio** — animar resultado con confetti
- [x] **Herramienta: Brackets** — eliminación directa hasta 32 equipos
- [x] **Herramienta: Tabla de posiciones** — PJ/G/E/P/GF/GC/DIF/PTS
- [x] **Herramienta: Votaciones** — crear encuesta + votar + gráfico de barras
- [x] **Herramienta: Carga de resultados** — foto comprobante + marcador + validación admin
- [x] **Herramienta: Calendario de eventos** — grid mensual + agenda próximos eventos
- [x] **Herramienta: Sistema de premios y podio** — trofeos por jugador + podio animado
- [x] Migration 025: polls, poll_votes, match_results ✅ corrida

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
- [x] Migration 024: bot_tokens + bot_logs + bot_send_message RPC ✅ corrida

### Explorar / Descubrir
- [x] DiscoverPage: grupos y comunidades públicas con buscador

### Suscripciones y pagos
- [x] Tabla `subscriptions` con RLS (migration 020)
- [x] Tabla `payments` con RLS (migration 020)
- [x] RPC `activate_subscription` (migration 020)
- [x] VipPage con 4 planes + Mercado Pago + Binance/USDT
- [x] Edge Function `mp-create-preference` (código listo)
- [x] Edge Function `mp-webhook` con `activate_subscription` (código listo)

### APK Android
- [x] Capacitor v8 configurado
- [x] Build APK debug exitoso (`.\gradlew assembleDebug` — BUILD SUCCESSFUL)
- [x] APK distribuible sin Android Studio

---

## ⏳ PENDIENTE DEL USUARIO (acciones manuales)

### Supabase — Storage buckets
- [ ] Crear bucket `result-photos` (para CargaResultados):
  ```sql
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('result-photos', 'result-photos', true)
  ON CONFLICT DO NOTHING;
  ```

### Edge Functions — Deploy (requiere Supabase CLI)
```bash
supabase login
supabase link --project-ref gxberqtxbnrnudawwyzd
supabase functions deploy bot-api
supabase functions deploy mp-create-preference
supabase functions deploy mp-webhook
```

### Mercado Pago — Configuración
- [ ] Configurar webhook en dashboard MP:
  `https://gxberqtxbnrnudawwyzd.supabase.co/functions/v1/mp-webhook`
- [ ] Completar direcciones en `VipPage.jsx`:
  ```js
  USDT_TRC20: 'TU_WALLET_USDT_TRC20',
  BINANCE_ID:  'TU_BINANCE_ID',
  ```

---

## 📋 PENDIENTE — Por prioridad

### 🔴 Alta prioridad

- [ ] **Push notifications en APK (FCM)**
  - Configurar `google-services.json` en el APK android
  - Variables: `FIREBASE_SERVER_KEY` en Supabase Edge Functions
- [ ] **Publicar APK en Google Play** (o distribuir directo por ahora)
- [ ] **Configurar privacy_dm en perfil** — UI para que el usuario elija quién le puede escribir
- [ ] **Ocultar foto de perfil a desconocidos** — toggle en settings de perfil

### 🟡 Media prioridad

- [ ] **Historial paginado** — ahora carga todos los mensajes, puede ser lento en chats largos
- [ ] **Copiar texto de mensaje** — botón explícito en el menú de acciones del mensaje
- [ ] **Anuncios formato enriquecido** — negrita, cursiva, código (markdown básico)
- [ ] **Anuncios fijados en comunidad**
- [ ] **Notificación de mención @usuario**
- [ ] **Notificación de respuesta a mis mensajes**
- [ ] **Configuración de notificaciones granular** (silenciar por tipo)

### 🟢 Baja prioridad / Futuro

- [ ] Panel de administración CEO/Admin (usuarios, reportes, estadísticas)
- [ ] Rate limiting en Edge Functions
- [ ] Modo mantenimiento (banner de aviso)
- [ ] Login con Google (OAuth)
- [ ] Autenticación de dos factores (2FA)
- [ ] Múltiples dispositivos simultáneos con sincronización
- [ ] Cambiar @usuario (cooldown 30 días)
- [ ] Insignias (badge de torneo ganado, antigüedad)
- [ ] SDK oficial Node.js/Python para bots
- [ ] CDN para archivos (Cloudflare R2)
- [ ] Compresión automática de imágenes
- [ ] Notas de voz con velocidad variable (0.5x, 1x, 1.5x, 2x)
- [ ] Comunidades verificadas (badge oficial)
- [ ] Estadísticas de comunidad para admins

---

## 💡 Ideas a evaluar (backlog)

- Videollamadas grupales mejoradas (SFU con LiveKit en vez de mesh P2P)
- Modo "competición": torneos con inscripción paga via MP, premio en USDT
- API pública con portal de developers (estilo Telegram Bot API)
- Integración con Discord para bots cruzados
- Soporte iOS (Capacitor + App Store)
- Versión desktop (Electron) si hay demanda

---

*Actualizado Agosto 2026 · Migrations 001-026 en repo · Deploy automático desde `main` via Vercel*
