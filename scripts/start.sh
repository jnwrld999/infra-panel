#!/bin/bash
# InfraPanel — Start all components
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

source venv/bin/activate

echo "[InfraPanel] Starte Backend..."
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo "[InfraPanel] Starte Frontend Dev-Server..."
cd frontend && npm run dev &
FRONTEND_PID=$!
cd "$PROJECT_DIR"

echo "[InfraPanel] Starte Discord Bot..."
python3 backend/run_bot.py &
BOT_PID=$!

sleep 2
echo ""
echo "╔══════════════════════════════════╗"
echo "║     InfraPanel läuft!            ║"
echo "╠══════════════════════════════════╣"
echo "║  Web:   http://localhost:3000    ║"
echo "║  API:   http://localhost:8000    ║"
echo "║  Docs:  http://localhost:8000/api/docs ║"
echo "╚══════════════════════════════════╝"
echo ""
echo "Beenden mit Ctrl+C"

trap "echo ''; echo 'Beende...'; kill $BACKEND_PID $FRONTEND_PID $BOT_PID 2>/dev/null; exit 0" INT TERM
wait
