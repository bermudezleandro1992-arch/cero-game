# 02 — Requerimientos

**Versión:** 0.1
**Estado:** Definición inicial

---

## Leyenda de prioridades

| Símbolo | Significado |
|---------|------------|
| ✅ | Obligatorio para V1 (MVP) |
| 🔜 | Después del MVP |
| 🔮 | Futuro / fase avanzada |
| ❌ | No hacer / evitar por ahora |

---

## 1. Registro y autenticación

| Requerimiento | Prioridad |
|--------------|-----------|
| Registro con número de teléfono | ✅ |
| Verificación por código OTP (SMS) | ✅ |
| Asociar email a la cuenta | ✅ |
| Login con número de teléfono | ✅ |
| Cierre de sesión | ✅ |
| Sesión persistente (recordar login) | ✅ |
| Recuperación de cuenta por email | ✅ |
| Registro con email (sin teléfono) | 🔜 |
| Login con Google / Apple | 🔮 |
| Autenticación de dos factores (2FA) | 🔮 |
| Múltiples dispositivos simultáneos | 🔜 |

---

## 2. Perfil de usuario

| Requerimiento | Prioridad |
|--------------|-----------|
| Nombre de usuario único `@usuario` | ✅ |
| Foto de perfil | ✅ |
| Nombre visible | ✅ |
| Bio / descripción | ✅ |
| Número de teléfono (privado, no visible) | ✅ |
| Email (privado) | ✅ |
| Editar perfil | ✅ |
| Cambiar foto de perfil | ✅ |
| Cambiar `@usuario` (con límites) | ✅ |
| Búsqueda de usuarios por `@usuario` | ✅ |
| Estados / stories | 🔜 |
| Insignias / badges | 🔮 |
| Perfil premium con extras | 🔮 |
| Links / redes sociales en perfil | 🔮 |

---

## 3. Privacidad

| Requerimiento | Prioridad |
|--------------|-----------|
| Número de teléfono oculto por defecto | ✅ |
| Configurar quién puede enviarme mensajes | ✅ |
| Configurar quién puede agregarme a grupos | ✅ |
| Configurar visibilidad de foto de perfil | ✅ |
| Configurar visibilidad de estado / última vez | ✅ |
| Bloquear usuarios | ✅ |
| Desbloquear usuarios | ✅ |
| Reportar usuarios | ✅ |
| Configurar quién puede encontrarme | 🔜 |
| Modo invisible / no disponible | 🔮 |

---

## 4. Chat privado

| Requerimiento | Prioridad |
|--------------|-----------|
| Enviar mensajes de texto | ✅ |
| Emojis | ✅ |
| Enviar imágenes | ✅ |
| Enviar archivos (PDF, ZIP, etc.) | ✅ |
| Enviar audios / mensajes de voz | ✅ |
| Enviar videos | 🔜 |
| Responder un mensaje | ✅ |
| Reaccionar a mensajes (emojis) | ✅ |
| Editar mensajes enviados | ✅ |
| Eliminar mensajes (para mí / para todos) | ✅ |
| Copiar texto de mensajes | ✅ |
| Reenviar mensajes | ✅ |
| Indicador de escritura ("escribiendo...") | ✅ |
| Estado de entrega (enviado ✓) | ✅ |
| Estado de lectura (leído ✓✓ azul) | ✅ |
| Mensajes fijados | ✅ |
| Buscar dentro de una conversación | ✅ |
| Historial paginado (no cargar todo de golpe) | ✅ |
| Compartir enlaces con preview | 🔜 |
| Mensajes que se autodestruyen | 🔮 |
| Mensajes de voz con velocidad variable | 🔮 |
| Stickers | 🔮 |
| GIFs | 🔮 |

---

## 5. Notificaciones

| Requerimiento | Prioridad |
|--------------|-----------|
| Notificación de nuevo mensaje | ✅ |
| Notificación de mención `@usuario` | ✅ |
| Notificación de respuesta a mis mensajes | ✅ |
| Notificación de invitación a grupo | ✅ |
| Notificación de invitación a comunidad | ✅ |
| Notificación de avisos de comunidad | ✅ |
| Silenciar conversaciones | ✅ |
| Silenciar grupos | ✅ |
| Silenciar comunidades | ✅ |
| Configurar qué notificaciones recibir | ✅ |
| Push notifications en PWA | ✅ |
| Push notifications en APK | 🔜 |
| Notificaciones por email | 🔮 |

---

## 6. Grupos

| Requerimiento | Prioridad |
|--------------|-----------|
| Crear grupo | ✅ |
| Nombre del grupo | ✅ |
| Imagen del grupo | ✅ |
| Descripción del grupo | ✅ |
| Agregar miembros | ✅ |
| Invitar por enlace | ✅ |
| Roles: Administrador / Moderador / Miembro | ✅ |
| Nombrar administradores | ✅ |
| Expulsar miembros | ✅ |
| Restringir miembros (solo lectura) | ✅ |
| Bloquear miembros del grupo | ✅ |
| Mensajes fijados en el grupo | ✅ |
| Respuestas y reacciones | ✅ |
| Encuestas | ✅ |
| Compartir archivos en grupo | ✅ |
| Límite de miembros configurable | 🔜 |
| Roles personalizados | 🔮 |
| Threads / hilos de conversación | 🔮 |
| Llamadas grupales de voz | ❌ (V1) |

---

## 7. Comunidades

| Requerimiento | Prioridad |
|--------------|-----------|
| Crear comunidad | ✅ |
| Nombre, imagen y descripción | ✅ |
| Administradores y moderadores | ✅ |
| Crear canales / grupos dentro de la comunidad | ✅ |
| Canal de avisos (solo admins publican) | ✅ |
| Reglas de la comunidad | ✅ |
| Información / descripción pública | ✅ |
| Invitar miembros | ✅ |
| Enlace de invitación a la comunidad | ✅ |
| Moderar miembros | ✅ |
| Asignar bots a la comunidad | ✅ |
| Eventos dentro de la comunidad | 🔜 |
| Comunidad pública (descubrible) | 🔜 |
| Directorio de comunidades | 🔜 |
| Estadísticas de la comunidad | 🔮 |
| Comunidades verificadas | 🔮 |

---

## 8. Avisos de comunidad

| Requerimiento | Prioridad |
|--------------|-----------|
| Canal exclusivo de avisos | ✅ |
| Solo admins / bots pueden publicar avisos | ✅ |
| Los miembros pueden reaccionar a avisos | ✅ |
| Avisos manuales por admins | ✅ |
| Avisos automáticos via bots / API | ✅ |
| Avisos fijados | ✅ |
| Formato enriquecido en avisos (markdown básico) | 🔜 |

---

## 9. Bots

| Requerimiento | Prioridad |
|--------------|-----------|
| Crear cuenta de bot | ✅ |
| Token de acceso para el bot | ✅ |
| Bot puede publicar en canales con permiso | ✅ |
| Bot puede publicar avisos | ✅ |
| Bot puede leer eventos (nuevos mensajes, etc.) | ✅ |
| Webhooks: recibir eventos en URL externa | ✅ |
| Permisos granulares por bot | ✅ |
| Bot puede responder mensajes | 🔜 |
| Bot puede moderar (expulsar, restringir) | 🔮 |
| Comandos de bot (`/comando`) | 🔜 |
| Bot Builder visual (sin código) | 🔮 |

---

## 10. API

| Requerimiento | Prioridad |
|--------------|-----------|
| API REST para bots | ✅ |
| Autenticación por token | ✅ |
| Endpoint: publicar mensaje en canal | ✅ |
| Endpoint: publicar aviso | ✅ |
| Endpoint: obtener información de comunidad | ✅ |
| Rate limiting | ✅ |
| Registro de actividad (logs) | ✅ |
| Webhooks salientes | ✅ |
| Documentación de la API | 🔜 |
| API pública con portal de developers | 🔮 |
| SDK oficial (Node.js, Python) | 🔮 |

---

## 11. Multimedia y archivos

| Requerimiento | Prioridad |
|--------------|-----------|
| Subir y enviar imágenes | ✅ |
| Subir y enviar archivos (PDF, ZIP, etc.) | ✅ |
| Subir y enviar audios | ✅ |
| Preview de imágenes | ✅ |
| Descarga de archivos | ✅ |
| Almacenamiento externo (Supabase Storage) | ✅ |
| Límite de tamaño por archivo (configurable) | ✅ |
| Subir y enviar videos | 🔜 |
| Compresión de imágenes automática | 🔜 |
| Stickers | 🔮 |
| GIFs animados | 🔮 |
| Mayor límite de tamaño en Premium | 🔮 |

---

## 12. Moderación y seguridad

| Requerimiento | Prioridad |
|--------------|-----------|
| Bloquear usuarios | ✅ |
| Reportar usuarios | ✅ |
| Reportar mensajes | ✅ |
| Expulsar de grupos y comunidades | ✅ |
| Rate limiting en la API | ✅ |
| Protección contra spam | ✅ |
| Validación de entradas | ✅ |
| Control de acceso por roles | ✅ |
| Logs de seguridad | ✅ |
| Sistema de revisión de reportes (admin) | 🔜 |
| Filtro de contenido automático | 🔮 |
| Verificación de identidad | 🔮 |

---

## 13. Lo que NO se hace en V1

| Función | Razón |
|---------|-------|
| Videollamadas | Complejidad alta, no es diferencial en V1 |
| Llamadas de voz | Idem |
| IA / asistente integrado | Fuera del alcance inicial |
| Sistema Premium completo | Se define después de validar el producto |
| Bot Builder visual | Primero validar que los bots via API funcionen |
| API pública con portal | Primero uso interno / bots propios |
| Infraestructura distribuida | No necesaria hasta escalar |
| Funciones empresariales | No es el foco inicial |
| Stickers / GIFs | Nice to have, no crítico |

---

*Siguiente etapa: [03_ARCHITECTURE.md](./03_ARCHITECTURE.md)*
