# 01 — Product Specification

**Nombre:** Mi Mensajero
**Estado:** Definición inicial del producto
**Versión del documento:** 0.1
**Plataforma inicial:** PWA (Progressive Web App) → APK nativa en etapa posterior

---

## Objetivo

Crear una plataforma de mensajería moderna, simple y gratuita, combinando las mejores características de WhatsApp, Telegram y herramientas de comunidades, con una API abierta para bots e integraciones.

---

## 1. Visión del producto

Mi Mensajero será una plataforma de comunicación y comunidades que permita a las personas:

- Hablar individualmente con otras personas.
- Crear grupos.
- Crear y participar en comunidades.
- Organizar actividades, trabajos, torneos y eventos.
- Compartir mensajes, imágenes, videos, audios y archivos.
- Utilizar un nombre de usuario `@usuario`.
- Comunicarse sin necesidad de compartir el número telefónico públicamente.
- Crear bots.
- Integrar páginas web y servicios externos mediante una API.
- Automatizar anuncios y avisos dentro de grupos y comunidades.

La aplicación debe ser sencilla de utilizar como WhatsApp, pero ofrecer una estructura de comunidades y herramientas de automatización más cercana a Telegram/Discord.

---

## 2. Objetivo inicial

El objetivo inicial **NO** es competir inmediatamente con WhatsApp a escala mundial.

El primer objetivo es construir una versión funcional que pueda utilizar un grupo pequeño de usuarios reales.

**Primera prueba:**
- Fundador / desarrollador.
- Pareja del fundador.
- Amigos.
- Grupo de eFootball.
- Otros usuarios invitados.

El producto debe poder probarse inicialmente con aproximadamente **5–20 usuarios** sin necesidad de infraestructura costosa.

Sin embargo, las decisiones de arquitectura deben evitar problemas innecesarios cuando el proyecto crezca hasta 1.000+ usuarios.

---

## 3. Principios del producto

### 3.1 Simplicidad
La aplicación debe ser fácil de entender para una persona acostumbrada a WhatsApp. No se debe sacrificar la facilidad de uso para agregar funciones innecesarias.

### 3.2 Comunidades como diferencial
Mi Mensajero no debe ser solamente otro mensajero. Las comunidades serán uno de los principales diferenciales frente a WhatsApp y Telegram.

### 3.3 API abierta
Mi Mensajero debe permitir que desarrolladores y páginas externas puedan crear integraciones y bots. La API comenzará siendo gratuita para facilitar la adopción.

### 3.4 Gratis para comenzar
Las funciones básicas de comunicación deben estar disponibles gratuitamente. Las funciones premium podrán agregarse posteriormente.

### 3.5 Preparado para crecer
La primera versión debe ser sencilla, pero no debe construirse de manera que obligue a reescribir todo el sistema al alcanzar 1.000+ usuarios.

---

## 4. Plataforma

| Etapa | Plataforma | Descripción |
|-------|-----------|-------------|
| V1 — MVP | PWA | Funciona en cualquier navegador mobile/desktop. Sin pasar por tiendas. Instalable en la pantalla de inicio. |
| V2 | APK (Android) | App nativa para distribución directa o Google Play. |
| V3 | iOS | App nativa para App Store. |

La PWA permite lanzar rápido, testear con usuarios reales y evitar el overhead de publicar en tiendas durante la etapa experimental.

---

## 5. Registro y cuentas

El registro principal será mediante número de teléfono.

**Flujo inicial:**
1. Usuario abre Mi Mensajero (PWA).
2. Introduce su número telefónico.
3. Recibe un código de verificación (SMS o llamada).
4. Introduce el código.
5. Se crea / verifica la cuenta.
6. El usuario configura su perfil.

También se podrá asociar un correo electrónico a la cuenta, para:
- Recuperación de cuenta.
- Notificaciones.
- Seguridad y gestión de cuenta.

El número telefónico continuará siendo el identificador principal de registro.

---

## 6. Nombre de usuario

Cada usuario podrá tener un nombre de usuario único: `@usuario`

Esto permitirá que una persona pueda ser encontrada o contactada sin necesidad de compartir públicamente su número de teléfono.

El sistema deberá contemplar:
- Nombre de usuario único.
- Cambio de nombre de usuario sujeto a límites.
- Validación de nombres reservados.
- Protección contra suplantación.
- Búsqueda por `@usuario`.
- Configuración de privacidad relacionada con el descubrimiento del usuario.

El número de teléfono **nunca** deberá exponerse innecesariamente a otros usuarios.

---

## 7. Perfil

Cada usuario tendrá un perfil con:

**Información inicial:**
- Foto de perfil.
- Nombre.
- `@usuario`.
- Descripción / bio.
- Número de teléfono (privado).
- Email (privado).
- Estado / biografía opcional.

**Información futura:**
- Estados (tipo stories).
- Insignias.
- Perfil premium.
- Enlaces.
- Información adicional.

---

## 8. Chat privado

La primera versión debe permitir conversaciones individuales.

**Funciones objetivo:**
- Mensajes de texto y emojis.
- Responder mensajes.
- Reacciones.
- Editar mensajes.
- Eliminar mensajes.
- Copiar / reenviar mensajes.
- Mensajes fijados.
- Fotos, videos, audios y archivos.
- Compartir enlaces.
- Indicador de escritura.
- Estado de entrega y lectura (✓ / ✓✓ / ✓✓ azul).
- Notificaciones.
- Búsqueda dentro de conversaciones.
- Historial paginado.

La interfaz debe ser familiar para usuarios de WhatsApp.

---

## 9. Grupos

Grupos similares a WhatsApp, pero con mayores posibilidades de administración.

**Funciones iniciales:**
- Crear grupo (nombre, imagen, descripción).
- Administradores, moderadores y miembros.
- Invitaciones y enlace de invitación.
- Permisos configurables.
- Mensajes fijados.
- Respuestas y reacciones.
- Encuestas.
- Compartir archivos.
- Moderación: bloqueo, expulsión, restricción de miembros.

**Roles (diseño flexible para extensión futura):**

| Rol | Descripción |
|-----|------------|
| Administrador | Control total del grupo. |
| Moderador | Gestión de miembros y contenido. |
| Miembro | Usuario estándar. |
| Bot | Cuenta automatizada con permisos específicos. |

---

## 10. Comunidades

Las comunidades serán una función central de Mi Mensajero y el principal diferencial frente a la competencia.

Una comunidad organiza diferentes conversaciones y espacios bajo una misma estructura.

**Ejemplo — Comunidad: eFootball Argentina**
```
📢 Avisos
💬 General
🏆 Torneos
🎮 eFootball
📰 Noticias
🔄 Intercambios
🎧 Soporte
```

**La comunidad podrá tener:**
- Administradores y moderadores.
- Grupos / canales organizados.
- Espacio de avisos.
- Reglas e información.
- Eventos.
- Bots.
- Integraciones externas.

---

## 11. Avisos de comunidad

Las comunidades tendrán un espacio especial para anuncios.

Los administradores podrán publicar anuncios manualmente, y también podrán existir anuncios automatizados mediante bots / API.

---

## 12. Caso de uso principal: torneos de eFootball

Uno de los primeros casos de uso reales será una comunidad de eFootball.

**Flujo ejemplo:**
1. Un sitio web externo publica un nuevo torneo.
2. Una integración detecta la información.
3. Un bot utiliza la API de Mi Mensajero.
4. El bot publica automáticamente el aviso en `#avisos` de la comunidad.
5. Los miembros reciben la notificación.

Este caso de uso permitirá probar el sistema completo (mensajería + comunidades + bots + API) con usuarios reales desde las primeras versiones.

---

## 13. Bots

Mi Mensajero tendrá soporte nativo para bots.

Un bot es una cuenta especial controlada mediante API.

**Ejemplos:**
- Bot de torneos.
- Bot de noticias y resultados.
- Bot de moderación.
- Bot de eventos y estadísticas.
- Bot de notificaciones.

Los bots podrán interactuar con grupos y comunidades según los permisos otorgados.

---

## 14. API

Mi Mensajero tendrá una API para desarrolladores.

**La API permitirá:**
- Crear y enviar mensajes.
- Publicar avisos en comunidades.
- Leer eventos permitidos.
- Recibir webhooks.
- Gestionar bots.
- Automatizar publicaciones.
- Integrar sistemas externos.

**La API deberá incluir:**
- Autenticación y tokens.
- Permisos granulares.
- Rate limiting.
- Límites gratuitos razonables.
- Webhooks.
- Documentación.
- Registro de actividad.
- Protección contra abuso.

La API será inicialmente gratuita con límites razonables.

```
Página web
    │
    │ API
    ▼
Mi Mensajero Bot
    │
    ▼
Comunidad
    │
    ▼
📢 Avisos
```

---

## 15. Bot Builder (fase futura)

En una fase posterior se podrá crear un sistema visual para crear bots sin programar.

```
EVENTO: Nuevo torneo encontrado
    ↓
CONDICIÓN: Es un torneo de eFootball
    ↓
ACCIÓN: Publicar en #avisos
    ↓
MENSAJE:
🏆 Nuevo torneo disponible
📅 Fecha: ...
🎮 Modalidad: ...
📝 Inscripción: ...
```

---

## 16. Multimedia

La plataforma soportará progresivamente:
- Fotos e imágenes.
- Videos.
- Audios (mensajes de voz).
- Documentos y archivos.
- Stickers y GIFs.

Los archivos grandes se almacenarán en almacenamiento objeto (S3-compatible) y los mensajes guardarán únicamente la referencia / metadata.

---

## 17. Notificaciones

**Eventos que generan notificación:**
- Nuevo mensaje.
- Mención `@usuario`.
- Respuesta a un mensaje propio.
- Invitación a grupo o comunidad.
- Aviso de comunidad.
- Actividad de bot relevante.

El sistema debe permitir que cada usuario configure qué notificaciones recibe.

---

## 18. Privacidad

El sistema deberá permitir controlar:
- Quién puede encontrar al usuario.
- Quién puede enviarle mensajes.
- Quién puede agregarlo a grupos.
- Quién puede ver determinada información de perfil.
- Visibilidad del estado y actividad.
- Bloqueos.

El número telefónico no debe mostrarse públicamente por defecto.

---

## 19. Seguridad

La seguridad debe diseñarse desde el comienzo.

**Se deberá contemplar:**
- Autenticación segura (OTP por SMS).
- Autorización por roles y permisos.
- Protección de sesiones (tokens JWT con refresh).
- Protección de APIs (rate limiting, tokens).
- Protección contra spam y abuso.
- Validación de entradas.
- Control de permisos granular.
- Protección de archivos (acceso firmado).
- Logs de seguridad.
- Sistema de reportes de usuarios.
- Bloqueo de usuarios.
- Moderación.

**Sobre cifrado E2E:**
El cifrado de extremo a extremo deberá analizarse y diseñarse antes de implementar una versión definitiva de mensajería privada. No se inventarán algoritmos criptográficos propios — se usarán estándares establecidos (Signal Protocol o similar).

---

## 20. Premium (fase futura)

El producto será inicialmente gratuito. Posteriormente podrá incorporar un sistema Premium con:
- Mayor almacenamiento y archivos más grandes.
- Personalización avanzada (temas, etc.).
- Funciones avanzadas para comunidades y administradores.
- Bots avanzados y mayor límite de API.
- Automatizaciones.
- Funciones de IA.
- Backup ampliado.

Las funciones básicas de mensajería **nunca** se bloquearán detrás de un pago.

---

## 21. Estrategia de lanzamiento

El proyecto no se lanzará como reemplazo directo de WhatsApp.

La primera estrategia es conseguir comunidades específicas con un caso de uso real.

**Primer caso de prueba: Comunidad de eFootball**

1. Crear comunidad.
2. Crear grupos / canales.
3. Invitar usuarios.
4. Probar mensajes y avisos.
5. Probar torneos.
6. Probar moderación.
7. Crear primer bot.
8. Integrar una fuente externa.
9. Publicar automáticamente información de torneos.

Si la experiencia funciona, el sistema podrá extenderse a: gaming, deportes, colegios, universidades, clubes, equipos, organizaciones, empresas, comunidades de creadores.

---

## 22. Principio de crecimiento

```
5 usuarios → 20 → 100 → 500 → 1.000+
```

Cada etapa deberá medirse antes de aumentar infraestructura. La arquitectura debe permitir escalar progresivamente sin reescribir el núcleo del producto.

---

## 23. Primera versión funcional — Prioridades

1. Registro con número de teléfono.
2. Perfil y `@usuario`.
3. Chat privado y mensajes.
4. Notificaciones.
5. Grupos.
6. Comunidades.
7. Avisos de comunidad.
8. Administración básica.
9. Fotos y archivos básicos.
10. Sistema de bloqueo y reportes.
11. Base para bots / API.

---

## 24. Fuera del alcance del primer prototipo

No se intentará implementar en V1:
- Videollamadas o llamadas de voz.
- IA compleja.
- Sistema Premium completo.
- Bot Builder visual.
- API pública completa con documentación.
- Infraestructura distribuida.
- Funciones empresariales avanzadas.

Estas funciones quedan en el roadmap pero no bloquean el MVP.

---

## 25. Criterios de éxito del MVP

El MVP se considera exitoso cuando:

- [ ] Usuarios reales pueden registrarse y crear perfiles.
- [ ] Pueden encontrarse mediante `@usuario`.
- [ ] Pueden enviarse mensajes que llegan correctamente.
- [ ] Las notificaciones funcionan.
- [ ] Se pueden crear grupos que funcionan correctamente.
- [ ] Se puede crear una comunidad con espacios de conversación y avisos.
- [ ] Los administradores pueden moderar.
- [ ] La aplicación puede utilizarse diariamente por un pequeño grupo real.
- [ ] No existen errores críticos conocidos.
- [ ] Los datos están protegidos mediante controles de acceso adecuados.
- [ ] El sistema puede soportar al menos 1.000 usuarios con una estrategia de escalamiento razonable.

---

## 26. Filosofía general

Mi Mensajero no debe intentar ganar por tener más funciones que todos los demás.

Debe ganar por combinar:

> **La simplicidad de WhatsApp**
> \+
> **Las posibilidades de Telegram**
> \+
> **La organización de comunidades**
> \+
> **Una API abierta para bots e integraciones**
> \+
> **Un modelo gratuito con funciones Premium opcionales**

El producto debe sentirse sencillo para un usuario normal, pero ofrecer herramientas potentes para comunidades y desarrolladores.

---

*Siguiente etapa: [02_REQUIREMENTS.md](./02_REQUIREMENTS.md)*
