#!/usr/bin/env bash
# Despliega CERO Club a Firebase Hosting (proyecto cero-club)
set -euo pipefail
cd "$(dirname "$0")"
echo "→ Proyecto: cero-club"
echo "→ Carpeta: $(pwd)"
npx -y firebase-tools@latest use cero-club
npx -y firebase-tools@latest deploy --only hosting
echo ""
echo "✓ Deploy listo. Probá: https://cero-club.web.app/app/?v=2026052837"
