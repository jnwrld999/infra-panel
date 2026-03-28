# InfraPanel

A self-hosted infrastructure management panel for Discord bots, servers, and plugins.

## Features

- **Bot Management** — Monitor, manage and configure Discord bots
- **Plugin System** — View, enable/disable Discord bot cogs (Python, Node.js)
- **Embed Builder** — Visual Discord embed creator with live preview and send
- **Server Monitoring** — Track server status and SSH connections
- **User Management** — Role-based access control with Discord OAuth2
- **Multi-Theme** — 11 color themes (Dark, Dracula, Catppuccin, Tokyo Night, and more)
- **Desktop App** — Electron wrapper for Windows and Linux

## Installation (Desktop App)

### Windows

1. Download `install-infrapanel.bat` from the [latest release](https://github.com/jnwrld999/infra-panel/releases/latest)
2. Run the `.bat` file — it will automatically download and launch InfraPanel
3. If Windows SmartScreen appears, click "More info" → "Run anyway"

> **If the installer fails:** Download the `.zip` file directly from [Releases](https://github.com/jnwrld999/infra-panel/releases/latest), extract it, and run `InfraPanel.exe`

### Linux

1. Download `install-infrapanel.sh` from the [latest release](https://github.com/jnwrld999/infra-panel/releases/latest)
2. Make it executable and run:
   ```bash
   chmod +x install-infrapanel.sh
   ./install-infrapanel.sh
   ```
3. The AppImage will be saved to `~/Downloads/` and launched automatically

> **Manual install:** Download the `.AppImage` file, run `chmod +x InfraPanel-*.AppImage` then `./InfraPanel-*.AppImage --no-sandbox`

## Self-Hosting (Backend)

### Requirements

- Python 3.10+
- Node.js 18+
- SQLite
- Nginx (for reverse proxy)

### Setup

```bash
# Clone the repository
git clone https://github.com/jnwrld999/infra-panel.git
cd infra-panel

# Backend
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
# Edit .env with your Discord OAuth2 credentials

# Frontend
cd frontend
npm install
npm run build
cd ..

# Start
uvicorn backend.main:app --host 0.0.0.0 --port 8001
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_CLIENT_ID` | Discord application client ID |
| `DISCORD_CLIENT_SECRET` | Discord application client secret |
| `OAUTH2_REDIRECT_URI` | OAuth2 callback URL |
| `OWNER_DISCORD_ID` | Your Discord user ID (gets owner role) |
| `JWT_SECRET_KEY` | Secret key for JWT tokens |
| `FRONTEND_URL` | Public URL of your panel |

## Tech Stack

- **Backend:** FastAPI, SQLAlchemy, SQLite, Paramiko (SSH)
- **Frontend:** React 18, TypeScript, Tailwind CSS v4, Vite
- **Desktop:** Electron
- **Auth:** Discord OAuth2 + JWT

## License

MIT
