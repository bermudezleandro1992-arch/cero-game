# 03 — Arquitectura y Stack Técnico

**Versión:** 0.1
**Estado:** Definido para MVP

---

## Stack

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Frontend / PWA | **React + Vite** | Simple, rápido de arrancar, ideal para apps SPA detrás de login. Escala bien. |
| Estilos | **Tailwind CSS** | Desarrollo rápido, mobile-first. |
| Estado global | **Zustand** | Liviano, suficiente para manejar chats, usuario y sesión. |
| Backend / DB | **Supabase** | PostgreSQL + Auth + Realtime (WebSockets) + Storage. Reemplaza un backend propio completo. |
| Deploy frontend | **Vercel** | Deploy automático desde GitHub. CDN global. HTTPS gratis. |
| Push notifications | **FCM** (Firebase Cloud Messaging) | Solo para notificaciones push en PWA y APK. Única pieza de Firebase. |
| Repositorio / CI | **GitHub** | Control de versiones + deploy automático a Vercel. |
| APK (fase 2) | **Capacitor** | Convierte la PWA/React app en APK sin reescribir código. |

---

## Por qué React + Vite y no Next.js

- Mi Mensajero es una app privada detrás de login. No necesita SSR ni SEO.
- Next.js agrega complejidad que no aporta valor en esta etapa.
- Vite arranca en segundos y el bundle es más simple de razonar.
- Si en el futuro se necesita una landing pública o SEO, se puede agregar Next.js solo para esas rutas, manteniendo la app en React.

---

## Por qué Supabase y no backend propio

- Para 5–1.000 usuarios no tiene sentido mantener servidores propios.
- Supabase provee: autenticación, base de datos relacional, realtime via WebSockets, storage de archivos — todo integrado.
- Capa gratuita generosa para las primeras etapas.
- Si el proyecto crece, se puede migrar gradualmente sin reescribir el núcleo.

---

## Flujo de plataformas

```
V1 — MVP
  React + Vite → PWA (instalable en móvil desde el navegador)
  Deploy: Vercel

V2 — APK Android
  Mismo código React → Capacitor → APK
  Distribución directa o Google Play

V3 — iOS
  Mismo código → Capacitor → App Store
```

---

## Diagrama general

```
Usuario (PWA / APK)
        │
        │ HTTPS
        ▼
    Vercel CDN
    (React + Vite)
        │
        │ Supabase Client (SDK)
        ▼
    Supabase
    ├── Auth (OTP SMS / email)
    ├── PostgreSQL (mensajes, usuarios, grupos, comunidades)
    ├── Realtime (WebSockets — mensajes en tiempo real)
    └── Storage (fotos, archivos, audios)
        │
        │ (notificaciones push)
        ▼
    FCM (Firebase Cloud Messaging)

Bots / Integraciones externas
        │
        │ API REST
        ▼
    Supabase Edge Functions (o API propia futura)
```

---

## Decisiones pendientes

- Definir si los Edge Functions de Supabase son suficientes para la lógica de bots o si se necesita un servicio Node.js separado.
- Evaluar proveedor de SMS para OTP (Twilio, Vonage, etc.).
- Definir estrategia de cifrado E2E para mensajes privados.

---

*Ver decisiones detalladas en [13_DECISIONS.md](./13_DECISIONS.md)*
