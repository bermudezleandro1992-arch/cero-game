# Cero Game

Juego multijugador de **Cero Mata Cero** (tres en raya) en tiempo real con Firebase.

## Problemas corregidos

- **Error de conexión al unirse:** la sala se crea en Firestore antes de navegar y el join usa transacciones atómicas con manejo de errores en listeners.
- **No poder volver a la sala:** al salir solo se marca `connected: false` (no se borra la sala ni el jugador), permitiendo reconexión con el mismo usuario.
- **Contador 2/2 duplicado:** los jugadores se identifican por `uid` de Firebase Auth; un mismo usuario reconecta en lugar de agregarse dos veces.

## Requisitos

- Node.js 18+
- Proyecto Firebase con **Authentication** (Anónimo habilitado) y **Firestore**

## Configuración

1. Copiá `.env.example` a `.env` y completá las variables `VITE_FIREBASE_*`.
2. Instalá dependencias:

```bash
npm install
```

3. Desplegá reglas de Firestore:

```bash
npx firebase-tools deploy --only firestore:rules
```

4. Ejecutá en desarrollo:

```bash
npm run dev
```

## Flujo de salas

1. **Jugar ahora** → crea sala con código de 6 dígitos y te registra como jugador X.
2. Otro jugador ingresa el código → join atómico, asignación de símbolo O, estado `playing` cuando hay 2 conectados.
3. **Salir** → marca desconectado; podés volver con el mismo usuario.
4. **Volver al lobby / Entrar al juego** → no desconecta al cambiar de pantalla.

## Deploy (Vercel)

Configurá las mismas variables `VITE_FIREBASE_*` en el panel de Vercel y conectá el repositorio.
