#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Generando .env desde Firebase SDK config..."
  CONFIG_JSON="$(npx -y firebase-tools@latest apps:sdkconfig WEB --json 2>/dev/null || true)"
  if [[ -z "$CONFIG_JSON" ]]; then
    echo "No se pudo obtener la config. Creá .env manualmente desde .env.example"
    exit 1
  fi

  python3 - <<'PY' "$CONFIG_JSON" > .env
import json, sys
data = json.loads(sys.argv[1])
result = data["result"] if isinstance(data, dict) and "result" in data else data
mapping = {
    "apiKey": "VITE_FIREBASE_API_KEY",
    "authDomain": "VITE_FIREBASE_AUTH_DOMAIN",
    "projectId": "VITE_FIREBASE_PROJECT_ID",
    "storageBucket": "VITE_FIREBASE_STORAGE_BUCKET",
    "messagingSenderId": "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "appId": "VITE_FIREBASE_APP_ID",
}
for src, dst in mapping.items():
    if src in result:
        print(f"{dst}={result[src]}")
PY
fi

npm run build
npx -y firebase-tools@latest deploy --only hosting,firestore:rules

echo ""
echo "Deploy completado."
echo "Hosting: https://cero-game.web.app (o tu dominio de Firebase Hosting)"
