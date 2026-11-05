#!/data/data/com.termux/files/usr/bin/bash
set -e
cd "$(dirname "$0")"

PORT="${1:-8080}"
URL="http://localhost:${PORT}/"

echo "WifiPro demarre sur ${URL}"
echo "Ouvrez cette adresse dans Chrome, puis menu > Ajouter a l'ecran d'accueil."
echo "Appuyez sur Ctrl+C pour arreter."

if command -v termux-open-url >/dev/null 2>&1; then
  (sleep 1; termux-open-url "$URL") >/dev/null 2>&1 &
fi

exec python3 -m http.server "$PORT" --bind 127.0.0.1
