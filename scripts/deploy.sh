#!/bin/bash
# Deploy InfraPanel to remote server
set -e
SERVER="root@45.13.227.179"
REMOTE_DIR="/root/infra-panel"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "╔══════════════════════════════════════════╗"
echo "║  InfraPanel Deploy → panel.galaxycraft.cc ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Build frontend locally first
echo "→ Frontend bauen..."
cd "$PROJECT_DIR/frontend"
npm run build --silent
echo "  Frontend: OK"
cd "$PROJECT_DIR"

# rsync to server (exclude secrets and cache)
echo "→ Dateien synchronisieren..."
rsync -avz --progress \
  --exclude '.env' \
  --exclude 'venv/' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude '*.pyc' \
  --exclude 'node_modules/' \
  --exclude '.git/' \
  --exclude 'infra-panel.db' \
  --exclude 'infra-panel.db-shm' \
  --exclude 'infra-panel.db-wal' \
  --exclude 'logs/' \
  "$PROJECT_DIR/" "$SERVER:$REMOTE_DIR/"

echo "→ Remote-Setup..."
ssh "$SERVER" "
  cd $REMOTE_DIR
  [ ! -d venv ] && python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt -q
  alembic upgrade head
  mkdir -p logs

  # Nginx
  cp nginx/infra-panel.conf /etc/nginx/sites-available/infra-panel
  ln -sf /etc/nginx/sites-available/infra-panel /etc/nginx/sites-enabled/infra-panel
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  nginx -t && systemctl reload nginx

  # PM2
  pm2 delete infra-panel-backend 2>/dev/null || true
  pm2 delete infra-panel-bot 2>/dev/null || true
  pm2 start ecosystem.config.js
  pm2 save

  echo 'Remote-Setup: OK'
"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Deploy abgeschlossen! ✓                 ║"
echo "╠══════════════════════════════════════════╣"
echo "║  Panel: https://panel.galaxycraft.cc     ║"
echo "║                                          ║"
echo "║  Falls HTTPS fehlt, ausführen:           ║"
echo "║  ./scripts/setup-ssl.sh                  ║"
echo "╚══════════════════════════════════════════╝"
