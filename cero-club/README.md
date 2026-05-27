# Cero Club (recuperado desde Firebase Hosting)

Código recuperado el **2026-05-27** desde `https://cero-club.web.app` con el script `scripts/recover-cero-club.py`.

## Qué incluye

- Hub principal (`index.html`, `js/hub.js`, matchmaking, salas, wallet, amigos)
- Juego **Cero** online (`games/cero/`) con Firestore
- Login (`login.html`, `js/auth.js`)
- App compilada (`app/`) — build Vite minificado
- PDFs legales (`legal/`)

## Qué NO está en Hosting (falta en este snapshot)

Estos archivos existían en desarrollo pero **no están publicados** en Firebase (el servidor devuelve el HTML del hub):

- `games/truco/` — juego Truco completo
- `games/uno/` — UNO 3D
- `games/chinchon/`
- `games/cero/js/cero-colyseus.js`
- `games/cero/js/cero-host-server.js`
- `games/truco/js/voice.js`

Cuando tengas tu PC, conviene mergear esta carpeta con tu fuente local.

## Deploy

```bash
cd cero-club
npx firebase-tools use cero-club
npx firebase-tools deploy --only hosting
```

## Regenerar desde Firebase

```bash
python3 scripts/recover-cero-club.py
```
