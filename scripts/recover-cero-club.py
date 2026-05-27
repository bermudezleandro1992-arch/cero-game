#!/usr/bin/env python3
"""Download Cero Club static site from Firebase Hosting without SPA junk."""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

BASE = "https://cero-club.web.app"
ROOT = Path(__file__).resolve().parent.parent / "cero-club"
ROOT.mkdir(parents=True, exist_ok=True)

SEED_PATHS = [
    "/",
    "/index.html",
    "/login.html",
    "/app/",
    "/app/index.html",
    "/css/hub.css",
    "/css/login.css",
    "/js/auth.js",
    "/js/firebase-hub.js",
    "/js/hub.js",
    "/js/matchmaking.js",
    "/js/room-lifecycle.js",
    "/js/room-prizes.js",
    "/js/match-rewards.js",
    "/js/hub-chat.js",
    "/js/cero-wallet.js",
    "/js/friends-social.js",
    "/js/profile-avatar.js",
    "/js/tournament-bracket.js",
    "/games/cero/index.html",
    "/games/cero/spectate.html",
    "/games/cero/css/cero.css",
    "/games/cero/js/cards.js",
    "/games/cero/js/game.js",
    "/games/cero/js/cero-turn-timer.js",
    "/games/cero/js/cero-table-skins.js",
    "/games/cero/js/cero-throws.js",
    "/games/cero/js/cero-chat.js",
    "/games/cero/js/cero-colyseus.js",
    "/games/cero/js/cero-online.js",
    "/games/cero/js/cero-host-server.js",
    "/games/cero/js/ui.js",
    "/games/cero/js/cero-drag.js",
    "/games/cero/js/main.js",
    "/js/voice.js",
    "/games/truco/js/voice.js",
    "/games/chinchon/index.html",
    "/legal/reglamento-oficial.pdf",
    "/legal/terminos-condiciones-reembolso.pdf",
    "/legal/terminos-reembolsos-integral.pdf",
]

ASSET_RE = re.compile(
    r"""(?:src|href)=["']([^"']+\.(?:js|css|html|png|jpg|jpeg|webp|svg|gif|pdf|woff2?|mp3|wav|json))(?:\?[^"']*)?["']""",
    re.I,
)


def resolve_link(base_path: str, url: str) -> str | None:
    url = url.split("?")[0]
    if url.startswith("http://") or url.startswith("https://"):
        parsed = urlparse(url)
        if parsed.netloc not in ("cero-club.web.app", "cero-club.firebaseapp.com", ""):
            return None
        path = parsed.path.lstrip("/")
    elif url.startswith("/"):
        path = url.lstrip("/")
    else:
        base_dir = Path(base_path).parent
        path = str((base_dir / url).as_posix())
        path = path.removeprefix("./")
    if path.endswith("/"):
        path += "index.html"
    return path


def fetch(path: str) -> tuple[bytes, str] | None:
    url = f"{BASE}/{path}" if not path.startswith("http") else path
    if not url.startswith(BASE):
        return None
    req = Request(url, headers={"User-Agent": "cero-club-recovery/1.0"})
    try:
        with urlopen(req, timeout=30) as resp:
            ctype = resp.headers.get("Content-Type", "")
            data = resp.read()
    except Exception as exc:
        print(f"  skip {path}: {exc}", file=sys.stderr)
        return None

    lower = path.lower()
    if "text/html" in ctype:
        is_html_path = lower.endswith(".html") or lower.endswith("/") or lower == "index.html"
        if not is_html_path:
            print(f"  skip SPA fallback ({ctype}): {path}", file=sys.stderr)
            return None
    return data, ctype


def save(path: str, data: bytes) -> None:
    dest = ROOT / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    print(f"  + {path} ({len(data)} bytes)")


def extract_links(path: str, data: bytes) -> set[str]:
    text = data.decode("utf-8", errors="ignore")
    found: set[str] = set()
    for match in ASSET_RE.finditer(text):
        norm = resolve_link(path, match.group(1))
        if norm:
            found.add(norm)
    # Vite app assets
    for match in re.finditer(r"""["'](/app/assets/[^"']+)["']""", text):
        norm = resolve_link(path, match.group(1))
        if norm:
            found.add(norm)
    return found


def main() -> None:
    queue: list[str] = []
    seen: set[str] = set()

    for seed in SEED_PATHS:
        norm = resolve_link("", seed if seed.startswith("/") else f"/{seed}")
        if norm and norm not in seen:
            seen.add(norm)
            queue.append(norm)

    while queue:
        path = queue.pop(0)
        result = fetch(path)
        if result is None:
            continue
        data, _ctype = result
        save(path, data)
        for link in extract_links(path, data):
            if link not in seen:
                seen.add(link)
                queue.append(link)

    print(f"\nDone: {len(list(ROOT.rglob('*')))} paths under {ROOT}")


if __name__ == "__main__":
    main()
