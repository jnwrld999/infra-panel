#!/bin/bash
# InfraPanel — Local Ubuntu Setup
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "╔══════════════════════════════════╗"
echo "║     InfraPanel Setup v1.0.0      ║"
echo "╚══════════════════════════════════╝"
echo ""

# System packages
echo "→ Prüfe System-Pakete..."
MISSING=()
for cmd in python3 pip3 node npm rsync curl git; do
  command -v "$cmd" &>/dev/null || MISSING+=("$cmd")
done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "  Installiere: ${MISSING[*]}"
  sudo apt-get update -qq
  sudo apt-get install -y python3 python3-pip python3-venv nodejs npm rsync curl git -q
fi

# Node 18+
NODE_VER=$(node -e "console.log(process.versions.node.split('.')[0])" 2>/dev/null || echo "0")
if [ "$NODE_VER" -lt 18 ]; then
  echo "  Aktualisiere Node.js auf v20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - -q
  sudo apt-get install -y nodejs -q
fi

# Python venv
echo "→ Python-Umgebung einrichten..."
[ ! -d "venv" ] && python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -q
echo "  Python-Packages: OK"

# DB migration
echo "→ Datenbank initialisieren..."
alembic upgrade head 2>&1 | tail -1
echo "  Datenbank: OK"

# .env
echo "→ Konfiguration prüfen..."
if [ ! -f ".env" ]; then
  cp .env.example .env
  FERNET_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
  SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  sed -i "s|run_python_generate_key|$FERNET_KEY|" .env
  sed -i "s|change_this_to_32_random_bytes_hex|$SECRET_KEY|" .env
  sed -i "s|change_this_random_secret|$JWT_SECRET|" .env
  echo ""
  echo "  ┌─────────────────────────────────────────┐"
  echo "  │ .env wurde erstellt. Bitte eintragen:   │"
  echo "  │   DISCORD_BOT_TOKEN=<dein token>        │"
  echo "  │   DISCORD_CLIENT_SECRET=<oauth secret>  │"
  echo "  └─────────────────────────────────────────┘"
else
  echo "  .env: vorhanden"
fi

# Frontend
echo "→ Frontend bauen..."
cd "$PROJECT_DIR/frontend"
npm install -q --silent
npm run build --silent
echo "  Frontend: OK (dist/ erstellt)"

# Electron
echo "→ Electron bauen..."
cd "$PROJECT_DIR/electron"
npm install -q --silent
npm run build --silent
echo "  Electron: OK"

echo ""
echo "╔══════════════════════════════════╗"
echo "║     Setup abgeschlossen! ✓       ║"
echo "╚══════════════════════════════════╝"
echo ""
echo "Starten:"
echo "  ./scripts/start.sh          # Alle Komponenten"
echo "  ./scripts/start-electron.sh # Desktop-App"
