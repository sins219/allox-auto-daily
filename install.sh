#!/usr/bin/env bash
# Install dependencies for the Allox Auto Bot (JS edition).
# Usage:  bash install.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[install] Node version: $(node --version 2>/dev/null || echo 'NOT FOUND')"
if ! command -v node >/dev/null 2>&1; then
  echo "[install] Node.js is not installed. Get it from https://nodejs.org (v18+)."
  exit 1
fi

echo "[install] Installing npm dependencies ..."
npm install

echo "[install] Done. Next steps:"
echo "  cp accounts.txt.example accounts.txt   # then add your private keys"
echo "  (optional) cp proxy.txt.example proxy.txt"
echo "  (optional) cp .env.example .env         # for Telegram reports"
echo "  node bot.js"
