#!/bin/bash
# InfraPanel — Start as Electron Desktop App
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

source venv/bin/activate

# Backend
uvicorn backend.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Frontend
cd frontend && npm run dev &
FRONTEND_PID=$!
cd "$PROJECT_DIR"

sleep 3
echo "[InfraPanel] Starte Electron..."
cd electron && npm start

kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
