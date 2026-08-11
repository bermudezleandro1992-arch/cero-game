# Mi Mensajero — Contexto para Claude Code

## Qué es este proyecto

Mi Mensajero es una plataforma de mensajería y comunidades.
Combina la simplicidad de WhatsApp con las posibilidades de Telegram y una API abierta para bots.

## Documentación principal

Antes de escribir código, leer en orden:

1. [docs/01_PRODUCT.md](./docs/01_PRODUCT.md) — Visión, principios y MVP
2. [docs/02_REQUIREMENTS.md](./docs/02_REQUIREMENTS.md) — Requerimientos por prioridad
3. [docs/03_ARCHITECTURE.md](./docs/03_ARCHITECTURE.md) — Stack y arquitectura
4. [docs/04_DATABASE.md](./docs/04_DATABASE.md) — Modelo de datos
5. [docs/13_DECISIONS.md](./docs/13_DECISIONS.md) — Decisiones tomadas y su razonamiento

## Principios de desarrollo

- Empezar simple. No construir para millones desde el día uno.
- La arquitectura debe permitir escalar sin reescribir el núcleo.
- Las funciones básicas de mensajería siempre deben ser gratuitas.
- No inventar algoritmos criptográficos propios.
- La PWA es la plataforma inicial. El código debe ser mobile-first.

## Caso de uso primario para testear

Comunidad de eFootball con bots que publican información de torneos automáticamente.
