# Mi Mensajero

Plataforma de mensajería moderna — la simplicidad de WhatsApp con las posibilidades de Telegram y comunidades organizadas.

## Documentación

| Documento | Descripción |
|-----------|-------------|
| [01_PRODUCT.md](./docs/01_PRODUCT.md) | Visión del producto, principios y criterios de éxito |
| [02_REQUIREMENTS.md](./docs/02_REQUIREMENTS.md) | Requerimientos por prioridad (V1 / Post-MVP / Futuro) |
| [03_ARCHITECTURE.md](./docs/03_ARCHITECTURE.md) | Arquitectura técnica y stack |
| [04_DATABASE.md](./docs/04_DATABASE.md) | Modelo de base de datos |

## Stack

- React + Vite
- Tailwind CSS
- Supabase (auth, DB, realtime)
- Vercel (deploy)

## Desarrollo

```bash
cp .env.example .env   # completar con credenciales de Supabase
npm install
npm run dev
```
